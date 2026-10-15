# KØL Gmail ve SMS — Daha az Firebase trafiği

**Bu klasör kaynak kodudur.** GitHub'a yüklemek Google Apps Script projelerini
otomatik güncellemez. Canlı SMS ve e-posta ancak Google Apps Script içinde
kaydedildikten sonra yeni sorguları kullanmaya başlar.

## 1. Firebase RTDB indekslerini birleştir

Firebase Console → **KOL Grill Pizza** → Realtime Database → **Rules**.

Mevcut erişim izinlerini ve diğer kuralları SİLME. Var olan "rules" nesnesinin
"orders" altına şu özellik eklenmeli:

```json
".indexOn": ["statusUpdatedAt", "estimateUpdatedAt"]
```

Şu bir *örnektir*; bunu mevcut Rules içeriğinin tamamıyla değiştirme:

```json
{
  "rules": {
    "orders": {
      ".indexOn": ["statusUpdatedAt", "estimateUpdatedAt"]
    }
  }
}
```

Okuma/yazma güvenliği için mevcut `.read`, `.write` ve başka `orders`
kuralları olduğu gibi kalmalı. İndeks, erişim izni vermez; yalnızca
sunucunun sorguyu verimli çalıştırmasını sağlar.

## 2. E-post: "EPOST GONDERME KØL" → EmailPoller.gs

`email-poller.gs` dosyasının **tam güncellenmiş içeriğini** mevcut
EmailPoller.gs içine kopyala ve kaydet. Sonra `testFirebaseTilgang()`
fonksiyonunu çalıştır ve hata olmadığını kontrol et.

**`installerEpostVarsler()` fonksiyonunu yeniden çalıştırma.** Mevcut
`kontrollerEpostBestillinger` dakika tetikleyicisi, aynı Script Properties
kontrol kayıtları ve Gmail HTML şablonu korunuyor.

Kod son başarılı sorgunun zamanını saklar, 2 dakikalık çakışma payı
bırakır ve yalnızca `statusUpdatedAt` değişmiş siparişleri okur.
İlk optimize çalışma en fazla son 48 saati tarar. Okuma başarısızsa
geçici olarak yalnızca **son 120 siparişi** indirir.
Yeni indeks gelene kadar e-postalar bu yedekten çalışabilir; 120 yeni
siparişten daha eski bir bekleyen sipariş, yedekte gözden kaçabilir.

## 3. SMS: "KOL SMS Gateway" → Kode.gs

Mevcut LIVE Apps Script içinde `function kolFetchRecentOrders_()`
fonksiyonunu bul. **Yalnızca bu fonksiyonu**, `sms-query-patch.gs`
dosyasındaki aynı isimli fonksiyonla değiştir. Kodun geri kalanına
dokunma. Özellikle Traccar token, TEST/LIVE modu, `setupLiveSms()`,
`pollOrdersForSms()`, `kolMessage_()`, günlük SMS limiti ve geçmiş
gönderim kayıtları aynen kalır.

**`setupLiveSms()` fonksiyonunu tekrar çalıştırma.**

SMS sorguları yaklaşık son 20 dakikadaki:
- `statusUpdatedAt`: Godta bestilling / Marker klar for henting
- `estimateUpdatedAt`: Endre tid (durum değişmeden de SMS gönderilmeli)

değişikliklerini birlikte getirir. Eski 80-siparişlik anahtar tabanlı
sorgu, indeks sorunu halinde otomatik yedek olarak korunur.

## 4. Canlı doğrulama

1. Rules içindeki indeksleri kaydet.
2. E-posta Apps Script kodunu güncelle, `testFirebaseTilgang` testini çalıştır.
3. SMS Apps Script'te yalnızca `kolFetchRecentOrders_` fonksiyonunu değiştir.
4. Apps Script **Kjøringer / Executions** sayfasında indeks/yedek okuma
   uyarısı bulunmadığını kontrol et.
5. Yeni bir test siparişi oluştur, onayla, gerekiyorsa Endre tid işlemini
   yap, ardından personelin `Marker klar for henting` düğmesine bas.
   E-posta ve SMS'in beklenen sayıda geldiğini doğrula.
6. Firebase → Usage → Downloads grafiğini sonraki gün karşılaştır.

Çalışan `functions/`, Traccar, Epson, Firebase sipariş verisi ve
müşteri arayüzleri bu değişiklikte değiştirilmedi.
