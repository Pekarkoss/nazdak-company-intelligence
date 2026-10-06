# apps/api/Dockerfile
# Hafif ve hızlı bir Node.js sürümü kullanıyoruz
FROM node:20-alpine

# Çalışma dizinini ayarlıyoruz
WORKDIR /app

# Paket dosyalarını kopyalayıp bağımlılıkları yüklüyoruz
COPY package*.json ./
RUN npm install

# Tüm API kodlarını container'ın içine kopyalıyoruz
COPY . .

# Dışarıya açacağımız port
EXPOSE 3000

# Projeyi başlatma komutumuz
CMD ["npx", "tsx", "src/server.ts"]