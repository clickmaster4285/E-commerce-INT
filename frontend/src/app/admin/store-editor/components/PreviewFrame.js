"use client";

/* ==========================================================
   LIVE PREVIEW — storefront iframe (same store host, ?preview=1)
   Draft yahan se postMessage hota hai; storefront ka
   StoreThemeProvider (src/storefront/ThemeProvider.js) sirf same-origin
   parent ka message maanta hai. Draft kabhi public URL par nahi jata.

   Zoom "fit": iframe asli device width par render (desktop 1280px) aur
   panel me scale — chhoti screen par bhi desktop layout sahi dikhe.
   Zoom "actual": purana behavior (panel ki width = page width).
   ========================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useThemeEditorStore } from "../useThemeEditorStore";
import { sectionLabel } from "./sectionCatalog";

const MSG = { update: "theme:update", ready: "theme:ready", select: "section:select", action: "section:action" };
const ACTIONS = new Set(["moveUp", "moveDown", "hide", "duplicate", "remove", "addBelow"]);

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

  useEffect(() => {
    frameKeyRef.current = frameKey;
  }, [frameKey]);

  // Preview toolbar ke liye section naam (storefront ko schema nahi pata)
  const labels = useMemo(() => {
    const out = {};
    for (const id of draft?.order || []) if (draft.sections[id]) out[id] = sectionLabel(schema, draft.sections[id]);
    return out;
  }, [draft, schema]);

  const post = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current || !draft) return;
    win.postMessage({ type: MSG.update, theme: draft, selectedSectionId: selectionKey(selected), labels }, window.location.origin);
  }, [draft, selected, labels]);

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
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, select, onSectionAction]);

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
          title="Store preview"
          src={src}
          // "ready" har naye document se aata hai — load event par reset NAHI
          // (load kabhi ready ke BAAD fire hota hai → preview atak jata)
          className={`h-full w-full border border-line bg-card shadow-lg ${device === "mobile" ? "rounded-[1.75rem]" : "rounded-xl"}`}
        />
      </div>
    </div>
  );
}
