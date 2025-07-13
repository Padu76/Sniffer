export default async function handler(req, res) {
  const { lat, lon } = req.query;

  const elevRes = await fetch(`https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${process.env.GOOGLE_ELEVATION_API_KEY}`);
  const elevJson = await elevRes.json();
  const altitude = elevJson.results[0].elevation;

  const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHERMAP_API_KEY}`);
  const weatherJson = await weatherRes.json();
  const weather = `${weatherJson.weather[0].main}, ${weatherJson.main.temp}°C`;

  res.status(200).json({ altitude: Math.round(altitude), weather });
}
