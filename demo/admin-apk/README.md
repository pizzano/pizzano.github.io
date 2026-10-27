# Sipariş Admin — Android APK (yalnızca demo/)

Bu klasör yalnızca **admin** paneli için Android Studio projesidir. Müşteri sistemi, Firebase verileri, SMS ve e-posta altyapısı değişmez.

## Çalışma biçimi
Uygulama Android WebView ile **https://pizzano.github.io/demo/admin.html** adresini açar. Dolayısıyla:
- İnternet gereklidir; uygulama çevrimdışı sipariş yönetimi sağlamaz.
- Canlı sitedeki admin güncellemeleri uygulamaya da yansır (WebView önbelleği dikkate alınır).
- Firebase ve Google Apps Script mevcut web uygulamasındaki gibi çalışmaya devam eder.
- Ekran uygulama açıkken uykuya geçmez.
- Yeni sipariş sesi Android WebView ses politikalarına ve cihaz ayarlarına bağlıdır; cihaz üzerinde test edilmelidir.
- Uygulama kapalı veya arka plandayken güvenilir bildirim/push **henüz yoktur**.
- Web sayfasındaki termal yazıcı / window.print akışının Android WebView üzerinde otomatik çalışması garanti değildir; ayrı yerel yazdırma entegrasyonu gerekebilir.
- Bu ilk sürümde mağaza yayını/üretim kimlik doğrulaması veya yerel bildirim altyapısı kurulmamıştır.

## APK oluşturma (Windows / Android Studio)
1. Android Studio'yu açın, **Open** ile `demo/admin-apk` klasörünü seçin.
2. Gradle Sync tamamlanınca **Build → Build Bundle(s) / APK(s) → Build APK(s)** seçin.
3. Debug APK: `demo/admin-apk/app/build/outputs/apk/debug/app-debug.apk`.
4. Android telefona/tablete APK'yı kurup panel, bağlantı, sipariş alımı, ses, yazdırma ve ekran kilidini gerçek cihazda test edin.

Android Studio Android SDK 35 ve JDK 17 gerektirir. Bu klasörde Gradle wrapper binary dosyaları yoktur; Android Studio Gradle kurulumunu/uygun sürümünü isteyebilir. Gerekirse Android Studio terminalinde yüklü Gradle ile `gradle wrapper --gradle-version 8.9` çalıştırın.

## Kapsam
Yeni dosyalar yalnızca `demo/admin-apk/` altında tutulur. `demo/admin.html`, `demo/js/`, `demo/css/` ve depo dışındaki dosyalar değiştirilmez.
