// /api/pair-device.js - Neon PostgreSQL Version
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

  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'Pair Device API - Use POST method',
      database: 'Neon PostgreSQL',
      endpoints: {
        pair: 'POST /api/pair-device',
        status: 'GET /api/device-status?device_id=xxx'
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = await pool.connect();
  
  try {
    const { device_id, device_name, firmware_version } = req.body;
    
    console.log('Neon pair device request:', { device_id, device_name, firmware_version });
    
    // Validation
    if (!device_id) {
      return res.status(400).json({ 
        error: 'device_id richiesto',
        received: { device_id }
      });
    }

    // Check if device already exists
    const checkQuery = 'SELECT * FROM devices WHERE device_id = $1';
    const checkResult = await client.query(checkQuery, [device_id]);

    let result;

    if (checkResult.rows.length > 0) {
      // Update existing device
      console.log('Updating existing device:', device_id);
      
      const updateQuery = `
        UPDATE devices 
        SET device_name = $2, 
            firmware_version = $3, 
            status = 'active', 
            last_seen = NOW(),
            created_at = NOW()
        WHERE device_id = $1 
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [
        device_id,
        device_name || checkResult.rows[0].device_name,
        firmware_version || '1.2.0'
      ]);

      result = updateResult.rows[0];

    } else {
      // Insert new device
      console.log('Creating new device:', device_id);
      
      const insertQuery = `
        INSERT INTO devices (device_id, device_name, firmware_version, status, last_seen, created_at)
        VALUES ($1, $2, $3, 'active', NOW(), NOW())
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        device_id,
        device_name || `Sonda ${device_id}`,
        firmware_version || '1.2.0'
      ]);

      result = insertResult.rows[0];
    }

    console.log('Device paired successfully:', result);

    return res.status(200).json({
      success: true,
      message: 'Device connesso con successo',
      device_id: device_id,
      record_id: result.id,
      api_endpoints: {
        sensor_data: '/api/sensor-data',
        device_status: '/api/device-status',
        device_command: '/api/device-command'
      },
      database: 'Neon PostgreSQL',
      debug: {
        action: checkResult.rows.length > 0 ? 'updated' : 'created',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Errore generale pair-device:', error);
    return res.status(500).json({ 
      error: 'Errore interno server',
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  } finally {
    client.release();
  }
}