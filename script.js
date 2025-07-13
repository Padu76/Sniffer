
document.addEventListener("DOMContentLoaded", () => {
    const locationElement = document.getElementById("location");
    const altitudeElement = document.getElementById("altitude");
    const weatherElement = document.getElementById("weather");
    const analyzeButton = document.getElementById("analyze");
    const fileInput = document.getElementById("photo");

    let lat = null;
    let lon = null;

    function updateStatus(el, text) {
        el.textContent = text;
    }

    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(position => {
                lat = position.coords.latitude;
                lon = position.coords.longitude;
                updateStatus(locationElement, `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`);
            }, () => {
                updateStatus(locationElement, "Errore nel rilevamento posizione");
            });
        } else {
            updateStatus(locationElement, "Geolocalizzazione non supportata");
        }
    }

    async function fetchData() {
        if (!lat || !lon) {
            alert("Posizione non disponibile");
            return;
        }

        const formData = new FormData();
        const file = fileInput.files[0];
        if (!file) {
            alert("Carica una foto del terreno");
            return;
        }
        formData.append("photo", file);
        formData.append("lat", lat);
        formData.append("lon", lon);

        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                body: formData
            });

            const data = await res.json();
            updateStatus(altitudeElement, `${data.altitude} m`);
            updateStatus(weatherElement, `${data.weather.description}, ${data.weather.temp}°C`);
        } catch (err) {
            alert("Errore durante l'analisi");
        }
    }

    getLocation();
    analyzeButton.addEventListener("click", fetchData);
});
