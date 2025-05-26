#!/usr/bin/env python3
"""
DMABN MD Viewer - Application Runner
Development server entry point
"""

import os
import sys

if __name__ == '__main__':
    # Add current directory to path so imports work
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    # Import the Flask app from app.py
    from app import app  # This imports the 'app' variable from your app.py file
    
    # Development server settings
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    host = os.environ.get('FLASK_HOST', '0.0.0.0')
    port = int(os.environ.get('FLASK_PORT', 5001))
    
    print("🧬 Starting DMABN MD Viewer...")
    print(f"🌐 Server: http://{host}:{port}")
    print(f"🔧 Debug mode: {debug_mode}")
    print("📁 Make sure to upload your data files!")
    print("=" * 50)
    
    try:
        app.run(
            debug=debug_mode,
            host=host,
            port=port,
            threaded=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)