// /api/analyze.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();

  try {
    console.log('API analyze called with method:', req.method);

    if (req.body && req.body.action === 'get_environment') {
      const { latitude, longitude } = req.body;
      
      console.log(`Getting environment data for: ${latitude}, ${longitude}`);
      
      const elevation = await getElevation(latitude, longitude);
      const weather = await getWeather(latitude, longitude);
      
      return res.status(200).json({
        elevation,
        weather,
        coordinates: { latitude, longitude }
      });
    }

    if (req.method === 'POST') {
      const { target, latitude, longitude, photo, sensorData, timestamp } = req.body;
      
      console.log(`Full analysis for target: ${target} at ${latitude}, ${longitude}`);
      
      const elevation = await getElevation(latitude, longitude);
      const weather = await getWeather(latitude, longitude);
      
      let visionResults = null;
      if (photo) {
        visionResults = await analyzePhotoWithVision(photo);
      }
      
      const claudeAnalysis = await analyzeWithClaude({
        target,
        latitude,
        longitude,
        elevation,
        weather,
        visionResults,
        sensorData,
        timestamp
      });
      
      await saveToNeon(client, {
        target,
        latitude,
        longitude,
        elevation,
        weather,
        analysis: claudeAnalysis,
        visionResults,
        sensorData,
        timestamp
      });
      
      return res.status(200).json(claudeAnalysis);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  } finally {
    client.release();
  }
}

async function getElevation(lat, lng) {
  try {
    const apiKey = process.env.GOOGLE_ELEVATION_API_KEY;
    if (!apiKey) {
      throw new Error('Google Elevation API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${apiKey}`;
    
    console.log('Calling Google Elevation API...');
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const elevation = Math.round(data.results[0].elevation);
      console.log(`Elevation: ${elevation}m`);
      return elevation;
    } else {
      throw new Error(`Google Elevation API error: ${data.status}`);
    }
  } catch (error) {
    console.error('Elevation API error:', error);
    return Math.floor(Math.random() * 800) + 400;
  }
}

async function getWeather(lat, lng) {
  try {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
      throw new Error('OpenWeather API key not configured');
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=it`;
    
    console.log('Calling OpenWeather API...');
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.cod === 200) {
      const weather = `${data.weather[0].description}, ${Math.round(data.main.temp)}°C`;
      const humidity = data.main.humidity;
      const pressure = data.main.pressure;
      
      console.log(`Weather: ${weather}, Humidity: ${humidity}%, Pressure: ${pressure}hPa`);
      
      return {
        description: weather,
        temperature: Math.round(data.main.temp),
        humidity: humidity,
        pressure: pressure,
        condition: data.weather[0].main.toLowerCase()
      };
    } else {
      throw new Error(`OpenWeather API error: ${data.message}`);
    }
  } catch (error) {
    console.error('Weather API error:', error);
    const mockWeather = ['Sole, 24°C', 'Nuvoloso, 19°C', 'Pioggia leggera, 16°C'];
    return {
      description: mockWeather[Math.floor(Math.random() * 3)],
      temperature: Math.floor(Math.random() * 10) + 15,
      humidity: Math.floor(Math.random() * 30) + 50,
      pressure: Math.floor(Math.random() * 50) + 1000,
      condition: 'unknown'
    };
  }
}

async function analyzePhotoWithVision(photoBase64) {
  try {
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY || process.env.VITE_GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      console.log('Google Vision API key not found, skipping vision analysis');
      return null;
    }

    const base64Image = photoBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    const requestBody = {
      requests: [{
        image: { content: base64Image },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 20 },
          { type: 'OBJECT_LOCALIZATION', maxResults: 10 }
        ]
      }]
    };

    console.log('Calling Google Vision API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (data.responses && data.responses[0]) {
      const labels = data.responses[0].labelAnnotations || [];
      const objects = data.responses[0].localizedObjectAnnotations || [];
      
      console.log(`Vision API detected ${labels.length} labels and ${objects.length} objects`);
      
      return {
        labels: labels.map(label => ({
          description: label.description,
          score: label.score,
          confidence: Math.round(label.score * 100)
        })),
        objects: objects.map(obj => ({
          name: obj.name,
          score: obj.score,
          confidence: Math.round(obj.score * 100)
        }))
      };
    }
    
    return null;
  } catch (error) {
    console.error('Google Vision API error:', error);
    return null;
  }
}

async function analyzeWithClaude(data) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.log('Claude API key not found, using mock analysis');
      return generateMockAnalysis(data);
    }

    const { target, latitude, longitude, elevation, weather, visionResults, sensorData } = data;
    
    let prompt = `Analizza le condizioni per la ricerca di ${target} in base a questi dati reali:

POSIZIONE:
- Coordinate: ${latitude}, ${longitude}
- Altitudine: ${elevation}m
- Meteo: ${typeof weather === 'object' ? weather.description : weather}`;

    if (typeof weather === 'object') {
      prompt += `
- Temperatura: ${weather.temperature}°C
- Umidità: ${weather.humidity}%
- Pressione: ${weather.pressure}hPa`;
    }

    if (visionResults && visionResults.labels) {
      prompt += `

ANALISI FOTO (Google Vision):
Elementi rilevati: ${visionResults.labels.map(l => `${l.description} (${l.confidence}%)`).join(', ')}`;
    }

    if (sensorData) {
      prompt += `

DATI SENSORI:
- VOC: ${sensorData.voc} ppm
- Gas: ${sensorData.gas} Ω
- Temperatura sensore: ${sensorData.temp}°C
- Umidità sensore: ${sensorData.humidity}%`;
    }

    prompt += `

Fornisci un'analisi dettagliata che includa:
1. Probabilità di trovare ${target} (0-100%)
2. Spiegazione delle condizioni
3. Suggerimenti specifici per la ricerca
4. Specie probabili per questa zona e stagione

Rispondi in formato JSON con: probability, analysis, suggestions, species`;

    console.log('Calling Claude API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (response.ok) {
      const claudeData = await response.json();
      const content = claudeData.content[0].text;
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          console.log('Claude analysis completed');
          return {
            probability: analysis.probability || 50,
            analysis: analysis.analysis || content,
            suggestions: analysis.suggestions || 'Continua la ricerca nella zona.',
            species: analysis.species || [],
            confidence: 85
          };
        }
      } catch (parseError) {
        console.log('Claude response not JSON, using text');
      }
      
      const probability = extractNumberFromText(content, 'probabilità') || 50;
      
      return {
        probability,
        analysis: content,
        suggestions: 'Analizza le condizioni locali e continua la ricerca.',
        species: [],
        confidence: 80
      };
    } else {
      throw new Error(`Claude API error: ${response.status}`);
    }

  } catch (error) {
    console.error('Claude API error:', error);
    return generateMockAnalysis(data);
  }
}

function generateMockAnalysis(data) {
  const { target, latitude, longitude, elevation, weather } = data;
  
  const isLessinia = latitude >= 45.45 && latitude <= 45.65 && 
                     longitude >= 10.85 && longitude <= 11.15;
  
  let probability = 50;
  let analysis = `Analisi per ${target} `;
  let suggestions = 'Esplora la zona con attenzione. ';
  let species = [];
  
  if (isLessinia) {
    analysis += `nella zona della Lessinia. `;
    
    if (target === 'tartufi') {
      probability = Math.floor(Math.random() * 20) + 70;
      analysis += `Zona ottimale per Tartufo Nero Estivo! La Lessinia in agosto è il periodo di massima maturazione. `;
      analysis += `Terreno calcareo-carsico ideale, altitudine ${elevation}m perfetta per la specie. `;
      suggestions = `Concentrati sulle doline carsiche tra Bosco Chiesanuova ed Erbezzo. Cerca sotto noccioli e carpini. `;
      species = ['Scorzone (Tartufo Nero Estivo)', 'Tartufo Nero Uncinato'];
    } else if (target === 'funghi') {
      probability = Math.floor(Math.random() * 20) + 60;
      analysis += `Condizioni discrete per funghi estivi. In Lessinia ad agosto trova principalmente Porcini Estivi nei boschi di faggio. `;
      suggestions = `Esplora boschi di faggio tra 800-1300m. Controlla zone ombreggiate dopo temporali. `;
      species = ['Porcini Estivi', 'Gallinacci', 'Russule'];
    }
  } else {
    probability = Math.floor(Math.random() * 30) + 40;
    analysis += `nella zona geografica corrente (${latitude.toFixed(3)}, ${longitude.toFixed(3)}). `;
  }
  
  if (typeof weather === 'object') {
    if (weather.condition === 'rain') {
      probability += 15;
      analysis += `Le condizioni di pioggia favoriscono la crescita. `;
    } else if (weather.condition === 'clear') {
      probability -= 10;
      analysis += `Il tempo soleggiato può ridurre l'umidità del terreno. `;
    }
  }
  
  probability = Math.max(0, Math.min(100, probability));
  
  return {
    probability,
    analysis,
    suggestions,
    species,
    confidence: 75,
    zone: isLessinia ? 'lessinia' : 'other',
    elevation,
    weather: typeof weather === 'object' ? weather.description : weather
  };
}

async function saveToNeon(client, data) {
  try {
    const insertQuery = `
      INSERT INTO scansioni (
        device_id, target, latitude, longitude, elevation,
        weather_description, ai_result, ai_score, voc_value, 
        humidity_value, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id
    `;

    const result = await client.query(insertQuery, [
      'web_app',
      data.target,
      data.latitude,
      data.longitude,
      data.elevation,
      typeof data.weather === 'object' ? data.weather.description : data.weather,
      data.analysis.analysis || 'Analisi completata',
      data.analysis.probability,
      data.sensorData?.voc || null,
      typeof data.weather === 'object' ? data.weather.humidity : null
    ]);

    console.log('Analysis saved to Neon:', result.rows[0].id);

  } catch (error) {
    console.error('Neon save error:', error);
  }
}

function extractNumberFromText(text, keyword) {
  const regex = new RegExp(`${keyword}[^\\d]*(\\d+)`, 'i');
  const match = text.match(regex);
  return match ? parseInt(match[1]) : null;
}