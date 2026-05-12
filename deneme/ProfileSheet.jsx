import { money } from "../lib/format.js";

export default function BottomCartBar({ count, total, onClick }) {
  if (!count) return null;
  return (
    <div className="bottomCartBar">
      <button type="button" onClick={onClick}>
        <span>{count} varer</span>
        <strong>Se handlekurv</strong>
        <b>{money(total)}</b>
      </button>
    </div>
  );
}
