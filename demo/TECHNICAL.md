# Teknik notlar — demo/

Bu belge yalnızca sistemin güvenli şekilde bakımını etkileyen noktaları içerir. Geçmiş sürüm günlükleri ve artık geçerli olmayan "audit branch" açıklamaları kaldırılmıştır.

## Çalışan mimari

- Arayüz: GitHub Pages altında müşteri `index.html` ve admin `admin.html`. Vercel bağımlılığı kullanılmaz.
- Veri: Firebase Realtime Database REST (`js/data.js`); kaynak URL `config.js`.
- SMS: Google Apps Script `Kode.gs` + Traccar. E-posta: `email-poller.gs` + MailApp. GitHub'a commit yapmak bu iki çalışan projeyi değiştirmez.
- Birbirini izleyen JS modüllerinde `data.js` import URL'lerini farklı sürüm parametreleriyle yüklememek gerekir: ayrı modül örnekleri senkronizasyonu bozabilir.

## Sipariş güvenilirliği

- Yeni sipariş oluştururken Firebase `if-match: null_etag` kullanılır; aynı ID ile gelen tekrar mevcut siparişin üzerine yazmamalıdır.
- Admin onayı güncel sipariş + Firebase ETag ile koşullu güncelleme yapar. Eşzamanlı değişiklikte HTTP 412 oluşabilir; başarısız onay başarılı olarak gösterilmemelidir.
- Normal `mottatt` siparişlerinde onay için 180 saniye vardır. `confirmationNoTimeout: true` olan ön sipariş bu süreye tabi değildir.
- `Klar for henting` personelin gerçek durum değişikliğidir. Tahmini hentetid dolması tek başına `klar` durumunu veya hazır e-postasını oluşturmamalıdır.
- `orders` temizliğinde en yeni 100 sipariş korunur; daha eski kapalı siparişler yalnızca bildirimler için 72 saatlik güvenlik penceresi geçtikten sonra silinebilir. Aktif siparişler bu limit yüzünden silinmemelidir.
- Kalıcı müşteri sayacı ve pizza bonus verileri `customers/{phone}` altında tutulur. Silinmiş siparişler geri yüklenmeden bu toplamların korunması önemlidir.

## Çalışma saatleri

- Haftalık saatlerin tek kaynağı `settings.weeklyHours` (7 gün). `openingTime`, `orderOpenTime` ve `orderCloseTime` kullanılmaz.
- Haftalık program kurulmamışsa kodun varsayılanı 14:00–22:00'dır. Bu, Firebase'de kaydedilmiş gerçek restoran saatlerinin yerine geçmez.
- `manualClosed` ve `manualClosedUntil` geçici kapamayı yönetir.
- Hentetid hesabında `pickupLeadMinutes` ve `slotIntervalMinutes` kullanılır; varsayılanlar sırasıyla 30 ve 15 dakikadır. Kapanış sınırı ve planlı siparişler ayrıca tarayıcıda test edilmelidir.

## Bildirimler ve hata takibi

- Şablonlar: `notifications/templates`; test istekleri ve sonuçları: `notifications/tests`.
- `smsReceipts` / `emailReceipts` servis gönderim kabulünü kaydeder; gerçek alıcı teslimini kanıtlamaz. Servis durumları `notifications/smsHealth` ve `notifications/emailHealth` içindedir.
- `js/system-errors.js` kritik işlemleri ve belirli Firebase hatalarını kaydetmek için kullanılır; kısa süreli çevrimdışı kayıt kuyruğu vardır. Tarayıcı kapalıyken sürekli izleme yapmaz.
- Google Apps Script'teki tüm SMS/e-posta sorunlarının `systemErrors` içine aktarıldığı **varsayılmamalıdır**. Aktif Apps Script yürütmeleri, sağlık ve gönderim kayıtları ayrıca incelenmelidir.

## Doğrulama sınırları

- Referans kontrolü: `node demo/tools/audit-references.mjs`.
- Birim testleri: `node --experimental-default-type=module --test demo/tests/*.test.mjs`.
- Bu testler gerçek Firebase Rules, aynı anda çalışan iki admin cihazı, SMS/e-posta teslimatı ve Epson bağlantısını doğrulamaz.
- Test için üretim Firebase verilerini temizleme, tetikleyicileri yeniden kurma veya müşteri siparişlerini sıfırlama.
