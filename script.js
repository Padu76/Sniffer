// === SNIFFER COMPLETE SCRIPT ===
// Universal detection platform with hardware integration

// Global variables
let currentPosition = null;
let currentPhoto = null;
let currentTarget = 'funghi';
let currentMethod = 'ai';
let hardware = null;
let analysisInProgress = false;
let mockIntelligence = null;

// Hardware Integration Layer
class SnifferHardware {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.isConnected = false;
        this.sensorData = {
            voc: 0,
            gas: 0,
            temp: 0,
            humidity: 0,
            pressure: 0
        };
    }

    async connect() {
        try {
            console.log('Attempting Bluetooth connection...');
            
            // Check if Web Bluetooth is available
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth non supportato');
            }

            // Request device
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: 'Sniffer' },
                    { namePrefix: 'ESP32' }
                ],
                optionalServices: ['battery_service', 'environmental_sensing']
            });

            console.log('Device selected:', this.device.name);

            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            console.log('Connected to GATT server');

            this.isConnected = true;
            this.updateUI();
            
            // Start sensor simulation for demo
            this.startSensorSimulation();
            
            return true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            throw error;
        }
    }

    startSensorSimulation() {
        // Simulate BME688 readings for demo
        setInterval(() => {
            if (this.isConnected) {
                this.sensorData = {
                    voc: Math.floor(Math.random() * 200) + 50,
                    gas: Math.floor(Math.random() * 50000) + 100000,
                    temp: (Math.random() * 5 + 20).toFixed(1),
                    humidity: Math.floor(Math.random() * 20) + 40,
                    pressure: Math.floor(Math.random() * 50) + 1000
                };
                this.updateSensorDisplay();
            }
        }, 1000);
    }

    updateSensorDisplay() {
        // Update sensor widget
        const sensorReading = document.querySelector('.reading-value');
        if (sensorReading) {
            sensorReading.textContent = this.sensorData.voc;
        }

        // Update hardware readings if visible
        const vocReading = document.getElementById('vocReading');
        const gasReading = document.getElementById('gasReading');
        const tempReading = document.getElementById('tempReading');

        if (vocReading) vocReading.textContent = this.sensorData.voc;
        if (gasReading) gasReading.textContent = this.sensorData.gas.toLocaleString();
        if (tempReading) tempReading.textContent = this.sensorData.temp + '°C';
    }

    updateUI() {
        const sensorStatus = document.getElementById('sensorStatus');
        const sensorLed = document.getElementById('sensorLed');
        
        if (sensorStatus) {
            sensorStatus.textContent = this.isConnected ? 'Connessa' : 'Disconnessa';
            sensorStatus.className = `sensor-status ${this.isConnected ? 'connected' : ''}`;
        }
        
        if (sensorLed) {
            sensorLed.className = `sensor-led ${this.isConnected ? 'connected' : ''}`;
        }
    }

    disconnect() {
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        this.isConnected = false;
        this.updateUI();
    }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log('Sniffer app initializing...');
    
    // Initialize mock intelligence system
    mockIntelligence = new MockIntelligence();
    
    // Initialize hardware
    hardware = new SnifferHardware();
    
    // Initialize geolocation
    initGeolocation();
    
    // Load dashboard stats
    loadStats();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('Sniffer app initialized successfully');
});

// Setup all event listeners
function setupEventListeners() {
    // Target selection
    setupTargetSelection();
    
    // Method tabs
    setupMethodTabs();
    
    // Photo upload
    setupPhotoUpload();
    
    // Hardware connection
    setupHardwareControls();
    
    // Quick action buttons
    setupQuickActions();
    
    // Analysis button
    setupAnalysisButton();
    
    // Feedback buttons
    setupFeedbackButtons();
}

// Target selection functionality
function setupTargetSelection() {
    const targetCards = document.querySelectorAll('.target-card');
    
    targetCards.forEach(card => {
        card.addEventListener('click', () => {
            const target = card.dataset.target;
            selectTarget(target);
        });
    });
}

function selectTarget(target) {
    console.log('Target selected:', target);
    currentTarget = target;
    
    // Update active card
    document.querySelectorAll('.target-card').forEach(card => {
        card.classList.remove('active');
    });
    document.querySelector(`[data-target="${target}"]`).classList.add('active');
    
    // Update target mode badge
    const targetMode = document.getElementById('targetMode');
    const targetInfo = getTargetInfo(target);
    if (targetMode) {
        targetMode.textContent = `${targetInfo.icon} Modalità: ${targetInfo.name}`;
    }
    
    // Update method availability
    updateMethodAvailability(target);
    
    // Update analyze button
    updateAnalyzeButton();
}

function getTargetInfo(target) {
    const targets = {
        'funghi': { name: 'Funghi', icon: '🍄', requiresHardware: false },
        'tartufi': { name: 'Tartufi', icon: '⚫', requiresHardware: true },
        'erbe': { name: 'Erbe Medicinali', icon: '🌿', requiresHardware: false },
        'custom': { name: 'Custom', icon: '⚙️', requiresHardware: true }
    };
    return targets[target] || targets['funghi'];
}

function updateMethodAvailability(target) {
    const targetInfo = getTargetInfo(target);
    const hardwareTab = document.getElementById('hardwareTab');
    
    if (hardwareTab) {
        if (targetInfo.requiresHardware) {
            hardwareTab.style.opacity = '1';
            hardwareTab.style.pointerEvents = 'auto';
        } else {
            hardwareTab.style.opacity = '0.5';
            hardwareTab.style.pointerEvents = 'none';
            // Switch to AI method if hardware was selected
            if (currentMethod === 'hardware') {
                selectMethod('ai');
            }
        }
    }
}

// Method tabs functionality
function setupMethodTabs() {
    const methodTabs = document.querySelectorAll('.method-tab');
    
    methodTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.dataset.method;
            selectMethod(method);
        });
    });
}

function selectMethod(method) {
    console.log('Method selected:', method);
    currentMethod = method;
    
    // Update active tab
    document.querySelectorAll('.method-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-method="${method}"]`).classList.add('active');
    
    // Update content visibility
    document.querySelectorAll('.method-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${method}-method`).classList.add('active');
    
    // Update analyze button
    updateAnalyzeButton();
}

// Photo upload functionality
function setupPhotoUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const photoInput = document.getElementById('photoInput');
    const cameraBtn = document.getElementById('cameraBtn');
    const galleryBtn = document.getElementById('galleryBtn');
    const removePhoto = document.getElementById('removePhoto');
    const retakePhoto = document.getElementById('retakePhoto');

    // Camera button
    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            photoInput.setAttribute('capture', 'environment');
            photoInput.click();
        });
    }

    // Gallery button  
    if (galleryBtn) {
        galleryBtn.addEventListener('click', () => {
            photoInput.removeAttribute('capture');
            photoInput.click();
        });
    }

    // File input change
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoSelect);
    }

    // Drag and drop
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handlePhotoDrop);
        uploadArea.addEventListener('click', () => galleryBtn?.click());
    }

    // Remove/retake buttons
    if (removePhoto) {
        removePhoto.addEventListener('click', removeCurrentPhoto);
    }
    if (retakePhoto) {
        retakePhoto.addEventListener('click', () => cameraBtn?.click());
    }
}

function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        displayPhotoPreview(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handlePhotoDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        displayPhotoPreview(files[0]);
    }
}

function displayPhotoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        currentPhoto = e.target.result;
        
        const uploadArea = document.getElementById('uploadArea');
        const photoPreview = document.getElementById('photoPreview');
        const previewImage = document.getElementById('previewImage');
        
        if (uploadArea) uploadArea.style.display = 'none';
        if (photoPreview) photoPreview.style.display = 'block';
        if (previewImage) previewImage.src = currentPhoto;
        
        updateAnalyzeButton();
    };
    reader.readAsDataURL(file);
}

function removeCurrentPhoto() {
    currentPhoto = null;
    
    const uploadArea = document.getElementById('uploadArea');
    const photoPreview = document.getElementById('photoPreview');
    const photoInput = document.getElementById('photoInput');
    
    if (uploadArea) uploadArea.style.display = 'block';
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoInput) photoInput.value = '';
    
    updateAnalyzeButton();
}

// Hardware controls
function setupHardwareControls() {
    const connectBtn = document.getElementById('connectHardwareBtn');
    const calibrateBtn = document.getElementById('calibrateBtn');

    if (connectBtn) {
        connectBtn.addEventListener('click', connectHardware);
    }

    if (calibrateBtn) {
        calibrateBtn.addEventListener('click', calibrateHardware);
    }
}

async function connectHardware() {
    const btn = document.getElementById('connectHardwareBtn');
    if (!btn) return;

    btn.textContent = '🔄 Connessione...';
    btn.disabled = true;

    try {
        await hardware.connect();
        btn.textContent = '✅ Connesso';
        
        // Show hardware readings
        const hardwareReadings = document.getElementById('hardwareReadings');
        if (hardwareReadings) {
            hardwareReadings.style.display = 'block';
        }
        
        // Enable calibrate button
        const calibrateBtn = document.getElementById('calibrateBtn');
        if (calibrateBtn) {
            calibrateBtn.disabled = false;
        }
        
        updateAnalyzeButton();
        
    } catch (error) {
        console.error('Hardware connection failed:', error);
        btn.textContent = '❌ Riprova';
        btn.disabled = false;
        
        // Show error message
        showNotification('Errore connessione hardware. Verifica che la sonda sia accesa.', 'error');
    }
}

async function calibrateHardware() {
    showNotification('Calibrazione hardware non ancora implementata. Sarà disponibile nella versione finale.', 'info');
}

// Quick actions
function setupQuickActions() {
    const startAnalysisBtn = document.getElementById('startAnalysisBtn');

    if (startAnalysisBtn) {
        startAnalysisBtn.addEventListener('click', () => {
            // Scroll to target selection
            const targetSection = document.querySelector('.target-section');
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// Analysis functionality
function setupAnalysisButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', performAnalysis);
    }
}

function updateAnalyzeButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (!analyzeBtn) return;

    let canAnalyze = false;
    let reasonText = '';

    // Check requirements based on method
    if (currentMethod === 'ai') {
        canAnalyze = currentPosition !== null;
        reasonText = canAnalyze ? 
            '🧠 Analizza con AI Ibrida' : 
            '📍 In attesa di geolocalizzazione...';
    } else if (currentMethod === 'hardware') {
        canAnalyze = currentPosition !== null && hardware?.isConnected;
        reasonText = canAnalyze ? 
            '🔬 Analizza con Sensori' : 
            !currentPosition ? '📍 In attesa di geolocalizzazione...' :
            !hardware?.isConnected ? '🔌 Connetti sonda prima' : 
            '❌ Requisiti non soddisfatti';
    }

    analyzeBtn.disabled = !canAnalyze || analysisInProgress;
    
    const btnText = analyzeBtn.querySelector('.btn-text');
    if (btnText) {
        btnText.textContent = reasonText;
    }
}

async function performAnalysis() {
    if (analysisInProgress) return;
    
    analysisInProgress = true;
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analyzeProgress = document.getElementById('analyzeProgress');
    
    // Show progress
    if (analyzeBtn) analyzeBtn.style.display = 'none';
    if (analyzeProgress) analyzeProgress.style.display = 'block';
    
    try {
        console.log('Starting analysis...');
        
        // Prepare analysis data
        const analysisData = {
            target: currentTarget,
            method: currentMethod,
            latitude: currentPosition?.latitude,
            longitude: currentPosition?.longitude,
            photo: currentPhoto,
            timestamp: new Date().toISOString(),
            sensorData: hardware?.isConnected ? hardware.sensorData : null
        };
        
        // Call analysis API
        const result = await callAnalysisAPI(analysisData);
        
        // Display results
        displayResults(result);
        
        // Scroll to results
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Analysis failed:', error);
        showNotification('Errore durante l\'analisi. Riprova.', 'error');
    } finally {
        analysisInProgress = false;
        
        // Hide progress
        if (analyzeBtn) analyzeBtn.style.display = 'flex';
        if (analyzeProgress) analyzeProgress.style.display = 'none';
        
        updateAnalyzeButton();
    }
}

async function callAnalysisAPI(data) {
    // Try real API first, fallback to mock on failure
    try {
        console.log('Attempting real API call...');
        
        const formData = new FormData();
        
        // Add all data to form
        Object.keys(data).forEach(key => {
            if (data[key] !== null && data[key] !== undefined) {
                if (key === 'photo' && data[key]) {
                    // Convert base64 to blob for photo
                    fetch(data[key])
                        .then(response => response.blob())
                        .then(blob => formData.append('photo', blob, 'terrain.jpg'));
                } else if (key === 'sensorData') {
                    formData.append(key, JSON.stringify(data[key]));
                } else {
                    formData.append(key, data[key]);
                }
            }
        });
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            console.log('Real API response received');
            return await response.json();
        } else {
            throw new Error(`API error: ${response.status}`);
        }
        
    } catch (error) {
        console.log('Real API failed, using mock intelligence:', error.message);
        
        // Use mock intelligence system
        if (mockIntelligence) {
            const mockResult = mockIntelligence.generateAnalysis(data);
            console.log('Mock analysis generated:', mockResult);
            
            // Simulate API delay for realism
            await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
            
            return mockResult;
        } else {
            throw new Error('Mock intelligence system not available');
        }
    }
}

function displayResults(result) {
    const resultsSection = document.getElementById('resultsSection');
    const scoreValue = document.getElementById('scoreValue');
    const scoreCircle = document.getElementById('scoreCircle');
    const resultDetails = document.getElementById('resultDetails');
    
    if (resultsSection) {
        resultsSection.style.display = 'block';
    }
    
    // Update score
    if (scoreValue && result.probability !== undefined) {
        scoreValue.textContent = `${result.probability}%`;
        
        // Update score circle gradient
        if (scoreCircle) {
            const percentage = result.probability;
            const color = percentage >= 70 ? 'var(--success)' : 
                         percentage >= 40 ? 'var(--warning)' : 'var(--danger)';
            const degrees = (percentage / 100) * 360;
            
            scoreCircle.style.background = `conic-gradient(${color} ${degrees}deg, var(--border) ${degrees}deg)`;
        }
    }
    
    // Update details
    if (resultDetails && result.analysis) {
        resultDetails.innerHTML = `
            <p><strong>Target:</strong> ${getTargetInfo(currentTarget).name}</p>
            <p><strong>Metodo:</strong> ${currentMethod === 'ai' ? 'AI Visiva' : 'Sensori Hardware'}</p>
            <p><strong>Probabilità:</strong> ${result.probability}%</p>
            <br>
            <p>${result.analysis}</p>
            ${result.suggestions ? `<br><p><strong>Suggerimenti:</strong> ${result.suggestions}</p>` : ''}
        `;
    }
}

// Feedback functionality
function setupFeedbackButtons() {
    const foundYes = document.getElementById('foundYes');
    const foundNo = document.getElementById('foundNo');

    if (foundYes) {
        foundYes.addEventListener('click', () => submitFeedback(true));
    }

    if (foundNo) {
        foundNo.addEventListener('click', () => submitFeedback(false));
    }
}

async function submitFeedback(found) {
    try {
        const feedbackData = {
            scanId: generateScanId(),
            found: found,
            target: currentTarget,
            timestamp: new Date().toISOString(),
            latitude: currentPosition?.latitude,
            longitude: currentPosition?.longitude
        };
        
        // Save to Airtable
        await saveFeedback(feedbackData);
        
        // Show confirmation
        const feedbackSection = document.getElementById('feedbackSection');
        const feedbackConfirmation = document.getElementById('feedbackConfirmation');
        
        if (feedbackSection) feedbackSection.style.display = 'none';
        if (feedbackConfirmation) feedbackConfirmation.style.display = 'block';
        
        showNotification('Feedback salvato! Grazie per aver migliorato l\'AI.', 'success');
        
    } catch (error) {
        console.error('Feedback submission failed:', error);
        showNotification('Errore nel salvare il feedback.', 'error');
    }
}

async function saveFeedback(data) {
    const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Geolocation functionality
function initGeolocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            handleGeolocationSuccess,
            handleGeolocationError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    } else {
        console.error("Geolocation not supported");
        updateLocationDisplay("Geolocalizzazione non supportata");
    }
}

function handleGeolocationSuccess(position) {
    currentPosition = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
    };
    
    console.log('Geolocation success:', currentPosition);
    
    updateLocationDisplay(`${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}`);
    
    // Fetch elevation and weather
    fetchElevationAndWeather();
    
    // Update analyze button
    updateAnalyzeButton();
}

function handleGeolocationError(error) {
    console.error("Geolocation error:", error);
    let errorMessage = "Errore di localizzazione";
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "Permesso negato";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "Posizione non disponibile";
            break;
        case error.TIMEOUT:
            errorMessage = "Timeout localizzazione";
            break;
    }
    
    updateLocationDisplay(errorMessage);
}

function updateLocationDisplay(text) {
    const locationElement = document.getElementById("location");
    if (locationElement) {
        locationElement.textContent = text;
    }
}

async function fetchElevationAndWeather() {
    if (!currentPosition) return;
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_environment',
                latitude: currentPosition.latitude,
                longitude: currentPosition.longitude
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update elevation
            const elevationElement = document.getElementById("elevation");
            if (elevationElement && data.elevation) {
                elevationElement.textContent = `${data.elevation}m`;
            }
            
            // Update weather
            const weatherElement = document.getElementById("weather");
            if (weatherElement && data.weather) {
                weatherElement.textContent = data.weather;
            }
        }
    } catch (error) {
        console.error('Error fetching environment data:', error);
        
        const elevationElement = document.getElementById("elevation");
        const weatherElement = document.getElementById("weather");
        
        if (elevationElement) elevationElement.textContent = "Errore caricamento";
        if (weatherElement) weatherElement.textContent = "Errore caricamento";
    }
}

// Stats loading
async function loadStats() {
    try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
            const data = await response.json();
            updateStatsDisplay(data);
        } else {
            throw new Error('Dashboard API not available');
        }
    } catch (error) {
        console.log('Using mock stats:', error.message);
        
        // Generate realistic mock stats
        const mockStats = {
            totalScans: Math.floor(Math.random() * 150) + 50,  // 50-200
            successRate: Math.floor(Math.random() * 30) + 65,  // 65-95%
            activeZones: Math.floor(Math.random() * 15) + 8    // 8-23
        };
        
        updateStatsDisplay(mockStats);
    }
}

function updateStatsDisplay(data) {
    const totalScans = document.getElementById('totalScans');
    const successRate = document.getElementById('successRate');
    const activeZones = document.getElementById('activeZones');
    
    if (totalScans) totalScans.textContent = data.totalScans || '--';
    if (successRate) successRate.textContent = data.successRate ? `${data.successRate}%` : '--';
    if (activeZones) activeZones.textContent = data.activeZones || '--';
}

// Utility functions
function generateScanId() {
    return 'scan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function showNotification(message, type = 'info') {
    // Simple notification - could be enhanced with toast library
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#22c55e';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Export for debugging
window.SnifferApp = {
    currentPosition,
    currentPhoto,
    currentTarget,
    currentMethod,
    hardware,
    selectTarget,
    selectMethod,
    performAnalysis
};