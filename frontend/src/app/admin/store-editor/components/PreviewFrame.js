"use client";

/* ==========================================================
   LIVE PREVIEW — storefront iframe (same store host, ?preview=1)
   Draft yahan se postMessage hota hai; storefront ka
   StoreThemeProvider (src/storefront/ThemeProvider.js) sirf same-origin
   parent ka message maanta hai. Draft kabhi public URL par nahi jata.

   Zoom "fit": iframe asli device width par render (desktop 1280px) aur
   panel me scale — chhoti screen par bhi desktop layout sahi dikhe.
   Zoom "actual": purana behavior (panel ki width = page width).

   Neeche beech me View / Edit toggle:
     View → asli store jaisa (links chalte hain, poora storefront ghoom sakte hain)
     Edit → kisi bhi page par element hover/click → style (sidebar "Element"
            panel) + theme text wahin edit (storefront/VisualEditor.js)
   ========================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MousePointerClick } from "lucide-react";
import { useThemeEditorStore } from "../useThemeEditorStore";
import { sectionLabel } from "./sectionCatalog";
import { applyFieldValue, buildEditableFields } from "../editableFields";
import { KIND_PROPS, parseElementKey } from "@/storefront/elementStyles";
import { PREVIEW_FRAME_NAME } from "@/storefront/ThemeProvider";

const MSG = {
  update: "theme:update",
  ready: "theme:ready",
  select: "section:select",
  action: "section:action",
  elementSelect: "element:select",
  elementStyle: "element:style",
  fieldEdit: "field:edit",
  pageChange: "page:change",
};
const ACTIONS = new Set(["moveUp", "moveDown", "hide", "duplicate", "remove", "addBelow"]);

const MODES = [
  { id: "view", label: "View", icon: Eye, hint: "Browse your store like a customer. Links work." },
  { id: "edit", label: "Edit", icon: MousePointerClick, hint: "Click anything on the page to style it. Click text again to type." },
];

export const DEVICE_WIDTHS = { desktop: 1280, tablet: 820, mobile: 390 };

// Editor selection ↔ storefront data-section-id
//   { kind: "section", id }               ↔ "<id>"
//   { kind: "productBlock", zone, id }    ↔ "product:<zone>:<id>"
const selectionKey = (selected) =>
  selected?.kind === "section" ? selected.id : selected?.kind === "productBlock" ? `product:${selected.zone}:${selected.id}` : null;

const selectionFromKey = (key) => {
  const m = /^product:(info|below):([a-z0-9_-]+)$/.exec(key);
  return m ? { kind: "productBlock", zone: m[1], id: m[2] } : { kind: "section", id: key };
};

function useBoxSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export default function PreviewFrame({ device = "desktop", zoom = "fit", reloadKey = 0, src = "/?preview=1", schema, onSectionAction }) {
  const iframeRef = useRef(null);
  const boxRef = useRef(null);
  const box = useBoxSize(boxRef);
  // Har naye iframe document (page switch / reload) par skeleton jab tak "ready" na aaye
  const frameKey = `${reloadKey}:${src}`;
  const frameKeyRef = useRef(frameKey);
  const [readyKey, setReadyKey] = useState(null);
  const loading = readyKey !== frameKey;
  const draft = useThemeEditorStore((s) => s.draft);
  const selected = useThemeEditorStore((s) => s.selected);
  const select = useThemeEditorStore((s) => s.select);
  const readyRef = useRef(false);
  const [mode, setMode] = useState("edit"); // "view" | "edit"
  const [path, setPath] = useState(null); // iframe ka current page (storefront ke andar navigation)
  const editing = useRef(false); // inline text edit chal rahi (batch khula)

  useEffect(() => {
    frameKeyRef.current = frameKey;
  }, [frameKey]);

  // Preview toolbar ke liye section naam (storefront ko schema nahi pata)
  const labels = useMemo(() => {
    const out = {};
    for (const id of draft?.order || []) if (draft.sections[id]) out[id] = sectionLabel(schema, draft.sections[id]);
    return out;
  }, [draft, schema]);

  // Inline text editing ke fields (preview clicked text ko inse match karta hai)
  const fields = useMemo(() => (mode === "edit" ? buildEditableFields(draft, schema) : []), [draft, schema, mode]);

  const post = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current || !draft) return;
    win.postMessage(
      {
        type: MSG.update,
        theme: draft,
        selectedSectionId: selectionKey(selected),
        labels,
        mode,
        fields,
        selectedElementKey: selected?.kind === "element" ? selected.key : null,
      },
      window.location.origin,
    );
  }, [draft, selected, labels, mode, fields]);

  const changeMode = (next) => {
    setMode(next);
    if (next === "view" && useThemeEditorStore.getState().selected?.kind === "element") select(null);
  };

  const onEditorMessage = useCallback(
    (msg) => {
      const st = useThemeEditorStore.getState();
      if (msg.type === "editor:shortcut" && ["z", "y", "s"].includes(msg.key)) {
        // Editor page ka apna keyboard handler (window keydown) hi chalao
        window.dispatchEvent(new KeyboardEvent("keydown", { key: msg.key, ctrlKey: true, shiftKey: Boolean(msg.shift), bubbles: true }));
      } else if (msg.type === "editor:batch") {
        // Resize handle drag = ek undo step
        if (msg.phase === "start") {
          editing.current = true;
          st.beginBatch();
        } else if (msg.phase === "end") {
          editing.current = false;
          st.endBatch();
        }
      } else if (msg.type === MSG.pageChange) {
        if (typeof msg.path === "string") setPath(msg.path.slice(0, 200));
      } else if (msg.type === MSG.elementSelect) {
        if (msg.key === null) {
          if (st.selected?.kind === "element") select(null);
        } else if (parseElementKey(msg.key)) {
          select({
            kind: "element",
            key: msg.key,
            label: typeof msg.label === "string" ? msg.label.slice(0, 40) : "Element",
            // "kind" = selection type ("element"); element ka type alag field me (warna overwrite)
            elementKind: KIND_PROPS[msg.kind] ? msg.kind : "box",
            sectionKey: typeof msg.sectionKey === "string" ? msg.sectionKey : "*",
            fieldId: typeof msg.fieldId === "string" ? msg.fieldId : null,
            computed: msg.computed && typeof msg.computed === "object" ? msg.computed : {},
          });
        }
      } else if (msg.type === MSG.elementStyle && parseElementKey(msg.key)) {
        if (msg.reset) st.setElementStyle(msg.key, null);
        else if (msg.patch && typeof msg.patch === "object") st.setElementStyle(msg.key, msg.patch);
      } else if (msg.type === MSG.fieldEdit && typeof msg.id === "string") {
        // Poori inline editing = ek undo step (batch)
        if (msg.phase === "start") {
          editing.current = true;
          st.beginBatch();
        } else if (msg.phase === "input" && typeof msg.value === "string") {
          st.update((d) => applyFieldValue(d, msg.id, msg.value));
        } else if (msg.phase === "cancel" || msg.phase === "end") {
          if (msg.phase === "cancel" && typeof msg.value === "string" && st.batch?.pushed) {
            st.update((d) => applyFieldValue(d, msg.id, msg.value));
          }
          editing.current = false;
          useThemeEditorStore.getState().endBatch();
        }
      }
    },
    [select],
  );

  // Har draft / selection change → preview update (React state, koi reload nahi)
  useEffect(() => {
    post();
  }, [post]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const msg = event.data;
      if (msg?.type === MSG.ready) {
        readyRef.current = true;
        setReadyKey(frameKeyRef.current);
        post();
      } else if (msg?.type === MSG.select && typeof msg.id === "string") {
        select(selectionFromKey(msg.id));
      } else if (msg?.type === MSG.action && ACTIONS.has(msg.action) && typeof msg.id === "string") {
        onSectionAction?.(msg.action, msg.id);
      } else if (msg && typeof msg.type === "string") {
        onEditorMessage(msg);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, select, onSectionAction, onEditorMessage]);

  // Unmount ke waqt edit adhoori → batch band (warna aage ki edits ek hi undo step ban jati)
  useEffect(
    () => () => {
      if (editing.current) useThemeEditorStore.getState().endBatch();
    },
    [],
  );

  // ── Size / scale ──
  const target = DEVICE_WIDTHS[device] || DEVICE_WIDTHS.desktop;
  let width;
  let scale = 1;
  if (!box.width) {
    width = "100%";
  } else if (zoom === "fit") {
    width = target;
    scale = Math.min(1, box.width / target);
  } else {
    width = device === "desktop" ? box.width : Math.min(target, box.width);
  }
  const height = box.height ? box.height / scale : "100%";
  const left = typeof width === "number" ? Math.max(0, (box.width - width * scale) / 2) : 0;

  return (
    <div ref={boxRef} className="relative h-full w-full overflow-hidden">
      <div
        className="absolute top-0 origin-top-left transition-[width,left] duration-300"
        style={{ width, height, left, transform: scale !== 1 ? `scale(${scale})` : undefined }}
      >
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col gap-3 overflow-hidden rounded-xl border border-line bg-card p-4">
            <div className="h-10 animate-pulse rounded-lg bg-subtle" />
            <div className="h-56 animate-pulse rounded-xl bg-subtle" />
            <div className="grid grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl bg-subtle" />
              ))}
            </div>
            <div className="mt-auto flex items-center justify-center gap-2 text-xs text-fg-muted">
              <Loader2 className="animate-spin" size={14} /> Loading preview…
            </div>
          </div>
        ) : null}
        <iframe
          key={frameKey}
          ref={iframeRef}
          // window.name → storefront ke andar navigate karne par bhi preview mode (ThemeProvider)
          name={PREVIEW_FRAME_NAME}
          title="Store preview"
          src={src}
          // "ready" har naye document se aata hai — load event par reset NAHI
          // (load kabhi ready ke BAAD fire hota hai → preview atak jata)
          className={`h-full w-full border border-line bg-card shadow-lg ${device === "mobile" ? "rounded-[1.75rem]" : "rounded-xl"}`}
        />
      </div>

      {/* ── View / Edit mode (preview ke neeche beech me) ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-card/95 p-1 shadow-lg backdrop-blur">
          {MODES.map(({ id, label, icon: Icon, hint }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeMode(id)}
              aria-pressed={mode === id}
              title={hint}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition ${
                mode === id ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:bg-subtle hover:text-fg"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
          {path ? (
            <span className="ms-1 hidden max-w-[14rem] truncate border-s border-line pe-2 ps-2.5 font-mono text-[11px] text-fg-muted sm:inline" title={path}>
              {path}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
