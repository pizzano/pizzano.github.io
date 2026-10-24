# KØL SMS + e-post – Google Apps Script kaynakları

## Varslinger — şablonlar artık Firebase'de (24.10.2026)

Admin panelinde yeni **Varslinger** sayfası bulunuyor:

- `SMS · Bekreftet`: Düzenlenebilir SMS metni
- `E-post · Bekreftet`: Konu, büyük başlık, giriş mesajı ve kapanış metni
- `E-post · Klar`: Ayrı e-posta metinleri
- **Forhåndsvisning**: Örnek müşteri/ürün bilgileriyle gönderim yapmadan önizleme
- **Lagre mal**: Firebase `notificationTemplates/{smsAccepted|emailAccepted|emailReady}`
- **Send test**: Firebase `notificationTests/{kind}/request` (yalnızca komut kimliği/zamanı/türü)
- **Kontroller teststatus**: `notificationTests/{kind}/result`, gönderen scriptin kayıt durumu

Kullanılabilir değişkenler: `{navn}`, `{hentetid}`, `{lenke}`,
`{kode}`, `{total}`, `{varer}`. Şablonun bütün varsayılan metinleri
Firebase'de saklanır; e-postanın ürün/fiyat/KDV bölümü güvenli kodla otomatik
üretilmeye devam eder. E-posta alanlarına ham HTML veya çalıştırılabilir kod
konulmaz; kullanıcı verileri HTML-escape ile korunur. **Tek istisna:**
şablonun müşteri mesajı ve kapanış alanlarında `<strong>metin</strong>`
kalın metin biçimlendirmesidir. Admin'deki **B Fet tekst** düğmesi bunu
otomatik ekler. Diğer bütün HTML etiketleri düz, güvenli metin olarak
gösterilir; HTML e-postada çalıştırılmaz. Düz metin alternatifinde
`<strong>` etiketleri kaldırılır. Eskiden kapanış eğik çizgisini
unutup `<strong>01:45<strong>` yazılmışsa da iki açılış
etiketi baş/son olarak işlenerek e-postada kalın gösterilir.
Bu biçimlendirme Apps Script tarafında işlendiğinden, bu özellik
için güncel `email-poller.gs` dosyasını çalışan Google Apps Script'e
bir defa kopyalamak gerekir.

### İlk ve son Apps Script kurulumu

Bu iki dosya GitHub'da güncellendi ancak **Google'ın çalışan projesine
kendiliğinden yüklenmez.** Bir kere:

1. Google Apps Script **KOL SMS Gateway** projesinde `Kode.gs` tamamını
   [yeni kaynak](Kode.gs) ile değiştir, kaydet. Mevcut `TRACCAR_TOKEN`,
   `TEST_PHONE`, `KOL_MODE` ve `pollOrdersForSms` tetikleyicisini koru.
2. Google Apps Script **EPOST GONDERME KØL** projesinde `EmailPoller.gs`
   tamamını [yeni kaynak](email-poller.gs) ile değiştir ve kaydet. Mevcut
   `kontrollerEpostBestillinger` tetikleyicisini koru.
3. Firebase Rules içinde adminin `notificationTemplates` ve
   `notificationTests/.../request` yazma yetkisini; Apps Script'in bu
   şablonları okuma ve `notificationTests/.../result` yazma yetkisini
   doğrula. RTDB kimlik doğrulama/yetkilendirme üretim için zorunludur.
4. Admin → Varslinger'de her şablonu kaydet, sonra **Send test** ve
   **Kontroller teststatus** kullan. SMS testi yalnızca Apps Script özel
   `TEST_PHONE` ayarına, e-posta testi Apps Script'in özel `KOL_TEST_EMAIL` ayarına,
   bu ayar boşsa script'i çalıştıran Google hesabının gelen kutusuna
   gönderilir. Test arayüzünden alıcı numara/adres gönderilmez.

### Test e-postası gönderilmediğinde

1. Admin **Send test** yalnızca Firebase'e `notificationTests/emailAccepted/request`
   veya `notificationTests/emailReady/request` kaydeder; kendisi e-posta
   göndermez.
2. Google Apps Script'in aktif `kontrollerEpostBestillinger` zaman
   tetikleyicisi yeni `email-poller.gs` kodunu çalıştırmalıdır. Kod
   güncel değilse istek hiç işlenmez.
3. Script Properties içinden `KOL_TEST_EMAIL` oluşturup alıcı
   e-posta adresini tanımlayabilirsin. Bu adres Firebase'de veya web
   sayfasında tutulmaz. Boş bırakıldığında script sahibinin e-posta
   adresi kullanılır.
4. Apps Script içindeki `kontrollerEpostTestNaa()` fonksiyonunu
   bir kere elle çalıştırabilirsin. Bu fonksiyon yalnızca mevcut test
   taleplerini işler, müşteri siparişleri gönderimini tetiklemez.
5. Admin **Kontroller teststatus** bölümünde `sent`, `failed`,
   `rate_limited` veya `ignored` sonucu görülmeli. İki dakika
   içinde hiçbir cevap yoksa Apps Script → Executions ve Firebase
   Rules'taki `notificationTests` okuma/yazma izinleri kontrol
   edilmeli. Test isteği 10 dakika sonra geçersizdir.

**Güvenlik:** Test SMS en fazla 3/gün, e-posta 4/gün ve en az 3 dakika
ara ile yapılır. Test ID'leri önce işlenmiş olarak saklanır; belirsiz bir
gönderimi otomatik tekrarlamayız. Traccar/MailApp tarafından kabul
edilmiş olması telefon/inbox teslimi kanıtı değildir. Admin sayfası
ayrı bir sunucu oturum sistemi kullanmıyorsa yalnızca Firebase Rules
ile koruma kurmadan herkese açık erişimi üretimde kullanmayın.
Bu test komutları herkese açık/yetkisiz bir Firebase kurulumunda
kötüye kullanılabilir. Alıcıyı komuttan okumamak riski azaltır fakat
yetkilendirmenin yerine geçmez.

Eğer şablon isteği Firebase tarafından reddedilirse gönderici **mevcut
sabit metnine geri döner**, sipariş bildirimi durmaz. Yeni şablon yalnızca
gönderimden önce okunur; çalışan trigger'ın tekrar kurulmasına gerek
yoktur. Metin değiştirirken Apps Script dosyası artık tekrar
kopyalanmaz.

## SMS – aktiv Google Apps Script-kilde

**Én full kildefil:** [Kode.gs](Kode.gs) inneholder
`pollOrdersForSms()`, Traccar-sending, én bekreftelses-SMS med hentetid,
Firebase-`smsHealth`, og et godkjent Traccar-kvitteringsfelt på ordren.
Den samme koden inneholder `diagnoseSms()`, `checkSmsResults()` og
`stopSms()` for sikker manuell diagnose/stans.

## SMS-tekst med lenke (24.10.2026)

Bekreftelses-SMS sendes i dette formatet:

```text
Hei FATIH! Bestillingen din er bekreftet ✅

Forventet hentetid: kl. 01:45

Se bestillingen: https://bestill.online/demo/?order=ord_mv1ji63i2sea2

KØL Grill & Pizza
```

Navn, klokkeslett og full ordre-ID settes fra **den aktuelle ordren**.
Norgetid (`Europe/Oslo`) vises som `HH:mm`, uten dato og uten
anslåtte minutter i parentes. Planlagte henteordrer bruker valgt
klokkeslett, `Snarest` bruker kjøkkenets estimerte `estimatedReadyAt`.
Hvis ingen gyldig klokkeslett er tilgjengelig, vises `snarest` (ikke
et oppfunnet tidspunkt). Bare første bekreftelse får SMS.

SMS-lenken bruker hele ordrenummeret som en privat tilgangslenke.
`demo/js/customer.js` åpner `?order=ord_...` direkte til
`Mine bestillinger` på også en ny enhet. Ikke del lenken offentlig,
siden den gir tilgang til ordredetaljer. Ekstern referrer-sporing
fra kundesiden er deaktivert.

**Viktig ved publisering:** GitHub-kildekoden er oppdatert, men den
kjørende Google Apps Script-installasjonen oppdateres **ikke** automatisk.
I Google Apps Script-prosjektet `KOL SMS Gateway` må ny full
`Kode.gs` kopieres inn og lagres. Behold eksisterende Script
Properties og den aktive `pollOrdersForSms`-triggeren. Ikke kjør
`setupTestSms()`, `setupLiveSms()` eller `sendTestSms()` for denne
tekstendringen. Test deretter med én ny testordre. 

**Aldri bland gammel og ny versjon ved å lime inn et enkelt kodestykke.**
Ta sikkerhetskopi av aktiv `KOL SMS Gateway → Kode.gs` i Google,
og sammenlign den med denne GitHub-kilden før du eventuelt oppdaterer den.
**En GitHub-endring oppdaterer ikke Googles kjørende Apps Script.**
De eksisterende Script Properties (inkludert `TRACCAR_TOKEN`,
`TEST_PHONE`, `KOL_MODE`, `KOL_ACTIVE_SINCE` og `KOL_SENT_...`)
og minuttutløseren skal beholdes. `setupLiveSms()`,
`setupTestSms()`, `sendTestSms()` må **ikke** kjøres igjen under
opprydding — de kan endre aktivering eller sende en testmelding.

`api/sms-status.js` og `api/sms-receipts.js` (Vercel), en
nettleserbasert telefonmonitor og tilhørende Apps Script `doGet()`
for proxyen er slettet fra GitHub-kilden. Det allerede kjørte
engangsverktøyet for å kopiere eldre SMS-kvitteringer er også fjernet
fra kilden. Disse endringene **påvirker ikke** live Apps Script før
det er bevisst oppdatert, og er ikke en forespørsel om å nullstille
tidligere SMS-historikk.

Firebase RTDB `/orders` bør ha `.indexOn` for
`statusUpdatedAt`; ellers leser SMS-polleren bare de 80 siste
ordrene som reserve. `KOL_SENT_<ordre-id>_accepted` sikrer at en
HTTP-timeout ikke automatisk utløser samme SMS igjen.

**Merk:** Grønne statuslys kan ikke bevise mobilens internett.
En Traccar Cloud-bekreftelse beviser kun at nettskyen godtok
forespørselen, ikke at Android eller mobiloperatøren leverte SMS.
Admin-panelet viser derfor vellykket LIVE Apps Script-poll
som **gul/ikke verifisert** til en ekte enhetskontroll finnes.

## E-posta — iki ayrı HTML şablonu (Bekreftet + Klar)

**[email-poller.gs](email-poller.gs)** tam `EmailPoller.gs` kaynağıdır.

- **İlk e-posta, Bekreftet:** seçilen/tahmin edilen saati büyük **Hentetid**
  başlığıyla gösterir. "Snarest", tahmini dakika, ürünler, seçenekler, telefon,
  vergi ve toplam tutar yer alır.
- **İkinci e-posta, Klar for henting:** sipariş gerçekten **personel tarafından**
  hazır işaretlenince oluşturulur. Büyük hazır bildirimi ve gerçek
  `staffReadyAt` saati gösterilir. Sürenin dolması *e-posta göndermez*.
- İki gönderim farklı **subject** ve HTML gövdeye sahiptir. Mevcut geçmiş
  `kol_order_...` kayıtları ve kind-temelli tekrar önleme koruması korunur.
- SMS tarafında değişiklik yoktur: sipariş başına tek Hentetid SMS'i gönderilir.
- Gmail için harici görsel gerektirmeyen koyu yeşil, krem ve altın tonlarında
  masaüstü/mobil uyumlu, inline CSS kullanan e-posta tasarımı kullanılır.

### Mevcut Apps Script'e güncelleme

1. Google Apps Script → **EPOST GONDERME KØL** → `EmailPoller.gs`.
2. Var olan kodunun kopyasını al. [GitHub tam kodunu](email-poller.gs)
   aç, içeriğini **tamamını** Apps Script'e yapıştır ve kaydet.
3. Fonksiyon listesinden **`testBeggeEpostMalerTilMeg()`** seçip çalıştır.
   İki **örnek** e-posta yalnızca Apps Script'i çalıştırdığın Gmail hesabına
   gider; müşterilere gönderilmez. Gmail'deki görüntüyü kontrol et.
4. Mevcut `kontrollerEpostBestillinger()` zaman tetikleyicisini **koru**.
   Kurulumu sıfırlayan `installerEpostVarsler()` fonksiyonunu çalıştırma.
5. Test siparişi oluştur, onayla, ardından restoran ekranındaki **Marker klar
   for henting** butonuna bas. Gerçek müşteri e-postasına iki farklı mail
   gitmeli. Bu süreçte yalnızca **ilk Hentetid SMS'i** gider.
6. Firebase indirme optimizasyonu korunur: indeksli
   `statusUpdatedAt` sorgusu ve son başarılı tarama zamanını kullanır.

**Not:** GitHub'a yayınlama, Google Apps Script dosyasını **otomatik
güncellemez**. Müşteri e-postalarını gönderen canlı proje ancak bu kaynak
yapıştırılıp kaydedildiğinde yeni tasarımı kullanır.

## E-posta gönderimi ve doğrulama (17.10.2026)

- **Neden kayboluyordu:** Bir sipariş ilk dakika dolmadan `bekreftet`
  olursa Apps Script ilk taramada durumunu kaydedip bildirim göndermiyordu.
- **Düzeltme:** Yeni kod, son **60 dakika** içinde gerçekten `bekreftet`
  olmuş siparişi ilk defa görse bile kabul e-postasını gönderir.
  `klar` e-postası yalnızca gerçek `staffReadyAt` ile gönderilir.
  Eski birikmiş siparişlere toplu e-posta göndermez. Kod ilk çalıştığında,
  eski bug nedeniyle son bir saat içinde atlanan siparişleri bir kez kontrol eder.
  Sonraki taramalarda yine iki dakikalık indeksli pencere kullanılır.
- **Tekrar önleme:** `KOL_SENT` SMS geçmişine dokunulmaz. E-posta için
  `kol_order_...` / `sent` checkpoint'leri korunur; başarısız veya belirsiz
  `MailApp` gönderimi körlemesine tekrarlanmaz.
- **Gerçek kayıt:** Ancak `MailApp.sendEmail` başarılı döndükten sonra,
  `/orders/{id}/emailReceipts/{accepted|ready}` yazılır. Restoran ekranındaki
  yeşil zarf bu kayıt yoksa **görünmez**. Bu kayıt e-posta servisinin gönderimi
  kabul ettiğini gösterir; alıcının gelen kutusuna teslim garantisi değildir.
- **Bağlantı kontrolü:** Her çalışan tetikleyici `/emailHealth` altına son
  çalışma ve kalan MailApp günlük gönderim kotasını yazar.
  Admin paneli yaklaşık 90 saniyede bir bu küçük kaydı okur.
  Son 3 dakika içinde geçerli kontrol bulunmazsa e-posta göstergesi yeşil olmaz.
  SMS / printer durumları bağımsızdır.
- **Firebase izinleri:** Yeni kod `/orders/{id}/emailReceipts` ve
  `/emailHealth` yollarına yazabilmelidir. Firebase erişim kurallarını sırf
  bu işlem için **herkese açık yazma** haline getirmeyin. DEMO'nun açık kuralları
  güvenilir gönderim kanıtı için yeterince güvenli değildir; gerçek müşteriler
  öncesinde sunucu tarafında kimlik doğrulama ve yazma yetkileri gerekir.

### Canlı Apps Script'e geçirmek için

1. GitHub'daki güncel [email-poller.gs](email-poller.gs) dosyasını tamamen
   kopyalayın; **EPOST GONDERME KØL → EmailPoller.gs** içinde eskisinin yerine
   yapıştırın ve kaydedin. Önce mevcut kodu yedekleyin.
2. `installerEpostVarsler()` **çalıştırmayın**; bu, eski siparişlerin
   durum kayıtlarını ve tetikleyiciyi değiştirir. Mevcut dakikalık
   `kontrollerEpostBestillinger` tetikleyicisi kalmalıdır.
3. Apps Script **Yürütmeler** sekmesinde `kontrollerEpostBestillinger`
   hatasız çalışıyor mu kontrol edin. Yeni kodu elle ilk kez çalıştırmak
   son bir saatin gerçekten onaylanmış, ancak henüz e-posta almamış DEMO
   siparişlerine bildirim gönderebilir.
4. Yeni test siparişi verin, hemen `Bekreft` yapın, MailApp gönderim
   kaydını ve admin ekranındaki yeşil e-posta işaretini kontrol edin.
   `Marker klar for henting` sonrası ikinci e-posta için de tekrar edin.

**Önemli:** GitHub'a commit/push yapmak Apps Script web arayüzündeki canlı
`EmailPoller.gs` kaynağını otomatik olarak değiştirmez.

## Firebase kuralları ve gizlilik

Kullanılan RTDB `/orders` altında indeks:
```json
".indexOn": ["statusUpdatedAt", "estimateUpdatedAt"]
```
İndeks izni açmaz. Veritabanında `.read: true` / `.write: true` bulunması
müşteri bilgilerinin herkesçe okunabilmesi ve değiştirilebilmesi anlamına gelir;
canlıya geçmeden kimlik doğrulamalı ve kısıtlı kurallar kullanılmalı.
