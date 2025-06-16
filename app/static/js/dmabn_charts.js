// DMABN geometry analysis charts

class DMABNGeometryCharts {
    constructor() {
        this.geometryChart = null;
        this.correlationChart = null;
        this.geometryData = null;
        this.excitationData = null;
        this.currentParameter = 'twist_angle';
        this.keyFrames = [];
        console.log('DMABN Geometry Charts initialized');
    }
    
    setData(geometryData, excitationData, keyFrames = []) {
        this.geometryData = geometryData;
        this.excitationData = excitationData;
        this.keyFrames = keyFrames;
        console.log('DMABN data loaded:', {
            geometry_points: geometryData ? geometryData.length : 0,
            excitation_points: excitationData ? excitationData.length : 0,
            key_frames: keyFrames.length
        });
    }
    
    createGeometryTimelineChart() {
        const canvas = document.getElementById('geometry-timeline-chart');
        if (!canvas || !this.geometryData) {
            console.error('Cannot create geometry timeline chart: missing canvas or data');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare time series data
        const timeData = this.geometryData.map(d => d.time_ps);
        const twistAngles = this.geometryData.map(d => d.twist_angle);
        const ringPlanarity = this.geometryData.map(d => d.ring_planarity);
        const ringNitrileAngles = this.geometryData.map(d => d.ring_nitrile_angle);
        
        // Current time marker
        const currentFrame = molecularViewer ? molecularViewer.currentFrame : 0;
        const currentTime = currentFrame * 0.5 / 1000.0; // Convert to ps
        
        // Destroy existing chart
        if (this.geometryChart) {
            this.geometryChart.destroy();
        }
        
        // Create new chart
        this.geometryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timeData.map(t => t.toFixed(2)),
                datasets: [{
                    label: 'Twist Angle (°)',
                    data: twistAngles,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                }, {
                    label: 'Ring Planarity (Å)',
                    data: ringPlanarity,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y1'
                }, {
                    label: 'Ring-Nitrile Angle (°)',
                    data: ringNitrileAngles,
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'y'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'DMABN Geometry Evolution',
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
                                return `${label}: ${value.toFixed(3)}`;
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
                        type: 'linear'
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Angle (°)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Distance (Å)'
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
                afterDraw: (chart) => this.drawCurrentTimeMarker(chart, currentTime)
            }, {
                id: 'keyFrameMarkers',
                afterDraw: (chart) => this.drawKeyFrameMarkers(chart)
            }]
        });
        
        console.log('DMABN geometry timeline chart created');
    }
    
    createCorrelationChart() {
        const canvas = document.getElementById('correlation-chart');
        if (!canvas || !this.geometryData || !this.excitationData) {
            console.error('Cannot create correlation chart: missing canvas or data');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Prepare correlation data
        const correlationData = this.prepareCorrelationData();
        
        // Destroy existing chart
        if (this.correlationChart) {
            this.correlationChart.destroy();
        }
        
        // Create scatter plot
        this.correlationChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'S1 Energy vs Twist Angle',
                    data: correlationData.s1_twist,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.6)',
                    pointRadius: 3,
                    pointHoverRadius: 5
                }, {
                    label: 'S2 Energy vs Twist Angle',
                    data: correlationData.s2_twist,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.6)',
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Excitation Energy vs Twist Angle Correlation',
                        font: { size: 16 }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const x = context.parsed.x;
                                const y = context.parsed.y;
                                const dataset = context.dataset.label;
                                return `${dataset}: ${x.toFixed(2)}° → ${y.toFixed(3)} eV`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Twist Angle (°)'
                        },
                        type: 'linear'
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Excitation Energy (eV)'
                        },
                        type: 'linear'
                    }
                },
                interaction: {
                    mode: 'point'
                }
            }
        });
        
        console.log('DMABN correlation chart created');
    }
    
    prepareCorrelationData() {
        // Match geometry and excitation data by time
        const correlationData = {
            s1_twist: [],
            s2_twist: [],
            s1_planarity: [],
            s2_planarity: []
        };
        
        this.geometryData.forEach(geomFrame => {
            // Find closest excitation data
            const closestExcitation = this.findClosestExcitationData(geomFrame.time_fs);
            
            if (closestExcitation && !geomFrame.analysis_failed) {
                // Twist angle correlations
                correlationData.s1_twist.push({
                    x: geomFrame.twist_angle,
                    y: closestExcitation.s1_energy
                });
                
                correlationData.s2_twist.push({
                    x: geomFrame.twist_angle,
                    y: closestExcitation.s2_energy
                });
                
                // Planarity correlations
                correlationData.s1_planarity.push({
                    x: geomFrame.ring_planarity,
                    y: closestExcitation.s1_energy
                });
                
                correlationData.s2_planarity.push({
                    x: geomFrame.ring_planarity,
                    y: closestExcitation.s2_energy
                });
            }
        });
        
        return correlationData;
    }
    
    findClosestExcitationData(targetTimeFs) {
        if (!this.excitationData || this.excitationData.length === 0) return null;
        
        let closest = null;
        let minDiff = Infinity;
        
        this.excitationData.forEach(excitation => {
            const diff = Math.abs(excitation.time_fs - targetTimeFs);
            if (diff < minDiff) {
                minDiff = diff;
                closest = excitation;
            }
        });
        
        return minDiff < 100 ? closest : null; // Within 100 fs
    }
    
    drawCurrentTimeMarker(chart, currentTime) {
        if (!this.geometryData || this.geometryData.length === 0) return;
        
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        
        const minTime = Math.min(...this.geometryData.map(d => d.time_ps));
        const maxTime = Math.max(...this.geometryData.map(d => d.time_ps));
        
        // Only draw if current time is within geometry data range
        if (currentTime >= minTime && currentTime <= maxTime) {
            const xPosition = xAxis.getPixelForValue(currentTime);
            
            // Draw vertical line
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPosition, yAxis.top);
            ctx.lineTo(xPosition, yAxis.bottom);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ff6b6b';
            ctx.globalAlpha = 0.8;
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            ctx.restore();
            
            // Add time label
            ctx.save();
            const labelText = `${currentTime.toFixed(2)} ps`;
            const labelWidth = ctx.measureText(labelText).width + 12;
            const labelHeight = 20;
            const labelX = xPosition - labelWidth / 2;
            const labelY = yAxis.top - 30;
            
            // Label background
            ctx.fillStyle = '#ff6b6b';
            ctx.globalAlpha = 0.9;
            ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
            
            // Label text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 1;
            ctx.fillText(labelText, xPosition, labelY + labelHeight / 2);
            ctx.restore();
        }
    }
    
    drawKeyFrameMarkers(chart) {
        if (!this.keyFrames || this.keyFrames.length === 0) return;
        
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        
        this.keyFrames.forEach((keyFrame, index) => {
            if (index >= 5) return; // Only show top 5 key frames
            
            const timePs = keyFrame.time_fs / 1000.0;
            const xPosition = xAxis.getPixelForValue(timePs);
            
            if (xPosition >= xAxis.left && xPosition <= xAxis.right) {
                // Draw key frame marker
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(xPosition, yAxis.top);
                ctx.lineTo(xPosition, yAxis.bottom);
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#f39c12';
                ctx.globalAlpha = 0.6;
                ctx.setLineDash([4, 2]);
                ctx.stroke();
                ctx.restore();
                
                // Add key frame indicator
                ctx.save();
                ctx.beginPath();
                ctx.arc(xPosition, yAxis.top + 15, 6, 0, 2 * Math.PI);
                ctx.fillStyle = '#f39c12';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // Add number
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((index + 1).toString(), xPosition, yAxis.top + 15);
                ctx.restore();
            }
        });
    }
    
    updateCharts() {
        if (this.geometryChart && molecularViewer) {
            // Force chart update with current time marker
            this.geometryChart.update('none');
        }
        
        // Update correlation chart if parameter selection changed
        if (this.correlationChart) {
            this.correlationChart.update('none');
        }
    }
    
    switchCorrelationParameter(parameter) {
        this.currentParameter = parameter;
        
        if (!this.correlationChart || !this.geometryData || !this.excitationData) {
            return;
        }
        
        const correlationData = this.prepareCorrelationData();
        
        // Update chart data based on selected parameter
        if (parameter === 'twist_angle') {
            this.correlationChart.data.datasets[0].data = correlationData.s1_twist;
            this.correlationChart.data.datasets[1].data = correlationData.s2_twist;
            this.correlationChart.options.scales.x.title.text = 'Twist Angle (°)';
            this.correlationChart.options.plugins.title.text = 'Excitation Energy vs Twist Angle Correlation';
        } else if (parameter === 'ring_planarity') {
            this.correlationChart.data.datasets[0].data = correlationData.s1_planarity;
            this.correlationChart.data.datasets[1].data = correlationData.s2_planarity;
            this.correlationChart.options.scales.x.title.text = 'Ring Planarity (Å)';
            this.correlationChart.options.plugins.title.text = 'Excitation Energy vs Ring Planarity Correlation';
        }
        
        this.correlationChart.update('none');
        console.log(`Switched correlation parameter to: ${parameter}`);
    }
    
    exportGeometryData() {
        if (!this.geometryData) {
            console.error('No geometry data to export');
            return;
        }
        
        // Create CSV data
        let csvContent = "frame,time_fs,time_ps,twist_angle,ring_planarity,ring_nitrile_angle,donor_acceptor_distance,amino_pyramidalization\n";
        
        this.geometryData.forEach(frame => {
            csvContent += `${frame.frame_number},${frame.time_fs},${frame.time_ps},`;
            csvContent += `${frame.twist_angle},${frame.ring_planarity},${frame.ring_nitrile_angle},`;
            csvContent += `${frame.donor_acceptor_distance},${frame.amino_pyramidalization}\n`;
        });
        
        // Download CSV file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dmabn_geometry_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        console.log('Geometry data exported to CSV');
    }
    
    destroy() {
        if (this.geometryChart) {
            this.geometryChart.destroy();
            this.geometryChart = null;
        }
        
        if (this.correlationChart) {
            this.correlationChart.destroy();
            this.correlationChart = null;
        }
    }
}

// Global DMABN charts instance
let dmabnCharts = null;

// Initialize DMABN charts when needed
function initializeDMABNCharts() {
    if (!dmabnCharts) {
        dmabnCharts = new DMABNGeometryCharts();
        console.log('DMABN charts initialized');
    }
}

// Chart creation functions
function createGeometryTimelineChart() {
    initializeDMABNCharts();
    if (dmabnCharts) {
        dmabnCharts.createGeometryTimelineChart();
    }
}

function createCorrelationChart() {
    initializeDMABNCharts();
    if (dmabnCharts) {
        dmabnCharts.createCorrelationChart();
    }
}

function switchCorrelationParameter(parameter) {
    if (dmabnCharts) {
        dmabnCharts.switchCorrelationParameter(parameter);
    }
}