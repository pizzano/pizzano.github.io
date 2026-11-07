# Teknik notlar — demo/

Bu belge yalnızca sistemin güvenli şekilde bakımını etkileyen noktaları içerir. Geçmiş sürüm günlükleri ve artık geçerli olmayan "audit branch" açıklamaları kaldırılmıştır.

## Çalışan mimari

- Arayüz: GitHub Pages altında müşteri `index.html` ve admin `admin.html`. Vercel bağımlılığı kullanılmaz.
- Veri: Firebase Realtime Database REST (`js/data.js`); kaynak URL `config.js`.
- SMS: Google Apps Script `Kode.gs` + Traccar. E-posta: `email-poller.gs` + MailApp. GitHub'a commit yapmak bu iki çalışan projeyi değiştirmez.
- Birbirini izleyen JS modüllerinde `data.js` import URL'lerini farklı sürüm parametreleriyle yüklememek gerekir: ayrı modül örnekleri senkronizasyonu bozabilir.

## Müşteri menüsü ve Firebase trafiği

- `js/data.js` yalnızca müşteri modunda menü ve herkese açık, müşterinin ihtiyacı olan ayarları `IndexedDB` içindeki `kol-customer-public-menu-v1` önbelleğinde tutar. Admin arayüzü bu önbelleği kullanmaz. Profil/sepet/favoriler mevcut `localStorage` modelinde, geçici sipariş ID'leri `sessionStorage` içindedir.
- İlk ziyarette tam menü Firebase'den indirilir. Sonraki ziyaretler yalnızca ilgili `updatedAt` alanını okur; sürüm değişmediğinde tam menü tekrar indirilmez. Açık sayfadaki düşük hacimli sürüm kontrolleri devam eder.
- Firebase erişimi kesilmişse yerel menü yalnızca gösterilir. Sipariş öncesi **mutlaka** canlı sürüm kontrolü vardır; sepetin içeriği veya tutarı güncellenmişse müşteri incelemeden sipariş gönderilmez. Doğrudan Firebase REST'e yazan müşteri kodu sunucu doğrulaması yerine geçmez.
- Ürün görselleri, Realtime Database JSON içinden **dosya** olarak değil `imageUrl` olarak gelir. Müşteri menüsü görsel URL'lerini Service Worker'a bildirir; yalnızca bu URL'lerin resim isteği cache-first ile saklanır. Unsplash responsive ölçüleri aynı görselin farklı boyutu olarak tanınır, fakat boyutlara göre istekler ayrı cache girdileridir. Dosya URL'si değişirse eski görüntü temizlenir. Eş URL'deki sunucu dosyasının değiştiği teknik olarak anlaşılamaz; URL değiştirilmeli veya sürümlenmeli. İlk ziyaret Service Worker henüz kontrol etmiyorsa o sıradaki resimler normal tarayıcı HTTP önbelleğinden gelir; sonraki ziyaretlerde SW kontrolü ile kalıcı fotoğraf cache çalışır.
- Görsel cache en çok 120 istek ve bilinen (opaque olmayan) yanıtlarda 2 MB/görsel sınırındadır. Kota/private mode nedeniyle önbellek yazma başarısızlığı siparişi etkilemez; tarayıcı verisi temizlenirse resimler tekrar iner.
- Ön bellekteki veriyi ürün/sipariş fiyatı veya Firebase erişim izni için güvenilir kaynak sayma. Veri formatı sürümü değiştiğinde cache geçersizleşir; IndexedDB açılamazsa eski tam yükleme akışı çalışır.
- Tasarruf, öncelikle tekrar açılışlarda menü aktarımını azaltır. Admin SSE, SMS/e-posta tetikleyicileri ve Firebase konsolundaki bütün indirilen MB bu değişiklikle ortadan kalkmaz.

## Sipariş güvenilirliği

- Yeni sipariş oluştururken Firebase `if-match: null_etag` kullanılır; aynı ID ile gelen tekrar mevcut siparişin üzerine yazmamalıdır.
- Admin onayı güncel sipariş + Firebase ETag ile koşullu güncelleme yapar. Eşzamanlı değişiklikte HTTP 412 oluşabilir; başarısız onay başarılı olarak gösterilmemelidir.
- Normal `mottatt` siparişlerinde onay için 180 saniye vardır. `confirmationNoTimeout: true` olan ön sipariş bu süreye tabi değildir.
- `Klar for henting` personelin gerçek durum değişikliğidir. Tahmini hentetid dolması tek başına `klar` durumunu veya hazır e-postasını oluşturmamalıdır.
- `orders` temizliğinde en yeni 100 sipariş korunur; daha eski kapalı siparişler yalnızca bildirimler için 72 saatlik güvenlik penceresi geçtikten sonra silinebilir. Aktif siparişler bu limit yüzünden silinmemelidir.
- Kalıcı müşteri sayacı ve pizza bonus verileri `customers/{phone}` altında tutulur. Silinmiş siparişler geri yüklenmeden bu toplamların korunması önemlidir.

## Çalışma saatleri

- Haftalık saatlerin tek kaynağı `settings.weeklyHours` (7 gün). `openingTime`, `orderOpenTime` ve `orderCloseTime` kullanılmaz.
- Haftalık program kurulmamışsa kodun varsayılanı 14:00–22:00'dır. Bu, Firebase'de kaydedilmiş gerçek restoran saatlerinin yerine geçmez.
- `manualClosed` ve `manualClosedUntil` geçici kapamayı yönetir.
- Hentetid hesabında `pickupLeadMinutes` ve `slotIntervalMinutes` kullanılır; varsayılanlar sırasıyla 30 ve 15 dakikadır. Kapanış sınırı ve planlı siparişler ayrıca tarayıcıda test edilmelidir.

## Bildirimler ve hata takibi

- Şablonlar: `notifications/templates`; test istekleri ve sonuçları: `notifications/tests`.
- `smsReceipts` / `emailReceipts` servis gönderim kabulünü kaydeder; gerçek alıcı teslimini kanıtlamaz. Servis durumları `notifications/smsHealth` ve `notifications/emailHealth` içindedir.
- `js/system-errors.js` kritik işlemleri ve belirli Firebase hatalarını kaydetmek için kullanılır; kısa süreli çevrimdışı kayıt kuyruğu vardır. Tarayıcı kapalıyken sürekli izleme yapmaz.
- Google Apps Script'teki tüm SMS/e-posta sorunlarının `systemErrors` içine aktarıldığı **varsayılmamalıdır**. Aktif Apps Script yürütmeleri, sağlık ve gönderim kayıtları ayrıca incelenmelidir.

## Doğrulama sınırları

- Referans kontrolü: `node demo/tools/audit-references.mjs`.
- Birim testleri: `node --experimental-default-type=module --test demo/tests/*.test.mjs`.
- Bu testler gerçek Firebase Rules, aynı anda çalışan iki admin cihazı, SMS/e-posta teslimatı ve Epson bağlantısını doğrulamaz.
- Test için üretim Firebase verilerini temizleme, tetikleyicileri yeniden kurma veya müşteri siparişlerini sıfırlama.

## Trafik tasarrufu — SMS/profil/bonus/admin (2026-11-06)

- Müşteri menüsünde arka plan `updatedAt` kontrolü, sayfa kesintisiz açık kaldığında en sık 10 dakikada bir yapılır; sayfaya geri dönüldüğünde en az 60 saniye geçmişse kısa sürüm kontrolü yapılır. Ödeme öncesi canlı güncellik doğrulaması **her zaman** korunur. Admin menüsü 30 saniyede bir kontrol edilir.
- Kısa süreli bağlantı yeniden kurulurken adminin mevcut SSE bağlantısından ilk sipariş anlık görüntüsü beklenecek şekilde 9 saniyelik tam `/orders` okuma duplikasyonu engellenir. SSE başarısızsa 15 saniyelik normal REST kurtarması sürer; 3 dakikalık onay beklentisi korunur.
- Bonus sayacı sadece JS belleğinde 45 saniye saklanır, aynı telefon için eşzamanlı istekler birleştirilir. `fresh: true` parametresi ve ödül rezervasyonu Firebase'i yeniden okumak zorundadır; hiçbir fiziksel kupon hakkı tarayıcı önbelleğine güvenmez.
- Profilde ad/e-posta kaydetme, özel müşteri istatistiklerini okumak ve tam müşteri kaydını PUT etmek yerine iki alana Firebase PATCH yapar. Yeni müşteri kabul mantığı ve bonus sayaçları ayrı kalır. **RTDB Rules PATCH yetkisi canlı ortamda doğrulanmalıdır.**
- Adminin yeni/eski müşteri etiketi için kısa toplam sayaç değeri 5 dakika bellekte saklanır; sipariş listesi kontrolü değişmez. Tam sipariş listesi SSE'si ve mutasyon/print akışı korunmuştur; bunun daha da küçültülmesi sunucu tarafında kalıcı bir özet feed gerektirir.

## Statuslys og manuell oppdatering (2026-11-07)

- I `Bestillinger` starter bare det eksisterende `btnRefreshOrders` en ny statuskontroll av nett/Firebase, `notifications/smsHealth`, `notifications/emailHealth` og Epson (papirfri ePOS). Den henter også ordredata, men **ikke** hele menyen.
- Statuslys starter som `ikke kontrollert`. Åpning av faner, automatisk rendering, fokusbytte og tidsintervaller utløser ingen nye statusforespørsler fra disse lysene. Et tidligere grønt lys viser **siste manuelle kontroll**, ikke en kontinuerlig friskhetstest.
- `Systemhelse`-fanen kan fortsatt kjøres ved et separat, uttrykkelig `Kontroller nå`-klikk. Den kjører ikke automatisk ved åpning eller hvert minutt. `Varsler` har fortsatt eget sikkerhetsvarsel.
- Viktig: Dette stopper **kun adminens statuskontroller**. Firebase SSE/REST ordreoppdateringer, alarmer, Godta, trykk, og uavhengige Google Apps Script-jobber for SMS/e-post går videre som før. Levende Apps Script kan fremdeles skrive `notifications/smsHealth` og `notifications/emailHealth` regelmessig for å rapportere jobbenes status. Endringer i admin kan ikke stoppe disse skriptenes hjerteslag uten å endre det aktive Apps Script-prosjektet.
- Manuell Epson-test er ikke utskrift og forbruker ikke papir. Resultat fra **ekte** kjøkkenutskrift oppdaterer naturligvis skriverikonet når utskriften skjer. Avvik mellom ikonets siste tilstand og dagens faktiske status er forventet frem til neste manuelt klikk.

## Manuell kontroll av SMS og e-post — 2026-11-07

- Tidl. ble `notifications/smsHealth` og `notifications/emailHealth` overskrevet av Apps Script hver minutt. Dette skjedde **selv når admin ikke sjekket status**. Det var feil å tolke frontendens manuelle refresh som at Firebase-skrivingene hadde stoppet.
- Nå oppretter `btnRefreshOrders` **én** liten `notifications/healthCheckRequest` med `id` og `requestedAt` per bevisst klikk. SMS og e-post-senderne leser denne forespørselen med sine eksisterende minutt-triggere og skriver hver sin helsepost **bare** dersom forespørselen er fersk, gyldig og ikke tidligere behandlet.
- Admin lytter på to tidsbegrensede Firebase SSE-strømmer (maks 160 sekunder), og godtar kun svar som inneholder **samme `requestId`**. Svaret vises når den aktuelle Apps Script-tidstriggeren har kjørt; gamle grønne indikatorer tas ikke for gyldige.
- Minutt-triggerne må **ikke** deaktiveres: de sender ekte ordre-SMS/e-post, oppdaterer ordre-spesifikke kvitteringer og utfører eksisterende tester. Med nytt script oppstår ingen **tomme helse-skrivinger**, men det er fortsatt **to små forespørselslesinger** per minutt og normale ordresøk. Nettobesparelsen må måles.
- **GitHub er kun kilde:** de aktive to Google Apps Script-prosjektene oppdateres IKKE automatisk ved repo-commit eller GitHub Pages deploy. Før begge LIVE-prosjektene har fått den nye kildekoden, vil gamle triggere fortsatt skrive `smsHealth` og `emailHealth` hvert minutt. Slett ikke triggere eller Script Properties.
- Firebase Database Rules må sikre `healthCheckRequest` mot uautoriserte skriv, og sikre at helsedata kun kan skrives av betrodde avsendere. Selv om koden begrenser alder/id, er dette **ikke** autorisasjon.

## Legacy pizza bonus scan budget (2026-11-07)

- `loyalty-sync.js` migrerer fortsatt historiske `/pizzaBonus` kontoer med ETag-transaksjoner og uten tap av opptjent gratispizza.
- Når **hele** historikkgjennomgangen er gjennomført uten feil, skrives bare et tidsstempel (ingen telefonnumre/kundeinfo) i lokal `localStorage`. Nye adminbesøk i samme nettleser gjentar ikke full `/pizzaBonus.json?shallow=true`-gjennomgang før etter syv dager.
- Ufullført eller mislykket migrering blir ikke markert ferdig; neste innlogging forsøker igjen. Nye bestillinger fortsetter å synkroniseres umiddelbart, og kundens `getPizzaBonus` beholder legacy fallback før opptjente gratispizzaer brukes.
- Flere uavhengige adminenheter kan fortsatt gjennomføre separate kontroller. Kunderegisteret og gamle bonusdata slettes ikke.

## Firebase trafikkontroll — fase 1 og 2 (2026-11-07)

**1. Systemfeil / Varsler:** Adminens `systemErrors`-leser bruker én Firebase REST SSE-tilkobling mens fanen er synlig. Første hendelse er én full oversikt; etterpå blir bare `put`/`patch`-endringer sendt og flettet inn lokalt. Varselmerke og kritiske alarmer oppdateres ved eventet. Ved SSE-brudd gjøres én REST-sikkerhetslesing og deretter lavfrekvent fallback (60 sek i aktiv Varsler-fane, 180 sek utenfor). Hvis fanen skjules, lukkes ekstra tilkoblingen; den etableres på nytt når admin er synlig. Manuell systemhelsekontroll beholder en eksplisitt oppfriskning. Ingen nye Firebase-skjemafelt eller lagring av persondata lokalt.

**2. Meny:** Kundens `IndexedDB`-meny og `Cache Storage`-bilder beholdes. `updatedAt` kontrolleres automatisk hvert 10. minutt under aktiv bruk, ved gjenfokusering tidligst etter 60 sek, og alltid før en kunde sender ordren. Full meny lastes bare når versjonen er endret. Admin bruker 30 sek. Ingen lagring av andre kunders informasjon i nettleseren.

**5. Pickup-kapasitet:** Den allerede anonyme `publicPickupLoad`-oversikten publiseres umiddelbart etter ordre-/innstillingsendringer, men uendret publisering begrenses til ca. hvert 150. sekund (med 60-sekunders vedlikeholdstimer). Gyldighetstiden på kundens veiledende oversikt er 240 sekunder; er den eldre, filtreres **ingen** hentetider bort på grunn av gammel kapasitetsinformasjon. Kundens hentetidsskjerm leser veiledende oversikt omtrent hvert 60. sekund mens tidvelgeren er åpen. Når adminfanen lukkes stopper oppdateringen og gamle data blir ugyldige. Dette er fremdeles ikke en backend-atomisk reservasjon.

**4. Historiske bonuskontoer:** Etter vellykket full migreringskontroll lagres kun et tidsstempel i adminnettleserens `localStorage`. Den store gamle `pizzaBonus`-nøkkeloversikten kontrolleres normalt bare ukentlig per enhet. Avbrutt migrering markeres aldri fullført; løpende bonusoppdateringer og fallback for kundens opptjente gratispizzaer fungerer som før.

**3. Admin ordretrafikk — arkitektur avventes:** Nåværende `/orders` SSE-løp gir én komplett startoversikt og deretter bare inkrementelle status-/ordrehendelser. REST fallback henter hele ordreliste hvis SSE er utilgjengelig for at nye ordre fortsatt skal nå admin og 3-minutters godkjenningsfrist. Videre reduksjon av **første overføring** krever en server-vedlikeholdt, indeksert ordreoversikt med tydelige RTDB Rules og sikker migrering. Ikke bytt til `limitToLast` eller datofiltre uten å kunne bevise at gamle, men fortsatt aktive/planlagte ordre aldri skjules. Ikke lagre kundeordre i offentlig nettlesercache. Denne fasen har derfor **ikke** endret ordre-feed eller Godta/varsel/print.

Ingen besparelsesprosent er målt. Mål Firebase Downloads før og etter under samme type bestillingstrafikk og antall adminfaner.
