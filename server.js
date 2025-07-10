const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Gerekirse CORS açmak için
// const cors = require('cors');
// app.use(cors());

app.get('/orders', (req, res) => {
  const DATA_FILE = path.join(__dirname, 'orders.json');

  if (!fs.existsSync(DATA_FILE)) {
    return res.send('<h3>Henüz kayıtlı sipariş yok.</h3>');
  }

  const allOrders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const last10 = allOrders.slice(-10)[0]?.orders || [];

  let html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Son Siparişler</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h2>Son Siparişler</h2>
        <table>
          <tr>
            <th>Ad Soyad</th>
            <th>Telefon</th>
            <th>Email</th>
            <th>Ürün</th>
            <th>Toplam (NOK)</th>
            <th>Ödeme</th>
            <th>Durum</th>
            <th>Tarih</th>
          </tr>`;

  if (last10.length === 0) {
    html += `<tr><td colspan="8">Veri yok</td></tr>`;
  } else {
    last10.forEach(order => {
      const name = `${order.client_first_name} ${order.client_last_name}`;
      const phone = order.client_phone || '';
      const email = order.client_email || '';
      const total = order.total_price || '';
      const status = order.status || '';
      const date = new Date(order.updated_at).toLocaleString('no-NO');
      const payment = order.payment || '';
      const item = order.items?.[0]?.name || '';

      html += `
        <tr>
          <td>${name}</td>
          <td>${phone}</td>
          <td>${email}</td>
          <td>${item}</td>
          <td>${total}</td>
          <td>${payment}</td>
          <td>${status}</td>
          <td>${date}</td>
        </tr>`;
    });
  }

  html += `
        </table>
      </body>
    </html>`;

  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
