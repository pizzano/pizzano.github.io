# Teknik notlar — demo/

Bu belge yalnızca sistemin güvenli şekilde bakımını etkileyen noktaları içerir. Geçmiş sürüm günlükleri ve artık geçerli olmayan "audit branch" açıklamaları kaldırılmıştır.

## Çalışan mimari

- Arayüz: GitHub Pages altında müşteri `index.html` ve admin `admin.html`. Vercel bağımlılığı kullanılmaz.
- Veri: Firebase Realtime Database REST (`js/data.js`); kaynak URL `config.js`.
- SMS: Google Apps Script `Kode.gs` + Traccar. E-posta: `email-poller.gs` + MailApp. GitHub'a commit yapmak bu iki çalışan projeyi değiştirmez.
- Birbirini izleyen JS modüllerinde `data.js` import URL'lerini farklı sürüm parametreleriyle yüklememek gerekir: ayrı modül örnekleri senkronizasyonu bozabilir.

## Müşteri menüsü ve Firebase trafiği

- `js/data.js` yalnızca müşteri modunda menü ve herkese açık, müşterinin ihtiyacı olan ayarları `IndexedDB` içindeki `kol-customer-public-menu-v1` önbelleğinde tutar. Admin arayüzü bu önbelleği kullanmaz. Profil/sepet/favoriler mevcut `localStorage` modelinde, geçici sipariş ID'leri `sessionStorage` içindedir.
- İlk ziyarette tam menü Firebase'den indirilir. Sonraki ziyaretler yalnızca ilgili `updatedAt` alanını okur; sürüm değişmediğinde tam menü tekrar indirilmez. Açık sayfadaki düşük hacimli sürüm kontrolleri devam eder.
- Firebase erişimi kesilmişse yerel menü yalnızca gösterilir. Sipariş öncesi **mutlaka** canlı sürüm kontrolü vardır; sepetin içeriği veya tutarı güncellenmişse müşteri incelemeden sipariş gönderilmez. Doğrudan Firebase REST'e yazan müşteri kodu sunucu doğrulaması yerine geçmez.
- Ürün görselleri, Realtime Database JSON içinden **dosya** olarak değil `imageUrl` olarak gelir. Müşteri menüsü görsel URL'lerini Service Worker'a bildirir; yalnızca bu URL'lerin resim isteği cache-first ile saklanır. Unsplash responsive ölçüleri aynı görselin farklı boyutu olarak tanınır, fakat boyutlara göre istekler ayrı cache girdileridir. Dosya URL'si değişirse eski görüntü temizlenir. Eş URL'deki sunucu dosyasının değiştiği teknik olarak anlaşılamaz; URL değiştirilmeli veya sürümlenmeli. İlk ziyaret Service Worker henüz kontrol etmiyorsa o sıradaki resimler normal tarayıcı HTTP önbelleğinden gelir; sonraki ziyaretlerde SW kontrolü ile kalıcı fotoğraf cache çalışır.
- Görsel cache en çok 120 istek ve bilinen (opaque olmayan) yanıtlarda 2 MB/görsel sınırındadır. Kota/private mode nedeniyle önbellek yazma başarısızlığı siparişi etkilemez; tarayıcı verisi temizlenirse resimler tekrar iner.
- Ön bellekteki veriyi ürün/sipariş fiyatı veya Firebase erişim izni için güvenilir kaynak sayma. Veri formatı sürümü değiştiğinde cache geçersizleşir; IndexedDB açılamazsa eski tam yükleme akışı çalışır.
- Tasarruf, öncelikle tekrar açılışlarda menü aktarımını azaltır. Admin SSE, SMS/e-posta tetikleyicileri ve Firebase konsolundaki bütün indirilen MB bu değişiklikle ortadan kalkmaz.

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

## Trafik tasarrufu — SMS/profil/bonus/admin (2026-11-06)

- Müşteri menüsü sayfasında arka plan `updatedAt` kontrolü iki dakikada bir çalışır; ödeme öncesinde canlı güncellik kontrolü **her zaman** yapılır. Admin tarafında 30 saniye korunur.
- Kısa süreli bağlantı yeniden kurulurken adminin mevcut SSE bağlantısından ilk sipariş anlık görüntüsü beklenecek şekilde 9 saniyelik tam `/orders` okuma duplikasyonu engellenir. SSE başarısızsa 15 saniyelik normal REST kurtarması sürer; 3 dakikalık onay beklentisi korunur.
- Bonus sayacı sadece JS belleğinde 45 saniye saklanır, aynı telefon için eşzamanlı istekler birleştirilir. `fresh: true` parametresi ve ödül rezervasyonu Firebase'i yeniden okumak zorundadır; hiçbir fiziksel kupon hakkı tarayıcı önbelleğine güvenmez.
- Profilde ad/e-posta kaydetme, özel müşteri istatistiklerini okumak ve tam müşteri kaydını PUT etmek yerine iki alana Firebase PATCH yapar. Yeni müşteri kabul mantığı ve bonus sayaçları ayrı kalır. **RTDB Rules PATCH yetkisi canlı ortamda doğrulanmalıdır.**
- Adminin yeni/eski müşteri etiketi için kısa toplam sayaç değeri 5 dakika bellekte saklanır; sipariş listesi kontrolü değişmez. Tam sipariş listesi SSE'si ve mutasyon/print akışı korunmuştur; bunun daha da küçültülmesi sunucu tarafında kalıcı bir özet feed gerektirir.
