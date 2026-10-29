import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Cloud,
  ImagePlus,
  LogOut,
  Pencil,
  Plus,
  QrCode,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import AdminLogin from "../components/admin/AdminLogin.jsx";
import ComboEditor from "../components/admin/ComboEditor.jsx";
import MenuPdfDialog from "../components/admin/MenuPdfDialog.jsx";
import ConfirmDialog from "../components/shared/ConfirmDialog.jsx";
import DishImage from "../components/shared/DishImage.jsx";
import { MenuDraftProvider, useMenuDraft } from "../context/MenuDraftContext.jsx";
import { changeAdminPassword, restoreAdminSession, signOutAdmin } from "../lib/adminAuth.js";
import { ADMIN_PAGE_SIZE, ADMIN_SECURITY_NOTICE, DRAFT_NOTICE, OWNER_REVIEW_NOTICE } from "../lib/constants.js";
import { formatPrice } from "../lib/format.js";
import { slugify } from "../lib/ids.js";
import { uploadMenuImage, validateImageFile } from "../lib/imageStorage.js";
import { buildPublicationZip, downloadBlob, downloadTextFile, menuToJson } from "../lib/menuExport.js";
import { fetchImageSources, fetchPublishedMenu, loadDraftRecord, parseImportedJson } from "../lib/menuStorage.js";
import { summarizeMenu, validateMenu } from "../lib/menuValidation.js";
import { getCategoryMap } from "../lib/menuVisibility.js";
import { downloadQrSheetPdf, qrSheetLayout } from "../lib/pdfExport.js";

export default function ManageControlPage() {
  const [signedIn, setSignedIn] = useState(null);
  const [boot, setBoot] = useState({ status: "loading" });

  useEffect(() => {
    restoreAdminSession().then(setSignedIn);
  }, []);

  useEffect(() => {
    if (!signedIn) return undefined;
    fetchPublishedMenu()
      .then((published) => {
        const draft = loadDraftRecord();
        if (draft?.menu && !draft.error) {
          const result = validateMenu(draft.menu);
          const draftTime = Date.parse(draft.savedAt || "");
          const publishedTime = Date.parse(String(published.revision || "").replace(/^admin-/, ""));
          const draftIsNewer = Boolean(draftTime) && (!publishedTime || draftTime > publishedTime);
          if (result.ok && draftIsNewer) {
            setBoot({
              status: "ready",
              published,
              initialMenu: draft.menu,
              initialDraftSavedAt: draft.savedAt,
            });
            return;
          }
        }
        setBoot({ status: "ready", published });
      })
      .catch((error) => setBoot({ status: "error", message: error.message }));
  }, [signedIn]);

  if (signedIn === null) {
    return <div className="flex min-h-screen items-center justify-center bg-ivory">Loading management…</div>;
  }

  if (!signedIn) {
    return <AdminLogin onSignedIn={() => setSignedIn(true)} />;
  }

  if (boot.status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-ivory">Loading management…</div>;
  }
  if (boot.status === "error") {
    return <div className="p-8 text-center">{boot.message}</div>;
  }

  return (
    <MenuDraftProvider
      published={boot.published}
      initialMenu={boot.initialMenu}
      initialDraftSavedAt={boot.initialDraftSavedAt}
    >
      <AdminShell
        onSignOut={() => {
          signOutAdmin();
          setSignedIn(false);
        }}
      />
    </MenuDraftProvider>
  );
}

function AdminShell({ onSignOut }) {
  const { menu, dirty, draftSavedAt, storageError, status, saveDraft } = useMenuDraft();
  const [tab, setTab] = useState("dashboard");
  const stats = summarizeMenu(menu);

  return (
    <div className="min-h-screen bg-ivory pb-16 text-ink">
      <header className="border-b border-card bg-ivory/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-terracotta">Staff desk</p>
            <h1 className="font-display text-2xl leading-tight">{menu.restaurant?.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/" className="inline-flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-medium">
              View public menu
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="rounded-2xl bg-card p-4 text-sm leading-6">
          <p>{DRAFT_NOTICE}</p>
          <p className="mt-1 text-ink/70">{OWNER_REVIEW_NOTICE}</p>
          <p className="mt-1 text-ink/70">{ADMIN_SECURITY_NOTICE}</p>
        </div>
        {storageError && (
          <p
            className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {storageError}
          </p>
        )}
        {status && <p className="mt-3 text-sm text-veg">{status}</p>}
        <p className="mt-2 text-xs text-ink/50">
          {dirty ? "Unsaved changes in this session." : "No unsaved changes."}
          {draftSavedAt ? ` Last draft save: ${new Date(draftSavedAt).toLocaleString()}` : " No local draft saved yet."}
        </p>

        <DraftToolbar onSave={saveDraft} />

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
          {[
            ["dashboard", "Dashboard"],
            ["items", "Items"],
            ["categories", "Categories"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${tab === id ? "bg-terracotta text-white" : "bg-card"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "dashboard" && <Dashboard stats={stats} />}
        {tab === "items" && <ItemManager />}
        {tab === "categories" && <CategoryManager />}
      </div>
    </div>
  );
}

function DraftToolbar({ onSave }) {
  const { menu, discardDraft, replaceMenu, setStatus, setStorageError } = useMenuDraft();
  const importRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [imageSources, setImageSources] = useState([]);

  useEffect(() => {
    fetchImageSources().then(setImageSources);
  }, []);

  function exportJson() {
    downloadTextFile("menu.json", menuToJson(menu));
    setStatus("menu.json downloaded. Replace public/data/menu.json before rebuilding.");
  }

  async function exportZip() {
    const { blob, missing } = await buildPublicationZip(menu, imageSources);
    downloadBlob("tmc-publication.zip", blob);
    setStatus(
      missing.length
        ? `ZIP downloaded. Missing local images: ${missing.length}. Copy the exported folders into public/ before rebuild.`
        : "Publication ZIP downloaded. Replace or merge into public/, then rebuild and redeploy.",
    );
  }

  function onImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    file.text().then((text) => {
      const parsed = parseImportedJson(text);
      if (!parsed.ok) {
        setStorageError(parsed.errors.join(" "));
        setStatus("");
        return;
      }
      setConfirm({
        title: "Replace current draft with imported menu?",
        message: `Incoming catalogue: ${parsed.menu.items.length} items, ${parsed.menu.categories.length} categories. Export a backup first if you need one.`,
        confirmLabel: "Replace draft",
        danger: true,
        action: () => {
          replaceMenu(parsed.menu);
          setStatus("Imported menu loaded as a local draft. Export and deploy to publish.");
        },
      });
    });
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ToolButton onClick={onSave}>Save draft</ToolButton>
      <Link className="inline-flex min-h-11 items-center rounded-full bg-card px-4 text-sm" to="/?preview=draft">
        Preview draft
      </Link>
      <ToolButton onClick={exportJson} icon={Download}>
        Export menu.json
      </ToolButton>
      <ToolButton onClick={() => importRef.current?.click()} icon={Upload}>
        Import menu.json
      </ToolButton>
      <ToolButton onClick={exportZip} icon={FileUp}>
        Export publication package
      </ToolButton>
      <ToolButton
        onClick={() =>
          setConfirm({
            title: "Discard draft and reload published data?",
            message: "This clears the draft saved in this browser and restores the published menu.json.",
            confirmLabel: "Discard draft",
            danger: true,
            action: discardDraft,
          })
        }
      >
        Discard draft
      </ToolButton>
      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={onImportFile} />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action?.();
          setConfirm(null);
        }}
      />
    </div>
  );
}

function ToolButton({ children, onClick, icon: Icon }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white">
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function Dashboard({ stats }) {
  const { menu, dirty, draftSavedAt, applyAndPublish, setStatus, setStorageError } = useMenuDraft();
  const [qrSize, setQrSize] = useState(6);
  const [qrBusy, setQrBusy] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const layout = qrSheetLayout(qrSize);
  const cards = [
    ["Total items", stats.items],
    ["Active items", stats.activeItems],
    ["Inactive items", stats.inactiveItems],
    ["Categories", stats.categories],
    ["Featured items", stats.featuredItems],
    ["Revision", menu.revision || "—"],
    ["Unsaved changes", dirty ? "Yes" : "No"],
    ["Local draft", draftSavedAt ? "Saved on this browser" : "None"],
  ];

  async function downloadQr() {
    setQrBusy(true);
    try {
      await downloadQrSheetPdf({ sizeCm: qrSize, restaurantName: menu.restaurant?.name });
      setStatus(`QR sheet downloaded: ${layout.count} codes at ${layout.sizeCm} cm.`);
    } catch (error) {
      setStorageError(error.message);
    } finally {
      setQrBusy(false);
    }
  }

  async function onChangePassword(event) {
    event.preventDefault();
    const result = await changeAdminPassword(currentPassword, nextPassword);
    setPasswordMessage(result.ok ? "Password updated on this browser." : result.error);
    if (result.ok) {
      setCurrentPassword("");
      setNextPassword("");
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-ink/55">{label}</p>
            <p className="mt-1 font-display text-2xl break-all">{value}</p>
          </article>
        ))}
      </div>

      <LiveMenuCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-terracotta">
            <QrCode className="h-5 w-5" />
            <h2 className="font-display text-2xl text-ink">Print table QR codes</h2>
          </div>
          <p className="mt-2 text-sm text-ink/70">
            Choose a square size in centimetres. We fit as many as will sit on one A4 page, then you can print the PDF.
          </p>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-ink/65">QR size (cm)</span>
            <input
              type="number"
              min="3"
              max="12"
              step="0.5"
              value={qrSize}
              onChange={(event) => setQrSize(Number(event.target.value) || 6)}
              className="h-11 w-full rounded-xl bg-card-2 px-3"
            />
          </label>
          <p className="mt-2 text-sm text-ink/60">
            {layout.cols} × {layout.rows} = <strong>{layout.count}</strong> codes on one A4 sheet.
          </p>
          <button
            type="button"
            disabled={qrBusy}
            onClick={downloadQr}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {qrBusy ? "Preparing PDF…" : "Download QR PDF"}
          </button>
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-display text-2xl">Download menu PDF</h2>
          <p className="mt-2 text-sm text-ink/70">
            Choose a cafe theme, preview the A4 pages, then download. Only active dishes are included.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => setPdfOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Download menu PDF
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-card px-4 text-sm sm:w-auto"
              onClick={() => {
                applyAndPublish((draft) => {
                  for (const item of draft.items) item.isActive = true;
                  for (const category of draft.categories) category.isActive = true;
                });
              }}
            >
              Add all items to the public menu
            </button>
          </div>
        </article>
      </div>

      <form onSubmit={onChangePassword} className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="font-display text-2xl">Change password</h2>
        <p className="mt-1 text-sm text-ink/65">Enter the current password, then a new one. It is stored on this browser.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Current password"
            className="h-11 rounded-xl bg-card-2 px-3"
            required
          />
          <input
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            placeholder="New password (8+ characters)"
            className="h-11 rounded-xl bg-card-2 px-3"
            required
          />
        </div>
        {passwordMessage && <p className="mt-3 text-sm text-ink/80">{passwordMessage}</p>}
        <button type="submit" className="mt-4 min-h-11 rounded-full bg-terracotta px-4 text-sm text-white">
          Update password
        </button>
      </form>
      {pdfOpen && <MenuPdfDialog menu={menu} onClose={() => setPdfOpen(false)} />}
    </section>
  );
}

function LiveMenuCard() {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-terracotta">
        <Cloud className="h-5 w-5" />
        <h2 className="font-display text-2xl text-ink">Live menu</h2>
      </div>
      <p className="mt-2 text-sm text-ink/70">
        Active, featured, prices, and photos save to Firebase as soon as you click them. Guest phones pick up those
        changes. You do not need a GitHub token and you do not rebuild GitHub Pages for small edits.
      </p>
    </article>
  );
}

function ItemManager() {
  const { menu, updateMenu, applyAndPublish, commitMenu, makeId } = useMenuDraft();
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [comboOpen, setComboOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (menu.items || []).filter((item) => {
      if (categoryId && item.categoryId !== categoryId) return false;
      if (activeFilter === "active" && !item.isActive) return false;
      if (activeFilter === "inactive" && item.isActive) return false;
      if (featuredFilter === "featured" && !item.isFeatured) return false;
      if (featuredFilter === "not-featured" && item.isFeatured) return false;
      if (!needle) return true;
      return `${item.name} ${item.nameHi} ${item.description} ${(item.tags || []).join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [menu.items, query, categoryId, activeFilter, featuredFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const current = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  const categoryMap = getCategoryMap(menu);

  useEffect(() => {
    setPage(1);
  }, [query, categoryId, activeFilter, featuredFilter]);

  function toggle(id) {
    setSelected((currentSet) => {
      const next = new Set(currentSet);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(active) {
    const ids = new Set(selected);
    applyAndPublish((draft) => {
      for (const item of draft.items) {
        if (ids.has(item.id)) item.isActive = active;
      }
    });
    setSelected(new Set());
  }

  function removeItems(ids) {
    updateMenu((draft) => {
      draft.items = draft.items.filter((item) => !ids.includes(item.id));
    });
    setSelected(new Set());
  }

  function duplicate(item) {
    const copy = {
      ...item,
      id: makeId(`${item.id}-copy`),
      name: `${item.name} copy`,
      isActive: false,
      isFeatured: false,
    };
    updateMenu((draft) => {
      draft.items.push(copy);
    });
    setEditing(copy);
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items"
          className="h-11 min-w-[12rem] flex-1 rounded-full bg-white px-4 text-sm"
        />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 rounded-full bg-white px-3 text-sm">
          <option value="">All categories</option>
          {menu.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)} className="h-11 rounded-full bg-white px-3 text-sm">
          <option value="all">Active and inactive</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={featuredFilter} onChange={(event) => setFeaturedFilter(event.target.value)} className="h-11 rounded-full bg-white px-3 text-sm">
          <option value="all">All featured states</option>
          <option value="featured">Featured</option>
          <option value="not-featured">Not featured</option>
        </select>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white"
          onClick={() =>
            setEditing({
              id: "",
              name: "",
              nameHi: "",
              description: "",
              categoryId: menu.categories[0]?.id || "",
              price: 0,
              image: "",
              tags: [],
              spiceLevel: "",
              isActive: false,
              isFeatured: false,
              sortOrder: (menu.items.length || 0) + 1,
              variants: [],
            })
          }
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm"
          onClick={() => setComboOpen(true)}
        >
          <Plus className="h-4 w-4" /> Create combo
        </button>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <button type="button" className="rounded-full bg-card px-3 py-2" onClick={() => bulk(true)}>
            Activate selected
          </button>
          <button type="button" className="rounded-full bg-card px-3 py-2" onClick={() => bulk(false)}>
            Deactivate selected
          </button>
          <button
            type="button"
            className="rounded-full bg-terracotta px-3 py-2 text-white"
            onClick={() =>
              setConfirm({
                title: `Delete ${selected.size} items?`,
                message: "These items will be removed from your draft. Export and deploy to update the public menu.",
                confirmLabel: "Delete items",
                action: () => removeItems([...selected]),
              })
            }
          >
            Delete selected
          </button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-card-2 text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <th className="p-3">
                <span className="sr-only">Select</span>
              </th>
              <th className="p-3">Item</th>
              <th className="p-3">Category</th>
              <th className="p-3">Price</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {current.map((item) => (
              <tr key={item.id} className="border-t border-card">
                <td className="p-3">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} aria-label={`Select ${item.name}`} />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <DishImage item={item} category={categoryMap.get(item.categoryId)} className="h-12 w-12 rounded-xl" width={48} height={48} />
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-ink/50">{item.id}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">{categoryMap.get(item.categoryId)?.name}</td>
                <td className="p-3">{formatPrice(item.price, menu.restaurant.currency)}</td>
                <td className="p-3">
                  {item.isActive ? "Active" : "Inactive"}
                  {item.isFeatured ? " · Featured" : ""}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <IconButton label="Edit" onClick={() => setEditing(item)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Duplicate" onClick={() => duplicate(item)}>
                      <Copy className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={item.isActive ? "Deactivate" : "Activate"}
                      onClick={() =>
                        applyAndPublish((draft) => {
                          const target = draft.items.find((entry) => entry.id === item.id);
                          if (target) target.isActive = !target.isActive;
                        })
                      }
                    >
                      {item.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconButton>
                    <IconButton
                      label={item.isFeatured ? "Unmark featured" : "Mark featured"}
                      onClick={() =>
                        applyAndPublish((draft) => {
                          const target = draft.items.find((entry) => entry.id === item.id);
                          if (target) target.isFeatured = !target.isFeatured;
                        })
                      }
                    >
                      <Star className={`h-4 w-4 ${item.isFeatured ? "fill-terracotta text-terracotta" : ""}`} />
                    </IconButton>
                    <IconButton
                      label="Delete"
                      onClick={() =>
                        setConfirm({
                          title: `Delete ${item.name}?`,
                          message: "This item will be removed from your draft. Export and deploy to update the public menu.",
                          confirmLabel: "Delete Item",
                          action: () => removeItems([item.id]),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <p>
          {filtered.length} items · page {page} of {pages}
        </p>
        <div className="flex gap-2">
          <button type="button" className="rounded-full bg-card px-3 py-2" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <button type="button" className="rounded-full bg-card px-3 py-2" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
            Next
          </button>
        </div>
      </div>

      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
      {comboOpen && (
        <ComboEditor
          menu={menu}
          makeId={makeId}
          onClose={() => setComboOpen(false)}
          onSave={async (item) => {
            const next = { ...menu, items: [...menu.items, item] };
            await commitMenu(next, { message: "Combo saved." });
            setComboOpen(false);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || "Delete Item"}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action?.();
          setConfirm(null);
        }}
      />
    </section>
  );
}

function IconButton({ children, onClick, label }) {
  return (
    <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card" onClick={onClick} aria-label={label}>
      {children}
    </button>
  );
}

function ItemEditor({ item, onClose }) {
  const { menu, commitMenu, makeId } = useMenuDraft();
  const isNew = !item.id || !menu.items.some((entry) => entry.id === item.id);
  const [form, setForm] = useState(() => ({
    ...item,
    tagsText: (item.tags || []).join(", "),
    variantText: (item.variants || []).map((variant) => `${variant.name}:${variant.price}`).join("\n"),
  }));
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const invalid = validateImageFile(file);
    if (invalid) {
      setImageError(invalid);
      return;
    }
    setUploading(true);
    setImageError("");
    try {
      const imagePath = await uploadMenuImage(file);
      setField("image", imagePath);
    } catch (uploadError) {
      setImageError(uploadError.message || "The image could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const tags = form.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    const variants = form.variantText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, price] = line.split(":");
        return {
          id: `${slugify(form.name || "item")}-${slugify(name || "variant")}`,
          name: (name || "").trim(),
          price: Number(price),
        };
      });
    const next = {
      id: form.id || makeId(form.name),
      categoryId: form.categoryId,
      name: form.name.trim(),
      nameHi: form.nameHi.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      image: form.image || `/images/fallbacks/${form.categoryId}.svg`,
      tags,
      spiceLevel: form.spiceLevel || "",
      isActive: Boolean(form.isActive),
      isFeatured: Boolean(form.isFeatured),
      sortOrder: Number(form.sortOrder) || 1,
      variants,
    };
    const draft = {
      ...menu,
      items: isNew ? [...menu.items, next] : menu.items.map((entry) => (entry.id === item.id ? next : entry)),
    };
    const result = validateMenu(draft);
    if (!result.ok) {
      setError(result.errors[0]);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const committed = await commitMenu(draft, {
        message: "Item saved. The photo publishes with the live menu until you change or remove it.",
      });
      if (!committed.ok) {
        setError(committed.errors?.[0] || "The item could not be saved.");
        return;
      }
      if (!committed.persisted) {
        setError("The price was kept here, but guests did not get it. Sign out, sign in, and Save again.");
        return;
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message || "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close editor" onClick={onClose} />
      <form
        className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-ivory p-5 shadow-xl sm:rounded-3xl"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <h2 className="font-display text-2xl">{isNew ? "Add item" : "Edit item"}</h2>
        <p className="mt-1 text-sm text-ink/60">New items stay inactive until you activate them.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            <input required value={form.name} onChange={(event) => setField("name", event.target.value)} className="field" />
          </Field>
          <Field label="Hindi name">
            <input value={form.nameHi} onChange={(event) => setField("nameHi", event.target.value)} className="field" />
          </Field>
          <Field label="Category">
            <select value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)} className="field">
              {menu.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Base price (INR)">
            <input type="number" min="0" step="1" value={form.price} onChange={(event) => setField("price", event.target.value)} className="field" />
          </Field>
          <Field label="Spice level">
            <select value={form.spiceLevel} onChange={(event) => setField("spiceLevel", event.target.value)} className="field">
              <option value="">None listed</option>
              <option value="none">Not spicy</option>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
            </select>
          </Field>
          <Field label="Display order">
            <input type="number" value={form.sortOrder} onChange={(event) => setField("sortOrder", event.target.value)} className="field" />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={form.description} onChange={(event) => setField("description", event.target.value)} className="field min-h-24" />
        </Field>
        <Field label="Tags, comma separated">
          <input value={form.tagsText} onChange={(event) => setField("tagsText", event.target.value)} className="field" />
        </Field>
        <Field label="Variants, one per line as Name:Price">
          <textarea
            value={form.variantText}
            onChange={(event) => setField("variantText", event.target.value)}
            className="field min-h-24"
            placeholder="Half:160&#10;Full:220"
          />
        </Field>
        <Field label="Image path">
          {String(form.image || "").startsWith("data:image/") || String(form.image || "").startsWith("fbimg:") ? (
            <p className="rounded-xl bg-white px-3 py-3 text-sm text-ink/70">
              {String(form.image || "").startsWith("fbimg:")
                ? "Photo saved in the live database as compressed base64."
                : "Embedded photo (base64). Guests receive it with the live menu."}
            </p>
          ) : (
            <input value={form.image} onChange={(event) => setField("image", event.target.value)} className="field" />
          )}
        </Field>
        <div className="mt-2 flex items-center gap-3">
          <DishImage item={form} width={72} height={72} className="h-16 w-16 rounded-2xl" />
          <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm ${uploading ? "opacity-60" : ""}`}>
            <ImagePlus className="h-4 w-4" />
            {uploading ? "Saving image…" : "Upload image"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
        </div>
        {form.image?.startsWith("/images/menu/") && (
          <p className="mt-1 text-xs text-ink/55">Saved to {form.image}.</p>
        )}
        {String(form.image || "").startsWith("fbimg:") && (
          <p className="mt-1 text-xs text-ink/55">Photo stored in Firebase as base64. Guests see it without a rebuild.</p>
        )}
        {(form.image?.startsWith("/images/menu/") ||
          String(form.image || "").startsWith("data:image/") ||
          String(form.image || "").startsWith("fbimg:") ||
          String(form.image || "").includes("firebasestorage")) && (
          <button
            type="button"
            className="mt-1 text-sm text-terracotta"
            onClick={() => setField("image", `/images/fallbacks/${form.categoryId}.svg`)}
          >
            Remove uploaded image
          </button>
        )}
        {form.image?.startsWith("draft:") && (
          <p className="mt-1 text-sm text-red-700">This image is not in the project folder yet. Upload it again to save it.</p>
        )}
        {imageError && <p className="text-sm text-red-700">{imageError}</p>}
        <div className="mt-3 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setField("isActive", event.target.checked)} />
            Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} />
            Featured
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="min-h-11 rounded-full bg-card px-4" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={uploading || saving} className="min-h-11 rounded-full bg-terracotta px-4 text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save item"}
          </button>
        </div>
      </form>
      <style>{`.field{width:100%;border-radius:0.9rem;background:#fff;padding:0.7rem 0.85rem;font-size:0.9rem}`}</style>
    </div>
  );
}

function CategoryManager() {
  const { menu, updateMenu, applyAndPublish, commitMenu, makeId } = useMenuDraft();
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [openId, setOpenId] = useState("");
  const [editing, setEditing] = useState(null);
  const [comboOpen, setComboOpen] = useState(false);

  function addCategory(event) {
    event.preventDefault();
    if (!form.name.trim()) return;
    const id = makeId(form.name);
    updateMenu((draft) => {
      draft.categories.push({
        id,
        name: form.name.trim(),
        description: form.description.trim(),
        isActive: true,
        sortOrder: draft.categories.length + 1,
      });
    });
    setForm({ name: "", description: "" });
    setOpenId(id);
  }

  function move(id, direction) {
    updateMenu((draft) => {
      const list = [...draft.categories].sort((a, b) => a.sortOrder - b.sortOrder);
      const index = list.findIndex((category) => category.id === id);
      const swap = index + direction;
      if (swap < 0 || swap >= list.length) return;
      const current = list[index].sortOrder;
      list[index].sortOrder = list[swap].sortOrder;
      list[swap].sortOrder = current;
    });
  }

  return (
    <section className="mt-6">
      <div className="flex flex-wrap gap-2">
        <form onSubmit={addCategory} className="grid min-w-[16rem] flex-1 gap-2 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]">
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Category name" className="h-11 rounded-xl bg-card-2 px-3" />
          <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="h-11 rounded-xl bg-card-2 px-3" />
          <button type="submit" className="min-h-11 rounded-full bg-terracotta px-4 text-white">
            Add category
          </button>
        </form>
        <button type="button" className="min-h-11 rounded-full bg-card px-4 text-sm" onClick={() => setComboOpen(true)}>
          Create combo
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {menu.categories
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((category) => {
            const items = menu.items.filter((item) => item.categoryId === category.id);
            const open = openId === category.id;
            return (
              <li key={category.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-4 text-left"
                  onClick={() => setOpenId(open ? "" : category.id)}
                >
                  <ChevronDown className={`h-5 w-5 shrink-0 text-terracotta transition ${open ? "rotate-180" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{category.name}</span>
                    <span className="text-xs text-ink/50">
                      {items.length} items · {category.isActive ? "Visible" : "Hidden"}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="border-t border-card px-4 pb-4 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={category.name}
                        onChange={(event) =>
                          updateMenu((draft) => {
                            const target = draft.categories.find((entry) => entry.id === category.id);
                            if (target) target.name = event.target.value;
                          })
                        }
                        className="h-11 rounded-xl bg-card-2 px-3 font-medium"
                      />
                      <textarea
                        value={category.description}
                        onChange={(event) =>
                          updateMenu((draft) => {
                            const target = draft.categories.find((entry) => entry.id === category.id);
                            if (target) target.description = event.target.value;
                          })
                        }
                        className="min-h-11 rounded-xl bg-card-2 px-3 py-2 text-sm text-ink/70"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="rounded-full bg-card px-3 py-2 text-sm" onClick={() => move(category.id, -1)}>
                        Up
                      </button>
                      <button type="button" className="rounded-full bg-card px-3 py-2 text-sm" onClick={() => move(category.id, 1)}>
                        Down
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-card px-3 py-2 text-sm"
                        onClick={() =>
                          applyAndPublish((draft) => {
                            const target = draft.categories.find((entry) => entry.id === category.id);
                            if (target) target.isActive = !target.isActive;
                          })
                        }
                      >
                        {category.isActive ? "Hide category" : "Show category"}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-terracotta px-3 py-2 text-sm text-white"
                        onClick={() =>
                          setEditing({
                            id: "",
                            name: "",
                            nameHi: "",
                            description: "",
                            categoryId: category.id,
                            price: 0,
                            image: "",
                            tags: [],
                            spiceLevel: "",
                            isActive: true,
                            isFeatured: false,
                            sortOrder: items.length + 1,
                            variants: [],
                          })
                        }
                      >
                        Add item
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-terracotta px-3 py-2 text-sm text-white"
                        onClick={() => {
                          if (items.length > 0) {
                            setConfirm({
                              title: `Cannot delete ${category.name} yet`,
                              message: "Reassign or delete its items first.",
                              confirmLabel: "OK",
                              action: () => {},
                            });
                            return;
                          }
                          setConfirm({
                            title: `Delete ${category.name}?`,
                            message: "This category will be removed from your draft.",
                            confirmLabel: "Delete category",
                            action: () =>
                              updateMenu((draft) => {
                                draft.categories = draft.categories.filter((entry) => entry.id !== category.id);
                              }),
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                    <ul className="mt-3 divide-y divide-card rounded-xl bg-card-2">
                      {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                          <DishImage item={item} category={category} className="h-10 w-10 rounded-lg" width={40} height={40} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-ink/55">
                              {formatPrice(item.price, menu.restaurant.currency)} · {item.isActive ? "Active" : "Hidden"}
                              {item.comboItems?.length ? " · Combo" : ""}
                            </p>
                          </div>
                          <IconButton label="Edit" onClick={() => setEditing(item)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label={item.isActive ? "Deactivate" : "Activate"}
                            onClick={() =>
                              applyAndPublish((draft) => {
                                const target = draft.items.find((entry) => entry.id === item.id);
                                if (target) target.isActive = !target.isActive;
                              })
                            }
                          >
                            {item.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </IconButton>
                          <IconButton
                            label="Delete"
                            onClick={() =>
                              setConfirm({
                                title: `Delete ${item.name}?`,
                                message: "This item will be removed from your draft.",
                                confirmLabel: "Delete Item",
                                action: () =>
                                  updateMenu((draft) => {
                                    draft.items = draft.items.filter((entry) => entry.id !== item.id);
                                  }),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </li>
                      ))}
                      {items.length === 0 && <li className="px-3 py-4 text-sm text-ink/55">No items in this category yet.</li>}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
      </ul>
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} />}
      {comboOpen && (
        <ComboEditor
          menu={menu}
          makeId={makeId}
          onClose={() => setComboOpen(false)}
          onSave={async (item) => {
            const next = { ...menu, items: [...menu.items, item] };
            await commitMenu(next, { message: "Combo saved." });
            setComboOpen(false);
            setOpenId(item.categoryId);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.action?.();
          setConfirm(null);
        }}
      />
    </section>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="mt-3 block text-sm">
      <span className="mb-1 block text-ink/70">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
