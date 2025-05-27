#!/usr/bin/env python3
"""
DMABN MD & Excitation Data Viewer - Flask Application
Main application entry point
"""

import os
import sys
import json
import uuid
from datetime import datetime

import numpy as np
from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Import our custom modules
from app.models.trajectory import TrajectoryProcessor
from app.models.excitation import ExcitationProcessor
from app.models.analysis import MolecularAnalysis
from app.utils.file_parser import FileParser

# Configuration
class Config:
    UPLOAD_FOLDER = 'data/uploads'
    PROCESSED_FOLDER = 'data/processed'
    UPLOAD_FOLDER = 'data/uploads'
    PROCESSED_FOLDER = 'data/processed'
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
    SEND_FILE_MAX_AGE_DEFAULT = 0
    PERMANENT_SESSION_LIFETIME = 2*3600  # 2 hours

# Simple file validation function
def validate_file(file):
    """Basic file validation"""
    allowed_extensions = {'.xyz', '.dat', '.txt'}
    if not file or file.filename == '':
        return {'valid': False, 'error': 'No file provided'}
    
    filename = file.filename.lower()
    file_ext = os.path.splitext(filename)[1]
    
    if file_ext not in allowed_extensions:
        return {'valid': False, 'error': 'Invalid file type'}
    
    # Determine file type
    file_type = 'unknown'
    if filename == 'coors.xyz':
        file_type = 'trajectory'
    elif filename in ['s1.dat', 's2.dat']:
        file_type = 'excitation'
    elif filename == 'fail.dat':
        file_type = 'failed_calculations'
    
    return {'valid': True, 'type': file_type}

# Create Flask app
app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
app.secret_key = 'toto'
app.config.from_object(Config)

# Timeout configurations
app.config['UPLOAD_TIMEOUT'] = 600  # 10 minutes
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

# Enable CORS
CORS(app)

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Initialize processors
trajectory_processor = TrajectoryProcessor()
excitation_processor = ExcitationProcessor()
data_analyzer = MolecularAnalysis()
file_parser = FileParser()

@app.route('/test')
def test():
    return '<h1>Flask is working!</h1>'

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/viewer')
def viewer():
    """Viewer interface"""
    # Try to get session ID from various sources
    session_id = None
    
    # 1. Try URL parameter
    session_id = request.args.get('session')
    
    # 2. Try Flask session
    if not session_id:
        session_id = session.get('session_id')
    
    # 3. Check if we have any processed data files
    if not session_id:
        try:
            processed_files = os.listdir(app.config['PROCESSED_FOLDER'])
            if processed_files:
                # Get the most recent processed file
                latest_file = max(processed_files, key=lambda f: os.path.getctime(
                    os.path.join(app.config['PROCESSED_FOLDER'], f)
                ))
                if latest_file.endswith('_processed.json'):
                    session_id = latest_file.replace('_processed.json', '')
        except:
            pass
    
    # 4. If still no session, redirect to upload
    if not session_id:
        return render_template('index.html', 
                            error="No molecular data found. Please upload your files first.")
    
    # Verify session data exists
    processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
    if not os.path.exists(processed_file):
        return render_template('index.html', 
                            error=f"Session data not found for {session_id}. Please upload your files again.")
    
    return render_template('viewer.html', session_id=session_id)

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Handle file uploads with better timeout handling"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400
        
        # Generate unique session ID
        session_id = str(uuid.uuid4())
        session['session_id'] = session_id
        
        # Create session folder
        session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        os.makedirs(session_folder, exist_ok=True)
        
        uploaded_files = {}
        total_size = 0
        
        for file in files:
            if file.filename == '':
                continue
                
            # Check file size before processing
            file.seek(0, 2)  # Seek to end
            file_size = file.tell()
            file.seek(0)  # Reset to beginning
            
            total_size += file_size
            
            # Check total size limit (500MB)
            if total_size > 500 * 1024 * 1024:
                return jsonify({'error': 'Total file size exceeds 500MB limit'}), 400
                
            # Validate file
            validation_result = validate_file(file)
            if not validation_result['valid']:
                return jsonify({'error': f"Invalid file {file.filename}: {validation_result['error']}"}), 400
            
            # Save file with progress tracking
            filename = secure_filename(file.filename)
            filepath = os.path.join(session_folder, filename)
            
            # Save in chunks to avoid memory issues
            with open(filepath, 'wb') as f:
                while True:
                    chunk = file.read(8192)  # 8KB chunks
                    if not chunk:
                        break
                    f.write(chunk)
            
            uploaded_files[filename] = {
                'path': filepath,
                'size': os.path.getsize(filepath),
                'type': validation_result['type']
            }
        
        app.logger.info(f"Successfully uploaded {len(uploaded_files)} files for session {session_id}")
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'files': uploaded_files,
            'message': f'Successfully uploaded {len(uploaded_files)} files'
        })
        
    except Exception as e:
        app.logger.error(f"Upload error: {str(e)}")
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@app.route('/api/process', methods=['POST'])
def process_data():
    """Process uploaded files"""
    try:
        session_id = session.get('session_id')
        if not session_id:
            return jsonify({'error': 'No active session'}), 400
        
        session_folder = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        if not os.path.exists(session_folder):
            return jsonify({'error': 'Session not found'}), 404
        
        # Find uploaded files
        files = {}
        for filename in os.listdir(session_folder):
            filepath = os.path.join(session_folder, filename)
            files[filename] = filepath
        
        # Process trajectory file (required)
        trajectory_data = None
        if 'coors.xyz' in files:
            app.logger.info("Processing trajectory file...")
            trajectory_data = trajectory_processor.read_trajectory(files['coors.xyz'])
            app.logger.info(f"Loaded {len(trajectory_data)} trajectory frames")
        else:
            return jsonify({'error': 'Required file coors.xyz not found'}), 400
        
        # Process excitation data (optional)
        excitation_data = None
        if 's1.dat' in files and 's2.dat' in files:
            app.logger.info("Processing excitation data...")
            fail_file = files.get('fail.dat')
            
            excitation_data = excitation_processor.process_excitation_data(
                files['s1.dat'], files['s2.dat'], fail_file
            )
            app.logger.info(f"Loaded {len(excitation_data)} excitation calculations")
        
        # Perform basic analysis
        analysis_results = {}
        if trajectory_data:
            analysis_results['trajectory_stats'] = trajectory_processor.get_trajectory_statistics(trajectory_data)
        if excitation_data:
            analysis_results['excitation_stats'] = excitation_processor.get_excitation_statistics(excitation_data)
        
        # Cache processed data
        processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
        with open(processed_file, 'w') as f:
            json.dump({
                'trajectory': trajectory_data,
                'excitation': excitation_data,
                'analysis': analysis_results,
                'processed_at': datetime.now().isoformat()
            }, f, default=str)
        
        return jsonify({
            'success': True,
            'trajectory_frames': len(trajectory_data) if trajectory_data else 0,
            'excitation_points': len(excitation_data) if excitation_data else 0,
            'analysis': analysis_results,
            'session_id': session_id
        })
        
    except Exception as e:
        app.logger.error(f"Processing error: {str(e)}")
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/api/sessions')
def list_sessions():
    """List available processed sessions"""
    try:
        sessions = []
        if os.path.exists(app.config['PROCESSED_FOLDER']):
            for filename in os.listdir(app.config['PROCESSED_FOLDER']):
                if filename.endswith('_processed.json'):
                    session_id = filename.replace('_processed.json', '')
                    filepath = os.path.join(app.config['PROCESSED_FOLDER'], filename)
                    
                    # Get file info
                    stat = os.stat(filepath)
                    
                    # Try to read basic info
                    try:
                        with open(filepath, 'r') as f:
                            data = json.load(f)
                        
                        sessions.append({
                            'session_id': session_id,
                            'created_at': data.get('processed_at', 'unknown'),
                            'trajectory_frames': len(data.get('trajectory', [])),
                            'excitation_points': len(data.get('excitation', [])),
                            'file_size': stat.st_size
                        })
                    except:
                        sessions.append({
                            'session_id': session_id,
                            'created_at': 'unknown',
                            'trajectory_frames': 0,
                            'excitation_points': 0,
                            'file_size': stat.st_size,
                            'error': 'Could not read session data'
                        })
        
        return jsonify({
            'success': True,
            'sessions': sessions,
            'count': len(sessions)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/data/<session_id>')
def get_data(session_id):
    """Get processed data for a session"""
    try:
        processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
        
        if not os.path.exists(processed_file):
            return jsonify({'error': 'Processed data not found'}), 404
        
        with open(processed_file, 'r') as f:
            data = json.load(f)
        
        return jsonify(data)
        
    except Exception as e:
        app.logger.error(f"Data retrieval error: {str(e)}")
        return jsonify({'error': f'Failed to retrieve data: {str(e)}'}), 500

@app.route('/api/frame/<session_id>/<int:frame_index>')
def get_frame(session_id, frame_index):
    """Get specific frame data"""
    try:
        processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
        
        if not os.path.exists(processed_file):
            return jsonify({'error': 'Processed data not found'}), 404
        
        with open(processed_file, 'r') as f:
            data = json.load(f)
        
        trajectory = data['trajectory']
        if frame_index >= len(trajectory):
            return jsonify({'error': 'Frame index out of range'}), 400
        
        frame_data = trajectory[frame_index]
        
        # Check if this frame has excitation data
        excitation_info = None
        if data['excitation']:
            frame_time = frame_data.get('time_fs', frame_index * 0.5)
            # Find matching excitation data
            for exc in data['excitation']:
                if abs(exc['time_fs'] - frame_time) < 1.0:
                    excitation_info = {
                        's1_energy': exc['s1_energy'],
                        's1_osc': exc['s1_oscillator'],
                        's2_energy': exc['s2_energy'],
                        's2_osc': exc['s2_oscillator'],
                        'time_fs': exc['time_fs']
                    }
                    break
        
        return jsonify({
            'frame': frame_data,
            'excitation': excitation_info,
            'frame_index': frame_index
        })
        
    except Exception as e:
        app.logger.error(f"Frame retrieval error: {str(e)}")
        return jsonify({'error': f'Failed to retrieve frame: {str(e)}'}), 500

@app.route('/api/spectrum/<session_id>')
def get_spectrum(session_id):
    """Generate average absorption spectrum"""
    try:
        processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
        
        if not os.path.exists(processed_file):
            return jsonify({'error': 'Processed data not found'}), 404
        
        with open(processed_file, 'r') as f:
            data = json.load(f)
        
        if not data['excitation']:
            return jsonify({'error': 'No excitation data available'}), 400
        
        # Generate average spectrum
        spectrum_data = excitation_processor.generate_average_spectrum(data['excitation'])
        
        return jsonify(spectrum_data)
        
    except Exception as e:
        app.logger.error(f"Spectrum generation error: {str(e)}")
        return jsonify({'error': f'Failed to generate spectrum: {str(e)}'}), 500

@app.route('/api/analysis/<session_id>')
def get_analysis(session_id):
    """Get analysis results"""
    try:
        processed_file = os.path.join(app.config['PROCESSED_FOLDER'], f"{session_id}_processed.json")
        
        if not os.path.exists(processed_file):
            return jsonify({'error': 'Processed data not found'}), 404
        
        with open(processed_file, 'r') as f:
            data = json.load(f)
        
        return jsonify(data['analysis'])
        
    except Exception as e:
        app.logger.error(f"Analysis retrieval error: {str(e)}")
        return jsonify({'error': f'Failed to retrieve analysis: {str(e)}'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)