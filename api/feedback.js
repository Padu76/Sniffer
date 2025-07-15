export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      scanId,
      found,
      predicted,
      lat,
      lon,
      elevation,
      weather,
      analysis,
      timestamp
    } = req.body;

    if (!scanId || found === undefined) {
      return res.status(400).json({ error: 'Dati feedback mancanti' });
    }

    console.log('Processing feedback:', { scanId, found, predicted });

    // Save feedback to Airtable
    const feedbackRecord = await saveFeedbackToAirtable({
      scanId,
      found,
      predicted,
      lat,
      lon,
      elevation,
      weather,
      analysis,
      timestamp
    });

    // Calculate zone accuracy
    const zoneAccuracy = await calculateZoneAccuracy(lat, lon);

    // Update ML model weights (simplified version)
    await updateMLWeights({
      lat,
      lon,
      elevation,
      weather,
      predicted,
      actual: found,
      analysis
    });

    res.status(200).json({
      success: true,
      feedbackId: feedbackRecord?.id,
      accuracy: zoneAccuracy,
      message: 'Feedback salvato con successo'
    });

  } catch (error) {
    console.error('Error processing feedback:', error);
    res.status(500).json({
      error: 'Errore nel salvataggio feedback',
      details: error.message
    });
  }
}

// Save feedback to Airtable
async function saveFeedbackToAirtable(data) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'feedback'; // New table for feedback
  
  if (!token) {
    console.warn('Airtable token not configured, skipping feedback save');
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
          'Scan_ID': data.scanId,
          'Found_Mushrooms': data.found,
          'Predicted_Probability': data.predicted,
          'Latitudine': data.lat,
          'Longitudine': data.lon,
          'Altitudine': data.elevation,
          'Meteo': data.weather,
          'Analisi_Completa': JSON.stringify(data.analysis),
          'Timestamp': data.timestamp,
          'Accuracy': calculateAccuracy(data.predicted, data.found),
          'Zone_Hash': generateZoneHash(data.lat, data.lon),
          'Season': getCurrentSeason(),
          'Weather_Category': categorizeWeather(data.weather)
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Airtable feedback error:', errorText);
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Feedback saved to Airtable:', result.id);
    return result;

  } catch (error) {
    console.error('Airtable feedback save error:', error);
    return null;
  }
}

// Calculate accuracy for this specific prediction
function calculateAccuracy(predicted, found) {
  // Simple accuracy calculation
  // If predicted > 50% and found = true, or predicted <= 50% and found = false, it's accurate
  const prediction = predicted > 50;
  return prediction === found ? 100 : 0;
}

// Generate zone hash for grouping nearby locations
function generateZoneHash(lat, lon) {
  // Round to ~100m precision for zone grouping
  const zoneLat = Math.round(lat * 1000) / 1000;
  const zoneLon = Math.round(lon * 1000) / 1000;
  return `${zoneLat},${zoneLon}`;
}

// Get current season
function getCurrentSeason() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'Primavera';
  if (month >= 6 && month <= 8) return 'Estate';
  if (month >= 9 && month <= 11) return 'Autunno';
  return 'Inverno';
}

// Categorize weather for ML
function categorizeWeather(weather) {
  if (!weather) return 'Unknown';
  
  const w = weather.toLowerCase();
  if (w.includes('pioggia') || w.includes('temporale')) return 'Rainy';
  if (w.includes('nuvol')) return 'Cloudy';
  if (w.includes('sole')) return 'Sunny';
  if (w.includes('nebbia')) return 'Foggy';
  return 'Other';
}

// Calculate zone accuracy based on historical data
async function calculateZoneAccuracy(lat, lon) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'feedback';
  
  if (!token) {
    return null;
  }

  try {
    const zoneHash = generateZoneHash(lat, lon);
    
    // Get all feedback for this zone
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula={Zone_Hash}='${zoneHash}'`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable query error: ${response.status}`);
    }

    const data = await response.json();
    const records = data.records || [];

    if (records.length === 0) {
      return null; // No historical data yet
    }

    // Calculate accuracy percentage
    const accurateCount = records.filter(record => 
      record.fields.Accuracy === 100
    ).length;

    const accuracy = (accurateCount / records.length) * 100;
    
    console.log(`Zone accuracy: ${accuracy.toFixed(1)}% (${accurateCount}/${records.length})`);
    return accuracy;

  } catch (error) {
    console.error('Error calculating zone accuracy:', error);
    return null;
  }
}

// Update ML model weights (simplified version)
async function updateMLWeights(data) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'ml_weights'; // New table for ML weights
  
  if (!token) {
    console.warn('Airtable token not configured, skipping ML update');
    return null;
  }

  try {
    // Simple ML logic: adjust weights based on feedback
    const weights = {
      elevation_weight: calculateElevationWeight(data.elevation, data.actual),
      weather_weight: calculateWeatherWeight(data.weather, data.actual),
      season_weight: calculateSeasonWeight(data.actual),
      zone_bias: data.actual ? 1 : -1, // Simple bias adjustment
      update_timestamp: new Date().toISOString()
    };

    // Check if weights exist for this zone
    const zoneHash = generateZoneHash(data.lat, data.lon);
    const existingWeights = await getExistingWeights(zoneHash);

    if (existingWeights) {
      // Update existing weights
      await updateExistingWeights(existingWeights.id, weights);
    } else {
      // Create new weights
      await createNewWeights(zoneHash, weights, data);
    }

    console.log('ML weights updated for zone:', zoneHash);

  } catch (error) {
    console.error('Error updating ML weights:', error);
  }
}

// Calculate elevation weight adjustment
function calculateElevationWeight(elevation, found) {
  if (!elevation) return 0;
  
  // Mushrooms typically prefer 200-1500m
  const optimal = elevation >= 200 && elevation <= 1500;
  
  if (found && optimal) return 0.1; // Increase weight for optimal elevation
  if (!found && !optimal) return 0.1; // Increase weight against non-optimal
  return -0.05; // Decrease weight if prediction was wrong
}

// Calculate weather weight adjustment
function calculateWeatherWeight(weather, found) {
  if (!weather) return 0;
  
  const w = weather.toLowerCase();
  const favorable = w.includes('pioggia') || w.includes('umid') || w.includes('nuvol');
  
  if (found && favorable) return 0.1;
  if (!found && !favorable) return 0.1;
  return -0.05;
}

// Calculate season weight adjustment
function calculateSeasonWeight(found) {
  const season = getCurrentSeason();
  
  // Autumn is best season for mushrooms
  if (season === 'Autunno') {
    return found ? 0.15 : -0.1;
  }
  
  // Spring is also good
  if (season === 'Primavera') {
    return found ? 0.1 : -0.05;
  }
  
  // Summer and winter are less favorable
  return found ? 0.05 : 0.05;
}

// Get existing ML weights for zone
async function getExistingWeights(zoneHash) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'ml_weights';
  
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?filterByFormula={Zone_Hash}='${zoneHash}'&maxRecords=1`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable query error: ${response.status}`);
    }

    const data = await response.json();
    return data.records?.[0] || null;

  } catch (error) {
    console.error('Error getting existing weights:', error);
    return null;
  }
}

// Update existing ML weights
async function updateExistingWeights(recordId, newWeights) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'ml_weights';
  
  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}/${recordId}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          'Elevation_Weight': newWeights.elevation_weight,
          'Weather_Weight': newWeights.weather_weight,
          'Season_Weight': newWeights.season_weight,
          'Zone_Bias': newWeights.zone_bias,
          'Last_Updated': newWeights.update_timestamp
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Airtable update error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error updating weights:', error);
    return null;
  }
}

// Create new ML weights for zone
async function createNewWeights(zoneHash, weights, data) {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'ml_weights';
  
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
          'Zone_Hash': zoneHash,
          'Latitudine': data.lat,
          'Longitudine': data.lon,
          'Elevation_Weight': weights.elevation_weight,
          'Weather_Weight': weights.weather_weight,
          'Season_Weight': weights.season_weight,
          'Zone_Bias': weights.zone_bias,
          'Sample_Count': 1,
          'Created': weights.update_timestamp,
          'Last_Updated': weights.update_timestamp
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Airtable create error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error creating weights:', error);
    return null;
  }
}