import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Leaf, Menu, Search, UtensilsCrossed, X } from "lucide-react";
import DishImage from "../shared/DishImage.jsx";
import VegBadge from "../shared/VegBadge.jsx";
import { RESTAURANT_NAME } from "../../lib/constants.js";
import { formatItemPrice, formatPrice, hasText, spiceLabel } from "../../lib/format.js";
import { downloadMenuPdf } from "../../lib/pdfExport.js";
import {
  getCategoryMap,
  getFeaturedItems,
  getPublicCategories,
  groupItemsByCategory,
  searchPublicItems,
} from "../../lib/menuVisibility.js";

const HEADER_OFFSET = 118;

export default function MenuView({
  menu,
  table,
  preview = false,
  draftUnavailable = false,
  imageSources = [],
}) {
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [selected, setSelected] = useState(null);
  const searchRef = useRef(null);
  const categoryMap = useMemo(() => getCategoryMap(menu), [menu]);
  const restaurant = menu.restaurant || {};
  const categories = useMemo(() => getPublicCategories(menu), [menu]);
  const featured = useMemo(() => getFeaturedItems(menu), [menu]);
  const matches = useMemo(() => searchPublicItems(menu, query), [menu, query]);
  const groups = useMemo(() => groupItemsByCategory(menu, matches), [menu, matches]);
  const attribution = imageSources.filter((entry) => entry.requiresAttribution);

  useEffect(() => {
    if (!categories.length) return undefined;
    const observers = [];
    const visible = new Map();
    categories.forEach((category) => {
      const node = document.getElementById(`cat-${category.id}`);
      if (!node) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          visible.set(category.id, entry.isIntersecting && entry.intersectionRatio > 0);
          const firstVisible = categories.find((item) => visible.get(item.id));
          if (firstVisible) setActiveId(firstVisible.id);
        },
        { rootMargin: `-${HEADER_OFFSET}px 0px -55% 0px`, threshold: [0.05, 0.2] },
      );
      observer.observe(node);
      observers.push(observer);
    });
    return () => observers.forEach((observer) => observer.disconnect());
  }, [categories, groups.length]);

  useEffect(() => {
    if (selected && !matches.some((item) => item.id === selected.id)) {
      setSelected(null);
    }
  }, [matches, selected]);

  function scrollToCategory(id) {
    setDrawerOpen(false);
    const node = document.getElementById(`cat-${id}`);
    if (!node) return;
    const top = node.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top, behavior: prefersReduced() ? "auto" : "smooth" });
    setActiveId(id);
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({ block: "center" });
  }

  const wifi = restaurant.wifi;
  const showWifi = wifi?.enabled && hasText(wifi.name);

  return (
    <div className="min-h-screen bg-ivory pb-24 text-ink">
      {preview && (
        <div className="bg-terracotta px-4 py-2 text-center text-sm text-white">
          Draft preview on this browser only. It is not the published menu.
        </div>
      )}
      {draftUnavailable && (
        <div className="bg-terracotta-2 px-4 py-2 text-center text-sm text-white">
          Draft preview is only available on the browser where it was saved. Showing the published menu.
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-card bg-ivory/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-terracotta">
            {table ? `Table ${table}` : "Dine-in Menu"}
          </p>
          <h1 className="font-display text-[1.4rem] leading-snug text-ink sm:text-2xl">
            {restaurant.name || RESTAURANT_NAME}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4">
        <section className="mt-4 rounded-2xl bg-card-2 p-4 shadow-sm">
          <p className="text-sm font-medium text-terracotta">Vegetarian cafe & Indian kitchen</p>
          {hasText(restaurant.description) && (
            <p className="mt-1 text-sm leading-6 text-ink/80">{restaurant.description}</p>
          )}
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Browse the menu and place your order with your server. This page does not take orders.
          </p>
        </section>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dishes, Hindi names, tags"
              aria-label="Search the menu"
              className="h-12 w-full rounded-2xl border border-transparent bg-white px-10 text-sm shadow-sm"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
                aria-label="Clear search"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-terracotta px-4 text-sm font-medium text-white"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open categories"
          >
            <Menu className="h-5 w-5" />
            <span className="hidden sm:inline">Categories</span>
          </button>
        </div>

        <div className="sticky top-[4.6rem] z-30 -mx-4 mt-4 bg-ivory/95 py-2 backdrop-blur">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
            {categories.map((category) => {
              const count = groups.find((group) => group.category.id === category.id)?.items.length ?? 0;
              if (query && count === 0) return null;
              const active = category.id === activeId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => scrollToCategory(category.id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm ${
                    active ? "bg-terracotta text-white" : "bg-card text-ink"
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>

        {!query && featured.length > 0 && (
          <section className="mt-5">
            <h2 className="font-display text-xl">Chef’s highlights</h2>
            <div className="no-scrollbar mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
              {featured.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className="w-[78%] max-w-xs shrink-0 snap-start overflow-hidden rounded-2xl bg-white text-left shadow-sm sm:w-64"
                >
                  <DishImage item={item} category={categoryMap.get(item.categoryId)} className="h-36 w-full" width={320} height={144} />
                  <div className="p-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="mt-1 text-sm text-terracotta">{formatItemPrice(item, restaurant.currency)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {groups.length === 0 && (
          <div className="mt-10 rounded-2xl bg-card p-6 text-center">
            <p className="font-medium">No dishes match that search.</p>
            <p className="mt-1 text-sm text-ink/70">Try another name, Hindi spelling, or tag.</p>
            <button type="button" className="mt-3 text-sm font-medium text-terracotta" onClick={() => setQuery("")}>
              Clear search
            </button>
          </div>
        )}

        {groups.map(({ category, items }) => {
          return (
            <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-32 pt-8">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{category.name}</h2>
                  {hasText(category.description) && (
                    <p className="mt-1 text-sm text-ink/70">{category.description}</p>
                  )}
                </div>
                <p className="text-xs font-medium text-ink/50">{items.length} items</p>
              </div>
              <ul className="mt-3 divide-y divide-card">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="flex w-full items-start gap-3 py-3 text-left"
                    >
                      <DishImage
                        item={item}
                        category={category}
                        className="h-[72px] w-[72px] shrink-0 rounded-2xl"
                        width={72}
                        height={72}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 font-medium leading-snug">{item.name}</span>
                          <VegBadge className="mt-0.5" />
                        </span>
                        {hasText(item.nameHi) && (
                          <span className="mt-0.5 block text-xs text-ink/55">{item.nameHi}</span>
                        )}
                        {hasText(item.description) && (
                          <span className="mt-1 block text-sm leading-5 text-ink/70">{item.description}</span>
                        )}
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-terracotta">
                            {formatItemPrice(item, restaurant.currency)}
                          </span>
                          {(item.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full bg-card px-2 py-0.5 text-[11px] text-ink/70">
                              {tag}
                            </span>
                          ))}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <footer className="mt-12 border-t border-card py-8 text-sm text-ink/70">
          {hasText(restaurant.footerText) && <p>{restaurant.footerText}</p>}
          <button
            type="button"
            className="mt-4 min-h-11 rounded-full bg-terracotta px-4 text-sm font-medium text-white"
            onClick={() => downloadMenuPdf(menu)}
          >
            Download menu PDF
          </button>
          {hasText(restaurant.address) && <p className="mt-2">{restaurant.address}</p>}
          {hasText(restaurant.phone) && <p className="mt-1">{restaurant.phone}</p>}
          {hasText(restaurant.openingHours) && <p className="mt-1">{restaurant.openingHours}</p>}
          {showWifi && (
            <p className="mt-2">
              Wi-Fi: {wifi.name}
              {hasText(wifi.password) ? ` · ${wifi.password}` : ""}
            </p>
          )}
          {attribution.length > 0 && (
            <button type="button" className="mt-3 font-medium text-terracotta" onClick={() => setCreditsOpen(true)}>
              Image credits
            </button>
          )}
        </footer>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-card bg-ivory/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-4 px-2 py-1">
          <NavButton icon={UtensilsCrossed} label="Menu" onClick={() => window.scrollTo({ top: 0 })} />
          <NavButton icon={Search} label="Search" onClick={focusSearch} />
          <NavButton icon={Menu} label="Categories" onClick={() => setDrawerOpen(true)} />
          <NavButton
            icon={Leaf}
            label="Highlights"
            onClick={() => featured[0] && setSelected(featured[0])}
          />
        </div>
      </nav>

      {drawerOpen && (
        <CategoryDrawer
          categories={categories}
          groups={groups}
          onClose={() => setDrawerOpen(false)}
          onSelect={scrollToCategory}
        />
      )}

      {selected && (
        <DishDialog
          item={selected}
          category={categoryMap.get(selected.categoryId)}
          currency={restaurant.currency}
          onClose={() => setSelected(null)}
        />
      )}

      {creditsOpen && (
        <CreditsDialog sources={attribution} onClose={() => setCreditsOpen(false)} />
      )}
    </div>
  );
}

function NavButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]">
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function CategoryDrawer({ categories, groups, onClose, onSelect }) {
  const panelRef = useRef(null);
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close categories" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Categories"
        className="absolute inset-y-0 right-0 flex w-[min(100%,22rem)] flex-col bg-ivory shadow-xl"
      >
        <div className="flex items-center justify-between px-4 py-4">
          <h2 className="font-display text-xl">Categories</h2>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-card" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-2 pb-8">
          {categories.map((category) => {
            const count = groups.find((group) => group.category.id === category.id)?.items.length ?? 0;
            if (count === 0) return null;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left"
                  onClick={() => onSelect(category.id)}
                >
                  <span>
                    <span className="block font-medium">{category.name}</span>
                    <span className="text-xs text-ink/55">{count} visible items</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink/40" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function DishDialog({ item, category, currency, onClose }) {
  const panelRef = useRef(null);
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.activeElement;
    panelRef.current?.querySelector("button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  const spice = spiceLabel(item.spiceLevel);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close dish details" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ivory shadow-xl sm:rounded-3xl"
      >
        <DishImage item={item} category={category} className="h-52 w-full" width={480} height={208} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="dish-title" className="font-display text-2xl">
                {item.name}
              </h2>
              {hasText(item.nameHi) && <p className="text-sm text-ink/60">{item.nameHi}</p>}
            </div>
            <VegBadge />
          </div>
          {hasText(item.description) && <p className="mt-3 text-sm leading-6 text-ink/80">{item.description}</p>}
          {item.comboItems?.length ? (
            <div className="mt-4 rounded-xl bg-veg-soft p-3 text-sm">
              <p className="font-medium text-veg">Includes</p>
              <ul className="mt-1 space-y-1 text-ink/80">
                {item.comboItems.map((entry) => (
                  <li key={entry.itemId}>
                    {entry.quantity > 1 ? `${entry.quantity}× ` : ""}
                    {entry.name || entry.itemId}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {item.variants?.length ? (
            <ul className="mt-4 space-y-2">
              {item.variants.map((variant) => (
                <li key={variant.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
                  <span>{variant.name}</span>
                  <span className="font-medium text-terracotta">{formatPrice(variant.price, currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 font-semibold text-terracotta">{formatPrice(item.price, currency)}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {spice && <span className="rounded-full bg-card px-3 py-1 text-xs">{spice}</span>}
            {(item.tags || []).map((tag) => (
              <span key={tag} className="rounded-full bg-veg-soft px-3 py-1 text-xs text-veg">
                {tag}
              </span>
            ))}
          </div>
          <button type="button" className="mt-5 min-h-11 w-full rounded-full bg-terracotta text-white" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CreditsDialog({ sources, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close credits" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="credits-title" className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-ivory p-5 shadow-xl">
        <h2 id="credits-title" className="font-display text-2xl">Image credits</h2>
        <ul className="mt-4 space-y-3 text-sm">
          {sources.map((entry) => (
            <li key={entry.localFilename || entry.originalPage} className="rounded-xl bg-card p-3">
              <p className="font-medium">{entry.localFilename}</p>
              <p>{entry.creator} · {entry.licence}</p>
              {entry.originalPage && (
                <a className="break-all text-terracotta" href={entry.originalPage} target="_blank" rel="noreferrer">
                  Source
                </a>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="mt-4 min-h-11 w-full rounded-full bg-terracotta text-white" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function prefersReduced() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
