# KØL Grill & Pizza — BETA

Ny, selvstendig implementering av kundesiden. **Ingen kildefiler kopiert fra DEMO.** Eksisterende `/demo/` er urørt.

## Fase 1: Kundeapp

- `index.html`: ny struktur for mobil og desktop.
- `css/site.css`: ett nytt designsystem basert på DEMO-opplevelsens kompakte struktur og fargepalett, men uten å kopiere CSS. Ingen CSS-overstyringskjede, eksterne fontfiler eller font-CSS-forespørsler.
- `js/app.js`: meny, størrelser/tilvalg, ingrediensvalg, kurv, kontakt og hentetid.
- `tests/check.mjs`: statisk kontroll av egne filer og koblinger.

### Sikker BETA-forhåndsvisning

BETA leser menykatalogen fra samme Firebase Realtime Database som DEMO, men **skriver ingenting til Firebase**. Kundeopplysninger og handlekurv ligger bare lokalt i nettleseren. Siste steg viser kun en forhåndsvisning; det opprettes ingen ordre og ingen SMS/e-post sendes.

**Ikke bruk denne BETA-siden for ekte kundebestillinger før neste faser er implementert og testet.** Ingen `admin.html` er opprettet ennå.

### Firebase-forbruk

- Ingen `onValue`/SSE-strøm bare fordi en kunde åpner menyen.
- Ved besøk: liten `updatedAt`-sjekk; last full meny ved manglende cache eller ny versjon. For gjeldende rotbasert meny brukes **6 lesinger ved kald start (1 versjon + 5 offentlige menyfelt)** og **1 versjonslesing ved varm start** i syntetiske tester. Dette er antall requests, ikke fakturert datatrafikk.
- Menysnapshot lagres under egne BETA-nøkler i `localStorage`. Gamle snapshots kan brukes offline mens databasen ikke er tilgjengelig.
- Ved nytt fokus sjekkes versjonen tidligst etter fem minutter; ingen fast polling i kundegrensesnittet.
- Ingen `/orders`-lesing eller `/orders`-lytting for besøkende.
- Kategori-navigasjon, favoritter, søk, tema, endringer i kurven og produktmodal utføres lokalt og utløser ingen Firebase-lesinger.
- Størrelses- og tilvalgspris regnes i nettleseren i forhåndsvisning. Senere reelle ordrer krever server-side validering.
- En neste versjon kan innføre målrettet live-sporing bare etter opprettet ordre.

### Endringer som kommer senere

1. Ferdigstille kundedesign, tilgjengelighet og eventuelle menyregler/lojalitet.
2. Implementere en **egen** BETA admin med live bestillinger og utskrifter.
3. Utforme separate BETA ordrebaner, autorisasjon og server-side kontroll av priser og lojalitet; beskytte personopplysninger.
4. Først deretter integrere og verifisere SMS/e-post og ekte ordre, uten dobbelsending.
5. Endelig testing av mobil, ytelse, felles ordrestatus, henting og drift før BETA vurderes for bruk.

Dette er en ny arkitektur, ikke en kopiert DEMO-admin eller aktivering av DEMO sin ordreautomatisering.

## Utviklerkontroll

```sh
node BETA/tests/check.mjs
```

BETA kan åpnes som statiske filer via GitHub Pages på `/BETA/index.html`. Nettstedets tilpassede domene/distribusjon må kontrolleres før adressen annonseres. Statisk kontroll og mock-kjøring av menylesing og kurv er gjennomført; reell mobilvisning, hosting og faktisk Firebase-forbruk er foreløpig ikke verifisert.

NB: Firebase RTDB-regler som tillater offentlige skriverettigheter må sikres før produksjonsbruk, uavhengig av at BETA akkurat nå er lesebasert.
