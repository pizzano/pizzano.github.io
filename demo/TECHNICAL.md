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
- Tasarruf, öncelikle tekrar açılışlarda menü aktarımını azaltır. Admin SSE ve diğer Firebase bağlantılarının indirme trafiği devam eder.

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
- `smsReceipts` / `emailReceipts` servis gönderim kabulünü kaydeder; gerçek alıcı teslimini kanıtlamaz. Aktif sender-resultater vises fra hver ordres egne kvitteringer, ikke fra en global helseforespørsel.
- `js/system-errors.js` kritik işlemleri ve belirli Firebase hatalarını kaydetmek için kullanılır; kısa süreli çevrimdışı kayıt kuyruğu vardır. Tarayıcı kapalıyken sürekli izleme yapmaz.
- Google Apps Script'teki tüm SMS/e-posta sorunlarının `systemErrors` içine aktarıldığı **varsayılmamalıdır**. Aktif Apps Script Web App-kjøringer og ordrenes sendekvitteringer må undersøkes direkte.

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

## SMS/e-post: hendelsesstyrt Web App (2026-11-09)

- Den gamle manuelle `healthCheckRequest`-knappen og SMS/e-post-statusstrømmene er fjernet fra admin. Den vanlige oppdateringsknappen sjekker fortsatt ordre, nett og Epson.
- Etter at Firebase har bekreftet `Godta`, sender nettleseren en `text/plain` POST med kun `{orderId,kind:'accepted'}` til SMS og e-post Web Apps. `Marker klar` sender `kind:'ready'` kun til e-post.
- SMS og e-post Web Apps (`integrations/google-apps-script/Kode.gs` og `email-poller.gs`) leser bare `orders/{id}` og bruker de eksisterende dedupliseringsmarkørene i Script Properties. Vellykket eller avvist sending lagres som ordrespesifikke `smsReceipts` / `emailReceipts`; uavklart gatewaystatus er aldri automatisk grønn eller rød.
- Admin viser senderresultat på hver ordre via den allerede åpne Firebase `/orders` SSE. Ingen nye per-ordre pollere opprettes.
- Eksisterende SMS/e-post-utløsere i de **aktive** Google Apps Script-prosjektene må deaktiveres eksplisitt: `stoppSmsMinuttSjekk()` og `stoppEpostMinuttSjekk()`. Oppdatert kode på GitHub **deployer ikke** disse prosjektene.
- Sett først ekte `smsWebhookUrl` og `emailWebhookUrl` i `demo/config.js` etter to separate Web App-deployments. Begge Web App-adressene er nå konfigurert i demo/config.js; sjekk deploy ved endring. Webhook-mottak krever `doPost` og tilgang som passer testmiljøet.
- Sende tester i Varslinger behandles nå ved en direkte Web App-kall etter bevisst `Send test`-klikk, ikke gjennom en hvert-minutt-worker.
- Dette fjerner **tomgangspolling fra disse to Apps Script-prosjektene først når levende triggere faktisk er deaktivert**. Adminens ordre- og systemfeil-SSE er uavhengige av dem. Web App-responsen fra `no-cors` kan ikke brukes som sendebevis; kvitteringen fra Firebase er autoritativ.

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

## Admin kompakt ordrestrøm — klargjort, IKKE aktivert (2026-11-07)

En større optimalisering er kodeklargjort og lagt bak `window.BESTILL_CONFIG.trustedCompactOrderFeed === true`. **Flagget er IKKE aktivert i `demo/config.js`**, da ingen verifisert og autorisert server-side indeksbygger eller Firebase Rules for den nye banen er installert. Dermed fortsetter eksisterende `/orders` SSE med alle ordre, alarm, Godta, SMS/e-post, printer, lojalitet og arkiv uten endringer.

Klargjort kontrakt for en trygg fremtidig backend:
- Backend vedlikeholder `/adminOrderFeed/meta` og `/adminOrderFeed/orders` i sanntid med en **komplett liste over alle åpne, også eldre planlagte** ordre pluss begrenset nylig historikk.
- `meta` må ha `schemaVersion:1`, `publisher:"trusted-firebase-order-worker-v1"`, `ready:true`, `completeOpenOrders:true`, `backendMaintainsLoyalty:true`, `backendMaintainsRetention:true`, `backendMaintainsLegacyMigration:true`, `generatedAt`, `includedOrderCount` og `openOrderCount`. Ikke sett disse til true uten at en autentisert server faktisk oppfyller dem.
- Inkluderte ordre må være **hele** ordre med `id`, `phone`, `createdAt`, `status`, `total`, `lines[]` slik at kjøkken, aksept og henting ikke mangler detaljer. Maks 250; flere aktive krever vanlig full strøm i stedet for å miste en ordre.
- Backend oppdaterer `generatedAt` før 45 sekunder er gått. Feil/utdatert/ufullstendig index, SSE-feil, eller manuelt Refresh fører til full, autoritativ `/orders` SSE/REST for resten av fanesesjonen.
- Ved aktiv kompakt strøm er det serveren som **må** utføre lojalitetssynk, historisk migrering og 72-timers beholdnings- og kvitteringsvern. Nettleserens arbeidere står da av for å unngå å regne på manglende historikk.
- **Sikkerhet:** Firebase Rules skal tillate kun autentisert restaurantpersonell å lese `adminOrderFeed`, og kun en autorisert server å skrive. Feltnavnet `publisher` er ingen signatur eller tilgangskontroll. Verifiser Rules og autentisering før flagget skrus på, og test samtidig skift fra gammel kunde-side, gammel planlagt ordre, nye mottatt, annullering, SMS/e-postkvitteringer og feilmeldinger.
- Ved dagens nullbackend ville opt-in alene være **farlig**. Koden er derfor kun et failback-klart integrasjonspunkt og **gir ikke målbar trafikkbesparelse ennå**. Backenden må bygges/deployes separat med sikker tilgang og kostnadsvurdering.

Merk: Den aktuelle restaurantløsningen bruker REST-klientkall uten Firebase SDK eller påvisbar adminauth i repoet. Ikke åpne en ny privat ordreindeks for anonym lesing, og ikke eksponer persondata i offentlig cache.

## November 2026 — DEMO fase 2, lavrisiko-optimalisering

- Samtidige identiske REST GET-forespørsler deler ett nettverkskall. Resultater lagres ikke etter at forespørselen er ferdig; `cache: 'no-store'` beholdes for ordre- og timekritiske verdier. Unødvendig timestamp-parameter fjernes, men dette er **ikke** en vedvarende HTTP-cache.
- Et enkelt ordre-SSE-delta sjekker fingeravtrykket til bare berørt ordre. Root-snapshots, gjenoppkobling og ventende lokale statusendringer kontrollerer fortsatt alle ordre.
- Lojalitets-synkronisering planlegges ikke på nytt når bare kvitterings-/varslingsstatus endres. Den eksisterende minuttvise gjenopprettingsrunden er beholdt.
- Eldre bonuskontoer bruker det allerede innlastede fullstendige admin-snapshotet når tilgjengelig; uten slikt snapshot brukes den opprinnelige Firebase-lesingen for korrekthet.
- Arkivrydding unngår sortering ved høyst 100 ordre, men arkivering er fortsatt avhengig av åpen adminfane. Dette kan ikke gjøres uavhengig av nettleseren uten backend.
- Den kompakte adminordrestrømmen er fortsatt **deaktivert**. Ikke aktiver `trustedCompactOrderFeed` før autorisert backend, fullstendighetskontroller og egen arkiv-/lojalitetsvedlikehold er på plass.

Verifikasjon: Kildekodekontroller er lagt til i `tests/firebase-read-optimization.test.mjs`. Full Node-testkjøring og fysisk Firebase-/skriver-/SMS-testing må utføres før sammenslåing til main.


## November 2026 — DEMO fase 3 (skriver beholdes uendret)

Epson skriverkonfigurasjonen er uendret fordi den eksisterende skriveren fungerer. SMS/e-post får avgrenset nettverks-retry; serverens eksisterende sendemarkører hindrer duplikater. Den valgfrie Apps Script-jobben for uavhengig 3-minutters utløp må deployes/aktiveres separat og vil lese /orders minst én gang i minuttet. Den er IKKE aktivert.

## November 2026 — DEMO fase 4: kontrollert opprydding

- Fjernet ubrukt `confirmWaitPulse`-animasjon fra kundens CSS. En ny CSS-regresjonstest varsler om nøkkelrammer uten referanser.
- Fjernet den ubrukte `noticeCheckEmailEngine`-funksjonen fra adminens varslingsvisning; ingen fungerende varslingsfunksjoner ble fjernet.
- `fullfort` og `pizzaBonus` er historiske kompatibilitetsbaner, ikke dokumentert dødkode. De er beholdt for ordre- og bonusmigrasjon, slik at eksisterende gratispizzaopptjening ikke risikeres.
- Større endringer i overlappende `customer.css`, `theme.css` og `admin.css` krever skjermbilde-/nettleser-regresjonstester før sammenslåing. Den eksisterende bestillings- og skriverflyten er beholdt.
