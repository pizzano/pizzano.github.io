import { useEffect, useMemo, useState } from "react";
import { groupsForProduct } from "../lib/dataAdapter.js";
import { money } from "../lib/format.js";

export default function ProductModal({ product, optionGroups, onClose, onAdd }) {
  const defaultSize = product?.sizes?.find((s) => s.default) || product?.sizes?.[0];
  const [sizeId, setSizeId] = useState(defaultSize?.id || "standard");
  const [selected, setSelected] = useState({});
  const groups = useMemo(() => groupsForProduct(product || {}, optionGroups, sizeId), [product, optionGroups, sizeId]);
  const size = product?.sizes?.find((s) => s.id === sizeId) || defaultSize;

  useEffect(() => {
    if (!product) return;
    const initial = {};
    groups.forEach((group) => {
      if (group.type === "single") {
        const def = group.options.find((o) => o.default) || group.options[0];
        if (def) initial[group.id] = def.id;
      } else {
        initial[group.id] = group.options.filter((o) => o.default).map((o) => o.id);
      }
    });
    setSelected(initial);
  }, [product, sizeId]);

  if (!product) return null;

  const selectedOptions = groups.flatMap((group) => {
    const value = selected[group.id];
    if (group.type === "single") {
      const opt = group.options.find((o) => o.id === value);
      return opt ? [{ ...opt, group: group.title }] : [];
    }
    return group.options.filter((o) => Array.isArray(value) && value.includes(o.id)).map((o) => ({ ...o, group: group.title }));
  });

  const extrasTotal = selectedOptions.reduce((sum, opt) => sum + Number(opt.price || 0), 0);
  const unitPrice = Number(size?.price || 0) + extrasTotal;

  const toggleMulti = (group, option) => {
    setSelected((prev) => {
      const current = Array.isArray(prev[group.id]) ? prev[group.id] : [];
      return {
        ...prev,
        [group.id]: current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]
      };
    });
  };

  const add = () => {
    onAdd({
      productId: product.id,
      name: product.name,
      quantity: 1,
      size: size?.id || "standard",
      sizeLabel: size?.label || "Standart",
      basePrice: Number(size?.price || 0),
      defaultBasePrice: Number(product.basePrice || size?.price || 0),
      sizePrice: Number(size?.price || 0),
      extrasTotal,
      unitPrice,
      lineTotal: unitPrice,
      total: unitPrice,
      extras: selectedOptions.map((o) => o.label),
      extraDetails: selectedOptions.map((o) => ({ group: o.group, label: o.label, price: Number(o.price || 0) })),
      extraIds: selectedOptions.map((o) => o.id),
      note: "",
      imageUrl: product.imageUrl
    });
    onClose();
  };

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="productSheet">
        <div className="sheetScroll">
          <div className="sheetHero">
            <img src={product.imageUrl || "https://images.unsplash.com/photo-1548369937-47519962c11a?w=900&auto=format&fit=crop&q=80"} alt="" />
            <button type="button" onClick={onClose} aria-label="Lukk">×</button>
            <div>
              <h2>{product.name}</h2>
              <p>{product.ingredients}</p>
            </div>
          </div>

          <div className="sheetBody">
            <div className="groupTitle"><h3>Størrelse</h3><span>Obligatorisk</span></div>
            <div className="choiceBox">
              {product.sizes.map((s) => (
                <label key={s.id} className={sizeId === s.id ? "choice selected" : "choice"}>
                  <input type="radio" name="size" checked={sizeId === s.id} onChange={() => setSizeId(s.id)} />
                  <span>{s.label}</span>
                  <strong>{money(s.price)}</strong>
                </label>
              ))}
            </div>

            {groups.map((group) => (
              <section key={group.id} className="optionGroup">
                <div className="groupTitle"><h3>{group.title}</h3>{group.required && <span>Obligatorisk</span>}</div>
                <div className="choiceBox">
                  {group.options.map((option) => {
                    const isSingle = group.type === "single";
                    const checked = isSingle ? selected[group.id] === option.id : Array.isArray(selected[group.id]) && selected[group.id].includes(option.id);
                    return (
                      <label key={option.id} className={checked ? "choice selected" : "choice"}>
                        <input
                          type={isSingle ? "radio" : "checkbox"}
                          name={group.id}
                          checked={checked}
                          onChange={() => isSingle ? setSelected((prev) => ({ ...prev, [group.id]: option.id })) : toggleMulti(group, option)}
                        />
                        <span>{option.label}</span>
                        {option.price > 0 && <strong>+{money(option.price)}</strong>}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="sheetFooter">
          <div>{money(unitPrice)}</div>
          <button type="button" onClick={add}>Legg til i handlevogn</button>
        </div>
      </div>
    </div>
  );
}
