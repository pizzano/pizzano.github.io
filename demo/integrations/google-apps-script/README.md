# KØL SMS + e-post – Google Apps Script kaynakları

## SMS – aktiv Google Apps Script-kilde

**Én full kildefil:** [Kode.gs](Kode.gs) inneholder
`pollOrdersForSms()`, Traccar-sending, én bekreftelses-SMS med hentetid,
Firebase-`smsHealth`, og et godkjent Traccar-kvitteringsfelt på ordren.
Den samme koden inneholder `diagnoseSms()`, `checkSmsResults()` og
`stopSms()` for sikker manuell diagnose/stans.

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
