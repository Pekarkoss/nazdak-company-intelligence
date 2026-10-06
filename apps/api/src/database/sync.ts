import 'dotenv/config'; // En üste bu satır eklendi
import { Pool } from 'pg';
import { AlphaVantageAdapter } from '../services/alphaVantageAdapter';

// Veritabanı Bağlantısı (Şifreler artık .env dosyasından otomatik çekiliyor)
const pool = new Pool({
  user: process.env.DB_USER,
  host: 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD, 
  port: 5432,
});

const adapter = new AlphaVantageAdapter();
const symbolsToSync = ['NVDA', 'AMZN', 'JPM'];
// API Limiti için bekleme fonksiyonu (Dakikada 5 istek = İstek başı 12 saniye bekleme)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sayıları güvenle parse etmek için yardımcı fonksiyon
const parseNumber = (val: any) => {
  if (!val || val === 'None' || val === '-') return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
};

async function syncData() {
  console.log('\n🚀 Gelişmiş DWH Senkronizasyon Motoru Başlatılıyor...\n');
  const client = await pool.connect();

  try {
    for (const symbol of symbolsToSync) {
      console.log(`\n======================================================`);
      console.log(`🏢 [${symbol}] ŞİRKETİ İÇİN VERİ ÇEKİMİ BAŞLADI`);
      console.log(`======================================================`);

      // 1. GENEL BAKIŞ (OVERVIEW) VERİSİNİ ÇEK
      const overview = await adapter.fetchCompanyOverview(symbol);
      console.log(`⏳ Ban yememek için 15 saniye bekleniyor...`);
      await delay(15000); 

      // 2. GÜNLÜK FİYAT (OHLC) VERİSİNİ ÇEK
      const dailyPrices = await adapter.fetchDailyPrices(symbol);
      console.log(`⏳ Ban yememek için 15 saniye bekleniyor...`);
      await delay(15000);

      // 3. ÇEYREKLİK BİLANÇO VERİSİNİ ÇEK
      const incomeStatement = await adapter.fetchIncomeStatement(symbol);
      console.log(`⏳ Veritabanı işlemleri başlatılıyor...`);

      if (!overview) {
        console.log(`⚠️ [${symbol}] verileri eksik geldi, atlanıyor.`);
        continue;
      }

      // 🟢 TRANSACTION BAŞLANGICI (Tüm işlemler ya hep ya hiç mantığıyla çalışır)
      await client.query('BEGIN');

      try {
        // --- ADIM 1: ŞİRKETİ EKLE (ON CONFLICT DO NOTHING) ---
        await client.query(`
          INSERT INTO companies (symbol, company_name) 
          VALUES ($1, $2)
          ON CONFLICT (symbol) DO NOTHING;
        `, [symbol, overview.Name]);

        // --- ADIM 2: FİNANSAL METRİKLER (SCD TYPE 2) ---
        // A) Mevcut aktif kaydı kapat
        await client.query(`
          UPDATE financial_metrics 
          SET is_active = FALSE, valid_to = CURRENT_TIMESTAMP 
          WHERE symbol = $1 AND is_active = TRUE;
        `, [symbol]);

        // B) Yeni kaydı aktif (is_active = TRUE) olarak ekle
        await client.query(`
          INSERT INTO financial_metrics (
            symbol, revenue_ttm, pe_ratio, gross_profit_margin, 
            operating_margin, net_profit_margin, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, TRUE);
        `, [
          symbol,
          parseNumber(overview.RevenueTTM),
          parseNumber(overview.PERatio),
          parseNumber(overview.GrossProfitTTM), // Örnek alanlar, API yapısına göre düzenlenebilir
          parseNumber(overview.OperatingMarginTTM),
          parseNumber(overview.ProfitMargin)
        ]);
        console.log(`✅ [${symbol}] SCD Type 2 finansal metrikleri eklendi.`);

        // --- ADIM 3: GÜNLÜK FİYATLAR (INSERT-ONLY FACT) ---
        if (dailyPrices) {
          let priceCount = 0;
          for (const date in dailyPrices) {
            const dayData = dailyPrices[date];
            await client.query(`
              INSERT INTO daily_stock_prices (
                symbol, trade_date, open_price, high_price, low_price, close_price, volume
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, trade_date) DO NOTHING;
            `, [
              symbol, date, 
              parseNumber(dayData['1. open']), parseNumber(dayData['2. high']), 
              parseNumber(dayData['3. low']), parseNumber(dayData['4. close']), 
              parseNumber(dayData['5. volume'])
            ]);
            priceCount++;
            if (priceCount >= 100) break; // Son 100 günü almak yeterli
          }
          console.log(`✅ [${symbol}] ${priceCount} günlük OHLC verisi eklendi.`);
        }

        // --- ADIM 4: ÇEYREKLİK BİLANÇO (INSERT-ONLY FACT) ---
        if (incomeStatement) {
          for (const report of incomeStatement) {
            await client.query(`
              INSERT INTO quarterly_financials (
                symbol, fiscal_date_ending, reported_currency, total_revenue, net_income, operating_income
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (symbol, fiscal_date_ending) DO NOTHING;
            `, [
              symbol,
              report.fiscalDateEnding,
              report.reportedCurrency,
              parseNumber(report.totalRevenue),
              parseNumber(report.netIncome),
              parseNumber(report.operatingIncome)
            ]);
          }
          console.log(`✅ [${symbol}] Çeyreklik bilanço (Income Statement) verileri eklendi.`);
        }

        // Hata yoksa işlemi onayla
        await client.query('COMMIT');
        console.log(`🎉 [${symbol}] Tüm veritabanı işlemleri kusursuz tamamlandı!`);
        
        // Bir sonraki şirkete geçmeden önce son bir nefes (15 saniye)
        console.log(`⏳ Diğer şirkete geçmeden önce limit için 15 saniye dinleniliyor...\n`);
        await delay(15000);

      } catch (dbError) {
        // Hata varsa bu şirket için yapılan tüm DB eklemelerini geri al (Rollback)
        await client.query('ROLLBACK');
        console.error(`❌ [${symbol}] Veritabanına yazılırken hata oluştu, işlem iptal edildi (Rollback):`, dbError);
      }
    }

    console.log('\n🏆 SENKRONİZASYON GÖREVİ BAŞARIYLA BİTTİ!');

  } catch (error) {
    console.error('❌ Senkronizasyon ana motorunda kritik hata:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

syncData();