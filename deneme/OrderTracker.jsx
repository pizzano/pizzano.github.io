import Hero from "./Hero.jsx";
import ProductCard from "./ProductCard.jsx";
import { mostOrderedProducts } from "../lib/dataAdapter.js";

export default function Menu({ settings, status, sections, search, setSearch, activeCategory, setActiveCategory, selectedIds, onOpenProduct }) {
  const query = search.trim().toLowerCase();
  const productsForSearch = sections.flatMap((section) => section.items).filter((p) => {
    const hay = `${p.name} ${p.ingredients} ${p.categoryTitle}`.toLowerCase();
    return hay.includes(query);
  });

  const renderSection = (id, title, note, items) => (
    <section key={id} id={`cat-${id}`} className="menuSection">
      <div className="sectionHead">
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
        <span>{items.length} varer</span>
      </div>
      <div className="productList">
        {items.map((product) => (
          <ProductCard
            key={`${id}-${product.id}`}
            product={product}
            selected={selectedIds.has(product.id)}
            onClick={() => onOpenProduct(product)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <main className="menuContent">
      <Hero settings={settings} status={status} />
      {!status.open && <p className="closedNote">{status.detail}</p>}

      <label className="searchBox">
        <span>⌕</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk i menyen" />
        {search && <button type="button" onClick={() => setSearch("")}>×</button>}
      </label>

      {query ? (
        renderSection("search", "Søkeresultater", `Produkter som matcher “${search}”`, productsForSearch)
      ) : activeCategory === "most" ? (
        renderSection("most", "Mest bestilt", "De 5 mest populære produktene akkurat nå.", mostOrderedProducts(sections, 5))
      ) : (
        sections.filter((s) => s.id === activeCategory).map((section) => renderSection(section.id, section.title, section.note, section.items))
      )}
    </main>
  );
}
