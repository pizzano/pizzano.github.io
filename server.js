const express = require('express');
const app = express();
app.use(express.json());

app.post('/gloriafood', (req, res) => {
    console.log('Sipariş geldi:', req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    res.send('GloriaFood Webhook Sunucusu çalışıyor!');
});

app.listen(3000, () => console.log('Sunucu 3000 portunda çalışıyor'));
