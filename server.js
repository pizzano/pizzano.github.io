app.get('/orders', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const DATA_FILE = path.join(__dirname, 'orders.json');

  if (!fs.existsSync(DATA_FILE)) {
    return res.send('<h3>Henüz kayıtlı sipariş yok.</h3>');
  }

  const orders = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const last10 = orders.slice(-10); // son 10 tanesini al

  const tableRows = last10
    .map(order => {
      const o = order.orders[0];
      const items = o.items.map(i => `${i.name} (${i.total_item_price} NOK)`).join('<br>');
      return `
        <tr>
          <td>${o.id}</td>
          <td>${o.client_first_name} ${o.client_last_name}</td>
          <td>${o.client_phone}</td>
          <td>${items}</td>
          <td>${o.total_price} ${o.currency}</td>
          <td>${o.fulfill_at ? new Date(o.fulfill_at).toLocaleString() : '-'}</td>
          <td>${o.status}</td>
        </tr>
      `;
    })
    .join('');

  const html = `
    <h2>Son 10 Sipariş (JSON)</h2>
    <pre>${JSON.stringify(last10, null, 2)}</pre>

    <hr>

    <h2>Son 10 Sipariş (Tablo)</h2>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th>Sipariş ID</th>
          <th>Müşteri</th>
          <th>Telefon</th>
          <th>Ürünler</th>
          <th>Tutar</th>
          <th>Hazırlanacak</th>
          <th>Durum</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;

  res.send(html);
});
