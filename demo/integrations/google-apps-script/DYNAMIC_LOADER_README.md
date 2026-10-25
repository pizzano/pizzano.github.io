# Tek kurulum: Google Apps Script, GitHub'dan kodu otomatik çalıştırır

Bu tasarımda Google Apps Script projesinde **bir kez** başlatıcı kurulur.
Sonrasında domain, GitHub hesabı/repo, branch veya dosya klasörü değiştiğinde
Apps Script kodu değişmez. Kaynak konumu Firebase'deki imzalı ayardan okunur.

## Sabit köprü

Her restoranın Firebase Realtime Database URL'si (CODE_FEED_DB_URL) Apps Script'te
bir kez tanımlanır. Kod kaynağı Firebase /integrations/runtimeScripts.json altında
tutulur: version: 1, sms: (tam GitHub raw URL), email: (tam GitHub raw URL),
signature: (iki URL için HMAC-SHA256).

KOD KAYNAĞININ URL'SİNİN DEĞİŞTİRİLMESİ YETKİ GEREKTİRİR. Bunun için gizli
CODE_FEED_HMAC_KEY değeri, Google Apps Script Script Properties'te tutulur.
Kaynak yönetimi sayfası bu değeri yalnızca yeni adresleri imzalamak için
kullanır. Firebase'e veya tarayıcı localStorage'a anahtar yazılmaz.

## İlk kurulum (SMS ve e-posta için bir defa)

1. Çalışan iki Google Apps Script projesinin yedeğini al.
2. Her iki projede Project Settings > Script Properties içine:
   CODE_FEED_DB_URL = restoranın mevcut Firebase RTDB HTTPS URL'si
   CODE_FEED_HMAC_KEY = her iki projede AYNI güçlü, rastgele 64 haneli hex anahtar.
   Diğer tokenlar, test numarası, checkpointler ve tetikleyiciler korunur.
3. SMS projesine bootstrap-sms.gs kaynağını; e-posta projesine
   bootstrap-email.gs kaynağını bir kez aktar.
4. E-posta Apps Script manifestinde email-poller-appsscript.json içindeki
   OAuth izinlerini koru. SMS için sms-loader-appsscript.json izin örneği hazır.
5. Admin > Varslinger > Administrer GitHub-kilder bağlantısıyla
   tools/Scriptkilde.html aç. Repo, branch, klasör ve dosya adlarını gir;
   iki projeye kaydettiğin gizli anahtarla imzala, Firebase'e kaydet.
6. Çalışan trigger fonksiyon adları değişmez:
   pollOrdersForSms / kontrollerEpostBestillinger.
   Kontrollü SMS ve e-posta testi yap.

## Sonraki değişiklikler

- Aynı Github repo/branch içindeki kodu güncellersen push yeterli.
- Repo, hesap, branch, dosya adı veya klasör değişirse Scriptkilde.html
  sayfasından yeni kaynağı imzala ve kaydet. Apps Script açılmaz.
- Site kök dizine ya da başka klasöre taşınırsa HTML, manifest,
  Service Worker ve ilgili assets artık bulundukları dizine göre yüklenir.
- Yeni siparişler gerçek web adresini orderPageUrl alanında sakladığı için
  Se bestillingen URL'si aynı zamanda yeni domain/klasöre uyarlanır.
- Eski siparişler için ORDER_PAGE_URL bir yedek Script Property'dir.
- Firebase DB adresi de değiştirilirse sabit köprünün güncellenmesi veya eski
  Firebase'den yeniye güvenilir bir yönlendirme gerekir. Domain ve GitHub
  değişimi bu sorunu doğurmaz; Firebase'in de kaybolması ayrı bir durumdur.

## Güvenlik ve sınırlar

- GitHub'dan gelen JS kodu SMS ve e-posta hesabının yetkileriyle çalışır;
  repo erişimlerini koru ve değişiklikleri önce test et.
- HMAC imzası GitHub kaynak URL'sinin yetkili biçimde seçildiğini doğrular,
  kod içeriğini kilitlemez. Korunan branch ve güvenilir yazma yetkileri gerekir.
- Yeni Google servis izinleri eklenirse Apps Script kullanıcısının tekrar
  yetkilendirme vermesi gerekebilir.
- GitHub indirme hatası olursa gönderim yapılmadan hata verilir; sonraki
  tetikleyici tekrar deneyecektir.
- Browser JavaScript import/export modülleri Apps Script V8 içinde doğrudan
  çalışmaz; GitHub'daki .gs kaynakları kullanılmalıdır.
- Bu GitHub dosyaları canlı Apps Script'e otomatik kurulmamıştır; ilk kurulum
  gerçek projelerde bir defa yapılmalıdır.
