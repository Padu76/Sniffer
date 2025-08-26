// /api/command-executed.js
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
      action, 
      timestamp,
      success = true,
      error_message 
    } = req.body;

    // Validazione
    if (!device_id || !action) {
      return res.status(400).json({ 
        error: 'device_id e action sono richiesti' 
      });
    }

    // Trova e aggiorna il comando corrispondente
    const updated = await updateCommandStatus(device_id, action, success, error_message);

    if (updated) {
      // Registra l'esecuzione del comando
      await logCommandExecution(device_id, action, timestamp, success, error_message);

      return res.status(200).json({
        success: true,
        message: 'Comando confermato come eseguito',
        device_id: device_id,
        action: action,
        executed_at: timestamp || new Date().toISOString()
      });
    } else {
      return res.status(404).json({
        error: 'Comando non trovato o già eseguito',
        device_id: device_id,
        action: action
      });
    }

  } catch (error) {
    console.error('Errore command-executed:', error);
    return res.status(500).json({ 
      error: 'Errore conferma comando',
      details: error.message 
    });
  }
}

// Aggiorna status del comando da pending a executed
async function updateCommandStatus(device_id, action, success, error_message) {
  try {
    // Trova il comando pendente più recente per questo device e action
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_commands?` +
      `filterByFormula=AND({device_id}='${device_id}', {action}='${action}', {status}='pending')&` +
      `sort[0][field]=created_at&sort[0][direction]=desc&maxRecords=1`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    if (!searchResponse.ok) {
      throw new Error('Errore ricerca comando');
    }

    const result = await searchResponse.json();
    
    if (result.records.length > 0) {
      const recordId = result.records[0].id;
      
      // Aggiorna il comando
      const updateResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/device_commands/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            status: success ? 'executed' : 'failed',
            executed_at: new Date().toISOString(),
            success: success,
            error_message: error_message || null
          }
        })
      });

      return updateResponse.ok;
    }
    
    return false; // Comando non trovato
  } catch (error) {
    console.error('Errore updateCommandStatus:', error);
    return false;
  }
}

// Log dell'esecuzione del comando per tracking
async function logCommandExecution(device_id, action, timestamp, success, error_message) {
  try {
    const executionLog = {
      device_id: device_id,
      action: action,
      executed_at: timestamp || new Date().toISOString(),
      success: success,
      error_message: error_message || null,
      logged_at: new Date().toISOString()
    };

    await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/command_executions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: executionLog
        }]
      })
    });

  } catch (error) {
    console.log('Errore logCommandExecution:', error);
    // Non blocchiamo l'operazione principale per errori di log
  }
}