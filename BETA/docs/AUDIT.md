# DEMO-kildeanalyse — 17.10.2026

Kilde: `pizzano/pizzano.github.io`, `main`, commit
`54f49aaf391afac3d53c6105bb9fbf410edaa295`.

## Inventar

Git-treet inneholdt **46 DEMO-filer** på til sammen ca. **1,50 MB**;
tekst- og kildefiler utgjør ca. **0,91 MB**, resten hovedsakelig bilder og lyd.
Alle DEMO-kildefiler og relaterte `api/`-/`functions/`-kilder ble
kartlagt. Binære bilder/lyd ble inventarført, ikke tolket som kildekode.

| Gruppe | Innhold og avhengigheter |
| --- | --- |
| `demo/index.html` / `customer.js` | Kundemeny, kategorier, valg, handlekurv, kontakt, profil, favoritter, eget ordrestatusbilde. |
| `demo/admin.html` / `admin.js` | Meny, valggrupper, innstillinger, ordre, tidsbekreftelse, printer, SMS-kontroll og varsling. |
| `demo/js/data.js` | ~2000 linjer. Menymodell, beregninger, åpningstider, Firebase REST/SSE, ordre, lojalitet og statusfunksjoner i ett modul. |
| `demo/css/` | 13 separate stilark; `customer.css` ~89 KB, `order-taking.css` ~45 KB; overstyringer og mange `!important`-regler. |
| `demo/js/order-printer.js` | Epson ePOS rasterisering, HTTP/SOAP og kjøkkenkvittering. |
| `demo/js/loyalty.js`, `loyalty-sync.js` | Gratispizza og godkjente poeng per telefonnummer. |
| `demo/js/orders-archive.js` | Beholder de nyeste 100, verifiserer arkivkopi før sletting og beskytter nylig avsluttede ordrene. |
| `demo/js/install.js`, `theme.js`, `shop-info.js` | Profil-/kontaktpersistens, tema og butikkinfo. |
| `demo/js/order-confirmation.js` | Bekreftelsesfrist; automatisk tidutløp er ikke manuell «klar for henting». |
| `demo/integrations/google-apps-script/` | SMS via Traccar og e-post via MailApp. GitHub er kun referansekopi; live Apps Script må oppdateres separat. |
| `api/sms-status.js`, `api/sms-receipts.js` | Vercel-endepunkter for SMS-helse og bekreftet SMS-kvittering. |
| `functions/` | Separate Firebase Functions for `bestill-19`; må ikke forveksles med DEMOs `kol-grill-pizza`-database. |
| `demo/service-worker.js`, manifest, icons, audio | App-cache, installasjon, ikoner og ordrelyd. |
| `demo/tools/`, `test-printer.html` | Referanseaudit, konvertering og Epson-hjelpeverktøy. |

## Risikoer å løse før produksjon

1. **Sikkerhet først.** Eksisterende nettleserklient bruker Firebase
   REST. Offentlig `.read`/`.write` kan eksponere kundedata, tillate
   falske statusendringer og falske «SMS/e-post sendt»-kvitteringer. BETA
   må aldri arve åpne regler.
2. **Tillitsgrenser.** Kjøp, totalbeløp, pris, gratispizza og statusmålinger
   må valideres på en betrodd server; DOM er ikke autoritativ.
3. **Modulkobling.** `data.js` binder mange separate domener sammen.
   Del i meny, priser, ordrer, lager/synkronisering og integrasjoner.
4. **Firebase-kvote.** REST/SSE-abonnement må være målrettet, med
   kundespesifikke, autoriserte ordrekanaler. Unngå dobbel oppstartslast.
5. **100 ordrer er et mål, ikke en hard grense.** Aktive ordrer og
   72-timers varslingssikkerhet bevares. Arkiv må kopieres/verifiseres
   før sletting; egen vedlikeholdsjobb bør ikke kreve åpen adminfane.
6. **SMS/e-post.** SMS kun én ordrebekreftelse med hentetid,
   mens e-post skal sendes ved `bekreftet` og manuell `klar`.
   Registrer faktisk leverandøraksept, skille den fra levering.
   Ingen blind resend etter usikker nettverkstimeout.
7. **Epson.** Printer kan ligge på restaurantens LAN. Direkteutskrift
   krever eksplisitt opt-in og fysisk printertest.
8. **Stilgjeld.** `customer.css`, `customer-theme.css` og
   `theme.css` inneholder mange overstyringer/`!important`.
   BETA starter med tokens og én liten basefil.
9. **Unngå falske visninger.** Ingen grønn servicebadge uten ferskt,
   verifisert datasignal. Fallback, timeout og offline må vises tydelig.

## Migreringsstrategi

Bygg ikke nye funksjoner ved å kopiere hele `customer.js`, `admin.js`
eller `data.js`. Bruk dem som kravspesifikasjon; test hver funksjon
mot DEMO før den gradvis kobles på nytt datalag.

**Ingen eksisterende DEMO- eller integrasjonsfiler er endret i denne fasen.**
