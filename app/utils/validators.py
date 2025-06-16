# Input validation utilities

import os
import re
from typing import Dict, List, Tuple, Optional

class FileValidator:
    """Validate uploaded molecular data files"""
    
    def __init__(self):
        self.allowed_extensions = {'.xyz', '.dat', '.txt'}
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.required_files = {'coors.xyz'}  # Required files
        self.optional_files = {'s1.dat', 's2.dat', 'fail.dat'}  # Optional files
    
    def validate_filename(self, filename: str) -> Dict[str, bool]:
        """Validate filename format and extension"""
        validation = {
            'valid_name': False,
            'valid_extension': False,
            'recognized': False
        }
        
        if not filename:
            return validation
        
        # Check for valid filename (no dangerous characters)
        if re.match(r'^[a-zA-Z0-9._-]+$', filename):
            validation['valid_name'] = True
        
        # Check extension
        _, ext = os.path.splitext(filename.lower())
        if ext in self.allowed_extensions:
            validation['valid_extension'] = True
        
        # Check if recognized file
        if filename.lower() in (self.required_files | self.optional_files):
            validation['recognized'] = True
        
        return validation
    
    def validate_file_size(self, file_size: int) -> bool:
        """Validate file size"""
        return 0 < file_size <= self.max_file_size
    
    def validate_xyz_content(self, file_path: str) -> Dict[str, any]:
        """Validate XYZ file content structure"""
        validation = {
            'valid_structure': False,
            'n_frames': 0,
            'n_atoms': 0,
            'errors': []
        }
        
        try:
            with open(file_path, 'r') as f:
                lines = f.readlines()
            
            i = 0
            frame_count = 0
            atoms_per_frame = None
            
            while i < len(lines):
                try:
                    # Read number of atoms
                    n_atoms = int(lines[i].strip())
                    
                    # Consistency check
                    if atoms_per_frame is None:
                        atoms_per_frame = n_atoms
                        validation['n_atoms'] = n_atoms
                    elif atoms_per_frame != n_atoms:
                        validation['errors'].append(f"Inconsistent atom count in frame {frame_count}")
                    
                    # Skip comment line
                    if i + 1 >= len(lines):
                        validation['errors'].append(f"Missing comment line in frame {frame_count}")
                        break
                    
                    # Validate coordinate lines
                    for j in range(i + 2, i + 2 + n_atoms):
                        if j >= len(lines):
                            validation['errors'].append(f"Missing coordinate line in frame {frame_count}")
                            break
                        
                        parts = lines[j].split()
                        if len(parts) < 4:
                            validation['errors'].append(f"Invalid coordinate format in frame {frame_count}")
                            break
                        
                        # Try to parse coordinates
                        try:
                            float(parts[1])
                            float(parts[2])
                            float(parts[3])
                        except ValueError:
                            validation['errors'].append(f"Non-numeric coordinates in frame {frame_count}")
                            break
                    
                    frame_count += 1
                    i += n_atoms + 2
                    
                    # Limit validation to first few frames for large files
                    if frame_count >= 10:
                        break
                        
                except (ValueError, IndexError) as e:
                    validation['errors'].append(f"Parse error in frame {frame_count}: {e}")
                    break
            
            validation['n_frames'] = frame_count
            validation['valid_structure'] = len(validation['errors']) == 0
            
        except Exception as e:
            validation['errors'].append(f"File read error: {e}")
        
        return validation
    
    def validate_dat_content(self, file_path: str) -> Dict[str, any]:
        """Validate .dat file content (excitation data)"""
        validation = {
            'valid_structure': False,
            'n_rows': 0,
            'n_cols': 0,
            'errors': []
        }
        
        try:
            import numpy as np
            data = np.loadtxt(file_path)
            
            if data.ndim == 1:
                data = data.reshape(1, -1)
            
            validation['n_rows'] = data.shape[0]
            validation['n_cols'] = data.shape[1]
            
            # Check for expected structure (should have at least 2 columns: energy, oscillator)
            if data.shape[1] >= 2:
                validation['valid_structure'] = True
            else:
                validation['errors'].append("Expected at least 2 columns (energy, oscillator strength)")
            
            # Check for reasonable values
            if np.any(np.isnan(data)) or np.any(np.isinf(data)):
                validation['errors'].append("Contains NaN or infinite values")
            
            # Check energy values (should be positive)
            if np.any(data[:, 0] <= 0):
                validation['errors'].append("Energy values should be positive")
            
            # Check oscillator strengths (should be non-negative)
            if np.any(data[:, 1] < 0):
                validation['errors'].append("Oscillator strengths should be non-negative")
            
        except Exception as e:
            validation['errors'].append(f"Data parsing error: {e}")
        
        return validation
    
    def validate_upload_set(self, uploaded_files: List[str]) -> Dict[str, any]:
        """Validate complete set of uploaded files"""
        validation = {
            'has_required': False,
            'complete_set': False,
            'file_status': {},
            'warnings': [],
            'errors': []
        }
        
        uploaded_set = set(f.lower() for f in uploaded_files)
        
        # Check required files
        missing_required = self.required_files - uploaded_set
        if not missing_required:
            validation['has_required'] = True
        else:
            validation['errors'].extend([f"Missing required file: {f}" for f in missing_required])
        
        # Check file status
        for file_type in (self.required_files | self.optional_files):
            validation['file_status'][file_type] = file_type in uploaded_set
        
        # Check for complete excitation data set
        has_s1 = 's1.dat' in uploaded_set
        has_s2 = 's2.dat' in uploaded_set
        
        if has_s1 and has_s2:
            validation['complete_set'] = True
        elif has_s1 or has_s2:
            validation['warnings'].append("Only one excitation file uploaded (need both s1.dat and s2.dat)")
        
        # Check for unknown files
        known_files = self.required_files | self.optional_files
        unknown_files = uploaded_set - known_files
        if unknown_files:
            validation['warnings'].extend([f"Unknown file type: {f}" for f in unknown_files])
        
        return validation

class DataValidator:
    """Validate processed molecular data"""
    
    def validate_trajectory_data(self, trajectory_data: List[Dict]) -> Dict[str, any]:
        """Validate trajectory data structure"""
        validation = {
            'valid': False,
            'n_frames': 0,
            'n_atoms': 0,
            'consistent_structure': True,
            'errors': []
        }
        
        if not trajectory_data:
            validation['errors'].append("Empty trajectory data")
            return validation
        
        validation['n_frames'] = len(trajectory_data)
        
        # Check first frame structure
        first_frame = trajectory_data[0]
        required_keys = ['atoms', 'coords', 'frame_number', 'time_fs']
        
        for key in required_keys:
            if key not in first_frame:
                validation['errors'].append(f"Missing key in trajectory data: {key}")
        
        if 'atoms' in first_frame and 'coords' in first_frame:
            validation['n_atoms'] = len(first_frame['atoms'])
            
            # Check consistency across frames
            for i, frame in enumerate(trajectory_data[:10]):  # Check first 10 frames
                if len(frame.get('atoms', [])) != validation['n_atoms']:
                    validation['errors'].append(f"Inconsistent atom count in frame {i}")
                    validation['consistent_structure'] = False
                
                if len(frame.get('coords', [])) != validation['n_atoms']:
                    validation['errors'].append(f"Inconsistent coordinate count in frame {i}")
                    validation['consistent_structure'] = False
        
        validation['valid'] = len(validation['errors']) == 0
        return validation
    
    def validate_excitation_data(self, excitation_data: List[Dict]) -> Dict[str, any]:
        """Validate excitation data structure"""
        validation = {
            'valid': False,
            'n_points': 0,
            'time_ordered': True,
            'errors': []
        }
        
        if not excitation_data:
            validation['errors'].append("Empty excitation data")
            return validation
        
        validation['n_points'] = len(excitation_data)
        
        # Check first point structure
        first_point = excitation_data[0]
        required_keys = ['time_fs', 's1_energy', 's1_oscillator', 's2_energy', 's2_oscillator']
        
        for key in required_keys:
            if key not in first_point:
                validation['errors'].append(f"Missing key in excitation data: {key}")
        
        # Check time ordering
        times = [point.get('time_fs', 0) for point in excitation_data]
        if times != sorted(times):
            validation['errors'].append("Excitation data not time-ordered")
            validation['time_ordered'] = False
        
        # Check for reasonable values
        for i, point in enumerate(excitation_data[:10]):  # Check first 10 points
            if point.get('s1_energy', 0) <= 0:
                validation['errors'].append(f"Invalid S1 energy in point {i}")
            
            if point.get('s2_energy', 0) <= 0:
                validation['errors'].append(f"Invalid S2 energy in point {i}")
            
            if point.get('s1_oscillator', 0) < 0:
                validation['errors'].append(f"Negative S1 oscillator strength in point {i}")
        
        validation['valid'] = len(validation['errors']) == 0
        return validation