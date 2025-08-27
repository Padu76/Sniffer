// /api/save-model.js - Neon PostgreSQL Version
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
      session_id, 
      model_data,
      target_type,
      accuracy_score,
      sample_counts
    } = req.body;

    if (!device_id || !session_id || !model_data) {
      return res.status(400).json({ 
        error: 'device_id, session_id e model_data sono richiesti' 
      });
    }

    const model_name = `${target_type}_${device_id}_${Date.now()}`;

    // Insert model into trained_models table
    const insertModelQuery = `
      INSERT INTO trained_models (
        device_id, session_id, target_type, model_name,
        model_signature, baseline_stats, positive_stats, negative_stats,
        accuracy_score, confidence_threshold,
        baseline_samples, positive_samples, negative_samples,
        is_active, version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
      RETURNING *
    `;

    const modelResult = await client.query(insertModelQuery, [
      device_id,
      session_id,
      target_type,
      model_name,
      JSON.stringify(model_data.signature),
      JSON.stringify(model_data.baseline),
      JSON.stringify(model_data.positive),
      JSON.stringify(model_data.negative),
      accuracy_score || 0,
      model_data.threshold || 0.7,
      sample_counts?.baseline || 0,
      sample_counts?.positive || 0,
      sample_counts?.negative || 0,
      true,
      model_data.version || '1.0'
    ]);

    const savedModel = modelResult.rows[0];

    // Update training session to completed
    await updateTrainingSession(client, session_id, {
      status: 'completed',
      end_time: new Date().toISOString(),
      model_id: savedModel.id.toString(),
      accuracy_score: accuracy_score
    });

    return res.status(200).json({
      success: true,
      message: 'Modello salvato con successo',
      model_id: savedModel.id,
      model_name: model_name,
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
  } finally {
    client.release();
  }
}

async function updateTrainingSession(client, session_id, updateData) {
  try {
    const updateQuery = `
      UPDATE training_sessions 
      SET status = $2, end_time = $3, model_id = $4, accuracy_score = $5
      WHERE session_id = $1
    `;
    
    await client.query(updateQuery, [
      session_id,
      updateData.status,
      updateData.end_time,
      updateData.model_id,
      updateData.accuracy_score
    ]);
  } catch (error) {
    console.log('Errore aggiornamento training session:', error);
  }
}