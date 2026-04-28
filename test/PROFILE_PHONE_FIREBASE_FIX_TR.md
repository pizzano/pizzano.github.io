# Profil + telefonnummer + Firebase kayıt düzeltmesi

Bu pakette müşteri tarafında profil ve sipariş takibi daha stabil hale getirildi.

## Yapılan değişiklikler

- Sepette artık ayrı `Navn` ve `Etternavn` yok.
- Tek alan var: `Hele navn`.
- Telefon alanı sadece 8 rakam kabul eder.
- 8 rakamdan fazla yazılamaz.
- Telefon numarası localStorage içinde saklanır.
- `Min profil` bölümünde telefon numarasına göre sipariş arama alanı eklendi.
- Profil artık sadece bu telefona ait siparişleri gösterir.
- Siparişler hem localStorage’dan hem de Firebase’den okunur.

## Firebase performans notu

Firebase Console’da görünen şu uyarıya göre yapı hafifletildi:

`Read-only and non-realtime mode activated in the data viewer to improve browser performance`

Yeni sipariş gönderildiğinde normal kayıt yine `/orders/{orderId}` altında tutulur.
Buna ek olarak küçük bir indeks kaydı da oluşturulur:

`/customerOrders/{8-haneli-telefon}/{orderId}`

Böylece müşteri profilinde bütün `/orders` ağacını okumaya gerek kalmaz.
Sistem önce telefon numarasının altındaki küçük indeks listesini okur, sonra sadece ilgili siparişleri tek tek çeker.

## Status ekranı

- Sipariş onaylanınca müşteri ekranında `Klar om dakika:saniye` görünür.
- Altında yaklaşık hazır olacağı saat gösterilir.
- Süre bitince `Maten er klar` yazar.
