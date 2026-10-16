# BETA — målarkitektur

## Prinsipper

1. DEMO og BETA har separate filer, tester og utgivelsesløp.
2. Forretningsreglene i `src/domain` skal være rene funksjoner.
3. All I/O bak navngitte adaptere i `src/data`.
4. UI skal ikke kjenne Firebase-adresser eller SMS-/e-post-tokens.
5. Ingen kunde kan lese andre kunders ordrer eller personaloperasjoner.
6. Admin og kjøkken skal motta nye ordrer umiddelbart via avgrensede,
   autoriserte lyttere.
7. Ingen «sendt»-merke uten betrodd, lagret provider-aksept.
8. Eksterne hendelser skal være idempotente.

## Fase 1 (nå)

```
Customer UI ─┬─> src/domain/cart.js ────┐
             └─> src/domain/orders.js ──┼──> src/data/mock-db.js
Admin UI ────────> src/domain/orders.js ─┘     └─> localStorage
```

- `BETA_CONFIG.mode = 'local-only'`
- Ingen Firebase, e-post, SMS, printer eller ekstern betaling.
- Begge sider kan kommunisere via samme nettlesers localStorage.
- Testmenyen er ikke identisk med produksjonsmenyen.

## Planlagt data- og serverarkitektur (ikke aktivert)

```
Kunde  →  autentisert API / bestillingskapabilitet
                    │
                    ├─> meny / priser: cachet versjon + sanntidsoppdatering
                    ├─> ordrer: bare egne ID-er, lesetoken og begrensede felt
                    └─> betrodd validering av pris og reservasjon
                                 │
                                 ▼
                       Firebase Realtime Database
                                 │
         Restaurantadmin (personalisert innlogging og rollebaserte regler)
                                 │
         Interne integrasjoner: én SMS-bekreftelse; to e-posthendelser;
         Epson på lokalt restaurantnett; sikre hendelseskvitteringer
```

### Første sikre datakontrakter

- `menuVersion`: kort, cachebart revisjonsstempel.
- `menu`: katalog og innstillinger uten private opplysninger.
- `orders/{id}`: kan bare opprettes/leses av autorisert aktør;
  servervaliderte priser, status og tidsstempler.
- `orderReceipts/{id}`: servereide e-post/SMS-kvitteringer.
- `orderArchive/{id}`: idempotent, verifisert arkiv.
- `loyalty/{customerId}`: autentisert per-kunde lojalitet med
  atomiske poenghendelser.

Dette er et **designforslag**, ikke eksisterende Firebase-regler.
Sikkerhetsregler og tjenestevalg skal dokumenteres og testes før integrasjon.

### Kompatibilitetsporter

Meny → valg & tillegg → handlekurv & pris → kundekontakt →
ordrebekreftelse & kjøkkentid → klare/utleverte ordrer →
SMS/e-post → pizza bonus → Epson → arkivering → driftstest.

Behold en stabil DEMO hele veien. Ikke bytt `bestill.online`
til BETA før alle porter er grønne.
