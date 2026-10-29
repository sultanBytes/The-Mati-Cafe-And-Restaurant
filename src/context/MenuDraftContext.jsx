import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cloneJson, uniqueId } from "../lib/ids.js";
import { clearDraftRecord, persistPublishedMenu, saveDraftRecord } from "../lib/menuStorage.js";
import { OWNER_REVIEW_NOTICE } from "../lib/constants.js";
import { validateMenu } from "../lib/menuValidation.js";

const MenuDraftContext = createContext(null);

export function MenuDraftProvider({ published, initialMenu, initialDraftSavedAt, children }) {
  const [menu, setMenu] = useState(() => cloneJson(initialMenu || published));
  const [dirty, setDirty] = useState(() => Boolean(initialMenu));
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraftSavedAt || null);
  const [storageError, setStorageError] = useState("");
  const [status, setStatus] = useState("");

  const replaceMenu = useCallback((next, { dirty: isDirty = true } = {}) => {
    setMenu(cloneJson(next));
    setDirty(isDirty);
  }, []);

  const updateMenu = useCallback((updater) => {
    setMenu((current) => {
      const next = cloneJson(current);
      updater(next);
      return next;
    });
    setDirty(true);
    setStatus("");
  }, []);

  const commitMenu = useCallback(async (next, { message } = {}) => {
    const validated = cloneJson(next);
    const result = validateMenu(validated);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }

    setMenu(validated);

    const local = saveDraftRecord(validated, { notice: OWNER_REVIEW_NOTICE });
    if (local.ok) {
      setDraftSavedAt(local.record.savedAt);
      setStorageError("");
    } else {
      setStorageError(local.error);
    }

    try {
      const persisted = await persistPublishedMenu(validated);
      if (persisted.revision) validated.revision = persisted.revision;
      setMenu(cloneJson(validated));
      setDirty(false);
      if (persisted.warning) {
        setStorageError(persisted.warning);
      } else {
        setStorageError("");
      }
      const via = persisted.via || "";
      const liveMessage =
        via.includes("github")
          ? "Published for guests. Prices and photos show on the public menu without a site rebuild. Refresh the guest page after a few seconds."
          : message || "Saved to the project. This stays until you change or remove it.";
      setStatus(liveMessage);
      return { ok: true, persisted: true, via, menu: validated };
    } catch (error) {
      setDirty(true);
      setStatus("");
      setStorageError(
        error.code === "LIVE_PUBLISH_NEEDED"
          ? error.message
          : `${error.message} The change is kept on this phone until you publish it.`,
      );
      return { ok: true, persisted: false, menu: validated };
    }
  }, []);

  const saveDraft = useCallback(() => commitMenu(menu), [commitMenu, menu]);

  const discardDraft = useCallback(() => {
    clearDraftRecord();
    setMenu(cloneJson(published));
    setDirty(false);
    setDraftSavedAt(null);
    setStorageError("");
    setStatus("Draft discarded. Published data reloaded.");
  }, [published]);

  const existingIds = useMemo(() => {
    return new Set([
      ...(menu.categories || []).map((category) => category.id),
      ...(menu.items || []).map((item) => item.id),
    ]);
  }, [menu]);

  const makeId = useCallback((base) => uniqueId(base, existingIds), [existingIds]);

  const value = useMemo(
    () => ({
      published,
      menu,
      dirty,
      draftSavedAt,
      storageError,
      status,
      setStatus,
      setStorageError,
      replaceMenu,
      updateMenu,
      commitMenu,
      saveDraft,
      discardDraft,
      makeId,
    }),
    [
      published,
      menu,
      dirty,
      draftSavedAt,
      storageError,
      status,
      replaceMenu,
      updateMenu,
      commitMenu,
      saveDraft,
      discardDraft,
      makeId,
    ],
  );

  return <MenuDraftContext.Provider value={value}>{children}</MenuDraftContext.Provider>;
}

export function useMenuDraft() {
  const value = useContext(MenuDraftContext);
  if (!value) throw new Error("useMenuDraft must be used inside MenuDraftProvider");
  return value;
}
