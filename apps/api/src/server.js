"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const stockService_1 = require("./stockService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.send('NASDAQ API Çalışıyor 🚀');
});
// Yeni: Veri çekme ve kaydetme tetikleyicisi
app.post('/api/sync/:symbol', async (req, res) => {
    try {
        const symbol = req.params.symbol.toUpperCase();
        const result = await (0, stockService_1.fetchAndSaveCompanyData)(symbol);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Veri senkronizasyonu başarısız oldu." });
    }
});
app.listen(port, () => {
    console.log(`Sunucu ${port} portunda başlatıldı: http://localhost:${port}`);
});
//# sourceMappingURL=server.js.map