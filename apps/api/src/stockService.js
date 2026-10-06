"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAndSaveCompanyData = fetchAndSaveCompanyData;
const axios_1 = __importDefault(require("axios"));
const db_1 = require("./db");
const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';
async function fetchAndSaveCompanyData(symbol) {
    try {
        // Alpha Vantage'den şirket temel analiz (OVERVIEW) verilerini çekiyoruz
        const response = await axios_1.default.get(`${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${API_KEY}`);
        const data = response.data;
        // API limitine takılırsak veya geçersiz sembol girilirse koruma
        if (!data || Object.keys(data).length === 0 || data.Information) {
            throw new Error("API'den veri dönmedi veya Rate Limit aşıldı.");
        }
        // 1. Şirketi veritabanına ekle (Varsa atla)
        await db_1.pool.query(`INSERT INTO companies (symbol, company_name)
       VALUES ($1, $2)
       ON CONFLICT (symbol) DO NOTHING`, [data.Symbol, data.Name]);
        // 2. Finansal metrikleri ekle
        await db_1.pool.query(`INSERT INTO financial_metrics
       (symbol, pe_ratio, revenue_ttm, net_profit_margin, operating_margin)
       VALUES ($1, $2, $3, $4, $5)`, [
            data.Symbol,
            data.PERatio || null,
            data.RevenueTTM || null,
            data.ProfitMargin || null,
            data.OperatingMarginTTM || null
        ]);
        return { success: true, message: `${data.Name} (${symbol}) verileri veritabanına kaydedildi.` };
    }
    catch (error) {
        console.error(`[${symbol}] Veri çekme hatası:`, error.message);
        throw error;
    }
}
//# sourceMappingURL=stockService.js.map