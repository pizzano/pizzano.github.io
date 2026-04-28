# Mobil scroll + logo kaldırma düzeltmesi

Yapılanlar:

1. Müşteri ana sayfasındaki büyük logo/hero alanı kaldırıldı.
2. Üstteki restoran adı kaldı; ekstra logo gösterilmiyor.
3. Mobilde sayfanın dokunmayla aşağı-yukarı kaymamasına sebep olabilecek scroll kilitleri düzeltildi.
4. Modal/sepet/profil kapalıyken `body` üzerinde kalan `modal-open`, `cart-open`, `profile-open`, `order-live-open` sınıfları otomatik eşitleniyor.
5. Menü alanında touch scroll davranışı `pan-y` olarak güçlendirildi.
6. Mobilde ana sayfa `height: auto` ve `overflow-y: auto` olacak şekilde override edildi.
