import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base("app70ymOnJLKk19B9");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Metodo non consentito" });
  }

  try {
    const { temperature, humidity, pressure, gas } = req.body;

    if (!temperature || !humidity || !pressure || !gas) {
      return res.status(400).json({ error: "Dati incompleti" });
    }

    // Salva su Airtable
    await base("scansioni").create([
      {
        fields: {
          Temperature: temperature,
          Humidity: humidity,
          Pressure: pressure,
          Gas: gas,
          Timestamp: new Date().toISOString(),
        },
      },
    ]);

    res.status(200).json({ message: "Dati salvati correttamente su Airtable" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Errore durante il salvataggio" });
  }
}
