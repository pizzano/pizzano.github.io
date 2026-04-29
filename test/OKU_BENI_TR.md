# KØL Grill & Pizza - v21

Bu sürümde müşteri sepetindeki hentetid alanı düzeltildi.

## Değişiklikler

- `Snarest mulig` ve `Velg hentetid` yan yana, daha kompakt görünecek şekilde düzenlendi.
- `Velg hentetid` seçilmedikçe saat seçme alanı tamamen gizlenir.
- Sepette kırmızı işaretlenen boş beyaz alan kaldırıldı.
- `index.html` ve `kol-core.css` güncellendi.
- `admin.html` önceki sürümden korunmuştur.


V24:
- Admin sipariş detayında üst sarı/header alanına basınca listeye geri döner.
- Footer solunda siparişin verildiği zaman gösterilir.
- Sipariş fişi yazıları biraz büyütüldü.

V25:
- Admin sipariş detayındaki üst meta kutuları kaldırıldı.
- Menü ürün düzenleme alanı daha kompakt ve temiz yapıldı.
- Valggrupper paneli sağda sticky + kendi içinde scroll olacak şekilde ayarlandı.


V27:
- Admin sipariş detay header alanına flex / space-between düzeni eklendi.
- Sepette altta görünen boş beyaz recent/order-status alanı gizlendi.

V28:
- Admin sipariş detayındaki TELEFON/BESTILT/KLAR TID kutuları kaldırıldı.
- Telefon numarası müşteri adının altına alındı.
- Footer içinde BESTILT ve 3 nokta yan yana ortalandı.
- 3 nokta menüsünde Skriv ut kvittering ve Avvis/kanseller kaldı.

- V30: Bilgi popup'ı masaüstünde tam genişlik olacak şekilde düzeltildi; harita ve bilgi kartları başlıkla hizalandı.
- V30: `Kundeinformasjon` bölümünde `Snarest mulig / Velg hentetid` satırı üstte, ad ve telefon alanları altta olacak şekilde düzenlendi.

- V31: Info popup masaüstü ayarsızlığı düzeltildi; `info-panel` tekrar header/menu genişliğine sabitlendi ve sorun çıkaran tam genişlik/flex override kaldırıldı.

- V32: Admin `Meny oppsett` görünümü daha sade/temiz hale getirildi.
- V32: Ürün içindeki `Skjul / Utsolgt / Utsolgt til / Allergener` alanları sağ üstteki `⋮` ürün ayarları menüsünün içine alındı.
- V32: Sağdaki `Valggrupper` paneli iframe gibi sabit yükseklikte ve kendi içinde scroll olacak şekilde düzenlendi.
- V32: Ürünlere özel allergen metni admin panelinden girilebilir; müşteri ürün popup'ında önce bu özel metin gösterilir.

- V33: `Valggrupper` paneli artık sayfaya yapışmaz; sayfayla beraber hareket eder, sadece kendi içeriği scroll olur.
- V33: Sağdaki valggruppe kartları küçültüldü.
- V33: Altta görünen gereksiz `Produkter / Nytt produkt` stok formu gizlendi; form sadece kategori içinden ürün seçilince açılır.

- V34: Sağdaki `Valggrupper` paneli üst menü gibi sticky yapıldı; scroll yapınca sağ tarafta görünür kalır, grup listesi kendi içinde scroll olur.

- V35: Kategori kartlarına kırmızı × silme butonu eklendi. Tıklayınca onay sorar; onay verilirse kategori ve içindeki ürünler silinir, iptal edilirse hiçbir şey değişmez.

- V36: Ürün popup'ında başlık ve geri butonu artık ürün resminin üstüne binmiyor. Resim ayrı alanda tam görünür; tüm ürün popup'larında aynı düzeltme geçerlidir.

- V37: Ürün popup üst başlık alanına tıklayınca menüye geri dönme eklendi; sağ tarafa modern `Tilbake til meny` butonu koyuldu.

- V38: Müşteri tarafında ayrı kapat/geri tuşları gizlendi. Menü dışındaki ürün, sepet, profil, bilgi ve sipariş durumu ekranlarında sol üstteki KØL GRILL & PIZZA alanı belirgin `← Tilbake til meny` butonuna dönüşür.

- V39: Üst soldaki alan düzeltildi. Menüde restoran adı görünür, ürün/sepet/profil/info/sipariş durumunda aynı yer belirgin `← Tilbake til meny` butonuna dönüşür.

- V40: Mobil ürün popup'ında ürün resmi artık sabit kalmaz; resim, seçenekler ve ürün bilgileri aynı scroll içinde birlikte hareket eder. Alt 'Legg til i handlevogn' barı sabit kalır.
