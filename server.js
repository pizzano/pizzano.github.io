const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/orders', (req, res) => {
  const DATA_FILE = path.join(__dirname, 'orders.json');

  if (!fs.existsSync(DATA_FILE)) {
    return res.status(404).json({ message: 'Henüz kayıtlı sipariş yok.' });
  }

  const allOrders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const last10 = allOrders.slice(-10);

  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify(last10, null, 2));
});

app.listen(PORT, () => {
  console.log(`Server çalışıyor: http://localhost:${PORT}`);
});
