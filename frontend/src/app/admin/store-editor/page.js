"use client";

/* ==========================================================
   STORE EDITOR (/admin/store-editor) — Shopify-style theme editor
   ----------------------------------------------------------
   Left: sections / theme / menus (schema-driven forms — backend
   GET /theme/schema). Right: live storefront iframe (postMessage).
   Draft autosave (1.5s debounce, optimistic revision → 409 conflict),
   Publish = storefront par live, Versions = restore into draft.
   Full-screen: AdminLayoutClient is route par sidebar/navbar skip karta hai.
   ========================================================== */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CloudOff,
  ExternalLink,
  CalendarClock,
  History,
  Link2,
  LayoutList,
  Loader2,
  Lock,
  Menu as MenuIcon,
  Monitor,
  Palette,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  X,
} from "lucide-react";
import { themeApi, apiError } from "@/apis/admin/themeApi";
import { useAdminSocket } from "@/hooks/admin/useAdminSocket";
import { useThemeEditorStore } from "./useThemeEditorStore";
import { SectionList, SectionSettings, ThemeSettings, MenuEditor, VersionsPanel } from "./components/panels";
import PreviewFrame from "./components/PreviewFrame";
import { ScheduleDialog, ShareDialog, ScheduleBanner } from "./components/PublishTools";
import { ProductTemplatePanel, ProductBlockSettings } from "./components/productPanel";
import { adminProductApi } from "@/apis/admin/productApi";

const AUTOSAVE_MS = 1500;

const TABS = [
  { id: "sections", label: "Sections", icon: LayoutList },
  { id: "theme", label: "Theme", icon: Palette },
  { id: "menus", label: "Menus", icon: MenuIcon },
];

const DEVICES = [
  { id: "desktop", icon: Monitor, label: "Desktop" },
  { id: "tablet", icon: Tablet, label: "Tablet" },
  { id: "mobile", icon: Smartphone, label: "Mobile" },
];

function FullScreenMessage({ icon: Icon, title, children }) {
  return (
    <div className="flex h-screen items-center justify-center bg-page p-6">
      <div className="max-w-md rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <Icon className="mx-auto mb-3 text-fg-muted" size={28} />
        <h1 className="text-lg font-bold text-fg">{title}</h1>
        <div className="mt-2 text-sm text-fg-muted">{children}</div>
        <Link href="/admin/dashboard" className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function SaveIndicator({ state, dirty, error }) {
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs text-danger" title={error || ""}><CloudOff size={13} /> Not saved</span>;
  if (state === "conflict") return <span className="inline-flex items-center gap-1.5 text-xs text-warning"><CloudOff size={13} /> Conflict</span>;
  if (dirty) return <span className="text-xs text-fg-muted">Unsaved changes</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-success"><Check size={13} /> Draft saved</span>;
  return null;
}

export default function StoreEditorPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("sections");
  const [device, setDevice] = useState("desktop");
  // Kaun sa page edit ho raha hai: homepage sections ya product page template
  const [editPage, setEditPage] = useState("home");
  const [showVersions, setShowVersions] = useState(false);
  const [dialog, setDialog] = useState(null); // "schedule" | "share" | null
  // Schedule / preview-link responses — sirf ye fields override (draft reload NAHI → undo history safe)
  const [publishMeta, setPublishMeta] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);

  const store = useThemeEditorStore();
  const { draft, revision, dirty, saveState, saveError, selected, past, future } = store;

  const schemaQuery = useQuery({ queryKey: ["themeSchema"], queryFn: themeApi.getSchema, staleTime: Infinity });
  const themeQuery = useQuery({ queryKey: ["theme"], queryFn: themeApi.getTheme, refetchOnWindowFocus: false, retry: false });
  const versionsQuery = useQuery({ queryKey: ["themeVersions"], queryFn: themeApi.listVersions, enabled: showVersions });

  const meta = themeQuery.data;

  const sampleProductQuery = useQuery({
    queryKey: ["storeEditor", "sampleProduct"],
    queryFn: () => adminProductApi.getPaginated({ page: 1, limit: 1 }),
    enabled: editPage === "product",
    staleTime: 5 * 60 * 1000,
  });
  const sampleProductId = sampleProductQuery.data?.products?.[0]?._id || null;
  const previewSrc = editPage === "product" && sampleProductId ? `/product/${sampleProductId}?preview=1` : "/?preview=1";

  // ── Server data → editor state (pehli baar / reload / restore) ──
  const loadedAt = useRef(null);
  useEffect(() => {
    if (!meta || loadedAt.current === themeQuery.dataUpdatedAt) return;
    loadedAt.current = themeQuery.dataUpdatedAt;
    useThemeEditorStore.getState().load({ draft: meta.draft, revision: meta.draftRevision });
  }, [meta, themeQuery.dataUpdatedAt]);

  const applyServerTheme = useCallback(
    (data) => {
      setPublishMeta(null); // fresh server data me schedule / links bhi hain
      queryClient.setQueryData(["theme"], data);
    },
    [queryClient],
  );

  // ── Autosave (debounced) ──
  const saveNow = useCallback(async () => {
    const s = useThemeEditorStore.getState();
    if (!s.draft || !s.dirty || s.saveState === "conflict") return true;
    const snapshot = s.draft;
    s.markSaving();
    try {
      const res = await themeApi.saveDraft({ data: snapshot, baseRevision: s.revision });
      useThemeEditorStore.getState().markSaved(res.draftRevision, snapshot);
      return true;
    } catch (error) {
      const e = apiError(error);
      if (e.code === "THEME_REVISION_CONFLICT") {
        useThemeEditorStore.getState().markSaveError("conflict", e.message);
      } else {
        useThemeEditorStore.getState().markSaveError("error", e.errors?.[0] || e.message);
        toast.error(e.errors?.[0] || e.message);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    if (!dirty || saveState === "conflict" || saveState === "saving") return undefined;
    const timer = setTimeout(saveNow, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, dirty, saveState, saveNow]);

  // Unsaved tab close warning
  useEffect(() => {
    const onBeforeUnload = (event) => {
      const s = useThemeEditorStore.getState();
      if (s.dirty || s.saveState === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Undo / redo shortcuts (inputs ke andar browser ka apna undo)
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
      event.preventDefault();
      if (event.shiftKey) useThemeEditorStore.getState().redo();
      else useThemeEditorStore.getState().undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Doosre admin ne publish kiya → meta refresh (draft overwrite nahi)
  const { socket } = useAdminSocket();
  useEffect(() => {
    if (!socket) return undefined;
    const onPublished = () => queryClient.invalidateQueries({ queryKey: ["themeVersions"] });
    socket.on("themePublished", onPublished);
    return () => socket.off("themePublished", onPublished);
  }, [socket, queryClient]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const ok = await saveNow();
      if (!ok) throw new Error(useThemeEditorStore.getState().saveError || "Save the draft first");
      return themeApi.publish();
    },
    onSuccess: (data) => {
      applyServerTheme(data);
      queryClient.invalidateQueries({ queryKey: ["themeVersions"] });
      toast.success("Published — your store is updated");
    },
    onError: (error) => toast.error(apiError(error).errors?.[0] || apiError(error).message),
  });

  const discardMutation = useMutation({
    mutationFn: themeApi.discard,
    onSuccess: (data) => {
      applyServerTheme(data);
      toast.success("Changes discarded");
    },
    onError: (error) => toast.error(apiError(error).message),
  });

  // Publish / discard / restore ke baad server meta fresh — local override hatao
  const metaSchedule = publishMeta ? publishMeta.scheduled : themeQuery.data?.scheduled;
  const metaPreviewLinks = (publishMeta ? publishMeta.previewLinks : themeQuery.data?.previewLinks) || [];
  const metaScheduleError = publishMeta ? publishMeta.lastScheduleError : themeQuery.data?.lastScheduleError;
  const takeMeta = (data) =>
    data && setPublishMeta({ scheduled: data.scheduled || null, previewLinks: data.previewLinks || [], lastScheduleError: data.lastScheduleError || null });

  const cancelScheduleMutation = useMutation({
    mutationFn: themeApi.cancelSchedule,
    onSuccess: (data) => {
      takeMeta(data);
      toast.success("Schedule cancelled");
    },
    onError: (error) => toast.error(apiError(error).message),
  });

  const restoreMutation = useMutation({
    mutationFn: themeApi.restoreVersion,
    onSuccess: (data, version) => {
      applyServerTheme(data);
      setShowVersions(false);
      toast.success(`Version ${version} restored to draft — publish to make it live`);
    },
    onError: (error) => toast.error(apiError(error).message),
  });

  const reloadAfterConflict = () => {
    useThemeEditorStore.getState().markSaveError("idle", null);
    themeQuery.refetch();
    setPreviewKey((k) => k + 1);
  };

  // ── Error states ──
  const loadError = themeQuery.error ? apiError(themeQuery.error) : null;
  if (loadError?.code === "PLAN_FEATURE_DISABLED") {
    return (
      <FullScreenMessage icon={Lock} title="Store editor isn't in your plan">
        {loadError.message} Contact the platform team to upgrade.
      </FullScreenMessage>
    );
  }
  if (loadError?.status === 403) {
    return <FullScreenMessage icon={Lock} title="Access denied">{loadError.message}</FullScreenMessage>;
  }
  if (loadError || schemaQuery.error) {
    return (
      <FullScreenMessage icon={CloudOff} title="Couldn't load the editor">
        {(loadError || apiError(schemaQuery.error)).message}
      </FullScreenMessage>
    );
  }

  const schema = schemaQuery.data;
  if (!schema || !draft) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <Loader2 className="animate-spin text-fg-muted" size={24} />
      </div>
    );
  }

  const busy = publishMutation.isPending || discardMutation.isPending || restoreMutation.isPending;
  const hasUnpublished = dirty || saveState === "saving" || meta?.hasUnpublishedChanges || saveState === "saved";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-page text-fg">
      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card px-3 sm:px-4">
        <Link href="/admin/dashboard" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Exit editor">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">Store editor</p>
          <SaveIndicator state={saveState} dirty={dirty} error={saveError} />
        </div>

        <div className="ms-2 flex items-center gap-1 rounded-lg bg-subtle p-1">
          {[
            { id: "home", label: "Homepage" },
            { id: "product", label: "Product page" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setEditPage(opt.id);
                store.select(null);
              }}
              className={`h-7 rounded-md px-2.5 text-xs font-semibold transition ${editPage === opt.id ? "bg-card text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mx-auto hidden items-center gap-1 rounded-lg bg-subtle p-1 md:flex">
          {DEVICES.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDevice(id)}
              aria-label={label}
              title={label}
              className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition ${device === id ? "bg-card text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-1.5 md:ms-0">
          <button type="button" onClick={store.undo} disabled={!past.length} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-30" title="Undo (Ctrl+Z)">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={store.redo} disabled={!future.length} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
            <Redo2 size={16} />
          </button>
          <button type="button" onClick={() => setShowVersions(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg" title="Version history">
            <History size={16} />
          </button>
          <button type="button" onClick={() => setDialog("share")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg" title="Share preview link">
            <Link2 size={16} />
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer" className="hidden h-9 w-9 items-center justify-center rounded-lg text-fg-muted hover:bg-subtle hover:text-fg sm:inline-flex" title="Open live store">
            <ExternalLink size={16} />
          </a>
          <button
            type="button"
            disabled={busy || !meta?.hasUnpublishedChanges}
            onClick={() => {
              if (window.confirm("Discard all unpublished changes?")) discardMutation.mutate();
            }}
            className="hidden h-9 rounded-lg px-3 text-sm font-semibold text-fg-secondary hover:bg-subtle disabled:opacity-40 sm:inline-flex sm:items-center"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={busy || saveState === "conflict" || !hasUnpublished}
            onClick={() => publishMutation.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg shadow-sm hover:bg-accent-hover disabled:opacity-50"
          >
            {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            Publish
          </button>
          <button
            type="button"
            disabled={busy || saveState === "conflict"}
            onClick={() => setDialog("schedule")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-fg-secondary hover:bg-subtle disabled:opacity-50"
            title="Schedule publish"
          >
            <CalendarClock size={16} />
          </button>
        </div>
      </header>

      <ScheduleBanner
        scheduled={metaSchedule}
        lastError={metaScheduleError}
        cancelling={cancelScheduleMutation.isPending}
        onCancel={() => window.confirm("Cancel the scheduled publish?") && cancelScheduleMutation.mutate()}
      />
      {dialog === "schedule" ? <ScheduleDialog onClose={() => setDialog(null)} onSaveDraft={saveNow} onDone={takeMeta} /> : null}
      {dialog === "share" ? (
        <ShareDialog onClose={() => setDialog(null)} onSaveDraft={saveNow} activeLinks={metaPreviewLinks.length} onChanged={takeMeta} />
      ) : null}

      {saveState === "conflict" ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
          <span>Someone else changed this theme. Reload to get their changes (your unsaved edits will be lost).</span>
          <button type="button" onClick={reloadAfterConflict} className="shrink-0 rounded-md bg-warning-solid px-3 py-1 text-xs font-bold text-fg-inverse">
            Reload
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar ── */}
        <aside className="flex w-full shrink-0 flex-col border-e border-line bg-card md:w-[340px]">
          {selected?.kind === "productBlock" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ProductBlockSettings schema={schema} zone={selected.zone} id={selected.id} onBack={() => store.select(null)} />
            </div>
          ) : editPage === "product" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {!sampleProductQuery.isLoading && !sampleProductId ? (
                <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Add a product to see the product page preview.</p>
              ) : null}
              <ProductTemplatePanel schema={schema} />
            </div>
          ) : selected?.kind === "section" ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <SectionSettings schema={schema} id={selected.id} onBack={() => store.select(null)} />
            </div>
          ) : (
            <>
              <nav className="flex shrink-0 border-b border-line">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-semibold transition ${
                      tab === id ? "border-accent text-accent" : "border-transparent text-fg-muted hover:text-fg"
                    }`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </nav>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {tab === "sections" ? <SectionList schema={schema} /> : null}
                {tab === "theme" ? <ThemeSettings schema={schema} /> : null}
                {tab === "menus" ? <MenuEditor schema={schema} /> : null}
              </div>
            </>
          )}
          <p className="shrink-0 border-t border-line px-4 py-2 text-[11px] text-fg-muted">
            Changes save as a draft automatically. Customers see them after you publish.{" "}
            <Link href="/admin/pages" className="font-semibold text-accent hover:underline">
              Manage pages
            </Link>
          </p>
        </aside>

        {/* ── Preview ── */}
        <main className="hidden min-w-0 flex-1 overflow-hidden p-4 md:block">
          <PreviewFrame device={device} reloadKey={previewKey} src={previewSrc} />
        </main>
      </div>

      {/* ── Versions drawer ── */}
      {showVersions ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && setShowVersions(false)}>
          <div className="flex h-full w-full max-w-sm flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-bold">Version history</h2>
              <button type="button" onClick={() => setShowVersions(false)} className="rounded-md p-1 text-fg-muted hover:bg-subtle" aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <p className="mb-3 text-xs text-fg-muted">Restoring copies a version into your draft. Publish to make it live.</p>
              <VersionsPanel
                versions={versionsQuery.data}
                loading={versionsQuery.isLoading}
                restoring={restoreMutation.isPending}
                onRestore={(v) => {
                  if (!dirty || window.confirm("Replace your current draft with this version?")) restoreMutation.mutate(v);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
