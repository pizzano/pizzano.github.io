# BETA — yeniden kullanılabilir online bestilling

Dette er en **ny, separat kundeapp** under /BETA/. DEMO-kode er ikke kopiert hit og ingen filer i `demo/` er endret.

## Åpne
- https://bestill.online/BETA/index.html
- Inngang: `BETA/index.html`
- Utseende: `BETA/css/app.css`
- UI/kurv/bestillingssteg: `BETA/js/app.js`
- SVG icon set: `BETA/js/icons.js`
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
`config.mode='preview'`. Handlekurv, produkter, ingredienstilpasning, størrelse, valg, profil, restaurantinformasjon, pizzabonusvisning, checkout og testbestillinger kan prøves lokalt.

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

## Kunde-UI scroll og tema (2026-10-20)
- `main#mainContent` er egen vertikal scroll-container. Profil, kurv, kontakt og hentetid kan rulles helt ned uavhengig av topp- og bunnfeltet.
- Produktsheet og restaurantinformasjon har egen `.sheet-scroll`, med modal-heading og produkthandling på plass. Innholdet kan rulles også på korte mobilskjermer.
- Kategorimenyen har en ekte horisontal indikator, knyttet til rulleposisjonen. Indikatoren kan klikkes og navigeres med piltaster.
- Restaurantens navn i headeren går til menyen. Restaurantinfo åpnes med `i` ved Åpent/Stengt-status.
- Pizzabonus bruker mindre ring og kompakt, mørkegrønt design. Kurv har ikon for søppelbøtte.
- Fire semantiske fargetema: `reference`, `lively`, `fresh`, `gourmet` (og mørk variant). Alle sentrale UI-flater bruker CSS custom properties; valget tas fra `siteSettings.customerPalette` i Firebase eller fra `BETA/js/config.js` ved manglende verdi.
- CSS og JS lastes med `20261020-beta2` for å unngå blanding av gamle moduler etter publisering.

## Oppdatering: kategorier og kompakt kurv
- Kategoriene er fortsatt hentet fra Firebase `sections`. Ingen kategorier eller priser er hardkodet.
- Ikoner vises som ekte SVG via et trygt sett i `BETA/js/icons.js`, basert på samme symboler som tidligere DEMO.
- Hver Firebase-kategori kan få sitt eget valgfrie `iconKey` (alternativt `icon`, `iconName`, `iconType`). Eksempel: `"vegetarian"`. Lovlige ikoner: `pizza`, `kebab`, `burger`, `meal`, `drink`, `children`, `vegetarian`, `popular`. Uten felt velges passende ikon automatisk fra kategoritittelen. Den framtidige BETA-adminen kan skrive `iconKey` direkte til kategorien i Firebase og oppdatere `updatedAt`. Utrygge SVG-strenger fra databasen blir aldri kjørt.
- Søkefanen bruker også SVG-lupe; kategoristrek og aktiv kategori følger scroll.
- «Mine favoritter» (inkludert hjerte og lokal favorittfunksjon) er fjernet. Profilen viser i stedet «Restaurantinformasjon» med data fra Firebase og åpner detaljvinduet.
- Kurven bruker kompakte varekort, synlige størrelser/tilvalg og tydelig sum. Alle slettinger bruker samme SVG-søppelbøtte.
- «Tøm handlekurv» er ikke synlig når kurven er tom. «Neste: Kontakt» skjules også for tom kurv. Søppelbøtten på en varelinje fjerner hele linjen, også ved antall over én. «Tøm handlekurv» krever bekreftelse.
- Menyens forhåndsvisningsbanner er fjernet. **Kundens testbestilling er fortsatt ikke en reell ordre**; dette opplyses ved testbekreftelsen.
- Endrede kundeassetter bruker `20261020-beta3` for cache-invalidering.
