import axios from 'axios';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createLogger, format, transports } from 'winston';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(info => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`)
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: path.join(__dirname, '../../logs/sync.log') })
    ]
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL'];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Veritabanına Log Atma Fonksiyonu
async function logToDB(client: any, symbol: string, status: string, errorMsg: string | null = null, records = 0) {
    const today = new Date().toISOString().split('T')[0];
    const query = `
        INSERT INTO dwh.SyncLog (Symbol, SyncType, SyncDate, Status, RecordsAffected, ErrorMessage)
        VALUES ($1, 'OHLC', $2, $3, $4, $5)
        ON CONFLICT (Symbol, SyncType, SyncDate)
        DO UPDATE SET Status = EXCLUDED.Status, ErrorMessage = EXCLUDED.ErrorMessage, ExecutionTime = CURRENT_TIMESTAMP;
    `;
    await client.query(query, [symbol, today, status, records, errorMsg]);
}

async function syncStockData() {
    const client = await pool.connect();

    try {
        logger.info(`Kurumsal Senkronizasyon (Fallback ve Loglama) başlıyor...`);

        for (let i = 0; i < SYMBOLS.length; i++) {
            const symbol = SYMBOLS[i];
            logger.info(`\n========== [${i + 1}/${SYMBOLS.length}] ${symbol} ==========`);
            
            let companyName = 'Bilinmiyor';
            let sector = 'Bilinmiyor';
            let recordsInserted = 0;

            try {
                // 1. KÜNYE ÇEKİMİ (Alpha Vantage)
                const overviewUrl = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const overviewRes = await axios.get(overviewUrl);
                if (overviewRes.data && overviewRes.data.Name) {
                    companyName = overviewRes.data.Name.replace(/'/g, "''");
                    sector = overviewRes.data.Sector.replace(/'/g, "''");
                }

                // 2. FİYAT ÇEKİMİ (Alpha Vantage)
                logger.info(`${symbol} - Alpha Vantage deneniyor...`);
                const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${ALPHA_VANTAGE_API_KEY}`;
                const dailyRes = await axios.get(dailyUrl);
                
                // API Limiti veya Hata Kontrolü
                if (dailyRes.data['Note'] || dailyRes.data['Information'] || !dailyRes.data['Time Series (Daily)']) {
                    throw new Error("Alpha Vantage veri dönmedi (Muhtemel API Limiti).");
                }

                await client.query('TRUNCATE TABLE stg.StockPrices_OHLC;');
                const insertQuery = `INSERT INTO stg.StockPrices_OHLC (Symbol, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
                
                for (const [date, values] of Object.entries(dailyRes.data['Time Series (Daily)'])) {
                    const data: any = values;
                    await client.query(insertQuery, [
                        symbol, date, parseFloat(data['1. open']), parseFloat(data['2. high']), parseFloat(data['3. low']), parseFloat(data['4. close']), parseInt(data['5. volume'])
                    ]);
                    recordsInserted++;
                }

                logger.info(`Alpha Vantage BAŞARILI! (${recordsInserted} kayıt)`);

            } catch (alphaError: any) {
                // ALPHA VANTAGE ÇÖKERSE BURAYA DÜŞER!
                logger.warn(`${symbol} - Alpha Vantage Hatası: ${alphaError.message}`);
                await logToDB(client, symbol, 'FAILED', `AlphaVantage Error: ${alphaError.message}`);
                
                // 3. YEDEK API: YAHOO FINANCE DEVREYE GİRİYOR
                logger.info(`${symbol} - Yedek Sistem (Yahoo Finance) çalıştırılıyor...`);
                try {
                    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=10d`;
                    const yahooRes = await axios.get(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    
                    const result = yahooRes.data.chart.result[0];
                    const timestamps = result.timestamp;
                    const quotes = result.indicators.quote[0];

                    await client.query('TRUNCATE TABLE stg.StockPrices_OHLC;');
                    const insertQuery = `INSERT INTO stg.StockPrices_OHLC (Symbol, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume) VALUES ($1, $2, $3, $4, $5, $6, $7)`;

                    for (let j = 0; j < timestamps.length; j++) {
                        if (quotes.close[j] === null) continue;
                        const date = new Date(timestamps[j] * 1000).toISOString().split('T')[0];
                        await client.query(insertQuery, [
                            symbol, date, quotes.open[j], quotes.high[j], quotes.low[j], quotes.close[j], quotes.volume[j] || 0
                        ]);
                        recordsInserted++;
                    }
                    logger.info(`Yahoo Finance BAŞARILI! (${recordsInserted} kayıt)`);
                } catch (yahooError: any) {
                    logger.error(`${symbol} - Yahoo Finance de çöktü: ${yahooError.message}`);
                    await logToDB(client, symbol, 'FAILED', `Yahoo Error: ${yahooError.message}`);
                    continue; // İkisi de çöktüyse bir sonraki hisseye geç
                }
            }

            // 4. DWH AKTARIMI (Eğer stg tablosuna kayıt atılabildiyse)
            if (recordsInserted > 0) {
                try {
                    await client.query('BEGIN;');
                    
                    // Künye güncellemesi
                    await client.query(`
                        UPDATE dwh.DimStock SET CompanyName = '${companyName}', Sector = '${sector}' WHERE Symbol = '${symbol}' AND CompanyName = 'Bilinmiyor';
                        INSERT INTO dwh.DimStock (Symbol, CompanyName, Sector, ValidFrom, IsActive)
                        SELECT DISTINCT '${symbol}', '${companyName}', '${sector}', CURRENT_TIMESTAMP, TRUE
                        WHERE NOT EXISTS (SELECT 1 FROM dwh.DimStock WHERE Symbol = '${symbol}' AND IsActive = TRUE);
                    `);

                    // Idempotent Fiyat Aktarımı
                    await client.query(`
                        INSERT INTO dwh.FactStockPrices (StockSurrogateKey, TradeDate, OpenPrice, HighPrice, LowPrice, ClosePrice, Volume)
                        SELECT d.StockSurrogateKey, s.TradeDate, s.OpenPrice, s.HighPrice, s.LowPrice, s.ClosePrice, s.Volume
                        FROM stg.StockPrices_OHLC s
                        JOIN dwh.DimStock d ON s.Symbol = d.Symbol AND d.IsActive = TRUE
                        ON CONFLICT (StockSurrogateKey, TradeDate)
                        DO UPDATE SET OpenPrice = EXCLUDED.OpenPrice, HighPrice = EXCLUDED.HighPrice, LowPrice = EXCLUDED.LowPrice, ClosePrice = EXCLUDED.ClosePrice, Volume = EXCLUDED.Volume, InsertDate = CURRENT_TIMESTAMP;
                    `);

                    await logToDB(client, symbol, 'SUCCESS', null, recordsInserted);
                    await client.query('TRUNCATE TABLE stg.StockPrices_OHLC;');
                    await client.query('COMMIT;');
                    logger.info(`${symbol} DWH Aktarımı Tamamlandı.`);

                } catch (dbError: any) {
                    await client.query('ROLLBACK;').catch(() => {});
                    logger.error(`${symbol} Veritabanı Hatası: ${dbError.message}`);
                    await logToDB(client, symbol, 'FAILED', `DB DWH Error: ${dbError.message}`);
                }
            }

            if (i < SYMBOLS.length - 1) {
                logger.info(`Sıradaki şirket için 15 saniye bekleniyor...`);
                await sleep(15000);
            }
        }

        logger.info(`\n[✓] TÜM SENKRONİZASYON İŞLEMLERİ TAMAMLANDI!`);

    } catch (error: any) {
        logger.error(`GENEL HATA: ${error.message}`);
    } finally {
        client.release();
    }
}

syncStockData();