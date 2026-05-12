export default function Header({ restaurantName, cartCount, onInfo, onProfile, onCart, onBack }) {
  return (
    <header className="appHeader">
      <button className="headerBack" type="button" onClick={onBack} aria-label="Tilbake">‹</button>
      <strong className="brandName">{restaurantName}</strong>
      <button className="headerIcon" type="button" onClick={onInfo} aria-label="Info">i</button>
      <button className="headerIcon profileIcon" type="button" onClick={onProfile} aria-label="Profil">👤</button>
      <button className="headerIcon cartIcon" type="button" onClick={onCart} aria-label="Handlekurv">
        🛒
        <span>{cartCount}</span>
      </button>
    </header>
  );
}
