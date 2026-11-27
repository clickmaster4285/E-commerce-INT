"use client";

/* ==========================================================
   STORE EDITOR — EDIT MODE OVERLAY (sirf editor iframe, ?preview)
   ----------------------------------------------------------
   • Hover → kisi bhi element par outline + naam
   • Click → element select (editor sidebar me "Element" panel: color,
     background, font, spacing, alignment, scale ...). Links / buttons
     edit mode me kaam nahi karte (View mode me karte hain).
   • Theme se aane wala text (heading, button label, FAQ ...) → dobara click /
     double-click / "Edit text" → wahin text box. Har keystroke live draft me,
     poori editing = ek undo step. Enter = done, Esc = wapas.
   • Draft editor hi badalta hai (postMessage) — yahan sirf UI.
   Keys / CSS: storefront/elementStyles.js
   ========================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AlignCenter, AlignLeft, AlignRight, ArrowUpLeft, Minus, PencilLine, Plus, RotateCcw, X } from "lucide-react";
import { sendToEditor, useStoreTheme } from "./ThemeProvider";
import { QuickToolButtons, QuickToolPanel } from "./EditorQuickTools";
import { KIND_PROPS, editableTarget, elementKeyFor, elementKind, elementLabel, elementSelector, parseElementKey } from "./elementStyles";

const UI_ATTR = { "data-sf-editor-ui": "" };


const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();
const strip = (s) => s.replace(/^[\s“”"'«»—–-]+|[\s“”"'«»—–-]+$/g, "");

/** Element ka text kisi theme field ki value se milta hai? → woh field (inline editing) */
function findField(el, fields, sectionKey) {
  const text = norm(el.textContent);
  if (!text || text.length > 1200) return null;
  const pool = [...fields.filter((f) => f.sectionKey === sectionKey), ...fields.filter((f) => f.sectionKey === "*")];
  for (const f of pool) {
    const v = norm(f.value);
    if (v && (v === text || strip(v) === strip(text))) return f;
  }
  return null;
}

const sectionKeyOf = (key) => {
  const anchor = parseElementKey(key)?.anchor || "";
  return anchor.startsWith("s:") ? anchor.slice(2) : "*";
};

function toHex(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css || "");
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[,\s/]+/).filter(Boolean);
  if (Number(a) === 0) return null;
  return `#${[r, g, b].map((n) => Math.round(Number(n)).toString(16).padStart(2, "0")).join("")}`;
}

/** Sidebar placeholders ke liye element ki current (computed) values */
function computedInfo(el) {
  const cs = window.getComputedStyle(el);
  const sides = (prop) => ({
    t: Math.round(parseFloat(cs[`${prop}Top`]) || 0),
    r: Math.round(parseFloat(cs[`${prop}Right`]) || 0),
    b: Math.round(parseFloat(cs[`${prop}Bottom`]) || 0),
    l: Math.round(parseFloat(cs[`${prop}Left`]) || 0),
  });
  return {
    color: toHex(cs.color),
    background: toHex(cs.backgroundColor),
    fontSize: Math.round(parseFloat(cs.fontSize) || 16),
    fontWeight: Number(cs.fontWeight) || 400,
    textAlign: cs.textAlign,
    radius: Math.round(parseFloat(cs.borderTopLeftRadius) || 0),
    width: Math.round(el.offsetWidth || el.getBoundingClientRect().width),
    height: Math.round(el.offsetHeight || el.getBoundingClientRect().height),
    padding: sides("padding"),
    margin: sides("margin"),
  };
}

const sameRect = (a, b) => a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
const rectOf = (el) => {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
};

const isEditorUi = (el) => Boolean(el?.closest?.("[data-sf-editor-ui],[data-editor-toolbar]"));

/* ── Drill-down selection (Webflow / Figma jaisa) ──
   Pehla click → section (ya header / footer / page area); usi ke andar dobara click →
   ek level neeche (clicked cheez ki taraf) ... aakhir me asli element. Bahar click → phir
   us jagah ka section. Esc / "parent" button → ek level upar.
   Bekaar wrapper (same size, koi apna look nahi) levels me nahi aate. */

const hasOwnLook = (el, cs) =>
  !(!cs.backgroundColor || cs.backgroundColor === "transparent" || /rgba\([^)]*,\s*0\)$/.test(cs.backgroundColor)) ||
  parseFloat(cs.borderTopWidth) > 0 ||
  parseFloat(cs.borderBottomWidth) > 0 ||
  cs.boxShadow !== "none" ||
  ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].some((k) => parseFloat(cs[k]) > 0);

const hasDirectText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

/** Anchor (section / area) se clicked element tak selectable levels, upar se neeche */
function selectionChain(target) {
  const deepest = editableTarget(target);
  const anchor = deepest?.closest("[data-sf-section],[data-sf-anchor]");
  if (!deepest || !anchor) return [];
  const raw = [];
  for (let n = deepest; n; n = n.parentElement) {
    raw.unshift(n);
    if (n === anchor) break;
  }
  return raw.filter((n, i) => {
    if (n.hasAttribute("data-section-id")) return false; // preview-only wrapper
    const cs = window.getComputedStyle(n);
    if (cs.display === "contents") return false; // koi box hi nahi (header / footer anchor)
    if (i === 0 || i === raw.length - 1) return true; // section aur clicked element hamesha
    // Sirf ek bachcha, same size, apna koi look nahi → khali wrapper, skip
    if (n.children.length === 1 && !hasDirectText(n) && !hasOwnLook(n, cs)) {
      const a = n.getBoundingClientRect();
      const b = n.children[0].getBoundingClientRect();
      if (Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2) return false;
    }
    return true;
  });
}

const tbBtn =
  "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-user-accent-fg/90 transition hover:bg-black/15 hover:text-user-accent-fg";

function InlineTextEditor({ el, field, onDone }) {
  const ref = useRef(null);
  const original = useRef(field.value || "");
  const [rect, setRect] = useState(() => rectOf(el));
  const [typo] = useState(() => {
    const cs = window.getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      textAlign: cs.textAlign,
      color: cs.color,
      padding: cs.padding,
    };
  });
  const finished = useRef(false);

  useEffect(() => {
    el.setAttribute("data-sf-editing", "");
    sendToEditor("field:edit", { phase: "start", id: field.id });
    const ta = ref.current;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    let frame = 0;
    const tick = () => {
      const next = rectOf(el);
      setRect((cur) => (sameRect(cur, next) ? cur : next));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      el.removeAttribute("data-sf-editing");
    };
  }, [el, field.id]);

  // Text badalne par height grow
  const fit = () => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, rect?.height || 0)}px`;
  };
  useEffect(fit);

  const finish = (phase) => {
    if (finished.current) return;
    finished.current = true;
    sendToEditor("field:edit", { phase, id: field.id, value: phase === "cancel" ? original.current : undefined });
    onDone();
  };

  if (!rect) return null;
  return (
    <textarea
      {...UI_ATTR}
      ref={ref}
      defaultValue={field.value || ""}
      maxLength={field.max || 1000}
      rows={1}
      spellCheck
      onChange={(e) => {
        sendToEditor("field:edit", { phase: "input", id: field.id, value: field.multiline ? e.target.value : e.target.value.replace(/\n/g, " ") });
        fit();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish("cancel");
        } else if (e.key === "Enter" && (!field.multiline || !e.shiftKey)) {
          e.preventDefault();
          finish("end");
        }
      }}
      onBlur={() => finish("end")}
      style={{
        ...typo,
        position: "fixed",
        top: rect.top,
        left: rect.left,
        width: Math.max(rect.width, 40),
        minHeight: rect.height,
        zIndex: 2147483002,
        margin: 0,
        resize: "none",
        overflow: "hidden",
        background: "transparent",
        border: 0,
        outline: "2px solid var(--user-accent, #2563eb)",
        outlineOffset: 2,
        borderRadius: 4,
        boxSizing: "border-box",
      }}
    />
  );
}

const HANDLES = [
  { dir: "e", cursor: "ew-resize", title: "Drag to change width (double-click = auto)" },
  { dir: "s", cursor: "ns-resize", title: "Drag to change height (double-click = auto)" },
  { dir: "se", cursor: "nwse-resize", title: "Drag to resize. Hold Shift to keep the shape. Double-click = auto" },
];
const clampSize = (n) => Math.min(2400, Math.max(16, Math.round(n)));

/**
 * Selected card / box / image ke kinaron par handles: drag = width / height (px).
 * Shift (corner) = aspect ratio same. Poora drag = ek undo step (editor:batch).
 */
function ResizeHandles({ rect, el, styleKey, scale, onResizeEnd }) {
  const [live, setLive] = useState(null); // { w, h } drag ke dauran badge

  const start = (event, dir) => {
    event.preventDefault();
    event.stopPropagation();
    if (!el?.isConnected) return;
    const startW = el.offsetWidth || rect.width;
    const startH = el.offsetHeight || rect.height;
    const ratio = startW / Math.max(1, startH);
    const sc = (scale || 100) / 100;
    const x0 = event.clientX;
    const y0 = event.clientY;
    let frame = 0;
    let pending = null;
    const flush = () => {
      frame = 0;
      if (pending) sendToEditor("element:style", { key: styleKey, patch: pending });
    };
    sendToEditor("editor:batch", { phase: "start" });
    const move = (ev) => {
      ev.preventDefault();
      const next = {};
      if (dir.includes("e")) next.width = clampSize(startW + (ev.clientX - x0) / sc);
      if (dir.includes("s")) next.height = clampSize(startH + (ev.clientY - y0) / sc);
      if (dir === "se" && ev.shiftKey) next.height = clampSize(next.width / ratio);
      pending = next;
      setLive({ w: next.width ?? startW, h: next.height ?? startH });
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const up = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
      cancelAnimationFrame(frame);
      flush();
      sendToEditor("editor:batch", { phase: "end" });
      setLive(null);
      onResizeEnd();
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
  };

  const reset = (dir) => {
    const patch = {};
    if (dir.includes("e")) patch.width = null;
    if (dir.includes("s")) patch.height = null;
    sendToEditor("element:style", { key: styleKey, patch });
  };

  const pos = {
    e: { top: rect.top + rect.height / 2 - 10, left: rect.left + rect.width - 4, width: 8, height: 20 },
    s: { top: rect.top + rect.height - 4, left: rect.left + rect.width / 2 - 10, width: 20, height: 8 },
    se: { top: rect.top + rect.height - 6, left: rect.left + rect.width - 6, width: 12, height: 12 },
  };

  return (
    <>
      {HANDLES.map(({ dir, cursor, title }) => (
        <span
          key={dir}
          title={title}
          onPointerDown={(e) => start(e, dir)}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            reset(dir);
          }}
          className="fixed z-[2147483001] touch-none rounded-sm border-2 border-user-accent bg-white shadow"
          style={{ ...pos[dir], cursor }}
        />
      ))}
      {live ? (
        <span
          className="pointer-events-none fixed z-[2147483002] rounded bg-user-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-user-accent-fg shadow"
          style={{ top: rect.top + rect.height + 10, left: rect.left + rect.width - 70 }}
        >
          {live.w} × {live.h}
        </span>
      ) : null}
    </>
  );
}

export default function VisualEditor() {
  const { editorMode, editableFields, selectedElementKey, theme } = useStoreTheme();
  const pathname = usePathname();
  const active = editorMode === "edit";

  const hoverRef = useRef(null);
  const selectedRef = useRef(null); // { el, key }
  const [hover, setHover] = useState(null); // { el, rect, label }
  const [sel, setSel] = useState(null); // { el, key, label, rect, field, fontSize }
  const [editing, setEditing] = useState(null); // { el, field }
  const [tool, setTool] = useState(null); // { key, id } — toolbar ka khula quick panel
  const fieldsRef = useRef(editableFields);
  const justResized = useRef(false);
  const hoverMoved = useRef(false); // click ke baad same jagah par bhi hover dobara nikalo // resize drag ke foran baad wala click ignore
  useEffect(() => {
    fieldsRef.current = editableFields;
  }, [editableFields]);

  const select = useCallback(
    (target) => {
      const el = editableTarget(target);
      const key = el && elementKeyFor(el, pathname);
      if (!key) return;
      const field = findField(el, fieldsRef.current || [], sectionKeyOf(key));
      selectedRef.current = { el, key };
      const info = computedInfo(el);
      const kind = elementKind(el);
      const label = elementLabel(el, kind);
      setSel({ el, key, kind, label, rect: rectOf(el), field, fontSize: info.fontSize, computed: info });
      sendToEditor("element:select", { key, kind, label, sectionKey: sectionKeyOf(key), fieldId: field?.id || null, computed: info });
    },
    [pathname],
  );

  // Click kis level ko select karega: selection is chain me nahi → pehla level (section),
  // warna agla level (clicked cheez ki taraf)
  const nextTarget = useCallback((target) => {
    const chain = selectionChain(target);
    if (!chain.length) return null;
    const cur = selectedRef.current?.el;
    const i = cur ? chain.indexOf(cur) : -1;
    return i === -1 ? chain[0] : chain[Math.min(i + 1, chain.length - 1)];
  }, []);

  // Ek level upar (Esc / toolbar) — section par ho to null
  const parentTarget = useCallback(() => {
    const cur = selectedRef.current?.el;
    if (!cur?.isConnected) return null;
    const chain = selectionChain(cur);
    return chain.length > 1 ? chain[chain.length - 2] : null;
  }, []);

  const startEditing = useCallback(() => {
    const cur = selectedRef.current;
    if (!cur?.el?.isConnected) return;
    const field = findField(cur.el, fieldsRef.current || [], sectionKeyOf(cur.key));
    if (field) setEditing({ el: cur.el, field });
  }, []);

  // Editor ne selection hata di (sidebar back / Esc) → yahan bhi
  useEffect(() => {
    if (selectedElementKey === null && selectedRef.current) {
      selectedRef.current = null;
      setSel(null);
      setEditing(null);
    }
  }, [selectedElementKey]);

  // Page badla ya View mode → sab saaf
  const resetKey = `${pathname}|${active}`;
  const [seenResetKey, setSeenResetKey] = useState(resetKey);
  if (seenResetKey !== resetKey) {
    setSeenResetKey(resetKey);
    setSel(null);
    setHover(null);
    setEditing(null);
  }
  useEffect(() => {
    selectedRef.current = null;
    hoverRef.current = null;
  }, [resetKey]);

  // ── Pointer / keyboard ──
  useEffect(() => {
    if (!active) return undefined;
    let lastTarget = null;
    const onMove = (e) => {
      // Hover wahi dikhaye jo click select karega (drill-down)
      if (e.target === lastTarget && !hoverMoved.current) return;
      lastTarget = e.target;
      hoverMoved.current = false;
      const el = e.target instanceof Element ? nextTarget(e.target) : null;
      if (!el || !elementKeyFor(el, pathname)) {
        if (hoverRef.current) {
          hoverRef.current = null;
          setHover(null);
        }
        return;
      }
      if (hoverRef.current === el) return;
      hoverRef.current = el;
      setHover({ el, rect: rectOf(el), label: elementLabel(el) });
    };
    const onLeave = () => {
      hoverRef.current = null;
      setHover(null);
    };
    // Edit mode me store ke links / buttons / inputs kaam nahi karte — click = select
    const block = (e) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el || isEditorUi(el)) return false;
      e.preventDefault();
      e.stopPropagation();
      return el;
    };
    const onDown = (e) => {
      // mousedown preventDefault focus nahi hatata → inline editor ko khud blur (= save) karo
      if (block(e) && document.activeElement?.matches?.("textarea[data-sf-editor-ui]")) document.activeElement.blur();
    };
    const onClick = (e) => {
      if (justResized.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const el = block(e);
      if (!el) return;
      // Alt + click → seedha asli element (levels skip)
      const next = e.altKey ? selectionChain(el).at(-1) : nextTarget(el);
      if (!next) return;
      if (next === selectedRef.current?.el) startEditing(); // aakhri level par dobara click = text edit
      else select(next);
      hoverMoved.current = true; // hover outline agla level dikhaye
      hoverRef.current = null;
      setHover(null);
    };
    const onDblClick = (e) => {
      // Double click → seedha clicked element + text editing
      const el = block(e);
      const deepest = el ? selectionChain(el).at(-1) : null;
      if (!deepest) return;
      if (selectedRef.current?.el !== deepest) select(deepest);
      startEditing();
    };
    const onSubmit = (e) => e.preventDefault();
    const onKey = (e) => {
      // Preview me focus ho tab bhi editor ke Ctrl+Z / Ctrl+Shift+Z / Ctrl+S chalein
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && (k === "z" || k === "y" || k === "s") && !isEditorUi(e.target)) {
        e.preventDefault();
        sendToEditor("editor:shortcut", { key: k, shift: e.shiftKey });
        return;
      }
      if (e.key === "Escape" && selectedRef.current) {
        // Esc → ek level upar; section par → selection band
        const parent = parentTarget();
        if (parent && elementKeyFor(parent, pathname)) {
          select(parent);
          return;
        }
        selectedRef.current = null;
        setSel(null);
        sendToEditor("element:select", { key: null });
      } else if (e.key === "Enter" && selectedRef.current && !isEditorUi(e.target)) {
        e.preventDefault();
        startEditing();
      }
    };
    document.addEventListener("mousemove", onMove, true);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, pathname, select, startEditing, nextTarget, parentTarget]);

  // ── Boxes ko scroll / layout ke saath chalao (rAF) ──
  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const tick = () => {
      const cur = selectedRef.current;
      if (cur) {
        // Re-render me node badal gaya → key se dobara dhoondo
        if (!cur.el.isConnected) {
          const parsed = parseElementKey(cur.key);
          const found = parsed ? document.querySelector(elementSelector(parsed)) : null;
          if (found) cur.el = found;
        }
        const next = rectOf(cur.el);
        setSel((s) => (s && (!sameRect(s.rect, next) || s.el !== cur.el) ? { ...s, el: cur.el, rect: next } : s));
      }
      if (hoverRef.current) {
        const next = rectOf(hoverRef.current);
        setHover((h) => (h && !sameRect(h.rect, next) ? { ...h, rect: next } : h));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;

  const style = sel ? theme?.elements?.[sel.key] : null;
  const patch = (p) => sel && sendToEditor("element:style", { key: sel.key, patch: p });
  const fontSize = style?.fontSize || sel?.fontSize || 16;
  const scale = style?.scale || 100;
  // Toolbar me sirf wahi quick actions jo is kind ke liye maayne rakhte hain
  const props = KIND_PROPS[sel?.kind] || KIND_PROPS.box;
  const canAlign = props.includes("textAlign");
  const resizable = props.includes("width");
  // Quick panel sirf usi element ke liye jiske liye khola tha
  const openTool = tool && sel && tool.key === sel.key ? tool.id : null;
  const toggleTool = (id) => setTool(openTool === id ? null : { key: sel.key, id });
  const themeColors = Object.values(theme?.settings?.colors || {}).filter((c) => /^#[0-9a-f]{6}$/i.test(c || "")).map((c) => c.toLowerCase());
  const sizeMode = props.includes("fontSize") ? "font" : props.includes("scale") && (sel?.kind === "icon" || sel?.kind === "image") ? "scale" : null;
  const selectParent = () => {
    const el = parentTarget();
    if (el && elementKeyFor(el, pathname)) select(el);
  };

  const showHover = hover?.rect && (!sel || hover.el !== sel.el);
  const hoverRect = hover?.rect;
  const r = sel?.rect;
  const toolbarTop = r ? (r.top > 44 ? r.top - 38 : Math.min(r.top + r.height + 6, window.innerHeight - 40)) : 0;
  const toolbarLeft = r ? Math.max(4, Math.min(r.left, window.innerWidth - 480)) : 0;

  return createPortal(
    <div {...UI_ATTR}>
      <style>{"[data-sf-editing],[data-sf-editing] *{color:transparent !important}"}</style>
      {showHover ? (
        <div
          className="pointer-events-none fixed z-[2147483000] rounded-sm outline outline-1 outline-user-accent"
          style={{ top: hoverRect.top, left: hoverRect.left, width: hoverRect.width, height: hoverRect.height }}
        >
          <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-user-accent px-1.5 py-0.5 text-[10px] font-semibold leading-none text-user-accent-fg">
            {hover.label}
          </span>
        </div>
      ) : null}

      {r ? (
        <>
          <div
            className="pointer-events-none fixed z-[2147483000] rounded-sm outline outline-2 outline-user-accent"
            style={{ top: r.top, left: r.left, width: r.width, height: r.height }}
          />
          {!editing ? (
            <div
              className="fixed z-[2147483001] flex items-center gap-0.5 rounded-lg bg-user-accent p-0.5 text-user-accent-fg shadow-lg"
              style={{ top: toolbarTop, left: toolbarLeft, maxWidth: "calc(100vw - 8px)" }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <span className="px-1.5 text-xs font-semibold">{sel.label}</span>
              {sel.field ? (
                <button type="button" className={tbBtn} onClick={startEditing} title="Edit text (or click it again)">
                  <PencilLine size={13} /> <span className="text-xs font-semibold">Edit text</span>
                </button>
              ) : null}
              {canAlign ? (
                <>
                  <span className="mx-0.5 h-4 w-px bg-current opacity-25" />
                  <button type="button" className={tbBtn} onClick={() => patch({ textAlign: "start" })} title="Align start" aria-label="Align start">
                    <AlignLeft size={14} className="rtl:-scale-x-100" />
                  </button>
                  <button type="button" className={tbBtn} onClick={() => patch({ textAlign: "center" })} title="Align center" aria-label="Align center">
                    <AlignCenter size={14} />
                  </button>
                  <button type="button" className={tbBtn} onClick={() => patch({ textAlign: "end" })} title="Align end" aria-label="Align end">
                    <AlignRight size={14} className="rtl:-scale-x-100" />
                  </button>
                </>
              ) : null}
              {sizeMode === "font" ? (
                <>
                  <span className="mx-0.5 h-4 w-px bg-current opacity-25" />
                  <button type="button" className={tbBtn} onClick={() => patch({ fontSize: Math.max(8, fontSize - 2) })} title="Smaller text" aria-label="Smaller text">
                    <Minus size={13} />
                  </button>
                  <span className="min-w-6 text-center text-[11px] font-semibold tabular-nums" title="Font size (px)">{fontSize}</span>
                  <button type="button" className={tbBtn} onClick={() => patch({ fontSize: Math.min(120, fontSize + 2) })} title="Bigger text" aria-label="Bigger text">
                    <Plus size={13} />
                  </button>
                </>
              ) : null}
              {sizeMode === "scale" ? (
                <>
                  <span className="mx-0.5 h-4 w-px bg-current opacity-25" />
                  <button type="button" className={tbBtn} onClick={() => patch({ scale: Math.max(50, scale - 10) })} title="Smaller" aria-label="Smaller">
                    <Minus size={13} />
                  </button>
                  <span className="min-w-8 text-center text-[11px] font-semibold tabular-nums" title="Size">{scale}%</span>
                  <button type="button" className={tbBtn} onClick={() => patch({ scale: Math.min(200, scale + 10) })} title="Bigger" aria-label="Bigger">
                    <Plus size={13} />
                  </button>
                </>
              ) : null}
              {props.length ? (
                <>
                  <span className="mx-0.5 h-4 w-px bg-current opacity-25" />
                  <QuickToolButtons props={props} openTool={openTool} onToggle={toggleTool} style={style} onPatch={patch} />
                </>
              ) : null}
              <span className="mx-0.5 h-4 w-px bg-current opacity-25" />
              <button type="button" className={tbBtn} onClick={selectParent} title="Select the box around this" aria-label="Select parent">
                <ArrowUpLeft size={14} />
              </button>
              {style ? (
                <button type="button" className={tbBtn} onClick={() => sendToEditor("element:style", { key: sel.key, reset: true })} title="Reset this element's style" aria-label="Reset style">
                  <RotateCcw size={13} />
                </button>
              ) : null}
              <button
                type="button"
                className={tbBtn}
                onClick={() => {
                  selectedRef.current = null;
                  setSel(null);
                  sendToEditor("element:select", { key: null });
                }}
                title="Deselect (Esc)"
                aria-label="Deselect"
              >
                <X size={13} />
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {r && openTool && !editing ? (
        <QuickToolPanel
          tool={openTool}
          props={props}
          kind={sel.kind}
          style={style || {}}
          computed={sel.computed}
          themeColors={themeColors}
          onPatch={patch}
          onClose={() => setTool(null)}
          top={Math.min(toolbarTop + 38, window.innerHeight - 260)}
          left={toolbarLeft}
        />
      ) : null}
      {r && resizable && !editing ? (
        <ResizeHandles
          rect={r}
          el={sel.el}
          styleKey={sel.key}
          scale={style?.scale}
          onResizeEnd={() => {
            justResized.current = true;
            setTimeout(() => {
              justResized.current = false;
            }, 0);
          }}
        />
      ) : null}
      {editing ? <InlineTextEditor key={editing.field.id} el={editing.el} field={editing.field} onDone={() => setEditing(null)} /> : null}
    </div>,
    document.body,
  );
}
