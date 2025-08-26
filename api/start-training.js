// /api/start-training.js
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
      target_type,
      training_name,
      session_id 
    } = req.body;

    // Validazione
    if (!device_id || !target_type) {
      return res.status(400).json({ 
        error: 'device_id e target_type sono richiesti' 
      });
    }

    // Genera session_id se non presente
    const trainingSessionId = session_id || `train_${Date.now()}`;

    // Crea record training session su Airtable
    const trainingSession = {
      device_id: device_id,
      session_id: trainingSessionId,
      target_type: target_type,
      training_name: training_name || `Training ${target_type}`,
      status: 'in_progress',
      start_time: new Date().toISOString(),
      
      // Contatori samples
      baseline_samples: 0,
      positive_samples: 0,
      negative_samples: 0,
      
      // Target samples richiesti
      baseline_target: 10,
      positive_target: 15,
      negative_target: 10,
      
      // Fase attuale
      current_phase: 'baseline', // baseline -> positive -> negative -> completed
      phase_instructions: getPhaseInstructions('baseline', target_type)
    };

    const airtableResponse = await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/training_sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{
          fields: trainingSession
        }]
      })
    });

    if (!airtableResponse.ok) {
      throw new Error('Errore creazione training session');
    }

    const result = await airtableResponse.json();

    return res.status(200).json({
      success: true,
      message: 'Training session avviata',
      session_id: trainingSessionId,
      record_id: result.records[0].id,
      current_phase: 'baseline',
      instructions: getPhaseInstructions('baseline', target_type),
      progress: {
        baseline: 0,
        positive: 0,  
        negative: 0
      },
      targets: {
        baseline: 10,
        positive: 15,
        negative: 10
      }
    });

  } catch (error) {
    console.error('Errore start-training:', error);
    return res.status(500).json({ 
      error: 'Errore avvio training',
      details: error.message 
    });
  }
}

// Helper per istruzioni fasi training
function getPhaseInstructions(phase, target_type) {
  const instructions = {
    baseline: {
      title: '🌬️ FASE 1: Calibrazione Aria Pulita',
      description: `Tieni la sonda in aria pulita per 10 campioni di baseline`,
      action: 'Posiziona la sonda lontano da odori forti'
    },
    positive: {
      title: `🎯 FASE 2: Campioni Target (${target_type})`,
      description: `Avvicina la sonda a ${target_type} freschi per 15 campioni`,
      action: `Posiziona vicino a ${target_type} di qualità`
    },
    negative: {
      title: '❌ FASE 3: Campioni Negativi',
      description: `Testa altri odori simili ma diversi dal target per 10 campioni`,
      action: 'Prova terreno, foglie, altri funghi non-target'
    }
  };
  
  return instructions[phase];
}