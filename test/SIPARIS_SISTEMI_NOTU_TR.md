# Sipariş sistemi notu

Bu sürümde sipariş sistemi Firebase içinde `/orders` alanına yazar.

## Müşteri tarafı
- Sepette ürün varsa müşteri ad, soyad ve telefon yazar.
- Varsayılan henting: **Snarest mulig**.
- İsterse **Velg hentetid** seçer.
- Hentetid minimum `minPreorderMinutes` kadar ileride ve kapanış saatine kadar olabilir.
- Sipariş gönderilince müşteri ekranda onay bekler.
- Admin onaylayınca müşteriye “Siparişiniz alındı / Klar om X minutter” görünür.
- Müşteri aynı tarayıcıda son 2 siparişini görür.

## Admin tarafı
- Üst menüde **Bestillinger** sekmesi var.
- Gelen siparişler burada fiş gibi görünür.
- Dakika alanı 1–99 arasıdır.
- Godkjenn: siparişi onaylar.
- Avvis/kanseller: siparişi iptal eder.

## Önemli teknik not
Admin menü kaydederken artık Firebase root için `set()` değil `update()` kullanır. Böylece menüyü kaydederken `/orders` silinmez.
