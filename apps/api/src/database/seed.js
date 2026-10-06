"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
// Not: Gerçek projede Alpha Vantage adaptörünü buraya import edeceksin.
// Örn: import { AlphaVantageAdapter } from '../services/alphaVantageAdapter';
// PostgreSQL Bağlantı Ayarları (Docker veya yerel ortam değişkenlerinden alınır)
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nasdaq_db',
});
// Başlangıç için örnek tohum verileri (Seed Data)
const initialCompanies = [
    {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        sector: 'Teknoloji',
        currency: 'USD',
        exchange: 'NASDAQ',
        description: 'Apple Inc. tüketici elektroniği, yazılım ve çevrimiçi hizmetler tasarlar ve üretir.',
        price: 178.25,
        peRatio: 28.5,
        marketCap: 2800000000000,
        revenueTTM: 383200000000,
        netIncomeTTM: 96900000000,
        fcf: 99500000000
    },
    {
        symbol: 'MSFT',
        name: 'Microsoft Corp.',
        sector: 'Teknoloji',
        currency: 'USD',
        exchange: 'NASDAQ',
        description: 'Microsoft dünya çapında bulut bilişim, yazılım ve donanım çözümleri sunar.',
        price: 335.12,
        peRatio: 32.1,
        marketCap: 2500000000000,
        revenueTTM: 211900000000,
        netIncomeTTM: 72300000000,
        fcf: 59400000000
    },
    {
        symbol: 'TSLA',
        name: 'Tesla, Inc.',
        sector: 'Otomotiv',
        currency: 'USD',
        exchange: 'NASDAQ',
        description: 'Tesla elektrikli araçlar ve temiz enerji depolama sistemleri üretir.',
        price: 210.50,
        peRatio: 65.8,
        marketCap: 650000000000,
        revenueTTM: 81400000000,
        netIncomeTTM: 12500000000,
        fcf: 4300000000
    }
];
async function seedDatabase() {
    const client = await pool.connect();
    try {
        console.log('🌱 Veritabanı tohumlama (Seed) süreci başlatıldı...');
        await client.query('BEGIN'); // Transaction başlat
        for (const comp of initialCompanies) {
            // 1. Şirket Tablosuna Ekle veya Güncelle (Idempotent UPSERT)
            const companyQuery = `
        INSERT INTO companies (symbol, name, sector, currency, exchange, description)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (symbol) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          sector = EXCLUDED.sector,
          description = EXCLUDED.description,
          updated_at = NOW()
        RETURNING id;
      `;
            const companyResult = await client.query(companyQuery, [
                comp.symbol, comp.name, comp.sector, comp.currency, comp.exchange, comp.description
            ]);
            const companyId = companyResult.rows[0].id;
            // 2. Finansal Metrikler Tablosuna Ekle veya Güncelle
            const metricsQuery = `
        INSERT INTO financial_metrics (company_id, price, pe_ratio, market_cap, revenue_ttm, net_income_ttm, free_cash_flow)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (company_id) 
        DO UPDATE SET 
          price = EXCLUDED.price,
          pe_ratio = EXCLUDED.pe_ratio,
          market_cap = EXCLUDED.market_cap,
          revenue_ttm = EXCLUDED.revenue_ttm,
          net_income_ttm = EXCLUDED.net_income_ttm,
          free_cash_flow = EXCLUDED.free_cash_flow,
          updated_at = NOW();
      `;
            await client.query(metricsQuery, [
                companyId, comp.price, comp.peRatio, comp.marketCap, comp.revenueTTM, comp.netIncomeTTM, comp.fcf
            ]);
            console.log(`✅ [${comp.symbol}] Başarıyla işlendi ve kaydedildi.`);
        }
        await client.query('COMMIT'); // İşlemi onayla
        console.log('🚀 Tohumlama başarıyla tamamlandı!');
    }
    catch (error) {
        await client.query('ROLLBACK'); // Hata durumunda geri al
        console.error('❌ Seed sırasında hata oluştu, işlem geri alındı:', error);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
}
seedDatabase();
//# sourceMappingURL=seed.js.map