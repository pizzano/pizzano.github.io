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

De to eldre SMS-Vercel-rutene i `api/` er nå slettet. `functions/` inneholder en eldre, separat Firebase Functions-variant, blant annet delt kode som også brukes av `functions/email.js`. Den er ikke del av den aktive Apps Script-SMS-polleren; distribusjonsstatus er ikke bekreftet, så filene er beholdt.

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


## SMS — én aktiv løsning (opprydding 2026-10-23)

**Gjeldende flyt:** Google Apps Script (`integrations/google-apps-script/Kode.gs`)
leser nye bekreftede bestillinger i Firebase Realtime Database og sender
**én hentetid-bekreftelse** per ordre via Traccar Cloud og Android-SMS-gateway.
`pollOrdersForSms()` kjører i Google Apps Script etter eksisterende tidsutløser,
og `KOL_SENT_<id>_accepted` i ScriptProperties hindrer duplikatsendinger.
`TRACCAR_TOKEN`, TEST/LIVE-tilstand, eksisterende triggere og historikk må
ikke nullstilles. **GitHub-oppdateringer endrer ikke automatisk det levende
Apps Script-prosjektet.** Ikke kjør `setupLiveSms()` eller `setupTestSms()`
på nytt under oppryddingen.

**Kun ett statuskall i admin:** `js/admin.js` leser bare
`/smsHealth.json` via Firebase REST hvert 15. sekund når fanen er synlig.
`smsHealth` skrives av samme Apps Script etter vellykket poll.
Status betydning:

- **Gul — SMS-automatisering LIVE:** Apps Script kontrollerte Firebase nylig
  (under 3 minutter). Telefonens forbindelse og SMS-levering er **ukjent**.
- **Rød — SMS-automatisering av/utilgjengelig:** LIVE er av,
  kontrollen er over 3 minutter gammel eller Firebase kan ikke leses.
- **Gul — status ukjent:** Ingen gyldig Apps Script-status er tilgjengelig.
  **Ingen grønn telefonstatus** vises uten ekte verifisert telefonsignal.

Kundens SMS-kvittering er lagret på selve bestillingen i
`/orders/{orderId}/smsReceipts/accepted` med `state:accepted`,
`provider:Traccar` og `sentAt`. Dette betyr **godtatt av Traccar Cloud**,
ikke at Android faktisk sendte meldingen eller mottakeren fikk den.
`js/data.js` bevarer og synkroniserer dette feltet i eksisterende
ordrestrøm uten et ekstra SMS-receipts API. E-post og Epson er separate.

**Fjernet fra GitHub-kilden:** `api/sms-status.js`,
`api/sms-receipts.js`, `tools/sms-gateway-monitor.html`,
Apps Script `doGet()` for den utgåtte Vercel-proxyen og det allerede
utførte engangsverktøyet `syncRecentSmsReceiptsToFirebase()`.
En eldre, distribuert Vercel-instans eller Apps Script-webapp slettes
ikke automatisk når filer fjernes fra GitHub. Det tidligere
`/smsDeviceHeartbeat`-feltet i Firebase påvirker ikke admin
og kan gjennomgås separat i databasen — ikke slett levende data ukritisk.

**Eksperimentell Firebase Functions-variant:** `functions/index.js`
har en separat SMS-trigger for Firebase-prosjektet `bestill-19`,
mens denne `demo/` bruker `kol-grill-pizza` som database.
Deploy/enable **ikke** begge senderne uten en særskilt gjennomgang.
`functions/sms-core.cjs` brukes også av `functions/email.js` og må
derfor ikke slettes som en «SMS-dublett». Vi har ikke bekreftet hva
som eventuelt er deployet utenfor GitHub.

**Driftstest:** Åpne `/demo/admin.html`, kontroller den gule
SMS-automatisering LIVE-indikatoren, godta én ny testordre og sjekk
Apps Script-loggen, Traccar-godkjenning og faktiske SMS på mottakertelefonen.
En telefon som mister internett kan ikke registreres sikkert med
**kun** Firebase og en Google Apps Script-poll; for automatisk
telefon-online/offline kreves et autentisert signal fra SMS-telefonen
eller dokumentert Traccar API. Målet er å unngå falskt grønt lys.

**RTDB-sikkerhet:** Offentlige REST-skrivinger kan forfalske
`smsHealth` og `smsReceipts`. Tilgang bør sikres med pålitelig
serveridentitet før full produksjonsbruk; ikke legg hemmeligheter på
GitHub eller gjør `smsHealth` åpent skrivbart bare for å få grønt lys.

## Ordrebekreftelse og kundesynkronisering

Restauranten viser først «Godtatt» når Firebase-bekreftelse er mottatt.
Ved feil viser admin en melding og kunden forblir på ventestatus;
kundens bekreftelsesdialog kontrollerer sin egen ordre, og et SSE-signal
oppdaterer både kunde og admin. Ikke gjør disse kritiske skrive- og
sync-funksjonene om som del av SMS-oppryddingen.
