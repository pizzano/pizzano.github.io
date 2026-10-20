# BETA — yeniden kullanılabilir online bestilling

Dette er en **ny, separat kundeapp** under /BETA/. DEMO-kode er ikke kopiert hit og ingen filer i `demo/` er endret.

## Åpne
- https://bestill.online/BETA/index.html
- Inngang: `BETA/index.html`
- Utseende: `BETA/css/app.css`
- UI/kurv/bestillingssteg: `BETA/js/app.js`
- Profil/kurv/preview-bestillinger: `BETA/js/store.js`
- Firebase-katalogadapter: `BETA/js/catalog.js`
- Restoran og datakilde: `BETA/js/config.js`

## Firebase / økonomi
Denne BETA-versjonen leser **den virkelige DEMO-menyen** fra:
`https://kol-grill-pizza-default-rtdb.firebaseio.com`

Offentlige felter brukt:
- `updatedAt` (lite versjonsnummer)
- `sections` (kategorier og produkter)
- `optionGroups` (valg, tillegg og regler)
- `allergenCatalog`
- `popularItemIds`
- `siteSettings` (restaurantens navn, logo, tider og kontakt)
- `settings` brukes bare dersom `siteSettings` mangler.

**BETA leser aldri `/orders`, `/pizzaBonus`, `/emailHealth` eller hele `/.json`.**
BETA oppretter ingen Firebase-lyttere for kunden, og setter ikke opp egen minuttsvis SMS-/e-post-polling.
Den beholder lokal katalogkopi og kontrollerer `updatedAt` høyst hver femte minutt per aktiv fane. Hvis versjonen er uendret, lastes ikke menyen på nytt. Ved nettfeil kan siste menykopi vises. Før bestilling i en ekte produksjonsversjon må backend alltid kontrollere nyeste priser, utsolgt-status og åpningstid.

## Viktig: forhåndsvisning
`config.mode='preview'`. Handlekurv, produkter, ingredienstilpasning, størrelse, valg, profil, favoritter, pizzabonusvisning, checkout og testbestillinger kan prøves lokalt.

**Testbestillinger sendes IKKE til restauranten eller DEMO Firebase.** De lagres lokalt i nettleseren. Det sendes **ingen SMS, e-post eller kjøkkenutskrift**. Pizzabonus er kun en lokal eksempel-/testteller og kan ikke brukes som virkelig lojalitetssaldo.

Før live oppstart trengs en **egen backend** for sikre nye ordrer, ordresporing, serververifiserte priser og bonus, samt restaurantinnlogging og de eksisterende SMS-/epost-/printerintegrasjonene. Kundens nettleser skal aldri ha skrivetilgang til vilkårlige priser, saldo eller andres ordre. Ikke sett BETA direkte i produksjon med den åpne DEMO-databasen.

## Ny restaurant
1. Opprett eget databaseprosjekt eller sikkert tenant-avgrenset område for offentlig meny.
2. Endre `tenantId`, `menu.databaseUrl` og `menu.basePath` i `config.js`.
3. Menyens `sections`/`optionGroups`-format beholdes. Ingen produkter ligger hardkodet i HTML/JS.
4. Bruk egne logoer, telefon, åpningstider og profil fra restaurantens offentlige Firebase-felter.
5. Konfigurer en sikker API for ordre, og aktiver først da produksjonsmodus.
6. Test egne Firebase Rules, særlig skille mellom offentlig meny og private ordre-/bonusdata.

## QA
- Meny, bilder og valgmuligheter kommer fra gjeldende Firebase, ikke hardkodede eksempelprodukter.
- Bytt størrelse og obligatoriske/valgfrie tillegg i produktpanelet.
- Rediger, fjern og endre antall varer i handlekurven.
- Lagre navn, telefon og valgfri e-post.
- Velg «Snarest» eller hentetid (innenfor åpningstid).
- Testbestilling viser eksplisitt at den ikke ble sendt til restauranten.
- Under nettverksfanen: kontroller at rot `/.json` og `/orders.json` aldri åpnes fra BETA.
- Bekreft at demo bestillinger/varsler ikke påvirkes.

Designet er basert på skjermbilder fra den tidligere DEMO-kundeopplevelsen, men kildekoden er selvstendig.
