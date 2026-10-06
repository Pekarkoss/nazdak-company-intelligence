import axios from 'axios';

export class AlphaVantageAdapter {
  private apiKey: string;
  private baseUrl: string = 'https://www.alphavantage.co/query';

  constructor(apiKey: string = process.env.ALPHA_VANTAGE_API_KEY || 'demo') {
    this.apiKey = apiKey;
  }

  /**
   * Terminali renklendiren ve saat bilgisini tutan özel Log motoru
   */
  private log(level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR', message: string) {
    const time = new Date().toISOString().split('T')[1].split('.')[0]; // Sadece HH:MM:SS
    
    switch (level) {
      case 'INFO':
        console.log(`[${time}] 📡 \x1b[36m[BİLGİ]\x1b[0m ${message}`); // Camgöbeği
        break;
      case 'SUCCESS':
        console.log(`[${time}] ✅ \x1b[32m[BAŞARILI]\x1b[0m ${message}`); // Yeşil
        break;
      case 'WARN':
        console.log(`[${time}] ⚠️ \x1b[33m[UYARI]\x1b[0m ${message}`); // Sarı
        break;
      case 'ERROR':
        console.error(`[${time}] ❌ \x1b[31m[HATA]\x1b[0m ${message}`); // Kırmızı
        break;
    }
  }

  /**
   * 1. Finansal Metrikler (OVERVIEW)
   */
  async fetchCompanyOverview(symbol: string) {
    this.log('INFO', `[${symbol}] OVERVIEW (Genel Bakış) verisi Alpha Vantage'dan talep ediliyor...`);
    try {
      const response = await axios.get(`${this.baseUrl}?function=OVERVIEW&symbol=${symbol}&apikey=${this.apiKey}`);
      
      // Alpha Vantage API limit aşımlarında hata kodu dönmez, içinde 'Information' geçen bir mesaj döner.
      if (response.data && response.data.Information) {
         this.log('WARN', `[${symbol}] API limitine takıldın (Dakikada 5 istek). Lütfen bekle.`);
         return null; 
      }
      
      this.log('SUCCESS', `[${symbol}] OVERVIEW verisi başarıyla indirildi.`);
      return response.data;
    } catch (error: any) {
      this.log('ERROR', `[${symbol}] OVERVIEW verisi çekilemedi: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2. Günlük OHLC Fiyatları (TIME_SERIES_DAILY)
   */
  async fetchDailyPrices(symbol: string) {
    this.log('INFO', `[${symbol}] TIME_SERIES_DAILY (Günlük Fiyatlar) talep ediliyor...`);
    try {
      const response = await axios.get(`${this.baseUrl}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${this.apiKey}`);
      
      if (response.data && response.data.Information) {
         this.log('WARN', `[${symbol}] API limitine takıldın (TIME_SERIES_DAILY).`);
         return null;
      }

      this.log('SUCCESS', `[${symbol}] Günlük Fiyat verisi başarıyla indirildi.`);
      return response.data['Time Series (Daily)'];
    } catch (error: any) {
      this.log('ERROR', `[${symbol}] TIME_SERIES_DAILY çekilemedi: ${error.message}`);
      throw error;
    }
  }

  /**
   * 3. Çeyreklik Gelir Tablosu (INCOME_STATEMENT)
   */
  async fetchIncomeStatement(symbol: string) {
    this.log('INFO', `[${symbol}] INCOME_STATEMENT (Gelir Tablosu) talep ediliyor...`);
    try {
      const response = await axios.get(`${this.baseUrl}?function=INCOME_STATEMENT&symbol=${symbol}&apikey=${this.apiKey}`);
      
      if (response.data && response.data.Information) {
         this.log('WARN', `[${symbol}] API limitine takıldın (INCOME_STATEMENT).`);
         return null;
      }

      this.log('SUCCESS', `[${symbol}] Gelir Tablosu başarıyla indirildi.`);
      return response.data['quarterlyReports'];
    } catch (error: any) {
      this.log('ERROR', `[${symbol}] INCOME_STATEMENT çekilemedi: ${error.message}`);
      throw error;
    }
  }
}