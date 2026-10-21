# BETA — restoranbağımsız sipariş sistemi

`BETA/index.html` müşterinin arayüzüdür. `demo/` ayrı ve değişmeden kalır.

## Dosya düzeni
- `BETA/index.html` — mobil uygulamanın HTML iskeleti
- `BETA/css/app.css` — tek tasarım sistemi, dört renk teması ve hareketler
- `BETA/js/app.js` — menü, ürün seçenekleri, sepet, profil, hentetid, doğrulama
- `BETA/js/store.js` — sepet, fiyat ve profil; RTDB sipariş gönderim bağlantısı
- `BETA/js/catalog.js` — Firebase menüsü, önbellek, tek SSE sürüm dinleyicisi ve kesintide REST yedeği
- `BETA/js/config.js` — restoran kimliği ve Realtime Database adresleri
- `BETA/js/orders.js` — RTDB sipariş kaydı, canlı dinleme, durum güncelleme ve eski sipariş temizliği
- `BETA/admin.html`, `BETA/js/admin.js`, `BETA/css/admin.css` — girişsiz sipariş paneli
- `BETA/js/printer.js` — Epson ePOS mutfak fişi
- `BETA/js/icons.js` — güvenli, yeniden kullanılabilir SVG ikonları

## Firebase veri kullanımı
Müşteri menüsü Firebase Realtime Database'den okunur; ürün verileri dosyada sabit değildir. Eski DEMO örneğinde yalnızca gerekli alanlar okunur:
`updatedAt`, `sections`, `optionGroups`, `allergenCatalog`, `popularItemIds`, `siteSettings`; `siteSettings` yoksa `settings` yedek olarak kullanılır.

Mevcut `beta:v2` menü önbelleği aynen kullanılır. İlk yükleme (cache yoksa) yalnızca `updatedAt`, `sections`, `optionGroups`, `allergenCatalog`, `popularItemIds`, `siteSettings` okur. Sonraki açılışta menü için **0 GET**; yalnızca `/updatedAt.json` SSE akışının ilk küçük sürüm değeri gelir. Değişiklik yoksa menü tekrar indirilmez. Değiştiğinde yalnızca beş public menü alanı okunur. SSE sağlıklıyken zamanlanmış Firebase GET yoktur. SSE açılamazsa 8 saniye sonra ve devamında 5 dakikada bir sadece sürüm GET kullanılır. Arka planda ve bağlantı kesilince canlı dinleyici kapatılır. BETA kök, `/settings`, `/orders`, `/pizzaBonus` okumaz.

**beta17:** Firebase Authentication veya sunucu API'si gerekmez. Müşteri `beta/tenants/kol-grill-pizza/orders/{orderId}` yoluna RTDB SDK ile transaction yazar; yalnızca Firebase başarı yanıtından sonra sipariş alındı gösterilir. Admin aynı dalın son 100 kaydını `orderByKey()` ile canlı dinler. Tekil sipariş dinleyicileri müşteri durumunu günceller. Firebase erişim kuralları okuma/yazmayı engelliyorsa işlem hata verir; kurallar uzaktan doğrulanmadı. SMS/e-posta otomatik göndermiyor; admin yalnızca cihazın SMS/e-posta uygulamasını açabilir.

## Özellikler
- Firebase'deki kategoriler, ürünler, resimler, boyutlar, zorunlu/opsiyonel seçenekler ve alerjenler
- Tamamen SVG kategori ikonları. Her kategoriye Firebase'den `iconKey` seçilebilir: `pizza`, `kebab`, `burger`, `meal`, `drink`, `children`, `vegetarian`, `popular`. Tanımlanmamışsa kategori adından seçilir. Gelecekte admin `iconKey` alanını değiştirir ve `updatedAt` yeniler.
- Dört semantik tema: `reference`, `lively`, `fresh`, `gourmet` ve koyu renkleri
- Ürün özelleştirme penceresi, kompakt menü kartları ve kompakt sepet
- Sepette ekstra seçimler kendi Firebase grup başlığıyla görünür; örneğin `Pommes frites på pizzaen (stor): Ja, takk!`. Gelecekteki sipariş yüküne de `groupId` ve `groupTitle` dahil edilir.
- Sepette adet 2 ve üstüyse eksi, adet 1 ise çöp kutusu. Sepet boşsa `Tøm handlekurv` görünmez.
- Profilde `Restaurantinformasjon` satırı Firebase'den gelen adres ve telefon bilgilerini gösterir. Favoriler kaldırılmıştır.
- `Kurv → Kontakt → Hentetid`: boş hentetid seçeneği ekran açılınca yaklaşık 1,5 saniye hareket eder. Seçilmeden gönderilirse kırmızı uyarı ve ikinci titreşim görüntülenir; erişilebilirlik hareket azaltma tercihine saygılıdır.
- Sipariş butonunun Norveççe adı `Send bestilling`dir. Yalnızca RTDB yazmayı kabul ettiğinde sipariş alındı ekranına geçilir.

## beta17 — doğrudan Realtime Database
- Firebase Authentication, Vercel ve Cloud Functions kullanılmaz. Siparişler DEMO'daki `/orders` yerine yalnızca BETA'nın ayrı `/beta/tenants/<id>/orders` dalına yazılır.
- Sipariş ID'leri zaman sıralı ve rastgeledir; tekrarlanan ağ denemelerinde aynı ID için transaction çalışır.
- Admin login olmadan açılır. Ürün fiyatı yalnızca admin ekranında tekrar hesaplanır. Bu güvenlik kontrolü değildir; kullanıcı veriyi değiştirebilir.
- **Önemli:** Kimlik doğrulama yokken Firebase'in herkese açık okuma/yazma kuralları müşteri bilgilerini açığa çıkarır ve siparişlerin değiştirilmesine izin verir. Bu sürüm üretim güvenliği sağlamaz. Firebase konsolundaki canlı Rules bu kod tarafından değiştirilmemiştir.
- Otomatik SMS/e-posta servisi yoktur. Epson yalnızca tarayıcının yerel yazıcıya erişebildiği cihazda çalışır.
- Arşiv üretilmez. 100'den eski siparişler yalnızca tamamlandıklarında, 72 saat geçtiğinde ve pizzabonus uzlaşması sağlandığında silinebilir.

## beta12: Restaurantinformasjon tasarımı
- Mevcut profil `Restaurantinformasjon` penceresi referans görsel tarzında yeniden düzenlendi: restoran başlığı, görsel, açık/kapalı durumu, saatler, hentetid, sonraki saatler, kontakt, ve iki işlevsel arama/harita bağlantısı. Masaüstü merkez modal, mobil kompakt alt sheet.
- İsim/logo/telefon/adres/açılış/kapanış/slots ve pickup süresi mevcut Firebase catalog önbelleğinden hesaplanır; yeni Firebase GET veya listener eklenmedi. Header fotoğrafı varsa aynı catalog içindeki pizza ürün resmini yeniden kullanır.
- `siteSettings.paymentInfo` ve `siteSettings.paymentMethods` (isteğe bağlı dizi) diğer açık `siteSettings` alanlarıyla aynı mevcut GET üzerinden desteklenir. Tanımlı değilse ödeme yöntemi uydurulmaz.
- `demo/` etkilenmez. Tüm tema renkleri CSS değişkenlerinden türetilir; eski info stilleri doğrudan kaldırıldı.

## beta13: kompakt Restaurantinformasjon
- Restaurantinformasjon holder seg innenfor hovedappens bredde (maks 560px), med 6px mobilmarg.
- Neste hentetider-kort, ikon og ubrukt CSS er fjernet, sammen med betalingslogoer.
- Betaling viser Kort og kontant via BETA-restauranten sin config; eventuelt siteSettings.paymentInfo kan overstyre uten ekstra Firebase-kall.
- E-post vises fra samme Firebase siteSettings.email/contactEmail når registrert. Restaurantens BETA-config har en tenant-spesifikk e-post som fallback for eksisterende lokal cache.
- Adresse dupliserer ikke postnummer og sted når de allerede finnes i streetAddress. Ingen endring i DEMO eller Firebase synkroniseringslogikk.

## beta14 — kaydırma düzeni
- Kategori çubuğunda (buton ve gösterge üstünde de) fare dikey tekerleği yatay kaydırır; yatay touchpad jestleri ve mobil dokunma doğal çalışır. Scroll bitişinde dikey tekerlek engellenmez, Ctrl+wheel/zoom değişmez.
- MainContent ve her tür sheet-scroll (ürün/restaurant modalı) için tek CSS bloğunda 5px Soft UI turkuaz scrollbar: Firefox scrollbar-color + Chromium/Opera WebKit thumb/track. Üst kategori native scrollbar gizli kalır çünkü mevcut ince özel scrollbar zaten görünür ve aynı tonu kullanır.
- Firebase katalog, SSE ve veri önbelleği koduna hiç dokunulmadı.
