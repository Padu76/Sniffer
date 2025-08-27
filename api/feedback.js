// /api/feedback.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

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

    const feedbackId = await saveFeedbackToNeon(client, {
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

    const zoneAccuracy = await calculateZoneAccuracy(client, lat, lon);
    await updateMLWeights(client, {
      lat,
      lon,
      elevation,
      weather,
      predicted,
      actual: found,
      analysis
    });

    return res.status(200).json({
      success: true,
      feedbackId: feedbackId,
      accuracy: zoneAccuracy,
      message: 'Feedback salvato con successo'
    });

  } catch (error) {
    console.error('Error processing feedback:', error);
    return res.status(500).json({
      error: 'Errore nel salvataggio feedback',
      details: error.message
    });
  } finally {
    client.release();
  }
}

async function saveFeedbackToNeon(client, data) {
  try {
    const insertQuery = `
      INSERT INTO feedback (
        scan_id, found_mushrooms, predicted_probability,
        latitude, longitude, elevation, weather_description,
        complete_analysis, timestamp, accuracy, zone_hash,
        season, weather_category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const result = await client.query(insertQuery, [
      data.scanId,
      data.found,
      data.predicted,
      data.lat,
      data.lon,
      data.elevation,
      data.weather,
      JSON.stringify(data.analysis),
      data.timestamp || new Date().toISOString(),
      calculateAccuracy(data.predicted, data.found),
      generateZoneHash(data.lat, data.lon),
      getCurrentSeason(),
      categorizeWeather(data.weather)
    ]);

    console.log('Feedback saved to Neon:', result.rows[0].id);
    return result.rows[0].id;

  } catch (error) {
    console.error('Neon feedback save error:', error);
    return null;
  }
}

function calculateAccuracy(predicted, found) {
  const prediction = predicted > 50;
  return prediction === found ? 100 : 0;
}

function generateZoneHash(lat, lon) {
  const zoneLat = Math.round(lat * 1000) / 1000;
  const zoneLon = Math.round(lon * 1000) / 1000;
  return `${zoneLat},${zoneLon}`;
}

function getCurrentSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Primavera';
  if (month >= 6 && month <= 8) return 'Estate';
  if (month >= 9 && month <= 11) return 'Autunno';
  return 'Inverno';
}

function categorizeWeather(weather) {
  if (!weather) return 'Unknown';
  
  const w = weather.toLowerCase();
  if (w.includes('pioggia') || w.includes('temporale')) return 'Rainy';
  if (w.includes('nuvol')) return 'Cloudy';
  if (w.includes('sole')) return 'Sunny';
  if (w.includes('nebbia')) return 'Foggy';
  return 'Other';
}

async function calculateZoneAccuracy(client, lat, lon) {
  try {
    const zoneHash = generateZoneHash(lat, lon);
    
    const query = `
      SELECT accuracy FROM feedback 
      WHERE zone_hash = $1
    `;
    
    const result = await client.query(query, [zoneHash]);
    const records = result.rows;

    if (records.length === 0) {
      return null;
    }

    const accurateCount = records.filter(record => record.accuracy === 100).length;
    const accuracy = (accurateCount / records.length) * 100;
    
    console.log(`Zone accuracy: ${accuracy.toFixed(1)}% (${accurateCount}/${records.length})`);
    return accuracy;

  } catch (error) {
    console.error('Error calculating zone accuracy:', error);
    return null;
  }
}

async function updateMLWeights(client, data) {
  try {
    const zoneHash = generateZoneHash(data.lat, data.lon);
    const existingWeights = await getExistingWeights(client, zoneHash);

    const weights = {
      elevation_weight: calculateElevationWeight(data.elevation, data.actual),
      weather_weight: calculateWeatherWeight(data.weather, data.actual),
      season_weight: calculateSeasonWeight(data.actual),
      zone_bias: data.actual ? 1 : -1,
      last_updated: new Date().toISOString()
    };

    if (existingWeights) {
      await updateExistingWeights(client, existingWeights.id, weights);
    } else {
      await createNewWeights(client, zoneHash, weights, data);
    }

    console.log('ML weights updated for zone:', zoneHash);

  } catch (error) {
    console.error('Error updating ML weights:', error);
  }
}

function calculateElevationWeight(elevation, found) {
  if (!elevation) return 0;
  const optimal = elevation >= 200 && elevation <= 1500;
  
  if (found && optimal) return 0.1;
  if (!found && !optimal) return 0.1;
  return -0.05;
}

function calculateWeatherWeight(weather, found) {
  if (!weather) return 0;
  
  const w = weather.toLowerCase();
  const favorable = w.includes('pioggia') || w.includes('umid') || w.includes('nuvol');
  
  if (found && favorable) return 0.1;
  if (!found && !favorable) return 0.1;
  return -0.05;
}

function calculateSeasonWeight(found) {
  const season = getCurrentSeason();
  
  if (season === 'Autunno') {
    return found ? 0.15 : -0.1;
  }
  
  if (season === 'Primavera') {
    return found ? 0.1 : -0.05;
  }
  
  return found ? 0.05 : 0.05;
}

async function getExistingWeights(client, zoneHash) {
  try {
    const query = `SELECT * FROM ml_weights WHERE zone_hash = $1 LIMIT 1`;
    const result = await client.query(query, [zoneHash]);
    return result.rows[0] || null;

  } catch (error) {
    console.error('Error getting existing weights:', error);
    return null;
  }
}

async function updateExistingWeights(client, recordId, newWeights) {
  try {
    const query = `
      UPDATE ml_weights 
      SET elevation_weight = $2, weather_weight = $3, season_weight = $4,
          zone_bias = $5, last_updated = $6, sample_count = sample_count + 1
      WHERE id = $1
    `;
    
    await client.query(query, [
      recordId,
      newWeights.elevation_weight,
      newWeights.weather_weight,
      newWeights.season_weight,
      newWeights.zone_bias,
      newWeights.last_updated
    ]);

  } catch (error) {
    console.error('Error updating weights:', error);
  }
}

async function createNewWeights(client, zoneHash, weights, data) {
  try {
    const query = `
      INSERT INTO ml_weights (
        zone_hash, latitude, longitude, elevation_weight,
        weather_weight, season_weight, zone_bias, sample_count,
        created_at, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
    `;
    
    await client.query(query, [
      zoneHash,
      data.lat,
      data.lon,
      weights.elevation_weight,
      weights.weather_weight,
      weights.season_weight,
      weights.zone_bias,
      weights.last_updated,
      weights.last_updated
    ]);

  } catch (error) {
    console.error('Error creating weights:', error);
  }
}