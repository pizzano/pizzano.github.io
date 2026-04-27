# Yazıcı ve alarm notu

- Admin panelde yeni sipariş varsa alarm daha yüksek ve sık çalar.
- Tarayıcı güvenliği nedeniyle ses için admin sayfasına bir kez tıklamak gerekebilir.
- Her sipariş kartında **Skriv ut kvittering** butonu vardır.
- Buton, ESC/POS metnini `http://127.0.0.1:5000/` adresindeki yerel printer server'a gönderir.
- Termal yazıcı server açık değilse yazdırma çalışmaz ama sistem bozulmaz.
