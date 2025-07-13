async function analyze() {
  const coordsEl = document.getElementById("coords");
  const altitudeEl = document.getElementById("altitude");
  const weatherEl = document.getElementById("weather");
  const resultEl = document.getElementById("result");

  if (!navigator.geolocation) {
    coordsEl.textContent = "Geolocalizzazione non supportata.";
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude.toFixed(5);
    const lon = pos.coords.longitude.toFixed(5);
    coordsEl.textContent = `${lat}, ${lon}`;

    // Chiamata API altitudine + meteo
    const elevRes = await fetch(`/api/analyze?lat=${lat}&lon=${lon}`);
    const elevData = await elevRes.json();
    altitudeEl.textContent = elevData.altitude + " m";
    weatherEl.textContent = elevData.weather;

    // Analisi immagine simulata
    const fileInput = document.getElementById("photo");
    if (fileInput.files.length > 0) {
      resultEl.textContent = "Analisi immagine in corso (simulata)...";
      setTimeout(() => {
        resultEl.textContent = "🌲 Probabilità funghi: Alta";
      }, 2000);
    } else {
      resultEl.textContent = "Carica una foto per completare l’analisi.";
    }
  });
}
