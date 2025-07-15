export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    return handleGetRequest(req, res);
  } else if (req.method === 'POST') {
    return handlePostRequest(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle GET request (elevation + weather)
async function handleGetRequest(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'Lat e lon richiesti' });
  }

  try {
    console.log('Fetching data for:', lat, lon);
    
    const [elevationData, weatherData] = await Promise.all([
      fetchElevation(lat, lon),
      fetchWeather(lat, lon)
    ]);

    console.log('Data fetched successfully');
    
    res.status(200).json({
      altitude: Math.round(elevationData),
      weather: weatherData
    });

  } catch (error) {
    console.error('Error in GET request:', error);
    res.status(500).json({ 
      error: 'Errore nel recupero dati',
      details: error.message 
    });
  }
}

// Handle POST request (full analysis)
async function handlePostRequest(req, res) {
  try {
    // For now, return a mock response since file upload is complex
    const { lat, lon, elevation, weather } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Dati mancanti' });
    }

    // Generate AI prediction without image for now
    const aiAnalysis = await generateAIPrediction({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      elevation: parseFloat(elevation) || null,
      weather,
      visionData: { labels: [], objects: [] } // Mock empty vision data
    });

    // Save to Airtable
    await saveToAirtable({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      elevation: parseFloat(elevation) || null,
      weather,
      analysis: aiAnalysis,
      timestamp: new Date().toISOString()
    });

    res.status(200).json(aiAnalysis);

  } catch (error) {
    console.error('Error in POST request:', error);
    res.status(500).json({ 
      error: 'Errore nell\'analisi',
      details: error.message 
    });
  }
}

// Fetch elevation from Google API
async function fetchElevation(lat, lon) {
  const apiKey = process.env.GOOGLE_ELEVATION_API_KEY;
  
  if (!apiKey) {
    console.error('Google Elevation API key not found in env');
    throw new Error('Google Elevation API key not configured');
  }

  console.log('Fetching elevation with key:', apiKey.substring(0, 10) + '...');

  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Elevation API response:', data);
    
    if (data.status !== 'OK') {
      throw new Error(`Elevation API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
    
    if (!data.results?.[0]) {
      throw new Error('No elevation data returned');
    }
    
    return data.results[0].elevation;
  } catch (error) {
    console.error('Elevation fetch error:', error);
    throw error;
  }
}

// Fetch weather from OpenWeather API
async function fetchWeather(lat, lon) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  
  if (!apiKey) {
    console.error('OpenWeather API key not found in env');
    throw new Error('OpenWeather API key not configured');
  }

  console.log('Fetching weather with key:', apiKey.substring(0, 10) + '...');

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=it&appid=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Weather API response:', data);
    
    if (data.cod !== 200) {
      throw new Error(`Weather API error: ${data.cod} - ${data.message || 'Unknown error'}`);
    }
    
    return `${data.weather[0].description}, ${Math.round(data.main.temp)}°C`;
  } catch (error) {
    console.error('Weather fetch error:', error);
    throw error;
  }
}

// Generate AI prediction
async function generateAIPrediction({ lat, lon, elevation, weather, visionData }) {
  // Extract relevant data from vision analysis
  const labels = visionData.labels.map(l => l.description.toLowerCase());
  const objects = visionData.objects.map(o => o.name.toLowerCase());
  
  // Environmental factors scoring
  const factors = analyzeEnvironmentalFactors({ elevation, weather, labels, objects });
  
  // Calculate probability based on multiple factors
  let probability = 0;
  
  // Base probability
  probability += 20;
  
  // Elevation factor (mushrooms prefer certain altitudes)
  if (elevation) {
    if (elevation >= 200 && elevation <= 1500) probability += 25;
    else if (elevation <= 200 || elevation >= 1500) probability += 10;
  }
  
  // Weather factor
  if (weather) {
    if (weather.includes('pioggia') || weather.includes('umid')) probability += 20;
    if (weather.includes('nuvol')) probability += 15;
    if (weather.includes('sole') && !weather.includes('cald')) probability += 10;
  }
  
  // Vision factors (when image analysis is working)
  const mushroomKeywords = ['mushroom', 'funghi', 'vegetation', 'forest', 'tree', 'leaf', 'ground', 'soil', 'moss'];
  const foundKeywords = labels.filter(label => 
    mushroomKeywords.some(keyword => label.includes(keyword))
  );
  
  if (foundKeywords.length > 0) {
    probability += Math.min(foundKeywords.length * 8, 35);
  }
  
  // Environmental diversity bonus
  const plantKeywords = ['plant', 'tree', 'leaf', 'vegetation', 'grass'];
  const plantCount = labels.filter(label => 
    plantKeywords.some(keyword => label.includes(keyword))
  ).length;
  
  if (plantCount >= 3) probability += 15;
  
  // Cap probability
  probability = Math.min(Math.max(probability, 5), 95);
  
  // Generate analysis text
  const analysis = generateAnalysisText(probability, factors, foundKeywords);
  
  return {
    probability: Math.round(probability),
    analysis,
    factors: {
      temperature: factors.temperature,
      humidity: factors.humidity,
      vegetation: factors.vegetation
    },
    visionKeywords: foundKeywords,
    timestamp: new Date().toISOString()
  };
}

// Analyze environmental factors
function analyzeEnvironmentalFactors({ elevation, weather, labels, objects }) {
  let temperature = 'N/A';
  let humidity = 'N/A';
  let vegetation = 'N/A';
  
  // Extract temperature from weather
  if (weather) {
    const tempMatch = weather.match(/(-?\d+)°C/);
    if (tempMatch) {
      const temp = parseInt(tempMatch[1]);
      if (temp >= 10 && temp <= 25) temperature = 'Ottimale';
      else if (temp >= 5 && temp <= 30) temperature = 'Buona';
      else temperature = 'Scarsa';
    }
  }
  
  // Estimate humidity
  if (weather) {
    if (weather.includes('pioggia') || weather.includes('temporale')) humidity = 'Alta';
    else if (weather.includes('nuvol') || weather.includes('umid')) humidity = 'Media';
    else if (weather.includes('sole')) humidity = 'Bassa';
  }
  
  // Analyze vegetation
  const vegKeywords = ['tree', 'forest', 'vegetation', 'plant', 'leaf'];
  const vegCount = labels.filter(label => 
    vegKeywords.some(keyword => label.includes(keyword))
  ).length;
  
  if (vegCount >= 4) vegetation = 'Ricca';
  else if (vegCount >= 2) vegetation = 'Media';
  else if (vegCount >= 1) vegetation = 'Scarsa';
  else vegetation = 'Assente';
  
  return { temperature, humidity, vegetation };
}

// Generate analysis text
function generateAnalysisText(probability, factors, keywords) {
  let text = '';
  
  if (probability >= 70) {
    text = '🍄 Probabilità ALTA di trovare funghi! Le condizioni ambientali sono molto favorevoli.';
  } else if (probability >= 40) {
    text = '🔍 Probabilità MEDIA. Le condizioni sono discrete, vale la pena cercare.';
  } else {
    text = '⚠️ Probabilità BASSA. Le condizioni attuali non sono ideali per i funghi.';
  }
  
  // Add specific insights
  if (keywords.includes('forest') || keywords.includes('tree')) {
    text += ' Il terreno boschivo è un buon indicatore.';
  }
  
  if (factors.humidity === 'Alta') {
    text += ' L\'alta umidità favorisce la crescita.';
  }
  
  if (factors.vegetation === 'Ricca') {
    text += ' La ricca vegetazione è un ottimo segno.';
  }
  
  return text;
}

// Save to Airtable
async function saveToAirtable(data) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'scansioni';
  
  if (!token) {
    console.warn('Airtable token not configured, skipping save');
    return null;
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Latitudine': data.lat,
          'Longitudine': data.lon,
          'Altitudine': data.elevation,
          'Meteo': data.weather,
          'Probabilita': data.analysis.probability,
          'Analisi': data.analysis.analysis,
          'Timestamp': data.timestamp,
          'Fattori_Temp': data.analysis.factors.temperature,
          'Fattori_Umidita': data.analysis.factors.humidity,
          'Fattori_Vegetazione': data.analysis.factors.vegetation
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Airtable error response:', errorData);
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Saved to Airtable:', result);
    return result;

  } catch (error) {
    console.error('Airtable save error:', error);
    return null;
  }
}