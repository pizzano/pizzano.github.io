# Sipariş Admin — Android APK (yalnızca demo/)

Bu klasör yalnızca admin panelinin Android uygulamasıdır. Müşteri sitesi, Firebase, SMS ve e-posta servisleri değişmez.

## Nasıl açılır?
APK, Android WebView içinde `https://bestill.online/demo/admin.html` sayfasını açar. GitHub Pages deposunun CNAME kaydı `bestill.online` olduğundan eski `pizzano.github.io` adresi yönlenebilir. Önceki sürüm sadece eski alan adına izin verdiği için yönlendirmeyi Opera'da açıyordu. 1.1 sürümü her iki alan adını da aynı uygulama içinde tutar.

Uygulama kendi penceresinde çalışır; tarayıcı araç çubuğu göstermez. Web admin tasarımı ve Firebase işlevleri aynı kalır. İnternet gerekir. Ekran açık kalır; yükleme sırasında ince ilerleme çizgisi görünür.

**Sınırlar:** Android arka plan bildirimleri henüz kurulmadı. Uygulama kapalıyken yeni sipariş sesi garanti değildir. Termal yazıcı ve `window.print` gerçek Android cihazda ayrıca test edilmelidir.

## GitHub Actions ile APK
`Build Admin APK` GitHub Actions çalıştırmasını açın; `Artifacts` altından `siparis-admin-apk` arşivini indirin ve içindeki `app-debug.apk` dosyasını yükleyin. Bu test APK'sıdır.

**Önemli:** GitHub Actions her çalıştırmada yeni bir debug imzalama anahtarı oluşturabileceğinden Android, eski test sürümünün üzerine yüklemeyi reddedebilir. Bu durumda eski **Sipariş Admin** uygulamasını kaldırıp yenisini yükleyin. Uygulama kaldırmak Firebase siparişlerini silmez; yalnızca cihazda tutulmuş yerel uygulama verilerini sıfırlayabilir.

## Android Studio ile derleme
`demo/admin-apk` klasörünü açın, SDK 35 ve JDK 17 kurulu olduğundan emin olun, ardından `Build APK(s)` seçin.

## Değişiklik sınırı
Bu Android uygulama dosyaları yalnızca `demo/admin-apk/` altındadır. Mevcut `demo/admin.html`, `demo/js/`, `demo/css/` ve Firebase verileri değiştirilmez.
