# KØL SMS + e-post – Google Apps Script kaynakları

## SMS – **tek bildirim, Hentetid**

**Bu klasördeki `Kode.gs` TAM SMS uygulamasıdır (427 satır).**
Eskiden bulunan kısa `sms-query-patch.gs` sadece 63 satırlık bir fonksiyondu;
tam dosyanın yerine yapıştırılırsa SMS fonksiyonları kayboluyordu. Bu dosya artık kaldırıldı.

1. [Kode.gs](Kode.gs) dosyasını aç ve içeriğini tamamen kopyala.
2. Google Apps Script **KOL SMS Gateway → Kode.gs** sayfasındaki bütün kodu
   önce yedekleyip bu **tam kod** ile değiştir ve **Kaydet**.
3. Mevcut Script Properties, Traccar anahtarı, TEST/LIVE ayarları, gönderim
   geçmişi ve dakikalık `pollOrdersForSms` tetikleyicisi aynı kalır.
4. **`setupLiveSms()`, `setupTestSms()`, `sendTestSms()` tekrar çalıştırma.**
   Bunlar sistemin modunu veya aktivasyonunu değiştirebilir veya test SMS'i yollar.
5. `diagnoseSms()` güvenli okuma kontrolü için kullanılabilir.
6. Yeni siparişi `bekreftet` yapınca **bir** SMS gönderilir. İçinde seçilen
   **Hentetid** ya da **Forventet hentetid** bulunur.
   `Endre tid`, `Marker klar for henting` ve süre bitişi için SMS gönderilmez.

Firebase RTDB `orders` indeksinde `statusUpdatedAt` gerekli. İndeks kurulamazsa
kod yalnızca son 80 siparişi okuyan güvenli, sınırlı yedeğe geçer.
SMS gönderiminde `KOL_SENT_<id>_accepted` koruması korunur;
aynı siparişe birden fazla onay SMS'i gönderilmez.

**Not:** GitHub yayını Google Apps Script kodunu otomatik değiştirmez.
Canlı Apps Script projesine manuel yapıştırma gereklidir.

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

## Firebase kuralları ve gizlilik

Kullanılan RTDB `/orders` altında indeks:
```json
".indexOn": ["statusUpdatedAt", "estimateUpdatedAt"]
```
İndeks izni açmaz. Veritabanında `.read: true` / `.write: true` bulunması
müşteri bilgilerinin herkesçe okunabilmesi ve değiştirilebilmesi anlamına gelir;
canlıya geçmeden kimlik doğrulamalı ve kısıtlı kurallar kullanılmalı.
