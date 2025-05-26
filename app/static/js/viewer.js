// app/static/js/viewer.js - 3D Molecular Viewer
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
    
    setupMouseControls() {
        let isMouseDown = false;
        let mouseX = 0;
        let mouseY = 0;
        
        this.container.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.container.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            this.moleculeGroup.rotation.y += deltaX * 0.01;
            this.moleculeGroup.rotation.x += deltaY * 0.01;
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        this.container.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        this.container.addEventListener('wheel', (event) => {
            event.preventDefault();
            const scale = event.deltaY > 0 ? 0.9 : 1.1;
            this.camera.position.multiplyScalar(scale);
        }, { passive: false });
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
            
            if (!data.success && data.error) {
                throw new Error(data.error);
            }
            
            // Check if we have trajectory data
            if (!data.trajectory || !Array.isArray(data.trajectory) || data.trajectory.length === 0) {
                throw new Error('No trajectory data found in response');
            }
            
            this.trajectoryData = data.trajectory;
            this.excitationData = data.excitation || [];
            
            console.log(`✅ Loaded ${this.trajectoryData.length} trajectory frames`);
            console.log(`✅ Loaded ${this.excitationData.length} excitation points`);
            
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
            
            return true;
        } catch (error) {
            console.error('❌ Error loading data:', error);
            console.error('❌ Error details:', {
                sessionId: sessionId,
                url: `/api/data/${sessionId}`,
                error: error.message
            });
            this.showError('Failed to load molecular data: ' + error.message);
            return false;
        }
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
        
        console.log(`Created molecule with ${atoms.length} atoms and ${this.bondMeshes.length} bonds`);
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
    
    updateFrame(frameIndex) {
        if (!this.trajectoryData || frameIndex >= this.trajectoryData.length) {
            return;
        }
        
        this.currentFrame = frameIndex;
        const frame = this.trajectoryData[frameIndex];
        const coords = frame.coords;
        
        // Update atom positions
        this.atomMeshes.forEach((mesh, index) => {
            if (coords[index]) {
                mesh.position.set(coords[index][0], coords[index][1], coords[index][2]);
            }
        });
        
        // Update bond positions
        this.bondMeshes.forEach(bondData => {
            const [i, j] = bondData.atomIndices;
            if (coords[i] && coords[j]) {
                this.updateBondPosition(bondData.mesh, coords[i], coords[j]);
            }
        });
        
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
        
        if (frameInfo) {
            const timeFs = frame.time_fs || (this.currentFrame * 0.5);
            const timePs = timeFs / 1000.0;
            
            frameInfo.innerHTML = `
                <div class="frame-details">
                    <span><strong>Frame:</strong> ${this.currentFrame + 1}/${this.trajectoryData.length}</span>
                    <span><strong>Time:</strong> ${timeFs.toFixed(1)} fs (${timePs.toFixed(3)} ps)</span>
                </div>
            `;
            
            // Update excitation data if available
            this.updateExcitationInfo(timeFs);
        } else {
            console.error('❌ frame-info element not found in DOM');
        }
    }
    
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
        console.log('excitationInfo element:', excitationInfo); // Debug log
        console.log('closestExcitation:', closestExcitation); // Debug log
        
        if (excitationInfo && closestExcitation && minTimeDiff < 100) { // Within 100 fs
            excitationInfo.innerHTML = `
                <div class="excitation-details">
                    <h4>Excitation Data</h4>
                    <div class="excitation-states">
                        <div class="state s1">
                            <span><strong>S1:</strong> ${closestExcitation.s1_energy.toFixed(3)} eV</span>
                            <span><strong>f:</strong> ${closestExcitation.s1_oscillator.toFixed(4)}</span>
                        </div>
                        <div class="state s2">
                            <span><strong>S2:</strong> ${closestExcitation.s2_energy.toFixed(3)} eV</span>
                            <span><strong>f:</strong> ${closestExcitation.s2_oscillator.toFixed(4)}</span>
                        </div>
                    </div>
                </div>
            `;
        } else if (excitationInfo) {
            excitationInfo.innerHTML = '<div class="no-excitation">No excitation data for this frame</div>';
        } else {
            console.error('❌ excitation-info element not found in DOM');
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
            console.log('✅ Frame slider updated');
        } else {
            console.error('❌ Frame slider not found');
        }
        
        // Update total frames display
        const totalFrames = document.getElementById('total-frames');
        if (totalFrames) {
            totalFrames.textContent = this.trajectoryData.length;
            console.log('✅ Total frames updated');
        } else {
            console.error('❌ Total frames element not found');
        }
        
        // Update current frame display
        const currentFrame = document.getElementById('current-frame');
        if (currentFrame) {
            currentFrame.textContent = this.currentFrame + 1;
            console.log('✅ Current frame updated');
        } else {
            console.error('❌ Current frame element not found');
        }
        
        // Update molecule info
        const moleculeInfo = document.getElementById('molecule-info');
        if (moleculeInfo) {
            moleculeInfo.textContent = `${this.trajectoryData.length} trajectory frames | ${this.excitationData.length} excitation points`;
            console.log('✅ Molecule info updated');
        } else {
            console.error('❌ Molecule info element not found');
        }
    }
    
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
    }
    
    showError(message) {
        const errorDiv = document.getElementById('viewer-error');
        if (errorDiv) {
            errorDiv.innerHTML = `
                <div class="error-message">
                    <h3>❌ Viewer Error</h3>
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
        console.error('❌ Viewer container not found!');
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
        console.log('✅ Play button connected');
    } else {
        console.error('❌ Play button not found');
    }
    
    // Previous/Next frame buttons
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => molecularViewer.previousFrame());
        console.log('✅ Previous button connected');
    } else {
        console.error('❌ Previous button not found');
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => molecularViewer.nextFrame());
        console.log('✅ Next button connected');
    } else {
        console.error('❌ Next button not found');
    }
    
    // Frame slider
    const frameSlider = document.getElementById('frame-slider');
    if (frameSlider) {
        frameSlider.addEventListener('input', function() {
            const frameIndex = parseInt(this.value);
            molecularViewer.setFrame(frameIndex);
        });
        console.log('✅ Frame slider connected');
    } else {
        console.error('❌ Frame slider not found');
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
        console.log('✅ Speed slider connected');
    } else {
        console.error('❌ Speed slider not found');
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
        console.log('✅ Bonds checkbox connected');
    } else {
        console.error('❌ Bonds checkbox not found');
    }
    
    if (showLabelsCheckbox) {
        showLabelsCheckbox.addEventListener('change', function() {
            if (molecularViewer) {
                molecularViewer.toggleLabels(this.checked);
            }
        });
        console.log('✅ Labels checkbox connected');
    } else {
        console.error('❌ Labels checkbox not found');
    }
    
    if (showTrajectoryCheckbox) {
        showTrajectoryCheckbox.addEventListener('change', function() {
            if (molecularViewer) {
                molecularViewer.toggleTrajectory(this.checked);
            }
        });
        console.log('✅ Trajectory checkbox connected');
    } else {
        console.error('❌ Trajectory checkbox not found');
    }
    
    // Background color picker
    const backgroundColorPicker = document.getElementById('background-color');
    if (backgroundColorPicker) {
        backgroundColorPicker.addEventListener('change', function() {
            if (molecularViewer && molecularViewer.scene) {
                molecularViewer.scene.background = new THREE.Color(this.value);
            }
        });
        console.log('✅ Background color picker connected');
    } else {
        console.error('❌ Background color picker not found');
    }
}

// Export for global access
window.MolecularViewer = MolecularViewer;