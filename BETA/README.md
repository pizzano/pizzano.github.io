# KØL Grill & Pizza — BETA (fase 1)

**Ikke produksjon.** Et nytt, isolert fundament skrevet fra bunnen av.
Dette er *ikke* en kopi av DEMO og er ikke klar for ekte kundeordrer.

## Åpne lokalt / GitHub Pages

- `BETA/index.html`: kundevisning, prøveprodukter, størrelse, handlekurv,
  kontaktfelt og lokal testbestilling.
- `BETA/admin.html`: lokal restaurantvisning, statusflyt
  `mottatt → bekreftet → klar → fullfort` eller avvisning.
- Alt lagres i samme nettleser under `kol:beta:v1:*` via localStorage.
  Åpne begge sidene under samme origin (f.eks. GitHub Pages) for å teste
  statusoppdateringer mellom faner. Dette er **ikke** synkronisering mellom
  forskjellige enheter eller nettlesere.
- Appen har ingen nettverkskode, Firebase URL, SMS- eller e-post-API, og
  den skriver ingenting til `/demo`, `/api` eller `/functions`.

Kjør domeneenhetstestene med `npm test` i `BETA/` (Node.js >=20).
Ingen avhengigheter må installeres for å kjøre nettleserprototypen.

## Første milepæl: fullført

1. DEMO-kildekart og risikoanalyse — `docs/AUDIT.md`.
2. Ny modulstruktur og arkitekturvalg — `docs/ARCHITECTURE.md`.
3. Isolert kundemeny og mock restaurantbestillinger.
4. Domeneenhetstester — `tests/domain.test.mjs`.

## Ikke ferdig ennå

Ekte menydata, tilvalg, fjern ingredienser, kommentarer, valgte hentetider,
favoritter, profil, pizza-bonus, ekte ordrebehandling, sikker Firebase-adgang,
verifisert SMS og e-post, printer/Epson, ansattstyring og driftsmonitorering.

**Ikke aktiver betaling, Firebase eller varslingsintegrasjoner ved å lime
inn DEMO-konfigurasjon.** Sikker arkitektur og ende-til-ende tester skal
godkjennes først. Se `docs/MIGRATION-CHECKLIST.md`.

## Filkart

```text
BETA/
  index.html               Kundevisning (mock)
  admin.html               Restaurantvisning (mock)
  css/app.css              Felles, enkel stylestruktur
  src/config.js            Låst lokal testmodus
  src/data/catalog.js      Prøveprodukter
  src/data/mock-db.js      Isolert localStorage-tilgang
  src/domain/cart.js       Handlekurv og beløp
  src/domain/orders.js     Testordre og lovlige statusoverganger
  src/shared/format.js     NOK/tid/HTML-escaping
  src/customer/main.js     Kundegrensesnitt
  src/admin/main.js        Restaurantgrensesnitt
  tests/domain.test.mjs    Domeneenhetstester
  docs/                    Analysedokumenter
```

## Trygghet

- DEMO er uendret og fortsetter separat.
- Ingen ekte kundemeldinger sendes fra BETA.
- En grønn «sendt»-status for SMS/e-post vil bare bli implementert når en
  betrodd server har lagret faktisk leverandøraksept — aldri ved å gjette
  ut fra ordrestatuser.
- Ettersom GitHub Pages er offentlig, skal ingen ekte personopplysninger
  legges i BETA-testbestillinger.
