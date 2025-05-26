# app/models/analysis.py - Data analysis functions

import numpy as np
from typing import List, Dict, Tuple, Optional

class MolecularAnalysis:
    """Analysis functions for molecular dynamics and excitation data"""
    
    def __init__(self):
        self.atomic_masses = {
            'H': 1.008, 'C': 12.011, 'N': 14.007, 'O': 15.999,
            'S': 32.065, 'P': 30.974, 'F': 18.998, 'Cl': 35.453
        }
        
        self.atom_colors = {
            'C': 'black', 'N': 'blue', 'O': 'red', 'H': 'lightgray',
            'S': 'yellow', 'P': 'orange', 'F': 'green', 'Cl': 'green'
        }
        
        self.atom_sizes = {
            'C': 80, 'N': 75, 'O': 70, 'H': 30, 'S': 90, 'P': 85
        }
    
    def calculate_center_of_mass(self, atoms: List[str], coords: np.ndarray) -> np.ndarray:
        """Calculate center of mass for a molecular frame"""
        total_mass = 0.0
        weighted_coords = np.zeros(3)
        
        for i, atom in enumerate(atoms):
            mass = self.atomic_masses.get(atom, 12.0)  # Default to carbon
            total_mass += mass
            weighted_coords += mass * coords[i]
        
        return weighted_coords / total_mass
    
    def calculate_rmsd(self, coords1: np.ndarray, coords2: np.ndarray, 
                      atom_indices: Optional[List[int]] = None) -> float:
        """Calculate RMSD between two coordinate sets"""
        
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
    
    def calculate_distance_matrix(self, coords: np.ndarray) -> np.ndarray:
        """Calculate distance matrix for a set of coordinates"""
        n_atoms = len(coords)
        distance_matrix = np.zeros((n_atoms, n_atoms))
        
        for i in range(n_atoms):
            for j in range(i + 1, n_atoms):
                dist = np.linalg.norm(coords[i] - coords[j])
                distance_matrix[i, j] = dist
                distance_matrix[j, i] = dist
        
        return distance_matrix
    
    def find_bonds(self, atoms: List[str], coords: np.ndarray, 
                   max_bond_distance: float = 1.8) -> List[Tuple[int, int, float]]:
        """Find bonds based on distance criteria"""
        bonds = []
        
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
    
    def calculate_trajectory_statistics(self, trajectory_frames: List[Dict]) -> Dict:
        """Calculate comprehensive trajectory statistics"""
        if not trajectory_frames:
            return {}
        
        n_frames = len(trajectory_frames)
        n_atoms = len(trajectory_frames[0]['atoms'])
        
        # Collect all coordinates
        all_coords = []
        for frame in trajectory_frames:
            all_coords.extend(frame['coords'])
        
        coords_array = np.array(all_coords)
        
        # Time statistics
        times_fs = [i * 0.5 for i in range(n_frames)]  # 0.5 fs per frame
        
        # Center of mass trajectory
        com_trajectory = []
        for frame in trajectory_frames:
            com = self.calculate_center_of_mass(frame['atoms'], np.array(frame['coords']))
            com_trajectory.append(com)
        
        com_array = np.array(com_trajectory)
        
        # RMSD evolution (relative to first frame)
        rmsd_evolution = []
        first_coords = np.array(trajectory_frames[0]['coords'])
        
        for frame in trajectory_frames:
            current_coords = np.array(frame['coords'])
            rmsd = self.calculate_rmsd(first_coords, current_coords)
            rmsd_evolution.append(rmsd)
        
        stats = {
            'n_frames': n_frames,
            'n_atoms': n_atoms,
            'time_range_fs': [0, (n_frames - 1) * 0.5],
            'time_range_ps': [0, (n_frames - 1) * 0.5 / 1000.0],
            'coordinate_bounds': {
                'x_min': float(np.min(coords_array[:, 0])),
                'x_max': float(np.max(coords_array[:, 0])),
                'y_min': float(np.min(coords_array[:, 1])),
                'y_max': float(np.max(coords_array[:, 1])),
                'z_min': float(np.min(coords_array[:, 2])),
                'z_max': float(np.max(coords_array[:, 2]))
            },
            'center_of_mass': {
                'mean': com_array.mean(axis=0).tolist(),
                'std': com_array.std(axis=0).tolist(),
                'range': {
                    'x': [float(com_array[:, 0].min()), float(com_array[:, 0].max())],
                    'y': [float(com_array[:, 1].min()), float(com_array[:, 1].max())],
                    'z': [float(com_array[:, 2].min()), float(com_array[:, 2].max())]
                }
            },
            'rmsd_evolution': {
                'values': rmsd_evolution,
                'mean': float(np.mean(rmsd_evolution)),
                'max': float(np.max(rmsd_evolution)),
                'final': rmsd_evolution[-1] if rmsd_evolution else 0.0
            },
            'atom_types': list(set(trajectory_frames[0]['atoms'])),
            'molecular_formula': self.get_molecular_formula(trajectory_frames[0]['atoms'])
        }
        
        return stats
    
    def calculate_excitation_statistics(self, excitation_data: List[Dict]) -> Dict:
        """Calculate excitation data statistics"""
        if not excitation_data:
            return {}
        
        # Extract arrays
        times_ps = [d['time_ps'] for d in excitation_data]
        s1_energies = [d['s1_energy'] for d in excitation_data]
        s2_energies = [d['s2_energy'] for d in excitation_data]
        s1_oscillators = [d['s1_oscillator'] for d in excitation_data]
        s2_oscillators = [d['s2_oscillator'] for d in excitation_data]
        energy_gaps = [d['energy_gap'] for d in excitation_data]
        
        stats = {
            'n_calculations': len(excitation_data),
            'time_range_ps': [min(times_ps), max(times_ps)],
            'interval_fs': 2.0,  # 2 fs interval
            's1_energy': {
                'mean': float(np.mean(s1_energies)),
                'std': float(np.std(s1_energies)),
                'min': float(np.min(s1_energies)),
                'max': float(np.max(s1_energies))
            },
            's2_energy': {
                'mean': float(np.mean(s2_energies)),
                'std': float(np.std(s2_energies)),
                'min': float(np.min(s2_energies)),
                'max': float(np.max(s2_energies))
            },
            's1_oscillator': {
                'mean': float(np.mean(s1_oscillators)),
                'std': float(np.std(s1_oscillators)),
                'min': float(np.min(s1_oscillators)),
                'max': float(np.max(s1_oscillators))
            },
            's2_oscillator': {
                'mean': float(np.mean(s2_oscillators)),
                'std': float(np.std(s2_oscillators)),
                'min': float(np.min(s2_oscillators)),
                'max': float(np.max(s2_oscillators))
            },
            'energy_gap': {
                'mean': float(np.mean(energy_gaps)),
                'std': float(np.std(energy_gaps)),
                'min': float(np.min(energy_gaps)),
                'max': float(np.max(energy_gaps))
            }
        }
        
        # Calculate correlations
        try:
            stats['correlations'] = {
                's1_s2_energy': float(np.corrcoef(s1_energies, s2_energies)[0, 1]),
                's1_energy_oscillator': float(np.corrcoef(s1_energies, s1_oscillators)[0, 1]),
                's2_energy_oscillator': float(np.corrcoef(s2_energies, s2_oscillators)[0, 1]),
                'gap_s1_energy': float(np.corrcoef(energy_gaps, s1_energies)[0, 1])
            }
        except:
            stats['correlations'] = {}
        
        return stats
    
    def generate_absorption_spectrum(self, excitation_data: List[Dict],
                                   energy_min: float = 2.0, energy_max: float = 7.0,
                                   energy_points: int = 1000,
                                   gaussian_width: float = 0.15) -> Dict:
        """Generate time-averaged absorption spectrum"""
        
        energy_range = np.linspace(energy_min, energy_max, energy_points)
        total_spectrum = np.zeros_like(energy_range)
        
        for excitation in excitation_data:
            # S1 contribution
            if excitation['s1_oscillator'] > 0:
                s1_contrib = excitation['s1_oscillator'] * np.exp(
                    -(energy_range - excitation['s1_energy'])**2 / (2 * gaussian_width**2)
                )
                total_spectrum += s1_contrib
            
            # S2 contribution
            if excitation['s2_oscillator'] > 0:
                s2_contrib = excitation['s2_oscillator'] * np.exp(
                    -(energy_range - excitation['s2_energy'])**2 / (2 * gaussian_width**2)
                )
                total_spectrum += s2_contrib
        
        # Average over all time points
        average_spectrum = total_spectrum / len(excitation_data)
        
        return {
            'energy_range': energy_range.tolist(),
            'spectrum': average_spectrum.tolist(),
            'n_points': len(excitation_data),
            'parameters': {
                'energy_min': energy_min,
                'energy_max': energy_max,
                'gaussian_width': gaussian_width
            }
        }
    
    def get_molecular_formula(self, atoms: List[str]) -> str:
        """Generate molecular formula from atom list"""
        atom_counts = {}
        for atom in atoms:
            atom_counts[atom] = atom_counts.get(atom, 0) + 1
        
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
    
    def analyze_molecular_motion(self, trajectory_frames: List[Dict],
                               atom_indices: Optional[List[int]] = None) -> Dict:
        """Analyze molecular motion patterns"""
        
        if len(trajectory_frames) < 2:
            return {}
        
        # Select atoms to analyze
        if atom_indices is None:
            atom_indices = list(range(len(trajectory_frames[0]['atoms'])))
        
        # Calculate displacement vectors
        displacements = []
        velocities = []
        
        for i in range(1, len(trajectory_frames)):
            prev_coords = np.array(trajectory_frames[i-1]['coords'])[atom_indices]
            curr_coords = np.array(trajectory_frames[i]['coords'])[atom_indices]
            
            displacement = curr_coords - prev_coords
            displacements.append(displacement)
            
            # Velocity (displacement per timestep)
            velocity = displacement / 0.5  # 0.5 fs timestep
            velocities.append(velocity)
        
        displacements = np.array(displacements)
        velocities = np.array(velocities)
        
        # Calculate statistics
        mean_displacement = np.mean(np.linalg.norm(displacements, axis=2))
        max_displacement = np.max(np.linalg.norm(displacements, axis=2))
        mean_velocity = np.mean(np.linalg.norm(velocities, axis=2))
        
        return {
            'mean_displacement_per_step': float(mean_displacement),
            'max_displacement_per_step': float(max_displacement),
            'mean_velocity': float(mean_velocity),
            'n_frames_analyzed': len(displacements),
            'atom_indices_analyzed': atom_indices
        }