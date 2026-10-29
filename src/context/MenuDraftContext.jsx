import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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
  const menuRef = useRef(menu);
  const publishQueue = useRef(Promise.resolve());

  const replaceMenu = useCallback((next, { dirty: isDirty = true } = {}) => {
    const copy = cloneJson(next);
    menuRef.current = copy;
    setMenu(copy);
    setDirty(isDirty);
  }, []);

  const updateMenu = useCallback((updater) => {
    const next = cloneJson(menuRef.current);
    updater(next);
    menuRef.current = next;
    setMenu(next);
    setDirty(true);
    setStatus("");
  }, []);

  const commitMenu = useCallback(async (next, { message } = {}) => {
    const validated = cloneJson(next);
    const result = validateMenu(validated);
    if (!result.ok) {
      return { ok: false, errors: result.errors };
    }

    menuRef.current = validated;
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
      menuRef.current = cloneJson(validated);
      setMenu(cloneJson(validated));
      setDirty(false);
      if (persisted.warning) {
        setStorageError(persisted.warning);
      } else {
        setStorageError("");
      }
      const via = persisted.via || "";
      const liveMessage =
        via.includes("firebase") || via.includes("github")
          ? "Published for guests. Active, featured, prices, and photos update on the public menu without a rebuild."
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

  const applyAndPublish = useCallback(
    (updater, options) => {
      const task = publishQueue.current.then(async () => {
        const next = cloneJson(menuRef.current);
        updater(next);
        menuRef.current = next;
        setMenu(next);
        setDirty(true);
        setStatus("Saving to the live menu…");
        return commitMenu(next, options);
      });
      publishQueue.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [commitMenu],
  );

  const saveDraft = useCallback(() => commitMenu(menuRef.current), [commitMenu]);

  const discardDraft = useCallback(() => {
    clearDraftRecord();
    const restored = cloneJson(published);
    menuRef.current = restored;
    setMenu(restored);
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
      applyAndPublish,
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
      applyAndPublish,
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
