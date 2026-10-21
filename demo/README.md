# KØL Grill & Pizza — /demo

Dette er **den gjeldende bestillingsappen**, ikke prototypen fra den gamle `/test`-mappen.

## Firebase + SMS/e-post uten Vercel (2026-10-22)

- `/demo/` bruker Firebase Realtime Database REST/SSE direkte for ordreflyt, meny og innstillinger. Ingen Vercel-kall.
- SMS-kvittering må **ikke gjettes**: Google Apps Script sender fortsatt til Traccar og lagrer `orders/{orderId}/smsReceipts/accepted` i Firebase først når Traccar har godtatt SMS. Admin viser `SMS ble sendt · Bekreftelse` bare hvis denne posten finnes og er gyldig.
- E-post sendes fortsatt av den separate MailApp-polleren, som allerede skriver `orders/{orderId}/emailReceipts/accepted` til Firebase når MailApp har godtatt sendingen. Admin viser `E-post sendt · Bekreftelse` bare ved gyldig kvittering.
- SMS-polleren skriver en `smsHealth`-status til Firebase, slik at admin kan vise SMS-tjenestestatus uten Vercel. E-poststatus leses fra `emailHealth` i Firebase som før.
- **Utplassering nødvendig:** `integrations/google-apps-script/Kode.gs` er en kildekopi i GitHub og oppdaterer ikke et allerede utplassert Google Apps Script-prosjekt. Kopier den nye koden til det aktive SMS-prosjektet. Ikke installer en ekstra trigger eller nullstill eksisterende Script Properties / LIVE-modus, da dette kan påvirke utsending eller føre til duplikater.
- Meldinger sendes fremdeles via Google Apps Script, Traccar og MailApp. Firebase Realtime Database er eneste database og applikasjons-API; Realtime Database kan ikke sende ekte SMS/e-post på egen hånd.
- Både SMS-kvittering og e-postkvittering betyr at leverandøren har **godtatt** meldingen, ikke at den definitivt er levert til mottakerens telefon/innboks.
- Sikkerhet: direktilgang til Firebase uten autentisering krever sikre database-regler; ikke gi offentlig skriveadgang til helse-/kvitteringsposter eller lesetilgang til personopplysninger. De eldre Firebase Functions bruker et **annet** databaseprosjekt og er ikke automatisk del av denne `/demo/`-flyten.

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
| Apps Script-kopi | `integrations/google-apps-script/` | Referansekopi av e-post-poller (ikke automatisk utplassert) |

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
