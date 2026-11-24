"use client";

/* ==========================================================
   LIVE PREVIEW — storefront iframe (same store host, ?preview=1)
   Draft yahan se postMessage hota hai; storefront ka
   StoreThemeProvider (src/storefront/ThemeProvider.js) sirf same-origin
   parent ka message maanta hai. Draft kabhi public URL par nahi jata.
   ========================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useThemeEditorStore } from "../useThemeEditorStore";

const MSG = { update: "theme:update", ready: "theme:ready", select: "section:select" };

export const DEVICE_WIDTHS = { desktop: "100%", tablet: "820px", mobile: "390px" };

// Editor selection ↔ storefront data-section-id
//   { kind: "section", id }               ↔ "<id>"
//   { kind: "productBlock", zone, id }    ↔ "product:<zone>:<id>"
const selectionKey = (selected) =>
  selected?.kind === "section" ? selected.id : selected?.kind === "productBlock" ? `product:${selected.zone}:${selected.id}` : null;

const selectionFromKey = (key) => {
  const m = /^product:(info|below):([a-z0-9_-]+)$/.exec(key);
  return m ? { kind: "productBlock", zone: m[1], id: m[2] } : { kind: "section", id: key };
};

export default function PreviewFrame({ device = "desktop", reloadKey = 0, src = "/?preview=1" }) {
  const iframeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const draft = useThemeEditorStore((s) => s.draft);
  const selected = useThemeEditorStore((s) => s.selected);
  const select = useThemeEditorStore((s) => s.select);
  const readyRef = useRef(false);

  const post = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current || !draft) return;
    win.postMessage(
      { type: MSG.update, theme: draft, selectedSectionId: selectionKey(selected) },
      window.location.origin,
    );
  }, [draft, selected]);

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
        setLoading(false);
        post();
      } else if (msg?.type === MSG.select && typeof msg.id === "string") {
        select(selectionFromKey(msg.id));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post, select]);

  return (
    <div className="relative mx-auto h-full transition-[width] duration-300" style={{ width: DEVICE_WIDTHS[device], maxWidth: "100%" }}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70">
          <Loader2 className="animate-spin text-fg-muted" size={22} />
        </div>
      ) : null}
      <iframe
        key={`${reloadKey}:${src}`}
        ref={iframeRef}
        title="Store preview"
        src={src}
        // "ready" har naye document se aata hai — load event par reset NAHI
        // (load kabhi ready ke BAAD fire hota hai → preview atak jata)
        className="h-full w-full rounded-xl border border-line bg-card shadow-lg"
      />
    </div>
  );
}
