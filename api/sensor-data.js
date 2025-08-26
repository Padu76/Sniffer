// /api/sensor-data.js
export default async function handler(req, res) {
  // CORS per ESP32
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      device_id, 
      timestamp, 
      data, 
      location, 
      scan_type = 'realtime',
      session_id 
    } = req.body;

    // Validazione dati essenziali
    if (!device_id || !data) {
      return res.status(400).json({ 
        error: 'device_id e data sono richiesti' 
      });
    }

    // Prepara record per Airtable
    const sensorRecord = {
      device_id: device_id,
      timestamp: timestamp || new Date().toISOString(),
      scan_type: scan_type,
      session_id: session_id,
      
      // Dati BME688
      gas_resistance: data.gas_resistance,
      temperature: data.temperature,
      humidity: data.humidity, 
      pressure: data.pressure,
      voc_index: data.voc_index,
      
      // Dati GPS (se disponibili)
      latitude: location?.latitude,
      longitude: location?.longitude,
      altitude: location?.altitude,
      
      // Analisi AI (se presente)
      ai_probability: data.ai_probability,
      target_detected: data.target_detected,
      confidence_level: data.confidence_level,
      
      // Raw data JSON per debugging
      raw_data: JSON.stringify(data)
    };

    // Salva su Airtable tabella "sensor_readings"
    const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/sensor_readings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: sensorRecord
        }]
      })
    });

    if (!airtableResponse.ok) {
      const errorDetails = await airtableResponse.text();
      throw new Error(`Airtable error: ${errorDetails}`);
    }

    const result = await airtableResponse.json();

    // Aggiorna last_seen del device
    await updateDeviceLastSeen(device_id);

    return res.status(200).json({
      success: true,
      message: 'Dati sensore salvati',
      record_id: result.records[0].id,
      timestamp: timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error('Errore sensor-data:', error);
    return res.status(500).json({ 
      error: 'Errore salvataggio dati sensore',
      details: error.message 
    });
  }
}

// Funzione helper per aggiornare last_seen del device
async function updateDeviceLastSeen(device_id) {
  try {
    // Prima trova il record del device
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/devices?filterByFormula={device_id}='${device_id}'`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    const searchResult = await searchResponse.json();
    
    if (searchResult.records.length > 0) {
      const recordId = searchResult.records[0].id;
      
      // Aggiorna last_seen
      await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/devices/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            last_seen: new Date().toISOString(),
            status: 'active'
          }
        })
      });
    }
  } catch (error) {
    console.log('Errore aggiornamento last_seen:', error);
  }
}