import { Pool } from 'pg';

// ⚠️ DİKKAT: Şifreni (SENİN_ŞİFREN) ve Veritabanı Adını (SENİN_DB_ADIN) Kendi Bilgisayarına Göre Değiştir!

const pool = new Pool({
  user: 'postgres',          // Kullanıcı adın (genelde postgres'tir)
  host: 'localhost',         // Veritabanı sunucusu
  database: 'nazdak_db', // Oluşturduğun veritabanının adı (örneğin: nasdaq_db)
  password: 'Pek/195',  // Şifreni buraya yaz (özel karakter olsa bile artık sorun çıkarmaz!)
  port: 5432,                // Varsayılan PostgreSQL portu
});


// Senin tablonla %100 uyumlu veri seti
const initialData = [
  {
    symbol: 'AAPL',
    company_name: 'Apple Inc.',
    last_price: 178.25,
    daily_change_pct: 1.24,
    revenue_ttm: 383200000000,
    revenue_growth: 5.2,
    gross_profit_margin: 44.1,
    operating_margin: 30.2,
    net_profit_margin: 25.3,
    free_cash_flow: 99500000000,
    total_debt: 111000000000,
    pe_ratio: 28.5
  },
  {
    symbol: 'MSFT',
    company_name: 'Microsoft Corp.',
    last_price: 335.12,
    daily_change_pct: 0.85,
    revenue_ttm: 211900000000,
    revenue_growth: 8.5,
    gross_profit_margin: 68.9,
    operating_margin: 41.7,
    net_profit_margin: 34.1,
    free_cash_flow: 59400000000,
    total_debt: 79400000000,
    pe_ratio: 32.1
  },
  {
    symbol: 'TSLA',
    company_name: 'Tesla, Inc.',
    last_price: 210.50,
    daily_change_pct: -2.10,
    revenue_ttm: 81400000000,
    revenue_growth: 22.4,
    gross_profit_margin: 18.2,
    operating_margin: 9.6,
    net_profit_margin: 13.0,
    free_cash_flow: 4300000000,
    total_debt: 5100000000,
    pe_ratio: 65.8
  }
];

async function seedDatabase() {
  const client = await pool.connect();
  try {
    console.log('🌱 Veritabanı tohumlama başlatıldı...');
    await client.query('BEGIN'); // Transaction Başlat

    for (const data of initialData) {
      // 1. Companies Tablosu: Varsa şirket adını güncelle, yoksa ekle
      await client.query(`
        INSERT INTO companies (symbol, company_name)
        VALUES ($1, $2)
        ON CONFLICT (symbol) 
        DO UPDATE SET company_name = EXCLUDED.company_name;
      `, [data.symbol, data.company_name]);

      // 2. Financial Metrics Tablosu Kontrolü
      // (symbol alanı PK olmadığı için ON CONFLICT yazamayız, önce kontrol edip IF ile işleriz)
      const checkMetric = await client.query('SELECT id FROM financial_metrics WHERE symbol = $1', [data.symbol]);
      
      if (checkMetric.rows.length > 0) {
        // Varsa Güncelle (UPDATE)
        await client.query(`
          UPDATE financial_metrics SET 
            last_price = $2, daily_change_pct = $3, revenue_ttm = $4, revenue_growth = $5,
            gross_profit_margin = $6, operating_margin = $7, net_profit_margin = $8,
            free_cash_flow = $9, total_debt = $10, pe_ratio = $11, updated_at = CURRENT_TIMESTAMP
          WHERE symbol = $1;
        `, [
          data.symbol, data.last_price, data.daily_change_pct, data.revenue_ttm, data.revenue_growth, 
          data.gross_profit_margin, data.operating_margin, data.net_profit_margin, data.free_cash_flow, 
          data.total_debt, data.pe_ratio
        ]);
      } else {
        // Yoksa Ekle (INSERT)
        await client.query(`
          INSERT INTO financial_metrics (
            symbol, last_price, daily_change_pct, revenue_ttm, revenue_growth, 
            gross_profit_margin, operating_margin, net_profit_margin, free_cash_flow, total_debt, pe_ratio
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        `, [
          data.symbol, data.last_price, data.daily_change_pct, data.revenue_ttm, data.revenue_growth, 
          data.gross_profit_margin, data.operating_margin, data.net_profit_margin, data.free_cash_flow, 
          data.total_debt, data.pe_ratio
        ]);
      }

      console.log(`✅ [${data.symbol}] tabloya başarıyla işlendi.`);
    }

    await client.query('COMMIT');
    console.log('🚀 Tohumlama mükemmel şekilde tamamlandı!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Kayıt sırasında hata oluştu, geri alındı:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase();