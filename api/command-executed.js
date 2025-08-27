// /api/command-executed.js - Neon PostgreSQL Version
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
      command, 
      timestamp,
      success = true
    } = req.body;

    console.log('Command executed confirmation:', { device_id, command, success });

    // Validation
    if (!device_id || !command) {
      return res.status(400).json({ 
        error: 'device_id e command sono richiesti' 
      });
    }

    // Find and update the most recent pending command
    const findQuery = `
      SELECT * FROM device_commands 
      WHERE device_id = $1 AND command = $2 AND status = 'pending' 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const findResult = await client.query(findQuery, [device_id, command]);

    if (findResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Comando non trovato o già eseguito',
        device_id: device_id,
        command: command
      });
    }

    const commandRecord = findResult.rows[0];

    // Update command status
    const updateQuery = `
      UPDATE device_commands 
      SET status = $3, executed_at = $4
      WHERE id = $1
      RETURNING *
    `;
    
    const updateResult = await client.query(updateQuery, [
      commandRecord.id,
      success ? 'executed' : 'failed',
      timestamp || new Date().toISOString()
    ]);

    const updatedCommand = updateResult.rows[0];
    console.log('Command status updated successfully:', updatedCommand.id);

    return res.status(200).json({
      success: true,
      message: 'Comando confermato come eseguito',
      device_id: device_id,
      command: command,
      executed_at: updatedCommand.executed_at,
      command_id: updatedCommand.id
    });

  } catch (error) {
    console.error('Error in command-executed:', error);
    return res.status(500).json({ 
      error: 'Errore conferma comando',
      details: error.message 
    });
  } finally {
    client.release();
  }
}