import { useMemo, useState } from "react";

export default function ComboEditor({ menu, makeId, onSave, onClose }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(menu.categories.find((category) => category.id === "cafe-combos")?.id || menu.categories[0]?.id || "");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (menu.items || [])
      .filter((item) => !item.comboItems?.length)
      .filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.id.includes(needle))
      .slice(0, 40);
  }, [menu.items, query]);

  function addItem(item) {
    setPicked((current) => {
      if (current.some((entry) => entry.itemId === item.id)) return current;
      return [...current, { itemId: item.id, name: item.name, quantity: 1, price: item.price }];
    });
  }

  function save(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Give the combo a name.");
      return;
    }
    if (!picked.length) {
      setError("Add at least one dish to the combo.");
      return;
    }
    const amount = Number(price);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a combo price.");
      return;
    }
    const id = makeId(name);
    onSave({
      id,
      categoryId,
      name: name.trim(),
      nameHi: "",
      description: `Combo of ${picked.map((entry) => (entry.quantity > 1 ? `${entry.quantity}× ${entry.name}` : entry.name)).join(", ")}.`,
      price: amount,
      image: `/images/fallbacks/${categoryId}.webp`,
      tags: ["combo"],
      spiceLevel: "",
      isActive: true,
      isFeatured: false,
      sortOrder: (menu.items.length || 0) + 1,
      variants: [],
      comboItems: picked.map((entry) => ({
        itemId: entry.itemId,
        name: entry.name,
        quantity: Number(entry.quantity) || 1,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close combo editor" onClick={onClose} />
      <form
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-ivory p-5 shadow-xl sm:rounded-3xl"
        onSubmit={save}
      >
        <h2 className="font-display text-2xl">Create combo</h2>
        <p className="mt-1 text-sm text-ink/60">Bundle existing dishes into one priced plate.</p>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-ink/70">Combo name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl bg-white px-3" required />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Price (INR)</span>
            <input type="number" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} className="h-11 w-full rounded-xl bg-white px-3" required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">Category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 w-full rounded-xl bg-white px-3">
              {menu.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-ink/70">Search dishes to add</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl bg-white px-3" placeholder="Search by name" />
        </label>
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-white">
          {options.map((item) => (
            <li key={item.id}>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => addItem(item)}>
                <span>{item.name}</span>
                <span className="text-terracotta">Add</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2">
          {picked.map((entry) => (
            <div key={entry.itemId} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm">
              <span className="flex-1">{entry.name}</span>
              <input
                type="number"
                min="1"
                value={entry.quantity}
                onChange={(event) =>
                  setPicked((current) =>
                    current.map((row) => (row.itemId === entry.itemId ? { ...row, quantity: event.target.value } : row)),
                  )
                }
                className="h-9 w-16 rounded-lg bg-card-2 px-2"
              />
              <button type="button" className="text-terracotta" onClick={() => setPicked((current) => current.filter((row) => row.itemId !== entry.itemId))}>
                Remove
              </button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-full bg-card px-4" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="min-h-11 rounded-full bg-terracotta px-4 text-white">
            Save combo
          </button>
        </div>
      </form>
    </div>
  );
}
