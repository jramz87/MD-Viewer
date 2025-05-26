# app/routes/main.py - Main application routes

from flask import Blueprint, render_template, session, redirect, url_for, request
import os

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

@main_bp.route('/examples')
def examples():
    """Example data page"""
    return render_template('examples.html')

@main_bp.route('/help')
def help():
    """Help and documentation page"""
    return render_template('help.html')

@main_bp.route('/about')
def about():
    """About page"""
    return render_template('about.html')