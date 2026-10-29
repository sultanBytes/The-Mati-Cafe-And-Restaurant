import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MenuView from "../components/menu/MenuView.jsx";
import { parseTableParam } from "../lib/format.js";
import { subscribeFirebaseMenu } from "../lib/firebaseMenu.js";
import { fetchImageSources, fetchPublishedMenu, loadDraftRecord } from "../lib/menuStorage.js";
import { validateMenu } from "../lib/menuValidation.js";

export default function MenuPage() {
  const [params] = useSearchParams();
  const table = parseTableParam(params.get("table"));
  const wantDraft = params.get("preview") === "draft";
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let unsub = () => {};

    async function load() {
      try {
        const [published, imageSources] = await Promise.all([
          fetchPublishedMenu(),
          fetchImageSources(),
        ]);
        if (cancelled) return;
        if (wantDraft) {
          const draft = loadDraftRecord();
          if (draft?.menu) {
            setState({
              status: "ready",
              menu: draft.menu,
              preview: true,
              draftUnavailable: false,
              imageSources,
            });
            return;
          }
          setState({
            status: "ready",
            menu: published,
            preview: false,
            draftUnavailable: true,
            imageSources,
          });
          return;
        }
        setState({
          status: "ready",
          menu: published,
          preview: false,
          draftUnavailable: false,
          imageSources,
        });
        unsub = subscribeFirebaseMenu((live) => {
          if (cancelled || !live) return;
          const result = validateMenu(live);
          if (!result.ok) return;
          setState((current) => ({
            ...current,
            status: "ready",
            menu: live,
            preview: false,
            draftUnavailable: false,
            imageSources: current.imageSources || imageSources,
          }));
        });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error.message });
      }
    }
    load();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [wantDraft]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory text-sm text-ink/70">
        Loading the menu…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory px-6 text-center">
        <div>
          <h1 className="font-display text-2xl">The menu could not be loaded</h1>
          <p className="mt-2 text-sm text-ink/70">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <MenuView
      menu={state.menu}
      table={table}
      preview={state.preview}
      draftUnavailable={state.draftUnavailable}
      imageSources={state.imageSources}
    />
  );
}
