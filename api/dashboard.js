export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { type } = req.query;

    if (!type) {
      return res.status(400).json({ error: 'Type parameter required' });
    }

    let data;
    switch (type) {
      case 'feedback':
        data = await getFeedbackData();
        break;
      case 'scansioni':
        data = await getScanData();
        break;
      case 'weights':
        data = await getMLWeights();
        break;
      case 'analytics':
        data = await getAnalytics();
        break;
      default:
        return res.status(400).json({ error: 'Invalid type parameter' });
    }

    res.status(200).json(data);

  } catch (error) {
    console.error('Dashboard API error:', error);
    res.status(500).json({
      error: 'Errore nel recupero dati dashboard',
      details: error.message
    });
  }
}

// Get feedback data from Airtable
async function getFeedbackData() {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'feedback';
  
  if (!token) {
    console.warn('Airtable token not configured, returning mock data');
    return { records: generateMockFeedbackData() };
  }

  try {
    // Get all feedback records, sorted by timestamp desc
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?sort[0][field]=Timestamp&sort[0][direction]=desc&maxRecords=200`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.records?.length || 0} feedback records`);
    
    return data;

  } catch (error) {
    console.error('Error fetching feedback data:', error);
    // Return mock data as fallback
    return { records: generateMockFeedbackData() };
  }
}

// Get scan data from Airtable
async function getScanData() {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'scansioni';
  
  if (!token) {
    console.warn('Airtable token not configured, returning mock data');
    return { records: generateMockScanData() };
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}?sort[0][field]=Timestamp&sort[0][direction]=desc&maxRecords=200`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.records?.length || 0} scan records`);
    
    return data;

  } catch (error) {
    console.error('Error fetching scan data:', error);
    return { records: generateMockScanData() };
  }
}

// Get ML weights data
async function getMLWeights() {
  const token = process.env.VITE_AIRTABLE_TOKEN;
  const baseId = 'app70ymOnJLKk19B9';
  const tableName = 'ml_weights';
  
  if (!token) {
    return { records: [] };
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/${tableName}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!response.ok) {
      throw new Error(`Airtable API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.records?.length || 0} ML weight records`);
    
    return data;

  } catch (error) {
    console.error('Error fetching ML weights:', error);
    return { records: [] };
  }
}

// Get computed analytics
async function getAnalytics() {
  try {
    const [feedbackData, scanData, weightsData] = await Promise.all([
      getFeedbackData(),
      getScanData(),
      getMLWeights()
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

// Analytics calculation functions
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
  // Group by day and calculate daily accuracy
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
    .filter(([zone, data]) => data.total >= 3) // At least 3 samples
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

// Mock data generators
function generateMockFeedbackData() {
  const mockData = [];
  const weatherTypes = ['Rainy', 'Cloudy', 'Sunny', 'Foggy'];
  const seasons = ['Primavera', 'Estate', 'Autunno', 'Inverno'];
  
  for (let i = 0; i < 50; i++) {
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

function generateMockScanData() {
  // Similar structure to feedback but with different fields
  return [];
}