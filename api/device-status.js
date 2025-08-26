// /api/device-status.js
export default async function handler(req, res) {
  // CORS per ESP32 e Web App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Web App richiede status di un device
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id richiesto' });
    }

    try {
      // Ottieni ultimo status del device
      const deviceStatus = await getLatestDeviceStatus(device_id);
      
      if (!deviceStatus) {
        return res.status(404).json({ 
          error: 'Device non trovato o mai connesso',
          device_id: device_id 
        });
      }

      return res.status(200).json({
        success: true,
        device_id: device_id,
        status: deviceStatus,
        last_updated: deviceStatus.timestamp
      });

    } catch (error) {
      console.error('Errore get device status:', error);
      return res.status(500).json({ 
        error: 'Errore recupero status',
        details: error.message 
      });
    }
  }

  if (req.method === 'POST') {
    // ESP32 invia aggiornamento status
    const { 
      device_id, 
      timestamp, 
      status, 
      wifi_rssi, 
      uptime, 
      device_state,
      current_sensor_data 
    } = req.body;

    if (!device_id || !status) {
      return res.status(400).json({ 
        error: 'device_id e status sono richiesti' 
      });
    }

    try {
      // Prepara record status per Airtable
      const statusRecord = {
        device_id: device_id,
        timestamp: timestamp || new Date().toISOString(),
        status: status, // online, offline, error
        wifi_rssi: wifi_rssi || 0,
        uptime_ms: uptime || 0,
        
        // Stato device (training, scanning, etc.)
        training_active: device_state?.training_active || false,
        scanning_active: device_state?.scanning_active || false,
        current_target: device_state?.current_target || '',
        training_session: device_state?.training_session || '',
        training_phase: device_state?.training_phase || 0,
        sample_count: device_state?.sample_count || 0,
        
        // Dati sensore attuali (se presenti)
        current_gas_resistance: current_sensor_data?.gas_resistance || 0,
        current_temperature: current_sensor_data?.temperature || 0,
        current_humidity: current_sensor_data?.humidity || 0,
        current_voc_index: current_sensor_data?.voc_index || 0,
        
        // Raw data per debugging
        raw_device_state: JSON.stringify(device_state || {}),
        raw_sensor_data: JSON.stringify(current_sensor_data || {})
      };

      // Salva status su Airtable
      const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: statusRecord
          }]
        })
      });

      if (!airtableResponse.ok) {
        const errorText = await airtableResponse.text();
        throw new Error(`Airtable error: ${errorText}`);
      }

      const result = await airtableResponse.json();

      // Aggiorna anche la tabella devices con last_seen
      await updateDeviceLastSeen(device_id, status);

      return res.status(200).json({
        success: true,
        message: 'Status aggiornato',
        record_id: result.records[0].id,
        timestamp: statusRecord.timestamp
      });

    } catch (error) {
      console.error('Errore update device status:', error);
      return res.status(500).json({ 
        error: 'Errore aggiornamento status',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper per ottenere ultimo status device
async function getLatestDeviceStatus(device_id) {
  try {
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_status?` +
      `filterByFormula={device_id}='${device_id}'&` +
      `sort[0][field]=timestamp&sort[0][direction]=desc&maxRecords=1`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Errore ricerca status');
    }

    const result = await searchResponse.json();
    
    if (result.records.length > 0) {
      const record = result.records[0].fields;
      
      return {
        status: record.status,
        timestamp: record.timestamp,
        wifi_rssi: record.wifi_rssi,
        uptime: record.uptime_ms,
        training_active: record.training_active,
        scanning_active: record.scanning_active,
        current_target: record.current_target,
        training_session: record.training_session,
        training_phase: record.training_phase,
        sample_count: record.sample_count,
        sensor_data: {
          gas_resistance: record.current_gas_resistance,
          temperature: record.current_temperature,
          humidity: record.current_humidity,
          voc_index: record.current_voc_index
        }
      };
    }
    
    return null;
  } catch (error) {
    console.error('Errore getLatestDeviceStatus:', error);
    return null;
  }
}

// Helper per aggiornare last_seen nella tabella devices
async function updateDeviceLastSeen(device_id, current_status) {
  try {
    // Trova il record del device
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
      
      // Aggiorna last_seen e status
      await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/devices/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            last_seen: new Date().toISOString(),
            status: current_status
          }
        })
      });
    }
  } catch (error) {
    console.log('Errore aggiornamento device last_seen:', error);
  }
}