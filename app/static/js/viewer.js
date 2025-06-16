// 3D Molecular Viewer
class MolecularViewer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.animationId = null;
        
        // Data storage
        this.trajectoryData = null;
        this.excitationData = null;
        this.currentFrame = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1;
        
        // Molecular visualization
        this.moleculeGroup = null;
        this.atomMeshes = [];
        this.bondMeshes = [];
        
        // Atom properties
        this.atomColors = {
            'C': 0x000000,  // black
            'N': 0x0000ff,  // blue
            'O': 0xff0000,  // red
            'H': 0xd3d3d3,  // light gray
            'S': 0xffff00,  // yellow
            'P': 0xffa500,  // orange
            'F': 0x00ff00,  // green
            'Cl': 0x00ff00  // green
        };
        
        this.atomSizes = {
            'C': 0.8, 'N': 0.75, 'O': 0.7, 'H': 0.3, 
            'S': 0.9, 'P': 0.85, 'F': 0.6, 'Cl': 0.8
        };
        
        this.maxBondDistances = {
            'H': 1.2,
            'default': 1.8
        };
    
        // new properties for better rotation
        this.moleculeCenter = new THREE.Vector3(0, 0, 0);
        this.rotationSensitivity = 0.01;
        this.zoomSensitivity = 0.1;

         // dipole moment visualization properties
        this.dipoleArrows = [];
        this.showDipoles = false;
        this.dipoleScale = 5.0; // Scale factor for arrow length
        this.dipoleColors = {
            s1: 0xff0000,  // Red for S1
            s2: 0x0000ff   // Blue for S2
    };
        
        this.init();
    }
    
    init() {
        this.createScene();
        this.createCamera();
        this.createRenderer();
        this.createControls();
        this.createLighting();
        this.setupEventListeners();
        this.animate();
        
        console.log('Molecular Viewer initialized');
    }
    
    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Create molecule group
        this.moleculeGroup = new THREE.Group();
        this.scene.add(this.moleculeGroup);
    }
    
    createCamera() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(0, 0, 0);
    }
    
    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    createControls() {
        // Note: OrbitControls would need to be imported separately
        // For now, we'll implement basic mouse controls
        this.setupMouseControls();
    }
    
    // Replace the existing setupMouseControls method with this improved version
    setupMouseControls() {
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        
        this.container.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
            this.container.style.cursor = 'grabbing';
        });
        
        this.container.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            // Rotate around the centered molecule (now at origin)
            this.moleculeGroup.rotation.y += deltaX * this.rotationSensitivity;
            this.moleculeGroup.rotation.x += deltaY * this.rotationSensitivity;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.container.addEventListener('mouseup', () => {
            isMouseDown = false;
            this.container.style.cursor = 'grab';
        });
        
        this.container.addEventListener('mouseleave', () => {
            isMouseDown = false;
            this.container.style.cursor = 'default';
        });
        
        // Improved zoom with bounds
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            
            const zoomFactor = event.deltaY > 0 ? (1 + this.zoomSensitivity) : (1 - this.zoomSensitivity);
            
            // Calculate new position
            const newPosition = this.camera.position.clone().multiplyScalar(zoomFactor);
            
            // Set reasonable zoom bounds
            const minDistance = 3;
            const maxDistance = 100;
            const currentDistance = newPosition.length();
            
            if (currentDistance >= minDistance && currentDistance <= maxDistance) {
                this.camera.position.copy(newPosition);
            }
            
        }, { passive: false });
        
        // Set initial cursor
        this.container.style.cursor = 'grab';
    }
    
    createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Point light
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-10, -10, -5);
        this.scene.add(pointLight);
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    async loadData(sessionId) {
        try {
            console.log('Loading molecular data...');
            console.log('Session ID:', sessionId);
            
            const url = `/api/data/${sessionId}`;
            console.log('Fetching from:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                // Try to get error details
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use status text
                    errorMessage = `${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('Received data:', data);
            console.log('Molecule type value:', data.molecule_type);
            
            if (!data.success && data.error) {
                throw new Error(data.error);
            }
            
            // Check if we have trajectory data
            if (!data.trajectory || !Array.isArray(data.trajectory) || data.trajectory.length === 0) {
                throw new Error('No trajectory data found in response');
            }
            
            this.trajectoryData = data.trajectory;
            this.excitationData = data.excitation || [];
            
            console.log(`Loaded ${this.trajectoryData.length} trajectory frames`);
            console.log(`Loaded ${this.excitationData.length} excitation points`);
            
            this.setupMolecularStructure();
            this.updateFrame(0);
            this.updateUI();
            
            // Force update the frame info after everything is loaded
            setTimeout(() => {
                if (this.trajectoryData && this.trajectoryData[0]) {
                    this.updateFrameInfo(this.trajectoryData[0]);
                    console.log('Forced frame info update');
                }
            }, 100);
            
            // Check if this is a DMABN session and enable analysis buttons
            if (data.molecule_type === 'dmabn') {
                console.log('DMABN session detected - enabling analysis buttons');
                const runBtn = document.getElementById('run-dmabn-analysis-btn');
                const geometryBtn = document.getElementById('geometry-timeline-btn');
                
                if (runBtn) {
                    runBtn.disabled = false;
                    runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
                
                if (geometryBtn) {
                    geometryBtn.disabled = false;
                    geometryBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            } else {
                console.log('Non-DMABN session - buttons remain disabled');
            }

            return true;
        } catch (error) {
            console.error('Error loading data:', error);
            console.error('Error details:', {
                sessionId: sessionId,
                url: `/api/data/${sessionId}`,
                error: error.message
            });
            this.showError('Failed to load molecular data: ' + error.message);
            return false;
        }
    }

    saveCameraState() {
        this.savedCameraState = {
            position: this.camera.position.clone(),
            rotation: this.camera.rotation.clone(),
            quaternion: this.camera.quaternion.clone(),
            moleculeRotation: {
                x: this.moleculeGroup.rotation.x,
                y: this.moleculeGroup.rotation.y, 
                z: this.moleculeGroup.rotation.z
            }
        };
        console.log('Camera state saved');
    }

    // Restore saved camera state
    restoreCameraState() {
        if (this.savedCameraState) {
            this.camera.position.copy(this.savedCameraState.position);
            this.camera.rotation.copy(this.savedCameraState.rotation);
            this.camera.quaternion.copy(this.savedCameraState.quaternion);
            
            // Also restore molecule rotation
            this.moleculeGroup.rotation.x = this.savedCameraState.moleculeRotation.x;
            this.moleculeGroup.rotation.y = this.savedCameraState.moleculeRotation.y;
            this.moleculeGroup.rotation.z = this.savedCameraState.moleculeRotation.z;
            
            console.log('📷 Camera state restored');
        }
    }

    // Modified setFrame method that preserves camera when switching
    setFrameWithFixedCamera(frameIndex) {
        if (!this.trajectoryData || frameIndex < 0 || frameIndex >= this.trajectoryData.length) {
            return;
        }
        
        // Save current camera state before frame change
        this.saveCameraState();
        
        // Update the frame
        this.updateFrame(frameIndex);
        this.updateSlider();
        
        // Restore camera state after frame change
        setTimeout(() => {
            this.restoreCameraState();
        }, 10); // Small delay to ensure frame is updated first
    }

    setupMolecularStructure() {
        // Clear existing meshes
        this.clearMolecule();
        
        if (!this.trajectoryData || this.trajectoryData.length === 0) {
            console.error('No trajectory data available');
            return;
        }
        
        const firstFrame = this.trajectoryData[0];
        const atoms = firstFrame.atoms;
        const coords = firstFrame.coords;
        
        // Calculate molecule center (geometric center for now, could use center of mass)
        this.moleculeCenter = this.calculateMoleculeCenter(coords);
        
        // Create atom meshes
        this.atomMeshes = [];
        atoms.forEach((atom, index) => {
            const geometry = new THREE.SphereGeometry(this.atomSizes[atom] || 0.5, 16, 12);
            const material = new THREE.MeshLambertMaterial({ 
                color: this.atomColors[atom] || 0x888888 
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(coords[index][0], coords[index][1], coords[index][2]);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            this.atomMeshes.push(mesh);
            this.moleculeGroup.add(mesh);
        });
        
        // Create bonds
        this.createBonds(atoms, coords);
        
        // Center the molecule group at origin for better rotation
        this.centerMoleculeGroup();
        
        // Position camera to view the centered molecule
        this.positionCameraForMolecule();
        
        console.log(`Created molecule with ${atoms.length} atoms and ${this.bondMeshes.length} bonds`);
        console.log(`Molecule center: ${this.moleculeCenter.x.toFixed(2)}, ${this.moleculeCenter.y.toFixed(2)}, ${this.moleculeCenter.z.toFixed(2)}`);
    }

    // Add this new method to calculate molecule center
    calculateMoleculeCenter(coords) {
        const center = new THREE.Vector3(0, 0, 0);
        
        coords.forEach(coord => {
            center.x += coord[0];
            center.y += coord[1];
            center.z += coord[2];
        });
        
        center.divideScalar(coords.length);
        return center;
    }

    // Add this new method to center the molecule group
    centerMoleculeGroup() {
        // Move the entire molecule group so its center is at the origin
        this.moleculeGroup.position.set(
            -this.moleculeCenter.x,
            -this.moleculeCenter.y,
            -this.moleculeCenter.z
        );
    }

    // Add this new method to position camera optimally
    positionCameraForMolecule() {
        // Calculate bounding sphere of the molecule
        const boundingSphere = this.calculateBoundingSphere();
        
        // Position camera at optimal distance
        const distance = Math.max(boundingSphere.radius * 3, 10);
        this.camera.position.set(distance, distance, distance);
        this.camera.lookAt(0, 0, 0); // Look at the centered molecule
        
        console.log(`Camera positioned at distance: ${distance.toFixed(2)}, bounding radius: ${boundingSphere.radius.toFixed(2)}`);
    }

    // Add this new method to calculate bounding sphere
    calculateBoundingSphere() {
        if (!this.trajectoryData || this.trajectoryData.length === 0) {
            return { radius: 5 };
        }
        
        const coords = this.trajectoryData[0].coords;
        let maxDistance = 0;
        
        coords.forEach(coord => {
            const distance = Math.sqrt(
                (coord[0] - this.moleculeCenter.x) ** 2 +
                (coord[1] - this.moleculeCenter.y) ** 2 +
                (coord[2] - this.moleculeCenter.z) ** 2
            );
            maxDistance = Math.max(maxDistance, distance);
        });
        
        return { radius: maxDistance + 2 }; // Add padding
    }
    
    createBonds(atoms, coords) {
        this.bondMeshes = [];
        
        for (let i = 0; i < coords.length; i++) {
            for (let j = i + 1; j < coords.length; j++) {
                const distance = this.calculateDistance(coords[i], coords[j]);
                
                let maxDistance = this.maxBondDistances.default;
                if (atoms[i] === 'H' || atoms[j] === 'H') {
                    maxDistance = this.maxBondDistances.H;
                }
                
                if (distance < maxDistance) {
                    const bond = this.createBond(coords[i], coords[j]);
                    this.bondMeshes.push({ mesh: bond, atomIndices: [i, j] });
                    this.moleculeGroup.add(bond);
                }
            }
        }
    }
    
    createBond(coord1, coord2) {
        const start = new THREE.Vector3(...coord1);
        const end = new THREE.Vector3(...coord2);
        const direction = new THREE.Vector3().subVectors(end, start);
        const distance = direction.length();
        
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, distance, 8);
        const material = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const bond = new THREE.Mesh(geometry, material);
        
        // Position the bond at the midpoint
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        bond.position.copy(midpoint);
        
        // Align the cylinder with the bond direction
        // CylinderGeometry is aligned along Y-axis by default
        // We need to rotate it to align with our bond vector
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
        bond.setRotationFromQuaternion(quaternion);
        
        return bond;
    }
    
    calculateDistance(coord1, coord2) {
        const dx = coord1[0] - coord2[0];
        const dy = coord1[1] - coord2[1];
        const dz = coord1[2] - coord2[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    // create dipole moment arrows
    createDipoleArrows(excitationData) {
        // Clear existing dipole arrows
        this.clearDipoleArrows();
        
        if (!excitationData || !this.showDipoles) return;
        
        // First, check what fields are available in the excitation data
        console.log('Available excitation fields:', Object.keys(excitationData));
        
        // Try different possible field name patterns
        const s1DipoleFields = this.findDipoleFields(excitationData, 's1');
        const s2DipoleFields = this.findDipoleFields(excitationData, 's2');
        
        console.log('S1 dipole fields found:', s1DipoleFields);
        console.log('S2 dipole fields found:', s2DipoleFields);
        
        // Create S1 dipole arrow if data exists
        if (s1DipoleFields.x !== null) {
            const s1Arrow = this.createMoleculeAttachedDipoleArrow(
                excitationData[s1DipoleFields.x],
                excitationData[s1DipoleFields.y],
                excitationData[s1DipoleFields.z],
                this.dipoleColors.s1,
                'S1'
            );
            if (s1Arrow) {
                this.dipoleArrows.push(s1Arrow);
                this.moleculeGroup.add(s1Arrow); // Add to molecule group instead of scene
            }
        }
        
        // Create S2 dipole arrow if data exists
        if (s2DipoleFields.x !== null) {
            const s2Arrow = this.createMoleculeAttachedDipoleArrow(
                excitationData[s2DipoleFields.x],
                excitationData[s2DipoleFields.y],
                excitationData[s2DipoleFields.z],
                this.dipoleColors.s2,
                'S2'
            );
            if (s2Arrow) {
                this.dipoleArrows.push(s2Arrow);
                this.moleculeGroup.add(s2Arrow); // Add to molecule group instead of scene
            }
        }
        
        console.log(`Created ${this.dipoleArrows.length} molecule-attached dipole arrows`);
    }

    // New method to find dipole field names automatically
    findDipoleFields(excitationData, state) {
        const fields = Object.keys(excitationData);
        
        // Try different naming patterns
        const patterns = [
            // Pattern 1: s1_dipole_x, s1_dipole_y, s1_dipole_z
            {
                x: `${state}_dipole_x`,
                y: `${state}_dipole_y`,
                z: `${state}_dipole_z`
            },
            // Pattern 2: s1_x, s1_y, s1_z
            {
                x: `${state}_x`,
                y: `${state}_y`,
                z: `${state}_z`
            },
            // Pattern 3: s1_col3, s1_col4, s1_col5 (assuming energy=col1, osc=col2, x=col3, y=col4, z=col5)
            {
                x: `${state}_col3`,
                y: `${state}_col4`,
                z: `${state}_col5`
            },
            // Pattern 4: s1_transition_dipole_x, etc.
            {
                x: `${state}_transition_dipole_x`,
                y: `${state}_transition_dipole_y`,
                z: `${state}_transition_dipole_z`
            }
        ];
        
        // Check each pattern
        for (const pattern of patterns) {
            if (fields.includes(pattern.x) && fields.includes(pattern.y) && fields.includes(pattern.z)) {
                return pattern;
            }
        }
        
        // If no pattern matches, return null
        return { x: null, y: null, z: null };
    }

    // Updated method to create dipole arrows attached to the molecule
    createMoleculeAttachedDipoleArrow(x, y, z, color, label) {
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        // Skip if magnitude is too small
        if (magnitude < 0.01) return null;
        
        // Create arrow group
        const arrowGroup = new THREE.Group();
        arrowGroup.userData = { type: 'dipole', state: label };
        
        // Arrow shaft (cylinder)
        const shaftLength = magnitude * this.dipoleScale;
        const shaftRadius = 0.05;
        const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 8);
        const shaftMaterial = new THREE.MeshLambertMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 0.8 
        });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        
        // Arrow head (cone)
        const headLength = shaftLength * 0.2;
        const headRadius = shaftRadius * 3;
        const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        
        // Position head at the tip
        head.position.y = shaftLength / 2 + headLength / 2;
        
        // Position shaft (cylinder center is at origin by default)
        shaft.position.y = shaftLength / 2;
        
        arrowGroup.add(shaft);
        arrowGroup.add(head);
        
        // Orient arrow in the direction of the dipole vector
        const direction = new THREE.Vector3(x, y, z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        arrowGroup.setRotationFromQuaternion(quaternion);
        
        // Position arrow relative to molecule center
        // For DMABN, you might want to position at the geometric center or a specific atom
        const offset = this.calculateDipolePosition(label);
        arrowGroup.position.copy(offset);
        
        return arrowGroup;
    }

    // New method to calculate where to position dipole arrows on the molecule
    calculateDipolePosition(label) {
        // Position dipoles at the molecule center (already centered at origin due to centering)
        // You can modify this to position at specific atoms or molecular regions
        
        if (label === 'S1') {
            // Slightly offset S1 dipole
            return new THREE.Vector3(0.3, 0, 0);
        } else if (label === 'S2') {
            // Slightly offset S2 dipole in opposite direction
            return new THREE.Vector3(-0.3, 0, 0);
        }
        
        return new THREE.Vector3(0, 0, 0);
    }

    // Alternative method to position dipoles at specific atoms (useful for DMABN)
    calculateDipolePositionAtAtom(atomIndex) {
        if (!this.trajectoryData || !this.atomMeshes[atomIndex]) {
            return new THREE.Vector3(0, 0, 0);
        }
        
        // Get the position of the specified atom
        const atomPosition = this.atomMeshes[atomIndex].position.clone();
        
        // Add small offset above the atom
        atomPosition.y += 0.5;
        
        return atomPosition;
    }

    // Add this new method to create individual dipole arrows
    createDipoleArrow(x, y, z, color, label) {
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        // Skip if magnitude is too small
        if (magnitude < 0.01) return null;
        
        // Create arrow group
        const arrowGroup = new THREE.Group();
        arrowGroup.userData = { type: 'dipole', state: label };
        
        // Arrow shaft (cylinder)
        const shaftLength = magnitude * this.dipoleScale;
        const shaftRadius = 0.05;
        const shaftGeometry = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 8);
        const shaftMaterial = new THREE.MeshLambertMaterial({ color: color, transparent: true, opacity: 0.8 });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        
        // Arrow head (cone)
        const headLength = shaftLength * 0.2;
        const headRadius = shaftRadius * 3;
        const headGeometry = new THREE.ConeGeometry(headRadius, headLength, 8);
        const headMaterial = new THREE.MeshLambertMaterial({ color: color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        
        // Position head at the tip
        head.position.y = shaftLength / 2 + headLength / 2;
        
        // Position shaft (cylinder center is at origin by default)
        shaft.position.y = shaftLength / 2;
        
        arrowGroup.add(shaft);
        arrowGroup.add(head);
        
        // Orient arrow in the direction of the dipole vector
        const direction = new THREE.Vector3(x, y, z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
        arrowGroup.setRotationFromQuaternion(quaternion);
        
        // Position arrow at molecule center (or slight offset)
        const offset = label === 'S1' ? 0.3 : -0.3; // Offset S1 and S2 slightly
        arrowGroup.position.set(offset, 0, 0);
        
        return arrowGroup;
    }

    // Add this method to clear dipole arrows
    clearDipoleArrows() {
        this.dipoleArrows.forEach(arrow => {
            arrow.children.forEach(child => {
                child.geometry.dispose();
                child.material.dispose();
            });
            this.moleculeGroup.remove(arrow); // Remove from molecule group instead of scene
        });
        this.dipoleArrows = [];
    }

    // Add this method to toggle dipole visualization
    toggleDipoles(show) {
        this.showDipoles = show;
        
        if (show) {
            // Find current excitation data for this frame
            const currentExcitation = this.getCurrentExcitationData();
            if (currentExcitation) {
                this.createDipoleArrows(currentExcitation);
            }
        } else {
            this.clearDipoleArrows();
        }
        
        console.log(`Dipole moments ${show ? 'shown' : 'hidden'}`);
    }

    // Add this method to get excitation data for current frame
    getCurrentExcitationData() {
        if (!this.excitationData || !this.trajectoryData) return null;
        
        const currentFrame = this.trajectoryData[this.currentFrame];
        const currentTimeFs = currentFrame.time_fs || this.currentFrame * 0.5;
        
        // Find closest excitation data point
        let closestExcitation = null;
        let minTimeDiff = Infinity;
        
        this.excitationData.forEach(excitation => {
            const timeDiff = Math.abs(excitation.time_fs - currentTimeFs);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestExcitation = excitation;
            }
        });
        
        return (closestExcitation && minTimeDiff < 100) ? closestExcitation : null;
    }

    // maintain centering during animation
    // Update the existing updateFrame method to include dipole updates
    updateFrame(frameIndex) {
        if (!this.trajectoryData || frameIndex >= this.trajectoryData.length) {
            return;
        }
        
        this.currentFrame = frameIndex;
        const frame = this.trajectoryData[frameIndex];
        const coords = frame.coords;
        
        // Recalculate center for this frame (if using the improved rotation)
        if (this.calculateMoleculeCenter) {
            const newCenter = this.calculateMoleculeCenter(coords);
            
            // Update atom positions
            this.atomMeshes.forEach((mesh, index) => {
                if (coords[index]) {
                    mesh.position.set(
                        coords[index][0] - newCenter.x,
                        coords[index][1] - newCenter.y,
                        coords[index][2] - newCenter.z
                    );
                }
            });
            
            // Update bond positions
            this.bondMeshes.forEach(bondData => {
                const [i, j] = bondData.atomIndices;
                if (coords[i] && coords[j]) {
                    const coord1 = [
                        coords[i][0] - newCenter.x,
                        coords[i][1] - newCenter.y,
                        coords[i][2] - newCenter.z
                    ];
                    const coord2 = [
                        coords[j][0] - newCenter.x,
                        coords[j][1] - newCenter.y,
                        coords[j][2] - newCenter.z
                    ];
                    this.updateBondPosition(bondData.mesh, coord1, coord2);
                }
            });
            
            this.moleculeCenter = newCenter;
        } else {
            // Original update method
            this.atomMeshes.forEach((mesh, index) => {
                if (coords[index]) {
                    mesh.position.set(coords[index][0], coords[index][1], coords[index][2]);
                }
            });
            
            this.bondMeshes.forEach(bondData => {
                const [i, j] = bondData.atomIndices;
                if (coords[i] && coords[j]) {
                    this.updateBondPosition(bondData.mesh, coords[i], coords[j]);
                }
            });
        }
        
        // Update dipole moments if enabled
        if (this.showDipoles) {
            const currentExcitation = this.getCurrentExcitationData();
            if (currentExcitation) {
                this.createDipoleArrows(currentExcitation);
            }
        }
        
        // Update frame info
        this.updateFrameInfo(frame);
        
        // Update charts in real-time
        if (typeof molecularCharts !== 'undefined' && molecularCharts) {
            molecularCharts.updateCharts();
        }
        
        // Dispatch custom event for other components
        const event = new CustomEvent('frameChanged', { 
            detail: { 
                frame: frameIndex, 
                time_fs: frame.time_fs || frameIndex * 0.5,
                time_ps: (frame.time_fs || frameIndex * 0.5) / 1000.0
            } 
        });
        document.dispatchEvent(event);
    }

    //Add method to reset view
    resetView() {
        if (!this.trajectoryData) return;
        
        // Reset rotation
        this.moleculeGroup.rotation.set(0, 0, 0);
        
        // Reset camera position
        this.positionCameraForMolecule();
        
        console.log('View reset');
    }

    // Add method to center on specific atoms (useful for DMABN analysis)
    centerOnAtoms(atomIndices) {
        if (!this.trajectoryData || !atomIndices || atomIndices.length === 0) return;
        
        const currentFrame = this.trajectoryData[this.currentFrame];
        const coords = currentFrame.coords;
        
        // Calculate center of specified atoms
        const atomCenter = new THREE.Vector3(0, 0, 0);
        atomIndices.forEach(index => {
            if (coords[index]) {
                atomCenter.x += coords[index][0];
                atomCenter.y += coords[index][1];
                atomCenter.z += coords[index][2];
            }
        });
        atomCenter.divideScalar(atomIndices.length);
        
        // Update molecule center
        this.moleculeCenter = atomCenter;
        
        // Re-center the molecule
        this.centerMoleculeGroup();
        
        console.log(`Centered on atoms: ${atomIndices.join(', ')}`);
    }
    
    updateBondPosition(bondMesh, coord1, coord2) {
        const start = new THREE.Vector3(...coord1);
        const end = new THREE.Vector3(...coord2);
        const direction = new THREE.Vector3().subVectors(end, start);
        const distance = direction.length();
        
        // Update bond length
        bondMesh.scale.y = distance;
        
        // Update position to midpoint
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        bondMesh.position.copy(midpoint);
        
        // Update orientation
        // CylinderGeometry is aligned along Y-axis by default
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
        bondMesh.setRotationFromQuaternion(quaternion);
    }
    
    updateFrameInfo(frame) {
        const frameInfo = document.getElementById('frame-info');
        console.log('frameInfo element:', frameInfo); // Debug log

        const timeFs = frame.time_fs || (this.currentFrame * 0.5);
        const timePs = timeFs / 1000.0;

        // Update embedded frame info block (for mobile or overlay views)
        if (frameInfo) {
            frameInfo.innerHTML = `
                <div class="frame-details">
                    <span><strong>Frame:</strong> ${this.currentFrame + 1}/${this.trajectoryData.length}</span>
                    <span><strong>Time:</strong> ${timeFs.toFixed(1)} fs (${timePs.toFixed(3)} ps)</span>
                </div>
            `;
        } else {
            console.error('frame-info element not found in DOM');
        }

        // Update sidebar "time-display"
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            timeDisplay.textContent = timeFs.toFixed(1);
        } else {
            console.error('time-display element not found in sidebar');
        }

        // Update sidebar "current-frame"
        const currentFrameDisplay = document.getElementById('current-frame');
        if (currentFrameDisplay) {
            currentFrameDisplay.textContent = this.currentFrame + 1;
        }

        // Update sidebar "total-frames"
        const totalFramesDisplay = document.getElementById('total-frames');
        if (totalFramesDisplay) {
            totalFramesDisplay.textContent = this.trajectoryData.length;
        }

        // Update excitation info panel
        this.updateExcitationInfo(timeFs);
    }
    
    // Add method to update excitation info with dipole information
    updateExcitationInfo(currentTimeFs) {
        if (!this.excitationData) return;
        
        // Find closest excitation data point
        let closestExcitation = null;
        let minTimeDiff = Infinity;
        
        this.excitationData.forEach(excitation => {
            const timeDiff = Math.abs(excitation.time_fs - currentTimeFs);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestExcitation = excitation;
            }
        });
        
        const excitationInfo = document.getElementById('excitation-info');
        
        if (excitationInfo && closestExcitation && minTimeDiff < 100) {
            // Try to find dipole fields automatically
            const s1DipoleFields = this.findDipoleFields(closestExcitation, 's1');
            const s2DipoleFields = this.findDipoleFields(closestExcitation, 's2');
            
            // Calculate dipole magnitudes if fields are found
            let s1DipoleMag = 0;
            let s2DipoleMag = 0;
            
            if (s1DipoleFields.x !== null) {
                s1DipoleMag = Math.sqrt(
                    (closestExcitation[s1DipoleFields.x] || 0)**2 + 
                    (closestExcitation[s1DipoleFields.y] || 0)**2 + 
                    (closestExcitation[s1DipoleFields.z] || 0)**2
                );
            }
            
            if (s2DipoleFields.x !== null) {
                s2DipoleMag = Math.sqrt(
                    (closestExcitation[s2DipoleFields.x] || 0)**2 + 
                    (closestExcitation[s2DipoleFields.y] || 0)**2 + 
                    (closestExcitation[s2DipoleFields.z] || 0)**2
                );
            }
            
            excitationInfo.innerHTML = `
                <div class="excitation-details">
                    <h4>Excitation Data</h4>
                    <div class="excitation-states">
                        <div class="state s1">
                            <span><strong>S1:</strong> ${closestExcitation.s1_energy.toFixed(3)} eV</span>
                            <span><strong>f:</strong> ${closestExcitation.s1_oscillator.toFixed(4)}</span>
                            ${s1DipoleMag > 0 ? `<span><strong>μ:</strong> ${s1DipoleMag.toFixed(3)}</span>` : ''}
                        </div>
                        <div class="state s2">
                            <span><strong>S2:</strong> ${closestExcitation.s2_energy.toFixed(3)} eV</span>
                            <span><strong>f:</strong> ${closestExcitation.s2_oscillator.toFixed(4)}</span>
                            ${s2DipoleMag > 0 ? `<span><strong>μ:</strong> ${s2DipoleMag.toFixed(3)}</span>` : ''}
                        </div>
                    </div>
                    <div class="dipole-controls" style="margin-top: 10px;">
                        <button onclick="molecularViewer.toggleDipoles(!molecularViewer.showDipoles)" 
                                style="padding: 4px 8px; font-size: 12px; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ${this.showDipoles ? 'Hide' : 'Show'} Dipoles
                        </button>
                        ${s1DipoleMag === 0 && s2DipoleMag === 0 ? '<div style="font-size: 11px; color: #666; margin-top: 5px;">No dipole data found</div>' : ''}
                    </div>
                </div>
            `;
        } else if (excitationInfo) {
            excitationInfo.innerHTML = '<div class="no-excitation">No excitation data for this frame</div>';
        }
    }
    
    // Animation controls
    play() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.playLoop();
        
        const playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.textContent = '⏸️ Pause';
        }
    }
    
    pause() {
        this.isPlaying = false;
        
        const playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.textContent = '▶️ Play';
        }
    }
    
    playLoop() {
        if (!this.isPlaying) return;
        
        setTimeout(() => {
            this.nextFrame();
            this.playLoop();
        }, 50 / this.playbackSpeed); // Base speed: 20 FPS
    }
    
    nextFrame() {
        if (!this.trajectoryData) return;
        
        this.currentFrame = (this.currentFrame + 1) % this.trajectoryData.length;
        this.updateFrame(this.currentFrame);
        this.updateSlider();
    }
    
    previousFrame() {
        if (!this.trajectoryData) return;
        
        this.currentFrame = this.currentFrame > 0 ? this.currentFrame - 1 : this.trajectoryData.length - 1;
        this.updateFrame(this.currentFrame);
        this.updateSlider();
    }
    
    setFrame(frameIndex) {
        if (!this.trajectoryData || frameIndex < 0 || frameIndex >= this.trajectoryData.length) {
            return;
        }
        
        this.updateFrame(frameIndex);
        this.updateSlider();
    }
    
    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.1, Math.min(5.0, speed));
        console.log(`Playback speed: ${this.playbackSpeed}x`);
    }
    
    updateSlider() {
        const slider = document.getElementById('frame-slider');
        if (slider) {
            slider.value = this.currentFrame;
        }
    }
    
    updateUI() {
        if (!this.trajectoryData) return;
        
        console.log('Updating UI elements...');
        
        // Setup frame slider
        const slider = document.getElementById('frame-slider');
        if (slider) {
            slider.max = this.trajectoryData.length - 1;
            slider.value = this.currentFrame;
            console.log('Frame slider updated');
        } else {
            console.error('Frame slider not found');
        }
        
        // Update total frames display
        const totalFrames = document.getElementById('total-frames');
        if (totalFrames) {
            totalFrames.textContent = this.trajectoryData.length;
            console.log('Total frames updated');
        } else {
            console.error('Total frames element not found');
        }
        
        // Update current frame display
        const currentFrame = document.getElementById('current-frame');
        if (currentFrame) {
            currentFrame.textContent = this.currentFrame + 1;
            console.log('Current frame updated');
        } else {
            console.error('Current frame element not found');
        }
        
        // Update molecule info
        const moleculeInfo = document.getElementById('molecule-info');
        if (moleculeInfo) {
            moleculeInfo.textContent = `${this.trajectoryData.length} trajectory frames | ${this.excitationData.length} excitation points`;
            console.log('Molecule info updated');
        } else {
            console.error('Molecule info element not found');
        }
    }
    
    // Update the existing clearMolecule method
    clearMolecule() {
        // Remove all atom meshes
        this.atomMeshes.forEach(mesh => {
            this.moleculeGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.atomMeshes = [];
        
        // Remove all bond meshes
        this.bondMeshes.forEach(bondData => {
            this.moleculeGroup.remove(bondData.mesh);
            bondData.mesh.geometry.dispose();
            bondData.mesh.material.dispose();
        });
        this.bondMeshes = [];
        
        // Clear dipole arrows
        this.clearDipoleArrows();
    }

    // Add method to set dipole scale
    setDipoleScale(scale) {
        this.dipoleScale = Math.max(0.1, Math.min(10.0, scale));
        
        // Refresh dipoles if currently shown
        if (this.showDipoles) {
            const currentExcitation = this.getCurrentExcitationData();
            if (currentExcitation) {
                this.createDipoleArrows(currentExcitation);
            }
        }
        
        console.log(`Dipole scale set to: ${this.dipoleScale}`);
    }
    
    showError(message) {
        const errorDiv = document.getElementById('viewer-error');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="error-message">
                    <h3>Viewer Error</h3>
                    <p>${message}</p>
                    <button onclick="window.location.reload()">Reload Page</button>
                </div>
            `;
            errorDiv.style.display = 'block';
        } else {
            console.error('Viewer Error:', message);
            alert('Viewer Error: ' + message);
        }
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
    
    toggleBonds(show) {
        if (!this.bondMeshes) return;
        
        this.bondMeshes.forEach(bondData => {
            bondData.mesh.visible = show;
        });
        
        console.log(`Bonds ${show ? 'shown' : 'hidden'}`);
    }
    
    toggleLabels(show) {
        // TODO: Implement atom labels
        console.log(`Labels ${show ? 'shown' : 'hidden'} (not implemented yet)`);
    }
    
    toggleTrajectory(show) {
        // TODO: Implement trajectory trail
        console.log(`Trajectory trail ${show ? 'shown' : 'hidden'} (not implemented yet)`);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.clearMolecule();
        
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        
        console.log('Molecular Viewer destroyed');
    }
}

// Global viewer instance
let molecularViewer = null;

// Initialize viewer when page loads
document.addEventListener('DOMContentLoaded', function() {
    const viewerContainer = document.getElementById('viewer-container');
    if (viewerContainer) {
        molecularViewer = new MolecularViewer('viewer-container');
        
        // Get session ID from URL or page data
        const sessionId = getSessionId();
        console.log('Session ID found:', sessionId);
        
        if (sessionId) {
            // Hide loading overlay after a delay to show the viewer
            setTimeout(() => {
                const loadingOverlay = document.getElementById('loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            }, 1000);
            
            molecularViewer.loadData(sessionId);
        } else {
            molecularViewer.showError('No session ID found. Please upload files first.');
        }
        
        setupViewerControls();
    } else {
        console.error('Viewer container not found!');
    }
});

function getSessionId() {
    // Try to get session ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    
    if (sessionId) {
        return sessionId;
    }
    
    // Try to get from page meta tag or data attribute
    const metaSession = document.querySelector('meta[name="session-id"]');
    if (metaSession) {
        return metaSession.content;
    }
    
    // Try to get from global variable
    if (typeof window.sessionId !== 'undefined') {
        return window.sessionId;
    }
    
    return null;
}

function setupViewerControls() {
    console.log('Setting up viewer controls...');
    
    // Play/Pause button
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', function() {
            if (molecularViewer.isPlaying) {
                molecularViewer.pause();
            } else {
                molecularViewer.play();
            }
        });
        console.log('Play button connected');
    } else {
        console.error('Play button not found');
    }
    
    // Previous/Next frame buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => molecularViewer.previousFrame());
        console.log('Previous button connected');
    } else {
        console.error('Previous button not found');
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => molecularViewer.nextFrame());
        console.log('Next button connected');
    } else {
        console.error('Next button not found');
    }
    
    // Frame slider
    const frameSlider = document.getElementById('frame-slider');
    if (frameSlider) {
        frameSlider.addEventListener('input', function() {
            const frameIndex = parseInt(this.value);
            molecularViewer.setFrame(frameIndex);
        });
        console.log('Frame slider connected');
    } else {
        console.error('Frame slider not found');
    }
    
    // Speed control
    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
        speedSlider.addEventListener('input', function() {
            const speed = parseFloat(this.value);
            molecularViewer.setPlaybackSpeed(speed);
            
            const speedDisplay = document.getElementById('speed-display');
            if (speedDisplay) {
                speedDisplay.textContent = `${speed}x`;
            }
        });
        console.log('Speed slider connected');
    } else {
        console.error('Speed slider not found');
    }
    
    // Visualization checkboxes
    const showBondsCheckbox = document.getElementById('show-bonds');
    const showLabelsCheckbox = document.getElementById('show-labels');
    const showTrajectoryCheckbox = document.getElementById('show-trajectory');
    
    if (showBondsCheckbox) {
        showBondsCheckbox.addEventListener('change', function() {
            if (molecularViewer) {
                molecularViewer.toggleBonds(this.checked);
            }
        });
        console.log('Bonds checkbox connected');
    } else {
        console.error('Bonds checkbox not found');
    }
    
    if (showLabelsCheckbox) {
        showLabelsCheckbox.addEventListener('change', function() {
            if (molecularViewer) {
                molecularViewer.toggleLabels(this.checked);
            }
        });
        console.log('Labels checkbox connected');
    } else {
        console.error('Labels checkbox not found');
    }
    
    if (showTrajectoryCheckbox) {
        showTrajectoryCheckbox.addEventListener('change', function() {
            if (molecularViewer) {
                molecularViewer.toggleTrajectory(this.checked);
            }
        });
        console.log('Trajectory checkbox connected');
    } else {
        console.error('Trajectory checkbox not found');
    }
    
    // Background color picker
    const backgroundColorPicker = document.getElementById('background-color');
    if (backgroundColorPicker) {
        backgroundColorPicker.addEventListener('change', function() {
            if (molecularViewer && molecularViewer.scene) {
                molecularViewer.scene.background = new THREE.Color(this.value);
            }
        });
        console.log('Background color picker connected');
    } else {
        console.error('Background color picker not found');
    }
}

function makeDraggable(chart) {
    const header = chart.querySelector('.bg-indigo-600'); // chart header for dragging
    if (!header) return;

    let isDragging = false;
    let currentX, currentY, initialX, initialY;

    header.style.cursor = 'move'; // Optional: change cursor to indicate draggable

    header.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking close

        isDragging = true;
        initialX = e.clientX - chart.offsetLeft;
        initialY = e.clientY - chart.offsetTop;

        document.addEventListener('mousemove', dragChart);
        document.addEventListener('mouseup', stopDragging);
    });

    function dragChart(e) {
        if (!isDragging) return;

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        const maxX = window.innerWidth - chart.offsetWidth;
        const maxY = window.innerHeight - chart.offsetHeight;

        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        chart.style.left = currentX + 'px';
        chart.style.top = currentY + 'px';
        chart.style.right = 'auto';
    }

    function stopDragging() {
        isDragging = false;
        document.removeEventListener('mousemove', dragChart);
        document.removeEventListener('mouseup', stopDragging);
    }
}

// Spectrum chart popup
function showSpectrumChart() {
    const container = document.getElementById('spectrum-floating');
    if (container) {
        container.classList.remove('hidden');

        // Small delay to ensure DOM is ready before rendering chart
        setTimeout(() => {
            if (typeof createSpectrumChart === 'function') {
                createSpectrumChart();
            }
            makeDraggable(container);
        }, 100);
    } else {
        console.error('Spectrum container not found');
    }
}

// Energy chart popup
function showEnergyEvolution() {
    const container = document.getElementById('energy-floating');
    if (container) {
        container.classList.remove('hidden');

        setTimeout(() => {
            if (typeof createEnergyChart === 'function') {
                createEnergyChart();
            }
            makeDraggable(container);
        }, 100);
    } else {
        console.error('Energy container not found');
    }
}

function closeFloatingChart(chartId) {
    const chart = document.getElementById(chartId);
    if (chart) {
        chart.classList.add('hidden');
    } else {
        console.error(`Chart container with ID "${chartId}" not found`);
    }
}

// DMABN Analysis functions
async function runDMABNAnalysis() {
    console.log('runDMABNAnalysis called - starting analysis...');
    
    try {
        // Show loading state
        const runBtn = document.getElementById('run-dmabn-analysis-btn');
        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = 'Running Analysis...';
        }
        
        const response = await fetch('/api/dmabn/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('DMABN analysis completed:', data.analysis_summary);
            alert(`Analysis complete! Analyzed ${data.analysis_summary.successful_frames} frames with ${data.analysis_summary.key_frames_count} key frames identified.`);
            
            // Enable geometry charts
            const geometryBtn = document.getElementById('geometry-timeline-btn');
            if (geometryBtn) {
                geometryBtn.disabled = false;
                geometryBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        } else {
            console.error('Analysis failed:', data.error);
            alert('Analysis failed: ' + data.error);
        }
        
    } catch (error) {
        console.error('DMABN analysis error:', error);
        alert('Analysis failed: ' + error.message);
    } finally {
        // Reset button
        const runBtn = document.getElementById('run-dmabn-analysis-btn');
        if (runBtn) {
            runBtn.disabled = false;
            runBtn.innerHTML = 'Run DMABN Analysis';
        }
    }
}

async function showGeometryTimeline() {
    console.log('showGeometryTimeline called - loading geometry data...');
    
    try {
        // Get session ID
        const sessionId = getSessionId();
        if (!sessionId) {
            alert('No session ID found');
            return;
        }
        
        // Load geometry data from API
        const response = await fetch(`/api/dmabn/data/${sessionId}`, {
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Geometry data loaded:', data.geometry_data.length, 'points');
            
        // Initialize DMABN charts if not already done
        if (typeof window.dmabnCharts === 'undefined') {
            window.dmabnCharts = new DMABNGeometryCharts();
        }

        // Set the data
        window.dmabnCharts.setData(
            data.geometry_data,
            molecularViewer.excitationData,
            data.metadata.key_frames || []
        );
            
            // Show the geometry timeline chart
            showGeometryChart();
            
        } else {
            console.error('Failed to load geometry data:', data.error);
            alert('Failed to load geometry data: ' + data.error);
        }
        
    } catch (error) {
        console.error('Error loading geometry data:', error);
        alert('Error loading geometry data: ' + error.message);
    }
}

function showGeometryChart() {
    // Create chart container if it doesn't exist
    let chartPopup = document.getElementById('geometry-chart-popup');
    if (chartPopup) {
        chartPopup.style.display = 'block';
        return;
    }
    
    chartPopup = document.createElement('div');
    chartPopup.id = 'geometry-chart-popup';
    chartPopup.style.cssText = `
        position: fixed; top: 80px; right: 80px; width: 600px; height: 500px;
        background: white; border: 2px solid #333; border-radius: 8px; z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    
    chartPopup.innerHTML = `
        <div class="bg-indigo-600" style="background: #6366f1; color: white; padding: 10px; border-radius: 6px 6px 0 0; cursor: move;">
            <span>DMABN Oscillator Strength Analysis</span>
            <button onclick="document.getElementById('geometry-chart-popup').style.display='none'" 
                    style="float: right; background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
        </div>
        <div style="padding: 10px; height: 450px;">
            <canvas id="dmabn-geometry-chart" style="width: 100%; height: 100%;"></canvas>
        </div>
    `;
    
    document.body.appendChild(chartPopup);
    
    // Make the chart draggable AFTER it's added to DOM
    makeDraggable(chartPopup);
    
    // Create the actual chart
    setTimeout(() => createDMABNChart(), 100);
}

function createDMABNChart() {
    const canvas = document.getElementById('dmabn-geometry-chart');
    if (!canvas || !window.dmabnCharts || !window.dmabnCharts.geometryData) {
        console.error('Cannot create chart: missing canvas or data');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const geometryData = window.dmabnCharts.geometryData;
    const excitationData = window.dmabnCharts.excitationData;
    
    if (!excitationData || excitationData.length === 0) {
        ctx.fillText('No excitation data available for oscillator strength analysis', 50, 50);
        return;
    }
    
    // Create correlation data by matching time points
    const correlationData = [];
    
    geometryData.forEach(geomFrame => {
        let closestExcitation = null;
        let minTimeDiff = Infinity;
        
        excitationData.forEach(excFrame => {
            const timeDiff = Math.abs(excFrame.time_fs - geomFrame.time_fs);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestExcitation = excFrame;
            }
        });
        
        if (closestExcitation && minTimeDiff < 50 && 
            typeof closestExcitation.s1_oscillator === 'number' && 
            typeof closestExcitation.s2_oscillator === 'number') {
            
            correlationData.push({
                twist_angle: geomFrame.twist_angle,
                ring_planarity: geomFrame.ring_planarity,
                s1_oscillator: closestExcitation.s1_oscillator,
                s2_oscillator: closestExcitation.s2_oscillator,
                time_ps: geomFrame.time_ps,
                time_fs: geomFrame.time_fs,
                frame_number: geomFrame.frame_number,
                s1_dominant: closestExcitation.s1_oscillator > closestExcitation.s2_oscillator
            });
        }
    });
    
    // Create bins for twist angle analysis
    const binSize = 5; // 5 degree bins
    const minTwist = Math.min(...correlationData.map(d => d.twist_angle));
    const maxTwist = Math.max(...correlationData.map(d => d.twist_angle));
    const numBins = Math.ceil((maxTwist - minTwist) / binSize);
    
    const binData = [];
    for (let i = 0; i < numBins; i++) {
        const binStart = minTwist + i * binSize;
        const binEnd = binStart + binSize;
        const binCenter = binStart + binSize / 2;
        
        const pointsInBin = correlationData.filter(d => 
            d.twist_angle >= binStart && d.twist_angle < binEnd
        );
        
        if (pointsInBin.length > 0) {
            const s1DominantCount = pointsInBin.filter(d => d.s1_dominant).length;
            const s2DominantCount = pointsInBin.length - s1DominantCount;
            const s1Percentage = (s1DominantCount / pointsInBin.length) * 100;
            const s2Percentage = (s2DominantCount / pointsInBin.length) * 100;
            
            // Separate S1 and S2 dominant frames
            const s1Examples = pointsInBin.filter(d => d.s1_dominant);
            const s2Examples = pointsInBin.filter(d => !d.s1_dominant);
            
            // Find the best comparison pair (frames with most similar twist angles)
            const comparisonPair = findBestComparisonPair(s1Examples, s2Examples);
            
            binData.push({
                binCenter,
                binRange: `${binStart.toFixed(0)}-${binEnd.toFixed(0)}°`,
                binStart,
                binEnd,
                totalCount: pointsInBin.length,
                s1DominantCount,
                s2DominantCount,
                s1Percentage,
                s2Percentage,
                avgPlanarity: pointsInBin.reduce((sum, d) => sum + d.ring_planarity, 0) / pointsInBin.length,
                exampleS1Frame: comparisonPair.s1Frame ? comparisonPair.s1Frame.frame_number : null,
                exampleS2Frame: comparisonPair.s2Frame ? comparisonPair.s2Frame.frame_number : null,
                s1TwistAngle: comparisonPair.s1Frame ? comparisonPair.s1Frame.twist_angle : null,
                s2TwistAngle: comparisonPair.s2Frame ? comparisonPair.s2Frame.twist_angle : null,
                twistAngleDifference: comparisonPair.twistDifference,
                allFrames: pointsInBin
            });
        }
    }

    // Add this new function to find the best comparison pair
    function findBestComparisonPair(s1Examples, s2Examples) {
        if (s1Examples.length === 0 || s2Examples.length === 0) {
            return {
                s1Frame: s1Examples.length > 0 ? s1Examples[0] : null,
                s2Frame: s2Examples.length > 0 ? s2Examples[0] : null,
                twistDifference: null
            };
        }
        
        // Find the pair with the smallest twist angle difference
        let bestPair = {
            s1Frame: null,
            s2Frame: null,
            twistDifference: Infinity
        };
        
        for (const s1Frame of s1Examples) {
            for (const s2Frame of s2Examples) {
                const twistDiff = Math.abs(s1Frame.twist_angle - s2Frame.twist_angle);
                
                if (twistDiff < bestPair.twistDifference) {
                    bestPair = {
                        s1Frame: s1Frame,
                        s2Frame: s2Frame,
                        twistDifference: twistDiff
                    };
                }
            }
        }
        
        return bestPair;
    }
    
    console.log(`Binned Analysis Results:
        Total points: ${correlationData.length}
        Bins created: ${binData.length}
        Twist angle range: ${minTwist.toFixed(1)}° to ${maxTwist.toFixed(1)}°`);
    
    // Store binData globally for click handling
    window.dmabnCharts.binData = binData;
    
    // Log the binned results
    console.log('\n=== TWIST ANGLE vs OSCILLATOR DOMINANCE ===');
    binData.forEach(bin => {
        console.log(`${bin.binRange}: ${bin.s1Percentage.toFixed(1)}% S1 dominant (${bin.s1DominantCount}/${bin.totalCount} points)`);
    });
    
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binData.map(d => d.binRange),
            datasets: [{
                label: 'S1 > S2 Oscillator',
                data: binData.map(d => d.s1Percentage),
                backgroundColor: 'rgba(231, 76, 60, 0.8)',
                borderColor: '#e74c3c',
                borderWidth: 1
            }, {
                label: 'S2 ≥ S1 Oscillator',
                data: binData.map(d => d.s2Percentage),
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: '#3498db',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'DMABN: Oscillator Strength Dominance vs Twist Angle',
                    font: { size: 16, weight: 'bold' }
                },
                subtitle: {
                    display: true,
                    text: `Analysis of ${correlationData.length} geometry-excitation pairs. Click bars to view example geometries.`,
                    font: { size: 12 }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            const bin = binData[index];
                            return `Twist Angle: ${bin.binRange}`;
                        },
                        label: function(context) {
                            const index = context.dataIndex;
                            const bin = binData[index];
                            const datasetIndex = context.datasetIndex;
                            
                            if (datasetIndex === 0) {
                                // S1 dataset
                                return [
                                    `S1 dominant: ${bin.s1DominantCount}/${bin.totalCount} points (${bin.s1Percentage.toFixed(1)}%)`,
                                    `Avg planarity: ${bin.avgPlanarity.toFixed(3)}`,
                                    bin.exampleS1Frame !== null ? `Example frame: ${bin.exampleS1Frame}` : 'No S1 examples'
                                ];
                            } else {
                                // S2 dataset
                                return [
                                    `S2 dominant: ${bin.s2DominantCount}/${bin.totalCount} points (${bin.s2Percentage.toFixed(1)}%)`,
                                    `Avg planarity: ${bin.avgPlanarity.toFixed(3)}`,
                                    bin.exampleS2Frame !== null ? `Example frame: ${bin.exampleS2Frame}` : 'No S2 examples'
                                ];
                            }
                        },
                        footer: function(context) {
                            return 'Click to view example geometry!';
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Twist Angle Range (degrees)',
                        font: { size: 14 }
                    },
                    stacked: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Percentage of Geometries',
                        font: { size: 14 }
                    },
                    stacked: true,
                    min: 0,
                    max: 100
                }
            },
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const datasetIndex = elements[0].datasetIndex;
                    const bin = binData[index];
                    handleBarClick(bin, datasetIndex);
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Make the chart draggable
    makeDraggable(document.getElementById('geometry-chart-popup'));
    
    // Calculate and log overall statistics
    const s1DominantTotal = correlationData.filter(d => d.s1_dominant).length;
    const s2DominantTotal = correlationData.length - s1DominantTotal;
    
    console.log(`\n📊 OVERALL STATISTICS:
        S1 > S2 oscillator: ${s1DominantTotal} points (${(s1DominantTotal/correlationData.length*100).toFixed(1)}%)
        S2 ≥ S1 oscillator: ${s2DominantTotal} points (${(s2DominantTotal/correlationData.length*100).toFixed(1)}%)`);
    
    // Find the twist angle ranges where each state dominates
    const s1DominantBins = binData.filter(bin => bin.s1Percentage > 50);
    const s2DominantBins = binData.filter(bin => bin.s2Percentage > 50);
    
    if (s1DominantBins.length > 0) {
        console.log(`\n🔴 S1 DOMINANT TWIST RANGES: ${s1DominantBins.map(bin => bin.binRange).join(', ')}`);
        s1DominantBins.forEach(bin => {
            console.log(`  ${bin.binRange}: ${bin.s1Percentage.toFixed(1)}% S1 dominant (${bin.s1DominantCount}/${bin.totalCount} points)`);
        });
    }
    if (s2DominantBins.length > 0) {
        console.log(`🔵 S2 DOMINANT TWIST RANGES: ${s2DominantBins.map(bin => bin.binRange).join(', ')}`);
        s2DominantBins.forEach(bin => {
            console.log(`  ${bin.binRange}: ${bin.s2Percentage.toFixed(1)}% S2 dominant (${bin.s2DominantCount}/${bin.totalCount} points)`);
        });
    }
    
    console.log('\nDMABN oscillator strength analysis complete!');
}

// to enable geometry comparison in stacked bar chart
function handleBarClick(bin, datasetIndex) {
    console.log(`\n🖱️ CLICKED BAR: ${bin.binRange} (Dataset: ${datasetIndex === 0 ? 'S1' : 'S2'})`);
    console.log(`Bin details:
        Total frames: ${bin.totalCount}
        S1 dominant: ${bin.s1DominantCount} (${bin.s1Percentage.toFixed(1)}%)
        S2 dominant: ${bin.s2DominantCount} (${bin.s2Percentage.toFixed(1)}%)
        Average planarity: ${bin.avgPlanarity.toFixed(3)}`);
    
    // Store comparison data globally for the UI
    window.geometryComparison = {
        bin: bin,
        s1Frame: bin.exampleS1Frame,
        s2Frame: bin.exampleS2Frame,
        currentType: datasetIndex === 0 ? 'S1' : 'S2'
    };
    
    // Determine which frame to show initially
    let targetFrame = null;
    let frameType = '';
    
    if (datasetIndex === 0 && bin.exampleS1Frame !== null) {
        targetFrame = bin.exampleS1Frame;
        frameType = 'S1 dominant';
    } else if (datasetIndex === 1 && bin.exampleS2Frame !== null) {
        targetFrame = bin.exampleS2Frame;
        frameType = 'S2 dominant';
    } else {
        // Fallback
        if (bin.exampleS1Frame !== null) {
            targetFrame = bin.exampleS1Frame;
            frameType = 'S1 dominant (fallback)';
        } else if (bin.exampleS2Frame !== null) {
            targetFrame = bin.exampleS2Frame;
            frameType = 'S2 dominant (fallback)';
        }
    }
    
    if (targetFrame !== null && molecularViewer) {
        console.log(`Loading frame ${targetFrame} (${frameType}) from twist range ${bin.binRange}`);
        
        // Jump to the selected frame (normal method for initial load)
        molecularViewer.setFrame(targetFrame);
        
        // Pause playback
        if (molecularViewer.isPlaying) {
            molecularViewer.pause();
        }
        
        // Save the camera state after user has potentially adjusted the view
        setTimeout(() => {
            if (molecularViewer.saveCameraState) {
                molecularViewer.saveCameraState();
            }
        }, 500); // Give user a moment to adjust view if needed
        
        // Show enhanced comparison notification
        showGeometryComparisonNotification(bin);
        
        // Log frame details
        const frameData = bin.allFrames.find(f => f.frame_number === targetFrame);
        if (frameData) {
            console.log(`Frame ${targetFrame} details:
                Twist angle: ${frameData.twist_angle.toFixed(2)}°
                Ring planarity: ${frameData.ring_planarity.toFixed(4)}
                S1 oscillator: ${frameData.s1_oscillator.toFixed(4)}
                S2 oscillator: ${frameData.s2_oscillator.toFixed(4)}
                S1/S2 ratio: ${(frameData.s1_oscillator / frameData.s2_oscillator).toFixed(3)}
                Time: ${frameData.time_ps.toFixed(2)} ps`);
        }
        
    } else {
        console.log(`No example frames available for ${datasetIndex === 0 ? 'S1' : 'S2'} in twist range ${bin.binRange}`);
        alert(`No ${datasetIndex === 0 ? 'S1' : 'S2'} example frames available for twist range ${bin.binRange}`);
    }
}

// Update the comparison notification to show twist angle info
function showGeometryComparisonNotification(bin) {
    // Remove existing notification
    const existingNotification = document.getElementById('geometry-comparison-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create comparison notification
    const notification = document.createElement('div');
    notification.id = 'geometry-comparison-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: #4F46E5;
        color: white;
        padding: 16px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        max-width: 350px;
        min-width: 300px;
    `;
    
    const hasS1Example = bin.exampleS1Frame !== null;
    const hasS2Example = bin.exampleS2Frame !== null;
    const canCompare = hasS1Example && hasS2Example;
    
    notification.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 8px;">
            🔬 Geometry Comparison: ${bin.binRange}
        </div>
        
        <div style="margin-bottom: 12px; font-size: 12px; line-height: 1.4;">
            <div><strong>Total frames:</strong> ${bin.totalCount}</div>
            <div><strong>S1 dominant:</strong> ${bin.s1DominantCount} (${bin.s1Percentage.toFixed(1)}%)</div>
            <div><strong>S2 dominant:</strong> ${bin.s2DominantCount} (${bin.s2Percentage.toFixed(1)}%)</div>
            ${canCompare && bin.twistAngleDifference !== null ? 
                `<div><strong>Twist diff:</strong> ${bin.twistAngleDifference.toFixed(2)}°</div>` : ''}
        </div>
        
        ${canCompare ? `
        <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; margin-bottom: 8px;">Compare Geometries:</div>
            <div style="display: flex; gap: 8px;">
                <button onclick="loadComparisonFrame('S1')" 
                        id="s1-comparison-btn"
                        style="flex: 1; padding: 6px 12px; font-size: 11px; background: rgba(231, 76, 60, 0.8); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    S1 Dominant<br>
                    <small>Frame ${bin.exampleS1Frame}</small><br>
                    <small>${bin.s1TwistAngle ? bin.s1TwistAngle.toFixed(1) + '°' : ''}</small>
                </button>
                <button onclick="loadComparisonFrame('S2')" 
                        id="s2-comparison-btn"
                        style="flex: 1; padding: 6px 12px; font-size: 11px; background: rgba(52, 152, 219, 0.8); color: white; border: none; border-radius: 4px; cursor: pointer;">
                    S2 Dominant<br>
                    <small>Frame ${bin.exampleS2Frame}</small><br>
                    <small>${bin.s2TwistAngle ? bin.s2TwistAngle.toFixed(1) + '°' : ''}</small>
                </button>
            </div>
        </div>
        ` : `
        <div style="margin-bottom: 12px; font-size: 12px; color: #FFD700;">
            Only ${hasS1Example ? 'S1' : 'S2'} example available in this range
        </div>
        `}
        
        <div style="display: flex; gap: 8px; align-items: center;">
            <button onclick="toggleDipolesFromNotification()" 
                    id="dipole-toggle-btn"
                    style="flex: 1; padding: 6px 12px; font-size: 12px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer;">
                ${molecularViewer.showDipoles ? 'Hide' : 'Show'} Dipoles
            </button>
            <button onclick="closeGeometryComparison()" 
                    style="padding: 6px 8px; font-size: 14px; background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 4px; cursor: pointer;">
                ✕
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Update button states
    updateComparisonButtonStates();
}

// Function to load specific comparison frame
function loadComparisonFrame(type) {
    if (!window.geometryComparison) return;
    
    const bin = window.geometryComparison.bin;
    let targetFrame = null;
    let frameType = '';
    
    if (type === 'S1' && bin.exampleS1Frame !== null) {
        targetFrame = bin.exampleS1Frame;
        frameType = 'S1 dominant';
        window.geometryComparison.currentType = 'S1';
    } else if (type === 'S2' && bin.exampleS2Frame !== null) {
        targetFrame = bin.exampleS2Frame;
        frameType = 'S2 dominant';
        window.geometryComparison.currentType = 'S2';
    }
    
    if (targetFrame !== null && molecularViewer) {
        console.log(`🔄 Switching to ${frameType} geometry (Frame ${targetFrame}) with fixed camera`);
        
        // Use the camera-preserving frame change method
        molecularViewer.setFrameWithFixedCamera(targetFrame);
        
        // Update button states
        updateComparisonButtonStates();
        
        // Show brief feedback
        showComparisonFeedback(frameType, targetFrame);
    }
}

// Update button states to show which geometry is currently loaded
function updateComparisonButtonStates() {
    if (!window.geometryComparison) return;
    
    const s1Btn = document.getElementById('s1-comparison-btn');
    const s2Btn = document.getElementById('s2-comparison-btn');
    
    if (s1Btn && s2Btn) {
        // Reset both buttons
        s1Btn.style.background = 'rgba(231, 76, 60, 0.8)';
        s2Btn.style.background = 'rgba(52, 152, 219, 0.8)';
        s1Btn.style.fontWeight = 'normal';
        s2Btn.style.fontWeight = 'normal';
        
        // Highlight current
        if (window.geometryComparison.currentType === 'S1') {
            s1Btn.style.background = 'rgba(231, 76, 60, 1.0)';
            s1Btn.style.fontWeight = 'bold';
        } else if (window.geometryComparison.currentType === 'S2') {
            s2Btn.style.background = 'rgba(52, 152, 219, 1.0)';
            s2Btn.style.fontWeight = 'bold';
        }
    }
}

// Brief feedback when switching frames
function showComparisonFeedback(frameType, frameNumber) {
    // Create or update feedback
    let feedback = document.getElementById('comparison-feedback');
    if (!feedback) {
        feedback = document.createElement('div');
        feedback.id = 'comparison-feedback';
        feedback.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10001;
            font-size: 14px;
            font-weight: bold;
            pointer-events: none;
        `;
        document.body.appendChild(feedback);
    }
    
    feedback.textContent = `${frameType} (Frame ${frameNumber})`;
    feedback.style.display = 'block';
    
    // Auto-hide after 1.5 seconds
    setTimeout(() => {
        if (feedback) {
            feedback.style.display = 'none';
        }
    }, 1500);
}

// Toggle dipoles from the notification
function toggleDipolesFromNotification() {
    if (molecularViewer) {
        molecularViewer.toggleDipoles(!molecularViewer.showDipoles);
        
        // Update button text
        const btn = document.getElementById('dipole-toggle-btn');
        if (btn) {
            btn.textContent = molecularViewer.showDipoles ? 'Hide Dipoles' : 'Show Dipoles';
        }
    }
}

// Close comparison notification
function closeGeometryComparison() {
    const notification = document.getElementById('geometry-comparison-notification');
    if (notification) {
        notification.remove();
    }
    
    const feedback = document.getElementById('comparison-feedback');
    if (feedback) {
        feedback.remove();
    }
    
    // Clear global comparison data
    window.geometryComparison = null;
}

// Make functions globally available
window.loadComparisonFrame = loadComparisonFrame;
window.toggleDipolesFromNotification = toggleDipolesFromNotification;
window.closeGeometryComparison = closeGeometryComparison;

function showFrameNotification(frameNumber, twistRange, frameType) {
    // Create or update notification
    let notification = document.getElementById('frame-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'frame-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4F46E5;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-width: 300px;
        `;
        document.body.appendChild(notification);
    }
    
    notification.innerHTML = `
        <div style="font-weight: bold;">Frame Loaded</div>
        <div>Frame: ${frameNumber}</div>
        <div>Twist Range: ${twistRange}</div>
        <div>Type: ${frameType}</div>
    `;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        if (notification && notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Simple DMABN Charts class
class DMABNGeometryCharts {
    constructor() {
        this.geometryData = null;
        this.excitationData = null;
        this.keyFrames = [];
        console.log('DMABNGeometryCharts initialized');
    }
    
    setData(geometryData, excitationData, keyFrames = []) {
        this.geometryData = geometryData;
        this.excitationData = excitationData;
        this.keyFrames = keyFrames;
        console.log('DMABN data set:', {
            geometry_points: geometryData ? geometryData.length : 0,
            excitation_points: excitationData ? excitationData.length : 0,
            key_frames: keyFrames.length
        });
    }
}


// Global export
window.showSpectrumChart = showSpectrumChart;
window.showEnergyEvolution = showEnergyEvolution;
window.closeFloatingChart = closeFloatingChart;
window.runDMABNAnalysis = runDMABNAnalysis;
window.showGeometryTimeline = showGeometryTimeline;
window.DMABNGeometryCharts = DMABNGeometryCharts;
window.MolecularViewer = MolecularViewer;

