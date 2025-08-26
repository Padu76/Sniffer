// /api/detect.js
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
      sensor_data,
      target_type,
      model_id
    } = req.body;

    // Validazione
    if (!device_id || !sensor_data || !target_type) {
      return res.status(400).json({ 
        error: 'device_id, sensor_data e target_type sono richiesti' 
      });
    }

    // Carica modello trained per questo target
    const model = await loadTrainedModel(device_id, target_type, model_id);
    
    if (!model) {
      return res.status(404).json({ 
        error: 'Modello non trovato',
        message: `Nessun modello addestrato per ${target_type} su device ${device_id}`
      });
    }

    // Analisi AI dei dati sensore
    const detection = analyzeWithModel(sensor_data, model);

    // Salva risultato detection su Airtable
    const detectionRecord = {
      device_id: device_id,
      model_id: model.id,
      target_type: target_type,
      timestamp: new Date().toISOString(),
      
      // Dati sensore
      gas_resistance: sensor_data.gas_resistance,
      temperature: sensor_data.temperature,
      humidity: sensor_data.humidity,
      pressure: sensor_data.pressure,
      voc_index: sensor_data.voc_index,
      
      // Risultati detection
      probability: detection.probability,
      confidence: detection.confidence,
      detected: detection.detected,
      similarity_score: detection.similarity,
      
      // Raw data
      raw_sensor_data: JSON.stringify(sensor_data),
      analysis_details: JSON.stringify(detection.details)
    };

    // Salva su Airtable
    await saveDetectionResult(detectionRecord);

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
  }
}

// Carica modello addestrato da Airtable
async function loadTrainedModel(device_id, target_type, model_id = null) {
  try {
    let filterFormula = `AND({device_id}='${device_id}', {target_type}='${target_type}', {is_active}=1)`;
    
    if (model_id) {
      filterFormula = `{model_id}='${model_id}'`;
    }

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/trained_models?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1&sort[0][field]=created_at&sort[0][direction]=desc`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`
        }
      }
    );

    const result = await response.json();
    
    if (result.records.length === 0) return null;
    
    const record = result.records[0];
    return {
      id: record.id,
      signature: JSON.parse(record.fields.model_signature),
      baseline: JSON.parse(record.fields.baseline_stats),
      positive: JSON.parse(record.fields.positive_stats),
      negative: JSON.parse(record.fields.negative_stats),
      threshold: record.fields.confidence_threshold,
      accuracy_score: record.fields.accuracy_score,
      created_at: record.fields.created_at
    };
    
  } catch (error) {
    console.error('Errore caricamento modello:', error);
    return null;
  }
}

// Algoritmo di analisi con modello trained
function analyzeWithModel(sensorData, model) {
  try {
    // Calcola similarità con signature positive
    const positiveSimilarity = calculateSimilarity(sensorData, model.positive);
    
    // Calcola distanza da baseline
    const baselineDistance = calculateDistance(sensorData, model.baseline);
    
    // Calcola distanza da negative samples
    const negativeSimilarity = calculateSimilarity(sensorData, model.negative);
    
    // Formula combinata per probabilità
    const probability = Math.max(0, Math.min(1, 
      (positiveSimilarity * 0.6) + 
      (baselineDistance * 0.3) + 
      ((1 - negativeSimilarity) * 0.1)
    ));
    
    // Confidence basata su consistency dei valori
    const confidence = calculateConfidence(sensorData, model);
    
    // Detected se supera threshold
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

// Helper functions per calcoli AI
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
  // Confidence basata su stabilità dei valori
  const gasStability = sensorData.gas_resistance > 1000 ? 0.8 : 0.4;
  const vocConsistency = sensorData.voc_index > 0 ? 0.9 : 0.3;
  
  return (gasStability + vocConsistency) / 2;
}

function getDetectionMessage(detection, target_type) {
  if (detection.detected) {
    return `🎯 ${target_type} rilevato! Probabilità: ${Math.round(detection.probability * 100)}%`;
  } else if (detection.probability > 0.3) {
    return `🤔 Possibile presenza di ${target_type} (${Math.round(detection.probability * 100)}%)`;
  } else {
    return `❌ ${target_type} non rilevato`;
  }
}

async function saveDetectionResult(record) {
  try {
    await fetch(`https://api.airtable.com/v0/${process.env.VITE_AIRTABLE_BASE_ID}/detections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [{ fields: record }]
      })
    });
  } catch (error) {
    console.log('Errore salvataggio detection:', error);
  }
}