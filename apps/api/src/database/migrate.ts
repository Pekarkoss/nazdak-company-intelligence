import { Pool } from 'pg';

const pool = new Pool({
  user: 'postgres',          
  host: 'localhost',         
  database: 'nazdak_db', 
  password: 'Pek/195',  
  port: 5432,
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🏗️ Migration (Veritabanı İnşası) başlatılıyor...');
    await client.query('BEGIN');

    // Eski tabloları temizle (SCD Type 2'ye geçiş için temiz bir başlangıç)
    console.log('🧹 Eski tablolar ve görünümler temizleniyor...');
    await client.query(`
      DROP VIEW IF EXISTS vw_company_scores CASCADE;
      DROP TABLE IF EXISTS financial_metrics CASCADE;
      DROP TABLE IF EXISTS daily_stock_prices CASCADE;
      DROP TABLE IF EXISTS quarterly_financials CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
    `);

    // 1. Şirketler Tablosu
    console.log('⏳ "companies" tablosu oluşturuluyor...');
    await client.query(`
      CREATE TABLE companies (
        symbol VARCHAR(10) PRIMARY KEY,
        company_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Günlük OHLC Fiyat Tablosu (Insert-Only Fact Table)
    console.log('⏳ "daily_stock_prices" tablosu oluşturuluyor...');
    await client.query(`
      CREATE TABLE daily_stock_prices (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) REFERENCES companies(symbol) ON DELETE CASCADE,
        trade_date DATE NOT NULL,
        open_price NUMERIC,
        high_price NUMERIC,
        low_price NUMERIC,
        close_price NUMERIC,
        volume BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, trade_date)
      );
    `);

    // 3. Çeyreklik Gelir Tablosu (Income Statement Fact Table)
    console.log('⏳ "quarterly_financials" tablosu oluşturuluyor...');
    await client.query(`
      CREATE TABLE quarterly_financials (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) REFERENCES companies(symbol) ON DELETE CASCADE,
        fiscal_date_ending DATE NOT NULL,
        reported_currency VARCHAR(10),
        total_revenue NUMERIC,
        net_income NUMERIC,
        operating_income NUMERIC,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, fiscal_date_ending)
      );
    `);

    // 4. Finansal Metrikler (SCD Type 2 Boyut Tablosu)
    console.log('⏳ "financial_metrics" (SCD Type 2) tablosu oluşturuluyor...');
    await client.query(`
      CREATE TABLE financial_metrics (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) REFERENCES companies(symbol) ON DELETE CASCADE,
        last_price NUMERIC,
        daily_change_pct NUMERIC,
        revenue_ttm NUMERIC,
        revenue_growth NUMERIC,
        gross_profit_margin NUMERIC,
        operating_margin NUMERIC,
        net_profit_margin NUMERIC,
        free_cash_flow NUMERIC,
        total_debt NUMERIC,
        pe_ratio NUMERIC,
        is_active BOOLEAN DEFAULT TRUE,
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'
      );
    `);

    // 5. Ara Katman (Puanlama Algoritması) View'i
    console.log('⏳ "vw_company_scores" görünümü (View) oluşturuluyor...');
    await client.query(`
      CREATE VIEW vw_company_scores AS
      WITH active_metrics AS (
          SELECT symbol, pe_ratio, revenue_ttm, net_profit_margin, free_cash_flow
          FROM financial_metrics 
          WHERE is_active = TRUE
      )
      SELECT 
          m1.symbol AS company_a,
          m2.symbol AS company_b,
          (CASE WHEN m1.net_profit_margin > m2.net_profit_margin THEN 3 ELSE 0 END) +
          (CASE WHEN m1.revenue_ttm > m2.revenue_ttm THEN 2 ELSE 0 END) +
          (CASE WHEN m1.pe_ratio < m2.pe_ratio THEN 2 ELSE 0 END) +
          (CASE WHEN m1.free_cash_flow > m2.free_cash_flow THEN 1 ELSE 0 END) AS score_a,
          
          (CASE WHEN m2.net_profit_margin > m1.net_profit_margin THEN 3 ELSE 0 END) +
          (CASE WHEN m2.revenue_ttm > m1.revenue_ttm THEN 2 ELSE 0 END) +
          (CASE WHEN m2.pe_ratio < m1.pe_ratio THEN 2 ELSE 0 END) +
          (CASE WHEN m2.free_cash_flow > m1.free_cash_flow THEN 1 ELSE 0 END) AS score_b
      FROM active_metrics m1
      CROSS JOIN active_metrics m2
      WHERE m1.symbol != m2.symbol;
    `);

    await client.query('COMMIT');
    console.log('✅ Migration başarıyla tamamlandı! Tüm DWH tabloları ve görünümler hazır.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration sırasında hata oluştu:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();