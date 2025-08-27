// /api/start-training.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();

  try {
    const { 
      device_id, 
      target_type,
      training_name,
      session_id 
    } = req.body;

    if (!device_id || !target_type) {
      return res.status(400).json({ 
        error: 'device_id e target_type sono richiesti' 
      });
    }

    const trainingSessionId = session_id || `train_${Date.now()}`;

    const insertQuery = `
      INSERT INTO training_sessions (
        device_id, session_id, target_type, training_name, status, start_time,
        baseline_samples, positive_samples, negative_samples,
        baseline_target, positive_target, negative_target,
        current_phase, phase_instructions, created_at
      ) VALUES ($1, $2, $3, $4, 'in_progress', NOW(), 0, 0, 0, 10, 15, 10, 'baseline', $5, NOW())
      RETURNING *
    `;

    const phaseInstructions = getPhaseInstructions('baseline', target_type);
    
    const result = await client.query(insertQuery, [
      device_id,
      trainingSessionId,
      target_type,
      training_name || `Training ${target_type}`,
      JSON.stringify(phaseInstructions)
    ]);

    const trainingSession = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Training session avviata',
      session_id: trainingSessionId,
      record_id: trainingSession.id,
      current_phase: 'baseline',
      instructions: phaseInstructions,
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
  } finally {
    client.release();
  }
}

function getPhaseInstructions(phase, target_type) {
  const instructions = {
    baseline: {
      title: 'FASE 1: Calibrazione Aria Pulita',
      description: `Tieni la sonda in aria pulita per 10 campioni di baseline`,
      action: 'Posiziona la sonda lontano da odori forti'
    },
    positive: {
      title: `FASE 2: Campioni Target (${target_type})`,
      description: `Avvicina la sonda a ${target_type} freschi per 15 campioni`,
      action: `Posiziona vicino a ${target_type} di qualità`
    },
    negative: {
      title: 'FASE 3: Campioni Negativi',
      description: `Testa altri odori simili ma diversi dal target per 10 campioni`,
      action: 'Prova terreno, foglie, altri odori non-target'
    }
  };
  
  return instructions[phase];
}