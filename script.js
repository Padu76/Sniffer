document.addEventListener("DOMContentLoaded", () => {
    // Elements
    const locationElement = document.getElementById("location");
    const elevationElement = document.getElementById("elevation");
    const weatherElement = document.getElementById("weather");
    const analyzeBtn = document.getElementById("analyzeBtn");
    const imageUpload = document.getElementById("imageUpload");
    const uploadArea = document.getElementById("uploadArea");
    const imagePreview = document.getElementById("imagePreview");
    const previewImg = document.getElementById("previewImg");
    const removeImage = document.getElementById("removeImage");
    const resultSection = document.getElementById("resultSection");
    const scoreCircle = document.getElementById("scoreCircle");
    const scoreValue = document.getElementById("scoreValue");
    const aiPrediction = document.getElementById("aiPrediction");
    const tempFactor = document.getElementById("tempFactor");
    const humidityFactor = document.getElementById("humidityFactor");
    const vegetationFactor = document.getElementById("vegetationFactor");
    const newScanBtn = document.getElementById("newScanBtn");

    // State
    let currentLocation = null;
    let currentWeather = null;
    let currentElevation = null;
    let selectedImage = null;
    let selectedImageBase64 = null;
    let currentScanId = null;
    let currentAnalysis = null;

    // Utility functions
    function updateStatus(element, text, isError = false) {
        element.textContent = text;
        if (isError) {
            element.style.color = '#ef4444';
        } else {
            element.style.color = '';
        }
    }

    function showLoading(button) {
        button.classList.add('loading');
        button.querySelector('.loading-spinner').style.display = 'block';
        button.disabled = true;
    }

    function hideLoading(button) {
        button.classList.remove('loading');
        button.querySelector('.loading-spinner').style.display = 'none';
        button.disabled = false;
    }

    function updateAnalyzeButton() {
        const hasLocation = currentLocation !== null;
        
        if (hasLocation) {
            analyzeBtn.disabled = false;
            analyzeBtn.style.opacity = '1';
        } else {
            analyzeBtn.disabled = true;
            analyzeBtn.style.opacity = '0.6';
        }
    }

    function getCurrentSearchTarget() {
        return document.getElementById('searchTarget').value;
    }

    // Geolocation
    function initGeolocation() {
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
        uploadArea.addEventListener('click', () => {
            if (!imagePreview.style.display || imagePreview.style.display === 'none') {
                imageUpload.click();
            }
        });

        imageUpload.addEventListener('change', handleImageSelect);

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                imageUpload.files = files;
                handleImageSelect();
            }
        });

        removeImage.addEventListener('click', (e) => {
            e.stopPropagation();
            clearImage();
        });
    }

    function handleImageSelect() {
        const file = imageUpload.files[0];
        if (!file) return;

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
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
            uploadArea.querySelector('.upload-content').style.display = 'none';
            
            selectedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);

        updateAnalyzeButton();
    }

    function clearImage() {
        selectedImage = null;
        selectedImageBase64 = null;
        imageUpload.value = '';
        imagePreview.style.display = 'none';
        uploadArea.querySelector('.upload-content').style.display = 'block';
        updateAnalyzeButton();
    }

    // Analysis with Universal AI
    async function performAnalysis() {
        if (!currentLocation) {
            alert('Assicurati di avere la posizione');
            return;
        }

        const searchTarget = getCurrentSearchTarget();
        showLoading(analyzeBtn);

        try {
            const analysisData = {
                lat: currentLocation.lat,
                lon: currentLocation.lon,
                elevation: currentElevation || '',
                weather: currentWeather || '',
                image: selectedImageBase64 || null,
                searchTarget: searchTarget // New field for target type
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
            hideLoading(analyzeBtn);
        }
    }

    function generateScanId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function displayEnhancedResults(data, target) {
        resultSection.style.display = 'block';
        
        const score = data.probability || 0;
        animateScore(score);
        
        // Update result badge based on target
        const targetConfig = getTargetConfig(target);
        document.getElementById('resultBadge').textContent = `Analisi ${targetConfig.name} Completata`;
        
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
        
        tempFactor.textContent = data.factors?.temperature || 'N/A';
        humidityFactor.textContent = data.factors?.humidity || 'N/A';
        vegetationFactor.textContent = data.factors?.vegetation || 'N/A';
        
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
                searchTarget: getCurrentSearchTarget(), // Include target type
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
            feedbackStatus.style.display = 'block';
            feedbackStatus.innerHTML = `
                <div class="feedback-success">
                    <span>🎯 Feedback per ${targetConfig.name} ricevuto! Grazie per aiutare l'AI a migliorare.</span>
                    ${result.accuracy ? `<br><small>Accuracy zona: ${result.accuracy.toFixed(1)}%</small>` : ''}
                </div>
            `;
            
            feedbackButtons.forEach(btn => btn.style.display = 'none');

        } catch (error) {
            console.error('Feedback error:', error);
            
            feedbackStatus.style.display = 'block';
            feedbackStatus.innerHTML = `
                <div class="feedback-error">
                    ❌ Errore nell'invio del feedback. Riprova.
                </div>
            `;
            
            feedbackButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
        }
    };

    function animateScore(targetScore) {
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
        resultSection.style.display = 'none';
        clearImage();
        scoreValue.textContent = '--';
        scoreCircle.style.setProperty('--score', 0);
        
        currentScanId = null;
        currentAnalysis = null;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Event listeners
    analyzeBtn.addEventListener('click', performAnalysis);
    newScanBtn.addEventListener('click', resetApp);

    // Initialize
    initGeolocation();
    setupImageUpload();
    updateAnalyzeButton();

    // Service worker registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // Silent fail
            });
        });
    }
});