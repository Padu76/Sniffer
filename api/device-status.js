// /api/device-status.js - Neon PostgreSQL Version
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = await pool.connect();

  try {
    if (req.method === 'GET') {
      // Web App requests device status
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id richiesto' });
      }

      console.log('Getting status for device:', device_id);
      
      // Get latest status
      const query = `
        SELECT * FROM device_status 
        WHERE device_id = $1 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      
      const result = await client.query(query, [device_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          error: 'Device non trovato o mai connesso',
          device_id: device_id 
        });
      }

      const statusData = result.rows[0];

      return res.status(200).json({
        success: true,
        device_id: device_id,
        status: statusData.current_status,
        timestamp: statusData.updated_at,
        raw_device_state: statusData.raw_device_state,
        database: 'Neon PostgreSQL'
      });
    }

    if (req.method === 'POST') {
      // ESP32 sends status update
      const { 
        device_id, 
        current_status,
        raw_device_state
      } = req.body;

      if (!device_id || !current_status) {
        return res.status(400).json({ 
          error: 'device_id e current_status sono richiesti' 
        });
      }

      console.log('Updating device status:', { device_id, current_status });
      
      // Insert new status record
      const insertQuery = `
        INSERT INTO device_status (device_id, current_status, raw_device_state, updated_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        device_id,
        current_status,
        JSON.stringify(raw_device_state || {})
      ]);

      // Update device last_seen
      const updateQuery = `
        UPDATE devices 
        SET last_seen = NOW(), status = $2
        WHERE device_id = $1
      `;
      
      await client.query(updateQuery, [device_id, current_status]);

      const statusRecord = insertResult.rows[0];
      console.log('Device status updated successfully:', statusRecord.id);

      return res.status(200).json({
        success: true,
        message: 'Status aggiornato',
        record_id: statusRecord.id,
        timestamp: statusRecord.updated_at
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in device-status:', error);
    return res.status(500).json({
      error: 'Errore interno server',
      details: error.message
    });
  } finally {
    client.release();
  }
}