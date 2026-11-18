# BestillOnline – mottak av bestillinger

## Filer og sider

- Kunde: `BETA/index.html` – sender nye bestillinger til `/ORDERS/{id}` i Firebase RTDB.
- Mottak: `BETA/orders.html` med separat `BETA/admin/orders.css` og `BETA/admin/orders.js`.
- Eksisterende menyadmin: `BETA/admin.html`.
- Firebase-regler: `BETA/database.rules.json`.
- Serverbasert lagringsgrense: `BETA/functions/index.js`.

## Må publiseres før faktiske bestillinger kan mottas

Kode i GitHub distribuerer **ikke** Firebase Database Rules eller Cloud Functions. **Ikke test ekte innsending før reglene er distribuert.** Før reelle bestillinger aktiveres, gå gjennom reglene og distribuer dem til riktig Firebase-prosjekt.

Fra prosjektmappen `BETA`:

```powershell
firebase login
cd functions
npm install
cd ..
firebase deploy --project kol-grill-pizza-1 --only database,functions
```

Cloud Functions kan kreve Firebase Blaze-plan. Ingen tjenestekonto-/passordfiler skal legges i GitHub.

## Firebase-format

```
ORDERS/
  ord_1794960000000_a1b2c3d4e5f6/
    id, name, phone, email?, status, createdAt,
    pickup, items, total, currency, ...
```

**Status:** `mottatt` → `godkjent` (1–99 minutter) → `klar`; eller `mottatt` → `avvist` med grunn.

**Tilgang:** Anonyme kunder kan bare *opprette* et nytt, gyldig ordre-ID. De kan ikke lese, endre eller slette eksisterende bestillinger. Administrator må være logget inn for å lese og oppdatere status. Kundedata (navn, telefon og e-post) er ikke offentlig tilgjengelig via `/ORDERS`.

## Hvordan det spares Firebase-data

- Admin bruker **én SSE-strøm** med `orderBy="$key"&limitToLast=101`, og viser høyest **100** bestillinger. Ingen periodisk polling.
- Godkjenn, klar og avvis endrer **kun valgt bestilling** med betinget ETag-PUT, ikke alle 100.
- Kunden sender **én ordre**. Ved feil beholdes handlekurven.
- Opprydding leser bare **ordrenøkler** (`shallow=true`) og sletter gamle poster samlet med en databaseoppdatering.
- Admin gjør i tillegg opprydding når panelet er tilkoblet, men dette er **ikke en garanti** når panelet er lukket.
- En deployert Firebase Function håndterer opprydding også uten åpen admin. Etter distribusjon beholdes maksimalt de **100 nyeste** bestillingene (kan være kortvarig flere mens hendelsen behandles).

## Viktige begrensninger

1. `/ORDERS` er nytt og skiller mellom store/små bokstaver. Det gamle `/orders`-området endres ikke.
2. **Ikke slett alle 100 før rapportene er arkivert** hvis det finnes regnskaps-/dokumentasjonskrav. Dette er kun en arbeidskø med automatisk sletting, ikke en fullverdig regnskapsjournal.
3. Godkjenning og avvisning oppdaterer Firebase-status. SMS, e-post, skriver og push-varsler er **ikke koblet til dette nye skjermbildet**.
4. Kundesiden bekrefter at innsendingen lykkes, men følger ikke automatisk senere statusendringer.
5. Det finnes ingen betalingsintegrasjon i dette ordreinnsendingsløpet.
6. Før produksjon: test en ordre, flere samtidige ordrer, statusendringer og 101 → 100 opprydding med en egen testdatabase.
