# KØL Grill & Pizza — /demo

Dette er **den gjeldende bestillingsappen**, ikke prototypen fra den gamle `/test`-mappen.

## Kart over filene

| Del | Plassering | Formål |
| --- | --- | --- |
| Kundeapp | `index.html` | Nettbestilling og ordresporing |
| Restaurantapp | `admin.html` | Bestillinger, produktmeny, restaurant- og printerinnstillinger |
| Epson test | `test-printer.html` | Test av ePOS-utskrift og kvittering |
| Privat skriver | `tools/PrivatPrinter.html` | Lokale bilder → 576-pikslers Epson-bitmap; bilder lastes ikke opp |
| Firebase URL | `config.js` | Database-adressen for bare /demo |
| Synk / ordre / lagring | `js/data.js` | Felles data, bestillinger og innstillinger |
| Kunde-UI | `js/customer.js` | Kundehandlinger, handlekurv, ordreflyt |
| Admin-UI | `js/admin.js` | Bestillingsliste, godkjenning, meny, printerinnstillinger |
| Epson ePOS | `js/order-printer.js` | 80 mm bildekvit., forhåndsvisning og printerstatus |
| Små delte moduler | `js/cart-order.js`, `js/loyalty.js`, `js/palette.js` m.fl. | Aktiv logikk importert av kunde eller admin |
| Design | `css/` | Aktive stilark. Ikke slett én CSS bare fordi den har få regler |
| Ikoner | `icons/` | PWA-ikoner og restaurantikon |
| PWA | `manifest.webmanifest`, `service-worker.js`, `js/install.js` | Installering, mellomlagring og nettverksoppførsel |
| Varsellyd | `soundreality-police-operation-siren-144229.mp3` | Brukes av ordrevarsel |

| Utviklerverktøy | `tools/convert_globalfood.py`, `tools/audit-references.mjs` | Konvertering og filkontroll |
| Apps Script-kopier | `integrations/google-apps-script/` | SMS- og e-post-pollere (GitHub-kode er ikke automatisk utplassert til Google) |

## Ikke flytt eller slett ukritisk

- `index.html` og `admin.html` laster stilark med **absolutte `/demo/...`-stier**.
- `js/admin.js` og `js/customer.js` importerer `js/data.js` og små moduler.
- `service-worker.js` viser til flere faste ressurser. Endres en sti må den oppdateres her også.
- Epson: `js/order-printer.js` bruker HTTPS mot lokal IP `192.168.1.25`, enhets-ID `local_printer`.
- Papiret er 80 mm, mens utskriftsbildet er 576 piksler bredt (ca. 72 mm skrivbart område).
- Printerfontene kan settes i **Restaurantinnstillinger → Printer ayarları**; samme Canvas brukes til forhåndsvisning og utskrift.
- SMS og e-post er koblet til eksterne prosesser. Kode i `functions/` og Google Apps Script påvirkes **ikke** ved å flytte referansekopier herfra.
- `integrations/google-apps-script/email-poller.gs` er en lagret kildekopi; bekreft gjeldende databaseadresse i det faktiske Apps Script-prosjektet før kopiering.
- Andre sider i rotmappen (`gavekort.html`, `gavekort-admin.html` osv.) er separate prosjekter og må ikke flyttes som en del av /demo.

## Arbeidsrutine

1. Endre bare nødvendige filer i `demo/`.
2. Oppdater cache-versjonsparameteren i `admin.html` eller `index.html` når JS/CSS endres.
3. Kjør `node demo/tools/audit-references.mjs`.
4. Test både mobil/Android og desktop, samt Epson-utskrift ved skriverendringer.
5. Push til `main`. Behold eksisterende `/demo/`-URL-er.
6. Ved behov: gjenopprett en gammel fil fra `backup-before-demo-cleanup-20261015`.


## KØL-verktøy som hører til /demo

| Verktøy | Fil | Gammel adresse |
| --- | --- | --- |
| Ansatt-timelister (lokal utskrift) | `tools/Timelister.html` | `/Timelister.html` (videresendes) |
| Privat Epson-bildeutskrift | `tools/PrivatPrinter.html` | `/PrivatPrinter.html` (videresendes) |

**Gavekort er et separat prosjekt.** Både `/gavekort.html` og `/gavekort-admin.html` ligger i rotmappen med sine originale filer. Det finnes ingen `demo/gavekort/`-kopi.

`api/` forblir i roten for Vercel API-ruter, og `functions/` forblir i roten for Firebase-funksjoner. Ingen SMS-, e-post-, database- eller ordrelogikk er endret.

Automatiske testskript som tidligere lå i `demo/tests/` er tatt ut av hovedgrenen for å rydde opp. De kan gjenopprettes fra `backup-before-removing-demo-tests-20261015`. Epson-skriverens manuelle testverktøy `test-printer.html` er beholdt fordi det fortsatt er nyttig ved feilsøking.

## Firebase bandwidth improvement (2026-10-15)

- `js/data.js` uses **Firebase REST Server-Sent Events** for `orders.json`. After the initial snapshot, the server sends only changed orders/fields. New orders and staff status changes remain live.
- Restaurant/menu edits are watched through `updatedAt.json`, and the menu is downloaded only after its revision changes.
- If SSE is unavailable, a **15-second** REST fallback requests **only `orders.json`**, never the whole database; `updatedAt` is checked at most once per minute. The admin's manual refresh can still read the root on demand.
- `js/customer.js` no longer starts separate SSE connections or 5-second polling for each active order; the shared stream already keeps those orders updated.
- No changes to Google Apps Script, Firebase Functions, SMS, email or Epson. If Firebase security rules are tightened later, make sure streaming REST reads remain authorized.

Cache-busting versions on both entrypoints and the PWA service-worker must be advanced when this logic changes.

## Vedlikehold og trygg opprydding (2026-10-16)

- Klient-, admin-, bonus- og butikkinfo-modulen må importere **samme versjonerte URL**
  til `js/data.js`. To forskjellige versjoner skaper separate modulinstanser og
  ekstra Firebase-lyttere.
- `js/install.js` henter ikke menyen på nytt når den lagrede `updatedAt`-verdien
  fortsatt matcher Firebase. En ny menyversjon leses fortsatt som normalt.
- `getPizzaBonus()` henter bare `pizzaBonus/{telefon}` for kontoer med
  `pizzaCountSynced=true`; usynkroniserte kontoer beholder historikk-fallback.
  En aktiv bonusreservasjon kontrollerer kun den reserverte ordren.
- `service-worker.js` mellomlagrer bare offentlig app-skall og `/demo/`.
  API-svar og ukjente nettsider lagres ikke. Gamle cache-versjoner slettes
  ved aktivering av en ny service-worker.
- Ubrukte, gamle tekstutskrifts-hjelpere er fjernet fra Epson-modulen.
  Aktiv Canvas-bitmaputskrift og test-printerverktøy er beholdt.
- Urefererte rotbilder `img/btn.png`, `img/gratis.gif`, `img/load.gif`,
  `img/logom.png` og `img/stemp.jpg` er ryddet bort fra hovedgrenen.
  Filene kan gjenopprettes fra Git-historikken.
- Legacy URL-er `test.html`, `test/index.html` og `test/admin-panel.html`
  beholdes som videresendinger slik at bokmerker ikke brytes.
- Viktig gjenstående jobb: den delte SSE-lyttingen åpner fremdeles
  `/orders.json`, og godkjenning av ordre bruker fortsatt ETag mot
  database-roten. Disse kritiske flytene endres **ikke** som del av oppryddingen.
  For å avgrense lyttere og låse ned kundedata trengs en egen testet
  autentiserings-/migreringsplan.


## 100 nyeste bestillinger uten arkiv (2026-10-17)

- `/orders` beholder **de 100 nyeste bestillingene**. Bestillinger eldre enn de 100 nyeste slettes **permanent** fra Firebase når de er trygt avsluttet. Det opprettes **ikke noe nytt ordrearkiv**.
- Oppryddingen ligger i `js/orders-archive.js` (eldre filnavn beholdt for kompatibilitet), og kjører **bare når restaurantens adminside er åpen/aktiv**, i bolker på inntil 12, samt ved oppstart og omtrent hvert femte minutt. Ingen 24/7-serverjobb er satt opp.
- `/orderArchive` er en gammel arkivstruktur. Adminsiden forsøker å slette denne **én gang per sideøkt** når den er tilgjengelig. Ved nettverksfeil prøver den igjen senere. Det foretas ingen ny kopiering til arkivet.
- Sikring: De 100 nyeste og alle åpne ordrer beholdes; bare `fullfort`, `avvist` eller `klar` (med `staffReadyAt`) som er minst **72 timer etter siste statusendring**, kan slettes. Dette beskytter pågående bestillinger og gir SMS-/e-postpollere tid til å lese statusendringer.
- Slettingen sjekker ordren på nytt og benytter ETag-betinget DELETE; om en ordre endrer seg underveis, beholdes den. Bekreftede pizzabonuspoeng må være lagret under `pizzaBonus/{telefon}/events/{orderId}` før kilden fjernes.
- Det kan midlertidig være **mer enn 100** ordrer dersom ingen kan slettes trygt eller restaurantens adminside er lukket.
- Kundenes `Mine bestillinger` viser nå bare **aktive/relevante** bestillinger (inkludert statusvarsler som ennå ikke er lukket), ikke historisk ordreoversikt. Lokale ordresnapshots brukes fortsatt for aktiv ordresporing og bonus-fallback, men gammel historikk vises ikke.
- **Viktig:** Sletting fra Firebase er irreversibel. Bilag og salgsdokumentasjon som er nødvendig for bokføring må ivaretas i et separat godkjent regnskaps-/kassesystem.


## SMS uten Vercel — Firebase RTDB (2026-10-22)

- `/demo/` bruker ikke lenger Vercel for SMS-status eller sendingskvitteringer.
  `config.js` inneholder bare Firebase-adressen.
- **Sendingen er fortsatt uendret:** den aktive Google Apps Script-jobben
  `pollOrdersForSms()` leser bekreftede ordre og sender **én bekreftelses-SMS**
  via Traccar/Android. GitHub Pages og Firebase RTDB sender ikke SMS selv.
- `admin.js` leser **`/smsHealth.json`** direkte fra Firebase. Den viser
  grønt bare når `source=apps-script-sms-poller`, `liveConfigured=true`
  og det finnes en vellykket kontroll de siste tre minuttene. Dette beviser
  at polleren kjører, **ikke** at telefonen mottok SMS.
- Etter vellykket Traccar-respons skriver SMS-polleren en kvittering til
  `/orders/{orderId}/smsReceipts/accepted` med
  `{state:"accepted",provider:"Traccar",sentAt:<millisekunder>}`.
  Mislykket sending vises aldri som «SMS ble sendt».
  Kjøkken/admin ser kvitteringen fra sin eksisterende Firebase-ordrestrøm.
  Ingen separat receipt-API eller ny polling trengs.
- De historiske `ready` og `estimateUpdated`-feltene beholdes i UI for
  gammel dokumentasjon; **den gjeldende SMS-polleren sender kun bekreftelse**.
- En Firebase-skrivefeil kan skjule UI-kvitteringen, men **starter ikke ny
  SMS-sending**. Den opprinnelige dedupliseringsnøkkelen i Apps Script
  ScriptProperties blir bevart.

### Obligatorisk aktivering i Google Apps Script

1. Åpne det **faktiske, aktive SMS Apps Script-prosjektet** og erstatt
   eksisterende `Kode.gs` med
   `demo/integrations/google-apps-script/Kode.gs` fra GitHub.
   **GitHub-commit endrer ikke kode som allerede kjører i Apps Script.**
   La `TRACCAR_TOKEN`, `TEST_PHONE`, `KOL_MODE` og de eksisterende
   utløserne/ScriptProperties være urørt. **Ikke kjør `setupLiveSms()` igjen**,
   fordi den nullstiller aktiveringstidspunktet.
2. Sjekk kjøreloggen for `pollOrdersForSms` etter neste vellykkede runde.
   Bekreft at `smsHealth/checkedAt` oppdateres og
   `liveConfigured` er `true` (LIVE). Hvis `smsHealth` forblir tom,
   sjekk Firebase-skrivetilgang og Apps Script-loggene.
3. Kjør **`syncRecentSmsReceiptsToFirebase()` manuelt** for å flytte
   bekreftede gamle SMS-kvitteringer for de 100 nyeste ordrene fra
   ScriptProperties til Firebase. Funksjonen **sender ingen SMS**.
   Kjør på nytt ved behov hvis loggen melder om 50 kvitteringer per kjøring.
4. Gjør en kontrollert ny testbestilling: godkjenn, verifiser én mottatt
   SMS og bekreft at `orders/{id}/smsReceipts/accepted` vises i RTDB.
   Kontroller at «SMS ble sendt» dukker opp i admin uten Vercel.
5. Før gammel Vercel-deployment slettes: bekreft at ingen andre tjenester
   fremdeles bruker dens `api/`-ruter. De eldre `api/sms-status.js` og
   `api/sms-receipts.js` er ikke lenger referert av `/demo/`.

**Sikkerhet:** De eksisterende Apps Script-kallene bruker Firebase REST uten
autentiseringsheader (også e-post-polleren). Bekreft RTDB-sikkerhetsregler
før produksjonsbruk; offentlige klienter må **ikke** kunne forfalske
`smsHealth`, `smsReceipts` eller ordrestatus. Sikre skriverettighetene
med en pålitelig serveridentitet før reglene strammes inn; ellers får
Apps Script HTTP 401/403 og UI-statusen forblir ubekreftet. Verken
Traccar-token eller private Apps Script-URL-er skal inn i GitHub.

## Bekreftelse som forsvant ved sideoppdatering (2026-10-22)

- Restaurantens «Godta»-handling er nå **server-first**: admin viser aldri
  en lokal «bekreftet» ordre før Firebase har kvittert for lagringen.
  Feil blir vist som en tydelig 10-sekunders toast med HTTP/konfliktårsak.
- Standard bekreftelse bevarer den eksisterende ETag-beskyttede
  ordreoppdateringen. Hvis sikkerhetsregler avviser hel-ordre-PUT med
  400/401/403, prøver koden en forsiktig reservevei: hent ETag på
  `orders/{id}/status`, lagre nødvendige hentetidfelter, og skriv
  **kun status** med `if-match`. ETag-konflikter (412) medfører IKKE
  blind statusoverskriving; personalet må kontrollere ordren.
- Etter vellykket operasjon forsøker koden en ekstra ordrelesing for å
  bekrefte `status=bekreftet`, og admin oppdaterer visningen med serverdata.
  Det er ikke en garanti for at kunden mottok SMS/e-post.
- Kundens bekreftelsesdialog leser allerede egen ordre direkte fra Firebase
  opptil hvert 4. sekund i de tre minuttene den venter; ingen bred
  databaseforespørsel eller Vercel-endepunkt er lagt til.
- Alle aktive klient-/adminmoduler deler nå samme versjonerte import av
  `js/data.js`, og service-worker-cachen er oppdatert.
- **Test før full drift:** Legg inn én ny testordre og godta innen 3 minutter.
  Bekreft `orders/{id}/status=bekreftet` i Firebase, at kunden får
  «Bestillingen er bekreftet», og at ordren ikke kommer tilbake som
  «Mottatt» når admin lastes på nytt. Ved rødt feilmeldingsvarsel,
  noter meldingen og kontroller Firebase RTDB-reglene.


## SMS-telefonens nettstatus, uten Vercel (2026-10-22)

- **Viktig skille:** `smsHealth` beviser bare at Google Apps Script sjekker
  Firebase. At Traccar Cloud godtar en SMS-forespørsel beviser **ikke**
  at Android-telefonen har mottatt forespørselen eller sendt SMS på mobilnettet.
  Admin markerer derfor slike ordre som «SMS-forespørsel godtatt», ikke «SMS sendt».
- Admin kontrollerer nå **to uavhengige opplysninger** fra RTDB hvert 10. sekund:
  - `/smsHealth`: vellykket LIVE-poll fra Google Apps Script (maks 3 minutter).
  - `/smsDeviceHeartbeat`: fersk tilkoblingsmelding fra selve Android-telefonen
    (maks **45 sekunder**, kilde `kol-android-heartbeat`).
- SMS-lampen blir grønn **bare** når begge kontrollene er ferske.
  Ved manglende oppsett er den gul/ubekreftet; etter tidligere registrert
  telefon som mister forbindelsen blir den rød. Dette er **nettstatus**,
  ikke bekreftelse på at Traccar-appen er aktiv eller at SMS er levert.
- Telefonen kan bruke `/demo/tools/sms-gateway-monitor.html` som en
  **midlertidig synlig nett-kontrollside**. Åpne adressen i Chrome **på
  SMS-telefonen**, trykk «Start telefonkontroll», og la skjermen være på.
  Siden skriver hvert 15. sekund en anonym og minimal Firebase-oppdatering,
  med **Firebase-serverens tidsstempel**. Den sender ingen SMS.
  Når telefonens internett blir borte, går lampen fra grønt til rødt innen
  ca. 45–55 sekunder så lenge adminpanelet er synlig og på nett.
- Når telefonen låses eller nettleseren havner i bakgrunnen kan heartbeat stoppe.
  **Dette er ikke en pålitelig 24/7 Android-overvåking i bakgrunnen**.
  For slik drift trengs en Android-tjeneste/automatisering (for eksempel
  Tasker/MacroDroid med sikkert autentisert heartbeat) eller en SMS-gateway
  som tilbyr dokumentert enhetsstatus.
- **Sikkerhet:** Denne enkle kontrollsiden sender i dag via REST til den
  eksisterende databasen, uten egen innlogging. Oppdateringen inneholder
  ingen telefonnumre/hemmeligheter, men en offentlig skrivbar RTDB
  lar uvedkommende forfalske statusen. Lampen må derfor regnes som en
  driftsindikator, **ikke en sikkerhetskontroll**. Før permanent drift må
  heartbeat-skriving låses til en autentisert enhet/tjeneste, og
  `smsHealth`/`smsReceipts` beskyttes av RTDB-regler.
- Test: åpne kontrollsiden på SMS-telefonen, slå på overvåking, kontroller
  grønne lys i admin, slå av både Wi-Fi og mobildata på telefonen. Vent opptil
  ca. ett minutt. Lampen skal bli rød. Slå på internett igjen og bekreft at
  tilkoblingsmeldingen oppdateres. **Ingen testordre eller SMS er nødvendig.**


### PC ile feilaktig grønt lys — rettet (2026-10-23)

- Den første telefonkontrollsiden lot **enhver nettleser**, også en PC,
  skrive `smsDeviceHeartbeat` og gjøre SMS-lampen grønn. Dette var feil:
  en PC med nett forteller ingenting om SMS-telefonens tilkobling.
- `tools/sms-gateway-monitor.html` nekter nå oppstart på ikke-Android
  nettlesere, også når gammel lokal «startet»-tilstand finnes.
  Desktop viser forklaring og **sender ingen Firebase-heartbeat**.
- Kun Android-nettleseren skriver nå `platform:"android"` og
  `monitorVersion:2` sammen med serverklokkeslettet.
  `admin.js` godtar bare slike v2-heartbeats, slik at **gamle PC-meldinger
  aldri mer gir grønt lys**, selv når de ennå er ferske.
- Dette er **fortsatt en nettleser-/plattformkontroll, ikke kryptografisk
  identitetsbekreftelse**. En annen Android eller en forfalsket browser-UA
  kan fremdeles produsere signal når Firebase-reglene tillater offentlig
  skriving. Før produksjonsbruk trenger signalet autentisering og en
  bakgrunnstjeneste på den faktiske SMS-telefonen.
- Traccar SMS Gateway kan via Cloud-relé stå uten kontakt med telefonen,
  selv om cloud-API har godtatt meldingen. Ingen av disse visningene
  beviser app-tilstand eller fysisk SMS-levering.
