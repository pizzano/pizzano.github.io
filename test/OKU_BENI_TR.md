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

- V42: Ürün detay ekranı tek bütün scroll alanına çevrildi. Başlık, ürün resmi, seçenekler, not ve miktar beraber kayar; sadece sepete ekle barı altta kalır.

- V43: Alt "Legg til i handlevogn" barı tam dibe monte edildi ve ilk boyut seçim satırlarındaki yazılar biraz küçültüldü.

- V44: Ürün seçim alanları (küçük/orta/büyük ve diğer seçenekler) örnek görseldeki gibi daha dengeli, daha küçük yazılı ve krem-beyaz arka planlı hale getirildi.

- V45: Sepette ürün ekstraları alt alta listelenir; varsa her ekstranın fiyatı karşısında görünür.

- V46: Sepette Rediger yazısı kaldırıldı, yerine ikonlu düzenle butonu eklendi. Ürün satır toplamı sağ alt köşeye taşındı; sil ve düzenle butonları sağ üstte durur.

- V47: Sepette ekstra satırlarında sol taraftaki başlık kısmı kalınlaştırıldı; seçilen değer (ör. Medium / Nytt valg) daha ince yapıldı.
- V48: Yazıcı fişinde ürün ekstraları artık alt alta ve varsa fiyatıyla birlikte çıkar.
- V48: Admin Meny oppsett kısmında Valggrupper paneli sağda sabit/fixed kaldı, kendi içinde scroll olur.
- V48: Kategori ve ürün ayarları daha ikonlu/kompakt hale getirildi; kategori ayarları ⚙ menüsünden, ürün ayarları ürün içindeki ⚙ detayından açılır.

- V49: Admin Bestillinger içinde ürün detayları alt alta ve fiyatlarıyla gösterildi. Fiş çıktısında ürün toplamı, ürün birim fiyatı ve linjetotal eklendi; fiş yazıları büyütüldü. Müşteri geri sayımındaki gereksiz 'min' kaldırıldı.

- V53: Index sayfasına sabit yatay kategori menüsü eklendi. Pizza / Kebab / Burger / Drikke gibi başlıklar yatay scroll ile görünür, tıklanınca ilgili kategoriye iner ve sayfa scroll oldukça aktif kategori otomatik seçilir.

- V54: Kategori barındaki tıklama sonrası geri zıplama düzeltildi. Aktif sekme artık sadece yatayda ortalanır. Kategori barı header gibi sabit görünür, boşluk azaltıldı, PC’de fareyle sürükleme, mouse wheel yatay kaydırma ve sağ/sol oklar eklendi.

- V55: Kategori barı sticky yerine fixed yapıldı. Tasarım sistemle uyumlu küçük pill butonlara çevrildi. PC tıklama sorunu düzeltildi; tıklama kategoriye iner ve orada kalır. İçerik fixed barın altında boşluk bırakır, PC’de mouse wheel/sürükleme/oklarla yatay kayar.

- V56: Kayan kategori barı sadece ana menüde görünür; profil, sepet, info ve ürün içinde gizlenir. PC tıklama sorunu için sürükleme/tıklama ayrımı düzeltildi ve kategoriye inme hesabı basitleştirildi.

- V57: PC’de kategori tıklamasını engelleyen pointer/drag kodu kaldırıldı. Kategori tıklaması document capture ile yakalanır. Kategori barı sadece ana menüde görünür; profil/sepet/info/ürün içinde gizlenir. CSS sadeleştirildi.

- V58: Kayan kategori barındaki sağ/sol oklar kaldırıldı. Kategoriler yine yatay scroll ile kaydırılır.

- V59: Sepetteki düzenle ikonunun bazen çalışmaması düzeltildi. Tıklama alanı büyütüldü, ikon içindeki SVG click'i yutmasın diye pointer-events kapatıldı ve pointerup/touchend üzerinden güvenilir edit açma eklendi.

- V60: Sepetteki düzenle butonundaki SVG tamamen kaldırıldı. Yerine sade Unicode kalem ikonu kullanıldı; hiçbir SVG yok.

- V61: Tüm inline SVG ikonları kaldırıldı; header ve sepet ikonları sade text/emoji ikonlarla değiştirildi. Sepette düzenle/sil için çakışan eski event handlerlar temizlendi, data-action + onclick yedekli güvenilir düzenleme sistemi eklendi.

- V62: Sepet düzenle butonundaki SVG/::before sorunu tamamen kaldırıldı. Düzenle butonu artık silme butonu gibi düz buton; ortasına basınca da çalışır. Çakışan eventler temizlendi, sağlam handler eklendi. Ürün detay ekranında kategori barı görünür ve kategoriye basınca ürün ekranını kapatıp ilgili kategoriye gider.

- V63: Sepet düzenle butonu tamamen farklı yaklaşımla çözüldü. Artık eski çalışan openCartLineEditor(index) doğrudan çağrılır. Event document capture üzerinden yakalanır; ikon/orta/kenar fark etmez. SVG ve pseudo elementler kapalıdır. Ürün detayında kategori barı görünür ve kategoriye basınca ürün ekranını kapatıp kategoriye gider.

- V64: Ürün detay ekranı açıkken kategori barının yatay kaymama sorunu düzeltildi. Popup scroll kilidi artık kategori barı touch/scroll hareketini engellemez.

- V65: Ürün detayında isim artık ürün görselinin üzerinde puslu/blur arka planlı bir etiket içinde de gösterilir. Böylece kayan kategori barı üst kısmı kapatsa bile ürün adı görünür kalır.

- V66: Sepetteki düzenle ve sil butonları küçültüldü. Düzenle kalemi siyah kenarlıklı oval-kare beyaz kutu içine alındı; silme butonu da daha kompakt hale getirildi.

- V67: Sepetteki düzenle ve sil butonları bir kez daha küçültüldü. Ayrıca kayan kategori çubuğu info ekranında gizlendi; artık sadece menüde ve ürün detayında görünür.

- V68: Admin Meny oppsett ekranında sol kategori/ürün alanı kendi içinde scroll yapar. Sağdaki Valggrupper paneli ekranda kalır ve kendi içinde scroll olur. Valggruppe ürüne sürüklenirken bırakma alanı yeşil olarak işaretlenir; bırakınca 'Lagt til' animasyonu gösterilir.

- V69: Meny oppsett sol üstteki kategori bilgilendirme kutusu kaldırıldı. Valggrupper paneli masaüstünde ekranın en sağ tarafına taşındı ve sabit kaldı.

- V70: Meny oppsett bölümündeki puslu/boş üst şerit kaldırıldı. Valggrupper paneli masaüstünde daha sağa ve daha dar taşındı. Valggrupper içindeki Pris ve Ja/Nei alanları küçültüldü.

- V71: Valggrupper paneli daha sağa taşındı, kendi iç scroll alanı eklendi, Ny styrkegruppe kaldırıldı, Pris ve Ja/Nei alanları daha da küçültüldü.

- V72: Valggrupper listesinin kendisi kutu içinde bağımsız scroll olacak şekilde düzenlendi.

- V73: Ny gruppe açılınca Valggrupper listesinin kendi içinde otomatik scroll yapması ve aktif kartı görünür tutması düzeltildi.

- V74: Valggrupper içindeki liste scroll'u zorunlu hale getirildi. Mouse tekerleği doğrudan #optionGroupsAdmin kutusunu kaydırır; liste ekran dışına taşmaz.

- V79: Profil/status ekranında `Standart · Mild` gibi karışık detay görünümü temizlendi. Detaylar artık `Størrelse: Standart` ve `Velg styrke: Mild` olarak alt alta gösterilir. Sepet fallback detayları da aynı temiz formatı kullanır.

- V81: Mobilde sepette kırmızı silme butonuna basınca birden fazla ürün silinmesi düzeltildi. Silme artık sadece `click` olayında çalışır; touchstart/pointerdown silme yapmaz ve 650 ms koruma kilidi vardır.
