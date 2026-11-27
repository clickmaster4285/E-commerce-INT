"use client";

/* ==========================================================
   STORE EDITOR — professional color picker
   Saturation/brightness box + hue slider (mouse/touch drag + keyboard),
   HEX / RGB inputs, eyedropper (Chrome/Edge), theme + recent swatches.
   Drag ke dauran live preview (rAF throttle) aur poora drag = ek undo step.
   Output hamesha lowercase hex (#rrggbb, alpha suffix ho to wahi rehta hai).
   ========================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { Pipette, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useThemeEditorStore } from "../useThemeEditorStore";

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RECENT_KEY = "storeEditor.recentColors";
const RECENT_MAX = 8;
const BASIC_SWATCHES = ["#000000", "#ffffff", "#111827", "#6b7280", "#e5e7eb", "#ef4444", "#f97316", "#f59e0b", "#22c55e", "#059669", "#06b6d4", "#2563eb", "#7c3aed", "#db2777"];

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// ── Conversions ──
function parseHex(hex) {
  if (!HEX_RE.test(hex || "")) return null;
  let h = hex.slice(1).toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), alpha: h.slice(6) };
}
const toHex = ({ r, g, b }, alpha = "") => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}${alpha}`;

function rgbToHsv({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}
function hsvToRgb({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: f(5), g: f(3), b: f(1) };
}

// ── Recent colors (localStorage, per browser) ──
function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(list) ? list.filter((c) => HEX_RE.test(c)) : [];
  } catch {
    return [];
  }
}
function pushRecent(hex) {
  try {
    const next = [hex, ...readRecent().filter((c) => c !== hex)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage band ho to koi baat nahi */
  }
}

/** Pointer drag helper: pointer capture → mouse box se bahar chala jaye tab bhi drag chalta rahe */
function useDrag(onMove, { onStart, onEnd }) {
  const ref = useRef(null);
  const handle = useCallback(
    (e) => {
      const rect = ref.current.getBoundingClientRect();
      onMove(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1));
    },
    [onMove],
  );
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    ref.current.focus();
    onStart();
    handle(e);
  };
  const onPointerMove = (e) => {
    if (ref.current?.hasPointerCapture(e.pointerId)) handle(e);
  };
  const stop = (e) => {
    if (!ref.current?.hasPointerCapture(e.pointerId)) return;
    ref.current.releasePointerCapture(e.pointerId);
    onEnd();
  };
  return { ref, onPointerDown, onPointerMove, onPointerUp: stop, onPointerCancel: stop };
}

function Swatch({ color, active, onPick }) {
  return (
    <button
      type="button"
      title={color}
      aria-label={`Use ${color}`}
      onClick={() => onPick(color)}
      className={`h-6 w-6 rounded-md border border-line shadow-sm transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-accent ${active ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : ""}`}
      style={{ background: color }}
    />
  );
}

function ChannelInput({ label, value, max, onCommit }) {
  const [text, setText] = useState(String(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(String(value));
  }
  const commit = (raw) => {
    const n = Number(raw);
    if (raw !== "" && Number.isFinite(n)) onCommit(clamp(Math.round(n), 0, max));
    else setText(String(value));
  };
  return (
    <label className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onCommit(clamp(value + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1), 0, max));
          }
        }}
        className="h-8 w-full rounded-md border border-line bg-input px-1 text-center text-xs tabular-nums text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <span className="text-[10px] font-semibold uppercase text-fg-muted">{label}</span>
    </label>
  );
}

function PickerPanel({ value, onChange }) {
  const beginBatch = useThemeEditorStore((s) => s.beginBatch);
  const endBatch = useThemeEditorStore((s) => s.endBatch);
  const themeColors = useThemeEditorStore((s) => s.draft?.settings?.colors);

  const parsed = parseHex(value);
  const alpha = parsed?.alpha || "";
  // HSV local state: gray/black par bhi hue yaad rehta hai (sirf hex se hue kho jata)
  const [hsv, setHsv] = useState(() => rgbToHsv(parsed || { r: 0, g: 0, b: 0 }));
  // emitted = jo value humne khud bheji; prop wapas wahi aaye to hsv sync nahi (drag me hue/position jump na ho)
  const [emitted, setEmitted] = useState(value);
  if (emitted !== value) {
    setEmitted(value);
    // Bahar se value badli (undo/redo, hex text) → hsv sync
    if (parsed) setHsv(rgbToHsv(parsed));
  }
  // Latest hsv ref me bhi (pointermove handlers stale state na padhen)
  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  // Panel sirf popover khulne par (client) render hota hai → localStorage seedha padh sakte hain
  const [recent, setRecent] = useState(readRecent);

  // rAF throttle: drag me har frame par max ek onChange (preview smooth rehta hai)
  const frame = useRef(0);
  const pending = useRef(null);
  const flush = useCallback(() => {
    frame.current = 0;
    const hex = pending.current;
    if (!hex) return;
    pending.current = null;
    setEmitted(hex);
    onChange(hex);
  }, [onChange]);
  const emit = useCallback(
    (next) => {
      const hex = toHex(hsvToRgb(next), alpha);
      pending.current = hex;
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    },
    [alpha, flush],
  );
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const setFromHsv = useCallback(
    (next) => {
      hsvRef.current = next;
      setHsv(next);
      emit(next);
    },
    [emit],
  );

  const draggingRef = useRef(false);
  const dragHooks = {
    onStart: () => {
      draggingRef.current = true;
      beginBatch();
    },
    onEnd: () => {
      draggingRef.current = false;
      cancelAnimationFrame(frame.current);
      flush();
      endBatch();
      pushRecent(toHex(hsvToRgb(hsvRef.current), alpha));
      setRecent(readRecent());
    },
  };
  // Popover drag ke beech band ho jaye to batch latka na rahe
  useEffect(() => () => draggingRef.current && endBatch(), [endBatch]);

  const svDrag = useDrag(
    useCallback((x, y) => setFromHsv({ ...hsvRef.current, s: x, v: 1 - y }), [setFromHsv]),
    dragHooks,
  );
  const hueDrag = useDrag(
    useCallback((x) => setFromHsv({ ...hsvRef.current, h: x * 359.999 }), [setFromHsv]),
    dragHooks,
  );

  const pick = (hex) => {
    const p = parseHex(hex);
    if (!p) return;
    const out = toHex(p, alpha);
    const next = rgbToHsv(p);
    hsvRef.current = next;
    setHsv(next);
    setEmitted(out);
    onChange(out);
    pushRecent(out);
    setRecent(readRecent());
  };

  const nudgeKeys = (keys) => (e) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const delta = keys[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = { ...hsv };
    for (const [ch, dir] of Object.entries(delta)) {
      next[ch] = ch === "h" ? (hsv.h + dir * step * 360 + 360) % 360 : clamp(hsv[ch] + dir * step, 0, 1);
    }
    setFromHsv(next);
  };

  const rgb = hsvToRgb(hsv);
  const rgbInt = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
  const currentHex = toHex(rgb);
  const hueColor = toHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  const canEyedrop = typeof window !== "undefined" && "EyeDropper" in window;
  const eyedrop = async () => {
    try {
      const res = await new window.EyeDropper().open();
      pick(res.sRGBHex);
    } catch {
      /* user ne Esc dabaya */
    }
  };

  const themeSwatches = [...new Set(Object.values(themeColors || {}).filter((c) => HEX_RE.test(c || "")).map((c) => c.toLowerCase()))];

  return (
    <div className="space-y-3">
      {/* Saturation (x) / brightness (y) */}
      <div
        {...svDrag}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuenow={Math.round(hsv.s * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        onKeyDown={nudgeKeys({ ArrowRight: { s: 1 }, ArrowLeft: { s: -1 }, ArrowUp: { v: 1 }, ArrowDown: { v: -1 } })}
        className="relative h-40 w-full cursor-crosshair touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
      >
        <span
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35),0_1px_3px_rgba(0,0,0,.4)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: currentHex }}
        />
      </div>

      <div className="flex items-center gap-2">
        {canEyedrop ? (
          <button
            type="button"
            onClick={eyedrop}
            title="Pick a color from the screen"
            aria-label="Pick a color from the screen"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-fg-secondary transition hover:bg-subtle hover:text-fg"
          >
            <Pipette size={14} />
          </button>
        ) : null}
        {/* Hue */}
        <div
          {...hueDrag}
          role="slider"
          tabIndex={0}
          aria-label="Hue"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsv.h)}
          onKeyDown={nudgeKeys({ ArrowRight: { h: 1 }, ArrowUp: { h: 1 }, ArrowLeft: { h: -1 }, ArrowDown: { h: -1 } })}
          className="relative h-3 flex-1 cursor-pointer touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ background: "linear-gradient(to right,#f00 0%,#ff0 16.66%,#0f0 33.33%,#0ff 50%,#00f 66.66%,#f0f 83.33%,#f00 100%)" }}
        >
          <span
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.35),0_1px_3px_rgba(0,0,0,.4)]"
            style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }}
          />
        </div>
        <span className="h-8 w-8 shrink-0 rounded-md border border-line" style={{ background: currentHex }} aria-hidden />
      </div>

      <div className="flex items-end gap-1.5">
        <HexField value={currentHex} onCommit={pick} />
        <ChannelInput label="R" value={rgbInt.r} max={255} onCommit={(r) => pick(toHex({ ...rgbInt, r }))} />
        <ChannelInput label="G" value={rgbInt.g} max={255} onCommit={(g) => pick(toHex({ ...rgbInt, g }))} />
        <ChannelInput label="B" value={rgbInt.b} max={255} onCommit={(b) => pick(toHex({ ...rgbInt, b }))} />
      </div>

      {themeSwatches.length ? (
        <SwatchRow title="Theme colors" colors={themeSwatches} current={currentHex} onPick={pick} />
      ) : null}
      {recent.length ? <SwatchRow title="Recent" colors={recent} current={currentHex} onPick={pick} /> : null}
      <SwatchRow title="Basic" colors={BASIC_SWATCHES} current={currentHex} onPick={pick} />
    </div>
  );
}

function SwatchRow({ title, colors, current, onPick }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <Swatch key={c} color={c} active={c.slice(0, 7) === current} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function HexField({ value, onCommit }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  const commit = (raw) => {
    const v = raw.trim().startsWith("#") ? raw.trim() : `#${raw.trim()}`;
    if (HEX_RE.test(v)) onCommit(v);
    else setText(value);
  };
  return (
    <label className="flex w-[5.5rem] shrink-0 flex-col items-center gap-0.5">
      <input
        value={text}
        spellCheck={false}
        maxLength={9}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
        className="h-8 w-full rounded-md border border-line bg-input px-2 font-mono text-xs text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <span className="text-[10px] font-semibold uppercase text-fg-muted">Hex</span>
    </label>
  );
}

/** Field: swatch (popover kholta hai) + hex text + reset */
export default function ColorPicker({ value, onChange, inputCls, label }) {
  const [text, setText] = useState(value || "");
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value || "");
  }
  const has = HEX_RE.test(value || "");

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Pick ${label || "color"}`}
            className="relative h-9 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line bg-input p-1 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span
              className="block h-full w-full rounded-md border border-line/60"
              style={
                has
                  ? { background: value }
                  : { background: "repeating-conic-gradient(var(--color-subtle, #e5e7eb) 0 25%, transparent 0 50%) 50% / 10px 10px" }
              }
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3" onOpenAutoFocus={(e) => e.preventDefault()}>
          <PickerPanel value={has ? value : "#000000"} onChange={onChange} />
        </PopoverContent>
      </Popover>
      <input
        className={`${inputCls} font-mono`}
        placeholder="Default"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (HEX_RE.test(e.target.value)) onChange(e.target.value.toLowerCase());
          if (!e.target.value) onChange(null);
        }}
        onBlur={() => setText(value || "")}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="Reset to default"
          aria-label="Reset to default"
          className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
        >
          <RotateCcw size={14} />
        </button>
      ) : null}
    </div>
  );
}
