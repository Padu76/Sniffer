export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

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

// Handle POST request (hybrid AI analysis)
async function handlePostRequest(req, res) {
  try {
    const { image, lat, lon, elevation, weather } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Posizione richiesta' });
    }

    console.log('Starting hybrid AI analysis...', {
      hasImage: !!image,
      location: `${lat}, ${lon}`
    });

    let visionData = { labels: [], objects: [] };
    
    // Step 1: Google Vision Analysis (if image provided)
    if (image) {
      try {
        console.log('Running Google Vision analysis...');
        visionData = await analyzeWithGoogleVision(image);
        console.log('Google Vision results:', visionData);
      } catch (error) {
        console.error('Google Vision error:', error);
        // Continue without vision data
      }
    }

    // Step 2: Claude AI Analysis (with Vision data + environment)
    console.log('Running Claude AI analysis...');
    const claudeAnalysis = await analyzeWithClaudeHybrid({
      image,
      visionData,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      elevation: parseFloat(elevation) || null,
      weather
    });

    // Step 3: Save to Airtable with all data
    await saveToAirtable({
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      elevation: parseFloat(elevation) || null,
      weather,
      visionData,
      analysis: claudeAnalysis,
      timestamp: new Date().toISOString()
    });

    res.status(200).json(claudeAnalysis);

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
    throw new Error('Google Elevation API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lon}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results?.[0]) {
      throw new Error(`Elevation API error: ${data.status}`);
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
    throw new Error('OpenWeather API key not configured');
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=it&appid=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.cod !== 200) {
      throw new Error(`Weather API error: ${data.cod}`);
    }
    
    return `${data.weather[0].description}, ${Math.round(data.main.temp)}°C`;
  } catch (error) {
    console.error('Weather fetch error:', error);
    throw error;
  }
}

// Google Vision Analysis
async function analyzeWithGoogleVision(imageBase64) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Vision API key not configured');
    return { labels: [], objects: [] };
  }

  try {
    const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{
          image: {
            content: imageBase64
          },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 15 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
            { type: 'TEXT_DETECTION', maxResults: 5 }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (data.responses?.[0]?.error) {
      throw new Error(data.responses[0].error.message);
    }

    const labels = data.responses?.[0]?.labelAnnotations || [];
    const objects = data.responses?.[0]?.localizedObjectAnnotations || [];
    const texts = data.responses?.[0]?.textAnnotations || [];

    // Filter and score labels for mushroom relevance
    const mushroomRelevantLabels = labels.filter(label => {
      const desc = label.description.toLowerCase();
      const mushroomKeywords = [
        'plant', 'tree', 'forest', 'vegetation', 'leaf', 'ground', 'soil', 
        'moss', 'wood', 'branch', 'grass', 'fungus', 'mushroom', 'nature',
        'outdoor', 'green', 'brown', 'organic', 'natural'
      ];
      return mushroomKeywords.some(keyword => desc.includes(keyword)) && label.score > 0.5;
    });

    return {
      labels: mushroomRelevantLabels,
      objects: objects.filter(obj => obj.score > 0.5),
      texts: texts.slice(0, 3) // First 3 text detections
    };

  } catch (error) {
    console.error('Google Vision error:', error);
    return { labels: [], objects: [], texts: [] };
  }
}

// Claude AI Hybrid Analysis (with Google Vision data)
async function analyzeWithClaudeHybrid({ image, visionData, lat, lon, elevation, weather }) {
  const claudeApiKey = process.env.CLAUDE_API_KEY;
  
  if (!claudeApiKey) {
    console.warn('Claude API key not configured, using enhanced fallback');
    return getEnhancedFallbackAnalysis({ visionData, elevation, weather });
  }

  try {
    const prompt = createHybridClaudePrompt({ lat, lon, elevation, weather, visionData });
    
    const messages = [
      {
        role: "user",
        content: image ? [
          {
            type: "text",
            text: prompt
          },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: image
            }
          }
        ] : [
          {
            type: "text", 
            text: prompt + "\n\nNOTA: Analisi senza foto diretta, basata su Google Vision data + dati ambientali."
          }
        ]
      }
    ];

    console.log('Calling Claude API with hybrid data...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1200,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const claudeResponse = data.content[0].text;

    console.log('Claude hybrid response received');

    // Parse Claude's structured response
    const analysis = parseClaudeResponse(claudeResponse, { elevation, weather, visionData });
    
    // Add hybrid analysis metadata
    analysis.analysisMethod = 'hybrid';
    analysis.visionLabelsUsed = visionData.labels?.length || 0;
    analysis.confidence = calculateHybridConfidence(analysis, visionData);
    
    return analysis;

  } catch (error) {
    console.error('Claude hybrid analysis error:', error);
    return getEnhancedFallbackAnalysis({ visionData, elevation, weather });
  }
}

// Create hybrid prompt for Claude (with Google Vision data)
function createHybridClaudePrompt({ lat, lon, elevation, weather, visionData }) {
  const visionLabels = visionData.labels?.map(l => `${l.description} (${Math.round(l.score * 100)}%)`).join(', ') || 'Nessuna';
  const visionObjects = visionData.objects?.map(o => o.name).join(', ') || 'Nessuno';

  return `Sei un esperto micologo che analizza terreni per la ricerca di funghi. Hai a disposizione dati da Google Vision API e dati ambientali.

DATI AMBIENTALI:
- Posizione: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E
- Altitudine: ${elevation || 'N/A'} metri
- Meteo attuale: ${weather || 'N/A'}

ANALISI GOOGLE VISION:
- Elementi rilevati: ${visionLabels}
- Oggetti identificati: ${visionObjects}

CONTESTO MICOLOGICO:
${elevation ? `
Altitudine ${elevation}m indica:
- Sotto 200m: funghi da pianura (prataioli, pleurotus)
- 200-800m: funghi di collina (porcini, finferli)  
- 800-1500m: funghi montani (porcini, ovoli)
- Sopra 1500m: funghi alpini (lactarius, russule)
` : ''}

ISTRUZIONI:
1. Combina i dati Google Vision con la tua analisi esperta
2. I dati Vision ti danno gli elementi base presenti (vegetazione, terreno, oggetti)
3. Tu fornisci il ragionamento micologico contestuale
4. Considera la stagione autunnale (periodo migliore per funghi)

Fornisci una risposta in questo formato JSON:
{
  "probability": [numero 0-100],
  "analysis": "[analisi dettagliata che spiega come i dati Vision si collegano alle condizioni per funghi]",
  "factors": {
    "temperature": "[Ottimale/Buona/Scarsa]",
    "humidity": "[Alta/Media/Bassa]", 
    "vegetation": "[Ricca/Media/Scarsa/Assente]"
  },
  "recommendations": "[consigli specifici basati su elementi Vision rilevati]",
  "species_likely": "[specie probabili considerando altitudine + vegetazione rilevata]",
  "best_spots": "[dove cercare basandoti sui dati Vision]",
  "vision_insights": "[come i dati Google Vision influenzano la tua valutazione]",
  "confidence": "[Alta/Media/Bassa]"
}

Sii preciso e spiega come usi i dati Google Vision nella tua analisi micologica.`;
}

// Parse Claude's response into structured data
function parseClaudeResponse(response, { elevation, weather, visionData }) {
  try {
    // Try to extract JSON from Claude's response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        probability: Math.min(100, Math.max(0, parsed.probability || 0)),
        analysis: parsed.analysis || 'Analisi completata',
        factors: {
          temperature: parsed.factors?.temperature || 'N/A',
          humidity: parsed.factors?.humidity || 'N/A',
          vegetation: parsed.factors?.vegetation || 'N/A'
        },
        recommendations: parsed.recommendations || '',
        species_likely: parsed.species_likely || '',
        best_spots: parsed.best_spots || '',
        vision_insights: parsed.vision_insights || '',
        confidence: parsed.confidence || 'Media',
        timestamp: new Date().toISOString(),
        source: 'claude-ai-hybrid'
      };
    }
  } catch (error) {
    console.error('Error parsing Claude response:', error);
  }

  // Fallback parsing
  return parseTextResponse(response, { elevation, weather, visionData });
}

// Calculate confidence based on available data
function calculateHybridConfidence(analysis, visionData) {
  let confidence = 'Media';
  
  const hasVisionData = visionData.labels?.length > 0;
  const hasEnvironmentalData = analysis.factors.temperature !== 'N/A' || analysis.factors.humidity !== 'N/A';
  const highProbability = analysis.probability > 60;
  
  if (hasVisionData && hasEnvironmentalData && highProbability) {
    confidence = 'Alta';
  } else if (hasVisionData || hasEnvironmentalData) {
    confidence = 'Media';
  } else {
    confidence = 'Bassa';
  }
  
  return confidence;
}

// Enhanced fallback when Claude is not available
function getEnhancedFallbackAnalysis({ visionData, elevation, weather }) {
  let probability = 30;
  
  // Vision-based scoring
  if (visionData.labels?.length > 0) {
    const mushroomFriendlyLabels = ['tree', 'forest', 'vegetation', 'plant', 'leaf', 'moss', 'wood'];
    const foundFriendly = visionData.labels.filter(label => 
      mushroomFriendlyLabels.some(keyword => 
        label.description.toLowerCase().includes(keyword)
      )
    );
    probability += Math.min(foundFriendly.length * 8, 30);
  }
  
  // Environmental factors
  if (elevation >= 200 && elevation <= 1500) probability += 20;
  if (weather?.includes('umid') || weather?.includes('pioggia')) probability += 15;
  
  return {
    probability: Math.min(95, probability),
    analysis: `Analisi basata su ${visionData.labels?.length || 0} elementi rilevati da Google Vision e dati ambientali.`,
    factors: {
      temperature: weather?.includes('°C') ? 'Buona' : 'N/A',
      humidity: weather?.includes('pioggia') ? 'Alta' : 'Media',
      vegetation: visionData.labels?.some(l => l.description.toLowerCase().includes('tree')) ? 'Media' : 'Scarsa'
    },
    recommendations: 'Cerca vicino alla vegetazione rilevata.',
    species_likely: 'Dipende dalla stagione e microclima locale',
    best_spots: 'Zone umide con decomposizione organica',
    vision_insights: `Google Vision ha rilevato: ${visionData.labels?.map(l => l.description).join(', ') || 'elementi base'}`,
    confidence: 'Media',
    timestamp: new Date().toISOString(),
    source: 'enhanced-fallback',
    analysisMethod: 'fallback-hybrid'
  };
}

// Parse text response as fallback
function parseTextResponse(response, { visionData }) {
  const probMatch = response.match(/(\d+)%/);
  const probability = probMatch ? parseInt(probMatch[1]) : 50;

  return {
    probability,
    analysis: response.substring(0, 400) + '...',
    factors: {
      temperature: 'N/A',
      humidity: 'N/A', 
      vegetation: visionData.labels?.length > 0 ? 'Media' : 'N/A'
    },
    recommendations: 'Consulta l\'analisi completa per dettagli.',
    species_likely: '',
    best_spots: '',
    vision_insights: `${visionData.labels?.length || 0} elementi rilevati da Google Vision`,
    confidence: 'Bassa',
    timestamp: new Date().toISOString(),
    source: 'claude-ai-text-fallback'
  };
}

// Save to Airtable with hybrid data
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
    
    const visionLabels = data.visionData.labels?.map(l => l.description).join(', ') || '';
    
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
          'Raccomandazioni': data.analysis.recommendations || '',
          'Specie_Probabili': data.analysis.species_likely || '',
          'Zone_Migliori': data.analysis.best_spots || '',
          'Vision_Labels': visionLabels,
          'Vision_Insights': data.analysis.vision_insights || '',
          'Confidenza': data.analysis.confidence || 'Media',
          'Metodo_Analisi': data.analysis.analysisMethod || 'hybrid',
          'Timestamp': data.timestamp,
          'Fattori_Temp': data.analysis.factors.temperature,
          'Fattori_Umidita': data.analysis.factors.humidity,
          'Fattori_Vegetazione': data.analysis.factors.vegetation,
          'Fonte_Analisi': data.analysis.source || 'hybrid-ai'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable error:', errorText);
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Saved to Airtable with hybrid AI data:', result.id);
    return result;

  } catch (error) {
    console.error('Airtable save error:', error);
    return null;
  }
}