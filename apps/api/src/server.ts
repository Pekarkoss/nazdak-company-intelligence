import express, { Request, Response } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env dosyasını doğru yerden okuyoruz
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost', // <-- SİHİRLİ DOKUNUŞ BURASI
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD, 
  port: 5432,
});

// 1. ENDPOINT: Günlük Dashboard Verileri (OHLC eklendi)
app.get('/api/stocks/dashboard', async (req: Request, res: Response): Promise<void> => {
    try {
        // Yeni eklenen openprice, highprice, lowprice gelsin diye SELECT * kullanıyoruz
        const query = `SELECT * FROM dwh.vw_StockDailyDashboard ORDER BY symbol ASC;`;
        
        const result = await pool.query(query);
        
        res.status(200).json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });
    } catch (error: any) {
        console.error('API Hatası (/api/stocks/dashboard):', error.message);
        res.status(500).json({ success: false, message: 'Sunucu Hatası' });
    }
});

// 2. ENDPOINT: Mali Analiz, F/K ve Büyüme (Yeşil/Kırmızı Kriterleri)
app.get('/api/stocks/financials', async (req: Request, res: Response): Promise<void> => {
    try {
        const symbolFilter = req.query.symbol;
        let query = `SELECT * FROM dwh.vw_StockFinancialAnalysis`;
        const queryParams: any[] = [];

        if (symbolFilter) {
            query += ` WHERE symbol = $1`;
            queryParams.push(symbolFilter.toString().toUpperCase());
        }

        query += ` ORDER BY symbol ASC, periodname DESC;`;
        
        const result = await pool.query(query, queryParams);
        
        res.status(200).json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });
    } catch (error: any) {
        console.error('API Hatası (/api/stocks/financials):', error.message);
        res.status(500).json({ success: false, message: 'Sunucu Hatası' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 API Sunucusu http://localhost:${PORT} adresinde çalışıyor!`);
});