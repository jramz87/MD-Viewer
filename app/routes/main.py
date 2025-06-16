# app/routes/main.py - Main application routes

from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
import os
import uuid
import shutil
import json
from datetime import datetime

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Main upload page"""
    return render_template('index.html')

@main_bp.route('/viewer')
def viewer():
    """3D Molecular Viewer page"""
    
    # Get session ID from various sources
    session_id = None
    
    # 1. Try URL parameter
    session_id = request.args.get('session')
    
    # 2. Try Flask session
    if not session_id:
        session_id = session.get('upload_session_id')
    
    # 3. Try from form data or referrer
    if not session_id:
        session_id = request.form.get('session_id')
    
    if not session_id:
        # Redirect to upload page if no session
        return redirect(url_for('main.index'))
    
    # Validate session exists
    cache_file = os.path.join('data', 'processed', f'{session_id}.json')
    if not os.path.exists(cache_file):
        # Session data not found, redirect to upload
        return redirect(url_for('main.index'))
    
    return render_template('viewer.html', session_id=session_id)

@main_bp.route('/api/examples/<example_type>', methods=['GET'])
def load_example_data(example_type):
    """Load example/sample data for demonstrations"""
    try:
        if example_type == 'DMABNvacuum':
            # Generate session ID
            session_id = str(uuid.uuid4())
            session['upload_session_id'] = session_id
            session['molecule_type'] = 'dmabn'
            
            print(f"Sample Data: Automatically set molecule_type to 'dmabn' for session {session_id}")
            
            # Create session directory
            upload_dir = os.path.join('data/uploads', session_id)
            os.makedirs(upload_dir, exist_ok=True)
            
            # Copy sample DMABN files
            sample_files_dir = 'data/examples'
            sample_files = ['coors.xyz', 's1.dat', 's2.dat']
            copied_files = []
            
            for filename in sample_files:
                source_path = os.path.join(sample_files_dir, filename)
                if os.path.exists(source_path):
                    dest_path = os.path.join(upload_dir, filename)
                    shutil.copy2(source_path, dest_path)
                    copied_files.append(filename)
                    print(f"Copied sample file: {filename}")
            
            # Process the copied files to create the cached JSON data
            try:
                from app.utils.molecular_data_processor import process_uploaded_files
                
                processing_result = process_uploaded_files(
                    session_id=session_id,
                    molecule_type='dmabn'
                )
                
                if not processing_result['success']:
                    return jsonify({
                        'success': False,
                        'error': f'Failed to process sample data: {processing_result.get("error")}'
                    }), 500
                    
                print(f"Sample data processed successfully for session {session_id}")
                
            except ImportError:
                # Fallback: create minimal processed data manually
                print("Warning: molecular_data_processor not found, creating minimal cache")
                
                processed_dir = 'data/processed'
                os.makedirs(processed_dir, exist_ok=True)
                
                # Create minimal cache structure
                cache_data = {
                    'session_id': session_id,
                    'molecule_type': 'dmabn',
                    'trajectory': [],
                    'excitation': [],
                    'metadata': {
                        'processed_at': datetime.now().isoformat(),
                        'sample_data': True,
                        'molecule_type': 'dmabn'
                    }
                }
                
                cache_file = os.path.join(processed_dir, f'{session_id}_processed.json')
                with open(cache_file, 'w') as f:
                    json.dump(cache_data, f)
                
                print(f"Created minimal cache at {cache_file}")
                
            except Exception as proc_error:
                print(f"Processing error: {proc_error}")
                return jsonify({
                    'success': False,
                    'error': f'Sample data processing failed: {str(proc_error)}'
                }), 500
            
            return jsonify({
                'success': True,
                'session_id': session_id,
                'molecule_type': 'dmabn',
                'message': f'DMABN sample data loaded and processed',
                'files': copied_files
            })
        
        else:
            return jsonify({
                'success': False,
                'error': f'Unknown example type: {example_type}'
            }), 400
            
    except Exception as e:
        print(f"Error loading example data: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to load example data: {str(e)}'
        }), 500