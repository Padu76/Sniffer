// /api/detect.js - Neon PostgreSQL Version
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
      sensor_data,
      target_type,
      model_id
    } = req.body;

    if (!device_id || !sensor_data || !target_type) {
      return res.status(400).json({ 
        error: 'device_id, sensor_data e target_type sono richiesti' 
      });
    }

    const model = await loadTrainedModel(client, device_id, target_type, model_id);
    
    if (!model) {
      return res.status(404).json({ 
        error: 'Modello non trovato',
        message: `Nessun modello addestrato per ${target_type} su device ${device_id}`
      });
    }

    const detection = analyzeWithModel(sensor_data, model);

    // Save detection result
    const insertDetectionQuery = `
      INSERT INTO detections (
        device_id, model_id, target_type, timestamp,
        gas_resistance, temperature, humidity, pressure, voc_index,
        probability, confidence, detected, similarity_score,
        raw_sensor_data, analysis_details
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    await client.query(insertDetectionQuery, [
      device_id,
      model.id,
      target_type,
      sensor_data.gas_resistance,
      sensor_data.temperature,
      sensor_data.humidity,
      sensor_data.pressure,
      sensor_data.voc_index,
      detection.probability,
      detection.confidence,
      detection.detected,
      detection.similarity,
      JSON.stringify(sensor_data),
      JSON.stringify(detection.details)
    ]);

    return res.status(200).json({
      success: true,
      detection: {
        target_type: target_type,
        detected: detection.detected,
        probability: Math.round(detection.probability * 100),
        confidence: Math.round(detection.confidence * 100),
        message: getDetectionMessage(detection, target_type)
      },
      sensor_values: {
        gas_resistance: sensor_data.gas_resistance,
        temperature: sensor_data.temperature,
        humidity: sensor_data.humidity,
        voc_index: sensor_data.voc_index
      },
      model_info: {
        model_id: model.id,
        accuracy: model.accuracy_score,
        last_trained: model.created_at
      }
    });

  } catch (error) {
    console.error('Errore detect:', error);
    return res.status(500).json({ 
      error: 'Errore analisi detection',
      details: error.message 
    });
  } finally {
    client.release();
  }
}

async function loadTrainedModel(client, device_id, target_type, model_id = null) {
  try {
    let query, params;
    
    if (model_id) {
      query = 'SELECT * FROM trained_models WHERE id = $1';
      params = [model_id];
    } else {
      query = `
        SELECT * FROM trained_models 
        WHERE device_id = $1 AND target_type = $2 AND is_active = true
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      params = [device_id, target_type];
    }

    const result = await client.query(query, params);
    
    if (result.rows.length === 0) return null;
    
    const record = result.rows[0];
    return {
      id: record.id,
      signature: record.model_signature,
      baseline: record.baseline_stats,
      positive: record.positive_stats,
      negative: record.negative_stats,
      threshold: parseFloat(record.confidence_threshold),
      accuracy_score: record.accuracy_score,
      created_at: record.created_at
    };
    
  } catch (error) {
    console.error('Errore caricamento modello:', error);
    return null;
  }
}

function analyzeWithModel(sensorData, model) {
  try {
    const positiveSimilarity = calculateSimilarity(sensorData, model.positive);
    const baselineDistance = calculateDistance(sensorData, model.baseline);
    const negativeSimilarity = calculateSimilarity(sensorData, model.negative);
    
    const probability = Math.max(0, Math.min(1, 
      (positiveSimilarity * 0.6) + 
      (baselineDistance * 0.3) + 
      ((1 - negativeSimilarity) * 0.1)
    ));
    
    const confidence = calculateConfidence(sensorData, model);
    const detected = probability > model.threshold && confidence > 0.5;
    
    return {
      probability,
      confidence,
      detected,
      similarity: positiveSimilarity,
      details: {
        positive_similarity: positiveSimilarity,
        baseline_distance: baselineDistance,
        negative_similarity: negativeSimilarity,
        threshold_used: model.threshold
      }
    };
    
  } catch (error) {
    console.error('Errore analisi:', error);
    return { probability: 0, confidence: 0, detected: false, similarity: 0 };
  }
}

function calculateSimilarity(data1, data2) {
  const features = ['gas_resistance', 'temperature', 'humidity', 'voc_index'];
  let similarity = 0;
  
  features.forEach(feature => {
    if (data1[feature] && data2[feature]) {
      const diff = Math.abs(data1[feature] - data2[feature]) / Math.max(data1[feature], data2[feature]);
      similarity += (1 - diff) / features.length;
    }
  });
  
  return Math.max(0, similarity);
}

function calculateDistance(data1, data2) {
  return calculateSimilarity(data1, data2);
}

function calculateConfidence(sensorData, model) {
  const gasStability = sensorData.gas_resistance > 1000 ? 0.8 : 0.4;
  const vocConsistency = sensorData.voc_index > 0 ? 0.9 : 0.3;
  
  return (gasStability + vocConsistency) / 2;
}

function getDetectionMessage(detection, target_type) {
  if (detection.detected) {
    return `${target_type} rilevato! Probabilità: ${Math.round(detection.probability * 100)}%`;
  } else if (detection.probability > 0.3) {
    return `Possibile presenza di ${target_type} (${Math.round(detection.probability * 100)}%)`;
  } else {
    return `${target_type} non rilevato`;
  }
}