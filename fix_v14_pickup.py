from pathlib import Path
p=Path('test/index.html')
s=p.read_text(encoding='utf-8')
old='''  if (openNow) {
    pickupHelp.textContent = mode === "asap"
      ? `Klar ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  } else {
    pickupHelp.textContent = mode === "asap"
      ? `Første henting ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  } else {
    pickupHelp.textContent = mode === "asap"
      ? `Restauranten er stengt nå. Snarest mulig betyr henting kl. ${formatClock(firstChoice)}, etter at vi åpner kl. ${openLabel}.`
      : `Restauranten er stengt nå. Velg hentetid fra ${formatClock(firstChoice)}; bestillingen kan sendes nå.`;
  }
'''
new='''  if (openNow) {
    pickupHelp.textContent = mode === "asap"
      ? `Klar ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  } else {
    pickupHelp.textContent = mode === "asap"
      ? `Første henting ca. kl. ${formatClock(firstChoice)}`
      : `Velg ønsket hentetid.`;
  }
'''
if old not in s: raise SystemExit('pickup duplicate block not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('fixed')
