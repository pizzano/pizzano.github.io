const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// JSON body okuma
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'orders.json');
const GLORIAFOOD_MASTER_KEY = 'lyCTLx4NHZ2lxt5I4BBFzXK!4Z1FjPNS6';

// Siparişi alma endpointi (son gelen)
app.get('/orders', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.json({ message: 'Henüz kayıtlı sipariş yok.' });
  }

  const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const last = orders[orders.length - 1]; // sadece son sipariş
  res.json(last);
});

// Sipariş kaydetme endpointi (GloriaFood webhook)
app.post('/gloriafood', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== GLORIAFOOD_MASTER_KEY) {
    return res.sendStatus(403);
  }

  let orders = [];
  if (fs.existsSync(DATA_FILE)) {
    orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }

  orders.push(req.body);
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
  console.log('✅ Yeni sipariş alındı:', req.body);
  res.sendStatus(200);
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
});
