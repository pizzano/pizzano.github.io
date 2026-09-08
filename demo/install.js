(() => {
  'use strict';

  // Android/Chromium tarayıcılarının kendi PWA kurulum arayüzünü kullanıyoruz.
  // beforeinstallprompt olayını yakalayıp preventDefault() çağırmıyoruz;
  // böylece destekleyen tarayıcı kurulum teklifini kendi native arayüzüyle gösterebilir.
  // Özel/manüel "ana ekrana ekle" kartı bilerek kullanılmıyor.
})();
