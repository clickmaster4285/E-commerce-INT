"use client";

/* ==========================================================
   STORE EDITOR — preview toolbar ke quick tools (Edit mode)
   Selected element ke toolbar me: Colors · Spacing · Size · Corners · Hide
   (sirf jo is element kind ke liye maayne rakhte hain — KIND_PROPS).
   Har button toolbar ke neeche chhota panel kholta hai; har change
   element:style ke zariye editor draft me (sidebar wala hi data).
   ========================================================== */

import { Eye, EyeOff, Maximize2, Minus, Palette, Plus, SquareDashed, SquareRoundCorner, X } from "lucide-react";
import { sendToEditor } from "./ThemeProvider";
import { ELEMENT_RANGES } from "./elementStyles";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const BASIC = ["#ffffff", "#f3f4f6", "#9ca3af", "#111827", "#000000", "#ef4444", "#f59e0b", "#22c55e", "#2563eb", "#7c3aed"];

const clamp = (n, [min, max]) => Math.min(max, Math.max(min, Math.round(n)));
const batch = (phase) => sendToEditor("editor:batch", { phase });

export const toolBtn =
  "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-user-accent-fg/90 transition hover:bg-black/15 hover:text-user-accent-fg";
const inputCls =
  "h-7 w-full rounded-md border border-gray-300 bg-white px-1.5 text-center text-xs tabular-nums text-gray-900 outline-none focus:border-gray-900";

/** Kind ki props → toolbar ke tools */
export function quickTools(props) {
  const tools = [];
  if (props.includes("background") || props.includes("color")) tools.push({ id: "colors", icon: Palette, title: "Colors" });
  if (props.includes("padding") || props.includes("margin")) tools.push({ id: "spacing", icon: SquareDashed, title: "Spacing (padding / margin)" });
  if (props.includes("width")) tools.push({ id: "size", icon: Maximize2, title: "Width / height" });
  if (props.includes("radius")) tools.push({ id: "radius", icon: SquareRoundCorner, title: "Rounded corners" });
  return tools;
}

/** Toolbar buttons (tools + hide toggle) */
export function QuickToolButtons({ props, openTool, onToggle, style, onPatch }) {
  return (
    <>
      {quickTools(props).map(({ id, icon: Icon, title }) => (
        <button
          key={id}
          type="button"
          className={`${toolBtn} ${openTool === id ? "bg-black/20" : ""}`}
          onClick={() => onToggle(id)}
          title={title}
          aria-label={title}
          aria-pressed={openTool === id}
        >
          <Icon size={14} />
        </button>
      ))}
      {props.includes("hidden") ? (
        <button
          type="button"
          className={toolBtn}
          onClick={() => onPatch({ hidden: style?.hidden ? null : true })}
          title={style?.hidden ? "Show on store" : "Hide on store"}
          aria-label={style?.hidden ? "Show on store" : "Hide on store"}
        >
          {style?.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      ) : null}
    </>
  );
}

function ColorRow({ label, value, swatches, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-gray-600">{label}</span>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="text-[10px] font-semibold text-gray-500 hover:text-gray-900">
            Reset
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Use ${c}`}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded border border-gray-300 transition hover:scale-110 ${value === c ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
            style={{ background: c }}
          />
        ))}
        {/* Custom: native picker — focus se blur tak ek undo step */}
        <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded border border-gray-300" title="Custom color">
          <span className="absolute inset-0" style={{ background: "conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }} />
          <input
            type="color"
            value={HEX.test(value || "") && value.length === 7 ? value : "#000000"}
            onFocus={() => batch("start")}
            onBlur={() => batch("end")}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Custom ${label.toLowerCase()}`}
          />
        </label>
        <input
          key={value || "none"}
          defaultValue={value || ""}
          placeholder="#hex"
          spellCheck={false}
          maxLength={7}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          onBlur={(e) => {
            const v = e.target.value.trim();
            const hex = v && !v.startsWith("#") ? `#${v}` : v;
            if (!v) onChange(null);
            else if (HEX.test(hex)) onChange(hex.toLowerCase());
          }}
          className={`${inputCls} ms-1 w-[4.5rem] font-mono`}
        />
      </div>
    </div>
  );
}

function Stepper({ value, placeholder, range, step = 4, onChange, label }) {
  const cur = value ?? placeholder ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      <button type="button" onClick={() => onChange(clamp(cur - step, range))} className="rounded p-1 text-gray-600 hover:bg-gray-100" aria-label={`Less ${label}`}>
        <Minus size={12} />
      </button>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder !== undefined ? String(placeholder) : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : clamp(Number(e.target.value), range))}
        className={`${inputCls} w-12`}
        aria-label={label}
      />
      <button type="button" onClick={() => onChange(clamp(cur + step, range))} className="rounded p-1 text-gray-600 hover:bg-gray-100" aria-label={`More ${label}`}>
        <Plus size={12} />
      </button>
    </div>
  );
}

// Quick panel ke sliders ki range (sidebar me poori range / har side alag milti hai)
const QUICK_SPACE_MAX = 120;

/** Ek simple slider: naam, px value, slider. Drag = ek undo step */
function SpaceSlider({ label, value, isSet, onChange }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={`tabular-nums ${isSet ? "font-semibold text-gray-900" : "text-gray-400"}`}>{value}px</span>
      </div>
      <input
        type="range"
        min={0}
        max={QUICK_SPACE_MAX}
        step={2}
        value={Math.min(QUICK_SPACE_MAX, Math.max(0, value))}
        onPointerDown={() => batch("start")}
        onPointerUp={() => batch("end")}
        onPointerCancel={() => batch("end")}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full accent-gray-900 ${isSet ? "" : "opacity-60"}`}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Space inside (padding) / outside (margin): sirf do sliders —
 * "Left & right" aur "Top & bottom". Non-technical seller ke liye.
 */
function SpacingGroup({ prop, title, hint, value, computed, onPatch }) {
  const sides = value || {};
  const pick = (a, b) => sides[a] ?? sides[b];
  const horizontal = pick("l", "r");
  const vertical = pick("t", "b");
  const set = (keys, v) => onPatch({ [prop]: { ...sides, ...Object.fromEntries(keys.map((k) => [k, v])) } });
  const changed = Object.keys(sides).length > 0;
  return (
    <div className="space-y-2 rounded-lg bg-gray-50 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-gray-900">{title}</p>
          <p className="text-[10px] text-gray-500">{hint}</p>
        </div>
        {changed ? (
          <button type="button" onClick={() => onPatch({ [prop]: null })} className="text-[10px] font-semibold text-gray-500 hover:text-gray-900">
            Reset
          </button>
        ) : null}
      </div>
      <SpaceSlider label="Left & right" value={horizontal ?? computed?.l ?? 0} isSet={horizontal !== undefined} onChange={(v) => set(["l", "r"], v)} />
      <SpaceSlider label="Top & bottom" value={vertical ?? computed?.t ?? 0} isSet={vertical !== undefined} onChange={(v) => set(["t", "b"], v)} />
    </div>
  );
}

/** Toolbar ke neeche wala panel */
export function QuickToolPanel({ tool, props, kind, style = {}, computed = {}, themeColors = [], onPatch, onClose, top, left }) {
  const swatches = [...new Set([...themeColors, ...BASIC])].slice(0, 14);
  const bgLabel = kind === "button" ? "Button color" : kind === "card" ? "Card color" : "Background";
  const textLabel = kind === "icon" ? "Icon color" : ["card", "box", "section"].includes(kind) ? "Text color inside" : "Text color";

  return (
    <div
      data-sf-editor-ui=""
      className="fixed z-[2147483003] w-72 space-y-3 rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-2xl"
      style={{ top, left: Math.max(4, Math.min(left, window.innerWidth - 296)) }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">
          {tool === "colors" ? "Colors" : tool === "spacing" ? "Spacing" : tool === "size" ? "Size" : "Rounded corners"}
        </span>
        <button type="button" onClick={onClose} className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900" aria-label="Close">
          <X size={13} />
        </button>
      </div>

      {tool === "colors" ? (
        <>
          {props.includes("background") ? <ColorRow label={bgLabel} value={style.background} swatches={swatches} onChange={(v) => onPatch({ background: v })} /> : null}
          {props.includes("color") ? <ColorRow label={textLabel} value={style.color} swatches={swatches} onChange={(v) => onPatch({ color: v })} /> : null}
        </>
      ) : null}

      {tool === "spacing" ? (
        <>
          {props.includes("padding") ? (
            <SpacingGroup prop="padding" title="Space inside" hint="Room between the edge and the content" value={style.padding} computed={computed.padding} onPatch={onPatch} />
          ) : null}
          {props.includes("margin") ? (
            <SpacingGroup prop="margin" title="Space outside" hint="Room around it, away from other things" value={style.margin} computed={computed.margin} onPatch={onPatch} />
          ) : null}
          <p className="text-[10px] text-gray-500">Need each side separately? Use the sidebar.</p>
        </>
      ) : null}

      {tool === "size" ? (
        <div className="space-y-2">
          {[
            ["width", "Width"],
            ["height", "Height"],
          ].map(([dim, name]) => (
            <div key={dim} className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-gray-600">{name} (px)</span>
              <div className="flex items-center gap-1">
                <Stepper label={name} value={style[dim]} placeholder={computed[dim]} range={ELEMENT_RANGES[dim]} step={10} onChange={(v) => onPatch({ [dim]: v })} />
                {style[dim] !== undefined ? (
                  <button type="button" onClick={() => onPatch({ [dim]: null })} className="text-[10px] font-semibold text-gray-500 hover:text-gray-900">
                    Auto
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-500">Tip: you can also drag the white handles on the element.</p>
        </div>
      ) : null}

      {tool === "radius" ? (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={ELEMENT_RANGES.radius[0]}
            max={ELEMENT_RANGES.radius[1]}
            value={style.radius ?? computed.radius ?? 0}
            onPointerDown={() => batch("start")}
            onPointerUp={() => batch("end")}
            onPointerCancel={() => batch("end")}
            onChange={(e) => onPatch({ radius: Number(e.target.value) })}
            className="min-w-0 flex-1 accent-gray-900"
            aria-label="Corner radius"
          />
          <Stepper label="Corner radius" value={style.radius} placeholder={computed.radius} range={ELEMENT_RANGES.radius} step={2} onChange={(v) => onPatch({ radius: v })} />
        </div>
      ) : null}
    </div>
  );
}
