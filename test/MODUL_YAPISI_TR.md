# KØL sistem modül yapısı

Bu sürümde sistem iki parçaya ayrılmaya başlandı:

## Ana dosyalar

Bunlar silinmemeli:

- `index.html` — müşteri menü sayfası
- `app.js` — menü, ürün modalı, sepet, Firebase okuma/yazma ana sistemi
- `styles.css` — müşteri sayfası ana tasarımı
- `admin.html` — admin paneli
- `admin.js` — kategori, ürün, valggrupper, ayarlar ve Firebase kayıt sistemi
- `admin.css` — admin panel tasarımı
- `menu-data.js` — Firebase boşsa yedek menü verisi

## Opsiyonel modüller

Bu dosyalar silinirse ana sistem çalışmaya devam eder:

- `modules/cart-animation.js` — ürün sepete eklenince uçma ve sepet kıpırdama animasyonu
- `modules/feature-template.js` — yeni modül yapmak için örnek dosya

## Sepet animasyonunu kapatmak

Sadece şu dosyayı sil veya `index.html` içindeki script satırını kaldır:

```html
<script src="modules/cart-animation.js?v=20260427-24"></script>
```

Silince ürün yine sepete eklenir, ama animasyon çalışmaz.

## Yeni özellik ekleme mantığı

Yeni özellikleri mümkün olduğunca `modules/` içine koy:

- `modules/kupon.js`
- `modules/lojalitet.js`
- `modules/printing.js`
- `modules/delivery.js`

Böylece bir özellik bozulursa sadece o dosyaya bakılır.

## Önemli Türkçe yorumlar

Kod içinde şu yorumları arayabilirsin:

- `SEPET ANİMASYON MODÜLÜ BAĞLANTISI`
- `Ürün sepete eklendiğinde çalışan ana fonksiyon`
- `Sepetin ekrandaki adet, toplam ve ürün listesini yeniler`
- `Kategori kartlarını ve kategori içindeki ürün listesini çizer`
- `Ürüne tıklayınca açılan küçük düzenleme formunu çizer`
- `Sağdaki Valggrupper / tilleggler listesini çizer`

Bu yorumlar sana hangi parçanın nerede olduğunu gösterir.

## Dikkat

Şimdilik admin ve app ana dosyaları hâlâ büyük dosyalar. Bu daha güvenli ilk adımdır. Tamamen parçalara bölmek mümkün ama acele yapılırsa sistem kolay bozulur. En sağlıklı yol:

1. Önce opsiyonel özellikleri modüle ayırmak.
2. Sonra admin kategori/ürün/valggrupper bölümlerini ayrı admin modüllerine almak.
3. En son Firebase ve veri normalizasyonunu shared/core dosyaya taşımak.


## Boyuta göre valggrupper

Admin tarafında `optionGroupIds` bütün boylarda ortak çıkan tillegg gruplarıdır.
`optionGroupIdsBySize.medium`, `optionGroupIdsBySize.large`, `optionGroupIdsBySize.xxl` gibi alanlar ise sadece o boy seçildiğinde çıkan gruplardır.

Örnek:

```js
optionGroupIds: ["pizza-sauce"], // hepsinde görünür
optionGroupIdsBySize: {
  medium: ["pommes-m"],
  large: ["extra-bunn", "pommes-st"]
}
```

Bu sayede küçük pizzada Extra bunn görünmez, büyük pizzada görünür.
