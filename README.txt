KØL Gavekort system

Dosyalar:
- gavekort.html        -> müşteri sayfası
- gavekort-admin.html  -> admin sayfası

Firebase:
- databaseURL: https://bestill-pizza-default-rtdb.europe-west1.firebasedatabase.app
- ana dizin: gavekort
- işlem geçmişi: gavekort_logg

Yükleme:
1. İki HTML dosyasını bestill.online ana klasörüne koy.
2. Müşteri linki şu olacak:
   https://bestill.online/gavekort.html
3. Admin linki:
   https://bestill.online/gavekort-admin.html

Admin PIN:
- 2026

Not:
Müşteri tarafında admin yazısı / admin linki görünmez. QR kod yine admin sayfasını açar çünkü çalışan telefondan QR okutunca direkt ilgili gavekort açılmalı.
Gerçek güvenlik için ileride Firebase Auth veya Cloud Function gerekir. Sadece HTML içinde olan PIN tam güvenlik sayılmaz.
