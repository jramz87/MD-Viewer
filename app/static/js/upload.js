function initializeUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    // Validate required DOM elements exist
    if (!uploadArea || !fileInput) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Store reference to original file input
    window.originalFileInput = fileInput;
    
    // Drag and drop handlers
    uploadArea.addEventListener('click', (e) => {
        // Only trigger file input if clicking on the upload area itself, not on buttons
        if (e.target === uploadArea || e.target.classList.contains('upload-area-content')) {
            selectMoreFiles();
        }
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('scale-105', 'border-molecular-sage', 'bg-molecular-sage/10');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('scale-105', 'border-molecular-sage', 'bg-molecular-sage/10');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('scale-105', 'border-molecular-sage', 'bg-molecular-sage/10');
        handleFiles(e.dataTransfer.files);
    });
    
    // Attach file input listener once
    attachFileInputListener();
}

function attachFileInputListener() {
    const fileInput = window.originalFileInput || document.getElementById('fileInput');
    if (fileInput) {
        // Remove any existing listeners to prevent duplicates
        fileInput.removeEventListener('change', handleFileInputChange);
        fileInput.addEventListener('change', handleFileInputChange);
        console.log('File input listener attached');
    }
}

function loadExampleData(type) {
    showLoading(`Loading ${type} example data...`);
    
    fetch(`/api/examples/${type}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showSuccess('Example data loaded successfully!');
            setTimeout(() => {
                window.location.href = `/viewer?session=${data.session_id}`;
            }, 1000);
        } else {
            showError(data.error || 'Failed to load example data');
        }
    })
    .catch(error => {
        console.error('Example loading error:', error);
        showError('Failed to load example data');
    })
    .finally(() => {
        hideLoading();
    });
}


function handleFileInputChange(e) {
    console.log('File input changed, files:', e.target.files.length);
    try {
        handleFiles(e.target.files);
        // Clear the input so the same file can be selected again if needed
        e.target.value = '';
    } catch (error) {
        console.error('Error in handleFiles:', error);
        showUploadError('Error processing files: ' + error.message);
    }
}

let selectedFiles = [];

function handleFiles(files) {
    console.log('handleFiles called with', files.length, 'files');
    
    // Store molecule type BEFORE the page content changes
    const moleculeTypeSelect = document.getElementById('molecule-type');
    if (moleculeTypeSelect) {
        window.selectedMoleculeType = moleculeTypeSelect.value;
        console.log('Stored molecule type:', window.selectedMoleculeType);
    }

    if (!files.length) {
        console.log('No files provided');
        return;
    }
    
    try {
        // Add new files to existing ones instead of replacing
        Array.from(files).forEach(newFile => {
            console.log(`Processing new file: ${newFile.name}`);
            
            // Normalize filename for comparison (lowercase and trimmed)
            const normalizedNewName = newFile.name.toLowerCase().trim();
            
            // Check if file already exists (by normalized name), if so replace it
            const existingIndex = selectedFiles.findIndex(f => 
                f.name.toLowerCase().trim() === normalizedNewName
            );
            
            if (existingIndex !== -1) {
                console.log(`Replacing existing file: ${newFile.name}`);
                selectedFiles[existingIndex] = newFile;
            } else {
                console.log(`Adding new file: ${newFile.name}`);
                selectedFiles.push(newFile);
            }
        });
        
        console.log('All selected files:', selectedFiles.map(f => f.name));
        displayFileStatus(selectedFiles);
    } catch (error) {
        console.error('Error in handleFiles:', error);
        showUploadError('Error processing files: ' + error.message);
    }
}

function displayFileStatus(files) {
    console.log('displayFileStatus called with', files.length, 'files');
    
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) {
        console.error('Upload area element not found');
        return;
    }
    
    const requiredFiles = [
        { name: 'coors.xyz', description: 'Trajectory Data', required: true },
        { name: 's1.dat', description: 'S1 Excitation Data', required: false },
        { name: 's2.dat', description: 'S2 Excitation Data', required: false },
        { name: 'fail.dat', description: 'Failed Calculations', required: false }
    ];
    
    // Create a map of uploaded files (normalized names)
    const uploadedFiles = new Map();
    Array.from(files).forEach(file => {
        const normalizedName = file.name.toLowerCase().trim();
        uploadedFiles.set(normalizedName, file);
    });
    
    let hasRequired = false;
    let totalUploaded = 0;
    
    let html = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-molecular-sage/30 mb-6">
            <h3 class="text-lg font-semibold text-white mb-6 flex items-center gap-3">
                <svg class="w-6 h-6 text-molecular-sage" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a2 2 0 114 0 2 2 0 01-4 0zm8-1a1 1 0 100-2 1 1 0 000 2z"></path></svg>
                File Upload Status
            </h3>
            <div class="space-y-4">
    `;
    
    // Required Files Section
    html += `
        <div>
            <h5 class="text-sm font-medium text-molecular-sage-light mb-3">Required Files</h5>
    `;
    
    requiredFiles.filter(f => f.required).forEach(fileInfo => {
        const fileName = fileInfo.name.toLowerCase().trim();
        const isUploaded = uploadedFiles.has(fileName);
        const file = uploadedFiles.get(fileName);
        
        if (isUploaded) {
            totalUploaded++;
            hasRequired = true;
        }
        
        const sizeInfo = isUploaded ? ` - ${(file.size/1024).toFixed(1)} KB` : '';
        
        html += `
            <div class="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-red-500/30">
                <div class="flex items-center gap-3">
                    <div class="group grid size-4 grid-cols-1">
                        <input type="checkbox" disabled ${isUploaded ? 'checked' : ''} class="col-start-1 row-start-1 appearance-none rounded-sm border border-red-400 bg-transparent checked:border-green-500 checked:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500">
                        <svg class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25" viewBox="0 0 14 14" fill="none">
                            <path class="opacity-0 group-has-[:checked]:opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <code class="bg-molecular-charcoal/60 px-3 py-2 rounded-lg font-mono text-sm border border-red-500/40 text-red-200">${fileInfo.name}</code>
                </div>
                <span class="text-gray-300 text-sm">${fileInfo.description}${sizeInfo}</span>
            </div>
        `;
    });
    
    html += `</div>`;
    
    // Optional Files Section
    html += `
        <div>
            <h5 class="text-sm font-medium text-molecular-sage-light mb-3">Optional Files</h5>
            <div class="space-y-2">
    `;
    
    const optionalFiles = requiredFiles.filter(f => !f.required);
    const colorMap = {
        's1.dat': { border: 'border-blue-500/30', code: 'border-blue-500/40 text-blue-200', checkbox: 'border-blue-400' },
        's2.dat': { border: 'border-purple-500/30', code: 'border-purple-500/40 text-purple-200', checkbox: 'border-purple-400' },
        'fail.dat': { border: 'border-orange-500/30', code: 'border-orange-500/40 text-orange-200', checkbox: 'border-orange-400' }
    };
    
    optionalFiles.forEach(fileInfo => {
        const fileName = fileInfo.name.toLowerCase().trim();
        const isUploaded = uploadedFiles.has(fileName);
        const file = uploadedFiles.get(fileName);
        const colors = colorMap[fileInfo.name] || colorMap['fail.dat'];
        
        if (isUploaded) {
            totalUploaded++;
        }
        
        const sizeInfo = isUploaded ? ` - ${(file.size/1024).toFixed(1)} KB` : '';
        
        html += `
            <div class="flex items-center gap-3 p-3 bg-black/20 rounded-lg border ${colors.border}">
                <div class="flex items-center gap-3">
                    <div class="group grid size-4 grid-cols-1">
                        <input type="checkbox" disabled ${isUploaded ? 'checked' : ''} class="col-start-1 row-start-1 appearance-none rounded-sm border ${colors.checkbox} bg-transparent checked:border-green-500 checked:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500">
                        <svg class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-disabled:stroke-gray-950/25" viewBox="0 0 14 14" fill="none">
                            <path class="opacity-0 group-has-[:checked]:opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                    </div>
                    <code class="bg-molecular-charcoal/60 px-3 py-2 rounded-lg font-mono text-sm border ${colors.code}">${fileInfo.name}</code>
                </div>
                <span class="text-gray-300 text-sm">${fileInfo.description}${sizeInfo}</span>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    </div>
    `;
    
    // Summary section
    html += `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-molecular-sage/30 mb-6">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-4">
                    <span class="text-white font-medium">${totalUploaded}/4 files uploaded</span>
    `;
    
    if (hasRequired) {
        html += `
                    <div class="flex items-center gap-2 text-green-300">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                        <span class="text-sm">Required file present</span>
                    </div>
        `;
    } else {
        html += `
                    <div class="flex items-center gap-2 text-yellow-300">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                        <span class="text-sm">Missing required file</span>
                    </div>
        `;
    }
    
    html += `
                </div>
            </div>
            <div class="flex flex-wrap gap-4 justify-center">
    `;
    
    if (hasRequired && totalUploaded > 0) {
        html += `
                <button onclick="event.stopPropagation(); uploadFiles();" class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    Upload & Process Files
                </button>
        `;
    } else {
        html += `
                <button disabled class="bg-gray-500/50 text-gray-400 border-2 border-gray-500/50 px-8 py-3 rounded-lg font-semibold inline-flex items-center gap-2 cursor-not-allowed">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5l-6.928-12C8.818 3.667 7.182 3.667 6.25 4.5l-6.928 12C-.178 17.333.784 19 2.322 19z"></path></svg>
                    Select coors.xyz to continue
                </button>
        `;
    }
    
    html += `
                <button onclick="event.stopPropagation(); selectMoreFiles();" class="bg-white/10 hover:bg-white/20 text-molecular-sage-light hover:text-white border-2 border-molecular-sage/30 hover:border-molecular-sage px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    Select Files
                </button>
                <button onclick="event.stopPropagation(); clearSelectedFiles();" class="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border-2 border-red-500/30 hover:border-red-500/50 px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Clear All Files
                </button>
            </div>
        </div>
    `;
    
    uploadArea.innerHTML = html;
}

function validateFile(file) {
    const allowedExtensions = ['xyz', 'dat', 'txt'];
    const maxSize = 100 * 1024 * 1024; // 100MB
    
    try {
        const ext = file.name.split('.').pop().toLowerCase();
        const hasValidExtension = allowedExtensions.includes(ext);
        const isValidSize = file.size <= maxSize;
        
        // Debug logging
        console.log('File:', file.name);
        console.log('Extension:', ext);
        console.log('Valid extension:', hasValidExtension);
        console.log('Valid size:', isValidSize);
        
        return hasValidExtension && isValidSize;
    } catch (error) {
        console.error('Error validating file:', error);
        return false;
    }
}

function getFileStatus(file) {
    const recognizedFiles = ['coors.xyz', 's1.dat', 's2.dat', 'fail.dat'];
    const requiredFiles = ['coors.xyz'];
    
    try {
        const fileName = file.name.toLowerCase().trim();
        const isRecognized = recognizedFiles.includes(fileName);
        const isRequired = requiredFiles.includes(fileName);
        const isValid = validateFile(file);
        
        // Debug logging
        console.log('Checking file:', fileName);
        console.log('Is recognized:', isRecognized);
        console.log('Recognized files:', recognizedFiles);
        
        return {
            valid: isValid,
            recognized: isRecognized,
            required: isRequired,
            type: getFileType(file.name)
        };
    } catch (error) {
        console.error('Error getting file status:', error);
        return {
            valid: false,
            recognized: false,
            required: false,
            type: 'Unknown'
        };
    }
}

function getFileType(filename) {
    const types = {
        'coors.xyz': 'Trajectory (Required)',
        's1.dat': 'S1 Excitation (Optional)',
        's2.dat': 'S2 Excitation (Optional)', 
        'fail.dat': 'Failed Calculations (Optional)'
    };
    const fileName = filename.toLowerCase().trim();
    console.log('Getting type for:', fileName, 'Result:', types[fileName] || 'Data File');
    return types[fileName] || 'Data File';
}

function clearSelectedFiles() {
    selectedFiles = [];
    console.log('Cleared all selected files');
    
    // Reset to initial upload area
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    // Restore original upload area content
    uploadArea.innerHTML = `
        <div class="mb-6">
            <div class="w-20 h-20 mx-auto bg-molecular-sage/20 rounded-full flex items-center justify-center hover:bg-molecular-sage/40 transition-all duration-500 hover:scale-110 border border-molecular-sage/30">
                <svg class="w-10 h-10 text-molecular-sage hover:text-white transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
        </div>
        
        <h3 class="text-xl font-semibold text-white mb-4 hover:text-molecular-sage-light transition-colors duration-300">
            Upload Your Data Files
        </h3>
        <p class="text-molecular-sage-light mb-8 hover:text-white transition-colors duration-300">
            Drop your files here or click to select
        </p>
        
        <button class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2" onclick="document.getElementById('fileInput').click()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            Choose Files
        </button>
    `;
}

// Safe function to trigger file input
function selectMoreFiles() {
    console.log('selectMoreFiles called');
    const fileInput = window.originalFileInput || document.getElementById('fileInput');
    if (fileInput) {
        console.log('Triggering file input click');
        fileInput.click();
    } else {
        console.error('File input element not found');
        // Try to recreate the file input if it doesn't exist
        recreateFileInput();
    }
}

function recreateFileInput() {
    console.log('Recreating file input');
    const body = document.body;
    const newFileInput = document.createElement('input');
    newFileInput.type = 'file';
    newFileInput.id = 'fileInput';
    newFileInput.multiple = true;
    newFileInput.accept = '.xyz,.dat,.txt';
    newFileInput.style.display = 'none';
    
    body.appendChild(newFileInput);
    window.originalFileInput = newFileInput;
    attachFileInputListener();
    
    // Trigger the click
    newFileInput.click();
}

// Loading state management functions
function showLoading(message = 'Loading...') {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.innerHTML = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-molecular-sage/30 text-center">
            <div class="w-16 h-16 mx-auto mb-4 border-4 border-molecular-sage border-t-transparent rounded-full animate-spin"></div>
            <h3 class="text-xl font-semibold text-white mb-2">${message}</h3>
            <p class="text-molecular-sage-light">Please wait...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading is hidden when displayFileStatus is called or when showing results
    console.log('Loading hidden');
}

function uploadFiles() {
    if (!selectedFiles.length) {
        showUploadError('No files selected');
        return;
    }
    
    showLoading('Uploading files...');
    
    try {
        const formData = new FormData();
        let validFileCount = 0;
        
        selectedFiles.forEach(file => {
            if (validateFile(file)) {
                formData.append('files', file);
                validFileCount++;
            } else {
                console.warn(`Skipping invalid file: ${file.name}`);
            }
        });
        
        if (validFileCount === 0) {
            hideLoading();
            showUploadError('No valid files to upload');
            return;
        }

        // Get molecule type from dropdown
        const moleculeTypeSelect = document.getElementById('molecule-type');
        const moleculeType = window.selectedMoleculeType || 'generic';
        formData.append('molecule_type', moleculeType);
        console.log('Adding molecule type to upload:', moleculeType);
        
        // Set up fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin',
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showUploadSuccess(data);
                // Add delay before processing to ensure server is ready
                setTimeout(() => processFiles(), 1000);
            } else {
                hideLoading();
                showUploadError(data.error || 'Upload failed');
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            hideLoading();
            console.error('Upload error:', error);
            
            if (error.name === 'AbortError') {
                showUploadError('Upload timed out. Please try again.');
            } else {
                showUploadError('Upload failed: ' + error.message);
            }
        });
        
    } catch (error) {
        hideLoading();
        console.error('Upload preparation error:', error);
        showUploadError('Error preparing upload: ' + error.message);
    }
}

function processFiles() {
    showLoading('Processing data...');
    
    try {
        // Set up fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for processing
        
        fetch('/api/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            hideLoading();
            if (data.success) {
                showProcessSuccess(data);
            } else {
                showUploadError(data.error || 'Processing failed');
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            hideLoading();
            console.error('Processing error:', error);
            
            if (error.name === 'AbortError') {
                showUploadError('Processing timed out. Please try again.');
            } else {
                showUploadError('Processing failed: ' + error.message);
            }
        });
        
    } catch (error) {
        hideLoading();
        console.error('Processing preparation error:', error);
        showUploadError('Error starting processing: ' + error.message);
    }
}

function showUploadSuccess(data) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.innerHTML = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-green-500/30 text-center">
            <div class="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/40">
                <svg class="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Upload Successful!</h3>
            <p class="text-molecular-sage-light mb-4">Processing your data...</p>
            <div class="w-8 h-8 mx-auto border-2 border-molecular-sage border-t-transparent rounded-full animate-spin"></div>
        </div>
    `;
}

function showProcessSuccess(data) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    console.log('Processing success data:', data);
    
    uploadArea.innerHTML = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-green-500/30 text-center">
            <div class="w-16 h-16 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/40">
                <svg class="w-8 h-8 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-4">Processing Complete!</h3>
            <div class="space-y-3 mb-6">
                <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <span class="text-molecular-sage-light">Trajectory frames:</span>
                    <span class="text-white font-medium">${data.trajectory_frames || 'N/A'}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <span class="text-molecular-sage-light">Excitation points:</span>
                    <span class="text-white font-medium">${data.excitation_points || 'N/A'}</span>
                </div>
            </div>
            <div class="flex flex-wrap gap-4 justify-center">
                <button onclick="openViewer()" class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    Open 3D Viewer
                </button>
                <button onclick="location.reload()" class="bg-white/10 hover:bg-white/20 text-molecular-sage-light hover:text-white border-2 border-molecular-sage/30 hover:border-molecular-sage px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Upload New Files
                </button>
            </div>
        </div>
    `;
}

function openViewer() {
    console.log('Opening 3D viewer...');
    
    // First check if the viewer endpoint exists
    fetch('/viewer', {
        method: 'HEAD',
        credentials: 'same-origin'
    })
    .then(response => {
        console.log('Viewer endpoint check:', response.status);
        if (response.ok) {
            // Open in new tab
            const viewerWindow = window.open('/viewer', '_blank');
            
            // Check if popup was blocked
            if (!viewerWindow || viewerWindow.closed || typeof viewerWindow.closed == 'undefined') {
                showViewerError('Popup blocked. Please allow popups and try again, or <a href="/viewer" target="_blank" class="text-molecular-sage hover:text-molecular-sage-light underline">click here to open viewer</a>');
            } else {
                // Monitor if the window loaded successfully
                setTimeout(() => {
                    try {
                        if (viewerWindow.closed) {
                            console.log('Viewer window was closed');
                        }
                    } catch (e) {
                        console.log('Cannot access viewer window (likely due to cross-origin)');
                    }
                }, 1000);
            }
        } else {
            throw new Error(`Viewer not available (HTTP ${response.status})`);
        }
    })
    .catch(error => {
        console.error('Error opening viewer:', error);
        showViewerError(`Failed to open 3D viewer: ${error.message}. <a href="/viewer" target="_blank" class="text-molecular-sage hover:text-molecular-sage-light underline">Try direct link</a>`);
    });
}

function showViewerError(errorMessage) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.innerHTML = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-yellow-500/30 text-center">
            <div class="w-16 h-16 mx-auto mb-6 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/40">
                <svg class="w-8 h-8 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-4">Viewer Issue</h3>
            <div class="text-gray-300 mb-6">
                <p>${errorMessage}</p>
            </div>
            <div class="flex flex-wrap gap-4 justify-center">
                <button onclick="window.open('/viewer', '_blank')" class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    Try Direct Link
                </button>
                <button onclick="checkServerStatus()" class="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 border-2 border-blue-500/30 hover:border-blue-500/50 px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Check Server Status
                </button>
                <button onclick="location.reload()" class="bg-white/10 hover:bg-white/20 text-molecular-sage-light hover:text-white border-2 border-molecular-sage/30 hover:border-molecular-sage px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Reload Page
                </button>
            </div>
        </div>
    `;
}

function checkServerStatus() {
    showLoading('Checking server status...');
    
    Promise.all([
        fetch('/api/status', { credentials: 'same-origin' }).catch(e => ({ error: e.message })),
        fetch('/viewer', { method: 'HEAD', credentials: 'same-origin' }).catch(e => ({ error: e.message })),
        fetch('/api/process', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ check: true }),
            credentials: 'same-origin' 
        }).catch(e => ({ error: e.message }))
    ])
    .then(results => {
        const [statusResult, viewerResult, processResult] = results;
        
        let statusReport = `
            <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-molecular-sage/30">
                <h3 class="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                    <svg class="w-6 h-6 text-molecular-sage" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    Server Status Report
                </h3>
                <div class="space-y-3">
        `;
        
        // API Status
        if (statusResult.error) {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-red-300">API Status</div>
                        <div class="text-sm text-red-400">${statusResult.error}</div>
                    </div>
                </div>
            `;
        } else {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-green-300">API Status</div>
                        <div class="text-sm text-green-400">OK (${statusResult.status})</div>
                    </div>
                </div>
            `;
        }
        
        // Viewer Status
        if (viewerResult.error) {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-red-300">Viewer</div>
                        <div class="text-sm text-red-400">${viewerResult.error}</div>
                    </div>
                </div>
            `;
        } else {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-green-300">Viewer</div>
                        <div class="text-sm text-green-400">Available (${viewerResult.status})</div>
                    </div>
                </div>
            `;
        }
        
        // Process Status
        if (processResult.error) {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                    <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-red-300">Processing</div>
                        <div class="text-sm text-red-400">${processResult.error}</div>
                    </div>
                </div>
            `;
        } else {
            statusReport += `
                <div class="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                    <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                    <div>
                        <div class="font-medium text-green-300">Processing</div>
                        <div class="text-sm text-green-400">OK</div>
                    </div>
                </div>
            `;
        }
        
        statusReport += `
                </div>
                <div class="mt-6 text-center">
                    <button onclick="location.reload()" class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        Reload & Try Again
                    </button>
                </div>
            </div>
        `;
        
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.innerHTML = statusReport;
        }
    })
    .catch(error => {
        hideLoading();
        showUploadError('Failed to check server status: ' + error.message);
    });
}

function showUploadError(error) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) {
        console.error('Cannot show error - upload area not found:', error);
        return;
    }
    
    uploadArea.innerHTML = `
        <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-red-500/30 text-center">
            <div class="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/40">
                <svg class="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-4">Error</h3>
            <div class="text-gray-300 mb-6">
                <p><strong>Error:</strong> ${error}</p>
            </div>
            <div class="flex flex-wrap gap-4 justify-center">
                <button onclick="location.reload()" class="bg-molecular-sage hover:bg-molecular-gray text-white border-2 border-molecular-sage hover:border-molecular-gray px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Try Again
                </button>
                <button onclick="clearSelectedFiles()" class="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-blue-200 border-2 border-blue-500/30 hover:border-blue-500/50 px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-xl inline-flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    Select Different Files
                </button>
            </div>
        </div>
    `;
}