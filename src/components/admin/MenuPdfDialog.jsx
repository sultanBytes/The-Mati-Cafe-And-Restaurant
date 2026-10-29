import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";
import { A4_HEIGHT_PX, A4_WIDTH_PX } from "../../lib/menuPdfTemplate.js";
import { MENU_THEMES } from "../../lib/menuThemes.js";
import { downloadThemedMenuPdf, prepareThemedMenuPdf } from "../../lib/pdfExport.js";
import { withBase } from "../../lib/urls.js";

export default function MenuPdfDialog({ menu, onClose }) {
  const panelRef = useRef(null);
  const previewWrapRef = useRef(null);
  useFocusTrap(true, panelRef);
  const [themeId, setThemeId] = useState(MENU_THEMES[0].id);
  const [preview, setPreview] = useState({ status: "loading", html: "", pageCount: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewWidth, setPreviewWidth] = useState(320);

  const theme = useMemo(() => MENU_THEMES.find((entry) => entry.id === themeId) || MENU_THEMES[0], [themeId]);
  const scale = Math.max(0.22, Math.min(1, previewWidth / A4_WIDTH_PX));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const node = previewWrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0]?.contentRect.width || node.clientWidth || 320);
      setPreviewWidth(Math.max(220, width));
    });
    observer.observe(node);
    setPreviewWidth(Math.max(220, Math.floor(node.clientWidth || 320)));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreview({ status: "loading", html: "", pageCount: 0 });
    setError("");
    prepareThemedMenuPdf(menu, themeId)
      .then((prepared) => {
        if (cancelled) return;
        setPreview({ status: "ready", html: prepared.html, pageCount: prepared.pageCount });
      })
      .catch((loadError) => {
        if (cancelled) return;
        setPreview({ status: "error", html: "", pageCount: 0 });
        setError(loadError.message || "The preview could not be built.");
      });
    return () => {
      cancelled = true;
    };
  }, [menu, themeId]);

  async function onDownload() {
    setBusy(true);
    setError("");
    try {
      await downloadThemedMenuPdf(menu, themeId);
    } catch (downloadError) {
      setError(downloadError.message || "The PDF could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close PDF dialog" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-pdf-title"
        className="relative flex h-dvh min-h-0 w-full min-w-0 flex-col overflow-hidden bg-ivory shadow-xl sm:h-auto sm:max-h-[min(94dvh,920px)] sm:max-w-5xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-card px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 id="menu-pdf-title" className="font-display text-xl leading-tight sm:text-2xl">
              Download menu PDF
            </h2>
            <p className="mt-1 text-sm text-ink/65">
              Active dishes only, grouped by category. Preview and PDF use the same template.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <button type="button" className="min-h-11 rounded-full bg-card px-4 text-sm" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              disabled={busy || preview.status !== "ready"}
              onClick={onDownload}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-terracotta px-4 text-sm text-white disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {busy ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pb-3 pt-3 sm:px-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">Theme</p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {MENU_THEMES.map((entry) => {
                const selected = entry.id === themeId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setThemeId(entry.id)}
                    className={`min-w-0 rounded-xl bg-white p-1 text-left shadow-sm sm:rounded-2xl sm:p-2 ${
                      selected ? "border-2 border-terracotta" : "border-2 border-transparent"
                    }`}
                  >
                    <img
                      src={withBase(`/menu-themes/${entry.hero}`)}
                      alt=""
                      className="h-12 w-full rounded-lg object-cover sm:h-16 md:h-20 sm:rounded-xl"
                    />
                    <span className="mt-1 block text-[10px] font-medium leading-tight sm:mt-2 sm:text-xs md:text-sm">
                      {entry.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="mx-4 mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-5">{error}</p>}

          <div
            ref={previewWrapRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5"
          >
            <div className="rounded-2xl bg-white p-2 shadow-inner sm:p-3">
              {preview.status === "loading" && (
                <p className="p-8 text-center text-sm text-ink/60">Building {theme.name} preview…</p>
              )}
              {preview.status === "ready" && (
                <div
                  className="mx-auto overflow-hidden rounded-lg shadow-sm"
                  style={{
                    width: A4_WIDTH_PX * scale,
                    height: A4_HEIGHT_PX * preview.pageCount * scale,
                  }}
                >
                  <iframe
                    title={`${theme.name} menu preview`}
                    srcDoc={preview.html}
                    className="pointer-events-none origin-top-left border-0 bg-white"
                    style={{
                      width: A4_WIDTH_PX,
                      height: A4_HEIGHT_PX * preview.pageCount,
                      transform: `scale(${scale})`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
