import { money } from "../lib/format.js";

export default function CartDrawer({ open, cart, total, onClose, onRemove, onCheckout, storeOpen }) {
  if (!open) return null;
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <aside className="cartSheet">
        <header className="simpleHeader">
          <h2>Handlekurv</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="cartLines">
          {cart.length === 0 ? <p className="emptyText">Handlekurven er tom.</p> : cart.map((line, index) => (
            <article key={`${line.productId}-${index}`} className="cartLine">
              <div>
                <strong>{line.quantity}x {line.name}</strong>
                <small>Størrelse: {line.sizeLabel}</small>
                {line.extraDetails?.map((extra, i) => <small key={i}>{extra.group}: {extra.label}{extra.price ? ` +${money(extra.price)}` : ""}</small>)}
              </div>
              <b>{money(line.lineTotal)}</b>
              <button type="button" onClick={() => onRemove(index)}>×</button>
            </article>
          ))}
        </div>
        <footer className="cartFooter">
          <div><span>Sluttsum</span><strong>{money(total)}</strong></div>
          <button type="button" disabled={!cart.length} onClick={onCheckout}>Fortsett</button>
          {!storeOpen && <p>Du kan legge varer i handlekurven, men bestillingen kan ikke sendes før restauranten åpner.</p>}
        </footer>
      </aside>
    </div>
  );
}
