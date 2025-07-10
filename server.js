const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

app.use(express.json());

// ✅ HTML dosyaları için public klasörünü tanıt
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 GloriaFood post
const GLORIAFOOD_MASTER_KEY = 'lyCTLx4NHZ2lxt5I4BBFzXK!4Z1FjPNS6';

app.post('/gloriafood', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== GLORIAFOOD_MASTER_KEY) {
    console.log('❌ Yetkisiz istek reddedildi.');
    return res.sendStatus(403);
  }

  const dataPath = path.join(__dirname, 'orders.json');
  let currentOrders = [];

  if (fs.existsSync(dataPath)) {
    currentOrders = JSON.parse(fs.readFileSync(dataPath));
  }

  currentOrders.push(req.body);
  if (currentOrders.length > 10) currentOrders = currentOrders.slice(-10);

  fs.writeFileSync(dataPath, JSON.stringify(currentOrders, null, 2));
  console.log('✅ Sipariş kaydedildi');
  res.sendStatus(200);
});

// ✅ JSON olarak siparişleri döndür
app.get('/orders', (req, res) => {
  const dataPath = path.join(__dirname, 'orders.json');
  if (!fs.existsSync(dataPath)) {
    return res.send('<h3>Henüz sipariş yok.</h3>');
  }
  const orders = JSON.parse(fs.readFileSync(dataPath));
  res.send('<h2>Son 10 Sipariş</h2><pre>' + JSON.stringify(orders, null, 2) + '</pre>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`));
