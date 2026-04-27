# Logo URL ayarı

Admin panelinde **Grunninfo** içinde **Logo URL** alanı var.

- URL doluysa menü sayfasındaki büyük logo bu resimden gelir.
- URL boşsa eski KØL yazılı yedek logo görünür.
- URL bozuksa site bozulmaz; otomatik eski logo görünür.
- Logo mobil ve PC için `object-fit: contain` ile sığdırılır.

Öneri: Logoyu PNG/JPG olarak sabit bir adreste tut. Örnek: Firebase Storage, kendi hosting klasörün veya güvenilir CDN.
