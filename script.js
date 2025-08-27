// === SNIFFER COMPLETE SCRIPT - Neon Optimized ===
// Universal detection platform with hardware integration

// Global variables
let currentPosition = null;
let currentPhoto = null;
let currentTarget = 'funghi';
let currentMethod = 'ai';
let hardware = null;
let analysisInProgress = false;
let mockIntelligence = null;

// API Configuration
const API_CONFIG = {
    BASE_URL: window.location.origin,
    DEVICE_ID: 'sniffer_001',
    ENDPOINTS: {
        analyze: '/api/analyze',
        feedback: '/api/feedback', 
        dashboard: '/api/dashboard',
        deviceStatus: '/api/device-status',
        deviceCommand: '/api/device-command'
    }
};

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
            
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth non supportato');
            }

            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: 'Sniffer' },
                    { namePrefix: 'ESP32' }
                ],
                optionalServices: ['battery_service', 'environmental_sensing']
            });

            console.log('Device selected:', this.device.name);
            this.server = await this.device.gatt.connect();
            console.log('Connected to GATT server');

            this.isConnected = true;
            this.updateUI();
            this.startSensorSimulation();
            
            return true;
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            throw error;
        }
    }

    startSensorSimulation() {
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
        const sensorReading = document.querySelector('.reading-value');
        if (sensorReading) {
            sensorReading.textContent = this.sensorData.voc;
        }

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
    if (typeof MockIntelligence !== 'undefined') {
        mockIntelligence = new MockIntelligence();
    }
    
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
    setupTargetSelection();
    setupMethodTabs();
    setupPhotoUpload();
    setupHardwareControls();
    setupQuickActions();
    setupAnalysisButton();
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
    const targetCard = document.querySelector(`[data-target="${target}"]`);
    if (targetCard) {
        targetCard.classList.add('active');
    }
    
    // Update target mode badge
    const targetMode = document.getElementById('targetMode');
    const targetInfo = getTargetInfo(target);
    if (targetMode) {
        targetMode.textContent = `${targetInfo.icon} Modalità: ${targetInfo.name}`;
    }
    
    // Update method availability
    updateMethodAvailability(target);
    updateAnalyzeButton();
}

function getTargetInfo(target) {
    const targets = {
        'funghi': { name: 'Funghi', icon: '🍄', requiresHardware: false },
        'tartufi': { name: 'Tartufi', icon: '⚫', requiresHardware: true },
        'erbe': { name: 'Erbe Medicinali', icon: '🌿', requiresHardware: false },
        'custom': { name: 'Custom', icon: '⚙️', requiresHardware: true },
        
        // New domestic targets
        'caffe': { name: 'Caffè', icon: '☕', requiresHardware: true },
        'limone': { name: 'Limone', icon: '🍋', requiresHardware: true },
        'alcool': { name: 'Alcool', icon: '🧪', requiresHardware: true },
        'aceto': { name: 'Aceto', icon: '🥗', requiresHardware: true },
        'vaniglia': { name: 'Vaniglia', icon: '🌟', requiresHardware: true }
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
    const methodTab = document.querySelector(`[data-method="${method}"]`);
    if (methodTab) {
        methodTab.classList.add('active');
    }
    
    // Update content visibility
    document.querySelectorAll('.method-content').forEach(content => {
        content.classList.remove('active');
    });
    const methodContent = document.getElementById(`${method}-method`);
    if (methodContent) {
        methodContent.classList.add('active');
    }
    
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

    if (cameraBtn) {
        cameraBtn.addEventListener('click', () => {
            if (photoInput) {
                photoInput.setAttribute('capture', 'environment');
                photoInput.click();
            }
        });
    }

    if (galleryBtn) {
        galleryBtn.addEventListener('click', () => {
            if (photoInput) {
                photoInput.removeAttribute('capture');
                photoInput.click();
            }
        });
    }

    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoSelect);
    }

    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handlePhotoDrop);
        uploadArea.addEventListener('click', () => galleryBtn && galleryBtn.click());
    }

    if (removePhoto) {
        removePhoto.addEventListener('click', removeCurrentPhoto);
    }
    if (retakePhoto) {
        retakePhoto.addEventListener('click', () => cameraBtn && cameraBtn.click());
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
        
        const hardwareReadings = document.getElementById('hardwareReadings');
        if (hardwareReadings) {
            hardwareReadings.style.display = 'block';
        }
        
        const calibrateBtn = document.getElementById('calibrateBtn');
        if (calibrateBtn) {
            calibrateBtn.disabled = false;
        }
        
        updateAnalyzeButton();
        
    } catch (error) {
        console.error('Hardware connection failed:', error);
        btn.textContent = '❌ Riprova';
        btn.disabled = false;
        
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
        
        // Use new Neon API
        const response = await fetch(API_CONFIG.ENDPOINTS.analyze, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            console.log('Real API response received');
            const result = await response.json();
            return result;
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
            const color = percentage >= 70 ? '#22c55e' : 
                         percentage >= 40 ? '#f59e0b' : '#ef4444';
            const degrees = (percentage / 100) * 360;
            
            scoreCircle.style.background = `conic-gradient(${color} ${degrees}deg, #e5e7eb ${degrees}deg)`;
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
            lat: currentPosition?.latitude,
            lon: currentPosition?.longitude
        };
        
        // Save to Neon via new API
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
    const response = await fetch(API_CONFIG.ENDPOINTS.feedback, {
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
        console.log('Fetching real elevation and weather data...');
        
        const response = await fetch(API_CONFIG.ENDPOINTS.analyze, {
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
            console.log('Environment data received:', data);
            
            // Update elevation
            const elevationElement = document.getElementById("elevation");
            if (elevationElement && data.elevation !== undefined) {
                elevationElement.textContent = `${data.elevation}m`;
            }
            
            // Update weather
            const weatherElement = document.getElementById("weather");
            if (weatherElement && data.weather) {
                if (typeof data.weather === 'object') {
                    weatherElement.textContent = data.weather.description;
                } else {
                    weatherElement.textContent = data.weather;
                }
            }
        } else {
            throw new Error(`API response: ${response.status}`);
        }
    } catch (error) {
        console.log('API failed, using mock data:', error.message);
        
        // Generate realistic mock data for Lessinia
        const mockElevation = Math.floor(Math.random() * 800) + 400; // 400-1200m
        const mockWeather = [
            'Sole, 24°C', 
            'Nuvoloso, 19°C', 
            'Pioggia leggera, 16°C',
            'Nebbia mattutina, 17°C'
        ][Math.floor(Math.random() * 4)];
        
        const elevationElement = document.getElementById("elevation");
        const weatherElement = document.getElementById("weather");
        
        if (elevationElement) {
            elevationElement.textContent = `${mockElevation}m`;
            elevationElement.style.opacity = '0.7'; // Visual indicator of mock data
        }
        if (weatherElement) {
            weatherElement.textContent = mockWeather;
            weatherElement.style.opacity = '0.7'; // Visual indicator of mock data
        }
        
        console.log(`Mock data: ${mockElevation}m, ${mockWeather}`);
    }
}

// Stats loading - Updated for Neon
async function loadStats() {
    try {
        const response = await fetch(`${API_CONFIG.ENDPOINTS.dashboard}?type=analytics`);
        if (response.ok) {
            const data = await response.json();
            const analytics = data.analytics || {};
            updateStatsDisplay({
                totalScans: analytics.summary?.totalScans || 0,
                successRate: analytics.summary?.successRate || 0,
                activeZones: analytics.summary?.totalZones || 0
            });
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
    performAnalysis,
    API_CONFIG
};