import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchAndSaveCompanyData } from './stockService';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('NASDAQ API Çalışıyor 🚀');
});

// Yeni: Veri çekme ve kaydetme tetikleyicisi
app.post('/api/sync/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const result = await fetchAndSaveCompanyData(symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Veri senkronizasyonu başarısız oldu." });
  }
});

app.listen(port, () => {
  console.log(`Sunucu ${port} portunda başlatıldı: http://localhost:${port}`);
});