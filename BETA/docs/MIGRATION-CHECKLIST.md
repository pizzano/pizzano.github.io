# BETA → fremtidig produksjon: kontrollpunkter

- [x] Inventar av DEMO og tilknyttet API/Functions.
- [x] Separat `BETA/`-miljø uten skrivende produksjonstilkoblinger.
- [x] Grunnleggende kunde- og restaurantvisning med lokal prøveordre.
- [x] Enhetstester for handlekurv, sum og statusoverganger.
- [ ] Komplett meny med størrelse, valggrupper, uten-ingredienser og kommentarer.
- [ ] Checkout med valg av Snarest/Planlagt, telefon og e-post.
- [ ] All profil, favoritt og Mine bestillinger-atferd.
- [ ] Betrodd ordre-API og tilgangskontroll med separat TEST-database.
- [ ] Firebase test på tvers av enheter; kun egne ordrer på kundevisning.
- [ ] Grenser for samtidige tilkoblinger, overført MB og caching.
- [ ] Ordresynkronisering, frister, klokkeslett og manuell klar-markering.
- [ ] Verifiserte SMS-kvitteringer, én SMS ved Bekreft med hentetid.
- [ ] E-post ved Bekreft og manuelt Klar + dokumenterte feiltilstander.
- [ ] Pizzabonus, atomiske poeng og retroaktiv historikk.
- [ ] Epson på restaurantens nett, korrekt kjøkkenbillett og prøveutskrift.
- [ ] 100-ordre-arkiv med atomisk verifikasjon og gjenoppretting.
- [ ] Mobil/desktop brukertest og reell kjøkkentest.
- [ ] Ekte last- og kvotetest mot Firebase Spark-grensene.
- [ ] Egen godkjenning før produksjonsbytte.

## Stoppregler

Ingen ekte kundedata, ekte meldinger, betaling eller printerjobber fra BETA
før adgangskontroll, revisjon og integrasjonstester er signert.
DEMO skal aldri overskrives automatisk av BETA.
