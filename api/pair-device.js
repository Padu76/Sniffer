// /api/pair-device.js
export default async function handler(req, res) {
  // Abilita CORS per ESP32
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_id, device_name, mac_address, firmware_version } = req.body;
    
    // Validazione dati
    if (!device_id || !mac_address) {
      return res.status(400).json({ 
        error: 'device_id e mac_address sono richiesti' 
      });
    }

    // Salva device su Airtable
    const deviceData = {
      device_id: device_id,
      device_name: device_name || `Sonda ${device_id}`,
      mac_address: mac_address,
      firmware_version: firmware_version || '1.0.0',
      status: 'connected',
      first_connection: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };

    // Chiamata Airtable per salvare device
    const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/devices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: deviceData
        }]
      })
    });

    if (!airtableResponse.ok) {
      throw new Error('Errore salvataggio su Airtable');
    }

    const result = await airtableResponse.json();

    // Risposta di successo all'ESP32
    return res.status(200).json({
      success: true,
      message: 'Device connesso con successo',
      device_id: device_id,
      record_id: result.records[0].id,
      api_endpoints: {
        sensor_data: '/api/sensor-data',
        start_training: '/api/start-training',
        save_model: '/api/save-model'
      }
    });

  } catch (error) {
    console.error('Errore pair-device:', error);
    return res.status(500).json({ 
      error: 'Errore interno server',
      details: error.message 
    });
  }
}