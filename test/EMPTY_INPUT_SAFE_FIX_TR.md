# Boş değer güvenlik düzeltmesi

Bu sürümde admin ve müşteri tarafında boş/null/eksik değerler sistemi bozmasın diye koruma eklendi.

## Yapılan ana düzeltmeler

- Firebase `/orders` içinde bozuk, boş veya eksik alanlı test kayıtları varsa admin panel komple çökmez.
- Siparişte müşteri adı, telefon, ürün, toplam, tarih gibi alanlar eksikse güvenli varsayılan değer kullanılır.
- Sipariş listesinde bir kayıt hatalıysa diğer siparişler yine görünür.
- Müşteri tarafında localStorage içinde bozuk eski sipariş varsa profil ve sipariş durumu ekranı kırılmaz.
- Sipariş onay ekranındaki tekrar eden `Klar om ...` yazısı kaldırıldı.
- Ürün/sipariş JSON alanlarında boş değer varsa sistem olabildiğince güvenli şekilde devam eder.

## Not

Eğer Firebase içinde tamamen alakasız bir kayıt varsa panel artık çökmez; hatalı kayıt ya atlanır ya da `feil format` olarak gösterilir.
