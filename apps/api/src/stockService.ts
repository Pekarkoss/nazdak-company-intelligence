import axios from 'axios';
import { pool } from './db';

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export async function fetchAndSaveCompanyData(symbol: string) {
  try {
    // Alpha Vantage'den şirket temel analiz (OVERVIEW) verilerini çekiyoruz
    const response = await axios.get(`${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`);
    const data = response.data;

    // API limitine takılırsak veya geçersiz sembol girilirse koruma
    if (!data || Object.keys(data).length === 0 || data.Information) {
        throw new Error("API'den veri dönmedi veya Rate Limit aşıldı.");
    }

    // 1. Şirketi veritabanına ekle (Varsa atla)
    await pool.query(
      `INSERT INTO companies (symbol, company_name)
       VALUES ($1, $2)
       ON CONFLICT (symbol) DO NOTHING`,
      [data.Symbol, data.Name]
    );

    // 2. Finansal metrikleri ekle
    await pool.query(
      `INSERT INTO financial_metrics
       (symbol, pe_ratio, revenue_ttm, net_profit_margin, operating_margin)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.Symbol,
        data.PERatio || null,
        data.RevenueTTM || null,
        data.ProfitMargin || null,
        data.OperatingMarginTTM || null
      ]
    );

    return { success: true, message: `${data.Name} (${symbol}) verileri veritabanına kaydedildi.` };
  } catch (error: any) {
    console.error(`[${symbol}] Veri çekme hatası:`, error.message);
    throw error;
  }
}