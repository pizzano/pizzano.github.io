# BestillOnline – ordreinnboks, uten Cloud Functions

## Oppsett

- **Kundeside:** `BETA/index.html`. Nye bestillinger sendes til `/ORDERS/{ordreId}`.
- **Mottak:** `BETA/orders.html`, med separat `BETA/admin/orders.css` og `BETA/admin/orders.js`.
- **Regler:** `BETA/database.rules.json` åpner bare anonym *oppretting* av nye ordrer. Kun administrator har tilgang til privat innhold og statusendringer.
- **Kundestatus:** `/ORDERS/{ordreId}/statusPublic` er lesbar med ordrenummerets tilfeldige ID. Den inneholder bare status, tidspunkt og eventuelt avvisningsårsak. Kundesiden lytter med én Firebase REST SSE-strøm, tilsvarende `onValue`: første verdi og deretter bare endringer. Den leser ikke hele ordren.

## Før ekte kundebestillinger

Github Pages distribuerer **ikke** Firebase-regler. Før kundeinnsending kan fungere, må de oppdaterte reglene publiseres i riktig Firebase-prosjekt. Ta først kopi av gjeldende regler i Firebase Console, sjekk dem mot `database.rules.json` og behold øvrige eksisterende tillatelser.

Fra mappen `BETA` i PowerShell:

```powershell
firebase login
firebase deploy --project kol-grill-pizza-1 --only database
```

**OBS:** Denne kommandoen erstatter gjeldende Firebase-regler med filen. Ikke kjør den uten å sammenligne med live-regler først. Alternativt: slå sammen `ORDERS`-reglene manuelt i Firebase Console → Realtime Database → Rules og trykk Publish.

## Ordreflyt

- Kunde sender én ny `ORDERS/ord_<timestamp>_<tilfeldig>` med `status=mottatt`. Ved mislykket innsending beholdes handlekurven.
- Administrator åpner mottaket og ser tre faner: **Alle, Pågår, Klar**.
- Administrator godtar med 1–99 minutter (`godkjent`), avviser med grunn (`avvist`) eller markerer ferdig (`klar`). Et ETag-betinget PUT skriver bare valgt ordre, inklusive `statusPublic`, atomisk.
- Kunden får første status og senere oppdateringer fra én vedvarende SSE-forbindelse. Fanen stanser forbindelsen når den ikke er synlig eller status er endelig.
- Trykk på ordre for detaljer; klar kan markeres ved å sveipe til venstre og trykke den grønne Klar-handlingen.

## Maksimalt 100 lagrede ordrer – uten Cloud Functions

Mottaket lytter til siste 101 ordrenøkler. Hvis antallet blir større enn 100, leser det **kun nøklene** via `shallow=true`, og sletter gamle poster samlet. Det kjører ved ny livehendelse eller når mottaket åpnes, ikke kontinuerlig.

**Viktig begrensning:** Hvis mottaket er lukket, kan databasen midlertidig ha mer enn 100 ordrer. Overskytende poster fjernes neste gang mottaket er åpent. Det finnes ingen serverbasert opprydder i dette oppsettet.

Automatisk sletting kan være uegnet for arkiv-, bokførings- og dokumentasjonskrav. Bruk dette som arbeidskø, ikke som regnskapsjournal.

## Test før produksjon

1. Publiser reglene; åpne `orders.html` som innlogget admin.
2. Send én prøvebestilling fra kunden med testtelefonnummer.
3. Verifiser at ordren kommer opp under **Alle**, godta med for eksempel 20 min.
4. Verifiser at kunden ser `Bestillingen er godkjent` og forventet hentetid uten å oppdatere siden.
5. Marker `Klar`; verifiser både admin og kunde.
6. Test avvisning, to samtidige ordrebehandlere og 101 → 100 rydding i testdatabase.

**Ikke implementert her:** SMS/e-post, automatisk utskrift, betaling, Cloud Functions eller andre utvidelser.
