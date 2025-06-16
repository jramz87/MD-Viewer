# app/routes/upload.py - File upload handling

from flask import Blueprint, request, jsonify, session, current_app
import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import json

upload_bp = Blueprint('upload', __name__, url_prefix='/api')

# Configuration
ALLOWED_EXTENSIONS = {'xyz', 'dat', 'txt'}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
UPLOAD_FOLDER = 'data/uploads'

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
            filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_file_size(file):
    """Validate file size"""
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)  # Reset to beginning
    return size <= MAX_FILE_SIZE

@upload_bp.route('/upload', methods=['POST'])
def upload_files():
    """Handle file upload"""
    try:
        # Check if files are present
        if 'files' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No files provided'
            }), 400
        
        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({
                'success': False,
                'error': 'No files selected'
            }), 400
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        session['upload_session_id'] = session_id
        
        # Create upload directory
        upload_dir = os.path.join(UPLOAD_FOLDER, session_id)
        os.makedirs(upload_dir, exist_ok=True)
        
        uploaded_files = []
        errors = []

        # Get molecule type from form data
        molecule_type = request.form.get('molecule_type', 'generic')
        session['molecule_type'] = molecule_type

        print(f"Upload: Molecule type selected: {molecule_type}")
        
        # Process each file
        for file in files:
            if file.filename == '':
                continue
                
            filename = secure_filename(file.filename.lower())
            
            # Validate file
            if not allowed_file(filename):
                errors.append(f"File type not allowed: {filename}")
                continue
            
            if not validate_file_size(file):
                errors.append(f"File too large: {filename}")
                continue
            
            # Save file
            try:
                file_path = os.path.join(upload_dir, filename)
                file.save(file_path)
                
                # Get file info
                file_size = os.path.getsize(file_path)
                
                uploaded_files.append({
                    'filename': filename,
                    'size': file_size,
                    'path': file_path
                })
                
                print(f"Uploaded: {filename} ({file_size} bytes)")
                
            except Exception as e:
                errors.append(f"Failed to save {filename}: {str(e)}")
                print(f"Upload error for {filename}: {e}")
        
        # Check if we have required files
        filenames = [f['filename'] for f in uploaded_files]
        has_trajectory = 'coors.xyz' in filenames
        
        if not has_trajectory:
            return jsonify({
                'success': False,
                'error': 'Required file missing: coors.xyz',
                'uploaded_files': uploaded_files,
                'errors': errors
            }), 400
        
        # Success response
        response_data = {
            'success': True,
            'session_id': session_id,
            'uploaded_files': uploaded_files,
            'file_count': len(uploaded_files),
            'total_size': sum(f['size'] for f in uploaded_files),
            'timestamp': datetime.now().isoformat(),
            'molecule_type': molecule_type
        }
        
        if errors:
            response_data['warnings'] = errors
        
        print(f"Upload successful: {len(uploaded_files)} files, session {session_id}")
        
        return jsonify(response_data)
        
    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({
            'success': False,
            'error': f'Upload failed: {str(e)}'
        }), 500

@upload_bp.route('/upload/status/<session_id>')
def upload_status(session_id):
    """Get upload status for a session"""
    try:
        upload_dir = os.path.join(UPLOAD_FOLDER, session_id)
        
        if not os.path.exists(upload_dir):
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        # List uploaded files
        files = []
        total_size = 0
        
        for filename in os.listdir(upload_dir):
            file_path = os.path.join(upload_dir, filename)
            if os.path.isfile(file_path):
                file_size = os.path.getsize(file_path)
                files.append({
                    'filename': filename,
                    'size': file_size,
                    'uploaded_at': datetime.fromtimestamp(
                        os.path.getctime(file_path)
                    ).isoformat()
                })
                total_size += file_size
        
        # Check file types
        filenames = [f['filename'] for f in files]
        file_status = {
            'coors.xyz': 'coors.xyz' in filenames,
            's1.dat': 's1.dat' in filenames,
            's2.dat': 's2.dat' in filenames,
            'fail.dat': 'fail.dat' in filenames
        }
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'files': files,
            'file_count': len(files),
            'total_size': total_size,
            'file_status': file_status,
            'ready_for_processing': file_status['coors.xyz']
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@upload_bp.route('/upload/clear/<session_id>', methods=['DELETE'])
def clear_upload(session_id):
    """Clear uploaded files for a session"""
    try:
        upload_dir = os.path.join(UPLOAD_FOLDER, session_id)
        
        if os.path.exists(upload_dir):
            import shutil
            shutil.rmtree(upload_dir)
            
            # Also clear processed data
            processed_file = os.path.join('data', 'processed', f'{session_id}.json')
            if os.path.exists(processed_file):
                os.remove(processed_file)
        
        # Clear session
        if 'upload_session_id' in session and session['upload_session_id'] == session_id:
            session.pop('upload_session_id', None)
        
        return jsonify({
            'success': True,
            'message': 'Upload cleared successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Utility function to clean old uploads
def cleanup_old_uploads(max_age_hours=24):
    """Clean up uploads older than specified hours"""
    
    if not os.path.exists(UPLOAD_FOLDER):
        return
    
    import time
    current_time = time.time()
    max_age_seconds = max_age_hours * 3600
    
    cleaned_count = 0
    
    for session_dir in os.listdir(UPLOAD_FOLDER):
        session_path = os.path.join(UPLOAD_FOLDER, session_dir)
        
        if os.path.isdir(session_path):
            # Check directory age
            dir_age = current_time - os.path.getctime(session_path)
            
            if dir_age > max_age_seconds:
                try:
                    import shutil
                    shutil.rmtree(session_path)
                    
                    # Also clean processed data
                    processed_file = os.path.join('data', 'processed', f'{session_dir}.json')
                    if os.path.exists(processed_file):
                        os.remove(processed_file)
                    
                    cleaned_count += 1
                    print(f"Cleaned old upload: {session_dir}")
                    
                except Exception as e:
                    print(f"Failed to clean {session_dir}: {e}")
    
    if cleaned_count > 0:
        print(f"Cleanup complete: {cleaned_count} old uploads removed")

@upload_bp.route('/data/<session_id>', methods=['GET'])
def get_session_data(session_id):
    """
    Get trajectory and excitation data for a session.
    This is what the viewer calls to load basic data.
    """
    print(f"🔍 DEBUG: get_session_data called with session_id: {session_id}")
    try:
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}_processed.json")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'Session data not found'
            }), 404
        
        # Load cached data
        with open(session_file, 'r') as f:
            cached_data = json.load(f)
        
        print(f"Cache file contents keys: {list(cached_data.keys())}")
        print(f"Molecule type in cache: {cached_data.get('molecule_type', 'NOT FOUND')}")
        
        # Get molecule type from the cached data
        molecule_type = cached_data.get('molecule_type', 'generic')
        
        return jsonify({
            'success': True,
            'trajectory': cached_data.get('trajectory', []),
            'excitation': cached_data.get('excitation', []),
            'molecule_type': molecule_type,
            'metadata': cached_data.get('metadata', {})
        })
        
    except Exception as e:
        print(f"Error retrieving session data: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to retrieve data: {str(e)}'
        }), 500