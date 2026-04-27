# Robust Firebase/admin fix

Bu sürümde admin panelde kaldırılmış butonlar varsa JavaScript artık durmaz.
Firebase anlık koparsa admin son sağlam menüyü localStorage'dan gösterir.

Düzeltmeler:
- Synkroniser / Lagre nå butonları kaldırılmış olsa bile admin.js hata vermez.
- Kategoriler ve siparişler artık bu hata yüzünden görünmez hale gelmez.
- Son başarılı menü localStorage'a kaydedilir.
- Firebase bağlantısı geç gelirse önce lokal menü gösterilir, sonra Firebase günceller.
