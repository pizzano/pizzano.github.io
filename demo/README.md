# Bestill — gjenbrukbar restaurantapp

## Oppsett

Sett `databaseUrl` i `config.js` til din Firebase Realtime Database. Ingen restaurantmeny skrives automatisk når databasen er tom.

Åpne `admin.html` for å legge til kategorier, produkter, størrelser/priser og tilvalg. Angi restaurantnavn, logo-URL, kontaktinformasjon og åpningstider under Restaurantinnstillinger. Bestilling starter stengt til administrator konfigurerer åpning.

## Import og eksport

«Eksporter meny-JSON» gir en kompatibel `menu.json` uten ordre, kundedata eller pizzabonus. «Importer meny-JSON» viser antall kategorier og produkter før import. Import erstatter menyen og beholder ordre/pizzabonus.

Den kompatible strukturen har `sections` (kategorier med `items` og `sizes`), `optionGroups`, `allergenCatalog`, `popularItemIds` og valgfri `settings`. Hver pris er en full størrelsepris, ikke et tillegg til en annen pris.

Firebase-import av denne JSON-en fungerer både ved databaseroten og under `/menu`. Bruk én plassering konsekvent: `/menu` har prioritet når den finnes. Endringer fra admin skrives til samme plassering.

GlobalFood JSON med `categories` er et annet format og må konverteres først. Kontroller prisavvik mellom beskrivelsestekst og prisfelter og behold størrelsesavhengige tilvalg under konverteringen.

## Tom database

En vellykket lesing av en tom database fjerner den tidligere menyen fra appens tilstand. Nettverksfeil bruker sist lagrede lokale kopi. Denne versjonen bruker nye lokale lagringsnøkler slik at gamle demonstrasjonsdata ikke gjenopprettes.
