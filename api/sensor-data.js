// /api/sensor-data.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  // CORS headers
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
      timestamp, 
      data
    } = req.body;

    console.log('Sensor data request:', { device_id, timestamp });

    // Validation
    if (!device_id || !data) {
      return res.status(400).json({ 
        error: 'device_id e data sono richiesti',
        received: { device_id, data }
      });
    }

    // Insert sensor reading with correct schema
    const insertQuery = `
      INSERT INTO sensor_readings (
        device_id, timestamp, temperature, humidity, 
        gas_resistance, voc_equivalent, raw_sensor_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const insertResult = await client.query(insertQuery, [
      device_id,
      timestamp || new Date().toISOString(),
      data.temperature || 0,
      data.humidity || 0,
      data.gas_resistance || 0,
      data.voc_equivalent || 0,
      JSON.stringify(data)
    ]);

    const sensorReading = insertResult.rows[0];
    console.log('Sensor reading saved successfully:', sensorReading.id);

    // Update device last_seen
    const updateQuery = `
      UPDATE devices 
      SET last_seen = NOW(), status = 'active'
      WHERE device_id = $1
    `;
    
    await client.query(updateQuery, [device_id]);

    return res.status(200).json({
      success: true,
      message: 'Dati sensore salvati',
      record_id: sensorReading.id,
      timestamp: sensorReading.timestamp,
      database: 'Neon PostgreSQL'
    });

  } catch (error) {
    console.error('Error in sensor-data:', error);
    return res.status(500).json({ 
      error: 'Errore salvataggio dati sensore',
      details: error.message
    });
  } finally {
    client.release();
  }
}