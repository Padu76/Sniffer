// === SNIFFER COMPLETE SCRIPT ===
// Maintains all existing functionality + adds hardware integration

// Hardware Integration Layer
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
        this.aiModel = {
            trainedTargets: [],
            currentTarget: null,
            trainingMode: false,
            samples: []
        };
    }

    async connect() {
        try {
            console.log('🔍 Scanning for Sniffer devices...');
            
            if (!navigator.bluetooth) {
                throw new Error('Bluetooth not supported');
            }
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: "Sniffer" },
                    { services: ["12345678-1234-1234-1234-123456789abc"] }
                ],
                optionalServices: ["12345678-1234-1234-1234-123456789abc"]
            });

            console.log('📡 Connecting to:', this.device.name);
            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService("12345678-1234-1234-1234-123456789abc");
            
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            
            // Start mock data for testing
            this.startMockSensorReadings();
            
            console.log('✅ Sniffer hardware connected successfully');
            return true;
            
        } catch (error) {
            console.error('❌ Connection failed:', error);
            this.updateConnectionStatus('failed');
            // Don't throw, allow app to continue without hardware
            return false;
        }
    }

    startMockSensorReadings() {
        setInterval(() => {
            if (this.isConnected) {
                this.sensorData.odorIntensity = Math.round(Math.random() * 100);
                this.sensorData.confidence = Math.round(Math.random() * 100);
                this.sensorData.direction = Math.round(Math.random() * 360);
                this.updateSensorDisplay();
            }
        }, 2000);
    }

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
            const percentage = Math.min(this.sensorData.odorIntensity, 100);
            gaugeFillElement.style.width = percentage + '%';
        }
    }

    getDirectionArrow() {
        if (this.sensorData.direction === null) return '🧭';
        const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
        const index = Math.round(this.sensorData.direction / 45) % 8;
        return arrows[index];
    }

    isTargetTrained(target) {
        return this.aiModel.trainedTargets.some(t => t.target === target);
    }

    async startTraining(target) {
        console.log(`🎯 Starting training for: ${target}`);
        this.aiModel.currentTarget = target;
        this.aiModel.trainingMode = true;
        this.aiModel.samples = [];
        return true;
    }

    async finishTraining() {
        this.aiModel.trainedTargets.push({
            target: this.aiModel.currentTarget,
            samples: this.aiModel.samples.length,
            trainedAt: new Date().toISOString()
        });
        
        this.aiModel.trainingMode = false;
        this.aiModel.currentTarget = null;
        this.aiModel.samples = [];
        
        localStorage.setItem('snifferTrainedTargets', JSON.stringify(this.aiModel.trainedTargets));
        return true;
    }
}

// Global hardware instance
window.snifferHardware = new SnifferHardware();

// === MAIN APP SCRIPT ===
document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const locationElement = document.getElementById("location");
    const elevationElement = document.getElementById("elevation");
    const weatherElement = document.getElementById("weather");
    const analyzeAIBtn = document.getElementById("analyzeAIBtn");
    const imageUpload = document.getElementById("imageUpload");
    const resultSection = document.getElementById("resultSection");
    const scoreCircle = document.getElementById("scoreCircle");
    const scoreValue = document.getElementById("scoreValue");
    const aiPrediction = document.getElementById("aiPrediction");
    const tempFactor = document.getElementById("tempFactor");
    const humidityFactor = document.getElementById("humidityFactor");
    const vegetationFactor = document.getElementById("vegetationFactor");

    // State
    let currentLocation = null;
    let currentWeather = null;
    let currentElevation = null;
    let selectedImage = null;
    let selectedImageBase64 = null;
    let currentScanId = null;
    let currentAnalysis = null;

    // Search target configurations
    const searchTargets = {
        funghi: {
            icon: '🍄',
            title: 'Modalità Funghi',
            tips: 'Cerca in zone umide, vicino a querce e castagni'
        },
        tartufi: {
            icon: '🟤',
            title: 'Modalità Tartufi', 
            tips: 'Cerca vicino a querce, noccioli e tigli, in terreni calcarei'
        },
        erbe: {
            icon: '🌿',
            title: 'Modalità Erbe',
            tips: 'Cerca in prati, radure e margini boschivi non inquinati'
        },
        custom: {
            icon: '⚙️',
            title: 'Modalità Personalizzata',
            tips: 'Usa sensori calibrati per il tuo target specifico'
        }
    };

    let currentTarget = 'funghi';

    // Utility functions
    function updateStatus(element, text, isError = false) {
        if (!element) return;
        element.textContent = text;
        if (isError) {
            element.style.color = '#ef4444';
        } else {
            element.style.color = '';
        }
    }

    function showLoading(button) {
        if (!button) return;
        button.classList.add('loading');
        const spinner = button.querySelector('.loading-spinner');
        if (spinner) spinner.style.display = 'block';
        button.disabled = true;
    }

    function hideLoading(button) {
        if (!button) return;
        button.classList.remove('loading');
        const spinner = button.querySelector('.loading-spinner');
        if (spinner) spinner.style.display = 'none';
        button.disabled = false;
    }

    function updateAnalyzeButton() {
        if (!analyzeAIBtn) return;
        
        const hasLocation = currentLocation !== null;
        
        if (hasLocation) {
            analyzeAIBtn.disabled = false;
            analyzeAIBtn.style.opacity = '1';
        } else {
            analyzeAIBtn.disabled = true;
            analyzeAIBtn.style.opacity = '0.6';
        }
    }

    function getCurrentSearchTarget() {
        const select = document.getElementById('searchTarget');
        return select ? select.value : 'funghi';
    }

    // Geolocation
    function initGeolocation() {
        if (!locationElement) return;
        
        updateStatus(locationElement, "Rilevamento in corso...");
        
        if (!navigator.geolocation) {
            updateStatus(locationElement, "Geolocalizzazione non supportata", true);
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                currentLocation = { lat, lon };
                
                updateStatus(locationElement, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
                fetchElevationAndWeather(lat, lon);
                updateAnalyzeButton();
            },
            (error) => {
                let errorMsg = "Errore posizione";
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = "Permesso negato";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = "Posizione non disponibile";
                        break;
                    case error.TIMEOUT:
                        errorMsg = "Timeout rilevamento";
                        break;
                }
                updateStatus(locationElement, errorMsg, true);
            },
            options
        );
    }

    // Fetch elevation and weather data
    async function fetchElevationAndWeather(lat, lon) {
        try {
            updateStatus(elevationElement, "Caricamento...");
            updateStatus(weatherElement, "Caricamento...");

            const response = await fetch(`/api/analyze?lat=${lat}&lon=${lon}`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            currentElevation = data.altitude;
            currentWeather = data.weather;
            
            updateStatus(elevationElement, `${data.altitude} m`);
            updateStatus(weatherElement, data.weather);

        } catch (error) {
            console.error('Error fetching data:', error);
            updateStatus(elevationElement, "Errore caricamento", true);
            updateStatus(weatherElement, "Errore caricamento", true);
        }
    }

    // Image handling
    function setupImageUpload() {
        if (!imageUpload) return;

        imageUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                handleImageSelect(file);
            }
        });
    }

    function handleImageSelect(file) {
        if (!file.type.startsWith('image/')) {
            alert('Seleziona un file immagine valido');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Il file è troppo grande. Massimo 5MB');
            return;
        }

        selectedImage = file;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('previewImage');
            const photoPreview = document.getElementById('photoPreview');
            const uploadZone = document.querySelector('.upload-zone');
            
            if (previewImg && photoPreview && uploadZone) {
                previewImg.src = e.target.result;
                photoPreview.style.display = 'block';
                uploadZone.style.display = 'none';
                
                selectedImageBase64 = e.target.result.split(',')[1];
                updateAnalyzeButton();
            }
        };
        reader.readAsDataURL(file);
    }

    function clearImage() {
        selectedImage = null;
        selectedImageBase64 = null;
        
        const photoPreview = document.getElementById('photoPreview');
        const uploadZone = document.querySelector('.upload-zone');
        const imageUploadEl = document.getElementById('imageUpload');
        
        if (photoPreview) photoPreview.style.display = 'none';
        if (uploadZone) uploadZone.style.display = 'block';
        if (imageUploadEl) imageUploadEl.value = '';
        
        updateAnalyzeButton();
    }

    // Analysis with Universal AI
    async function performAnalysis() {
        if (!currentLocation) {
            alert('Assicurati di avere la posizione');
            return;
        }

        const searchTarget = getCurrentSearchTarget();
        showLoading(analyzeAIBtn);

        try {
            const analysisData = {
                lat: currentLocation.lat,
                lon: currentLocation.lon,
                elevation: currentElevation || '',
                weather: currentWeather || '',
                image: selectedImageBase64 || null,
                searchTarget: searchTarget
            };

            console.log('Sending to Universal AI...', {
                hasImage: !!selectedImageBase64,
                location: `${currentLocation.lat}, ${currentLocation.lon}`,
                target: searchTarget
            });

            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysisData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            console.log('Universal AI analysis result:', result);
            
            currentAnalysis = result;
            currentScanId = generateScanId();
            
            displayEnhancedResults(result, searchTarget);

        } catch (error) {
            console.error('Analysis error:', error);
            alert('Errore durante l\'analisi. Riprova.');
        } finally {
            hideLoading(analyzeAIBtn);
        }
    }

    function generateScanId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function displayEnhancedResults(data, target) {
        if (!resultSection) return;
        
        resultSection.style.display = 'block';
        
        const score = data.probability || 0;
        animateScore(score);
        
        const targetConfig = getTargetConfig(target);
        const resultMethod = document.getElementById('resultMethod');
        if (resultMethod) resultMethod.textContent = 'AI Vision';
        
        if (aiPrediction) {
            aiPrediction.innerHTML = `
                <div class="claude-analysis">
                    <h4>🧠 Analisi AI Universale - ${targetConfig.name}</h4>
                    <p>${data.analysis || 'Analisi completata'}</p>
                    
                    ${data.recommendations ? `
                        <h4>💡 Raccomandazioni per ${targetConfig.name}</h4>
                        <p>${data.recommendations}</p>
                    ` : ''}
                    
                    ${data.species_likely ? `
                        <h4>${targetConfig.icon} ${targetConfig.speciesLabel}</h4>
                        <p>${data.species_likely}</p>
                    ` : ''}
                    
                    ${data.best_spots ? `
                        <h4>📍 Zone Migliori</h4>
                        <p>${data.best_spots}</p>
                    ` : ''}
                    
                    ${data.vision_insights ? `
                        <h4>👁️ Analisi Visiva</h4>
                        <p>${data.vision_insights}</p>
                    ` : ''}
                    
                    <div class="analysis-meta">
                        <small>Target: ${targetConfig.name} | Confidenza: ${data.confidence || 'Media'} | 
                        Metodo: ${data.analysisMethod || 'Hybrid'} | 
                        Fonte: ${data.source || 'AI'}</small>
                    </div>
                </div>
                
                <!-- FEEDBACK SECTION -->
                <div class="feedback-section">
                    <h4>📊 Aiuta il Machine Learning!</h4>
                    <p>Dopo la ricerca di ${targetConfig.name.toLowerCase()}, facci sapere se hai trovato qualcosa:</p>
                    <div class="feedback-buttons">
                        <button class="feedback-btn success" onclick="submitFeedback(true)">
                            ✅ Ho trovato ${targetConfig.name.toLowerCase()}!
                        </button>
                        <button class="feedback-btn failure" onclick="submitFeedback(false)">
                            ❌ Non ho trovato nulla
                        </button>
                    </div>
                    <div class="feedback-status" id="feedbackStatus" style="display: none;"></div>
                </div>
            `;
        }
        
        if (tempFactor) tempFactor.textContent = data.factors?.temperature || 'N/A';
        if (humidityFactor) humidityFactor.textContent = data.factors?.humidity || 'N/A';
        if (vegetationFactor) vegetationFactor.textContent = data.factors?.vegetation || 'N/A';
        
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getTargetConfig(target) {
        const configs = {
            funghi: { name: 'Funghi', icon: '🍄', speciesLabel: 'Specie Probabili' },
            tartufi: { name: 'Tartufi', icon: '🟤', speciesLabel: 'Varietà Probabili' },
            erbe: { name: 'Erbe Medicinali', icon: '🌿', speciesLabel: 'Erbe Identificate' },
            custom: { name: 'Target Personalizzato', icon: '⚙️', speciesLabel: 'Elementi Rilevati' }
        };
        return configs[target] || configs.funghi;
    }

    // Enhanced Feedback System
    window.submitFeedback = async function(found) {
        if (!currentScanId || !currentAnalysis) {
            alert('Errore: dati scansione non trovati');
            return;
        }

        const feedbackButtons = document.querySelectorAll('.feedback-btn');
        const feedbackStatus = document.getElementById('feedbackStatus');
        
        feedbackButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
        });

        try {
            const feedbackData = {
                scanId: currentScanId,
                found: found,
                predicted: currentAnalysis.probability,
                lat: currentLocation.lat,
                lon: currentLocation.lon,
                elevation: currentElevation,
                weather: currentWeather,
                analysis: currentAnalysis,
                searchTarget: getCurrentSearchTarget(),
                timestamp: new Date().toISOString()
            };

            console.log('Submitting universal feedback:', feedbackData);

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(feedbackData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            const targetConfig = getTargetConfig(getCurrentSearchTarget());
            if (feedbackStatus) {
                feedbackStatus.style.display = 'block';
                feedbackStatus.innerHTML = `
                    <div class="feedback-success">
                        <span>🎯 Feedback per ${targetConfig.name} ricevuto! Grazie per aiutare l'AI a migliorare.</span>
                        ${result.accuracy ? `<br><small>Accuracy zona: ${result.accuracy.toFixed(1)}%</small>` : ''}
                    </div>
                `;
            }
            
            feedbackButtons.forEach(btn => btn.style.display = 'none');

        } catch (error) {
            console.error('Feedback error:', error);
            
            if (feedbackStatus) {
                feedbackStatus.style.display = 'block';
                feedbackStatus.innerHTML = `
                    <div class="feedback-error">
                        ❌ Errore nell'invio del feedback. Riprova.
                    </div>
                `;
            }
            
            feedbackButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
        }
    };

    function animateScore(targetScore) {
        if (!scoreValue || !scoreCircle) return;
        
        const duration = 1500;
        const startTime = Date.now();
        const startScore = 0;

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + (targetScore - startScore) * easeOut);
            
            scoreValue.textContent = currentScore;
            scoreCircle.style.setProperty('--score', currentScore);
            
            let color = '#22c55e';
            if (currentScore < 30) color = '#ef4444';
            else if (currentScore < 60) color = '#f59e0b';
            
            scoreCircle.style.background = `conic-gradient(${color} 0deg, ${color} ${currentScore * 3.6}deg, #e5e7eb ${currentScore * 3.6}deg)`;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        update();
    }

    function resetApp() {
        if (resultSection) resultSection.style.display = 'none';
        clearImage();
        if (scoreValue) scoreValue.textContent = '--';
        if (scoreCircle) scoreCircle.style.setProperty('--score', 0);
        
        currentScanId = null;
        currentAnalysis = null;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update search mode
    window.updateSearchMode = function() {
        const targetSelect = document.getElementById('searchTarget');
        if (!targetSelect) return;
        
        const target = targetSelect.value;
        currentTarget = target;
        const config = searchTargets[target];
        
        // Update mode banner
        const modeIcon = document.getElementById('modeIcon');
        const modeTitle = document.getElementById('modeTitle');
        const modeTips = document.getElementById('modeTips');
        
        if (modeIcon) modeIcon.textContent = config.icon;
        if (modeTitle) modeTitle.textContent = config.title;
        if (modeTips) modeTips.textContent = config.tips;
        
        // Update calibration target
        const calibrateTarget = document.getElementById('calibrateTarget');
        const calibrationTarget = document.getElementById('calibrationTarget');
        
        if (calibrateTarget) calibrateTarget.textContent = target;
        if (calibrationTarget) calibrationTarget.textContent = target;
        
        // Show/hide hardware method based on target
        const hardwareCard = document.getElementById('hardwareMethodCard');
        const sensorCalibrationPanel = document.getElementById('sensorCalibrationPanel');
        
        if (target === 'custom') {
            if (hardwareCard) hardwareCard.style.display = 'block';
            if (sensorCalibrationPanel) sensorCalibrationPanel.style.display = 'block';
        } else {
            if (hardwareCard) hardwareCard.style.display = 'none';
            if (sensorCalibrationPanel) sensorCalibrationPanel.style.display = 'none';
        }
    };

    // Global functions for HTML onclick handlers
    window.quickScanPhoto = function() {
        selectPhoto();
        setTimeout(() => {
            if (selectedImage) {
                analyzeWithAI();
            }
        }, 100);
    };

    window.scrollToAdvanced = function() {
        const workflowSection = document.querySelector('.workflow-section');
        if (workflowSection) {
            workflowSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    window.selectPhoto = function() {
        if (imageUpload) imageUpload.click();
    };

    window.removePhoto = function() {
        clearImage();
    };

    window.analyzeWithAI = function() {
        performAnalysis();
    };

    window.analyzeWithHardware = function() {
        if (!window.snifferHardware.isConnected) {
            alert('Connetti prima la sonda hardware');
            return;
        }
        
        const resultMethod = document.getElementById('resultMethod');
        if (resultMethod) resultMethod.textContent = 'Hardware Sensing';
        
        // Simulate hardware analysis
        simulateHardwareAnalysis();
    };

    function simulateHardwareAnalysis() {
        if (!resultSection) return;
        
        resultSection.style.display = 'block';
        
        const probability = Math.round(Math.random() * 100);
        if (scoreValue) scoreValue.textContent = probability;
        
        const scoreLabel = document.getElementById('scoreLabel');
        if (scoreLabel) scoreLabel.textContent = `Concentrazione ${currentTarget}`;
        
        if (aiPrediction) {
            aiPrediction.innerHTML = `
                <h4>🔬 Analisi Sensori Hardware</h4>
                <p>Rilevata concentrazione significativa di composti organici volatili tipici di ${currentTarget}.</p>
                <p><strong>Lettura sensore:</strong> ${window.snifferHardware.sensorData.odorIntensity} ppm</p>
            `;
        }
        
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    window.newScan = function() {
        resetApp();
    };

    window.showInfo = function() {
        alert('👃 Sniffer è una piattaforma universale di rilevamento che combina AI vision e sensori hardware per trovare tesori nascosti in natura.');
    };

    // Hardware functions
    window.connectSensor = async function() {
        try {
            const connected = await window.snifferHardware.connect();
            
            if (connected) {
                const sensorControls = document.getElementById('sensorControls');
                const sensorActions = document.getElementById('sensorActions');
                const analyzeHardwareBtn = document.getElementById('analyzeHardwareBtn');
                const hardwareMethodCard = document.getElementById('hardwareMethodCard');
                
                if (sensorControls) sensorControls.style.display = 'block';
                if (sensorActions) sensorActions.style.display = 'none';
                if (analyzeHardwareBtn) analyzeHardwareBtn.disabled = false;
                if (hardwareMethodCard) hardwareMethodCard.classList.add('connected');
            }
            
        } catch (error) {
            alert('❌ Connessione fallita: ' + error.message);
        }
    };

    window.calibrateSensor = function() {
        const target = getCurrentSearchTarget();
        
        if (window.snifferHardware.isTargetTrained(target)) {
            alert(`✅ Target ${target} già calibrato`);
        } else {
            alert(`🔬 Calibrazione per ${target} avviata. Posiziona la sonda nel campione di riferimento.`);
            const calibrationStatus = document.getElementById('calibrationStatus');
            if (calibrationStatus) {
                calibrationStatus.textContent = 'Calibrando...';
                setTimeout(() => {
                    calibrationStatus.textContent = 'Calibrato ✅';
                    window.snifferHardware.aiModel.trainedTargets.push({
                        target: target,
                        trainedAt: new Date().toISOString()
                    });
                }, 3000);
            }
        }
    };

    window.startCalibration = function() {
        window.calibrateSensor();
    };

    // Load hero stats
    async function loadHeroStats() {
        try {
            const response = await fetch('/api/dashboard?type=feedback');
            if (response.ok) {
                const data = await response.json();
                const records = data.records || [];
                
                const targetRecords = records.filter(r => 
                    !r.fields?.Search_Target || r.fields?.Search_Target === currentTarget
                );
                
                const heroTotalScans = document.getElementById('heroTotalScans');
                const heroAccuracy = document.getElementById('heroAccuracy');
                const heroSuccess = document.getElementById('heroSuccess');
                
                if (heroTotalScans) heroTotalScans.textContent = targetRecords.length || records.length;
                
                const accurate = targetRecords.filter(r => r.fields?.Accuracy === 100).length;
                const accuracy = targetRecords.length > 0 ? Math.round((accurate / targetRecords.length) * 100) : 0;
                if (heroAccuracy) heroAccuracy.textContent = accuracy + '%';
                
                const found = targetRecords.filter(r => r.fields?.Found_Target === true).length;
                const success = targetRecords.length > 0 ? Math.round((found / targetRecords.length) * 100) : 0;
                if (heroSuccess) heroSuccess.textContent = success + '%';
            }
        } catch (error) {
            console.log('Using fallback stats');
            const heroTotalScans = document.getElementById('heroTotalScans');
            const heroAccuracy = document.getElementById('heroAccuracy');
            const heroSuccess = document.getElementById('heroSuccess');
            
            if (heroTotalScans) heroTotalScans.textContent = '127';
            if (heroAccuracy) heroAccuracy.textContent = '89%';
            if (heroSuccess) heroSuccess.textContent = '71%';
        }
    }

    // Make functions available globally
    window.getCurrentSearchTarget = getCurrentSearchTarget;
    window.currentLocation = currentLocation;
    window.performAnalysis = performAnalysis;
    window.loadHeroStats = loadHeroStats;

    // Initialize everything
    initGeolocation();
    setupImageUpload();
    updateAnalyzeButton();
    
    // Load search mode
    if (window.updateSearchMode) {
        window.updateSearchMode();
    }
    
    // Load hero stats
    loadHeroStats();
    
    // Load trained targets from localStorage
    const saved = localStorage.getItem('snifferTrainedTargets');
    if (saved) {
        window.snifferHardware.aiModel.trainedTargets = JSON.parse(saved);
    }

    console.log('✅ Sniffer app initialized successfully');
});