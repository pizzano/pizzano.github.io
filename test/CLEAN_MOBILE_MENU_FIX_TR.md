# Clean mobile menu fix

Bu sürümde müşteri menüsü sadeleştirildi ve mobilde takılma/sıçrama yapan noktalar azaltıldı.

Yapılanlar:

1. Menü kategori başlıkları görselin üzerine alındı.
2. Ürün satırları daha sade liste görünümüne getirildi.
3. Küçük ürün görselleri büyütüldü ve kart görünümü temizlendi.
4. Ürün isimleri tamamen büyük harf olmaktan çıkarıldı.
5. Mobilde lazy yükleme kapatıldı; tüm kategoriler tek seferde basılır.
6. content-visibility devre dışı bırakıldı; mobil scroll takılması azaltıldı.
7. Mobil sepet ve ürün popup yüksekliği 100svh ile sabitlendi.
8. Send bestilling butonu fixed yerine sticky yapıldı; klavye/scroll takılması azaltıldı.
9. Mobilde sepet animasyonları kapatıldı.

Değişen dosyalar:
- index.html
- styles.css
- app.js
