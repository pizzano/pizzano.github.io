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

## 2026-11-06: Düşük trafik, bildirim güvenliği

- SMS tetikleyicisi **dakikada bir** kalır. Google Apps Script tek başına Firebase RTDB değişikliğiyle kendiliğinden çalışamaz. Sadece sipariş geldiğinde çalışacak gerçek olay-tabanlı sistem, ayrıca yetkilendirilmiş Cloud Functions/başka sunucu kurulumu gerektirir. Bunu kurmadan tetikleyiciyi durdurma: bildirimler kaybolur.
- SMS tarayıcısı `statusUpdatedAt` indeksli sorguda başarılı son taramadan itibaren **5 dakikalık örtüşmeyle** okur. Başarısız tarama ve eksik günlük kota nedeniyle kesilen tarama checkpoint'i ilerletmez; böylece kayıp sipariş riski azaltılır. Canlı `.indexOn` kuralını kontrol et.
- SMS ve e-posta şablonları yalnızca gönderim/gerçek admin testi gerektiğinde çekilir; boş dakikada tekrar indirilmez. Test ve sağlık mekanizması korunur.
- Bu repodaki `Kode.gs` ve `email-poller.gs` dosyalarını değiştirmek **çalışan Google Apps Script projelerini güncellemez**. Canlı editöre aynı kodu taşımadan bu SMS/e-posta tasarrufları etkin olmaz. Mevcut Script Properties, tetikleyiciler, gönderim işaretleri ve güvenlik ayarları korunmalı.

## Manuell helseforespørsel — oppdater aktive Google Apps Script-prosjekter (2026-11-07)

**OBS:** Å oppdatere GitHub stopper ikke automatisk skriving fra tidligere publiserte Apps Script-koder. Gjør følgende for at Firebase-konsollen skal slutte å vise `checkedAt`-endring hver minutt:

1. Ta sikkerhetskopi av begge **aktive** Apps Script-prosjektene.
2. Erstatt den aktive SMS-prosjektkoden med hele nyeste `Kode.gs`, og den aktive e-postprosjektkoden med hele nyeste `email-poller.gs`. Ta med funksjonsendringer som sender `requestId` i helsepostene.
3. **Behold** eksisterende minutt-triggere `pollOrdersForSms` og `kontrollerEpostBestillinger`, Script Properties, historiske sendemarkører og alle ordre. Ikke kjør `setupTestSms`, `setupLiveSms` eller `installerEpostVarsler` på nytt kun for å bytte kode.
4. Sjekk RTDB Rules: den autentiserte adminen må kunne skrive en kort forespørsel til `notifications/healthCheckRequest`; utenforstående må ikke kunne skrive slike kommandoer. Statusresponsene `notifications/smsHealth` og `notifications/emailHealth` må kun kunne skrives av betrodde avsendere.
5. Trykk ↻ i Bestillinger én gang. Firebase får `notifications/healthCheckRequest` med `hc_...` ID, og hvert script svarer etter neste tidsutløser. Admin venter med en kortvarig SSE på samme `requestId` (inntil 160 sekunder). Dersom ny versjon ikke er aktiv, blir status «ingen svar».
6. Ingen trykk: `smsHealth` / `emailHealth` skal ikke få nytt `checkedAt`. Kunders SMS/e-post fortsetter uavhengig av admin-knappen og lagrer egne ordrekvitteringer ved reelle send.
7. Verifiser manuelt at en bestilling fortsatt kommer til admin og utløser korrekt SMS/e-post. Dette kan ikke bevises av statiske GitHub-tester alene.

Hver worker leser den ene lille helseforespørselen omtrent én gang i minuttet. Manuell status eliminerer tomme status-skrivinger, **ikke** den nødvendige ordre-pollingen eller all Firebase-trafikk.
