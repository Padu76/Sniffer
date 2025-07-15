// Hardware Integration Layer for Sniffer
class SnifferHardware {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.isConnected = false;
        this.sensorData = {
            odorIntensity: 0,
            targetDetected: false,
            direction: null,
            confidence: 0,
            batteryLevel: 100,
            temperature: 0,
            humidity: 0,
            pressure: 0
        };
        this.callbacks = {};
        
        // BME688 AI Configuration
        this.aiModel = {
            trainedTargets: [],
            currentTarget: null,
            trainingMode: false,
            samples: []
        };
    }

    // Bluetooth Connection Management
    async connect() {
        try {
            console.log('🔍 Scanning for Sniffer devices...');
            
            // Request Bluetooth device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: "Sniffer" },
                    { services: ["12345678-1234-1234-1234-123456789abc"] }
                ],
                optionalServices: [
                    "12345678-1234-1234-1234-123456789abc", // Sniffer Service
                    "87654321-4321-4321-4321-cba987654321", // Calibration Service
                    "battery_service"
                ]
            });

            console.log('📡 Connecting to:', this.device.name);
            
            // Connect to GATT Server
            this.server = await this.device.gatt.connect();
            
            // Get primary service
            this.service = await this.server.getPrimaryService("12345678-1234-1234-1234-123456789abc");
            
            // Setup characteristics
            await this.setupCharacteristics();
            
            // Start data streaming
            await this.startDataStream();
            
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            
            console.log('✅ Sniffer hardware connected successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.updateConnectionStatus('failed');
            throw error;
        }
    }

    async setupCharacteristics() {
        try {
            // Sensor Data Characteristic (Read/Notify)
            this.characteristics.sensorData = await this.service.getCharacteristic("11111111-1111-1111-1111-111111111111");
            
            // Calibration Control (Write)
            this.characteristics.calibration = await this.service.getCharacteristic("22222222-2222-2222-2222-222222222222");
            
            // Target Selection (Write)
            this.characteristics.targetSelect = await this.service.getCharacteristic("33333333-3333-3333-3333-333333333333");
            
            // Alert Configuration (Write)
            this.characteristics.alertConfig = await this.service.getCharacteristic("44444444-4444-4444-4444-444444444444");
            
            console.log('📊 Characteristics setup complete');
            
        } catch (error) {
            console.error('❌ Characteristics setup failed:', error);
            throw error;
        }
    }

    async startDataStream() {
        try {
            // Enable notifications for sensor data
            await this.characteristics.sensorData.startNotifications();
            
            // Listen for sensor data updates
            this.characteristics.sensorData.addEventListener('characteristicvaluechanged', (event) => {
                this.handleSensorData(event.target.value);
            });
            
            console.log('📡 Data streaming started');
            
        } catch (error) {
            console.error('❌ Data streaming failed:', error);
            throw error;
        }
    }

    handleSensorData(dataView) {
        try {
            // Parse BME688 data packet
            // Format: [odorIntensity(2), targetDetected(1), direction(1), confidence(1), battery(1), temp(2), humidity(2), pressure(4)]
            let offset = 0;
            
            this.sensorData.odorIntensity = dataView.getUint16(offset, true); offset += 2;
            this.sensorData.targetDetected = dataView.getUint8(offset) === 1; offset += 1;
            this.sensorData.direction = dataView.getUint8(offset); offset += 1; // 0-360 degrees
            this.sensorData.confidence = dataView.getUint8(offset); offset += 1; // 0-100%
            this.sensorData.batteryLevel = dataView.getUint8(offset); offset += 1;
            this.sensorData.temperature = dataView.getInt16(offset, true) / 100; offset += 2; // Celsius * 100
            this.sensorData.humidity = dataView.getUint16(offset, true) / 100; offset += 2; // % * 100
            this.sensorData.pressure = dataView.getUint32(offset, true); offset += 4; // Pa
            
            // Update UI
            this.updateSensorDisplay();
            
            // Trigger callbacks
            if (this.callbacks.onDataUpdate) {
                this.callbacks.onDataUpdate(this.sensorData);
            }
            
            // Check for alerts
            this.checkAlerts();
            
        } catch (error) {
            console.error('❌ Data parsing error:', error);
        }
    }

    // Target Training & Calibration
    async startTraining(targetType) {
        try {
            console.log(`🎯 Starting training for: ${targetType}`);
            
            this.aiModel.currentTarget = targetType;
            this.aiModel.trainingMode = true;
            this.aiModel.samples = [];
            
            // Send training command to ESP32
            const command = new TextEncoder().encode(`TRAIN_START:${targetType}`);
            await this.characteristics.calibration.writeValue(command);
            
            this.updateTrainingStatus('training_started');
            
        } catch (error) {
            console.error('❌ Training start failed:', error);
            throw error;
        }
    }

    async addTrainingSample() {
        try {
            if (!this.aiModel.trainingMode) {
                throw new Error('Training mode not active');
            }
            
            console.log('📊 Adding training sample...');
            
            // Send sample capture command
            const command = new TextEncoder().encode('CAPTURE_SAMPLE');
            await this.characteristics.calibration.writeValue(command);
            
            // Store sample locally
            this.aiModel.samples.push({
                timestamp: Date.now(),
                intensity: this.sensorData.odorIntensity,
                environmental: {
                    temperature: this.sensorData.temperature,
                    humidity: this.sensorData.humidity,
                    pressure: this.sensorData.pressure
                }
            });
            
            this.updateTrainingStatus(`sample_${this.aiModel.samples.length}`);
            
        } catch (error) {
            console.error('❌ Sample capture failed:', error);
            throw error;
        }
    }

    async finishTraining() {
        try {
            if (this.aiModel.samples.length < 5) {
                throw new Error('Need at least 5 samples for training');
            }
            
            console.log(`✅ Finishing training with ${this.aiModel.samples.length} samples`);
            
            // Send training complete command
            const command = new TextEncoder().encode('TRAIN_COMPLETE');
            await this.characteristics.calibration.writeValue(command);
            
            // Save to trained targets
            this.aiModel.trainedTargets.push({
                target: this.aiModel.currentTarget,
                samples: this.aiModel.samples.length,
                trainedAt: new Date().toISOString()
            });
            
            // Reset training state
            this.aiModel.trainingMode = false;
            this.aiModel.currentTarget = null;
            this.aiModel.samples = [];
            
            this.updateTrainingStatus('training_complete');
            
            // Save to localStorage for persistence
            localStorage.setItem('snifferTrainedTargets', JSON.stringify(this.aiModel.trainedTargets));
            
        } catch (error) {
            console.error('❌ Training completion failed:', error);
            throw error;
        }
    }

    // Target Selection & Detection
    async selectTarget(targetType) {
        try {
            console.log(`🎯 Selecting target: ${targetType}`);
            
            // Check if target is trained
            const trainedTarget = this.aiModel.trainedTargets.find(t => t.target === targetType);
            if (!trainedTarget) {
                throw new Error(`Target ${targetType} not trained yet`);
            }
            
            // Send target selection to ESP32
            const command = new TextEncoder().encode(`SELECT_TARGET:${targetType}`);
            await this.characteristics.targetSelect.writeValue(command);
            
            this.aiModel.currentTarget = targetType;
            this.updateTargetStatus(targetType);
            
        } catch (error) {
            console.error('❌ Target selection failed:', error);
            throw error;
        }
    }

    // Alert Configuration
    async configureAlerts(settings) {
        try {
            const config = {
                intensityThreshold: settings.threshold || 70, // 0-100
                enableVibration: settings.vibration || true,
                enableSound: settings.sound || true,
                alertDelay: settings.delay || 1000 // ms
            };
            
            // Send alert config to ESP32
            const configBytes = new Uint8Array([
                config.intensityThreshold,
                config.enableVibration ? 1 : 0,
                config.enableSound ? 1 : 0,
                config.alertDelay & 0xFF,
                (config.alertDelay >> 8) & 0xFF
            ]);
            
            await this.characteristics.alertConfig.writeValue(configBytes);
            
            console.log('🔔 Alert configuration updated:', config);
            
        } catch (error) {
            console.error('❌ Alert configuration failed:', error);
            throw error;
        }
    }

    // Direction Tracking
    getDirection() {
        if (this.sensorData.direction === null) return null;
        
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(this.sensorData.direction / 45) % 8;
        return directions[index];
    }

    getDirectionArrow() {
        if (this.sensorData.direction === null) return '🧭';
        
        const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
        const index = Math.round(this.sensorData.direction / 45) % 8;
        return arrows[index];
    }

    // UI Update Methods
    updateConnectionStatus(status) {
        const statusElement = document.getElementById('sensorStatusText');
        const indicatorElement = document.getElementById('sensorIndicator');
        const badgeElement = document.getElementById('hardwareBadge');
        
        switch (status) {
            case 'connected':
                if (statusElement) statusElement.textContent = 'Connessa';
                if (indicatorElement) indicatorElement.className = 'sensor-indicator connected';
                if (badgeElement) {
                    badgeElement.textContent = 'Connessa';
                    badgeElement.className = 'method-badge connected';
                }
                break;
            case 'failed':
                if (statusElement) statusElement.textContent = 'Errore Connessione';
                if (indicatorElement) indicatorElement.className = 'sensor-indicator error';
                break;
        }
    }

    updateSensorDisplay() {
        // Update sensor readings in UI
        const readingElement = document.getElementById('sensorReading');
        const gaugeValueElement = document.getElementById('gaugeValue');
        const gaugeFillElement = document.getElementById('gaugeFill');
        
        if (readingElement) {
            readingElement.textContent = `${this.sensorData.odorIntensity} ppm`;
        }
        
        if (gaugeValueElement) {
            gaugeValueElement.textContent = this.sensorData.odorIntensity;
        }
        
        if (gaugeFillElement) {
            const percentage = Math.min((this.sensorData.odorIntensity / 1000) * 100, 100);
            gaugeFillElement.style.width = percentage + '%';
        }
        
        // Update direction indicator
        this.updateDirectionDisplay();
    }

    updateDirectionDisplay() {
        const directionElement = document.getElementById('directionIndicator');
        if (directionElement) {
            directionElement.textContent = this.getDirectionArrow();
            directionElement.title = `Direction: ${this.getDirection()}`;
        }
    }

    updateTrainingStatus(status) {
        const statusElement = document.getElementById('calibrationStatus');
        if (statusElement) {
            switch (status) {
                case 'training_started':
                    statusElement.textContent = 'Training Avviato 🎯';
                    break;
                case 'training_complete':
                    statusElement.textContent = 'Training Completato ✅';
                    break;
                default:
                    if (status.startsWith('sample_')) {
                        const count = status.split('_')[1];
                        statusElement.textContent = `Campioni: ${count}/10`;
                    }
            }
        }
    }

    updateTargetStatus(target) {
        const targetElement = document.getElementById('currentTarget');
        if (targetElement) {
            targetElement.textContent = target;
        }
    }

    checkAlerts() {
        if (this.sensorData.targetDetected && this.sensorData.confidence > 70) {
            this.triggerAlert();
        }
    }

    triggerAlert() {
        // Visual alert
        document.body.style.backgroundColor = '#dcfce7';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 1000);
        
        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Audio alert
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
        
        // Callback
        if (this.callbacks.onTargetDetected) {
            this.callbacks.onTargetDetected(this.sensorData);
        }
    }

    // Event Callbacks
    onDataUpdate(callback) {
        this.callbacks.onDataUpdate = callback;
    }

    onTargetDetected(callback) {
        this.callbacks.onTargetDetected = callback;
    }

    // Utility Methods
    isTargetTrained(target) {
        return this.aiModel.trainedTargets.some(t => t.target === target);
    }

    getTrainedTargets() {
        return this.aiModel.trainedTargets;
    }

    getBatteryLevel() {
        return this.sensorData.batteryLevel;
    }

    disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
            this.isConnected = false;
            this.updateConnectionStatus('disconnected');
        }
    }
}

// Global hardware instance
window.snifferHardware = new SnifferHardware();

// Integration with existing app
document.addEventListener('DOMContentLoaded', () => {
    // Load trained targets from localStorage
    const saved = localStorage.getItem('snifferTrainedTargets');
    if (saved) {
        window.snifferHardware.aiModel.trainedTargets = JSON.parse(saved);
    }
    
    // Setup hardware event listeners
    window.snifferHardware.onDataUpdate((data) => {
        console.log('📊 Sensor update:', data);
        // Update any UI elements that need real-time data
    });
    
    window.snifferHardware.onTargetDetected((data) => {
        console.log('🎯 Target detected!', data);
        // Show detection notification
        showDetectionAlert(data);
    });
});

// Enhanced connect sensor function
async function connectSensor() {
    try {
        await window.snifferHardware.connect();
        
        // Update UI to show hardware controls
        document.getElementById('sensorControls').style.display = 'block';
        document.getElementById('sensorActions').style.display = 'none';
        document.getElementById('analyzeHardwareBtn').disabled = false;
        
        // Enable hardware method card
        document.getElementById('hardwareMethodCard').classList.add('connected');
        
    } catch (error) {
        alert('❌ Connessione fallita: ' + error.message);
    }
}

// Enhanced calibration function
async function calibrateSensor() {
    const target = document.getElementById('searchTarget').value;
    
    try {
        if (window.snifferHardware.isTargetTrained(target)) {
            // Target already trained, just select it
            await window.snifferHardware.selectTarget(target);
            alert(`✅ Target ${target} selezionato`);
        } else {
            // Start training process
            await startTrainingProcess(target);
        }
        
    } catch (error) {
        alert('❌ Calibrazione fallita: ' + error.message);
    }
}

async function startTrainingProcess(target) {
    const confirmed = confirm(`🎯 Iniziare training per ${target}?\n\nAvrai bisogno di 5-10 campioni del target.`);
    if (!confirmed) return;
    
    try {
        await window.snifferHardware.startTraining(target);
        
        // Show training UI
        showTrainingInterface(target);
        
    } catch (error) {
        throw error;
    }
}

function showTrainingInterface(target) {
    const modal = document.createElement('div');
    modal.className = 'training-modal';
    modal.innerHTML = `
        <div class="training-content">
            <h3>🎯 Training ${target}</h3>
            <p>Posiziona la sonda vicino al campione di ${target} e premi "Campiona"</p>
            <div class="training-progress">
                <span id="trainingProgress">0/10 campioni</span>
            </div>
            <div class="training-actions">
                <button onclick="addSample()">📊 Campiona</button>
                <button onclick="finishTraining()">✅ Completa</button>
                <button onclick="cancelTraining()">❌ Annulla</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showDetectionAlert(data) {
    const alert = document.createElement('div');
    alert.className = 'detection-alert';
    alert.innerHTML = `
        <div class="alert-content">
            <h3>🎯 Target Rilevato!</h3>
            <p>Intensità: ${data.odorIntensity} ppm</p>
            <p>Confidenza: ${data.confidence}%</p>
            <p>Direzione: ${window.snifferHardware.getDirectionArrow()}</p>
        </div>
    `;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}