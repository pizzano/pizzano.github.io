# KØL Grill & Pizza — /demo

Dette er **den gjeldende bestillingsappen**, ikke prototypen fra den gamle `/test`-mappen.

## Kart over filene

| Del | Plassering | Formål |
| --- | --- | --- |
| Kundeapp | `index.html` | Nettbestilling og ordresporing |
| Restaurantapp | `admin.html` | Bestillinger, produktmeny, restaurant- og printerinnstillinger |
| Privat skriver | `tools/PrivatPrinter.html` | Lokale bilder → 576-pikslers Epson-bitmap; bilder lastes ikke opp |
| Firebase URL | `config.js` | Database-adressen for bare /demo |
| Synk / ordre / lagring | `js/data.js` | Felles data, bestillinger og innstillinger |
| Kunde-UI | `js/customer.js` | Kundehandlinger, handlekurv, ordreflyt |
| Admin-UI | `js/admin.js` | Bestillingsliste, godkjenning, meny, printerinnstillinger |
| Epson ePOS | `js/order-printer.js` | 80 mm bildekvit., forhåndsvisning og printerstatus |
| Små delte moduler | `js/cart-order.js`, `js/loyalty.js`, `js/palette.js` m.fl. | Aktiv logikk importert av kunde eller admin |
| Design | `css/` | Aktive stilark. Ikke slett én CSS bare fordi den har få regler |
| Ikoner | `icons/` | Brukt appikon (`kol-icon-192.png`) og restaurantikon (`restaurant.svg`) |
| PWA | `manifest.webmanifest`, `service-worker.js` | Installering, mellomlagring og nettverksoppførsel |
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
- SMS og e-post kjøres av separate Google Apps Script-prosesser. Å endre kildekopiene på GitHub oppdaterer **ikke** de aktive Google Apps Script-prosjektene.
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
| Privat Epson-bildeutskrift | `tools/PrivatPrinter.html` | `/PrivatPrinter.html` (videresendes) |

**Gavekort er et separat prosjekt.** Både `/gavekort.html` og `/gavekort-admin.html` ligger i rotmappen med sine originale filer. Det finnes ingen `demo/gavekort/`-kopi.

Ubrukte Vercel SMS-ruter i `api/` og den separate eksperimentelle Firebase Functions-kildemappen `functions/` er fjernet fra GitHub. Rotfilen `firebase.json` ble også fjernet fordi den kun konfigurerte denne utdaterte `functions/`-mappen. Dette endrer **ikke** allerede deployede Firebase Functions utenfor GitHub.

Automatiske testskript som tidligere lå i `demo/tests/` er tatt ut av hovedgrenen for å rydde opp. De kan gjenopprettes fra `backup-before-removing-demo-tests-20261015`. Den gamle, separate `test-printer.html`-siden er allerede fjernet. Aktiv Epson-test/tilkoblingskontroll er i `js/order-printer.js` og restaurantpanelet.

## Kundens lokale lagring — fire nøkler (2026-10-24)

Kundesiden lagrer bare disse fire nøklene i LocalStorage:

- `bestill_cart_v2`: uferdig handlekurv
- `bestill_profile_v2`: navn, telefon, valgfri e-post, favoritter, tema,
  kontaktutkast og et kortvarig sett med klare/avviste ordre-notiser
- `bestill_orders_v2`: høyst **fire** nylige ordre for gjenfinning,
  sanntidssporing og `Bestill samme igjen`
- `kol_show_allergens_v1`: om allergener vises i menyen

Menykatalogen (`sections`, `allergenCatalog`, `optionGroups` osv.) hentes fra
Firebase. `bestill_menu_state_v3` slettes ved neste oppstart, og ingen ny
menykopi skrives til LocalStorage. Uten nett og uten lastet meny må kunden
koble seg til Firebase før menyen kan vises. Firebase er fortsatt kilde for
alle ordre og menyoppdateringer.

Første gang den nye kundeappen åpnes, flyttes eksisterende
`bestill_checkout_contact_v2`, `kol_ready_seen_v1`,
`kol_rejected_seen_v1` og `kol_ready_notified_v1` til profilen
før nøklene slettes. `kol_theme_v1` flyttes til samme profil av `theme.js`.
Den gamle kontaktlagrings-scriptfilen `js/install.js` er fjernet.
Admin har egne lokale preferanser (liste-/rutenettvisning og lyd), som
ikke er en del av kundesidens fire nøkler.

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
- `getPizzaBonus()` leser `customers/{telefon}` med flate bonusfelt.
  Før gamle telefonkontoer er overført, leses `pizzaBonus/{telefon}`
  kun som en midlertidig, skrivebeskyttet historikk-fallback.
  Gratispizza reserveres under `customers/{telefon}/bonusReservations`.
- `service-worker.js` mellomlagrer bare offentlig app-skall og `/demo/`.
  API-svar og ukjente nettsider lagres ikke. Gamle cache-versjoner slettes
  ved aktivering av en ny service-worker.
- Ubrukte, gamle tekstutskrifts-hjelpere er fjernet fra Epson-modulen.
  Aktiv Canvas-bitmaputskrift og Epson-tilkoblingskontroll i restaurantpanelet er beholdt.
- Urefererte rotbilder `img/btn.png`, `img/gratis.gif`, `img/load.gif`,
  `img/logom.png` og `img/stemp.jpg` er ryddet bort fra hovedgrenen.
  Filene kan gjenopprettes fra Git-historikken.
- Viktig: delt ordre-SSE lytter fortsatt til `/orders.json`; godkjenning
  bruker ETag-beskyttet skriving på den aktuelle ordren med kontrollert
  reservevei. Disse kritiske flytene endres **ikke** som del av oppryddingen.
  Datatilgang og autentisering bør gjennomgås i en egen testet plan.


## 100 nyeste bestillinger uten arkiv (2026-10-17)

- `/orders` beholder **de 100 nyeste bestillingene**. Bestillinger eldre enn de 100 nyeste slettes **permanent** fra Firebase når de er trygt avsluttet. Det opprettes **ikke noe nytt ordrearkiv**.
- Oppryddingen ligger i `js/orders-archive.js` (eldre filnavn beholdt for kompatibilitet), og kjører **bare når restaurantens adminside er åpen/aktiv**, i bolker på inntil 12, samt ved oppstart og omtrent hvert femte minutt. Ingen 24/7-serverjobb er satt opp.
- `/orderArchive` er en gammel arkivstruktur. Adminsiden forsøker å slette denne **én gang per sideøkt** når den er tilgjengelig. Ved nettverksfeil prøver den igjen senere. Det foretas ingen ny kopiering til arkivet.
- Sikring: De 100 nyeste og alle åpne ordrer beholdes; bare `fullfort`, `avvist` eller `klar` (med `staffReadyAt`) som er minst **72 timer etter siste statusendring**, kan slettes. Dette beskytter pågående bestillinger og gir SMS-/e-postpollere tid til å lese statusendringer.
- Slettingen sjekker ordren på nytt og benytter ETag-betinget DELETE; om en ordre endrer seg underveis, beholdes den. Bekreftede kundetotaler må være registrert under `customers/{telefon}`, med gjeldende ordre-ID i `countedOrders`, før kilden fjernes.
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

- **Grønn — SMS-automatisering LIVE:** Apps Script kontrollerte Firebase nylig
  (under 3 minutter). Telefonens forbindelse og SMS-levering er **fortsatt ukjent**.
- **Rød — SMS-automatisering av/utilgjengelig:** LIVE er av,
  kontrollen er over 3 minutter gammel eller Firebase kan ikke leses.
- **Gul — status ukjent:** Ingen gyldig Apps Script-status er tilgjengelig.
  Grønn betyr aktiv Apps Script-automatisering, **ikke** bekreftet Android-nett eller SMS-levering.

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

**Tidligere separat Firebase Functions-variant:** Kilden for prosjektet
`bestill-19` (`functions/` og `firebase.json`) er nå slettet fra repoet,
da `demo/` ikke importerte eller brukte disse filene. Dette omfatter
både den gamle SMS-funksjonen og dens avhengige e-postmodul, **ikke**
den aktive Apps Script-e-postpolleren. Hvis gamle Cloud Functions allerede
er distribuert til Firebase-prosjektet `bestill-19`, vil de fortsatt kunne
kjøre og må kontrolleres/stoppes separat i Firebase-konsollen. Git-historikk
kan brukes til å hente kildekoden tilbake ved behov.

**Driftstest:** Åpne `/demo/admin.html`, kontroller den grønne
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

## Bruksbasert filopprydding (2026-10-23)

Kontrollerte kjørende innlastinger (`index.html`, `admin.html`),
JavaScript-importer, stilark, manifest, bilder, lyd og service-worker:

- Slettet ubrukt `icons/kol-icon-512.png` (ikke referert av HTML,
  webmanifest, JS, CSS eller service-worker). `kol-icon-192.png` og
  `restaurant.svg` er fremdeles i bruk og ble beholdt.
- `test-printer.html` var allerede slettet før denne gjennomgangen;
  fjerna gamle referanser i denne README-filen, Epson-kildekommentarer og
  `tools/audit-references.mjs`. Ellers ville referansesjekken meldt
  feil for en fil som ikke skal eksistere.
- **Beholdt:** alle CSS-filer som lastes av kundesiden/admin, JS-modulene
  som importeres, SMS-/e-postkildekopier, Epson-skriverlogikk, lydfil,
  PWA-filer og privat Epson-bildeverktøy med egen rotvideresending.
- **Beholdt som bevisste manuelle verktøy, ikke runtime-avhengigheter:**
  `tools/convert_globalfood.py` (framtidig meny-konvertering) og
  `tools/audit-references.mjs` (integritetskontroll). Disse lastes
  ikke av kunden, men har fortsatt en vedlikeholdsfunksjon.
- Ingen endringer i Firebase-bestillinger, SMS, e-post, Epson-kvitteringer,
  statusflyt eller CSS/HTML-layout inngikk i denne oppryddingen.

## Tre minutter uten svar: ring eller prøv på nytt (2026-10-23)

Når restauranten ikke bekrefter innen tre minutter, beholder
kundens bekreftelsesdialog lenken `Ring <restaurantens telefon>`. Den
viser også en **oransje** knapp `Prøv å bestille på nytt`.

- Mens Firebase ennå **ikke** har bekreftet automatisk avbrudd,
  er gjenta-knappen deaktivert. Kunden kan ringe med en gang.
- Når den **samme ordren** har status `avvist` med
  `confirmation_timeout` i Firebase, aktiveres knappen.
- Knappen gjenbruker den eksisterende funksjonen fra `Mine bestillinger`:
  varer, antall, størrelse, tilgjengelige tilvalg, `uten` og
  kommentar legges i handlekurven etter dagens menydetaljer.
  Utilgjengelige produkter utelates med varsel.
- Eventuell gratis pizza blir **ikke** automatisk innvilget på nytt
  fra en gammel ordre. Kunde kontrollerer bonus og oppdaterte priser.
- Ny ordre sendes **aldri** automatisk; kunde går til handlekurven,
  velger hentetid og sender en helt ny ordre med ny ID.

## Fjernet manuell utleveringsstatus (2026-10-23)

`Utlevert · fullfør bestilling`-knappen og handlingen som satte
`fullfort` er fjernet fra adminpanelet. `Klar for henting` er nå
siste manuelle kjøkkenstatus, og ingen ansatt trenger et eget utlevert-klikk.
Den generelle statusendringsfunksjonen som kunne lagre denne statusen
er også fjernet fra `js/data.js`.

**Kompatibilitet med gamle bestillinger:** Gamle Firebase-poster med
`fullfort` blir fortsatt lest riktig i historikk, pizzabonus og
opprydding. Ingen slike poster slettes eller endres av denne kodeoppdateringen.
Dette er kun støtte for gamle data, ikke en aktiv kundehendelse eller knapp.

## Bestillinger: nytt skjermoppsett og kundehistorikk (2026-10-23)

`admin.html` / `css/order-taking.css` bruker kunde først i detaljhodet,
mottattdato/klokkeslett, klikkbart telefonnummer, tydelig ny-bestilling-status
og nummererte produktkort. Det eksisterende Godta/Avvis-panelet, hentetid,
SSE/Firebase-oppdateringer, SMS/e-post og Epson er uendret.

## Smal ordre-JSON (2026-10-24)

Nye bestillinger lagres slankere i `/orders/{id}`. Restaurantens
ordreliste, kvittering, SMS og e-post bruker de samme ordreobjektene.
`submitOrder()` fjerner bare overflødige felter ved **oppretting**
av en ny ordre; allerede lagrede/aktive ordrer blir ikke endret.

- `subtotal` sløyfes kun hvis det er identisk med `total`.
  Lesekoden bruker `total` som delsumsverdi for nye, kompakte ordrer.
- `type: henting` er standard og trenger ikke lagres.
- `pickupMode` sløyfes når det kan utledes direkte av `pickup`
  (`Snarest` eller `HH:mm`). Valgt hentevalg bevares.
- På varelinjer beholdes `itemId`, `name`, `price`,
  `quantity`, `size` og `sizeId`. Valg-ID-er er én flat
  `optionIds`-liste (duplikater beholdes for 2x saus), med
  `optionDetails` for kjøkken-/kvitteringstekst og pris. Nye ordrer
  lagrer ikke den gamle nested `selections`-mappen, doble `options`,
  eller vanlig `unitPrice`. `unitPrice` beholdes kun ved særtilfeller
  der beløpet ikke kan rekonstrueres, som gratispizza.
  Rabatter, ekstra og valg med pris 0 er fortsatt synlige.
- Tom e-post, kommentar, uten-liste, bonusflag og tomme tilvalg lagres
  ikke. `normalizeOrders()` kan fortsatt lese både gammel og ny form.
- `confirmationDeadline` beregnes fra `createdAt` + 3 minutter
  og lagres derfor ikke i nye ordrer.
- `id`, `createdAt`, `status`, `statusUpdatedAt`, hentetid,
  kundekontakt, pris og nødvendige SMS-/e-postkvitteringer
  og bonusbekreftelse beholdes når de har funksjonell betydning.

Forbedringen er på antall felter og JSON-størrelse; en Firebase JSON-gren
som `lines` er fortsatt nødvendig for bestillingens produkter.
Eksisterende ordreobjekter endres ikke automatisk. Under ren testdrift
kan testordrer slettes manuelt før ny testordre. Husk at bonuspoeng og
kundetotaler ligger separat under `customers`, og at gamle testdata
fortsatt kan finnes under `pizzaBonus`; det nullstilles ikke ved å
tømme bare `orders`.

## Kunderegister — flat `customers/{phone}` (2026-10-24)

**Fast Kunde / Ny Kunde:** Norske mobilnumre normaliseres med
`loyaltyPhone()`. Admin leser `customers/{phone}/totalOrders`.
Under migrering kan en eldre `pizzaBonus/{phone}`-konto leses som
fallback; manglende tilgang vises som **Kundestatus ukjent**.

**Varige kundefelt direkte under telefonnummer:**
`name`, `email`, `totalOrders`, `totalLargePizzas`, `totalSpent`.
Telefonnummeret er allerede Firebase-nøkkelen, så `phone` er ikke
lagret på nytt. Bare bekreftede bestillinger øker tellere.
`totalSpent` er sum registrerte ordrebeløp, ikke en egen bekreftelse
på kortbetaling. Gamle manglende beløp gjettes ikke.

**Pizzabonus uten `loyalty`-mappe:** Samme telefonkonto har
`bonusCount`, `bonusCycle`, `bonusConsent`,
`bonusReservations`, `countedOrders` og `schemaVersion` som flate
tekniske felt, altså høyst 11 hovedfelt under hvert telefonnummer.
`countedOrders` er én tekststreng med ID-er til bekreftede
ordrer som fortsatt finnes i `/orders`, ikke en undermappe med
én node per ordre eller en permanent kjøpshistorikk. Versjon 3-kontoer
komprimeres trygt til versjon 4 ved neste synkronisering.
ETag-beskyttet oppdatering hindrer dobbeltelling ved
samtidige adminsynkroniseringer. Gratispizza krever fortsatt
reservering per syklus.

**Migrering:** `js/loyalty-sync.js` leser eldre
`pizzaBonus/{phone}`-opplysninger og skriver den sammenslåtte
kundekontoen til `customers/{phone}`. Kildepostene blir ikke
automatisk slettet før overføring og tilgangsregler er kontrollert.
Når admin er åpen, forsøkes historiske telefonkontoer i små puljer
hvis Firebase tillater nøkkeloppslag. Feilet migrering må prøves
igjen; tidligere `events` og `loyalty` ligger bare i den gamle grenen
og opprettes ikke i `customers`.

**Viktig før produksjonsbruk:** Denne kundeprofilen inneholder
personopplysninger og beløp. Firebase RTDB Security Rules må sikre at
kundeprofiler bare kan leses av autorisert personale (ikke av hvem som
helst med telefonnummeret). Nåværende direkte REST-basert admin/kunde-arkitektur
er **ikke** i seg selv en slik beskyttelse. Vurder egen beskyttet databasegren
og Firebase Authentication + Rules før lagring av persondata i produksjon;
dokumenter lovlig formål, lagringstid og personvernerklæring.

**Bevaring:** `js/orders-archive.js` sletter ikke en gammel bekreftet
ordre før `customers/{phone}` inneholder den flate kundetotalen og
ordrens ID er kvittert i `countedOrders`. Den gamle `pizzaBonus`
kan fjernes separat først etter kontrollert dataoverføring og backup.
Verken manglende historiske beløp eller tidligere slettede ordrer
rekonstrueres automatisk.
