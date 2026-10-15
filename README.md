# KØL Grill & Pizza — kodeoversikt

**Hovedappen ligger i [demo/](demo/).** Arbeid alltid der når du endrer nettbestillingen.
Nettstedet er **https://bestill.online/**. GitHub Pages behandler `demo` og `DEMO` som ulike stier; bruk `/demo/`.

## Aktive innganger

| Oppgave | Fil / URL |
| --- | --- |
| Kunder / nettbestilling | [demo/index.html](demo/index.html) · /demo/index.html |
| Restaurant / Bestillinger / innstillinger | [demo/admin.html](demo/admin.html) · /demo/admin.html |
| Epson testutskrift | [demo/test-printer.html](demo/test-printer.html) |
| Privat bildeutskrift (80 mm) | [demo/tools/PrivatPrinter.html](demo/tools/PrivatPrinter.html) |

Se [demo/README.md](demo/README.md) for mapper, CSS- og JavaScript-avhengigheter, printer og vedlikehold. KØL-timelister og gavekort er samlet under **demo/tools/** og **demo/gavekort/**, med de gamle adressene bevart som videresendinger.
Kjør `node demo/tools/audit-references.mjs` for å teste lokale filreferanser etter endringer.

## Hva må fortsatt ligge utenfor /demo?

- `index.html`, `img/`, `CNAME`: eksisterende hovedside og domene (må ikke flyttes).
- `api/`: eksisterende serverless API-endepunkter (ruting krever denne mappen).
- `functions/`, `firebase.json`, `.firebaserc`: Firebase Functions og deployoppsett (krever rotnivå).
- `gavekort*.html`, `Timelister.html`, `sms.html`, `tell.html`, `kayit.html`: separate tjenester/sider. Ikke del av /demo; gamle URL-er beholdes.
- `404.html`: nettstedets feilhåndtering.

Gamle `/admin.html`, `/orders.html`, `/test/`, `/printer.html` og `/PrivatPrinter.html` er nå små videresendinger til aktive /demo-sider. De store gamle implementasjonene er tatt ut av hovedgrenen for å unngå forveksling.

**Sikkerhetskopi før opprydding:** `backup-before-demo-cleanup-20261015` (se repoets grener).
Ikke flytt `api/` eller `functions/` uten samtidig å endre deploy-oppsettet.
