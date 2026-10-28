# SMS ve e-posta — Google Apps Script

Bu klasördeki dosyalar **kaynak kopyalarıdır**. GitHub güncellemesi, çalışan Google Apps Script projelerine otomatik yüklenmez.

## Dosyalar ve görevleri

- `Kode.gs`: `pollOrdersForSms()`, Traccar üzerinden onay SMS'i, SMS testleri ve `notifications/smsHealth`.
- `email-poller.gs`: `kontrollerEpostBestillinger()`, `MailApp` üzerinden `Bekreftet` / personelce `Klar` e-postaları, e-posta testleri ve `notifications/emailHealth`.
- SMS ve e-posta şablonları Firebase `notifications/templates/{smsAccepted|emailAccepted|emailReady}` konumundadır. E-posta şablonlarında `version:2`, `subject` ve tam `html` bulunur.
- Ürünler için e-posta HTML şablonunda `{{#each items}} ... {{/each}}` kullanılabilir. Müşteri adı, saat ve sipariş bağlantısı gibi değişkenler sipariş verilerinden doldurulur.

## Mevcut kurulumu güncelleme

1. Önce **Google Apps Script'teki aktif dosyanın yedeğini al**; GitHub kopyasının canlıyla aynı sürüm olduğunu varsayma.
2. SMS projesindeki `Kode.gs` ve e-posta projesindeki `EmailPoller.gs` dosyalarını, gerekirse bu klasördeki güncel **tam kaynakla** değiştir.
3. Mevcut Script Properties, gönderim/checkpoint kayıtları ve `pollOrdersForSms` / `kontrollerEpostBestillinger` zaman tetikleyicilerini **koru**.
4. Sadece kod güncellemesi için `setupLiveSms()`, `setupTestSms()` veya `installerEpostVarsler()` fonksiyonlarını yeniden çalıştırma.
5. Apps Script **Executions** ekranından hataları kontrol et; kontrollü yeni siparişle `Godta` ve ardından `Klar for henting` akışını doğrula.

SMS için kullanılan Script Properties arasında `TRACCAR_TOKEN`, `TEST_PHONE`, `KOL_MODE` bulunur. E-posta test adresi `KOL_TEST_EMAIL` ile belirlenebilir. Bunları GitHub'a yazma. E-posta kaynağındaki `KOL_DB` ile müşteri/admin `config.js` veritabanının eşleştiğini doğrula.

## Sipariş bağlantısı ve bildirim kayıtları

- Yeni siparişler `orderPageUrl` taşır; SMS/e-posta bu URL'yi kullanır. Eski siparişlerde URL yoksa, her iki Apps Script projesinde `ORDER_PAGE_URL` (gerçek müşteri HTTPS adresi) yedek olarak ayarlanabilir.
- Siparişe gönderim sonucu `orders/{id}/smsReceipts` veya `orders/{id}/emailReceipts` altında yazılır.
- `sent` veya yeşil gösterge, Traccar/MailApp tarafından kabulü ifade eder; müşterinin telefonuna ya da gelen kutusuna kesin teslim kanıtı değildir.
- `Klar` e-postası yalnızca personelin gerçek hazır durumuyla gönderilir; tahmini hentetid geçmesi bunun yerine geçmez.

## Admin testleri

- **Send test** yalnızca Firebase `notifications/tests/{kind}/request` yoluna istek bırakır. Gönderimi çalışan Apps Script yapar; yanıt `notifications/tests/{kind}/result` konumundadır.
- SMS testi yalnızca özel `TEST_PHONE` numarasına gider: günde en fazla 3 test, aralarında en az 3 dakika.
- E-posta testleri yalnızca `KOL_TEST_EMAIL` (yoksa Apps Script hesap adresi) için: iki şablon toplam günde en fazla 4; aynı şablonda en az 3 dakika ara.
- Sonuç görünmüyorsa Apps Script tetikleyicisi, **Executions**, Firebase okuma/yazma izinleri ve `notifications/tests` yollarını kontrol et. Test isteğinin oluşturulması, bildirimin gönderildiği anlamına gelmez.

## Firebase ve dikkat edilmesi gerekenler

- SMS/e-posta taraması `orders` altında `statusUpdatedAt` indeksinden yararlanır. Kullanılan RTDB Rules ve indeksleri çalışan ortamda kontrol et.
- `/orders`, `/notifications` ve `/customers` gibi yolları herkese açık okuma/yazmaya bırakmak müşteri verileri ve test komutları açısından risklidir.
- Canlı Script Properties, tokenlar, tetikleyiciler, geçmiş gönderim işaretleri veya Firebase siparişleri temizlik amacıyla sıfırlanmaz.
- Bu doküman kurulum kılavuzudur, aktif Google Apps Script'in şu anda sorunsuz çalıştığına dair test sonucu değildir.
