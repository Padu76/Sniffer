// /api/receive-data.js - Neon PostgreSQL Version
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
    return res.status(405).json({ error: 'Metodo non consentito' });
  }

  const client = await pool.connect();

  try {
    const { temperature, humidity, pressure, gas, device_id } = req.body;

    if (!temperature || !humidity || !pressure || !gas) {
      return res.status(400).json({ error: 'Dati incompleti' });
    }

    const insertQuery = `
      INSERT INTO scansioni (
        device_id, temperature, humidity, pressure, gas, timestamp
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await client.query(insertQuery, [
      device_id || 'unknown_device',
      temperature,
      humidity, 
      pressure,
      gas
    ]);

    console.log('Data saved to Neon:', result.rows[0].id);

    return res.status(200).json({ 
      message: 'Dati salvati correttamente su Neon PostgreSQL',
      record_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error saving to Neon:', error);
    return res.status(500).json({ error: 'Errore durante il salvataggio' });
  } finally {
    client.release();
  }
}