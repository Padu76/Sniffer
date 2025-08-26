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
      console.log('Getting commands for device:', device_id);
      
      // Cerca comandi pendenti per questo device
      const command = await getDevicePendingCommand(device_id);
      
      if (command) {
        console.log('Found pending command:', command);
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
        console.log('No pending commands found');
        return res.status(200).json({
          has_command: false
        });
      }
    } catch (error) {
      console.error('Errore get command:', error);
      return res.status(500).json({ 
        error: 'Errore interno server',
        details: error.message 
      });
    }
  }

  if (req.method === 'POST') {
    const { device_id } = req.body;
    
    // Se è richiesta da ESP32 (stesso endpoint ma POST per consistency)
    if (device_id && !req.body.action) {
      try {
        console.log('ESP32 polling commands for:', device_id);
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
        return res.status(500).json({ 
          error: 'Errore interno server',
          details: error.message 
        });
      }
    }

    // Se è invio comando da Web App
    const { action, target_type } = req.body;
    
    console.log('Command request from web app:', { device_id, action, target_type });
    
    if (!device_id || !action) {
      return res.status(400).json({ 
        error: 'device_id e action sono richiesti',
        received: { device_id, action }
      });
    }

    try {
      // Crea nuovo comando per il device (solo campi essenziali)
      const commandRecord = {
        device_id: device_id,
        action: action,
        target_type: target_type || 'funghi_porcini',
        status: 'pending',
        sent_from: 'web_app'
      };

      console.log('Sending command to Airtable:', commandRecord);
      console.log('Base ID:', process.env.AIRTABLE_BASE_ID);

      // URL completa per debug
      const airtableUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/device_commands`;
      console.log('Airtable URL:', airtableUrl);

      // Salva comando su Airtable
      const airtableResponse = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: commandRecord
          }]
        })
      });

      console.log('Airtable response status:', airtableResponse.status);

      // Leggi la risposta completa
      const responseText = await airtableResponse.text();
      console.log('Airtable response body:', responseText);

      if (!airtableResponse.ok) {
        return res.status(500).json({
          error: 'Errore salvataggio comando',
          details: {
            status: airtableResponse.status,
            statusText: airtableResponse.statusText,
            body: responseText,
            url: airtableUrl
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

      console.log('Command saved successfully:', result);

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
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Errore invio comando',
        details: {
          message: error.message,
          stack: error.stack
        }
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Helper per ottenere comando pendente
async function getDevicePendingCommand(device_id) {
  try {
    console.log('Searching pending commands for device:', device_id);
    
    // Cerca comandi pendenti per questo device (ordinati per data)
    const searchUrl = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/device_commands?` +
      `filterByFormula=AND({device_id}='${device_id}', {status}='pending')&` +
      `sort[0][field]=created_at&sort[0][direction]=asc&maxRecords=1`;
    
    console.log('Search URL:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
      }
    });

    console.log('Search response status:', searchResponse.status);
    
    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Search error response:', errorText);
      throw new Error('Errore ricerca comandi: ' + errorText);
    }

    const result = await searchResponse.json();
    console.log('Search result:', result);
    
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
    throw error;
  }
}