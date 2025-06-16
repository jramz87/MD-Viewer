# Data processing utilities for web viewer

import json
import csv
import io
from typing import Dict, List, Any, Optional

class DataProcessor:
    """Process and prepare molecular data for web viewer"""
    
    def __init__(self):
        self.max_trajectory_frames = 10000  # Limit for web performance
        self.max_excitation_points = 5000   # Limit for web performance
    
    def prepare_for_viewer(self, cached_data: Dict) -> Dict:
        """
        Prepare cached molecular data for web viewer consumption
        
        Args:
            cached_data: Raw processed data from cache
            
        Returns:
            Optimized data structure for web viewer
        """
        try:
            trajectory_data = cached_data.get('trajectory', [])
            excitation_data = cached_data.get('excitation', [])
            metadata = cached_data.get('metadata', {})
            
            # Optimize trajectory data for web viewer
            optimized_trajectory = self.optimize_trajectory_for_web(trajectory_data)
            
            # Optimize excitation data for web viewer
            optimized_excitation = self.optimize_excitation_for_web(excitation_data)
            
            # Prepare viewer-specific metadata
            viewer_metadata = self.prepare_viewer_metadata(
                optimized_trajectory, optimized_excitation, metadata
            )
            
            return {
                'trajectory': optimized_trajectory,
                'excitation': optimized_excitation,
                'metadata': viewer_metadata
            }
            
        except Exception as e:
            print(f"Error preparing data for viewer: {e}")
            raise
    
    def optimize_trajectory_for_web(self, trajectory_data: List[Dict]) -> List[Dict]:
        """Optimize trajectory data for web performance"""
        
        if not trajectory_data:
            return []
        
        print(f"Optimizing trajectory: {len(trajectory_data)} frames")
        
        # If too many frames, sample evenly
        if len(trajectory_data) > self.max_trajectory_frames:
            step = len(trajectory_data) // self.max_trajectory_frames
            trajectory_data = trajectory_data[::step]
            print(f"Downsampled to {len(trajectory_data)} frames")
        
        # Convert to web-friendly format
        optimized_frames = []
        
        for i, frame in enumerate(trajectory_data):
            optimized_frame = {
                'frame_number': i,  # Renumber for consistency
                'atoms': frame['atoms'],
                'coords': frame['coords'],
                'time_fs': frame.get('time_fs', i * 0.5),
                'time_ps': frame.get('time_ps', i * 0.5 / 1000.0),
                'n_atoms': len(frame['atoms'])
            }
            optimized_frames.append(optimized_frame)
        
        print(f"Trajectory optimization complete: {len(optimized_frames)} frames")
        return optimized_frames
    
    def optimize_excitation_for_web(self, excitation_data: List[Dict]) -> List[Dict]:
        """Optimize excitation data for web performance"""
        
        if not excitation_data:
            return []
        
        print(f"⚡ Optimizing excitation data: {len(excitation_data)} points")
        
        # If too many points, sample evenly
        if len(excitation_data) > self.max_excitation_points:
            step = len(excitation_data) // self.max_excitation_points
            excitation_data = excitation_data[::step]
            print(f"Downsampled to {len(excitation_data)} points")
        
        # Ensure all required fields are present and properly formatted
        optimized_excitation = []
        
        for excitation in excitation_data:
            optimized_point = {
                'calculation_index': excitation.get('calculation_index', 0),
                'time_fs': float(excitation['time_fs']),
                'time_ps': float(excitation['time_ps']),
                's1_energy': float(excitation['s1_energy']),
                's1_oscillator': float(excitation['s1_oscillator']),
                's2_energy': float(excitation['s2_energy']),
                's2_oscillator': float(excitation['s2_oscillator']),
                'energy_gap': float(excitation.get('energy_gap', 
                    excitation['s2_energy'] - excitation['s1_energy'])),
                'total_oscillator': float(excitation.get('total_oscillator',
                    excitation['s1_oscillator'] + excitation['s2_oscillator']))
            }
            optimized_excitation.append(optimized_point)
        
        print(f"Excitation optimization complete: {len(optimized_excitation)} points")
        return optimized_excitation
    
    def prepare_viewer_metadata(self, trajectory: List[Dict], 
                            excitation: List[Dict], 
                            original_metadata: Dict) -> Dict:
        """Prepare metadata for viewer"""
        
        viewer_metadata = {
            'session_info': {
                'trajectory_frames': len(trajectory),
                'excitation_points': len(excitation),
                'has_trajectory': len(trajectory) > 0,
                'has_excitation': len(excitation) > 0
            },
            'time_info': {},
            'molecular_info': {},
            'performance_info': {
                'optimized_for_web': True,
                'max_trajectory_frames': self.max_trajectory_frames,
                'max_excitation_points': self.max_excitation_points
            }
        }
        
        # Time information
        if trajectory:
            viewer_metadata['time_info'].update({
                'trajectory_time_range_fs': [trajectory[0]['time_fs'], trajectory[-1]['time_fs']],
                'trajectory_time_range_ps': [trajectory[0]['time_ps'], trajectory[-1]['time_ps']],
                'timestep_fs': 0.5
            })
        
        if excitation:
            viewer_metadata['time_info'].update({
                'excitation_time_range_fs': [excitation[0]['time_fs'], excitation[-1]['time_fs']],
                'excitation_time_range_ps': [excitation[0]['time_ps'], excitation[-1]['time_ps']],
                'excitation_interval_fs': 2.0
            })
        
        # Molecular information
        if trajectory:
            atoms = trajectory[0]['atoms']
            unique_atoms = list(set(atoms))
            atom_counts = {atom: atoms.count(atom) for atom in unique_atoms}
            
            viewer_metadata['molecular_info'] = {
                'total_atoms': len(atoms),
                'atom_types': unique_atoms,
                'atom_counts': atom_counts,
                'molecular_formula': self.generate_molecular_formula(atom_counts)
            }
        
        # Include original metadata
        viewer_metadata['original'] = original_metadata
        
        return viewer_metadata
    
    def generate_molecular_formula(self, atom_counts: Dict[str, int]) -> str:
        """Generate molecular formula from atom counts"""
        
        # Standard order for molecular formula
        formula_order = ['C', 'H', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I']
        
        formula_parts = []
        
        # Add atoms in standard order
        for atom in formula_order:
            if atom in atom_counts:
                count = atom_counts[atom]
                if count == 1:
                    formula_parts.append(atom)
                else:
                    formula_parts.append(f"{atom}{count}")
        
        # Add any remaining atoms alphabetically
        remaining_atoms = sorted([atom for atom in atom_counts if atom not in formula_order])
        for atom in remaining_atoms:
            count = atom_counts[atom]
            if count == 1:
                formula_parts.append(atom)
            else:
                formula_parts.append(f"{atom}{count}")
        
        return ''.join(formula_parts)
    
    def to_csv(self, data: Dict) -> str:
        """Export data to CSV format"""
        
        output = io.StringIO()
        
        # Export trajectory data
        if data.get('trajectory'):
            output.write("# Trajectory Data\n")
            output.write("frame,time_fs,time_ps,atom,x,y,z\n")
            
            for frame in data['trajectory']:
                frame_num = frame['frame_number']
                time_fs = frame['time_fs']
                time_ps = frame['time_ps']
                
                for i, atom in enumerate(frame['atoms']):
                    coords = frame['coords'][i]
                    output.write(f"{frame_num},{time_fs:.2f},{time_ps:.6f},{atom},"
                                f"{coords[0]:.6f},{coords[1]:.6f},{coords[2]:.6f}\n")
        
        # Export excitation data
        if data.get('excitation'):
            output.write("\n# Excitation Data\n")
            output.write("calculation_index,time_fs,time_ps,s1_energy_eV,s1_oscillator,"
                        "s2_energy_eV,s2_oscillator,energy_gap_eV,total_oscillator\n")
            
            for exc in data['excitation']:
                output.write(f"{exc['calculation_index']},{exc['time_fs']:.2f},"
                            f"{exc['time_ps']:.6f},{exc['s1_energy']:.6f},"
                            f"{exc['s1_oscillator']:.6f},{exc['s2_energy']:.6f},"
                            f"{exc['s2_oscillator']:.6f},{exc['energy_gap']:.6f},"
                            f"{exc['total_oscillator']:.6f}\n")
        
        return output.getvalue()
    
    def to_xyz(self, data: Dict) -> str:
        """Export trajectory to XYZ format"""
        
        if not data.get('trajectory'):
            return ""
        
        output = io.StringIO()
        
        for frame in data['trajectory']:
            n_atoms = frame['n_atoms']
            time_comment = f"Frame {frame['frame_number']}, Time: {frame['time_fs']:.1f} fs"
            
            output.write(f"{n_atoms}\n")
            output.write(f"{time_comment}\n")
            
            for i, atom in enumerate(frame['atoms']):
                coords = frame['coords'][i]
                output.write(f"{atom:>2s} {coords[0]:>12.6f} {coords[1]:>12.6f} {coords[2]:>12.6f}\n")
        
        return output.getvalue()
    
    def calculate_data_size(self, data: Dict) -> Dict[str, int]:
        """Calculate approximate data sizes"""
        
        sizes = {
            'trajectory_mb': 0,
            'excitation_mb': 0,
            'total_mb': 0
        }
        
        # Estimate trajectory size (approximate)
        if data.get('trajectory'):
            n_frames = len(data['trajectory'])
            n_atoms = data['trajectory'][0]['n_atoms'] if n_frames > 0 else 0
            # Rough estimate: frame + atoms + 3 coords per atom * 8 bytes per float
            trajectory_bytes = n_frames * (n_atoms * 3 * 8 + 100)  # 100 bytes overhead per frame
            sizes['trajectory_mb'] = round(trajectory_bytes / (1024 * 1024), 2)
        
        # Estimate excitation size
        if data.get('excitation'):
            n_points = len(data['excitation'])
            # Each point has ~8 float values * 8 bytes + overhead
            excitation_bytes = n_points * (8 * 8 + 50)  # 50 bytes overhead per point
            sizes['excitation_mb'] = round(excitation_bytes / (1024 * 1024), 2)
        
        sizes['total_mb'] = sizes['trajectory_mb'] + sizes['excitation_mb']
        
        return sizes
    
    def validate_data_structure(self, data: Dict) -> Dict[str, bool]:
        """Validate data structure for viewer compatibility"""
        
        validation = {
            'trajectory_valid': False,
            'excitation_valid': False,
            'metadata_valid': False,
            'overall_valid': False
        }
        
        # Validate trajectory
        if data.get('trajectory') and isinstance(data['trajectory'], list):
            if len(data['trajectory']) > 0:
                first_frame = data['trajectory'][0]
                required_fields = ['atoms', 'coords', 'time_fs', 'frame_number']
                
                if all(field in first_frame for field in required_fields):
                    if (isinstance(first_frame['atoms'], list) and 
                        isinstance(first_frame['coords'], list) and
                        len(first_frame['atoms']) == len(first_frame['coords'])):
                        validation['trajectory_valid'] = True
        
        # Validate excitation
        if data.get('excitation') and isinstance(data['excitation'], list):
            if len(data['excitation']) > 0:
                first_exc = data['excitation'][0]
                required_fields = ['time_fs', 's1_energy', 's1_oscillator', 's2_energy', 's2_oscillator']
                
                if all(field in first_exc for field in required_fields):
                    validation['excitation_valid'] = True
            else:
                validation['excitation_valid'] = True  # Empty is valid
        
        # Validate metadata
        if data.get('metadata') and isinstance(data['metadata'], dict):
            validation['metadata_valid'] = True
        
        # Overall validation
        validation['overall_valid'] = (
            validation['trajectory_valid'] and 
            validation['excitation_valid'] and 
            validation['metadata_valid']
        )
        
        return validation

def optimize_geometry_for_web(self, geometry_data: List[Dict]) -> List[Dict]:
    """Optimize DMABN geometry data for web performance"""
    
    if not geometry_data:
        return []
    
    print(f"Optimizing DMABN geometry: {len(geometry_data)} frames")
    
    # If too many frames, sample evenly
    if len(geometry_data) > self.max_trajectory_frames:
        step = len(geometry_data) // self.max_trajectory_frames
        geometry_data = geometry_data[::step]
        print(f"Downsampled to {len(geometry_data)} frames")
    
    # Convert to web-friendly format
    optimized_geometry = []
    
    for i, frame in enumerate(geometry_data):
        optimized_frame = {
            'frame_number': frame.get('frame_number', i),
            'time_fs': float(frame['time_fs']),
            'time_ps': float(frame['time_ps']),
            'twist_angle': float(frame.get('twist_angle', 0)),
            'ring_planarity': float(frame.get('ring_planarity', 0)),
            'ring_nitrile_angle': float(frame.get('ring_nitrile_angle', 0)),
            'donor_acceptor_distance': float(frame.get('donor_acceptor_distance', 0)),
            'amino_pyramidalization': float(frame.get('amino_pyramidalization', 0)),
            'analysis_failed': frame.get('analysis_failed', False)
        }
        optimized_geometry.append(optimized_frame)
    
    print(f"DMABN geometry optimization complete: {len(optimized_geometry)} frames")
    return optimized_geometry

def prepare_dmabn_viewer_data(self, cached_data: Dict) -> Dict:
    """
    Prepare DMABN-specific data for web viewer consumption
    
    Args:
        cached_data: Raw processed data from cache including DMABN analysis
        
    Returns:
        Optimized data structure for web viewer with geometry analysis
    """
    try:
        # Get standard viewer data
        viewer_data = self.prepare_for_viewer(cached_data)
        
        # Add DMABN geometry analysis if available
        dmabn_analysis = cached_data.get('dmabn_analysis')
        if dmabn_analysis:
            # Optimize geometry data for web
            optimized_geometry = self.optimize_geometry_for_web(
                dmabn_analysis['geometry_data']
            )
            
            viewer_data['dmabn_geometry'] = optimized_geometry
            viewer_data['fragment_mapping'] = dmabn_analysis['fragment_mapping']
            
            # Add geometry-specific metadata
            geometry_metadata = self.prepare_geometry_metadata(
                optimized_geometry, dmabn_analysis['metadata']
            )
            viewer_data['metadata']['geometry_info'] = geometry_metadata
            
            print(f"DMABN viewer data prepared with {len(optimized_geometry)} geometry frames")
        
        return viewer_data
        
    except Exception as e:
        print(f"Error preparing DMABN viewer data: {e}")
        raise

def prepare_geometry_metadata(self, geometry_data: List[Dict], 
                            analysis_metadata: Dict) -> Dict:
    """Prepare geometry-specific metadata for viewer"""
    
    geometry_metadata = {
        'analysis_type': 'DMABN_geometry',
        'geometry_frames': len(geometry_data),
        'has_geometry_analysis': len(geometry_data) > 0,
        'parameters': [
            'twist_angle', 'ring_planarity', 'ring_nitrile_angle',
            'donor_acceptor_distance', 'amino_pyramidalization'
        ]
    }
    
    # Time information for geometry data
    if geometry_data:
        geometry_metadata['time_info'] = {
            'geometry_time_range_fs': [geometry_data[0]['time_fs'], geometry_data[-1]['time_fs']],
            'geometry_time_range_ps': [geometry_data[0]['time_ps'], geometry_data[-1]['time_ps']]
        }
    
    # Parameter statistics
    if 'parameter_statistics' in analysis_metadata:
        geometry_metadata['parameter_statistics'] = analysis_metadata['parameter_statistics']
    
    # Key frames information
    if 'key_frames' in analysis_metadata:
        geometry_metadata['key_frames'] = analysis_metadata['key_frames']
    
    # Fragment mapping
    if 'fragment_mapping' in analysis_metadata:
        geometry_metadata['fragment_mapping'] = analysis_metadata['fragment_mapping']
    
    return geometry_metadata

def to_geometry_csv(self, geometry_data: List[Dict]) -> str:
    """Export DMABN geometry data to CSV format"""
    
    if not geometry_data:
        return ""
    
    output = io.StringIO()
    
    # Export geometry data
    output.write("# DMABN Geometry Analysis Data\n")
    output.write("frame_number,time_fs,time_ps,twist_angle_deg,ring_planarity_A,"
                "ring_nitrile_angle_deg,donor_acceptor_distance_A,amino_pyramidalization_deg\n")
    
    for frame in geometry_data:
        output.write(f"{frame['frame_number']},{frame['time_fs']:.2f},"
                    f"{frame['time_ps']:.6f},{frame['twist_angle']:.4f},"
                    f"{frame['ring_planarity']:.6f},{frame['ring_nitrile_angle']:.4f},"
                    f"{frame['donor_acceptor_distance']:.6f},"
                    f"{frame['amino_pyramidalization']:.4f}\n")
    
    return output.getvalue()

def calculate_geometry_data_size(self, geometry_data: List[Dict]) -> Dict[str, float]:
    """Calculate approximate geometry data sizes"""
    
    sizes = {
        'geometry_mb': 0,
        'estimated_points': len(geometry_data) if geometry_data else 0
    }
    
    # Estimate geometry size
    if geometry_data:
        n_points = len(geometry_data)
        # Each point has ~7 float values * 8 bytes + overhead
        geometry_bytes = n_points * (7 * 8 + 30)  # 30 bytes overhead per point
        sizes['geometry_mb'] = round(geometry_bytes / (1024 * 1024), 3)
    
    return sizes