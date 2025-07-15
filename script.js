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
        const hasImage = selectedImage !== null;
        
        if (hasLocation && hasImage) {
            analyzeBtn.disabled = false;
            analyzeBtn.style.opacity = '1';
        } else {
            analyzeBtn.disabled = true;
            analyzeBtn.style.opacity = '0.6';
        }
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
            maximumAge: 300000 // 5 minutes
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
        // Click to upload
        uploadArea.addEventListener('click', () => {
            if (!imagePreview.style.display || imagePreview.style.display === 'none') {
                imageUpload.click();
            }
        });

        // File input change
        imageUpload.addEventListener('change', handleImageSelect);

        // Drag and drop
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

        // Remove image
        removeImage.addEventListener('click', (e) => {
            e.stopPropagation();
            clearImage();
        });
    }

    function handleImageSelect() {
        const file = imageUpload.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Seleziona un file immagine valido');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Il file è troppo grande. Massimo 5MB');
            return;
        }

        selectedImage = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
            uploadArea.querySelector('.upload-content').style.display = 'none';
        };
        reader.readAsDataURL(file);

        updateAnalyzeButton();
    }

    function clearImage() {
        selectedImage = null;
        imageUpload.value = '';
        imagePreview.style.display = 'none';
        uploadArea.querySelector('.upload-content').style.display = 'block';
        updateAnalyzeButton();
    }

    // Analysis
    async function performAnalysis() {
        if (!currentLocation || !selectedImage) {
            alert('Assicurati di avere posizione e foto');
            return;
        }

        showLoading(analyzeBtn);

        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('photo', selectedImage);
            formData.append('lat', currentLocation.lat);
            formData.append('lon', currentLocation.lon);
            formData.append('elevation', currentElevation || '');
            formData.append('weather', currentWeather || '');

            // Send to API
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Display results
            displayResults(result);

        } catch (error) {
            console.error('Analysis error:', error);
            alert('Errore durante l\'analisi. Riprova.');
        } finally {
            hideLoading(analyzeBtn);
        }
    }

    function displayResults(data) {
        // Show result section
        resultSection.style.display = 'block';
        
        // Animate score
        const score = data.probability || 0;
        animateScore(score);
        
        // Update prediction text
        aiPrediction.textContent = data.analysis || 'Analisi completata';
        
        // Update factors
        tempFactor.textContent = data.factors?.temperature || 'N/A';
        humidityFactor.textContent = data.factors?.humidity || 'N/A';
        vegetationFactor.textContent = data.factors?.vegetation || 'N/A';
        
        // Scroll to results
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function animateScore(targetScore) {
        const duration = 1500; // ms
        const startTime = Date.now();
        const startScore = 0;

        function update() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentScore = Math.round(startScore + (targetScore - startScore) * easeOut);
            
            scoreValue.textContent = currentScore;
            scoreCircle.style.setProperty('--score', currentScore);
            
            // Color based on score
            let color = '#22c55e'; // green
            if (currentScore < 30) color = '#ef4444'; // red
            else if (currentScore < 60) color = '#f59e0b'; // yellow
            
            scoreCircle.style.background = `conic-gradient(${color} 0deg, ${color} ${currentScore * 3.6}deg, #e5e7eb ${currentScore * 3.6}deg)`;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }
        
        update();
    }

    // New scan
    function resetApp() {
        // Hide results
        resultSection.style.display = 'none';
        
        // Clear image
        clearImage();
        
        // Reset score
        scoreValue.textContent = '--';
        scoreCircle.style.setProperty('--score', 0);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Event listeners
    analyzeBtn.addEventListener('click', performAnalysis);
    newScanBtn.addEventListener('click', resetApp);

    // Initialize
    initGeolocation();
    setupImageUpload();
    updateAnalyzeButton();

    // Service worker registration (for PWA)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // Silent fail - not critical
            });
        });
    }
});