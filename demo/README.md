# Sipariş sistemi — demo/

Bu klasör müşteri sipariş ekranı ve restoran yönetim panelinin güncel kaynaklarını içerir. Çalışan sistemin durumu ve ayarları için esas kaynak Firebase RTDB'dir; bu belge çalışma geçmişi değildir.

## Mimari

- Müşteri: `index.html`, `js/customer.js`.
- Restoran: `admin.html`, `js/admin.js`.
- Firebase REST, sipariş ve menü işlemleri: `config.js`, `js/data.js`.
- Açılış saatleri: Firebase `settings.weeklyHours` (Pazartesi–Pazar). Eski `openingTime`, `orderOpenTime` ve `orderCloseTime` alanları artık kullanılmaz.
- Sipariş süresi: `js/order-confirmation.js`. Normal bekleyen siparişlerde 3 dakika; `confirmationNoTimeout` işaretli ön siparişlerde aynı sayaç kullanılmaz.
- Sadakat/müşteri kaydı: `js/loyalty.js`, `js/loyalty-sync.js`; kalıcı müşteri toplamları `customers/{phone}` altında.
- Sipariş temizliği: `js/orders-archive.js` (aktif siparişleri ve bildirim güvenlik süresini korur).
- Yazıcı: `js/order-printer.js` (Epson ePOS); cihazın yerel ağ erişimi ve yazdırma ayrıca test edilir.
- SMS/e-posta: `integrations/google-apps-script/README.md`; Google Apps Script kaynakları GitHub üzerinden otomatik güncellenmez.
- Hata kayıtları: `js/system-errors.js`; tüm dış servis hatalarını kapsamaz.
- PWA/önbellek: `service-worker.js`, `manifest.webmanifest`; tasarım dosyaları `css/` altında.
- Android admin paketi: `admin-apk/README.md`.

## Temel akış

1. Müşteri menüden siparişi Firebase'e gönderir.
2. Admin paneli yeni siparişi gösterir; çalışan `Godta` ile onaylar.
3. Müşteri durumu Firebase üzerinden takip eder; `Klar for henting` ayrıca çalışan tarafından işaretlenir.
4. SMS ve e-postayı ayrı Google Apps Script süreçleri gönderir. Gönderim kayıtları, servis tarafından kabulü ifade eder; telefona/gelen kutusuna teslim garantisi değildir.

Müşteri tarayıcısında tam sipariş geçmişinin kalıcı bir kopyası tutulmaz. Açık oturumda sınırlı sipariş kimlikleri kullanılır; başka cihazda sipariş bağlantısı gerekir.

## Başlıca Firebase yolları

- `settings`, `orders`, `customers`.
- `notifications/templates/{smsAccepted|emailAccepted|emailReady}`.
- `notifications/tests/{kind}/{request|result}`.
- `notifications/smsHealth`, `notifications/emailHealth`.
- `systemErrors`, `systemErrorsArchive` (teşhis kayıtları).

## Geliştirme ve yayınlama

- **Yalnızca `demo/` üzerinde çalış.** Kök dizindeki diğer projelere dokunma.
- Değişiklikten önce ilgili kodun gerçek kullanımını ve Firebase alanlarını kontrol et. Siparişler veya müşteri kayıtları test için silinmez.
- Kod/dosya referansı kontrolü: `node demo/tools/audit-references.mjs`.
- Otomatik testler: `node --experimental-default-type=module --test demo/tests/*.test.mjs`.
- GitHub'daki dosyaları güncellemek **canlı Apps Script dosyalarını güncellemez**. Aktif tetikleyicileri, Script Properties ve SMS/e-posta gönderim kayıtlarını koru.
- Yayından sonra müşteri + admin tarayıcısı, Firebase sipariş/onay, SMS/e-posta, saat seçimi ve gerekiyorsa Epson yazıcı üzerinde gerçek test yap. Kod testleri bu doğrulamanın yerine geçmez.

Detaylı teknik sınırlar için `TECHNICAL.md` dosyasına bak. Eski sürüm notları, tarihli değişiklik günlükleri ve tekrarlanan kurulum açıklamaları bu dosyadan çıkarılmıştır.
