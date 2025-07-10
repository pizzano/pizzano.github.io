app.get('/orders', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const DATA_FILE = path.join(__dirname, 'orders.json');

  if (!fs.existsSync(DATA_FILE)) {
    return res.send('<h3>Henüz kayıtlı sipariş yok.</h3>');
  }

  const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const last10 = orders.slice(-10); // son 10 tanesini al

  res.send(`<h2>Son 10 Sipariş</h2><pre>${JSON.stringify(last10, null, 2)}</pre>`);
});
