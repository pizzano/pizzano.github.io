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
`updatedAt`, `sections`, `optionGroups`, `allergenCatalog`, `popularItemIds`, `siteSettings`. Tam `/settings` ağdan indirilmez; önbellekteki eski ayarlar yalnızca uyumluluk için kullanılabilir.

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

## beta15 — güvenli sipariş ve restoran paneli iskeleti

**Yayınlanan kod:**
- `BETA/admin.html`, `BETA/js/admin.js`, `BETA/css/admin.css`: mobil/PC Bestillinger paneli, çalışan girişi, Alle/Planlagte, arama, canlı sipariş listesi, Bekreft, Marker klar, Utlevert ve manuel Skriv ut på nytt. Admin oturumu sunucu tarafından doğrulanmadıkça herhangi bir sipariş okunmaz veya yazılmaz.
- `BETA/js/printer.js`: bağımsız Epson TM-T20II 80mm raster ePOS kopyası; sadece onayı veren cihaz ilk başarılı, yeni durum geçişinden sonra yazdırır. İşlem tekrarı otomatik ikinci fiş üretmez. Yeniden yazdırma ayrı çalışır. IP cihazda `beta:printer:<tenantId>:host` ile saklanır (asla Firebase'de aralıklı sorgulanmaz).
- `BETA/js/store.js`: sunucunun idempotent kabulünü zorunlu kılan sipariş gönderme. Tekrar denemelerde aynı payload için aynı UUID kullanılır; istemci kendi başına sipariş kabulü uydurmaz. Yanıt `mottatt`, sunucu ID'si ve `createdAt` içermelidir.
- `BETA/js/order-status.js`: sadece `confirmed` ve `Mine bestillinger` açıkken, yalnızca en güncel aktif siparişin yetkili statü SSE akışını takip eder. İstemci tam `/orders` okumaz. Sayfa arka plandayken veya kapandığında bağlantı kapanır. SSE sorununda yalnızca aynı sipariş için küçük durum GET kullanılır.
- `BETA/js/catalog.js` ve modül import URL'leri aynı sürüme eşitlendi; birden fazla config örneği yaratılmaz. Mevcut `beta:v2` menü/sepetteki kullanıcı önbelleği korunur.

**Güvenlik nedeniyle canlı BETA siparişleri HÂLÂ DEVRE DIŞI.**
`config.apiBase` artık Vercel BETA API adresine ayarlandı; ancak özel sunucu kimlik bilgileri sağlanana kadar güvenli şekilde 503 döner; `/api`, DEMO, Firebase kuralları veya canlı SMS/e-posta servislerine dokunulmadı. Sunucu kimliği, Firebase Admin SDK kimlik bilgileri, HTTPS, doğru Security Rules ve sipariş doğrulaması olmadan doğrudan istemci Firebase yazması güvenli değildir. Yeni admin sayfası boş/kapalı durumu açıkça gösterir.

### BETA API sözleşmesi — sunucu tarafında uygulanması ZORUNLU
Tüm yollar `{apiBase}/v1/tenants/{tenantId}` altındadır; tenant, domain ve restoran erişimi sunucu tarafında doğrulanmalıdır. `cache-control: no-store` kullan.

**Müşteri (oturum gerektirmeyen, hız sınırlı):**
- `POST /orders` — `Idempotency-Key: <UUID>` başlığı + menüdeki ürün ID/size/choice/quantity, iletişim, pickup ile gönderilir. Sunucu fiyatı, ekstraları, geçerli restoran saatini, hentetid, idempotency anahtarını ve bonusu **sunucu tarafındaki güncel menüden** yeniden doğrular; kimlik/fiyatı istemciden doğru varsaymaz. Tek transaction içinde `mottatt` oluşturur, tekrarında aynı kimliği döner. Başarılı JSON: `{id,tenantId,status:"mottatt",createdAt,accessToken}`. `accessToken` en az 20 karakter, kriptografik rastgele ve **yalnızca bu siparişi okumaya** yetkili olmalıdır. Kalıcı veritabanında düz metin token saklama, hash sakla.
- `GET /orders/{id}/events` — `Authorization: Bearer <accessToken>` ile sadece o siparişin `{id,status,statusUpdatedAt,estimatedReadyAt}` SSE olaylarını ve ilk snapshot'ını verir. Diğer müşterilerin bilgilerini asla içermez.
- `GET /orders/{id}/status` — aynı Bearer ile küçük JSON/ETag; sadece SSE çalışmadığında. Kod 304 yanıtını kabul eder.

**Restoran admin (giriş zorunlu, HttpOnly Secure SameSite cookie + CSRF):**
- `POST /admin/sessions` — çalışan kullanıcı adı/şifreyi yalnızca sunucu doğrular; `{authenticated:true,csrfToken}` döner. Giriş deneme sınırı ve rol denetimi gereklidir.
- `GET /admin/session` — aynı oturumun durumunu ve CSRF token'ını döner; `DELETE /admin/sessions` çıkış yapar.
- `GET /admin/orders/events?status=active&limit=100` — ilk `{type:"snapshot",orders:[...]}`, ardından sadece ilgili tenant'ın aktif siparişlerinden `{type:"upsert",order}` veya `{type:"remove",id}` SSE. `mottatt,bekreftet,tilberedning,klar` ile sınırla; eski arşivi dinleme.
- `GET /admin/orders?status=active&limit=100` — yalnızca canlı akış düştüğünde 30 saniyede bir fallback; rol denetimi + sunucu filtreleri/limitleri zorunlu.
- `POST /admin/orders/{id}/confirm|ready|complete` — `X-CSRF-Token` ve `idempotencyKey,expectedStatus,expectedVersion` ile sunucuda atomik beklenen durum kontrolü. Yanıt `{order,transitioned:true|false}`. **Yalnızca** `transitioned:true` ilk mutfak fişini tetikler. `mottatt→bekreftet→klar→fullfort` geçişleri personel yetkisiyle yapılır. `Klar` yalnızca butona basılınca olur, süre dolunca olmaz.
- Onay transition'u ayrıca sunucu tarafındaki bildirim outbox'ına **bir** `accepted` SMS ve varsa e-posta fişi kaydetmeli. SMS `Klar` için **otomatik gönderilmemeli**. E-posta için kabul ve (isteğe bağlı) gerçek manuel `Klar` olayı ayrıdır. Kanıtlanmış teslimat olmadan `sent` gösterme. Ağ zaman aşımında yanıt gelmeyen SMS'i körlemesine tekrarlama.

**Çok restoran ve maliyet:**
- Önerilen sunucu veri yolları: `tenants/{id}/public/menu`, `tenants/{id}/orders/active`, `tenants/{id}/orders/archive`, `tenants/{id}/notifications/outbox`, `tenants/{id}/staff` ve kimlik erişim haritası. Başka restoranın verisi sorguya dahil edilmemeli.
- Her restoran admin için **bir** yetkili aktif sipariş SSE; her açık müşteri durum ekranı için **bir** özel sipariş SSE; menü için **bir** küçük `updatedAt` SSE. Aynı sipariş listesi için yeni polling başlatma.
- 100 müşteri sipariş geçmişi açık değilse sadece menü sürüm akışları açık kalır. Aktif sipariş ekranı açık olan 100 müşteri için ilave 100 küçük durum akışı olur. SSE'nin polling'e maliyet avantajı varsayılmamalıdır: gerçek Firebase faturası, aktif bağlantı ve aktarılan bayt ölçülmelidir.
- Üretime geçişte var olan DEMO `/orders` hiçbir şekilde BETA için herkese açık yazma yolu olarak kullanılmamalıdır.

## beta16 — sparsom SSE fallback
- Admin SSE kobler til på nytt med backoff ved lukket strøm. GET-fallback kun hvert 60. sekund dersom strømmen er nede. Frisk SSE genererer ingen fallback GET.
- Kundens private ordrestrøm tar høyst én umiddelbar status GET ved strømfeil før den forsøker ny SSE med backoff.
- Dette aktiverer **ikke** bestillinger. Adminidentitet, betalingssikkerhet, Firebase-tilgang og varsling krever sikker server-API. DEMO er urørt.

## beta18 — güvenli BETA sipariş sunucusu (ortam değişkenleri olmadan kapalı)
- `api/beta.js` yalnızca BETA için Vercel API, `/api/beta/:path*` yönlendirmesi `vercel.json` içinde. DEMO ve eski SMS health API'leri değişmedi.
- Özel Firebase Realtime Database + sunucu hesabı zorunlu; DEMO'ya ait herkese açık/yazılabilir veritabanında müşteri siparişi oluşturulması bilinçli engellenir. Anonim okuma reddi kontrol edilir.
- Müşteri siparişleri sunucuda korunmuş menü kopyasından tekrar fiyatlandırılır. Admin ilk oturumda özel menü eksikse eski DEMO menüsünü bir kez içeri alır; sonradan gerektiğinde menü senkronizasyonunu elle başlatabilir. Menü importu yalnızca yetkili admin işlemidir.
- Idempotent sipariş oluşturma, Bearer ile yalnızca siparişin durumunu okuma, admin şifreli oturum, tek REST/SSE gerçek zamanlı aktif liste, onay, süre değiştirme, hazır, teslim, arşiv ve Epson fiş adapteri hazırlandı. Müşteri mesajları için Traccar/Resend kodu eklenmiştir; yalnızca ilk onay SMS'i, belirsiz gönderimler asla körlemesine tekrarlanmaz.
- **Gerçek servis testi yapılamadı:** Vercel projesinde BETA için gerekli Firebase servis hesabı, ayrı veritabanı, admin kullanıcı ve bildirim sağlayıcı anahtarları yok. Testler sahte Firebase/SMS/e-posta ile çalışır, gerçek alıcılara bildirim gitmez.
- API kurulum gereksinimleri ve güvenlik sınırları için `BETA/API-DEPLOYMENT.md` dosyasına bak. `BETA/firebase.rules.json` kuralları yalnızca örnektir, canlı veritabanına otomatik uygulanmaz.

## beta19 – åpen visning av BETA-administrasjon
- Brukernavn/passord og innloggingssperre er midlertidig fjernet fra `BETA/admin.html`, og admin-siden åpnes direkte med Alle/Planlagte, søk og detaljlayout.
- Inntil en sikker innloggingsløsning er valgt, sender den åpne siden **ingen** forespørsler om private ordre, og knapper for datatilgang/import er deaktivert. Ingen kundeopplysninger eksponeres; ingen falske ordre vises.
- Backend `api/beta.js` beholder krav om autentisert admin for liste, statusendringer, SMS, e-post og katalogimport. DEMO og Firebase Security Rules ble ikke endret.

## beta20 – åpen administrasjon: tom-listen rendres korrekt første gang og ved endret filter.

## beta21 – korumalı sipariş akışı
- Müşteri onay öncesi istenen hentetid, onay sonrası sunucudaki gerçek hentetid görüntülenir.
- Admin yetkisi parola yerine e-postaya gelen tek kullanımlık kod ile sağlanır (7 dk kod, 5 deneme, 2 dk bekleme, 8 saatlik tab oturumu).
- Arşiv sadece Historikk seçildiğinde yetkili ve sınırlı 50 kayıt sorgusuyla yüklenir; canlı dinleyici değildir.
- Sipariş durumu uyuşmayan geçişler 409 döner; tekrarlanan onay SMS ve mutfak fişi tekrarını tetiklemez.
- DEMO değişmedi. Gerçek üretim testi için ayrı özel Firebase ve bildirim kimlikleri zorunludur.

## beta22 – admin giriş formu geçici olarak kaldırıldı
- Admin sayfası doğrudan açılır, e-posta kodu / giriş ekranı gösterilmez. Alle, Planlagte, Historikk ve arama UI korunur.
- Herkese açık sipariş erişimi veya kişisel müşteri bilgisi verilmez. Sunucu yetkilendirmesi kaldırılmamıştır; gerçek sipariş işlemleri kimlik yetkisi verilene kadar kapalıdır.
- DEMO ve Firebase kuralları değişmedi.
