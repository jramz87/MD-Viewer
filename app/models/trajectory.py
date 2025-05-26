# app/models/trajectory.py - Trajectory data processing

import numpy as np
from typing import List, Dict, Optional

class TrajectoryProcessor:
    """Process XYZ trajectory files for molecular dynamics visualization"""
    
    def __init__(self):
        self.timestep_fs = 0.5  # 0.5 fs per frame
    
    def read_trajectory(self, xyz_file: str) -> List[Dict]:
        """
        Read XYZ trajectory file and return structured data
        
        Args:
            xyz_file: Path to XYZ trajectory file
            
        Returns:
            List of trajectory frames with atoms, coordinates, and metadata
        """
        try:
            frames = []
            
            with open(xyz_file, 'r') as f:
                lines = f.readlines()
            
            i = 0
            frame_count = 0
            
            print(f"📖 Reading trajectory file: {xyz_file}")
            print(f"📄 Total lines: {len(lines)}")
            
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
                    
                    # Create frame data
                    frame_data = {
                        'frame_number': frame_count,
                        'atoms': atoms,
                        'coords': coords,
                        'comment': comment,
                        'time_fs': frame_count * self.timestep_fs,
                        'time_ps': frame_count * self.timestep_fs / 1000.0,
                        'n_atoms': len(atoms)
                    }
                    
                    frames.append(frame_data)
                    frame_count += 1
                    
                    # Progress indicator
                    if frame_count % 10000 == 0:
                        print(f"📊 Processed {frame_count} frames...")
                    
                    # Move to next frame
                    i += n_atoms + 2
                    
                except (ValueError, IndexError) as e:
                    print(f"⚠️ Error reading frame {frame_count} at line {i}: {e}")
                    break
            
            print(f"✅ Successfully read {len(frames)} trajectory frames")
            print(f"⏱️ Time range: 0 - {frames[-1]['time_fs']:.1f} fs ({frames[-1]['time_ps']:.3f} ps)")
            print(f"🧪 Atoms per frame: {frames[0]['n_atoms'] if frames else 0}")
            
            return frames
            
        except Exception as e:
            print(f"❌ Error reading trajectory file: {e}")
            raise
    
    def get_trajectory_statistics(self, frames: List[Dict]) -> Dict:
        """Calculate trajectory statistics"""
        if not frames:
            return {}
        
        # Time statistics
        times_fs = [frame['time_fs'] for frame in frames]
        times_ps = [frame['time_ps'] for frame in frames]
        
        # Coordinate statistics
        all_coords = []
        for frame in frames:
            all_coords.extend(frame['coords'])
        
        coords_array = np.array(all_coords)
        
        stats = {
            'n_frames': len(frames),
            'n_atoms': frames[0]['n_atoms'],
            'time_range_fs': [min(times_fs), max(times_fs)],
            'time_range_ps': [min(times_ps), max(times_ps)],
            'timestep_fs': self.timestep_fs,
            'coordinate_bounds': {
                'x_min': float(np.min(coords_array[:, 0])),
                'x_max': float(np.max(coords_array[:, 0])),
                'y_min': float(np.min(coords_array[:, 1])),
                'y_max': float(np.max(coords_array[:, 1])),
                'z_min': float(np.min(coords_array[:, 2])),
                'z_max': float(np.max(coords_array[:, 2]))
            },
            'atom_types': list(set(frames[0]['atoms'])),
            'center_of_mass': self.calculate_center_of_mass(frames[0])
        }
        
        return stats
    
    def calculate_center_of_mass(self, frame: Dict) -> List[float]:
        """Calculate center of mass for a frame"""
        # Atomic masses (simplified)
        atomic_masses = {
            'H': 1.0, 'C': 12.0, 'N': 14.0, 'O': 16.0,
            'S': 32.0, 'P': 31.0, 'F': 19.0, 'Cl': 35.5
        }
        
        total_mass = 0.0
        weighted_coords = np.zeros(3)
        
        for i, atom in enumerate(frame['atoms']):
            mass = atomic_masses.get(atom, 12.0)  # Default to carbon
            total_mass += mass
            weighted_coords += mass * np.array(frame['coords'][i])
        
        center_of_mass = weighted_coords / total_mass
        return center_of_mass.tolist()
    
    def get_excitation_time_frames(self, frames: List[Dict], 
                                    equilibration_time_fs: float = 5000.0,
                                    excitation_interval_fs: float = 2.0) -> List[Dict]:
        """
        Get trajectory frames corresponding to excitation calculation times
        
        Args:
            frames: Full trajectory frames
            equilibration_time_fs: Equilibration time in fs (default 5 ps)
            excitation_interval_fs: Interval between excitation calculations in fs
            
        Returns:
            Filtered frames corresponding to excitation times
        """
        excitation_frames = []
        
        # Calculate excitation times
        excitation_times = []
        current_time = equilibration_time_fs
        max_time = frames[-1]['time_fs'] if frames else 0
        
        while current_time <= max_time:
            excitation_times.append(current_time)
            current_time += excitation_interval_fs
        
        print(f"🎯 Looking for {len(excitation_times)} excitation time points")
        
        # Find corresponding frames
        for exc_time in excitation_times:
            # Find closest frame
            closest_frame = None
            min_diff = float('inf')
            
            for frame in frames:
                diff = abs(frame['time_fs'] - exc_time)
                if diff < min_diff:
                    min_diff = diff
                    closest_frame = frame
            
            if closest_frame and min_diff < 0.5:  # Within 0.5 fs tolerance
                excitation_frames.append(closest_frame)
        
        print(f"✅ Found {len(excitation_frames)} frames for excitation times")
        
        return excitation_frames
    
    def calculate_rmsd(self, frame1: Dict, frame2: Dict, 
                        atom_indices: Optional[List[int]] = None) -> float:
        """Calculate RMSD between two frames"""
        coords1 = np.array(frame1['coords'])
        coords2 = np.array(frame2['coords'])
        
        if atom_indices:
            coords1 = coords1[atom_indices]
            coords2 = coords2[atom_indices]
        
        # Center coordinates
        coords1_centered = coords1 - np.mean(coords1, axis=0)
        coords2_centered = coords2 - np.mean(coords2, axis=0)
        
        # Calculate RMSD
        diff = coords1_centered - coords2_centered
        rmsd = np.sqrt(np.mean(np.sum(diff**2, axis=1)))
        
        return float(rmsd)
    
    def get_distance_matrix(self, frame: Dict) -> np.ndarray:
        """Calculate distance matrix for a frame"""
        coords = np.array(frame['coords'])
        n_atoms = len(coords)
        
        distance_matrix = np.zeros((n_atoms, n_atoms))
        
        for i in range(n_atoms):
            for j in range(i + 1, n_atoms):
                dist = np.linalg.norm(coords[i] - coords[j])
                distance_matrix[i, j] = dist
                distance_matrix[j, i] = dist
        
        return distance_matrix
    
    def find_bonds(self, frame: Dict, max_bond_distance: float = 1.8) -> List[tuple]:
        """Find bonds in a frame based on distance criteria"""
        bonds = []
        coords = np.array(frame['coords'])
        atoms = frame['atoms']
        
        for i in range(len(coords)):
            for j in range(i + 1, len(coords)):
                distance = np.linalg.norm(coords[i] - coords[j])
                
                # Adjust max distance for hydrogen bonds
                max_dist = max_bond_distance
                if atoms[i] == 'H' or atoms[j] == 'H':
                    max_dist = 1.2
                
                if distance < max_dist:
                    bonds.append((i, j, distance))
        
        return bonds
    
    def optimize_for_viewer(self, frames: List[Dict], 
                            max_frames: int = 10000) -> List[Dict]:
        """Optimize trajectory data for web viewer"""
        if len(frames) <= max_frames:
            return frames
        
        # Sample frames evenly
        step = len(frames) // max_frames
        optimized_frames = frames[::step]
        
        print(f"🎬 Optimized trajectory: {len(frames)} → {len(optimized_frames)} frames")
        
        return optimized_frames