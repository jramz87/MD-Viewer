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
        uploadArea.style.borderColor = '#4CAF50';
        uploadArea.style.background = 'rgba(76, 175, 80, 0.1)';
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        uploadArea.style.background = 'transparent';
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        uploadArea.style.background = 'transparent';
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
    
    let html = '<h3>File Upload Status</h3><div class="file-status-grid">';
    
    let hasRequired = false;
    let totalUploaded = 0;
    
    requiredFiles.forEach(fileInfo => {
        const fileName = fileInfo.name.toLowerCase().trim();
        const isUploaded = uploadedFiles.has(fileName);
        const file = uploadedFiles.get(fileName);
        
        if (isUploaded) {
            totalUploaded++;
            if (fileInfo.required) hasRequired = true;
        }
        
        const statusIcon = isUploaded ? '✅' : '❌';
        const statusClass = isUploaded ? 'file-uploaded' : 'file-missing';
        const requiredLabel = fileInfo.required ? ' (Required)' : ' (Optional)';
        const sizeInfo = isUploaded ? ` - ${(file.size/1024).toFixed(1)} KB` : '';
        
        html += `
            <div class="file-status-item ${statusClass}">
                <div class="file-status-header">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="file-name">${fileInfo.name}</span>
                    <span class="file-required">${requiredLabel}</span>
                </div>
                <div class="file-description">
                    ${fileInfo.description}${sizeInfo}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Summary section
    html += `
        <div class="upload-summary">
            <div class="summary-stats">
                <span class="uploaded-count">${totalUploaded}/4 files uploaded</span>
                ${hasRequired ? '<span class="required-ok">✅ Required file present</span>' : '<span class="required-missing">⚠️ Missing required file</span>'}
            </div>
    `;
    
    if (hasRequired && totalUploaded > 0) {
        html += '<button class="upload-btn" onclick="event.stopPropagation(); uploadFiles();">Upload & Process Files</button>';
    } else {
        html += '<button class="upload-btn-disabled" disabled>Select coors.xyz to continue</button>';
    }
    
    html += `
            <button class="select-more-btn" onclick="event.stopPropagation(); selectMoreFiles();">
                Select Files
            </button>
            <button class="clear-files-btn" onclick="event.stopPropagation(); clearSelectedFiles();">
                Clear All Files
            </button>
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
    displayFileStatus([]);
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
        <div class="loading-container">
            <div class="spinner"></div>
            <h3>${message}</h3>
            <p>Please wait...</p>
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
        <div class="success-container">
            <h3>✅ Upload Successful!</h3>
            <p>Processing your data...</p>
            <div class="spinner"></div>
        </div>
    `;
}

function showProcessSuccess(data) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    console.log('Processing success data:', data);
    
    uploadArea.innerHTML = `
        <div class="success-container">
            <h3>Processing Complete!</h3>
            <div class="success-info">
                <p><strong>Trajectory frames:</strong> ${data.trajectory_frames || 'N/A'}</p>
                <p><strong>Excitation points:</strong> ${data.excitation_points || 'N/A'}</p>
                <div class="action-buttons">
                    <button class="upload-btn" onclick="openViewer()">
                        Open 3D Viewer
                    </button>
                    <button class="upload-btn-secondary" onclick="location.reload()">
                        Upload New Files
                    </button>
                </div>
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
                showViewerError('Popup blocked. Please allow popups and try again, or <a href="/viewer" target="_blank">click here to open viewer</a>');
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
        showViewerError(`Failed to open 3D viewer: ${error.message}. <a href="/viewer" target="_blank">Try direct link</a>`);
    });
}

function showViewerError(errorMessage) {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return;
    
    uploadArea.innerHTML = `
        <div class="error-container">
            <h3>⚠️ Viewer Issue</h3>
            <div class="error-info">
                <p>${errorMessage}</p>
                <div class="action-buttons">
                    <button class="upload-btn" onclick="window.open('/viewer', '_blank')">
                        Try Direct Link
                    </button>
                    <button class="upload-btn-secondary" onclick="checkServerStatus()">
                        Check Server Status
                    </button>
                    <button class="upload-btn-secondary" onclick="location.reload()">
                        Reload Page
                    </button>
                </div>
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
        
        let statusReport = '<h3>Server Status Report</h3><div class="status-report">';
        
        // API Status
        if (statusResult.error) {
            statusReport += `<p>❌ <strong>API Status:</strong> ${statusResult.error}</p>`;
        } else {
            statusReport += `<p>✅ <strong>API Status:</strong> OK (${statusResult.status})</p>`;
        }
        
        // Viewer Status
        if (viewerResult.error) {
            statusReport += `<p>❌ <strong>Viewer:</strong> ${viewerResult.error}</p>`;
        } else {
            statusReport += `<p>✅ <strong>Viewer:</strong> Available (${viewerResult.status})</p>`;
        }
        
        // Process Status
        if (processResult.error) {
            statusReport += `<p>❌ <strong>Processing:</strong> ${processResult.error}</p>`;
        } else {
            statusReport += `<p>✅ <strong>Processing:</strong> OK</p>`;
        }
        
        statusReport += `
            </div>
            <div class="action-buttons">
                <button class="upload-btn" onclick="location.reload()">🔄 Reload & Try Again</button>
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
        <div class="error-container">
            <h3>❌ Error</h3>
            <div class="error-info">
                <p><strong>Error:</strong> ${error}</p>
                <div class="action-buttons">
                    <button class="upload-btn" onclick="location.reload()">🔄 Try Again</button>
                    <button class="upload-btn-secondary" onclick="clearSelectedFiles()">📁 Select Different Files</button>
                </div>
            </div>
        </div>
    `;
}