// /api/save-model.js
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
      session_id, 
      model_data,
      target_type,
      accuracy_score,
      sample_counts
    } = req.body;

    // Validazione
    if (!device_id || !session_id || !model_data) {
      return res.status(400).json({ 
        error: 'device_id, session_id e model_data sono richiesti' 
      });
    }

    // Prepara record modello per Airtable
    const modelRecord = {
      device_id: device_id,
      session_id: session_id,
      target_type: target_type,
      model_name: `${target_type}_${device_id}_${Date.now()}`,
      
      // Dati modello
      model_signature: JSON.stringify(model_data.signature),
      baseline_stats: JSON.stringify(model_data.baseline),
      positive_stats: JSON.stringify(model_data.positive), 
      negative_stats: JSON.stringify(model_data.negative),
      
      // Metriche qualità
      accuracy_score: accuracy_score || 0,
      confidence_threshold: model_data.threshold || 0.7,
      
      // Contatori campioni
      baseline_samples: sample_counts?.baseline || 0,
      positive_samples: sample_counts?.positive || 0,
      negative_samples: sample_counts?.negative || 0,
      
      // Metadata
      created_at: new Date().toISOString(),
      is_active: true,
      version: model_data.version || '1.0'
    };

    // Salva modello su Airtable
    const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/trained_models`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: modelRecord
        }]
      })
    });

    if (!airtableResponse.ok) {
      throw new Error('Errore salvataggio modello');
    }

    const result = await airtableResponse.json();

    // Aggiorna training session a "completed"
    await updateTrainingSession(session_id, {
      status: 'completed',
      end_time: new Date().toISOString(),
      model_id: result.records[0].id,
      accuracy_score: accuracy_score
    });

    return res.status(200).json({
      success: true,
      message: 'Modello salvato con successo',
      model_id: result.records[0].id,
      model_name: modelRecord.model_name,
      accuracy: accuracy_score,
      ready_for_detection: true,
      next_steps: [
        'Modello pronto per rilevamento',
        'Usa /api/detect per analisi in tempo reale',
        'Controlla dashboard per performance'
      ]
    });

  } catch (error) {
    console.error('Errore save-model:', error);
    return res.status(500).json({ 
      error: 'Errore salvataggio modello',
      details: error.message 
    });
  }
}

// Helper per aggiornare training session
async function updateTrainingSession(session_id, updateData) {
  try {
    // Trova il record della session
    const searchResponse = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/training_sessions?filterByFormula={session_id}='${session_id}'`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    const searchResult = await searchResponse.json();
    
    if (searchResult.records.length > 0) {
      const recordId = searchResult.records[0].id;
      
      // Aggiorna record
      await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/training_sessions/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: updateData
        })
      });
    }
  } catch (error) {
    console.log('Errore aggiornamento training session:', error);
  }
}