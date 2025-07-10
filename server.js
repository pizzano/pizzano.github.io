const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'orders.json');

// Sipariş verisi al
app.post('/gloriafood', (req, res) => {
  const newOrder = req.body;

  // Var olanları oku
  let orders = [];
  if (fs.existsSync(DATA_FILE)) {
    orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }

  // En üste yeni siparişi ekle
  orders.unshift(newOrder);

  // Sadece son 10 siparişi tut
  if (orders.length > 10) {
    orders = orders.slice(0, 10);
  }

  // Dosyaya yaz
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));

  console.log('✅ Sipariş kaydedildi!');
  res.sendStatus(200);
});

// Web üzerinden siparişleri görüntüle
app.get('/orders', (req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    return res.send('Henüz sipariş yok.');
  }

  const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  res.send(`<h2>Son 10 Sipariş</h2><pre>${JSON.stringify(orders, null, 2)}</pre>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Sunucu ${PORT} portunda çalışıyor`));
