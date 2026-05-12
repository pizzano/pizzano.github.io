import { compactText, money } from "../lib/format.js";

export default function ProductCard({ product, selected, onClick }) {
  return (
    <button className={`productCard ${selected ? "selected" : ""} ${product.soldOut ? "soldOut" : ""}`} type="button" onClick={onClick} disabled={product.soldOut}>
      <div className="productImageWrap">
        <img src={product.imageUrl || "https://images.unsplash.com/photo-1548369937-47519962c11a?w=500&auto=format&fit=crop&q=80"} alt="" />
        {!product.soldOut && <span className="plusButton">+</span>}
      </div>
      <div className="productInfo">
        <div className="productTitleLine">
          <strong>{product.name}</strong>
          {selected && <em>Valgt</em>}
        </div>
        <p>{compactText(product.ingredients, 88)}</p>
        {product.sizes?.length > 1 && !product.soldOut && <small>★ Velg størrelse og tilbehør</small>}
      </div>
      <div className="productPrice">
        {product.soldOut ? <b>UTSOLGT</b> : <b>{product.sizes?.length > 1 ? "Fra " : ""}{money(product.basePrice)}</b>}
      </div>
    </button>
  );
}
