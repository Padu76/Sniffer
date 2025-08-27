// /api/device-command.js - Neon PostgreSQL Version
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
      // ESP32 requests pending commands
      const { device_id } = req.query;
      
      if (!device_id) {
        return res.status(400).json({ error: 'device_id richiesto' });
      }

      console.log('Getting commands for device:', device_id);
      
      const query = `
        SELECT * FROM device_commands 
        WHERE device_id = $1 AND status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1
      `;
      
      const result = await client.query(query, [device_id]);

      if (result.rows.length > 0) {
        const command = result.rows[0];
        console.log('Found pending command:', command);
        
        return res.status(200).json({
          has_command: true,
          command: {
            id: command.id,
            command: command.command,
            parameters: command.parameters,
            created_at: command.created_at
          }
        });
      } else {
        console.log('No pending commands found');
        return res.status(200).json({
          has_command: false
        });
      }
    }

    if (req.method === 'POST') {
      const { device_id } = req.body;
      
      // ESP32 polling for commands (POST for consistency)
      if (device_id && !req.body.command) {
        console.log('ESP32 polling commands for:', device_id);
        
        const query = `
          SELECT * FROM device_commands 
          WHERE device_id = $1 AND status = 'pending' 
          ORDER BY created_at ASC 
          LIMIT 1
        `;
        
        const result = await client.query(query, [device_id]);

        if (result.rows.length > 0) {
          const command = result.rows[0];
          return res.status(200).json({
            has_command: true,
            command: {
              id: command.id,
              command: command.command,
              parameters: command.parameters,
              created_at: command.created_at
            }
          });
        } else {
          return res.status(200).json({
            has_command: false
          });
        }
      }

      // Web App sending command
      const { command, parameters } = req.body;
      
      console.log('Command request from web app:', { device_id, command, parameters });
      
      if (!device_id || !command) {
        return res.status(400).json({ 
          error: 'device_id e command sono richiesti',
          received: { device_id, command }
        });
      }

      // Insert new command
      const insertQuery = `
        INSERT INTO device_commands (device_id, command, parameters, status, created_at)
        VALUES ($1, $2, $3, 'pending', NOW())
        RETURNING *
      `;
      
      const insertResult = await client.query(insertQuery, [
        device_id,
        command,
        parameters ? JSON.stringify(parameters) : null
      ]);

      const commandRecord = insertResult.rows[0];
      console.log('Command saved successfully:', commandRecord);

      return res.status(200).json({
        success: true,
        message: 'Comando inviato al device',
        command_id: commandRecord.id,
        command: command,
        device_id: device_id,
        status: 'pending'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in device-command:', error);
    return res.status(500).json({
      error: 'Errore interno server',
      details: error.message
    });
  } finally {
    client.release();
  }
}