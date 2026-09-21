# Project Scope & Wireframe

## 1. Scope (Kapsam)


### In-Scope (Kapsam Dahilinde Olanlar)
- Seçili NASDAQ şirketlerinin (AAPL, MSFT, GOOGL, vb.) Alpha Vantage API üzerinden çekilmesi.
- Çekilen finansal metriklerin PostgreSQL veritabanına kaydedilmesi ve güncellenmesi.
- API "rate limit" (kota) aşımı durumları için "retry" (yeniden deneme) mekanizmasının kurulması.
- React/Next.js kullanılarak verilerin KPI kartları ve tablolar halinde görselleştirilmesi.

### Out-of-Scope (Kapsam Dışı Bırakılanlar)
- WebSocket vb. ile milisaniyelik canlı veri akışı (Canlı borsa ekranı hedeflenmemektedir).
- Kullanıcı giriş/çıkış (Authentication) ve rol yönetimi (Proje değerlendirme odaklıdır).
- NASDAQ dışı diğer borsaların (BİST, NYSE vb.) desteklenmesi.

## 2. Wireframe (Ekran Taslağı)
Kullanıcı arayüzü (UI) tek bir Dashboard sayfası olarak tasarlanacaktır.
