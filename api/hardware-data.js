import { Pool } from 'pg';

// Configurazione database Neon
const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export default async function handler(req, res) {
  // Headers CORS per ESP32
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let client;
  
  try {
    client = await pool.connect();

    // POST: Ricevi dati da ESP32
    if (req.method === 'POST') {
      const {
        device_id,
        sensor_data,
        location,
        command_response,
        status
      } = req.body;

      // Validazione dati obbligatori
      if (!device_id || !sensor_data) {
        return res.status(400).json({
          success: false,
          error: 'device_id e sensor_data sono obbligatori'
        });
      }

      // Salva dati sensore su tabella scansioni
      const scanQuery = `
        INSERT INTO scansioni (
          device_id,
          sensor_data,
          location_data,
          scan_type,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING id, created_at
      `;

      const scanResult = await client.query(scanQuery, [
        device_id,
        JSON.stringify(sensor_data),
        location ? JSON.stringify(location) : null,
        'hardware_sensor',
        status || 'completed'
      ]);

      // Log attività ESP32
      console.log(`ESP32 Data Received:`, {
        device_id,
        scan_id: scanResult.rows[0].id,
        sensor_type: sensor_data.sensor_type || 'BME688',
        voc: sensor_data.voc_index,
        gas_resistance: sensor_data.gas_resistance,
        temperature: sensor_data.temperature,
        humidity: sensor_data.humidity
      });

      // Risposta per ESP32
      return res.status(200).json({
        success: true,
        scan_id: scanResult.rows[0].id,
        timestamp: scanResult.rows[0].created_at,
        next_action: 'continue_scanning'
      });
    }

    // GET: Status check e comandi per ESP32
    if (req.method === 'GET') {
      const { device_id, action } = req.query;

      if (action === 'status') {
        // Ritorna status del device
        const statusQuery = `
          SELECT 
            device_id,
            COUNT(*) as total_scans,
            MAX(created_at) as last_scan,
            AVG((sensor_data->>'voc_index')::float) as avg_voc
          FROM scansioni 
          WHERE device_id = $1 
            AND created_at > NOW() - INTERVAL '24 hours'
          GROUP BY device_id
        `;

        const statusResult = await client.query(statusQuery, [device_id]);

        return res.status(200).json({
          success: true,
          device_status: statusResult.rows[0] || {
            device_id,
            total_scans: 0,
            last_scan: null,
            avg_voc: 0
          },
          server_time: new Date().toISOString()
        });
      }

      if (action === 'command') {
        // Comandi per ESP32 (start, stop, calibrate, reset)
        const command = req.query.cmd;
        
        const validCommands = ['start_scanning', 'stop_scanning', 'calibrate', 'reset', 'deep_sleep'];
        
        if (!validCommands.includes(command)) {
          return res.status(400).json({
            success: false,
            error: 'Comando non valido',
            valid_commands: validCommands
          });
        }

        // Log comando inviato
        console.log(`Command sent to ESP32 ${device_id}: ${command}`);

        return res.status(200).json({
          success: true,
          command: command,
          device_id: device_id,
          timestamp: new Date().toISOString(),
          message: `Comando '${command}' inviato a dispositivo ${device_id}`
        });
      }

      // GET senza parametri: ritorna ultimi dati sensore
      const recentDataQuery = `
        SELECT 
          id,
          device_id,
          sensor_data,
          location_data,
          status,
          created_at
        FROM scansioni 
        WHERE scan_type = 'hardware_sensor'
        ORDER BY created_at DESC 
        LIMIT 20
      `;

      const recentResult = await client.query(recentDataQuery);

      return res.status(200).json({
        success: true,
        recent_data: recentResult.rows,
        total_devices: new Set(recentResult.rows.map(r => r.device_id)).size
      });
    }

    // PUT: Aggiorna configurazione ESP32
    if (req.method === 'PUT') {
      const { device_id, config } = req.body;

      if (!device_id || !config) {
        return res.status(400).json({
          success: false,
          error: 'device_id e config sono obbligatori'
        });
      }

      // Salva configurazione (usa tabella scansioni con tipo 'config')
      const configQuery = `
        INSERT INTO scansioni (
          device_id,
          sensor_data,
          scan_type,
          status,
          created_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        RETURNING id
      `;

      const configResult = await client.query(configQuery, [
        device_id,
        JSON.stringify(config),
        'device_config',
        'updated'
      ]);

      return res.status(200).json({
        success: true,
        config_id: configResult.rows[0].id,
        message: `Configurazione aggiornata per dispositivo ${device_id}`
      });
    }

    // Metodo non supportato
    return res.status(405).json({
      success: false,
      error: 'Metodo non supportato',
      allowed_methods: ['GET', 'POST', 'PUT', 'OPTIONS']
    });

  } catch (error) {
    console.error('Errore API hardware-data:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message
    });
  } finally {
    if (client) client.release();
  }
}