export default async function handler(req, res) {
  res.status(200).json({ 
    message: 'API device-status funziona',
    database: 'Neon Test'
  });
}
