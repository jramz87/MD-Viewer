# Excitation data processing

import numpy as np
from typing import List, Dict, Optional, Set

class ExcitationProcessor:
    """Process excitation data files for molecular visualization"""
    
    def __init__(self):
        self.equilibration_time_fs = 5000.0  # 5 ps equilibration
        self.excitation_interval_fs = 2.0    # 2 fs interval (NOT 2 ps!)
    
    def process_excitation_data(self, s1_file: str, s2_file: str, 
                                fail_file: Optional[str] = None) -> List[Dict]:
        """
        Process S1 and S2 excitation data files
        
        Args:
            s1_file: S1 excitation data file path
            s2_file: S2 excitation data file path
            fail_file: Failed calculations file path (optional)
            
        Returns:
            List of successful excitation calculations with metadata
        """
        try:
            print(f"Processing excitation data...")
            print(f"S1 file: {s1_file}")
            print(f"S2 file: {s2_file}")
            print(f"Fail file: {fail_file if fail_file else 'None'}")
            
            # Read excitation data
            s1_data = np.loadtxt(s1_file)
            s2_data = np.loadtxt(s2_file)
            
            print(f"S1 data shape: {s1_data.shape}")
            print(f"S2 data shape: {s2_data.shape}")
            
            # Read failed calculations
            failed_snapshots = self.read_failed_calculations(fail_file)
            
            # Process successful calculations
            excitation_data = self.create_excitation_dataset(
                s1_data, s2_data, failed_snapshots
            )
            
            print(f"Processed {len(excitation_data)} successful excitation calculations")
            
            return excitation_data
            
        except Exception as e:
            print(f"Error processing excitation data: {e}")
            raise
    
    def read_failed_calculations(self, fail_file: Optional[str]) -> Set[int]:
        """Read failed calculation indices"""
        failed_snapshots = set()
        
        if not fail_file:
            print("No fail.dat file - assuming all calculations succeeded")
            return failed_snapshots
        
        try:
            with open(fail_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and line.isdigit():
                        failed_snapshots.add(int(line))
            
            print(f"Found {len(failed_snapshots)} failed calculations")
            
        except FileNotFoundError:
            print("No fail.dat file found - assuming all calculations succeeded")
        except Exception as e:
            print(f"Error reading fail.dat: {e}")
        
        return failed_snapshots
    
    def create_excitation_dataset(self, s1_data: np.ndarray, s2_data: np.ndarray,
                            failed_snapshots: Set[int]) -> List[Dict]:
        """Create structured excitation dataset"""
        
        excitation_data = []
        
        for i in range(len(s1_data)):
            # Skip failed calculations
            if i in failed_snapshots:
                continue
            
            # Calculate time for this calculation
            snapshot_time_fs = self.equilibration_time_fs + i * self.excitation_interval_fs
            snapshot_time_ps = snapshot_time_fs / 1000.0
            
            # Extract S1 data (all 5 columns)
            s1_energy = float(s1_data[i][0])  # eV
            s1_oscillator = float(s1_data[i][1])  # oscillator strength
            s1_dipole_x = float(s1_data[i][2]) if s1_data.shape[1] > 2 else 0.0  # dipole x
            s1_dipole_y = float(s1_data[i][3]) if s1_data.shape[1] > 3 else 0.0  # dipole y
            s1_dipole_z = float(s1_data[i][4]) if s1_data.shape[1] > 4 else 0.0  # dipole z
            
            # Extract S2 data (all 5 columns)
            s2_energy = float(s2_data[i][0])  # eV
            s2_oscillator = float(s2_data[i][1])  # oscillator strength
            s2_dipole_x = float(s2_data[i][2]) if s2_data.shape[1] > 2 else 0.0  # dipole x
            s2_dipole_y = float(s2_data[i][3]) if s2_data.shape[1] > 3 else 0.0  # dipole y
            s2_dipole_z = float(s2_data[i][4]) if s2_data.shape[1] > 4 else 0.0  # dipole z
            
            excitation_entry = {
                'calculation_index': i,
                'time_fs': snapshot_time_fs,
                'time_ps': snapshot_time_ps,
                's1_energy': s1_energy,
                's1_oscillator': s1_oscillator,
                's1_dipole_x': s1_dipole_x,
                's1_dipole_y': s1_dipole_y,
                's1_dipole_z': s1_dipole_z,
                's2_energy': s2_energy,
                's2_oscillator': s2_oscillator,
                's2_dipole_x': s2_dipole_x,
                's2_dipole_y': s2_dipole_y,
                's2_dipole_z': s2_dipole_z,
                'energy_gap': s2_energy - s1_energy,  # S2-S1 gap
                'total_oscillator': s1_oscillator + s2_oscillator
            }
            
            excitation_data.append(excitation_entry)
        
        if excitation_data:
            time_range = [excitation_data[0]['time_ps'], excitation_data[-1]['time_ps']]
            print(f"Excitation time range: {time_range[0]:.1f} - {time_range[1]:.1f} ps")
            print(f"Time interval: {self.excitation_interval_fs} fs between calculations")
            print(f"Dipole moment data included: {s1_data.shape[1]} columns per file")
        
        return excitation_data
    
    def get_excitation_statistics(self, excitation_data: List[Dict]) -> Dict:
        """Calculate excitation data statistics"""
        if not excitation_data:
            return {}
        
        # Extract arrays for analysis
        s1_energies = [d['s1_energy'] for d in excitation_data]
        s2_energies = [d['s2_energy'] for d in excitation_data]
        s1_oscillators = [d['s1_oscillator'] for d in excitation_data]
        s2_oscillators = [d['s2_oscillator'] for d in excitation_data]
        energy_gaps = [d['energy_gap'] for d in excitation_data]
        times_ps = [d['time_ps'] for d in excitation_data]
        
        stats = {
            'n_calculations': len(excitation_data),
            'time_range_ps': [min(times_ps), max(times_ps)],
            'time_range_fs': [min(times_ps) * 1000, max(times_ps) * 1000],
            'interval_fs': self.excitation_interval_fs,
            's1_energy_stats': {
                'min': float(np.min(s1_energies)),
                'max': float(np.max(s1_energies)),
                'mean': float(np.mean(s1_energies)),
                'std': float(np.std(s1_energies))
            },
            's2_energy_stats': {
                'min': float(np.min(s2_energies)),
                'max': float(np.max(s2_energies)),
                'mean': float(np.mean(s2_energies)),
                'std': float(np.std(s2_energies))
            },
            's1_oscillator_stats': {
                'min': float(np.min(s1_oscillators)),
                'max': float(np.max(s1_oscillators)),
                'mean': float(np.mean(s1_oscillators)),
                'std': float(np.std(s1_oscillators))
            },
            's2_oscillator_stats': {
                'min': float(np.min(s2_oscillators)),
                'max': float(np.max(s2_oscillators)),
                'mean': float(np.mean(s2_oscillators)),
                'std': float(np.std(s2_oscillators))
            },
            'energy_gap_stats': {
                'min': float(np.min(energy_gaps)),
                'max': float(np.max(energy_gaps)),
                'mean': float(np.mean(energy_gaps)),
                'std': float(np.std(energy_gaps))
            }
        }
        
        return stats
    
    def generate_spectrum(self, excitation_entry: Dict, 
                        energy_range: np.ndarray,
                        gaussian_width: float = 0.15) -> np.ndarray:
        """Generate absorption spectrum for a single excitation entry"""
        spectrum = np.zeros_like(energy_range)
        
        # S1 contribution
        if excitation_entry['s1_oscillator'] > 0:
            s1_contrib = excitation_entry['s1_oscillator'] * np.exp(
                -(energy_range - excitation_entry['s1_energy'])**2 / (2 * gaussian_width**2)
            )
            spectrum += s1_contrib
        
        # S2 contribution
        if excitation_entry['s2_oscillator'] > 0:
            s2_contrib = excitation_entry['s2_oscillator'] * np.exp(
                -(energy_range - excitation_entry['s2_energy'])**2 / (2 * gaussian_width**2)
            )
            spectrum += s2_contrib
        
        return spectrum
    
    def generate_average_spectrum(self, excitation_data: List[Dict],
                                energy_min: float = 2.0, energy_max: float = 7.0,
                                energy_points: int = 1000,
                                gaussian_width: float = 0.15) -> Dict:
        """Generate time-averaged absorption spectrum"""
        
        energy_range = np.linspace(energy_min, energy_max, energy_points)
        total_spectrum = np.zeros_like(energy_range)
        
        for excitation in excitation_data:
            spectrum = self.generate_spectrum(excitation, energy_range, gaussian_width)
            total_spectrum += spectrum
        
        # Average over all time points
        average_spectrum = total_spectrum / len(excitation_data)
        
        return {
            'energy_range': energy_range.tolist(),
            'spectrum': average_spectrum.tolist(),
            'n_points': len(excitation_data),
            'energy_min': energy_min,
            'energy_max': energy_max
        }
    
    def find_excitation_at_time(self, excitation_data: List[Dict], 
                                target_time_fs: float,
                                tolerance_fs: float = 100.0) -> Optional[Dict]:
        """Find excitation data closest to a target time"""
        
        best_match = None
        min_diff = float('inf')
        
        for excitation in excitation_data:
            diff = abs(excitation['time_fs'] - target_time_fs)
            if diff < min_diff:
                min_diff = diff
                best_match = excitation
        
        # Return match only if within tolerance
        if best_match and min_diff <= tolerance_fs:
            return best_match
        
        return None
    
    def calculate_excitation_correlations(self, excitation_data: List[Dict]) -> Dict:
        """Calculate correlations between excitation properties"""
        
        if len(excitation_data) < 2:
            return {}
        
        # Extract time series
        s1_energies = np.array([d['s1_energy'] for d in excitation_data])
        s2_energies = np.array([d['s2_energy'] for d in excitation_data])
        s1_oscillators = np.array([d['s1_oscillator'] for d in excitation_data])
        s2_oscillators = np.array([d['s2_oscillator'] for d in excitation_data])
        energy_gaps = np.array([d['energy_gap'] for d in excitation_data])
        
        correlations = {}
        
        try:
            # Energy correlations
            correlations['s1_s2_energy'] = float(np.corrcoef(s1_energies, s2_energies)[0, 1])
            
            # Oscillator strength correlations
            correlations['s1_s2_oscillator'] = float(np.corrcoef(s1_oscillators, s2_oscillators)[0, 1])
            
            # Energy-oscillator correlations
            correlations['s1_energy_oscillator'] = float(np.corrcoef(s1_energies, s1_oscillators)[0, 1])
            correlations['s2_energy_oscillator'] = float(np.corrcoef(s2_energies, s2_oscillators)[0, 1])
            
            # Gap correlations
            correlations['gap_s1_energy'] = float(np.corrcoef(energy_gaps, s1_energies)[0, 1])
            correlations['gap_s2_energy'] = float(np.corrcoef(energy_gaps, s2_energies)[0, 1])
            
        except Exception as e:
            print(f"Error calculating correlations: {e}")
        
        return correlations
    
    def export_to_csv(self, excitation_data: List[Dict]) -> str:
        """Export excitation data to CSV format"""
        
        if not excitation_data:
            return ""
        
        # CSV header with dipole moments
        csv_lines = [
            "calculation_index,time_fs,time_ps,s1_energy_eV,s1_oscillator,s1_dipole_x,s1_dipole_y,s1_dipole_z,"
            "s2_energy_eV,s2_oscillator,s2_dipole_x,s2_dipole_y,s2_dipole_z,energy_gap_eV,total_oscillator"
        ]
        
        # Data rows
        for data in excitation_data:
            line = (
                f"{data['calculation_index']},"
                f"{data['time_fs']:.2f},"
                f"{data['time_ps']:.6f},"
                f"{data['s1_energy']:.6f},"
                f"{data['s1_oscillator']:.6f},"
                f"{data.get('s1_dipole_x', 0.0):.6f},"
                f"{data.get('s1_dipole_y', 0.0):.6f},"
                f"{data.get('s1_dipole_z', 0.0):.6f},"
                f"{data['s2_energy']:.6f},"
                f"{data['s2_oscillator']:.6f},"
                f"{data.get('s2_dipole_x', 0.0):.6f},"
                f"{data.get('s2_dipole_y', 0.0):.6f},"
                f"{data.get('s2_dipole_z', 0.0):.6f},"
                f"{data['energy_gap']:.6f},"
                f"{data['total_oscillator']:.6f}"
            )
            csv_lines.append(line)
        
        return "\n".join(csv_lines)