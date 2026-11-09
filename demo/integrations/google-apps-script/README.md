# KØL SMS ve e-posta — doğrudan webhook (09.11.2026)

Bu dosyalar Google Apps Script projelerinin **kaynak kopyalarıdır**. GitHub'a commit yapmak canlı Apps Script kodunu, Web App yayınını veya kurulu zaman tetikleyicilerini değiştirmez.

## Nasıl çalışır?

1. Admin **Godta** ile siparişi Firebase'de başarıyla onaylar.
2. `js/data.js`, yalnızca sipariş ID'sini SMS ve e-posta Apps Script Web App URL'lerine HTTPS POST ile yollar. Ekranın açık kalmasını gerektiren bir HTTP yanıtı beklenmez.
3. Her Web App, Firebase'de **sadece ilgili** `orders/{id}` kaydını okur; güncel gerçek statü ve alıcıyı doğrular.
4. SMS Traccar, e-posta MailApp üzerinden gönderilir. Daha önce işlenmiş ID + bildirim türü **ikinci kez gönderilmez**. Sonuç `orders/{id}/smsReceipts` veya `emailReceipts` içine yazılır.
5. Admin zaten mevcut `/orders` SSE akışına bağlıdır: **yeşil** sağlayıcı kabulü, **kırmızı** kesin gönderim hatası, **sarı** bekliyor/belirsiz, **gri** sonuç yok. Yeşil müşteriye teslim edildiğini kanıtlamaz.
6. **Klar** durumunda yalnızca hazır e-postası tetiklenir. Önceki SMS mantığı gibi ekstra SMS gönderilmez.

## Kurulum — iki ayrı Google Apps Script projesi

### SMS — KOL SMS Gateway

1. Google Apps Script'teki **KOL SMS Gateway** projesinin yedeğini al. Güncel `Kode.gs` içeriğinin **tamamını** canlı editöre kopyala. `TRACCAR_TOKEN`, `TEST_PHONE`, `KOL_MODE`, `KOL_ACTIVE_SINCE` ve gönderildi işaretlerini koru. `setupLiveSms()` / `setupTestSms()` fonksiyonlarını yeniden çalıştırma.
2. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** (test ortamı). Erişimleri yetkilendir. `/exec` ile biten URL'yi kopyala.
3. Apps Script editöründe yalnızca **bir kez** `stoppSmsMinuttSjekk()` çalıştır. `pollOrdersForSms` dakikalık tetikleyicisinin **Triggers** ekranından kalktığını doğrula.

### E-posta — EPOST GONDERME KØL

1. **EPOST GONDERME KØL** Apps Script projesinin yedeğini al ve `email-poller.gs` içeriğinin tamamını canlı `EmailPoller.gs` dosyasına kopyala. Script Properties, mevcut sipariş checkpoint'leri ve MailApp erişimini koru. `installerEpostVarsler()` fonksiyonunu yeniden çalıştırma.
2. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** (test). İzin ver, yeni `/exec` adresini al.
3. Editörde **bir kez** `stoppEpostMinuttSjekk()` çalıştır. `kontrollerEpostBestillinger` dakikalık tetikleyicisinin kalktığını doğrula.

### GitHub'daki adresler

Yalnızca `demo/config.js` içine iki Web App adresini gir:

```js
window.BESTILL_CONFIG = {
  databaseUrl: 'https://kol-grill-pizza-default-rtdb.firebaseio.com',
  smsWebhookUrl: 'https://script.google.com/macros/s/GERCEK_SMS_DEPLOYMENT_ID/exec',
  emailWebhookUrl: 'https://script.google.com/macros/s/GERCEK_EMAIL_DEPLOYMENT_ID/exec'
};
```

Yukarıdaki `GERCEK_...` metinleri **örnektir**, kullanılabilecek URL değildir. Alanlar boşsa tarayıcı Web App çağrısı yapmaz. Script Properties'deki gizli Traccar token'ını asla `config.js` içine koyma.

**Önemli sıra:** Önce iki Web App'i yayınla ve URL'leri gir. Test siparişini kontrol ettikten sonra eski iki dakikalık tetikleyiciyi durdur. Kodu yalnızca GitHub'da güncellemek Apps Script tetikleyicilerini durdurmaz.

## Test ve sınırlar

- Test siparişi oluştur, **Godta** de. Admin içindeki sipariş satırında SMS/e-posta önce bekler, Traccar/MailApp isteği kabul edince yeşile döner.
- Müşteri e-posta vermediyse e-posta ikonu gösterilmez. Kesin sağlayıcı reddi kırmızı, cevap belirsizse sarıdır.
- **Klar** dediğinde ek hazır e-postasını doğrula.
- Admin → Varslinger → **Send test** de Web App'i yalnızca düğmeye basılınca tetikler. SMS testi yalnızca `TEST_PHONE`, e-posta testi yalnızca yetkili test hesabına gider. Sonuç **Kontroller teststatus** üzerinden elle okunur.
- Boşta **SMS veya e-posta için periyodik Firebase sorgusu yapılmaz**. Web App bağlantısı kesilirse bu test sürümünde otomatik kurtarma taraması bulunmaz.
- Script Properties ve onaylı gönderim geçmişini silme. Aynı olay için tekrar çağrı gelse bile sağlayıcıya ikinci gönderim yapılmaması gerekir.
- Google Apps Script'in anonim `/exec` URL'si gizli bir kimlik doğrulama çözümü değildir. Gerçek müşteriler için ayrıca erişim kontrolü gerekebilir.
