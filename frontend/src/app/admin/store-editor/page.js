"use client";

/* ==========================================================
   STORE EDITOR (/admin/store-editor) — Shopify-style theme editor
   ----------------------------------------------------------
   Layout: [icon rail] [settings panel] [live preview iframe]
   • Rail: Sections (page ke hisaab se — homepage / product / category),
     Theme settings, Menus, Pages link, shortcuts.
   • Settings forms schema-driven (backend GET /theme/schema).
   • Preview: postMessage draft + hover toolbar actions (move / hide /
     duplicate / remove / add below) → yahan handle (single source of truth).
   Draft autosave (1.5s debounce, optimistic revision → 409 conflict),
   Publish = storefront par live, Versions = restore into draft.
   Full-screen: AdminLayoutClient is route par sidebar/navbar skip karta hai.
   ========================================================== */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  CloudOff,
  ExternalLink,
  FileText,
  History,
  House,
  Keyboard,
  LayoutGrid,
  LayoutList,
  Link2,
  Loader2,
  Lock,
  Maximize2,
  Menu as MenuIcon,
  Monitor,
  Package,
  Palette,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  WifiOff,
  X,
} from "lucide-react";
import { themeApi, apiError } from "@/apis/admin/themeApi";
import { useAdminSocket } from "@/hooks/admin/useAdminSocket";
import { useThemeEditorStore } from "./useThemeEditorStore";
import { draftIssues } from "./draftIssues";
import { SectionList, SectionSettings, ThemeSettings, MenuEditor, VersionsPanel } from "./components/panels";
import ElementPanel from "./components/ElementPanel";
import PreviewFrame from "./components/PreviewFrame";
import AddSectionDialog from "./components/AddSectionDialog";
import { ScheduleDialog, ShareDialog, ScheduleBanner } from "./components/PublishTools";
import { ProductTemplatePanel, ProductBlockSettings } from "./components/productPanel";
import { CollectionTemplatePanel } from "./components/collectionPanel";
import { adminProductApi } from "@/apis/admin/productApi";

const AUTOSAVE_MS = 1500;

const RAIL = [
  { id: "sections", label: "Sections", icon: LayoutList },
  { id: "theme", label: "Theme settings", icon: Palette },
  { id: "menus", label: "Menus", icon: MenuIcon },
];

const EDIT_PAGES = [
  { id: "home", label: "Homepage", icon: House },
  { id: "product", label: "Product page", icon: Package },
  { id: "collection", label: "Category page", icon: LayoutGrid },
];

const DEVICES = [
  { id: "desktop", icon: Monitor, label: "Desktop" },
  { id: "tablet", icon: Tablet, label: "Tablet" },
  { id: "mobile", icon: Smartphone, label: "Mobile" },
];

const SHORTCUTS = [
  ["Ctrl", "Z", "Undo"],
  ["Ctrl", "Shift", "Z", "Redo"],
  ["Ctrl", "S", "Save draft now"],
  ["Esc", "Close section / dialog"],
  ["?", "Show shortcuts"],
];

const isTyping = (target) => {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
};

// navigator.onLine (offline me autosave ruk jata hai, online hote hi save)
const subscribeOnline = (cb) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
const getOnline = () => navigator.onLine;

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

function SaveIndicator({ state, dirty, error, online, issues = [], onShowIssue }) {
  if (!online) return <span className="inline-flex items-center gap-1.5 text-xs text-warning" title="Changes save when you're back online"><WifiOff size={13} /> Offline</span>;
  // Adhoora item (label / link) → autosave ruka hua; click = us jagah le jao
  if (dirty && issues.length && state !== "saving" && state !== "conflict") {
    return (
      <button
        type="button"
        onClick={() => onShowIssue?.(issues[0])}
        title={issues.map((i) => i.message).join("\n")}
        className="inline-flex items-center gap-1.5 text-xs text-warning hover:underline"
      >
        <CircleAlert size={13} /> {issues.length === 1 ? "1 item to finish" : `${issues.length} items to finish`}
      </button>
    );
  }
  if (state === "saving") return <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (state === "error") return <span className="inline-flex items-center gap-1.5 text-xs text-danger" title={error || ""}><CloudOff size={13} /> Not saved</span>;
  if (state === "conflict") return <span className="inline-flex items-center gap-1.5 text-xs text-warning"><CloudOff size={13} /> Conflict</span>;
  if (dirty) return <span className="text-xs text-fg-muted">Unsaved changes</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-success"><Check size={13} /> Draft saved</span>;
  return <span className="text-xs text-fg-muted">All changes saved</span>;
}

const topBtn =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-subtle hover:text-fg disabled:opacity-30";

function PageSwitcher({ value, onChange }) {
  const current = EDIT_PAGES.find((p) => p.id === value) || EDIT_PAGES[0];
  const Icon = current.icon;
  return (
    <label className="relative inline-flex h-9 items-center rounded-lg border border-line bg-card ps-2.5 pe-1 text-sm font-semibold text-fg transition hover:border-line-strong focus-within:border-accent">
      <Icon size={15} className="pointer-events-none text-fg-muted" />
      <span className="sr-only">Page to edit</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full cursor-pointer appearance-none bg-transparent ps-2 pe-6 text-sm font-semibold text-fg outline-none"
      >
        {EDIT_PAGES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute end-2 text-fg-muted" />
    </label>
  );
}

function ShortcutsDialog({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="w-full max-w-sm rounded-2xl border border-line bg-card p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-fg">Keyboard shortcuts</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-fg-muted hover:bg-subtle" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((row) => (
            <li key={row.join("+")} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-fg-secondary">{row[row.length - 1]}</span>
              <span className="flex items-center gap-1">
                {row.slice(0, -1).map((k) => (
                  <kbd key={k} className="rounded-md border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-fg">
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-fg-muted">On Mac use ⌘ instead of Ctrl.</p>
      </div>
    </div>
  );
}

export default function StoreEditorPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("sections");
  const [device, setDevice] = useState("desktop");
  const [zoom, setZoom] = useState("fit"); // fit = asli device width, scaled | actual = panel width
  // Kaun sa page edit ho raha hai: homepage sections / product / category template
  const [editPage, setEditPage] = useState("home");
  const [showVersions, setShowVersions] = useState(false);
  const [dialog, setDialog] = useState(null); // "schedule" | "share" | "shortcuts" | null
  const [addSection, setAddSection] = useState(null); // { insertAt } | null
  const [focusGroup, setFocusGroup] = useState(null); // ThemeSettings me kholne wala group
  // Schedule / preview-link responses — sirf ye fields override (draft reload NAHI → undo history safe)
  const [publishMeta, setPublishMeta] = useState(null);
  const [previewKey, setPreviewKey] = useState(0);
  const online = useSyncExternalStore(subscribeOnline, getOnline, () => true);

  const store = useThemeEditorStore();
  const { draft, dirty, saveState, saveError, selected, past, future } = store;

  const schemaQuery = useQuery({ queryKey: ["themeSchema"], queryFn: themeApi.getSchema, staleTime: Infinity });
  const themeQuery = useQuery({ queryKey: ["theme"], queryFn: themeApi.getTheme, refetchOnWindowFocus: false, retry: false });
  const versionsQuery = useQuery({ queryKey: ["themeVersions"], queryFn: themeApi.listVersions, enabled: showVersions });

  const meta = themeQuery.data;
  const schema = schemaQuery.data;
  // Adhoore menu items / links — jab tak ye hain, autosave nahi (warna backend 400)
  const issues = useMemo(() => draftIssues(draft, schema), [draft, schema]);

  const sampleProductQuery = useQuery({
    queryKey: ["storeEditor", "sampleProduct"],
    queryFn: () => adminProductApi.getPaginated({ page: 1, limit: 1 }),
    enabled: editPage === "product",
    staleTime: 5 * 60 * 1000,
  });
  const sampleProductId = sampleProductQuery.data?.products?.[0]?._id || null;
  const previewSrc =
    editPage === "product" && sampleProductId
      ? `/product/${sampleProductId}?preview=1`
      : editPage === "collection"
        ? "/filtering-product?preview=1"
        : "/?preview=1";

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
  // Timer polling nahi hai: har edit ke 1.5s baad (typing rukne par) EK save.
  const currentIssues = useCallback(
    () => draftIssues(useThemeEditorStore.getState().draft, queryClient.getQueryData(["themeSchema"])),
    [queryClient],
  );
  // Jo draft server ne reject kiya — wahi dobara auto-retry nahi (naya edit hone par hi)
  const failedDraft = useRef(null);

  const saveNow = useCallback(async () => {
    const s = useThemeEditorStore.getState();
    if (!s.draft || !s.dirty || s.saveState === "conflict") return true;
    if (currentIssues().length) return false;
    const snapshot = s.draft;
    s.markSaving();
    try {
      const res = await themeApi.saveDraft({ data: snapshot, baseRevision: s.revision });
      failedDraft.current = null;
      useThemeEditorStore.getState().markSaved(res.draftRevision, snapshot);
      return true;
    } catch (error) {
      const e = apiError(error);
      if (e.code === "THEME_REVISION_CONFLICT") {
        useThemeEditorStore.getState().markSaveError("conflict", e.message);
      } else {
        failedDraft.current = snapshot;
        useThemeEditorStore.getState().markSaveError("error", e.errors?.[0] || e.message);
        toast.error(e.errors?.[0] || e.message);
      }
      return false;
    }
  }, [currentIssues]);

  // Manual save (Ctrl+S / publish / schedule): na ho sake to wajah ke saath throw
  const saveOrExplain = useCallback(async () => {
    if (await saveNow()) return true;
    const issue = currentIssues()[0];
    throw new Error(issue ? `Finish this first: ${issue.message}` : useThemeEditorStore.getState().saveError || "Couldn't save the draft");
  }, [saveNow, currentIssues]);

  useEffect(() => {
    if (!online || !dirty || saveState === "conflict" || saveState === "saving") return undefined;
    if (issues.length || draft === failedDraft.current) return undefined;
    const timer = setTimeout(saveNow, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, dirty, saveState, saveNow, online, issues.length]);

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

  // ── Keyboard shortcuts ──
  // Undo/redo inputs ke andar browser ka apna; Ctrl+S hamesha (browser "save page" nahi)
  const anyDialogOpen = Boolean(dialog || addSection || showVersions);
  useEffect(() => {
    const onKey = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === "s") {
        event.preventDefault();
        saveOrExplain().catch((e) => {
          if (currentIssues().length) toast.error(e.message); // API error ka toast saveNow pehle hi de chuka
        });
        return;
      }
      if (mod && (key === "z" || key === "y")) {
        if (isTyping(event.target)) return;
        event.preventDefault();
        if (key === "y" || event.shiftKey) useThemeEditorStore.getState().redo();
        else useThemeEditorStore.getState().undo();
        return;
      }
      if (event.key === "Escape" && !anyDialogOpen && !isTyping(event.target)) {
        useThemeEditorStore.getState().select(null);
        return;
      }
      if (event.key === "?" && !mod && !anyDialogOpen && !isTyping(event.target)) {
        event.preventDefault();
        setDialog("shortcuts");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveOrExplain, currentIssues, anyDialogOpen]);

  // Doosre admin ne publish kiya → meta refresh (draft overwrite nahi)
  const { socket } = useAdminSocket();
  useEffect(() => {
    if (!socket) return undefined;
    const onPublished = () => queryClient.invalidateQueries({ queryKey: ["themeVersions"] });
    socket.on("themePublished", onPublished);
    return () => socket.off("themePublished", onPublished);
  }, [socket, queryClient]);

  // ── Preview hover toolbar → draft ──
  const handleSectionAction = useCallback(
    (action, id) => {
      const s = useThemeEditorStore.getState();
      const d = s.draft;
      const section = d?.sections?.[id];
      if (!section) return;
      const def = schema?.sectionTypes?.[section.type];
      switch (action) {
        case "moveUp":
        case "moveDown": {
          // Preview me sirf visible sections dikhte hain → visible padosi ke paar le jao
          const visible = d.order.filter((x) => d.sections[x] && !d.sections[x].disabled);
          const neighbour = visible[visible.indexOf(id) + (action === "moveUp" ? -1 : 1)];
          if (!neighbour) return;
          const order = d.order.filter((x) => x !== id);
          const at = order.indexOf(neighbour);
          order.splice(action === "moveUp" ? at : at + 1, 0, id);
          s.setOrder(order);
          s.select({ kind: "section", id });
          break;
        }
        case "hide":
          s.toggleSection(id);
          toast("Section hidden", {
            description: "Show it again from the section list.",
            action: { label: "Undo", onClick: () => useThemeEditorStore.getState().undo() },
          });
          break;
        case "duplicate": {
          const used = d.order.filter((x) => d.sections[x]?.type === section.type).length;
          if (!def || used >= def.limit) {
            toast.error(`Only ${def?.limit ?? 1} ${def?.label || "section"} allowed`);
            return;
          }
          if (d.order.length >= (schema?.limits?.maxSections ?? Infinity)) {
            toast.error("Section limit reached");
            return;
          }
          s.duplicateSection(id, def.limit);
          break;
        }
        case "remove":
          if (window.confirm("Remove this section?")) s.removeSection(id);
          break;
        case "addBelow":
          setAddSection({ insertAt: d.order.indexOf(id) + 1 });
          break;
        default:
      }
    },
    [schema],
  );

  const openGlobalGroup = useCallback((group) => {
    useThemeEditorStore.getState().select(null);
    setTab("theme");
    setFocusGroup(group);
  }, []);
  const clearFocusGroup = useCallback(() => setFocusGroup(null), []);

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveOrExplain();
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

  if (!schema || !draft) {
    return (
      <div className="flex h-screen items-center justify-center bg-page">
        <Loader2 className="animate-spin text-fg-muted" size={24} />
      </div>
    );
  }

  const busy = publishMutation.isPending || discardMutation.isPending || restoreMutation.isPending;
  const hasUnpublished = dirty || saveState === "saving" || meta?.hasUnpublishedChanges || saveState === "saved";
  const switchPage = (id) => {
    setEditPage(id);
    setTab("sections");
    store.select(null);
  };
  // Issue par click → jahan theek karna hai wahan le jao
  const showIssue = (issue) => {
    const target = issue?.target;
    if (!target) return;
    if (target.kind === "section") {
      setEditPage("home");
      setTab("sections");
      store.select({ kind: "section", id: target.id });
    } else if (target.kind === "theme") {
      openGlobalGroup(target.group);
    } else {
      store.select(null);
      setTab("menus");
    }
  };
  const indicator = (
    <SaveIndicator state={saveState} dirty={dirty} error={saveError} online={online} issues={issues} onShowIssue={showIssue} />
  );

  // ── Sidebar content ──
  let panel;
  if (selected?.kind === "element") {
    panel = <ElementPanel key={selected.key} schema={schema} selection={selected} onBack={() => store.select(null)} />;
  } else if (selected?.kind === "productBlock") {
    panel = <ProductBlockSettings schema={schema} zone={selected.zone} id={selected.id} onBack={() => store.select(null)} />;
  } else if (selected?.kind === "section" && draft.sections[selected.id]) {
    panel = <SectionSettings key={selected.id} schema={schema} id={selected.id} onBack={() => store.select(null)} />;
  } else if (tab === "theme") {
    panel = <ThemeSettings schema={schema} focusGroup={focusGroup} onFocusHandled={clearFocusGroup} />;
  } else if (tab === "menus") {
    panel = <MenuEditor schema={schema} />;
  } else if (editPage === "collection") {
    panel = <CollectionTemplatePanel schema={schema} />;
  } else if (editPage === "product") {
    panel = (
      <>
        {!sampleProductQuery.isLoading && !sampleProductId ? (
          <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Add a product to see the product page preview.</p>
        ) : null}
        <ProductTemplatePanel schema={schema} />
      </>
    );
  } else {
    panel = <SectionList schema={schema} onAddSection={() => setAddSection({ insertAt: null })} onOpenGlobal={openGlobalGroup} />;
  }
  const panelTitle = selected ? null : tab === "theme" ? "Theme settings" : tab === "menus" ? "Menus" : EDIT_PAGES.find((p) => p.id === editPage)?.label;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-page text-fg">
      {/* ── Top bar ── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-2 sm:gap-3 sm:px-3">
        <Link href="/admin/dashboard" className={topBtn} aria-label="Exit editor" title="Exit editor">
          <ArrowLeft size={18} className="rtl:rotate-180" />
        </Link>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-bold leading-tight">Store editor</p>
          {indicator}
        </div>

        <div className="ms-1 sm:ms-3">
          <PageSwitcher value={editPage} onChange={switchPage} />
        </div>

        <div className="mx-auto hidden items-center gap-1 md:flex">
          <div className="flex items-center gap-1 rounded-lg bg-subtle p-1">
            {DEVICES.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDevice(id)}
                aria-label={label}
                aria-pressed={device === id}
                title={label}
                className={`inline-flex h-7 w-8 items-center justify-center rounded-md transition ${device === id ? "bg-card text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setZoom((z) => (z === "fit" ? "actual" : "fit"))}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-subtle ${zoom === "fit" ? "text-fg" : "text-fg-muted"}`}
            title={zoom === "fit" ? "Showing the real device width, scaled to fit. Click to use the panel width." : "Showing the panel width. Click to show the real device width."}
          >
            <Maximize2 size={14} /> {zoom === "fit" ? "Fit" : "100%"}
          </button>
        </div>

        <div className="ms-auto flex items-center gap-0.5 sm:gap-1 md:ms-0">
          <button type="button" onClick={store.undo} disabled={!past.length} className={topBtn} title="Undo (Ctrl+Z)" aria-label="Undo">
            <Undo2 size={16} />
          </button>
          <button type="button" onClick={store.redo} disabled={!future.length} className={topBtn} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
            <Redo2 size={16} />
          </button>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <button type="button" onClick={() => setShowVersions(true)} className={topBtn} title="Version history" aria-label="Version history">
            <History size={16} />
          </button>
          <button type="button" onClick={() => setDialog("share")} className={topBtn} title="Share preview link" aria-label="Share preview link">
            <Link2 size={16} />
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer" className={`${topBtn} hidden sm:inline-flex`} title="Open live store" aria-label="Open live store">
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
          <div className="flex items-center overflow-hidden rounded-lg shadow-sm">
            <button
              type="button"
              disabled={busy || saveState === "conflict" || !hasUnpublished}
              onClick={() => publishMutation.mutate()}
              className="inline-flex h-9 items-center gap-2 bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
            >
              {publishMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Publish
            </button>
            <button
              type="button"
              disabled={busy || saveState === "conflict"}
              onClick={() => setDialog("schedule")}
              className="inline-flex h-9 w-9 items-center justify-center border-s border-accent-fg/20 bg-accent text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              title="Schedule publish"
              aria-label="Schedule publish"
            >
              <CalendarClock size={15} />
            </button>
          </div>
        </div>
      </header>

      <ScheduleBanner
        scheduled={metaSchedule}
        lastError={metaScheduleError}
        cancelling={cancelScheduleMutation.isPending}
        onCancel={() => window.confirm("Cancel the scheduled publish?") && cancelScheduleMutation.mutate()}
      />
      {dialog === "schedule" ? <ScheduleDialog onClose={() => setDialog(null)} onSaveDraft={saveOrExplain} onDone={takeMeta} /> : null}
      {dialog === "share" ? (
        <ShareDialog onClose={() => setDialog(null)} onSaveDraft={saveOrExplain} activeLinks={metaPreviewLinks.length} onChanged={takeMeta} />
      ) : null}
      {dialog === "shortcuts" ? <ShortcutsDialog onClose={() => setDialog(null)} /> : null}
      {addSection ? (
        <AddSectionDialog
          schema={schema}
          draft={draft}
          onClose={() => setAddSection(null)}
          onAdd={(type, def) => {
            store.addSection(type, def, addSection.insertAt ?? undefined);
            setAddSection(null);
            setTab("sections");
          }}
        />
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
        {/* ── Icon rail ── */}
        <nav aria-label="Editor panels" className="flex w-14 shrink-0 flex-col items-center gap-1 border-e border-line bg-card py-2">
          {RAIL.map(({ id, label, icon: Icon }) => {
            const active = tab === id && !selected;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  store.select(null);
                  setTab(id);
                }}
                aria-label={label}
                aria-current={active ? "true" : undefined}
                title={label}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
                  tab === id ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-subtle hover:text-fg"
                }`}
              >
                <Icon size={18} />
              </button>
            );
          })}
          <span className="my-1 h-px w-8 bg-line" />
          <Link href="/admin/pages" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted transition hover:bg-subtle hover:text-fg" title="Manage pages" aria-label="Manage pages">
            <FileText size={18} />
          </Link>
          <button
            type="button"
            onClick={() => setDialog("shortcuts")}
            className="mt-auto inline-flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted transition hover:bg-subtle hover:text-fg"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={18} />
          </button>
        </nav>

        {/* ── Settings panel ── */}
        <aside className="flex min-w-0 flex-1 flex-col border-e border-line bg-card md:w-[340px] md:flex-none">
          {panelTitle ? (
            <div className="flex h-11 shrink-0 items-center border-b border-line px-4">
              <h2 className="truncate text-sm font-bold text-fg">{panelTitle}</h2>
              <span className="ms-auto sm:hidden">{indicator}</span>
            </div>
          ) : null}
          {dirty && issues.length ? (
            <div role="status" className="shrink-0 border-b border-warning/30 bg-warning-soft px-4 py-2 text-xs text-warning">
              <p className="font-semibold">Autosave is paused until you finish:</p>
              <ul className="mt-1 space-y-0.5">
                {issues.slice(0, 3).map((issue, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => showIssue(issue)} className="text-start hover:underline">
                      • {issue.message}
                    </button>
                  </li>
                ))}
                {issues.length > 3 ? <li>• and {issues.length - 3} more</li> : null}
              </ul>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel}</div>
          <p className="shrink-0 border-t border-line px-4 py-2 text-[11px] text-fg-muted">
            Changes save as a draft automatically. Customers see them after you publish.
          </p>
        </aside>

        {/* ── Preview ── */}
        <main className="hidden min-w-0 flex-1 overflow-hidden bg-subtle/40 p-4 md:block">
          <PreviewFrame
            device={device}
            zoom={zoom}
            reloadKey={previewKey}
            src={previewSrc}
            schema={schema}
            onSectionAction={editPage === "home" ? handleSectionAction : undefined}
          />
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
