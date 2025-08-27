// /api/dashboard.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ error: 'Type parameter required' });
    }

    let data;
    switch (type) {
      case 'feedback':
        data = await getFeedbackData(client);
        break;
      case 'scansioni':
        data = await getScanData(client);
        break;
      case 'weights':
        data = await getMLWeights(client);
        break;
      case 'analytics':
        data = await getAnalytics(client);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      error: 'Errore nel recupero dati dashboard',
      details: error.message
    });
  } finally {
    client.release();
  }
}

// Get feedback data from Neon
async function getFeedbackData(client) {
  try {
    const query = `
      SELECT * FROM feedback 
      ORDER BY timestamp DESC 
      LIMIT 200
    `;
    
    const result = await client.query(query);
    console.log(`Retrieved ${result.rows.length} feedback records from Neon`);
    
    // Transform to match frontend expectations
    const records = result.rows.map(row => ({
      fields: {
        Scan_ID: row.scan_id,
        Found_Mushrooms: row.found_mushrooms,
        Predicted_Probability: row.predicted_probability,
        Latitudine: parseFloat(row.latitude),
        Longitudine: parseFloat(row.longitude),
        Altitudine: row.elevation,
        Accuracy: row.accuracy,
        Zone_Hash: row.zone_hash,
        Season: row.season,
        Weather_Category: row.weather_category,
        Timestamp: row.timestamp
      }
    }));
    
    return { records };

  } catch (error) {
    console.error('Error fetching feedback data:', error);
    return { records: generateMockFeedbackData() };
  }
}

// Get scan data from Neon
async function getScanData(client) {
  try {
    const query = `
      SELECT * FROM scansioni 
      ORDER BY timestamp DESC 
      LIMIT 200
    `;
    
    const result = await client.query(query);
    console.log(`Retrieved ${result.rows.length} scan records from Neon`);
    
    const records = result.rows.map(row => ({
      fields: {
        Target: row.target,
        Latitudine: parseFloat(row.latitude),
        Longitudine: parseFloat(row.longitude),
        Altitudine: row.elevation,
        Meteo: row.weather_description,
        Risultato_AI: row.ai_result,
        Score_Fungo: row.ai_score,
        VOC: parseFloat(row.voc_value),
        Umidita: parseFloat(row.humidity_value),
        Temperature: parseFloat(row.temperature),
        Timestamp: row.timestamp
      }
    }));
    
    return { records };

  } catch (error) {
    console.error('Error fetching scan data:', error);
    return { records: [] };
  }
}

// Get ML weights data from Neon
async function getMLWeights(client) {
  try {
    const query = `SELECT * FROM ml_weights ORDER BY last_updated DESC`;
    
    const result = await client.query(query);
    console.log(`Retrieved ${result.rows.length} ML weight records from Neon`);
    
    const records = result.rows.map(row => ({
      fields: {
        Zone_Hash: row.zone_hash,
        Latitudine: parseFloat(row.latitude),
        Longitudine: parseFloat(row.longitude),
        Elevation_Weight: parseFloat(row.elevation_weight),
        Weather_Weight: parseFloat(row.weather_weight),
        Season_Weight: parseFloat(row.season_weight),
        Zone_Bias: parseFloat(row.zone_bias),
        Sample_Count: row.sample_count,
        Last_Updated: row.last_updated
      }
    }));
    
    return { records };

  } catch (error) {
    console.error('Error fetching ML weights:', error);
    return { records: [] };
  }
}

// Get computed analytics
async function getAnalytics(client) {
  try {
    const [feedbackData, scanData, weightsData] = await Promise.all([
      getFeedbackData(client),
      getScanData(client), 
      getMLWeights(client)
    ]);

    const feedback = feedbackData.records || [];
    const scans = scanData.records || [];
    const weights = weightsData.records || [];

    // Compute analytics
    const analytics = {
      summary: {
        totalFeedback: feedback.length,
        totalScans: scans.length,
        totalZones: new Set(feedback.map(r => r.fields?.Zone_Hash)).size,
        overallAccuracy: calculateOverallAccuracy(feedback),
        successRate: calculateSuccessRate(feedback)
      },
      trends: {
        accuracyTrend: calculateAccuracyTrend(feedback),
        activityTrend: calculateActivityTrend(feedback),
        weatherPerformance: calculateWeatherPerformance(feedback),
        elevationPerformance: calculateElevationPerformance(feedback),
        seasonalPerformance: calculateSeasonalPerformance(feedback)
      },
      zones: {
        topPerformingZones: getTopPerformingZones(feedback),
        lowPerformingZones: getLowPerformingZones(feedback),
        mostActiveZones: getMostActiveZones(feedback)
      },
      mlStatus: {
        totalWeights: weights.length,
        activeZones: weights.filter(w => (w.fields?.Sample_Count || 0) > 2).length,
        averageZoneBias: calculateAverageZoneBias(weights),
        lastModelUpdate: getLastModelUpdate(weights)
      }
    };

    return { analytics };

  } catch (error) {
    console.error('Error computing analytics:', error);
    throw error;
  }
}

// Analytics calculation functions (unchanged from original)
function calculateOverallAccuracy(feedback) {
  if (feedback.length === 0) return 0;
  const accurate = feedback.filter(r => r.fields?.Accuracy === 100).length;
  return Math.round((accurate / feedback.length) * 100);
}

function calculateSuccessRate(feedback) {
  if (feedback.length === 0) return 0;
  const found = feedback.filter(r => r.fields?.Found_Mushrooms === true).length;
  return Math.round((found / feedback.length) * 100);
}

function calculateAccuracyTrend(feedback) {
  const dailyData = feedback.reduce((acc, record) => {
    const date = new Date(record.fields?.Timestamp).toDateString();
    if (!acc[date]) acc[date] = { total: 0, accurate: 0 };
    acc[date].total++;
    if (record.fields?.Accuracy === 100) acc[date].accurate++;
    return acc;
  }, {});

  return Object.entries(dailyData)
    .map(([date, data]) => ({
      date,
      accuracy: Math.round((data.accurate / data.total) * 100)
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateActivityTrend(feedback) {
  const dailyData = feedback.reduce((acc, record) => {
    const date = new Date(record.fields?.Timestamp).toDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(dailyData)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateWeatherPerformance(feedback) {
  const weatherData = feedback.reduce((acc, record) => {
    const weather = record.fields?.Weather_Category || 'Unknown';
    if (!acc[weather]) acc[weather] = { total: 0, found: 0 };
    acc[weather].total++;
    if (record.fields?.Found_Mushrooms) acc[weather].found++;
    return acc;
  }, {});

  return Object.entries(weatherData).map(([weather, data]) => ({
    weather,
    successRate: Math.round((data.found / data.total) * 100),
    total: data.total
  }));
}

function calculateElevationPerformance(feedback) {
  const elevationRanges = {
    '0-200m': [0, 200],
    '200-800m': [200, 800], 
    '800-1500m': [800, 1500],
    '1500m+': [1500, 10000]
  };

  const elevationData = {};
  Object.keys(elevationRanges).forEach(range => {
    elevationData[range] = { total: 0, found: 0 };
  });

  feedback.forEach(record => {
    const elevation = record.fields?.Altitudine || 0;
    for (const [range, [min, max]] of Object.entries(elevationRanges)) {
      if (elevation >= min && elevation < max) {
        elevationData[range].total++;
        if (record.fields?.Found_Mushrooms) elevationData[range].found++;
        break;
      }
    }
  });

  return Object.entries(elevationData).map(([range, data]) => ({
    range,
    successRate: data.total > 0 ? Math.round((data.found / data.total) * 100) : 0,
    total: data.total
  }));
}

function calculateSeasonalPerformance(feedback) {
  const seasonData = feedback.reduce((acc, record) => {
    const season = record.fields?.Season || 'Unknown';
    if (!acc[season]) acc[season] = { total: 0, found: 0 };
    acc[season].total++;
    if (record.fields?.Found_Mushrooms) acc[season].found++;
    return acc;
  }, {});

  return Object.entries(seasonData).map(([season, data]) => ({
    season,
    successRate: Math.round((data.found / data.total) * 100),
    total: data.total
  }));
}

function getTopPerformingZones(feedback) {
  const zoneData = feedback.reduce((acc, record) => {
    const zone = record.fields?.Zone_Hash;
    if (!zone) return acc;
    
    if (!acc[zone]) acc[zone] = { total: 0, found: 0, lat: record.fields?.Latitudine, lon: record.fields?.Longitudine };
    acc[zone].total++;
    if (record.fields?.Found_Mushrooms) acc[zone].found++;
    return acc;
  }, {});

  return Object.entries(zoneData)
    .filter(([zone, data]) => data.total >= 3)
    .map(([zone, data]) => ({
      zone,
      successRate: Math.round((data.found / data.total) * 100),
      total: data.total,
      coordinates: { lat: data.lat, lon: data.lon }
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 10);
}

function getLowPerformingZones(feedback) {
  const zoneData = feedback.reduce((acc, record) => {
    const zone = record.fields?.Zone_Hash;
    if (!zone) return acc;
    
    if (!acc[zone]) acc[zone] = { total: 0, found: 0, lat: record.fields?.Latitudine, lon: record.fields?.Longitudine };
    acc[zone].total++;
    if (record.fields?.Found_Mushrooms) acc[zone].found++;
    return acc;
  }, {});

  return Object.entries(zoneData)
    .filter(([zone, data]) => data.total >= 3)
    .map(([zone, data]) => ({
      zone,
      successRate: Math.round((data.found / data.total) * 100),
      total: data.total,
      coordinates: { lat: data.lat, lon: data.lon }
    }))
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, 10);
}

function getMostActiveZones(feedback) {
  const zoneData = feedback.reduce((acc, record) => {
    const zone = record.fields?.Zone_Hash;
    if (!zone) return acc;
    
    if (!acc[zone]) acc[zone] = { total: 0, lat: record.fields?.Latitudine, lon: record.fields?.Longitudine };
    acc[zone].total++;
    return acc;
  }, {});

  return Object.entries(zoneData)
    .map(([zone, data]) => ({
      zone,
      total: data.total,
      coordinates: { lat: data.lat, lon: data.lon }
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

function calculateAverageZoneBias(weights) {
  if (weights.length === 0) return 0;
  const totalBias = weights.reduce((sum, w) => sum + (w.fields?.Zone_Bias || 0), 0);
  return Math.round((totalBias / weights.length) * 100) / 100;
}

function getLastModelUpdate(weights) {
  if (weights.length === 0) return null;
  const dates = weights.map(w => new Date(w.fields?.Last_Updated)).filter(d => !isNaN(d));
  return dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;
}

// Mock data generator
function generateMockFeedbackData() {
  const mockData = [];
  const weatherTypes = ['Rainy', 'Cloudy', 'Sunny', 'Foggy'];
  const seasons = ['Primavera', 'Estate', 'Autunno', 'Inverno'];
  
  for (let i = 0; i < 20; i++) {
    const found = Math.random() > 0.6;
    const predicted = Math.round(Math.random() * 100);
    const accuracy = (found && predicted > 50) || (!found && predicted <= 50) ? 100 : 0;
    
    mockData.push({
      fields: {
        Scan_ID: `mock_${i}`,
        Found_Mushrooms: found,
        Predicted_Probability: predicted,
        Latitudine: 45.4 + (Math.random() - 0.5) * 0.1,
        Longitudine: 10.9 + (Math.random() - 0.5) * 0.1,
        Altitudine: Math.round(Math.random() * 1500),
        Accuracy: accuracy,
        Zone_Hash: `45.${Math.floor(Math.random() * 500)},10.${Math.floor(Math.random() * 1000)}`,
        Season: seasons[Math.floor(Math.random() * seasons.length)],
        Weather_Category: weatherTypes[Math.floor(Math.random() * weatherTypes.length)],
        Timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  }
  
  return mockData;
}