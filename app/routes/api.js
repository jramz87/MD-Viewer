// app/static/js/charts.js - Chart visualization for molecular data

class MolecularCharts {
    constructor() {
        this.spectrumChart = null;
        this.energyChart = null;
        this.excitationData = null;
        this.trajectoryData = null;
    }
    
    setData(excitationData, trajectoryData) {
        this.excitationData = excitationData;
        this.trajectoryData = trajectoryData;
    }
    
    createSpectrumChart() {
        const canvas = document.getElementById('spectrum-chart');
        if (!canvas || !this.excitationData) {
            console.error('Cannot create spectrum chart: missing canvas or data');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Get current frame's excitation data
        const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
        const currentTime = currentFrame * 0.5; // 0.5 fs per frame
        
        // Find closest excitation data
        let closestExcitation = this.findClosestExcitation(currentTime);
        
        if (!closestExcitation) {
            closestExcitation = this.excitationData[0]; // Use first available
        }
        
        // Create spectrum data
        const energyRange = this.generateEnergyRange(2.0, 7.0, 1000);
        const spectrum = this.generateSpectrum(energyRange, closestExcitation);
        
        // Destroy existing chart
        if (this.spectrumChart) {
            this.spectrumChart.destroy();
        }
        
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
                    tension: 0.4
                }, {
                    label: 'S1 Transition',
                    data: energyRange.map((e, i) => 
                        Math.abs(e - closestExcitation.s1_energy) < 0.05 ? 
                        closestExcitation.s1_oscillator : null
                    ),
                    borderColor: '#dc3545',
                    backgroundColor: '#dc3545',
                    borderWidth: 2,
                    pointRadius: 3,
                    showLine: false,
                    type: 'scatter'
                }, {
                    label: 'S2 Transition',
                    data: energyRange.map((e, i) => 
                        Math.abs(e - closestExcitation.s2_energy) < 0.05 ? 
                        closestExcitation.s2_oscillator : null
                    ),
                    borderColor: '#28a745',
                    backgroundColor: '#28a745',
                    borderWidth: 2,
                    pointRadius: 3,
                    showLine: false,
                    type: 'scatter'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Absorption Spectrum - Frame ${currentFrame + 1} (${currentTime.toFixed(1)} fs)`,
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
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Absorption: ${context.parsed.y.toFixed(4)}`;
                                } else if (context.datasetIndex === 1) {
                                    return `S1: ${closestExcitation.s1_energy.toFixed(3)} eV (f=${closestExcitation.s1_oscillator.toFixed(4)})`;
                                } else if (context.datasetIndex === 2) {
                                    return `S2: ${closestExcitation.s2_energy.toFixed(3)} eV (f=${closestExcitation.s2_oscillator.toFixed(4)})`;
                                }
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
                        beginAtZero: true
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
        
        console.log('📊 Spectrum chart created');
    }
    
    createEnergyChart() {
        const canvas = document.getElementById('energy-chart');
        if (!canvas || !this.excitationData) {
            console.error('Cannot create energy chart: missing canvas or data');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare time series data
        const timeData = this.excitationData.map(d => d.time_fs / 1000.0); // Convert to ps
        const s1Energies = this.excitationData.map(d => d.s1_energy);
        const s2Energies = this.excitationData.map(d => d.s2_energy);
        const s1Oscillators = this.excitationData.map(d => d.s1_oscillator);
        const s2Oscillators = this.excitationData.map(d => d.s2_oscillator);
        
        // Current time marker
        const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
        const currentTime = currentFrame * 0.5 / 1000.0; // Convert to ps
        
        // Destroy existing chart
        if (this.energyChart) {
            this.energyChart.destroy();
        }
        
        // Create new chart
        this.energyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData.map(t => t.toFixed(2)),
                datasets: [{
                    label: 'S1 Energy',
                    data: s1Energies,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y'
                }, {
                    label: 'S2 Energy',
                    data: s2Energies,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y'
                }, {
                    label: 'S1 Oscillator Strength',
                    data: s1Oscillators,
                    borderColor: '#fd7e14',
                    backgroundColor: 'rgba(253, 126, 20, 0.1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1',
                    borderDash: [5, 5]
                }, {
                    label: 'S2 Oscillator Strength',
                    data: s2Oscillators,
                    borderColor: '#20c997',
                    backgroundColor: 'rgba(32, 201, 151, 0.1)',
                    borderWidth: 1,
                    fill: false,
                    tension: 0.1,
                    yAxisID: 'y1',
                    borderDash: [5, 5]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Excitation Energy Evolution',
                        font: { size: 16 }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (ps)'
                        },
                        type: 'linear'
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Energy (eV)'
                        },
                        grid: {
                            drawOnChartArea: true,
                        },
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Oscillator Strength'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
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
                    if (currentTime >= timeData[0] && currentTime <= timeData[timeData.length - 1]) {
                        const ctx = chart.ctx;
                        const xAxis = chart.scales.x;
                        const yAxis = chart.scales.y;
                        
                        const xPosition = xAxis.getPixelForValue(currentTime);
                        
                        ctx.save();
                        ctx.beginPath();
                        ctx.moveTo(xPosition, yAxis.top);
                        ctx.lineTo(xPosition, yAxis.bottom);
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#333';
                        ctx.setLineDash([10, 5]);
                        ctx.stroke();
                        ctx.restore();
                        
                        // Add time label
                        ctx.save();
                        ctx.fillStyle = '#333';
                        ctx.font = '12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${currentTime.toFixed(2)} ps`, xPosition, yAxis.top - 5);
                        ctx.restore();
                    }
                }
            }]
        });
        
        console.log('📈 Energy evolution chart created');
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
        if (this.spectrumChart) {
            this.createSpectrumChart(); // Recreate with current frame data
        }
        
        if (this.energyChart && molecularViewer) {
            // Update current time marker
            this.energyChart.update('none');
        }
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
        if (molecularViewer && molecularViewer.excitationData) {
            molecularCharts.setData(
                molecularViewer.excitationData,
                molecularViewer.trajectoryData
            );
        }
    }
}

// Chart creation functions (called from HTML)
function createSpectrumChart() {
    initializeCharts();
    if (molecularCharts) {
        molecularCharts.createSpectrumChart();
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