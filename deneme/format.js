import { useState } from "react";
import { cleanPhone, money } from "../lib/format.js";

export default function Checkout({ cart, total, status, savedCustomer, onBack, onSubmit }) {
  const [name, setName] = useState(savedCustomer?.name || "");
  const [phone, setPhone] = useState(savedCustomer?.phone || "");
  const [mode, setMode] = useState("asap");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const clean = cleanPhone(phone);
    if (!status.open) return setError(status.detail || "Restauranten er stengt.");
    if (!name.trim()) return setError("Skriv inn hele navn.");
    if (clean.length !== 8) return setError("Telefonnummer må være 8 siffer.");
    if (!cart.length) return setError("Handlekurven er tom.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({ name: name.trim(), phone: clean, pickupMode: mode });
    } catch (e) {
      setError(e.message || "Bestillingen kunne ikke sendes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="checkoutPage">
      <header className="screenTop">
        <button type="button" onClick={onBack}>‹</button>
        <h1>Checkout</h1>
      </header>

      <section className="checkoutCard">
        <h2>Din bestilling</h2>
        {cart.map((line, index) => (
          <div key={index} className="checkoutLine">
            <span>{line.quantity}x {line.name}</span>
            <b>{money(line.lineTotal)}</b>
          </div>
        ))}
        <div className="checkoutTotal"><span>Sluttsum</span><strong>{money(total)}</strong></div>
      </section>

      <section className="checkoutCard">
        <h2>Kundeinformasjon</h2>
        <div className="pickupModes">
          <label className={mode === "asap" ? "selected" : ""}><input type="radio" checked={mode === "asap"} onChange={() => setMode("asap")} /> Snarest mulig</label>
          <label className={mode === "later" ? "selected" : ""}><input type="radio" checked={mode === "later"} onChange={() => setMode("later")} /> Velg hentetid</label>
        </div>
        {!status.open && <p className="errorBox">{status.detail}</p>}
        <label>Hele navn<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hele navn" /></label>
        <label>Telefonnummer<input value={phone} onChange={(e) => setPhone(cleanPhone(e.target.value))} placeholder="8 siffer" inputMode="numeric" /></label>
        {error && <p className="errorBox">{error}</p>}
      </section>

      <div className="checkoutBottom">
        <button type="button" disabled={busy || !cart.length} onClick={submit}>{busy ? "Sender..." : "Send bestilling"}</button>
      </div>
    </main>
  );
}
