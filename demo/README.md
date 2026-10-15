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
| Tester | `tests/` | Kontroll av ordre, handlekurv og logikk |
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
- Andre sider i rotmappen (`gavekort`, `Timelister` osv.) er separate og kan ha egne brukere.

## Arbeidsrutine

1. Endre bare nødvendige filer i `demo/`.
2. Oppdater cache-versjonsparameteren i `admin.html` eller `index.html` når JS/CSS endres.
3. Kjør `node demo/tools/audit-references.mjs`.
4. Test både mobil/Android og desktop, samt Epson-utskrift ved skriverendringer.
5. Push til `main`. Behold eksisterende `/demo/`-URL-er.
6. Ved behov: gjenopprett en gammel fil fra `backup-before-demo-cleanup-20261015`.


## KØL-tillegg samlet i /demo (uten å endre de andre prosjektene)

| KØL-verktoy | Gjeldende fil | Tidligere nettadresse |
| --- | --- | --- |
| Ansatt-timelister (lokal utskrift) | `tools/Timelister.html` | `/Timelister.html` (videresendes) |
| Kundens gavekort | `gavekort/index.html` | `/gavekort.html` (videresendes) |
| Administrasjon av gavekort | `gavekort/admin.html` | `/gavekort-admin.html` (videresendes) |
| Privat bildefunksjon til Epson | `tools/PrivatPrinter.html` | `/PrivatPrinter.html` (videresendes) |

**Andre prosjekter og nettsteder er urørt.** `api/` må ligge i repo-roten for Vercel API-rutene, og `functions/` er kildekatalogen i `firebase.json` for Firebase Functions. Flytting av disse uten ny distribusjonskonfigurasjon ville ødelegge eksisterende endepunkter, så de forblir i rotnivå. `CNAME`, `index.html` og `img/` trengs fortsatt av nettstedets hovedside. Ingen SMS-, e-post-, databaser- eller ordrelogikk ble endret i denne samlingen.
