
import { AlphaVantageAdapter } from './alphaVantageAdapter';

async function testFetch() {
  const adapter = new AlphaVantageAdapter('NQIH0KLVGI1SQ6GW'); 
  try {
    const rawData = await adapter.fetchCompanyOverview('AAPL');
    console.log('--- HAM VERİ ÖRNEĞİ ---');
    console.log({
      Symbol: rawData.Symbol,
      Name: rawData.Name,
      PERatio: rawData.PERatio,
      RevenueTTM: rawData.RevenueTTM
    });

    const normalized = adapter.normalizeCompanyData(rawData);
    console.log('--- NORMALİZE EDİLMİŞ VERİ ---');
    console.log(normalized);
  } catch (err) {
    console.log('Test başarısız oldu.');
  }
}

testFetch();