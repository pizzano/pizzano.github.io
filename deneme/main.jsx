import { shortOrderId, money } from "../lib/format.js";

export default function ProfileSheet({ open, orders, phone, setPhone, onFetch, onClose }) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <aside className="infoSheet">
        <header className="simpleHeader"><h2>Min profil</h2><button type="button" onClick={onClose}>×</button></header>
        <p className="muted">Siste bestillinger og hentestatus på denne telefonen.</p>
        <div className="profileSearch">
          <label>Finn bestillinger<input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Telefonnummer" /></label>
          <button type="button" onClick={onFetch}>Hent</button>
        </div>
        <div className="profileOrders">
          {orders.length === 0 ? <p className="emptyText">Ingen bestillinger funnet.</p> : orders.map((order) => (
            <article key={order.id} className={`profileOrder ${order.status || "pending"}`}>
              <div><strong>{order.status === "accepted" ? "Bekreftet" : order.status === "cancelled" ? "Kansellert" : "Bestillingen er sendt"}</strong><small>Ordre {shortOrderId(order.id)} · {money(order.total)}</small></div>
              <span>{order.status === "accepted" ? "Godkjent" : order.status === "cancelled" ? "Kansellert" : "Venter"}</span>
            </article>
          ))}
        </div>
      </aside>
    </div>
  );
}
