# BETA — restoranbağımsız sipariş sistemi

`BETA/index.html` müşterinin arayüzüdür. `demo/` ayrı ve değişmeden kalır.

## Dosya düzeni
- `BETA/index.html` — mobil uygulamanın HTML iskeleti
- `BETA/css/app.css` — tek tasarım sistemi, dört renk teması ve hareketler
- `BETA/js/app.js` — menü, ürün seçenekleri, sepet, profil, hentetid, doğrulama
- `BETA/js/store.js` — sepet/fiyat hesabı, yerel profil, canlı sipariş API çağrısı
- `BETA/js/catalog.js` — Firebase menüsü, önbellek, tek SSE sürüm dinleyicisi ve kesintide REST yedeği
- `BETA/js/config.js` — restoran kimliği, menü veritabanı ve sipariş API ayarları
- `BETA/js/icons.js` — güvenli, yeniden kullanılabilir SVG ikonları

## Firebase veri kullanımı
Müşteri menüsü Firebase Realtime Database'den okunur; ürün verileri dosyada sabit değildir. Eski DEMO örneğinde yalnızca gerekli alanlar okunur:
`updatedAt`, `sections`, `optionGroups`, `allergenCatalog`, `popularItemIds`, `siteSettings`; `siteSettings` yoksa `settings` yedek olarak kullanılır.

Mevcut `beta:v2` menü önbelleği aynen kullanılır. İlk yükleme (cache yoksa) yalnızca `updatedAt`, `sections`, `optionGroups`, `allergenCatalog`, `popularItemIds`, `siteSettings` okur. Sonraki açılışta menü için **0 GET**; yalnızca `/updatedAt.json` SSE akışının ilk küçük sürüm değeri gelir. Değişiklik yoksa menü tekrar indirilmez. Değiştiğinde yalnızca beş public menü alanı okunur. SSE sağlıklıyken zamanlanmış Firebase GET yoktur. SSE açılamazsa 8 saniye sonra ve devamında 5 dakikada bir sadece sürüm GET kullanılır. Arka planda ve bağlantı kesilince canlı dinleyici kapatılır. BETA kök, `/settings`, `/orders`, `/pizzaBonus` okumaz.

**Gerçek sipariş gönderebilmek için:** `BETA/js/config.js` içindeki `apiBase` bir güvenli sunucu API'sine bağlanmalıdır. Şu anda bu adres boş olduğundan sipariş gönderilemez; müşteri sahte bir sipariş onayı görmez, tarayıcı yerel test siparişi yaratmaz. SMS, e-posta, yazıcı ve canlı restoran onayı henüz BETA'ya bağlanmamıştır. Bu bağlantıları kurmadan sistemi üretime açmayın.

## Özellikler
- Firebase'deki kategoriler, ürünler, resimler, boyutlar, zorunlu/opsiyonel seçenekler ve alerjenler
- Tamamen SVG kategori ikonları. Her kategoriye Firebase'den `iconKey` seçilebilir: `pizza`, `kebab`, `burger`, `meal`, `drink`, `children`, `vegetarian`, `popular`. Tanımlanmamışsa kategori adından seçilir. Gelecekte admin `iconKey` alanını değiştirir ve `updatedAt` yeniler.
- Dört semantik tema: `reference`, `lively`, `fresh`, `gourmet` ve koyu renkleri
- Ürün özelleştirme penceresi, kompakt menü kartları ve kompakt sepet
- Sepette ekstra seçimler kendi Firebase grup başlığıyla görünür; örneğin `Pommes frites på pizzaen (stor): Ja, takk!`. Gelecekteki sipariş yüküne de `groupId` ve `groupTitle` dahil edilir.
- Sepette adet 2 ve üstüyse eksi, adet 1 ise çöp kutusu. Sepet boşsa `Tøm handlekurv` görünmez.
- Profilde `Restaurantinformasjon` satırı Firebase'den gelen adres ve telefon bilgilerini gösterir. Favoriler kaldırılmıştır.
- `Kurv → Kontakt → Hentetid`: boş hentetid seçeneği ekran açılınca yaklaşık 1,5 saniye hareket eder. Seçilmeden gönderilirse kırmızı uyarı ve ikinci titreşim görüntülenir; erişilebilirlik hareket azaltma tercihine saygılıdır.
- Sipariş butonunun Norveççe adı `Send bestilling`dir. Yalnızca gerçek API yanıtı başarıyla geldikten sonra sipariş alındı ekranına geçilir.

## Güvenlik ve yönetim
Çoklu restoran verisi izole edilmelidir. Müşteri tarayıcısı keyfi fiyat, bonus puanı veya sipariş durumu yazamamalıdır. Sipariş, toplam fiyat, ödeme, alerjen, sadakat, SMS ve sipariş teyidi sunucuda doğrulanmalıdır. Her restoranın ayarları ve menü güncellemeleri ileride BETA admin panelinden yönetilmek üzere alan bazlı ve tema değişkenleriyle hazırlanmıştır.

## Firebase güvenliği ve ölçekleme (BETA beta11)
- **Canlı Firebase kuralları değiştirilmedi veya doğrulanmadı**; üretime geçmeden Console'da mevcut root `.read/.write` izinleri incelenmeli. Parent seviyesinde verilen izin alt seviyede geri alınamaz.
- Bu sürüm sadece müşteriye açık menü alanlarını REST/SSE ile okur; gerçek siparişler, SMS, bonus ve müşteri takibi için API henüz etkin değildir. İstemci fiyatı sunucu tarafından doğrulanmalıdır.
- Yeni restoranlarda `config.menu.basePath` her restoranın kendi `tenants/<id>/public/menu` düğümünü göstermeli; siparişler ve kişisel bilgiler auth/role korumalı ayrı alanda tutulmalı. Her restoran sadece kendi revision akışını dinlemelidir.
- DEMO her ayar/ürün kaydında `updatedAt` değerini yazar. Canlı yansıma bu sözleşmeye bağlıdır. `siteSettings` olmayan eski kurulumlarda cache'deki public ayarlar (varsa) veya varsayılanlar kullanılır; büyük/özel `settings` ağdan indirilmez.
- Firebase bağlantı, HTTP ve SSE protokol yükünü faturaya dahil eder. SSE'nin 5 dakikalık GET'e göre kesin tasarrufu gerçek Usage/Downloads testleri olmadan söylenemez. Her sekme kendi SSE bağlantısını açar; eski bir sekme gizlenince kapanır.
