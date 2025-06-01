// app/static/js/charts.js - Complete Chart visualization for molecular data

class MolecularCharts {
    constructor() {
        this.spectrumChart = null;
        this.energyChart = null;
        this.excitationData = null;
        this.trajectoryData = null;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.initialX = 0;
        this.initialY = 0;
        this.globalYAxisMax = null; // Store global maximum for fixed y-axis
        console.log('Oscillator Strength Chart initialized');
    }
    
    setData(excitationData, trajectoryData) {
        this.excitationData = excitationData;
        this.trajectoryData = trajectoryData;
        
        // Calculate global y-axis maximum when data is set
        this.calculateGlobalYAxisMax();
    }
    
    calculateGlobalYAxisMax() {
        if (!this.excitationData || this.excitationData.length === 0) {
            this.globalYAxisMax = 2.0; // Default fallback
            return;
        }
        
        let maxOscillator = 0;
        let maxSpectrum = 0;
        
        // Find maximum oscillator strength across all timepoints
        this.excitationData.forEach(excitation => {
            maxOscillator = Math.max(
                maxOscillator,
                excitation.s1_oscillator || 0,
                excitation.s2_oscillator || 0
            );
            
            // Also calculate spectrum maximum for this timepoint
            const energyRange = this.generateEnergyRange(2.0, 7.0, 1000);
            const spectrum = this.generateSpectrum(energyRange, excitation);
            const spectrumMax = Math.max(...spectrum);
            maxSpectrum = Math.max(maxSpectrum, spectrumMax);
        });
        
        // Use the higher of the two with padding
        const dataMax = Math.max(maxOscillator, maxSpectrum);
        
        // Add 20% padding and round up to nice number
        const paddedMax = dataMax * 1.2;
        
        // Round to nice increments
        if (paddedMax <= 0.1) this.globalYAxisMax = 0.1;
        else if (paddedMax <= 0.5) this.globalYAxisMax = 0.5;
        else if (paddedMax <= 1.0) this.globalYAxisMax = 1.0;
        else if (paddedMax <= 2.0) this.globalYAxisMax = 2.0;
        else if (paddedMax <= 5.0) this.globalYAxisMax = 5.0;
        else this.globalYAxisMax = Math.ceil(paddedMax);
        
        console.log(`Global Y-axis maximum set to: ${this.globalYAxisMax}`);
    }
    
    createSpectrumChart() {
        const canvas = document.getElementById('spectrum-chart');
        if (!canvas || !this.excitationData) {
            console.error('Cannot create spectrum chart: missing canvas or data');
            return;
        }
        
        // Make the spectrum popup draggable
        this.makeSpectrumDraggable();
        
        const ctx = canvas.getContext('2d');
        
        // Get current frame's excitation data
        const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
        const currentTime = currentFrame * 0.5; // 0.5 fs per frame
        
        // Check if we're in the pre-excitation region (before 5 ps = 5000 fs)
        if (currentTime < 5000) {
            this.showNoExcitationMessage(canvas);
            return;
        }
        
        // Find closest excitation data
        let closestExcitation = this.findClosestExcitation(currentTime);
        
        if (!closestExcitation && this.excitationData.length > 0) {
            closestExcitation = this.excitationData[0]; // Use first available
        }
        
        if (!closestExcitation) {
            this.showNoExcitationMessage(canvas);
            return;
        }
        
        // Hide no-data message if it exists
        this.hideNoExcitationMessage();
        
        // Create spectrum data
        const energyRange = this.generateEnergyRange(2.0, 7.0, 1000);
        const spectrum = this.generateSpectrum(energyRange, closestExcitation);
        
        // Use global y-axis maximum (fixed for entire simulation)
        const yAxisMax = this.globalYAxisMax || 2.0;
        
        // Destroy existing chart
        if (this.spectrumChart) {
            this.spectrumChart.destroy();
        }
        
        // Prepare bar data for S1 and S2 transitions
        const s1BarData = energyRange.map(e => ({
            x: e,
            y: Math.abs(e - closestExcitation.s1_energy) < 0.05 ? closestExcitation.s1_oscillator : 0
        }));
        
        const s2BarData = energyRange.map(e => ({
            x: e,
            y: Math.abs(e - closestExcitation.s2_energy) < 0.05 ? closestExcitation.s2_oscillator : 0
        }));
        
        // Create new chart
        this.spectrumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: energyRange.map(e => e.toFixed(2)),
                datasets: [{
                    label: 'Absorption Spectrum',
                    data: spectrum,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    type: 'line'
                }, {
                    label: 'S1 Transition',
                    data: s1BarData,
                    backgroundColor: 'rgba(220, 53, 69, 0.8)',
                    borderColor: '#dc3545',
                    borderWidth: 2,
                    type: 'bar',
                    barThickness: 8,
                    maxBarThickness: 12,
                    categoryPercentage: 1.0,
                    barPercentage: 0.9
                }, {
                    label: 'S2 Transition',
                    data: s2BarData,
                    backgroundColor: 'rgba(40, 167, 69, 0.8)',
                    borderColor: '#28a745',
                    borderWidth: 2,
                    type: 'bar',
                    barThickness: 8,
                    maxBarThickness: 12,
                    categoryPercentage: 1.0,
                    barPercentage: 0.9
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disable animations for smooth real-time updates
                plugins: {
                    title: {
                        display: true,
                        text: `Live Spectrum - Frame ${currentFrame + 1} (${currentTime.toFixed(1)} fs)`,
                        font: { size: 14 }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Absorption: ${context.parsed.y.toFixed(4)}`;
                                } else if (context.datasetIndex === 1 && context.parsed.y > 0) {
                                    return `S1: ${closestExcitation.s1_energy.toFixed(3)} eV (f=${closestExcitation.s1_oscillator.toFixed(4)})`;
                                } else if (context.datasetIndex === 2 && context.parsed.y > 0) {
                                    return `S2: ${closestExcitation.s2_energy.toFixed(3)} eV (f=${closestExcitation.s2_oscillator.toFixed(4)})`;
                                }
                                return null; // Don't show tooltip for zero values
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Energy (eV)'
                        },
                        type: 'linear',
                        min: 2.0,
                        max: 7.0
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Oscillator Strength'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: yAxisMax  // Fixed maximum for entire simulation
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        console.log('Live spectrum chart created with bars and fixed y-axis');
    }
    
    showNoExcitationMessage(canvas) {
        const container = canvas.parentElement;
        
        if (!container) {
            return;
        }
        
        // Hide the canvas
        canvas.style.display = 'none';
        
        // Remove existing message if any
        this.hideNoExcitationMessage();
        
        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.id = 'no-excitation-message';
        messageDiv.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 300px;
            width: 100%;
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            color: #6c757d;
            font-size: 1.1rem;
            font-weight: 500;
            text-align: center;
            flex-direction: column;
            gap: 0.5rem;
        `;
        
        messageDiv.innerHTML = `
            <div style="font-size: 2rem; opacity: 0.5;">📊</div>
            <div><strong>No Excitation Data Available</strong></div>
            <div style="font-size: 0.9rem; opacity: 0.7;">Excitation calculations start at 5.0 ps</div>
        `;
        
        container.appendChild(messageDiv);
    }
    
    hideNoExcitationMessage() {
        const canvas = document.getElementById('spectrum-chart');
        const existingMessage = document.getElementById('no-excitation-message');
        
        if (canvas) {
            canvas.style.display = 'block';
        }
        
        if (existingMessage) {
            existingMessage.remove();
        }
    }
    
    makeSpectrumDraggable() {
        const spectrumPopup = document.getElementById('spectrum-popup');
        const spectrumHeader = document.querySelector('#spectrum-popup .card-header');
        
        if (!spectrumPopup || !spectrumHeader) {
            console.warn('Spectrum popup or header not found for drag functionality');
            return;
        }
        
        // Add drag cursor to header
        spectrumHeader.style.cursor = 'move';
        spectrumHeader.style.userSelect = 'none';
        
        const startDrag = (e) => {
            this.isDragging = true;
            spectrumPopup.classList.add('dragging');
            
            // Get current position
            const rect = spectrumPopup.getBoundingClientRect();
            
            // Calculate offset from mouse to popup corner
            if (e.type === 'mousedown') {
                this.dragStartX = e.clientX - rect.left;
                this.dragStartY = e.clientY - rect.top;
            } else if (e.type === 'touchstart') {
                this.dragStartX = e.touches[0].clientX - rect.left;
                this.dragStartY = e.touches[0].clientY - rect.top;
            }
            
            // Prevent text selection
            e.preventDefault();
        };
        
        const drag = (e) => {
            if (!this.isDragging) return;
            
            e.preventDefault();
            
            let clientX, clientY;
            if (e.type === 'mousemove') {
                clientX = e.clientX;
                clientY = e.clientY;
            } else if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            }
            
            // Calculate new position
            let newX = clientX - this.dragStartX;
            let newY = clientY - this.dragStartY;
            
            // Keep popup within viewport bounds
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            
            const popupRect = spectrumPopup.getBoundingClientRect();
            
            // Constrain to viewport
            newX = Math.max(0, Math.min(newX, viewport.width - popupRect.width));
            newY = Math.max(0, Math.min(newY, viewport.height - popupRect.height));
            
            // Apply new position
            spectrumPopup.style.position = 'fixed';
            spectrumPopup.style.left = newX + 'px';
            spectrumPopup.style.top = newY + 'px';
            spectrumPopup.style.right = 'auto';
            spectrumPopup.style.bottom = 'auto';
        };
        
        const endDrag = () => {
            this.isDragging = false;
            spectrumPopup.classList.remove('dragging');
        };
        
        // Mouse events
        spectrumHeader.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
        
        // Touch events for mobile
        spectrumHeader.addEventListener('touchstart', startDrag, { passive: false });
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
        
        // Prevent context menu on header
        spectrumHeader.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Simple close button setup
        this.setupSimpleCloseButton();
        
        console.log('📱 Spectrum popup is now draggable');
    }
    
    setupSimpleCloseButton() {
        // Find any button in the popup and make it a close button
        const buttons = document.querySelectorAll('#spectrum-popup button');
        
        if (buttons.length > 0) {
            const closeBtn = buttons[buttons.length - 1]; // Take the last button
            
            closeBtn.innerHTML = '×';
            closeBtn.onclick = () => {
                document.getElementById('spectrum-popup').style.display = 'none';
            };
            
            console.log('Close button setup complete');
        }
    }
    
    createEnergyChart() {
        const canvas = document.getElementById('energy-chart');
        if (!canvas || !this.excitationData) {
            console.error('Cannot create oscillator strength timeline chart: missing canvas or data');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare time series data - GLOBAL view of entire simulation
        const timeData = this.excitationData.map(d => d.time_fs / 1000.0); // Convert to ps
        const s1Oscillators = this.excitationData.map(d => d.s1_oscillator);
        const s2Oscillators = this.excitationData.map(d => d.s2_oscillator);
        
        // Current time marker
        const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
        const currentTime = currentFrame * 0.5 / 1000.0; // Convert to ps
        
        // Destroy existing chart
        if (this.energyChart) {
            this.energyChart.destroy();
        }
        
        // Create new chart - GLOBAL oscillator strength timeline
        this.energyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData.map(t => t.toFixed(2)),
                datasets: [{
                    label: 'S1 Oscillator Strength',
                    data: s1Oscillators,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0, // No points for cleaner global view
                    pointHoverRadius: 4
                }, {
                    label: 'S2 Oscillator Strength',
                    data: s2Oscillators,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0, // No points for cleaner global view
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disable animations for smooth real-time updates
                plugins: {
                    title: {
                        display: true,
                        text: 'Energy Evolution - Oscillator Strength Timeline',
                        font: { size: 16 }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                const timePoint = parseFloat(context[0].label);
                                return `Time: ${timePoint.toFixed(2)} ps`;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const label = context.dataset.label;
                                return `${label}: ${value.toFixed(4)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (ps)'
                        },
                        type: 'linear',
                        min: Math.min(...timeData),
                        max: Math.max(...timeData)
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        title: {
                            display: true,
                            text: 'Oscillator Strength'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: this.globalYAxisMax || 2.0 // Use same max as spectrum chart
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            },
            plugins: [{
                id: 'currentTimeMarker',
                afterDraw: (chart) => {
                    const minTime = Math.min(...timeData);
                    const maxTime = Math.max(...timeData);
                    
                    // Get current simulation time
                    const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
                    const simulationTime = currentFrame * 0.5 / 1000.0; // Convert to ps
                    
                    // Always draw marker, even if outside excitation data range
                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    const yAxis = chart.scales.y;
                    
                    // Calculate position - clamp to chart bounds if outside data range
                    let markerTime = simulationTime;
                    let markerColor = '#ff6b6b';
                    let markerOpacity = 0.8;
                    let markerStyle = [8, 4]; // Dashed line
                    
                    // If simulation time is outside the excitation data range, adjust appearance
                    if (simulationTime < minTime) {
                        markerTime = Math.max(simulationTime, xAxis.min || minTime);
                        markerColor = '#ffa500'; // Orange for pre-excitation
                        markerOpacity = 0.6;
                        markerStyle = [4, 4]; // More subtle dashing
                    } else if (simulationTime > maxTime) {
                        markerTime = Math.min(simulationTime, xAxis.max || maxTime);
                        markerColor = '#9370db'; // Purple for post-excitation
                        markerOpacity = 0.6;
                        markerStyle = [4, 4];
                    }
                    
                    // Only draw if marker time is within the visible chart range
                    if (markerTime >= (xAxis.min || minTime) && markerTime <= (xAxis.max || maxTime)) {
                        const xPosition = xAxis.getPixelForValue(markerTime);
                        
                        // Draw vertical line for current time
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(xPosition, yAxis.top);
                        ctx.lineTo(xPosition, yAxis.bottom);
                        ctx.lineWidth = 4; // Thicker line for better visibility
                        ctx.strokeStyle = markerColor;
                        ctx.globalAlpha = markerOpacity;
                        ctx.setLineDash(markerStyle);
                        ctx.stroke();
                        ctx.restore();
                        
                        // Add time label with background
                        ctx.save();
                        const labelText = `${simulationTime.toFixed(2)} ps`;
                        const labelWidth = ctx.measureText(labelText).width + 12;
                        const labelHeight = 20;
                        const labelX = xPosition - labelWidth / 2;
                        const labelY = yAxis.top - 30;
                        
                        // Label background
                        ctx.fillStyle = markerColor;
                        ctx.globalAlpha = 0.9;
                        ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
                        
                        // Label border
                        ctx.strokeStyle = 'white';
                        ctx.lineWidth = 2;
                        ctx.globalAlpha = 1;
                        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);
                        
                        // Label text
                        ctx.fillStyle = 'white';
                        ctx.font = 'bold 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(labelText, xPosition, labelY + labelHeight / 2);
                        ctx.restore();
                        
                        // Add current values as highlighted dots (only if within excitation data range)
                        if (simulationTime >= minTime && simulationTime <= maxTime) {
                            const closestExcitation = this.findClosestExcitationData(simulationTime * 1000); // Convert to fs
                            if (closestExcitation) {
                                const s1Y = yAxis.getPixelForValue(closestExcitation.s1_oscillator);
                                const s2Y = yAxis.getPixelForValue(closestExcitation.s2_oscillator);
                                
                                // S1 current value dot
                                ctx.save();
                                ctx.beginPath();
                                ctx.arc(xPosition, s1Y, 10, 0, 2 * Math.PI);
                                ctx.fillStyle = '#dc3545';
                                ctx.fill();
                                ctx.strokeStyle = 'white';
                                ctx.lineWidth = 3;
                                ctx.stroke();
                                ctx.restore();
                                
                                // S2 current value dot
                                ctx.save();
                                ctx.beginPath();
                                ctx.arc(xPosition, s2Y, 10, 0, 2 * Math.PI);
                                ctx.fillStyle = '#28a745';
                                ctx.fill();
                                ctx.strokeStyle = 'white';
                                ctx.lineWidth = 3;
                                ctx.stroke();
                                ctx.restore();
                                
                                // Add value labels with backgrounds
                                const s1Label = `S1: ${closestExcitation.s1_oscillator.toFixed(3)}`;
                                const s2Label = `S2: ${closestExcitation.s2_oscillator.toFixed(3)}`;
                                
                                ctx.save();
                                ctx.font = 'bold 11px sans-serif';
                                
                                // S1 label
                                const s1LabelWidth = ctx.measureText(s1Label).width + 8;
                                ctx.fillStyle = 'rgba(220, 53, 69, 0.9)';
                                ctx.fillRect(xPosition + 15, s1Y - 8, s1LabelWidth, 16);
                                ctx.fillStyle = 'white';
                                ctx.textAlign = 'left';
                                ctx.textBaseline = 'middle';
                                ctx.fillText(s1Label, xPosition + 19, s1Y);
                                
                                // S2 label
                                const s2LabelWidth = ctx.measureText(s2Label).width + 8;
                                ctx.fillStyle = 'rgba(40, 167, 69, 0.9)';
                                ctx.fillRect(xPosition + 15, s2Y - 8, s2LabelWidth, 16);
                                ctx.fillStyle = 'white';
                                ctx.fillText(s2Label, xPosition + 19, s2Y);
                                ctx.restore();
                            }
                        }
                        
                        // Add simulation status indicator
                        ctx.save();
                        let statusText = '';
                        let statusColor = markerColor;
                        
                        if (simulationTime < minTime) {
                            statusText = 'Pre-excitation';
                            statusColor = '#ffa500';
                        } else if (simulationTime > maxTime) {
                            statusText = 'Post-excitation';
                            statusColor = '#9370db';
                        } else {
                            statusText = 'Active excitation';
                            statusColor = '#ff6b6b';
                        }
                        
                        const statusX = xPosition;
                        const statusY = yAxis.bottom + 20;
                        const statusWidth = ctx.measureText(statusText).width + 10;
                        
                        ctx.fillStyle = statusColor;
                        ctx.globalAlpha = 0.8;
                        ctx.fillRect(statusX - statusWidth/2, statusY, statusWidth, 16);
                        ctx.fillStyle = 'white';
                        ctx.globalAlpha = 1;
                        ctx.font = 'bold 10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';
                        ctx.fillText(statusText, statusX, statusY + 2);
                        ctx.restore();
                    }
                }
            }]
        });
        
        console.log('Oscillator Strength synchronized with MD created');
    }
    
    findClosestExcitation(timeFs) {
        if (!this.excitationData) return null;
        
        let closest = null;
        let minDiff = Infinity;
        
        this.excitationData.forEach(excitation => {
            const diff = Math.abs(excitation.time_fs - timeFs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = excitation;
            }
        });
        
        return minDiff < 100 ? closest : null; // Within 100 fs
    }
    
    generateEnergyRange(min, max, steps) {
        const range = [];
        const step = (max - min) / (steps - 1);
        
        for (let i = 0; i < steps; i++) {
            range.push(min + i * step);
        }
        
        return range;
    }
    
    generateSpectrum(energyRange, excitationData) {
        const spectrum = [];
        const width = 0.15; // Gaussian width
        
        energyRange.forEach(energy => {
            let intensity = 0;
            
            // S1 contribution
            if (excitationData.s1_oscillator > 0) {
                const s1Contrib = excitationData.s1_oscillator * 
                    Math.exp(-Math.pow(energy - excitationData.s1_energy, 2) / (2 * width * width));
                intensity += s1Contrib;
            }
            
            // S2 contribution
            if (excitationData.s2_oscillator > 0) {
                const s2Contrib = excitationData.s2_oscillator * 
                    Math.exp(-Math.pow(energy - excitationData.s2_energy, 2) / (2 * width * width));
                intensity += s2Contrib;
            }
            
            spectrum.push(intensity);
        });
        
        return spectrum;
    }
    
    updateCharts() {
        if (this.spectrumChart && molecularViewer) {
            // Update spectrum chart smoothly instead of recreating
            this.updateSpectrumData();
        }
        
        if (this.energyChart && molecularViewer) {
            // Force immediate update of the energy chart to sync the vertical bar
            // Use 'none' mode to prevent animation lag
            this.energyChart.update('none');
            
            // Optional: Add a slight delay to ensure smooth rendering
            // This helps with performance on slower devices
            requestAnimationFrame(() => {
                if (this.energyChart) {
                    this.energyChart.draw();
                }
            });
        }
    }
    
    updateSpectrumData() {
        if (!this.spectrumChart || !molecularViewer) return;
        
        // Get current frame's excitation data
        const currentFrame = molecularViewer.currentFrame;
        const currentTime = currentFrame * 0.5; // 0.5 fs per frame
        
        // Check if we're in the pre-excitation region (before 5 ps = 5000 fs)
        if (currentTime < 5000) {
            const canvas = document.getElementById('spectrum-chart');
            if (canvas) {
                this.showNoExcitationMessage(canvas);
                // Destroy chart if it exists
                if (this.spectrumChart) {
                    this.spectrumChart.destroy();
                    this.spectrumChart = null;
                }
                return;
            }
        }
        
        // Hide no-data message if we have data now
        this.hideNoExcitationMessage();
        
        // Recreate chart if it was destroyed
        if (!this.spectrumChart) {
            this.createSpectrumChart();
            return;
        }
        
        // Find interpolated excitation data
        let closestExcitation = this.findClosestExcitationData(currentTime);
        
        if (!closestExcitation && this.excitationData.length > 0) {
            closestExcitation = this.excitationData[0];
        }
        
        if (!closestExcitation) return;
        
        // Generate new spectrum data
        const energyRange = this.generateEnergyRange(2.0, 7.0, 1000);
        const spectrum = this.generateSpectrum(energyRange, closestExcitation);
        
        // Y-axis remains fixed at global maximum (no recalculation needed)
        
        // Update the chart data in place
        this.spectrumChart.data.datasets[0].data = spectrum;
        
        // Update S1 and S2 transition bars
        const s1BarData = energyRange.map(e => ({
            x: e,
            y: Math.abs(e - closestExcitation.s1_energy) < 0.05 ? closestExcitation.s1_oscillator : 0
        }));
        
        const s2BarData = energyRange.map(e => ({
            x: e,
            y: Math.abs(e - closestExcitation.s2_energy) < 0.05 ? closestExcitation.s2_oscillator : 0
        }));
        
        this.spectrumChart.data.datasets[1].data = s1BarData;
        this.spectrumChart.data.datasets[2].data = s2BarData;
        
        // Y-axis maximum stays fixed - no need to update
        
        // Update title
        const interpolatedLabel = closestExcitation.interpolated ? ' (interpolated)' : '';
        this.spectrumChart.options.plugins.title.text = 
            `Live Spectrum - Frame ${currentFrame + 1} (${currentTime.toFixed(1)} fs)${interpolatedLabel}`;
        
        // Update tooltip callbacks with current data
        this.spectrumChart.options.plugins.tooltip.callbacks.label = function(context) {
            if (context.datasetIndex === 0) {
                return `Absorption: ${context.parsed.y.toFixed(4)}`;
            } else if (context.datasetIndex === 1 && context.parsed.y > 0) {
                return `S1: ${closestExcitation.s1_energy.toFixed(3)} eV (f=${closestExcitation.s1_oscillator.toFixed(4)})`;
            } else if (context.datasetIndex === 2 && context.parsed.y > 0) {
                return `S2: ${closestExcitation.s2_energy.toFixed(3)} eV (f=${closestExcitation.s2_oscillator.toFixed(4)})`;
            }
            return null; // Don't show tooltip for zero values
        };
        
        // Update with minimal animation
        this.spectrumChart.update('none'); // No animation for smooth real-time updates
    }
    
    findClosestExcitationData(targetTimeFs) {
        if (!this.excitationData || this.excitationData.length === 0) return null;
        
        // Check if we're before excitation data starts (before 5 ps)
        const firstExcitationTime = this.excitationData[0].time_fs;
        if (targetTimeFs < firstExcitationTime) {
            return this.excitationData[0]; // Use first excitation data
        }
        
        // Check if we're after excitation data ends
        const lastExcitationTime = this.excitationData[this.excitationData.length - 1].time_fs;
        if (targetTimeFs > lastExcitationTime) {
            return this.excitationData[this.excitationData.length - 1]; // Use last excitation data
        }
        
        // Find surrounding data points for interpolation
        let beforeIndex = -1;
        let afterIndex = -1;
        
        for (let i = 0; i < this.excitationData.length - 1; i++) {
            if (this.excitationData[i].time_fs <= targetTimeFs && 
                this.excitationData[i + 1].time_fs >= targetTimeFs) {
                beforeIndex = i;
                afterIndex = i + 1;
                break;
            }
        }
        
        // If exact match or very close, return that point
        if (beforeIndex === -1) {
            // Find closest single point
            let closest = null;
            let minDiff = Infinity;
            
            this.excitationData.forEach(excitation => {
                const diff = Math.abs(excitation.time_fs - targetTimeFs);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = excitation;
                }
            });
            
            return closest;
        }
        
        // Interpolate between the two surrounding points
        const before = this.excitationData[beforeIndex];
        const after = this.excitationData[afterIndex];
        
        const timeDiff = after.time_fs - before.time_fs;
        const fraction = (targetTimeFs - before.time_fs) / timeDiff;
        
        // Linear interpolation
        const interpolated = {
            time_fs: targetTimeFs,
            time_ps: targetTimeFs / 1000.0,
            s1_energy: before.s1_energy + fraction * (after.s1_energy - before.s1_energy),
            s1_oscillator: before.s1_oscillator + fraction * (after.s1_oscillator - before.s1_oscillator),
            s2_energy: before.s2_energy + fraction * (after.s2_energy - before.s2_energy),
            s2_oscillator: before.s2_oscillator + fraction * (after.s2_oscillator - before.s2_oscillator),
            energy_gap: 0,
            interpolated: true // Flag to indicate this is interpolated
        };
        
        interpolated.energy_gap = interpolated.s2_energy - interpolated.s1_energy;
        
        return interpolated;
    }
    
    destroy() {
        if (this.spectrumChart) {
            this.spectrumChart.destroy();
            this.spectrumChart = null;
        }
        
        if (this.energyChart) {
            this.energyChart.destroy();
            this.energyChart = null;
        }
    }
}

// Global charts instance
let molecularCharts = null;

// Chart.js configuration
Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = '#333';

// Initialize charts when needed
function initializeCharts() {
    if (!molecularCharts) {
        molecularCharts = new MolecularCharts();
        
        // Set data if available
        if (molecularViewer && molecularViewer.excitationData && molecularViewer.trajectoryData) {
            molecularCharts.setData(
                molecularViewer.excitationData,
                molecularViewer.trajectoryData
            );
            console.log('Plots loaded with real data:', {
                excitation_points: molecularViewer.excitationData.length,
                trajectory_frames: molecularViewer.trajectoryData.length
            });
        }
    }
}

// Chart creation functions (called from HTML)
function createSpectrumChart() {
    console.log('createSpectrumChart initialized');
    initializeCharts();
    if (molecularCharts) {
        molecularCharts.createSpectrumChart();
    } else {
        console.error('molecularCharts not initialized');
    }
}

function createEnergyChart() {
    initializeCharts();
    if (molecularCharts) {
        molecularCharts.createEnergyChart();
    }
}

// Update charts when frame changes
document.addEventListener('frameChanged', function(event) {
    if (molecularCharts) {
        molecularCharts.updateCharts();
    }
});

// Export for global access
window.MolecularCharts = MolecularCharts;