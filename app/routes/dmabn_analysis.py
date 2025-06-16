# API routes for DMABN geometry analysis

import os
import json
import logging
from flask import Blueprint, request, jsonify, current_app, session
from app.models.dmabn_analyzer import DMABNGeometryAnalyzer

logger = logging.getLogger(__name__)

# Create blueprint for DMABN analysis routes
dmabn_bp = Blueprint('dmabn_analysis', __name__, url_prefix='/api/dmabn')

@dmabn_bp.route('/analyze', methods=['POST'])
def analyze_geometry():
    """
    Analyze DMABN geometry parameters from trajectory data.
    """
    try:
        
        # Get session ID from URL or session (match viewer pattern)
        session_id = request.args.get('session') or session.get('session_id')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'No active session found. Please upload and process files first.'
            }), 400
        
        # Load existing trajectory data (JSON format)
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}_processed.json")
        print(f"DEBUG: Looking for file: {session_file}")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'No processed data found for this session.'
            }), 404
        
        # Load trajectory data
        with open(session_file, 'r') as f:
            cached_data = json.load(f)
        
        trajectory_data = cached_data.get('trajectory', [])
        print(f"DEBUG: Found {len(trajectory_data)} trajectory frames")

        analyzer = DMABNGeometryAnalyzer()
        
        if not trajectory_data:
            return jsonify({
                'success': False,
                'error': 'No trajectory data found in session.'
            }), 400

        # Check if user has selected a specific calculation method
        preferred_method = cached_data.get('dmabn_calculation_method', 'default')
        if preferred_method == 'dihedral':
            analyzer.switch_to_dihedral_method()
            print("DEBUG: Using dihedral method for twist calculation")
        elif preferred_method == 'plane':
            analyzer.switch_to_plane_method()
            print("DEBUG: Using plane-to-plane method for twist calculation")
        else:
            print("DEBUG: Using default twist calculation method")
        
        # Perform analysis on all frames
        print(f"DEBUG: Starting analysis on all {len(trajectory_data)} frames")
        analysis_results = analyzer.analyze_trajectory(trajectory_data)
        print(f"DEBUG: Analysis complete, got {len(analysis_results['geometry_data'])} results")
        
        # Save analysis results to cache
        cached_data['dmabn_analysis'] = analysis_results
        with open(session_file, 'w') as f:
            json.dump(cached_data, f, default=str)
        print("DEBUG: Saved analysis results to cache")
        
        # Return real analysis results
        return jsonify({
            'success': True,
            'session_id': session_id,
            'analysis_summary': {
                'total_frames': analysis_results['metadata']['total_frames'],
                'successful_frames': analysis_results['metadata']['successful_frames'],
                'key_frames_count': len(analysis_results['metadata']['key_frames']),
                'parameters_analyzed': ['twist_angle', 'ring_planarity', 'ring_nitrile_angle', 
                                        'donor_acceptor_distance', 'amino_pyramidalization']
            },
            'fragment_mapping': analysis_results['fragment_mapping'],
            'key_frames': analysis_results['metadata']['key_frames'][:5]  # Top 5 key frames
        })
        
    except Exception as e:
        print(f"DEBUG: Error in analyze_geometry: {e}")
        return jsonify({
            'success': False,
            'error': f'Analysis failed: {str(e)}'
        }), 500

@dmabn_bp.route('/data/<session_id>', methods=['GET'])
def get_geometry_data(session_id):
    """
    Get DMABN geometry analysis data for visualization.
    """
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
        
        dmabn_analysis = cached_data.get('dmabn_analysis')
        if not dmabn_analysis:
            return jsonify({
                'success': False,
                'error': 'No DMABN analysis found. Please run analysis first.'
            }), 404
        
        return jsonify({
            'success': True,
            'geometry_data': dmabn_analysis['geometry_data'],
            'fragment_mapping': dmabn_analysis['fragment_mapping'],
            'metadata': dmabn_analysis['metadata']
        })
        
    except Exception as e:
        print(f"Error retrieving DMABN data: {e}")
        return jsonify({
            'success': False,
            'error': f'Failed to retrieve data: {str(e)}'
        }), 500

@dmabn_bp.route('/export/<session_id>/<format>', methods=['GET'])
def export_analysis(session_id, format):
    """
    Export DMABN geometry analysis results.
    
    Args:
        session_id: Session identifier
        format: Export format ('json' or 'csv')
    """
    try:
        if format not in ['json', 'csv']:
            return jsonify({
                'success': False,
                'error': 'Unsupported export format. Use json or csv.'
            }), 400
        
        processed_dir = current_app.config.get('PROCESSED_DATA_DIR', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}.pkl")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'Session data not found'
            }), 404
        
        # Load cached data
        with open(session_file, 'rb') as f:
            cached_data = pickle.load(f)
        
        dmabn_analysis = cached_data.get('dmabn_analysis')
        if not dmabn_analysis:
            return jsonify({
                'success': False,
                'error': 'No DMABN analysis found.'
            }), 404
        
        # Create analyzer instance and load data
        analyzer = DMABNGeometryAnalyzer()
        analyzer.geometry_data = dmabn_analysis['geometry_data']
        analyzer.fragment_mapping = dmabn_analysis['fragment_mapping']
        analyzer.analysis_metadata = dmabn_analysis['metadata']
        
        # Export data
        exported_data = analyzer.export_analysis(format)
        
        # Set appropriate response headers
        if format == 'json':
            response = current_app.response_class(
                exported_data,
                mimetype='application/json'
            )
            response.headers['Content-Disposition'] = f'attachment; filename=dmabn_analysis_{session_id}.json'
        else:  # csv
            response = current_app.response_class(
                exported_data,
                mimetype='text/csv'
            )
            response.headers['Content-Disposition'] = f'attachment; filename=dmabn_analysis_{session_id}.csv'
        
        return response
        
    except Exception as e:
        logger.error(f"Error exporting DMABN analysis: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Export failed: {str(e)}'
        }), 500

@dmabn_bp.route('/fragments/<session_id>', methods=['POST'])
def set_fragment_mapping(session_id):
    """
    Set custom fragment mapping for DMABN analysis.
    Used when user manually selects molecular fragments.
    """
    try:
        request_data = request.get_json()
        if not request_data or 'fragment_mapping' not in request_data:
            return jsonify({
                'success': False,
                'error': 'Fragment mapping data required'
            }), 400
        
        fragment_mapping = request_data['fragment_mapping']
        
        # Validate fragment mapping structure
        required_fragments = [
            'benzene_ring', 'amino_nitrogen', 'amino_carbons',
            'nitrile_carbon', 'nitrile_nitrogen'
        ]
        
        for fragment in required_fragments:
            if fragment not in fragment_mapping:
                return jsonify({
                    'success': False,
                    'error': f'Missing required fragment: {fragment}'
                }), 400
        
        # Load session data
        processed_dir = current_app.config.get('PROCESSED_DATA_DIR', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}.pkl")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'Session data not found'
            }), 404
        
        # Update fragment mapping in cached data
        with open(session_file, 'rb') as f:
            cached_data = pickle.load(f)
        
        # Store fragment mapping for future analysis
        cached_data['fragment_mapping'] = fragment_mapping
        
        with open(session_file, 'wb') as f:
            pickle.dump(cached_data, f)
        
        logger.info(f"Fragment mapping updated for session {session_id}")
        return jsonify({
            'success': True,
            'message': 'Fragment mapping saved successfully'
        })
        
    except Exception as e:
        logger.error(f"Error setting fragment mapping: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to set fragment mapping: {str(e)}'
        }), 500

@dmabn_bp.route('/status/<session_id>', methods=['GET'])
def get_analysis_status(session_id):
    """
    Get status of DMABN analysis for a session.
    """
    try:
        processed_dir = current_app.config.get('PROCESSED_DATA_DIR', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}.pkl")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'Session not found'
            }), 404
        
        with open(session_file, 'rb') as f:
            cached_data = pickle.load(f)
        
        has_trajectory = 'trajectory' in cached_data and len(cached_data['trajectory']) > 0
        has_analysis = 'dmabn_analysis' in cached_data
        has_fragment_mapping = 'fragment_mapping' in cached_data
        
        status = {
            'session_id': session_id,
            'has_trajectory_data': has_trajectory,
            'has_dmabn_analysis': has_analysis,
            'has_custom_fragments': has_fragment_mapping,
            'ready_for_analysis': has_trajectory
        }
        
        if has_analysis:
            analysis_data = cached_data['dmabn_analysis']
            status['analysis_summary'] = {
                'total_frames': analysis_data['metadata']['total_frames'],
                'successful_frames': analysis_data['metadata']['successful_frames'],
                'key_frames_count': len(analysis_data['metadata']['key_frames'])
            }
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        logger.error(f"Error getting analysis status: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to get status: {str(e)}'
        }), 500
    
@dmabn_bp.route('/debug_twist/<session_id>', methods=['GET'])
def debug_twist_calculation(session_id):
    """
    Debug the twist angle calculation issue.
    """
    try:
        processed_dir = current_app.config.get('PROCESSED_FOLDER', 'data/processed')
        session_file = os.path.join(processed_dir, f"{session_id}_processed.json")
        
        if not os.path.exists(session_file):
            return jsonify({
                'success': False,
                'error': 'Session data not found'
            }), 404
        
        # Load trajectory data
        with open(session_file, 'r') as f:
            cached_data = json.load(f)
        
        trajectory_data = cached_data.get('trajectory', [])
        
        if not trajectory_data:
            return jsonify({
                'success': False,
                'error': 'No trajectory data found'
            }), 400
        
        # Initialize analyzer and run debug
        analyzer = DMABNGeometryAnalyzer()
        
        # Use the quick diagnosis method
        debug_results = analyzer.quick_twist_diagnosis(trajectory_data, max_frames=5)
        
        return jsonify({
            'success': True,
            'debug_results': debug_results,
            'session_id': session_id
        })
        
    except Exception as e:
        logger.error(f"Error in debug_twist_calculation: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Debug failed: {str(e)}'
        }), 500
    
@dmabn_bp.route('/switch_method', methods=['POST'])
def switch_calculation_method():
    """
    Switch the twist angle calculation method.
    """
    try:
        request_data = request.get_json()
        session_id = request_data.get('session_id')
        method = request_data.get('method', 'dihedral')
        
        if not session_id:
            return jsonify({
                'success': False,
                'error': 'Session ID required'
            }), 400
        
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
        
        # Store the method preference
        cached_data['dmabn_calculation_method'] = method
        
        # Save back to cache
        with open(session_file, 'w') as f:
            json.dump(cached_data, f, default=str)
        
        logger.info(f"Switched DMABN calculation method to {method} for session {session_id}")
        
        return jsonify({
            'success': True,
            'method': method,
            'message': f'Calculation method switched to {method}'
        })
        
    except Exception as e:
        logger.error(f"Error switching calculation method: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to switch method: {str(e)}'
        }), 500