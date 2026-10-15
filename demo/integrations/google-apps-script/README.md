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

## E-posta

`email-poller.gs` bağımsızdır. SMS kısıtlaması e-posta gönderimlerini değiştirmez.
Mevcut `kontrollerEpostBestillinger` dakika tetikleyicisini koru; e-posta
sistemini yeniden kurmak için `installerEpostVarsler` fonksiyonunu çalıştırma.

## Firebase kuralları ve gizlilik

Kullanılan RTDB `/orders` altında indeks:
```json
".indexOn": ["statusUpdatedAt", "estimateUpdatedAt"]
```
İndeks izni açmaz. Veritabanında `.read: true` / `.write: true` bulunması
müşteri bilgilerinin herkesçe okunabilmesi ve değiştirilebilmesi anlamına gelir;
canlıya geçmeden kimlik doğrulamalı ve kısıtlı kurallar kullanılmalı.
