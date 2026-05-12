export default function InfoSheet({ open, settings, status, onClose }) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <aside className="infoSheet">
        <header className="simpleHeader"><h2>{settings.restaurantName}</h2><button type="button" onClick={onClose}>×</button></header>
        <p className="muted">For en pålitelig gjennomgang av ordrestatus i sanntid kan data lagres på denne enheten.</p>
        <div className="infoCard"><strong>Åpningstider</strong><span>{settings.openingDays}</span><b>{settings.openingTime}</b></div>
        <div className="infoCard"><strong>Status</strong><span>{status.label}</span></div>
        <div className="infoCard"><strong>Henting</strong><span>{settings.pickupInfo}</span></div>
        <div className="infoCard"><strong>Betalingsmetode</strong><span>{settings.paymentInfo}</span></div>
        <div className="infoCard"><strong>Adresse</strong><span>{[settings.streetAddress, settings.postalCode, settings.city].filter(Boolean).join(", ")}</span></div>
      </aside>
    </div>
  );
}
