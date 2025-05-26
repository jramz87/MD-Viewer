#!/usr/bin/env python3
"""
Configuration settings for DMABN MD Viewer
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    """Base configuration class"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    # File upload settings
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 100 * 1024 * 1024))  # 100MB default
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or os.path.join(os.getcwd(), 'data', 'uploads')
    PROCESSED_FOLDER = os.environ.get('PROCESSED_FOLDER') or os.path.join(os.getcwd(), 'data', 'processed')
    
    # Allowed file extensions
    ALLOWED_EXTENSIONS = {
        'xyz': ['xyz'],
        'dat': ['dat', 'txt'],
        'general': ['xyz', 'dat', 'txt', 'pdb', 'mol2']
    }
    
    # Data processing settings
    TRAJECTORY_TIMESTEP = float(os.environ.get('TRAJECTORY_TIMESTEP', 0.5))  # fs per frame
    EQUILIBRATION_TIME = float(os.environ.get('EQUILIBRATION_TIME', 5000))   # fs
    EXCITATION_INTERVAL = float(os.environ.get('EXCITATION_INTERVAL', 2))    # fs
    
    # Analysis settings
    BOND_CUTOFFS = {
        'default': 1.8,
        'hydrogen': 1.2,
        'sulfur': 2.2,
        'phosphorus': 2.2
    }
    
    # Visualization settings
    ATOM_COLORS = {
        'C': '#909090',  # Dark gray
        'N': '#3050f8',  # Blue
        'O': '#ff0d0d',  # Red
        'H': '#ffffff',  # White
        'S': '#ffff30',  # Yellow
        'P': '#ff8000',  # Orange
        'F': '#90e050',  # Light green
        'Cl': '#1ff01f', # Green
        'Br': '#a62929', # Dark red
        'I': '#940094'   # Purple
    }
    
    ATOM_SIZES = {
        'C': 0.7, 'N': 0.65, 'O': 0.6, 'H': 0.25,
        'S': 1.0, 'P': 1.0, 'F': 0.5, 'Cl': 0.75,
        'Br': 0.85, 'I': 0.95
    }
    
    # Cache settings
    CACHE_TIMEOUT = int(os.environ.get('CACHE_TIMEOUT', 3600))  # 1 hour
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    LOG_FILE = os.environ.get('LOG_FILE') or 'dmabn_viewer.log'

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    DEVELOPMENT = True

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    DEVELOPMENT = False
    
    # Use stronger secret key in production
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'production-secret-key-must-be-set'
    
    # Production-specific settings
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB for production
    
class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    WTF_CSRF_ENABLED = False
    UPLOAD_FOLDER = '/tmp/dmabn_test_uploads'
    PROCESSED_FOLDER = '/tmp/dmabn_test_processed'

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}