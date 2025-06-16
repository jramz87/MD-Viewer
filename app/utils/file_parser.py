# File parsing utilities

import os
import numpy as np
from typing import List, Dict, Tuple, Optional

class FileParser:
    """Utility class for parsing molecular data files"""
    
    def __init__(self):
        self.supported_formats = ['.xyz', '.dat', '.txt']
    
    def parse_xyz_file(self, file_path: str) -> List[Dict]:
        """
        Parse XYZ trajectory file
        
        Args:
            file_path: Path to XYZ file
            
        Returns:
            List of frames with molecular data
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        frames = []
        
        with open(file_path, 'r') as f:
            lines = f.readlines()
        
        i = 0
        frame_count = 0
        
        while i < len(lines):
            try:
                # Read number of atoms
                n_atoms = int(lines[i].strip())
                
                # Read comment line
                comment = lines[i + 1].strip() if i + 1 < len(lines) else ""
                
                # Read atomic coordinates
                atoms = []
                coords = []
                
                for j in range(i + 2, i + 2 + n_atoms):
                    if j >= len(lines):
                        break
                    
                    parts = lines[j].split()
                    if len(parts) >= 4:
                        atoms.append(parts[0])
                        coords.append([
                            float(parts[1]),
                            float(parts[2]),
                            float(parts[3])
                        ])
                
                frame_data = {
                    'frame_number': frame_count,
                    'atoms': atoms,
                    'coords': coords,
                    'comment': comment,
                    'n_atoms': len(atoms)
                }
                
                frames.append(frame_data)
                frame_count += 1
                
                i += n_atoms + 2
                
            except (ValueError, IndexError):
                break
        
        return frames
    
    def parse_dat_file(self, file_path: str) -> np.ndarray:
        """
        Parse .dat file (excitation data)
        
        Args:
            file_path: Path to .dat file
            
        Returns:
            NumPy array with data
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        try:
            return np.loadtxt(file_path)
        except Exception as e:
            raise ValueError(f"Error parsing {file_path}: {e}")
    
    def parse_fail_file(self, file_path: str) -> List[int]:
        """
        Parse fail.dat file with failed calculation indices
        
        Args:
            file_path: Path to fail.dat file
            
        Returns:
            List of failed calculation indices
        """
        failed_indices = []
        
        if not os.path.exists(file_path):
            return failed_indices
        
        try:
            with open(file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and line.isdigit():
                        failed_indices.append(int(line))
        except Exception as e:
            print(f"Warning: Error reading fail.dat: {e}")
        
        return failed_indices
    
    def validate_file(self, file_path: str) -> Dict[str, bool]:
        """
        Validate file format and readability
        
        Args:
            file_path: Path to file
            
        Returns:
            Validation results
        """
        validation = {
            'exists': False,
            'readable': False,
            'valid_format': False,
            'not_empty': False
        }
        
        # Check existence
        if os.path.exists(file_path):
            validation['exists'] = True
        else:
            return validation
        
        # Check readability
        try:
            with open(file_path, 'r') as f:
                f.read(1)  # Try to read first character
            validation['readable'] = True
        except:
            return validation
        
        # Check format
        file_ext = os.path.splitext(file_path)[1].lower()
        if file_ext in self.supported_formats:
            validation['valid_format'] = True
        
        # Check if not empty
        if os.path.getsize(file_path) > 0:
            validation['not_empty'] = True
        
        return validation
    
    def get_file_info(self, file_path: str) -> Dict:
        """
        Get file information
        
        Args:
            file_path: Path to file
            
        Returns:
            File information dictionary
        """
        if not os.path.exists(file_path):
            return {}
        
        stat = os.stat(file_path)
        
        return {
            'name': os.path.basename(file_path),
            'path': file_path,
            'size': stat.st_size,
            'size_mb': round(stat.st_size / (1024 * 1024), 2),
            'modified': stat.st_mtime,
            'extension': os.path.splitext(file_path)[1].lower()
        }