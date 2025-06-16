# DMABN-specific geometry analysis

import numpy as np
import json
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class DMABNGeometryAnalyzer:
    """
    Analyze DMABN molecular geometry parameters including:
    - Twist angle (donor-acceptor coupling)
    - Ring planarity deviation
    - Ring-nitrile angle
    - Key geometric features for photophysics
    """
    
    def __init__(self):
        self.atom_indices = None
        self.fragment_mapping = {}
        self.geometry_data = []
        self.analysis_metadata = {}
        
    def auto_detect_fragments(self, atoms: List[str], coords: List[List[float]]) -> Dict:
        """
        Auto-detect DMABN molecular fragments based on connectivity and atom types.
        
        Args:
            atoms: List of atom symbols
            coords: List of atomic coordinates [x, y, z]
            
        Returns:
            Dictionary mapping fragment names to atom indices
        """
        coords_array = np.array(coords)
        n_atoms = len(atoms)
        
        # Calculate distance matrix
        dist_matrix = np.zeros((n_atoms, n_atoms))
        for i in range(n_atoms):
            for j in range(i + 1, n_atoms):
                dist = np.linalg.norm(coords_array[i] - coords_array[j])
                dist_matrix[i, j] = dist
                dist_matrix[j, i] = dist
        
        # Find connected atoms (bonds)
        connectivity = self._find_connectivity(atoms, dist_matrix)
        
        # Detect benzene ring (6 connected carbons in a ring)
        benzene_ring = self._detect_benzene_ring(atoms, connectivity)
        if not benzene_ring:
            raise ValueError("Could not detect benzene ring in DMABN structure")
        
        # Detect amino group (N connected to ring + methyl carbons)
        amino_group = self._detect_amino_group(atoms, connectivity, benzene_ring)
        if not amino_group:
            raise ValueError("Could not detect amino group in DMABN structure")
        
        # Detect nitrile group (C≡N)
        nitrile_group = self._detect_nitrile_group(atoms, connectivity, benzene_ring)
        if not nitrile_group:
            raise ValueError("Could not detect nitrile group in DMABN structure")
        
        fragment_mapping = {
            'benzene_ring': benzene_ring,
            'amino_nitrogen': amino_group['nitrogen'],
            'amino_carbons': amino_group['carbons'],
            'nitrile_carbon': nitrile_group['carbon'],
            'nitrile_nitrogen': nitrile_group['nitrogen'],
            'ring_amino_bond': amino_group['ring_connection'],
            'ring_nitrile_bond': nitrile_group['ring_connection']
        }
        
        logger.info(f"Auto-detected DMABN fragments: {fragment_mapping}")
        return fragment_mapping
    
    def _find_connectivity(self, atoms: List[str], dist_matrix: np.ndarray) -> Dict:
        """Find atomic connectivity based on distances."""
        bond_thresholds = {
            ('C', 'C'): 1.6,
            ('C', 'N'): 1.5,
            ('C', 'H'): 1.2,
            ('N', 'H'): 1.1,
        }
        
        connectivity = {i: [] for i in range(len(atoms))}
        
        for i in range(len(atoms)):
            for j in range(i + 1, len(atoms)):
                atom_pair = tuple(sorted([atoms[i], atoms[j]]))
                threshold = bond_thresholds.get(atom_pair, 1.8)
                
                if dist_matrix[i, j] < threshold:
                    connectivity[i].append(j)
                    connectivity[j].append(i)
        
        return connectivity
    
    def _detect_benzene_ring(self, atoms: List[str], connectivity: Dict) -> List[int]:
        """Detect benzene ring atoms."""
        carbon_indices = [i for i, atom in enumerate(atoms) if atom == 'C']
        
        # Find 6-membered carbon rings
        for start_carbon in carbon_indices:
            ring = self._find_ring_from_atom(start_carbon, connectivity, target_size=6)
            if ring and len(ring) == 6:
                # Verify all atoms in ring are carbons
                if all(atoms[i] == 'C' for i in ring):
                    return ring
        
        return []
    
    def _find_ring_from_atom(self, start_atom: int, connectivity: Dict, 
                            target_size: int, max_depth: int = 10) -> List[int]:
        """Find ring starting from a given atom using DFS."""
        def dfs(current, path, depth):
            if depth > max_depth:
                return None
            
            if len(path) == target_size and start_atom in connectivity[current]:
                return path
            
            if len(path) >= target_size:
                return None
                
            for neighbor in connectivity[current]:
                if neighbor == start_atom and len(path) == target_size - 1:
                    return path + [current]
                elif neighbor not in path and len(path) < target_size - 1:
                    result = dfs(neighbor, path + [current], depth + 1)
                    if result:
                        return result
            
            return None
        
        return dfs(start_atom, [], 0)
    
    def _detect_amino_group(self, atoms: List[str], connectivity: Dict, 
                            benzene_ring: List[int]) -> Optional[Dict]:
        """Detect amino group connected to benzene ring."""
        # Find nitrogen atoms
        nitrogen_indices = [i for i, atom in enumerate(atoms) if atom == 'N']
        
        for n_idx in nitrogen_indices:
            connected_carbons = [i for i in connectivity[n_idx] if atoms[i] == 'C']
            
            # Check if nitrogen is connected to ring
            ring_connections = [c for c in connected_carbons if c in benzene_ring]
            if len(ring_connections) != 1:
                continue
            
            # Find methyl carbons (carbons connected to N but not in ring)
            methyl_carbons = [c for c in connected_carbons if c not in benzene_ring]
            
            if len(methyl_carbons) == 2:  # Dimethyl amino group
                return {
                    'nitrogen': n_idx,
                    'carbons': methyl_carbons,
                    'ring_connection': ring_connections[0]
                }
        
        return None
    
    def _detect_nitrile_group(self, atoms: List[str], connectivity: Dict, 
                            benzene_ring: List[int]) -> Optional[Dict]:
        """Detect nitrile group connected to benzene ring."""
        # Find nitrogen atoms not already assigned to amino group
        nitrogen_indices = [i for i, atom in enumerate(atoms) if atom == 'N']
        
        for n_idx in nitrogen_indices:
            connected_carbons = [i for i in connectivity[n_idx] if atoms[i] == 'C']
            
            # Nitrile nitrogen should be connected to exactly one carbon
            if len(connected_carbons) == 1:
                c_idx = connected_carbons[0]
                
                # Check if this carbon is connected to ring
                ring_connections = [i for i in connectivity[c_idx] 
                                    if i in benzene_ring and i != n_idx]
                
                if len(ring_connections) == 1:
                    return {
                        'nitrogen': n_idx,
                        'carbon': c_idx,
                        'ring_connection': ring_connections[0]
                    }
        
        return None
    
    def set_fragment_mapping(self, fragment_mapping: Dict):
        """Set fragment mapping from user selection or auto-detection."""
        self.fragment_mapping = fragment_mapping.copy()
        logger.info(f"Fragment mapping set: {self.fragment_mapping}")

    def analyze_trajectory(self, trajectory_data: List[Dict]) -> Dict:
        """
        Analyze geometry parameters for entire MD trajectory.
        
        Args:
            trajectory_data: List of trajectory frames with atoms and coords
            
        Returns:
            Dictionary containing geometry analysis results
        """
        if not self.fragment_mapping:
            # Auto-detect fragments from first frame
            first_frame = trajectory_data[0]
            self.fragment_mapping = self.auto_detect_fragments(
                first_frame['atoms'], first_frame['coords']
            )
        
        self.geometry_data = []
        
        for frame_idx, frame in enumerate(trajectory_data):
            try:
                geometry_params = self.analyze_frame(
                    frame['atoms'], frame['coords'], frame.get('time_fs', frame_idx * 0.5)
                )
                geometry_params['frame_number'] = frame_idx
                self.geometry_data.append(geometry_params)
                
            except Exception as e:
                logger.warning(f"Failed to analyze frame {frame_idx}: {e}")
                # Add placeholder data to maintain frame indexing
                self.geometry_data.append({
                    'frame_number': frame_idx,
                    'time_fs': frame.get('time_fs', frame_idx * 0.5),
                    'twist_angle': np.nan,
                    'ring_planarity': np.nan,
                    'ring_nitrile_angle': np.nan,
                    'analysis_failed': True
                })
        
        # Generate analysis metadata
        self.analysis_metadata = self._generate_metadata()
        
        return {
            'geometry_data': self.geometry_data,
            'fragment_mapping': self.fragment_mapping,
            'metadata': self.analysis_metadata
        }
    
    def analyze_frame(self, atoms: List[str], coords: List[List[float]], 
                    time_fs: float) -> Dict:
        """
        Analyze geometry parameters for a single frame.
        
        Args:
            atoms: List of atom symbols
            coords: List of atomic coordinates
            time_fs: Time in femtoseconds
            
        Returns:
            Dictionary with geometry parameters for this frame
        """
        coords_array = np.array(coords)
        
        # Calculate twist angle (donor-acceptor coupling)
        twist_angle = self._calculate_twist_angle(coords_array)
        
        # Calculate ring planarity deviation
        ring_planarity = self._calculate_ring_planarity(coords_array)
        
        # Calculate ring-nitrile angle
        ring_nitrile_angle = self._calculate_ring_nitrile_angle(coords_array)
        
        return {
            'time_fs': time_fs,
            'time_ps': time_fs / 1000.0,
            'twist_angle': twist_angle,
            'ring_planarity': ring_planarity,
            'ring_nitrile_angle': ring_nitrile_angle,
            'donor_acceptor_distance': self._calculate_donor_acceptor_distance(coords_array),
            'amino_pyramidalization': self._calculate_amino_pyramidalization(coords_array)
        }
    
    # DMABN geometry analysis
    def _calculate_twist_angle(self, coords: np.ndarray) -> float:
        """
        Calculate DMABN twist angle correctly: 
        Angle between methyl-methyl vector and ring plane.
        
        At 90°: methyl groups are perpendicular to ring plane (TICT state)
        At 0°: methyl groups are in ring plane (planar state)
        """
        try:
            # Get key atoms
            ring_indices = self.fragment_mapping['benzene_ring']
            amino_carbons = self.fragment_mapping['amino_carbons']
            
            # Calculate ring plane normal
            ring_coords = coords[ring_indices]
            if len(ring_coords) >= 6:
                p1, p2, p3 = ring_coords[0], ring_coords[2], ring_coords[4]
            else:
                p1, p2, p3 = ring_coords[0], ring_coords[1], ring_coords[2]
            
            v1 = p2 - p1
            v2 = p3 - p1
            ring_normal = np.cross(v1, v2)
            ring_normal = ring_normal / np.linalg.norm(ring_normal)
            
            # Vector between the two methyl groups
            # This represents the orientation of the dimethylamino group
            methyl1_coord = coords[amino_carbons[0]]
            methyl2_coord = coords[amino_carbons[1]]
            methyl_vector = methyl2_coord - methyl1_coord
            methyl_vector = methyl_vector / np.linalg.norm(methyl_vector)
            
            # Calculate angle between methyl vector and ring plane
            # Dot product with ring normal gives cosine of angle with normal
            dot_product = np.dot(methyl_vector, ring_normal)
            
            # Angle between methyl vector and ring normal
            angle_with_normal = np.degrees(np.arccos(np.clip(abs(dot_product), 0.0, 1.0)))
            
            # Convert to twist angle:
            # If methyl vector is in ring plane: angle_with_normal = 90°, twist = 0°
            # If methyl vector is perpendicular to ring: angle_with_normal = 0°, twist = 90°
            twist_angle = 90.0 - angle_with_normal
            
            # Ensure positive angle
            twist_angle = abs(twist_angle)
            
            return twist_angle
            
        except Exception as e:
            logger.warning(f"Error calculating twist angle: {e}")
            return self._calculate_twist_angle_fallback(coords)

    def _calculate_twist_angle_dihedral(self, coords: np.ndarray) -> float:
        """
        Calculate twist angle using dihedral angle approach.
        This measures the actual torsion of the amino group relative to the ring.
        """
        try:
            # Get key atoms
            amino_n = self.fragment_mapping['amino_nitrogen']
            amino_carbons = self.fragment_mapping['amino_carbons']
            ring_connection = self.fragment_mapping['ring_amino_bond']
            ring_indices = self.fragment_mapping['benzene_ring']
            
            # Find a ring atom adjacent to the connection point
            ring_connection_idx = ring_indices.index(ring_connection)
            adjacent_ring_idx = (ring_connection_idx + 1) % len(ring_indices)
            adjacent_ring_atom = ring_indices[adjacent_ring_idx]
            
            # Calculate dihedral: adjacent_ring - ring_connection - amino_N - methyl
            dihedral = self._calculate_dihedral_angle(
                coords[adjacent_ring_atom],  # Ring atom
                coords[ring_connection],     # Connection point  
                coords[amino_n],             # Amino nitrogen
                coords[amino_carbons[0]]     # One methyl carbon
            )
            
            # Convert dihedral to twist angle (0-90° range)
            twist_angle = abs(dihedral)
            if twist_angle > 90:
                twist_angle = 180 - twist_angle
                
            return twist_angle
            
        except Exception as e:
            logger.warning(f"Error in dihedral twist calculation: {e}")
            return 0.0
    
    def _calculate_twist_angle_fallback(self, coords: np.ndarray) -> float:
        """
        Fallback method using amino group plane vs ring plane angle.
        """
        try:
            # Get ring plane normal
            ring_indices = self.fragment_mapping['benzene_ring']
            ring_coords = coords[ring_indices]
            ring_normal = self._calculate_plane_normal(ring_coords)
            
            # Get amino group atoms
            amino_n = self.fragment_mapping['amino_nitrogen']
            amino_carbons = self.fragment_mapping['amino_carbons']
            ring_connection = self.fragment_mapping['ring_amino_bond']
            
            # Create amino group plane using N, ring connection, and one methyl carbon
            amino_plane_coords = np.array([
                coords[ring_connection],  # Ring carbon
                coords[amino_n],          # Amino nitrogen  
                coords[amino_carbons[0]]  # One methyl carbon
            ])
            
            amino_normal = self._calculate_plane_normal(amino_plane_coords)
            
            # Calculate angle between ring plane and amino plane normals
            cos_angle = np.dot(ring_normal, amino_normal)
            cos_angle = np.clip(cos_angle, -1.0, 1.0)
            
            # Angle between plane normals
            plane_angle = np.degrees(np.arccos(abs(cos_angle)))
            
            # Convert to twist angle:
            # - Coplanar: plane_angle = 0°, twist = 0°
            # - Perpendicular: plane_angle = 90°, twist = 90°
            twist_angle = plane_angle
            
            # Ensure 0-90° range
            if twist_angle > 90:
                twist_angle = 180 - twist_angle
                
            return abs(twist_angle)
            
        except Exception as e:
            logger.warning(f"Error in fallback twist angle calculation: {e}")
            return 0.0

    def validate_full_range_twist(self, coords: np.ndarray) -> dict:
        """
        Test if the twist angle calculation gives the full 0-90° range.
        """
        try:
            # Method 1: Current implementation
            current_twist = self._calculate_twist_angle(coords)
            
            # Method 2: Direct vector-plane angle
            ring_indices = self.fragment_mapping['benzene_ring']
            amino_n = self.fragment_mapping['amino_nitrogen']
            ring_amino_bond = self.fragment_mapping['ring_amino_bond']
            
            ring_coords = coords[ring_indices]
            ring_normal = self._calculate_plane_normal(ring_coords)
            
            cn_vector = coords[amino_n] - coords[ring_amino_bond]
            cn_vector = cn_vector / np.linalg.norm(cn_vector)
            
            # Direct calculation
            dot_product = abs(np.dot(cn_vector, ring_normal))
            dot_product = np.clip(dot_product, 0.0, 1.0)
            direct_twist = np.degrees(np.arcsin(dot_product))  # arcsin gives 0-90°
            
            # Method 3: Using arccos differently
            cos_with_plane = abs(np.dot(cn_vector, ring_normal))
            arccos_twist = 90.0 - np.degrees(np.arccos(cos_with_plane))
            
            validation = {
                'current_method': current_twist,
                'direct_arcsin': direct_twist,
                'arccos_method': abs(arccos_twist),
                'max_achieved': max(current_twist, direct_twist, abs(arccos_twist)),
                'reaches_90_degrees': max(current_twist, direct_twist, abs(arccos_twist)) > 85,
                'geometric_analysis': {
                    'cn_vector': cn_vector.tolist(),
                    'ring_normal': ring_normal.tolist(),
                    'dot_product': float(np.dot(cn_vector, ring_normal)),
                    'vector_angle_with_normal': float(np.degrees(np.arccos(np.clip(abs(np.dot(cn_vector, ring_normal)), 0, 1))))
                }
            }
            
            return validation
            
        except Exception as e:
            return {'error': str(e)}

    # Method that SHOULD give you 0-90° range
    def _calculate_twist_angle_corrected(self, coords: np.ndarray) -> float:
        """
        Corrected twist angle calculation guaranteed to give 0-90° range.
        """
        try:
            ring_indices = self.fragment_mapping['benzene_ring']
            amino_n = self.fragment_mapping['amino_nitrogen']
            ring_amino_bond = self.fragment_mapping['ring_amino_bond']
            
            # Ring plane normal (more robust calculation)
            ring_coords = coords[ring_indices]
            
            # Use cross product of two ring vectors for normal
            ring_center = np.mean(ring_coords, axis=0)
            v1 = ring_coords[1] - ring_coords[0]
            v2 = ring_coords[2] - ring_coords[0]
            ring_normal = np.cross(v1, v2)
            ring_normal = ring_normal / np.linalg.norm(ring_normal)
            
            # C-N vector
            cn_vector = coords[amino_n] - coords[ring_amino_bond]
            cn_vector = cn_vector / np.linalg.norm(cn_vector)
            
            # Use arcsin for direct 0-90° mapping
            sin_angle = abs(np.dot(cn_vector, ring_normal))
            sin_angle = np.clip(sin_angle, 0.0, 1.0)
            
            twist_angle = np.degrees(np.arcsin(sin_angle))
            
            return twist_angle
            
        except Exception as e:
            logger.warning(f"Error in corrected twist calculation: {e}")
            return 0.0

    def _calculate_dihedral_angle(self, p1: np.ndarray, p2: np.ndarray, 
                                p3: np.ndarray, p4: np.ndarray) -> float:
        """
        Calculate dihedral angle between four atoms p1-p2-p3-p4.
        
        Returns angle in degrees (-180 to 180).
        """
        # Vectors along the bonds
        b1 = p2 - p1  # p1 -> p2
        b2 = p3 - p2  # p2 -> p3  
        b3 = p4 - p3  # p3 -> p4
        
        # Normal vectors to the planes
        n1 = np.cross(b1, b2)  # Normal to plane p1-p2-p3
        n2 = np.cross(b2, b3)  # Normal to plane p2-p3-p4
        
        # Normalize the normals
        n1_norm = np.linalg.norm(n1)
        n2_norm = np.linalg.norm(n2)
        
        if n1_norm < 1e-6 or n2_norm < 1e-6:
            return 0.0  # Degenerate case
            
        n1 = n1 / n1_norm
        n2 = n2 / n2_norm
        
        # Calculate angle between normals
        cos_angle = np.dot(n1, n2)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        
        # Calculate the dihedral angle
        dihedral = np.degrees(np.arccos(cos_angle))
        
        # Determine sign using the scalar triple product
        if np.dot(np.cross(n1, n2), b2) < 0:
            dihedral = -dihedral
            
        return dihedral

    def _calculate_amino_pyramidalization(self, coords: np.ndarray) -> float:
        """
        Calculate pyramidalization angle of amino nitrogen.
        Improved calculation using proper tetrahedral geometry.
        """
        try:
            amino_n = self.fragment_mapping['amino_nitrogen']
            amino_carbons = self.fragment_mapping['amino_carbons']
            ring_connection = self.fragment_mapping['ring_amino_bond']
            
            n_coord = coords[amino_n]
            
            # Get three connected atoms
            connected_coords = [
                coords[ring_connection],
                coords[amino_carbons[0]], 
                coords[amino_carbons[1]]
            ]
            
            # Calculate the plane defined by the three connected atoms
            # Vector from first to second atom
            v1 = connected_coords[1] - connected_coords[0]
            # Vector from first to third atom  
            v2 = connected_coords[2] - connected_coords[0]
            
            # Normal to the plane
            plane_normal = np.cross(v1, v2)
            plane_normal = plane_normal / np.linalg.norm(plane_normal)
            
            # Vector from plane centroid to nitrogen
            plane_centroid = np.mean(connected_coords, axis=0)
            n_vector = n_coord - plane_centroid
            
            # Project onto plane normal to get out-of-plane component
            out_of_plane = np.dot(n_vector, plane_normal)
            
            # Calculate angle from planarity
            in_plane_distance = np.linalg.norm(n_vector - out_of_plane * plane_normal)
            
            if in_plane_distance > 1e-6:
                pyramidalization = np.degrees(np.arctan(abs(out_of_plane) / in_plane_distance))
            else:
                pyramidalization = 90.0 if abs(out_of_plane) > 1e-6 else 0.0
                
            return pyramidalization
            
        except Exception as e:
            logger.warning(f"Error calculating amino pyramidalization: {e}")
            return 0.0

    # Additional method to validate twist angle calculation
    def validate_twist_angle_calculation(self, coords: np.ndarray) -> dict:
        """
        Debug method to validate twist angle calculations.
        Returns detailed information about the calculation.
        """
        try:
            amino_n = self.fragment_mapping['amino_nitrogen']
            amino_carbons = self.fragment_mapping['amino_carbons']
            ring_connection = self.fragment_mapping['ring_amino_bond']
            ring_indices = self.fragment_mapping['benzene_ring']
            
            # Get coordinates
            n_coord = coords[amino_n]
            ring_coord = coords[ring_connection]
            methyl1_coord = coords[amino_carbons[0]]
            methyl2_coord = coords[amino_carbons[1]]
            
            # Calculate ring plane
            ring_coords = coords[ring_indices]
            ring_normal = self._calculate_plane_normal(ring_coords)
            ring_center = np.mean(ring_coords, axis=0)
            
            # Calculate amino group geometry
            amino_center = np.mean([n_coord, methyl1_coord, methyl2_coord], axis=0)
            
            # Vector from ring center to amino center
            ring_to_amino = amino_center - ring_center
            
            # Angle with ring normal
            cos_angle = np.dot(ring_to_amino, ring_normal) / np.linalg.norm(ring_to_amino)
            angle_with_normal = np.degrees(np.arccos(np.clip(abs(cos_angle), 0, 1)))
            
            validation_info = {
                'amino_nitrogen_coord': n_coord.tolist(),
                'ring_connection_coord': ring_coord.tolist(),
                'methyl_coords': [methyl1_coord.tolist(), methyl2_coord.tolist()],
                'ring_center': ring_center.tolist(),
                'amino_center': amino_center.tolist(),
                'ring_normal': ring_normal.tolist(),
                'angle_with_ring_normal': angle_with_normal,
                'calculated_twist_angle': self._calculate_twist_angle(coords)
            }
            
            return validation_info
            
        except Exception as e:
            logger.error(f"Error in twist angle validation: {e}")
            return {'error': str(e)}
    
    def _calculate_ring_planarity(self, coords: np.ndarray) -> float:
        """
        Calculate ring planarity as maximum deviation from mean plane.
        """
        ring_indices = self.fragment_mapping['benzene_ring']
        ring_coords = coords[ring_indices]
        
        # Calculate best-fit plane
        centroid = np.mean(ring_coords, axis=0)
        centered_coords = ring_coords - centroid
        
        # SVD to find plane normal
        _, _, vh = np.linalg.svd(centered_coords)
        normal = vh[-1]  # Last row is normal to best-fit plane
        
        # Calculate deviations from plane
        deviations = []
        for coord in ring_coords:
            # Distance from point to plane
            deviation = abs(np.dot(coord - centroid, normal))
            deviations.append(deviation)
        
        # Return maximum deviation
        return max(deviations)
    
    def _calculate_ring_nitrile_angle(self, coords: np.ndarray) -> float:
        """
        Calculate angle between nitrile group and benzene ring plane.
        """
        # Get ring plane normal
        ring_indices = self.fragment_mapping['benzene_ring']
        ring_coords = coords[ring_indices]
        ring_normal = self._calculate_plane_normal(ring_coords)
        
        # Get nitrile vector
        nitrile_c = self.fragment_mapping['nitrile_carbon']
        nitrile_n = self.fragment_mapping['nitrile_nitrogen']
        nitrile_vector = coords[nitrile_n] - coords[nitrile_c]
        nitrile_vector = nitrile_vector / np.linalg.norm(nitrile_vector)
        
        # Calculate angle with ring plane
        cos_angle = np.dot(nitrile_vector, ring_normal)
        cos_angle = np.clip(cos_angle, -1.0, 1.0)
        angle_with_normal = np.degrees(np.arccos(abs(cos_angle)))
        
        # Return angle with plane (90 - angle with normal)
        return 90.0 - angle_with_normal
    
    def _calculate_donor_acceptor_distance(self, coords: np.ndarray) -> float:
        """Calculate distance between donor (N) and acceptor (nitrile C) atoms."""
        amino_n = self.fragment_mapping['amino_nitrogen']
        nitrile_c = self.fragment_mapping['nitrile_carbon']
        
        distance = np.linalg.norm(coords[amino_n] - coords[nitrile_c])
        return distance
    
    def _calculate_plane_normal(self, coords: np.ndarray) -> np.ndarray:
        """Calculate normal vector to plane defined by set of points."""
        centroid = np.mean(coords, axis=0)
        centered_coords = coords - centroid
        
        # Use SVD to find plane normal
        _, _, vh = np.linalg.svd(centered_coords)
        normal = vh[-1]
        
        return normal / np.linalg.norm(normal)
    
    def _generate_metadata(self) -> Dict:
        """Generate analysis metadata and statistics."""
        if not self.geometry_data:
            return {}
        
        # Calculate statistics for each parameter
        parameters = ['twist_angle', 'ring_planarity', 'ring_nitrile_angle', 
                    'donor_acceptor_distance', 'amino_pyramidalization']
        
        stats = {}
        for param in parameters:
            values = [frame[param] for frame in self.geometry_data 
                    if not np.isnan(frame[param])]
            
            if values:
                stats[param] = {
                    'mean': np.mean(values),
                    'std': np.std(values),
                    'min': np.min(values),
                    'max': np.max(values),
                    'range': np.max(values) - np.min(values)
                }
        
        # Identify key frames (large deviations from mean)
        key_frames = self._identify_key_frames()
        
        return {
            'analysis_type': 'DMABN_geometry',
            'total_frames': len(self.geometry_data),
            'successful_frames': len([f for f in self.geometry_data 
                                    if not f.get('analysis_failed', False)]),
            'parameter_statistics': stats,
            'key_frames': key_frames,
            'fragment_mapping': self.fragment_mapping
        }
    
    def _identify_key_frames(self, threshold_std: float = 2.0) -> List[Dict]:
        """
        Identify key frames where geometry parameters show significant changes.
        
        Args:
            threshold_std: Number of standard deviations for outlier detection
            
        Returns:
            List of key frame information
        """
        key_frames = []
        
        # Parameters to check for key frames
        parameters = ['twist_angle', 'ring_planarity', 'ring_nitrile_angle']
        
        for param in parameters:
            values = [frame[param] for frame in self.geometry_data 
                    if not np.isnan(frame[param])]
            
            if not values:
                continue
                
            mean_val = np.mean(values)
            std_val = np.std(values)
            
            if std_val == 0:
                continue
            
            # Find frames with large deviations
            for frame in self.geometry_data:
                if np.isnan(frame[param]):
                    continue
                    
                deviation = abs(frame[param] - mean_val) / std_val
                
                if deviation > threshold_std:
                    key_frames.append({
                        'frame_number': frame['frame_number'],
                        'time_fs': frame['time_fs'],
                        'parameter': param,
                        'value': frame[param],
                        'deviation_sigma': deviation,
                        'description': f"{param} = {frame[param]:.2f} ({deviation:.1f}σ)"
                    })
        
        # Sort by deviation magnitude
        key_frames.sort(key=lambda x: x['deviation_sigma'], reverse=True)
        
        return key_frames[:20]  # Return top 20 key frames
    
    def export_analysis(self, output_format: str = 'json') -> str:
        """
        Export geometry analysis results.
        
        Args:
            output_format: 'json' or 'csv'
            
        Returns:
            Exported data as string
        """
        if output_format == 'json':
            return json.dumps({
                'geometry_data': self.geometry_data,
                'fragment_mapping': self.fragment_mapping,
                'metadata': self.analysis_metadata
            }, indent=2, default=str)
        
        elif output_format == 'csv':
            import io
            output = io.StringIO()
            
            # Write header
            output.write("frame,time_fs,time_ps,twist_angle,ring_planarity,")
            output.write("ring_nitrile_angle,donor_acceptor_distance,amino_pyramidalization\n")
            
            # Write data
            for frame in self.geometry_data:
                output.write(f"{frame['frame_number']},{frame['time_fs']:.2f},")
                output.write(f"{frame['time_ps']:.6f},{frame['twist_angle']:.4f},")
                output.write(f"{frame['ring_planarity']:.4f},{frame['ring_nitrile_angle']:.4f},")
                output.write(f"{frame['donor_acceptor_distance']:.4f},")
                output.write(f"{frame['amino_pyramidalization']:.4f}\n")
            
            return output.getvalue()
        
        else:
            raise ValueError(f"Unsupported export format: {output_format}")