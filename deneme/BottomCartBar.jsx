export default function CategoryTabs({ categories, activeId, onSelect }) {
  return (
    <nav className="categoryTabs" aria-label="Kategorier">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={activeId === cat.id ? "active" : ""}
          onClick={() => onSelect(cat.id)}
        >
          {cat.title}
        </button>
      ))}
    </nav>
  );
}
