// /api/pair-device.js
export default async function handler(req, res) {
  // CORS per ESP32 e Web App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'Pair Device API - Use POST method',
      endpoints: {
        pair: 'POST /api/pair-device',
        status: 'GET /api/device-status?device_id=xxx'
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { device_id, device_name, mac_address, firmware_version } = req.body;
    
    console.log('Pair device request:', { device_id, device_name, mac_address, firmware_version });
    
    // Validazione dati
    if (!device_id || !mac_address) {
      return res.status(400).json({ 
        error: 'device_id e mac_address sono richiesti',
        received: { device_id, mac_address }
      });
    }

    // Prepara i dati per Airtable
    const deviceData = {
      device_id: device_id,
      device_name: device_name || `Sonda ${device_id}`,
      mac_address: mac_address,
      firmware_version: firmware_version || '1.0.0',
      status: 'connected',
      first_connection: new Date().toISOString(),
      last_seen: new Date().toISOString()
    };

    console.log('Sending to Airtable:', deviceData);
    console.log('Base ID:', process.env.AIRTABLE_BASE_ID);
    console.log('Token exists:', !!process.env.AIRTABLE_TOKEN);
    console.log('Token starts with pat:', process.env.AIRTABLE_TOKEN?.startsWith('pat'));

    // URL completa per debug
    const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/devices`;
    console.log('Airtable URL:', airtableUrl);

    // Chiamata Airtable per salvare device
    const airtableResponse = await fetch(airtableUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: deviceData
        }]
      })
    });

    console.log('Airtable response status:', airtableResponse.status);
    console.log('Airtable response headers:', Object.fromEntries(airtableResponse.headers));

    // Leggi la risposta completa
    const responseText = await airtableResponse.text();
    console.log('Airtable response body:', responseText);

    if (!airtableResponse.ok) {
      return res.status(500).json({
        error: 'Errore salvataggio su Airtable',
        details: {
          status: airtableResponse.status,
          statusText: airtableResponse.statusText,
          body: responseText,
          url: airtableUrl,
          baseId: process.env.AIRTABLE_BASE_ID
        }
      });
    }

    // Parse della risposta se OK
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(500).json({
        error: 'Errore parsing risposta Airtable',
        details: {
          parseError: parseError.message,
          responseText: responseText
        }
      });
    }

    console.log('Airtable success response:', result);

    // Risposta di successo all'ESP32
    return res.status(200).json({
      success: true,
      message: 'Device connesso con successo',
      device_id: device_id,
      record_id: result.records[0].id,
      api_endpoints: {
        sensor_data: '/api/sensor-data',
        device_status: '/api/device-status',
        device_command: '/api/device-command'
      },
      debug: {
        airtable_status: airtableResponse.status,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Errore generale pair-device:', error);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Errore interno server',
      details: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }
    });
  }
}