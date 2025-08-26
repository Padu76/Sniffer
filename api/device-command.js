// /api/device-command.js
export default async function handler(req, res) {
  // CORS per ESP32 e Web App
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // ESP32 richiede comandi pendenti
    const { device_id } = req.query;
    
    if (!device_id) {
      return res.status(400).json({ error: 'device_id richiesto' });
    }

    try {
      // Cerca comandi pendenti per questo device
      const command = await getDevicePendingCommand(device_id);
      
      if (command) {
        return res.status(200).json({
          has_command: true,
          command: {
            id: command.id,
            action: command.action,
            target_type: command.target_type,
            created_at: command.created_at
          }
        });
      } else {
        return res.status(200).json({
          has_command: false
        });
      }
    } catch (error) {
      console.error('Errore get command:', error);
      return res.status(500).json({ error: 'Errore interno server' });
    }
  }

  if (req.method === 'POST') {
    const { device_id } = req.body;
    
    // Se è richiesta da ESP32 (stesso endpoint ma POST per consistency)
    if (device_id && !req.body.action) {
      try {
        const command = await getDevicePendingCommand(device_id);
        
        if (command) {
          return res.status(200).json({
            has_command: true,
            command: {
              id: command.id,
              action: command.action,
              target_type: command.target_type,
              created_at: command.created_at
            }
          });
        } else {
          return res.status(200).json({
            has_command: false
          });
        }
      } catch (error) {
        console.error('Errore get command:', error);
        return res.status(500).json({ error: 'Errore interno server' });
      }
    }

    // Se è invio comando da Web App
    const { action, target_type } = req.body;
    
    if (!device_id || !action) {
      return res.status(400).json({ 
        error: 'device_id e action sono richiesti' 
      });
    }

    try {
      // Crea nuovo comando per il device
      const commandRecord = {
        device_id: device_id,
        action: action,
        target_type: target_type || 'funghi_porcini',
        status: 'pending',
        created_at: new Date().toISOString(),
        sent_from: 'web_app'
      };

      // Salva comando su Airtable
      const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_commands`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: commandRecord
          }]
        })
      });

      if (!airtableResponse.ok) {
        throw new Error('Errore salvataggio comando');
      }

      const result = await airtableResponse.json();

      return res.status(200).json({
        success: true,
        message: 'Comando inviato al device',
        command_id: result.records[0].id,
        action: action,
        device_id: device_id,
        status: 'pending'
      });

    } catch (error) {
      console.error('Errore send command:', error);
      return res.status(500).json({ 
        error: 'Errore invio comando',
        details: error.message 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper per ottenere comando pendente
async function getDevicePendingCommand(device_id) {
  try {
    // Cerca comandi pendenti per questo device (ordinati per data)
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_commands?` +
      `filterByFormula=AND({device_id}='${device_id}', {status}='pending')&` +
      `sort[0][field]=created_at&sort[0][direction]=asc&maxRecords=1`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Errore ricerca comandi');
    }

    const result = await searchResponse.json();
    
    if (result.records.length > 0) {
      const record = result.records[0];
      return {
        id: record.id,
        action: record.fields.action,
        target_type: record.fields.target_type,
        created_at: record.fields.created_at
      };
    }
    
    return null;
  } catch (error) {
    console.error('Errore getDevicePendingCommand:', error);
    return null;
  }
}