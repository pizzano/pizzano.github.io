import { shortOrderId, money } from "../lib/format.js";
import { readyAt } from "../lib/time.js";

export default function OrderTracker({ order, onClose }) {
  const status = order?.status || "pending";
  const accepted = status === "accepted" || status === "confirmed" || status === "ready";
  const cancelled = status === "cancelled";
  const readyMinutes = Number(order?.readyMinutes || order?.preparationMinutes || 30) || 30;

  return (
    <main className="trackerPage">
      <header className="screenTop">
        <button type="button" onClick={onClose}>‹</button>
        <h1>Bestillingsstatus</h1>
      </header>

      <section className={`trackerCard ${accepted ? "accepted" : cancelled ? "cancelled" : "pending"}`}>
        <small>Ordre {shortOrderId(order?.id)}</small>
        <h2>{cancelled ? "Kansellert" : accepted ? "Bekreftet" : "Bestillingen er sendt"}</h2>
        {accepted ? (
          <div className="readyBox">
            <span>Klar om</span>
            <strong>{readyMinutes} min</strong>
            <small>Ca. {readyAt(readyMinutes)}</small>
          </div>
        ) : cancelled ? <p>Bestillingen ble kansellert.</p> : <p>Venter på godkjenning fra restauranten.</p>}
      </section>

      <section className="trackerItems">
        {order?.items?.map((item, index) => (
          <article key={index}>
            <div><strong>{item.quantity || 1}x {item.name}</strong><small>{item.sizeLabel || item.size}</small></div>
            <b>{money(item.lineTotal || item.total)}</b>
          </article>
        ))}
        <div className="checkoutTotal"><span>Sluttsum</span><strong>{money(order?.total || 0)}</strong></div>
      </section>
    </main>
  );
}
