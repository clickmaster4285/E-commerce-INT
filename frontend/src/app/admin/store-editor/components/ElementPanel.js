"use client";

/* ==========================================================
   STORE EDITOR — "Element" panel (Edit mode me preview se select kiya element)
   Text, color, background, font size / weight, alignment, padding + margin
   (box model), corner radius, scale, opacity, hide. Har change → draft.elements
   (storefront/elementStyles.js CSS banata hai). Khali = original look.
   ========================================================== */

import { useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, ChevronLeft, EyeOff, Link2, Link2Off, RotateCcw } from "lucide-react";
import { useThemeEditorStore } from "../useThemeEditorStore";
import { applyFieldValue, readFieldValue } from "../editableFields";
import { ELEMENT_RANGES, FONT_WEIGHTS, KIND_PROPS, parseElementKey } from "@/storefront/elementStyles";
import dynamic from "next/dynamic";
const ColorPicker = dynamic(() => import("./ColorPicker"), { ssr: false });
import { Collapsible } from "./panels";
import { inputCls } from "./fields";
import { sectionLabel } from "./sectionCatalog";

const WEIGHT_LABELS = { 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };
const ALIGNS = [
  { id: "start", icon: AlignLeft, label: "Start" },
  { id: "center", icon: AlignCenter, label: "Center" },
  { id: "end", icon: AlignRight, label: "End" },
  { id: "justify", icon: AlignJustify, label: "Justify" },
];
const SIDES = ["t", "r", "b", "l"];
const SIDE_LABELS = { t: "Top", r: "Right", b: "Bottom", l: "Left" };

const clamp = (n, [min, max]) => Math.min(max, Math.max(min, n));

/* Selected element ki kind → groups (title + props). Allowed props storefront/elementStyles.js
   KIND_PROPS me; jo property is kind ke liye maayne nahi rakhti woh dikhti hi nahi
   (jaise image par font size). */
const KIND_GROUPS = {
  text: [["Text style", ["color", "fontSize", "fontWeight", "textAlign"]], ["Spacing", ["margin", "padding"]], ["Visibility", ["opacity", "hidden"]]],
  button: [["Label", ["color", "fontSize", "fontWeight"]], ["Button", ["background", "radius"]], ["Size", ["size"]], ["Spacing", ["padding", "margin"]], ["Visibility", ["scale", "opacity", "hidden"]]],
  field: [["Text", ["color", "fontSize"]], ["Field", ["background", "radius"]], ["Size", ["size"]], ["Spacing", ["padding", "margin"]], ["Visibility", ["hidden"]]],
  icon: [["Icon", ["color", "scale"]], ["Spacing", ["margin"]], ["Visibility", ["opacity", "hidden"]]],
  image: [["Size", ["size"]], ["Image", ["radius", "scale"]], ["Spacing", ["margin"]], ["Visibility", ["opacity", "hidden"]]],
  card: [["Card", ["background", "radius"]], ["Size", ["size"]], ["Spacing", ["padding", "margin"]], ["Content", ["textAlign", "color"]], ["Visibility", ["scale", "opacity", "hidden"]]],
  box: [["Background", ["background", "radius"]], ["Size", ["size"]], ["Spacing", ["padding", "margin"]], ["Content", ["textAlign", "color"]], ["Visibility", ["opacity", "hidden"]]],
  section: [["Background", ["background", "radius"]], ["Spacing", ["padding", "margin"]], ["Content", ["color"]], ["Visibility", ["hidden"]]],
  area: [["Background", ["background"]], ["Content", ["color"]], ["Spacing", ["padding"]]],
};

// Kind ke hisaab se control ka naam
const PROP_LABELS = {
  color: { icon: "Icon color", card: "Text color inside", box: "Text color inside", section: "Text color inside", area: "Text color", _: "Text color" },
  background: { button: "Button color", field: "Field color", card: "Card color", _: "Background color" },
  radius: { image: "Rounded corners", _: "Corner radius" },
  scale: { icon: "Size", image: "Zoom", _: "Scale" },
  width: { _: "Width" },
  height: { _: "Height" },
  textAlign: { card: "Align content", box: "Align content", _: "Alignment" },
  fontSize: { _: "Font size" },
  fontWeight: { _: "Weight" },
  opacity: { _: "Opacity" },
  hidden: { _: "Hide" },
  padding: { _: "Padding" },
  margin: { _: "Margin" },
};
const propLabel = (prop, kind) => PROP_LABELS[prop]?.[kind] || PROP_LABELS[prop]?._ || prop;
const TEXT_KINDS = ["text", "button", "field"];
const KIND_NOUN = { box: "container", area: "area" };

function scopeText(key) {
  const scope = parseElementKey(key)?.scope;
  if (!scope) return "";
  if (scope === "*") return "Every page (header, footer, announcement bar)";
  if (scope === "home") return "Homepage";
  if (scope === "product") return "All product pages";
  if (scope === "category") return "Category pages";
  if (scope.startsWith("pages/")) return `Page “${scope.slice(6)}”`;
  return `/${scope.replace(/_/g, "…")} pages`;
}

function Row({ label, onReset, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center gap-2">
        <span className="flex-1 text-xs font-semibold text-fg-secondary">{label}</span>
        {onReset ? (
          <button type="button" onClick={onReset} title="Reset" aria-label={`Reset ${label}`} className="rounded p-0.5 text-fg-muted hover:bg-subtle hover:text-fg">
            <RotateCcw size={11} />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Range + number; value khali → current (computed) value halka dikhta hai */
function Slider({ label, value, fallback, range, unit = "px", onChange }) {
  const set = value !== undefined && value !== null;
  const shown = set ? value : (fallback ?? range[0]);
  return (
    <Row label={label} onReset={set ? () => onChange(null) : null}>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={range[0]}
          max={range[1]}
          value={shown}
          onChange={(e) => onChange(Number(e.target.value))}
          // Poora drag = ek undo step
          onPointerDown={() => useThemeEditorStore.getState().beginBatch()}
          onPointerUp={() => useThemeEditorStore.getState().endBatch()}
          onPointerCancel={() => useThemeEditorStore.getState().endBatch()}
          className={`min-w-0 flex-1 accent-accent ${set ? "" : "opacity-50"}`}
          aria-label={label}
        />
        <div className="relative w-[4.5rem] shrink-0">
          <input
            type="number"
            min={range[0]}
            max={range[1]}
            value={set ? value : ""}
            placeholder={fallback !== undefined && fallback !== null ? String(fallback) : ""}
            onChange={(e) => (e.target.value === "" ? onChange(null) : onChange(clamp(Number(e.target.value), range)))}
            className={`${inputCls} h-8 pe-7 text-xs tabular-nums`}
            aria-label={`${label} value`}
          />
          <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-fg-muted">{unit}</span>
        </div>
      </div>
    </Row>
  );
}

function SideInput({ value, fallback, range, onChange, label }) {
  return (
    <input
      type="number"
      min={range[0]}
      max={range[1]}
      value={value ?? ""}
      placeholder={fallback !== undefined ? String(fallback) : "–"}
      title={label}
      aria-label={label}
      onChange={(e) => onChange(e.target.value === "" ? null : clamp(Math.round(Number(e.target.value)), range))}
      className="h-6 w-11 rounded border border-transparent bg-transparent text-center text-[11px] tabular-nums text-fg outline-none placeholder:text-fg-muted hover:border-line focus:border-accent focus:bg-input"
    />
  );
}

/** Webflow jaisa box model: bahar margin, andar padding; link = chaaron sides ek saath */
function BoxModel({ padding, margin, computed, onChange, withPadding = true }) {
  const [linked, setLinked] = useState(false);
  const setSide = (prop, side, v) => {
    const cur = { ...((prop === "padding" ? padding : margin) || {}) };
    for (const s of linked ? SIDES : [side]) {
      if (v === null) delete cur[s];
      else cur[s] = v;
    }
    onChange(prop, Object.keys(cur).length ? cur : null);
  };
  const input = (prop, side) => (
    <SideInput
      label={`${prop === "padding" ? "Padding" : "Margin"} ${SIDE_LABELS[side].toLowerCase()}`}
      value={(prop === "padding" ? padding : margin)?.[side]}
      fallback={computed?.[prop]?.[side]}
      range={ELEMENT_RANGES[prop]}
      onChange={(v) => setSide(prop, side, v)}
    />
  );
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-dashed border-line bg-subtle/40 p-1">
        <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
          <span>Margin</span>
          {input("margin", "t")}
          <span className="w-10" />
        </div>
        <div className="flex items-center gap-1">
          {input("margin", "l")}
          {withPadding ? (
            <div className="flex-1 rounded-md border border-line bg-card p-1">
              <div className="flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                <span>Padding</span>
                {input("padding", "t")}
                <span className="w-10" />
              </div>
              <div className="flex items-center gap-1">
                {input("padding", "l")}
                <div className="h-7 flex-1 rounded bg-accent-soft" aria-hidden />
                {input("padding", "r")}
              </div>
              <div className="flex justify-center">{input("padding", "b")}</div>
            </div>
          ) : (
            <div className="h-10 flex-1 rounded-md border border-line bg-accent-soft" aria-hidden />
          )}
          {input("margin", "r")}
        </div>
        <div className="flex justify-center">{input("margin", "b")}</div>
      </div>
      <button
        type="button"
        onClick={() => setLinked((v) => !v)}
        aria-pressed={linked}
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${linked ? "text-accent" : "text-fg-muted hover:text-fg"}`}
      >
        {linked ? <Link2 size={12} /> : <Link2Off size={12} />} {linked ? "All sides change together" : "Change each side separately"}
      </button>
    </div>
  );
}

/** Width / height (px) — khali = auto (original). Lock = shape same rehti hai. Preview me handles bhi. */
function SizeControl({ style, computed, patch }) {
  const [locked, setLocked] = useState(false);
  const w = style.width ?? computed.width;
  const h = style.height ?? computed.height;
  const ratio = w && h ? w / h : 1;
  const set = (dim, raw) => {
    if (raw === "") return patch({ [dim]: null });
    const v = clamp(Math.round(Number(raw)), ELEMENT_RANGES[dim]);
    if (!Number.isFinite(v)) return undefined;
    if (!locked) return patch({ [dim]: v });
    return patch(dim === "width" ? { width: v, height: clamp(Math.round(v / ratio), ELEMENT_RANGES.height) } : { height: v, width: clamp(Math.round(v * ratio), ELEMENT_RANGES.width) });
  };
  const box = (dim, label) => (
    <label className="min-w-0 flex-1 space-y-1">
      <span className="flex items-center justify-between text-[11px] font-semibold text-fg-secondary">
        {label}
        {style[dim] !== undefined ? (
          <button type="button" onClick={() => patch({ [dim]: null })} className="text-[10px] font-semibold text-accent hover:underline">
            Auto
          </button>
        ) : (
          <span className="text-[10px] font-normal text-fg-muted">Auto</span>
        )}
      </span>
      <span className="relative block">
        <input
          type="number"
          min={ELEMENT_RANGES[dim][0]}
          max={ELEMENT_RANGES[dim][1]}
          value={style[dim] ?? ""}
          placeholder={computed[dim] ? String(computed[dim]) : ""}
          onChange={(e) => set(dim, e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const cur = style[dim] ?? computed[dim] ?? 0;
            set(dim, String(cur + (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1)));
          }}
          className={`${inputCls} h-8 pe-7 text-xs tabular-nums`}
          aria-label={`${label} in pixels`}
        />
        <span className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-fg-muted">px</span>
      </span>
    </label>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5">
        {box("width", "Width")}
        <button
          type="button"
          onClick={() => setLocked((v) => !v)}
          aria-pressed={locked}
          title={locked ? "Shape locked: width and height change together" : "Lock the shape"}
          className={`mb-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition ${
            locked ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-muted hover:bg-subtle hover:text-fg"
          }`}
        >
          {locked ? <Link2 size={13} /> : <Link2Off size={13} />}
        </button>
        {box("height", "Height")}
      </div>
      <p className="text-[11px] text-fg-muted">
        Or drag the handles on its edges in the preview (Shift keeps the shape, double-click a handle for auto). Arrow keys change by 1px, Shift+Arrow by 10px.
      </p>
    </div>
  );
}

/** Ek property ka control (label kind ke hisaab se) */
function Control({ prop, kind, style, computed, patch }) {
  const label = propLabel(prop, kind);
  switch (prop) {
    case "size":
      return <SizeControl style={style} computed={computed} patch={patch} />;
    case "color":
    case "background":
      return (
        <Row label={label} onReset={style[prop] ? () => patch({ [prop]: null }) : null}>
          <ColorPicker value={style[prop] || null} onChange={(v) => patch({ [prop]: v })} inputCls={inputCls} label={label.toLowerCase()} />
        </Row>
      );
    case "fontSize":
      return <Slider label={label} value={style.fontSize} fallback={computed.fontSize} range={ELEMENT_RANGES.fontSize} onChange={(v) => patch({ fontSize: v })} />;
    case "radius":
      return <Slider label={label} value={style.radius} fallback={computed.radius} range={ELEMENT_RANGES.radius} onChange={(v) => patch({ radius: v })} />;
    case "scale":
      return <Slider label={label} value={style.scale} fallback={100} range={ELEMENT_RANGES.scale} unit="%" onChange={(v) => patch({ scale: v })} />;
    case "opacity":
      return <Slider label={label} value={style.opacity} fallback={100} range={ELEMENT_RANGES.opacity} unit="%" onChange={(v) => patch({ opacity: v })} />;
    case "fontWeight":
      return (
        <Row label={label} onReset={style.fontWeight ? () => patch({ fontWeight: null }) : null}>
          <div className="grid grid-cols-4 gap-1">
            {FONT_WEIGHTS.map((w) => {
              const active = (style.fontWeight || computed.fontWeight) === w;
              return (
                <button
                  key={w}
                  type="button"
                  onClick={() => patch({ fontWeight: w })}
                  title={WEIGHT_LABELS[w]}
                  className={`h-8 rounded-md border text-xs transition ${
                    active ? (style.fontWeight ? "border-accent bg-accent-soft text-accent" : "border-line bg-subtle text-fg") : "border-line text-fg-secondary hover:bg-subtle"
                  }`}
                  style={{ fontWeight: w }}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </Row>
      );
    case "textAlign":
      return (
        <Row label={label} onReset={style.textAlign ? () => patch({ textAlign: null }) : null}>
          <div className="grid grid-cols-4 gap-1">
            {ALIGNS.map(({ id, icon: Icon, label: l }) => (
              <button
                key={id}
                type="button"
                onClick={() => patch({ textAlign: id })}
                aria-pressed={style.textAlign === id}
                title={l}
                className={`inline-flex h-8 items-center justify-center rounded-md border transition ${
                  style.textAlign === id ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-secondary hover:bg-subtle"
                }`}
              >
                <Icon size={14} className={id === "start" || id === "end" ? "rtl:-scale-x-100" : ""} />
              </button>
            ))}
          </div>
        </Row>
      );
    case "hidden":
      return (
        <>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={Boolean(style.hidden)} onChange={(e) => patch({ hidden: e.target.checked || null })} className="h-4 w-4 accent-accent" />
            <EyeOff size={14} className="text-fg-muted" /> Hide this {KIND_NOUN[kind] || kind}
          </label>
          {style.hidden ? <p className="text-[11px] text-fg-muted">Hidden on your store. The editor still shows it faded so you can find it again.</p> : null}
        </>
      );
    default:
      return null;
  }
}

export default function ElementPanel({ schema, selection, onBack }) {
  const draft = useThemeEditorStore((s) => s.draft);
  const update = useThemeEditorStore((s) => s.update);
  const setElementStyle = useThemeEditorStore((s) => s.setElementStyle);
  const select = useThemeEditorStore((s) => s.select);
  // Visibility groups band, baaki khule
  const [open, setOpen] = useState({});
  const isOpen = (title) => open[title] ?? !/visibility/i.test(title);
  const toggle = (title) => setOpen((o) => ({ ...o, [title]: !isOpen(title) }));

  const { key, label, computed = {}, fieldId, sectionKey } = selection;
  const kind = KIND_GROUPS[selection.elementKind] ? selection.elementKind : "box";
  const groups = KIND_GROUPS[kind];
  const style = draft?.elements?.[key] || {};
  const patch = (p) => setElementStyle(key, p);
  const fieldValue = fieldId ? readFieldValue(draft, fieldId) : null;

  // Kis section ke andar hai → wahan jane ka link
  const section = sectionKey && sectionKey !== "*" ? draft?.sections?.[sectionKey] : null;
  const productBlock = /^product:(info|below):([a-z0-9_-]+)$/.exec(sectionKey || "");
  const parentLabel = section ? sectionLabel(schema, section) : productBlock ? "Product page block" : null;
  const openParent = () => {
    if (section) select({ kind: "section", id: sectionKey });
    else if (productBlock) select({ kind: "productBlock", zone: productBlock[1], id: productBlock[2] });
  };
  const hasStyle = Object.keys(style).length > 0;
  const otherProps = Object.keys(style).filter((p) => !KIND_PROPS[kind].includes(p));

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft size={14} className="rtl:rotate-180" /> Back
      </button>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-fg">{label}</h2>
          <p className="text-[11px] text-fg-muted">Applies on: {scopeText(key)}</p>
          {parentLabel ? (
            <button type="button" onClick={openParent} className="mt-0.5 text-[11px] font-semibold text-accent hover:underline">
              Inside “{parentLabel}”: open its settings
            </button>
          ) : null}
        </div>
        {hasStyle ? (
          <button
            type="button"
            onClick={() => setElementStyle(key, null)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-fg-secondary hover:bg-subtle hover:text-fg"
          >
            <RotateCcw size={12} /> Reset all
          </button>
        ) : null}
      </div>

      {fieldId && fieldValue !== null ? (
        <Collapsible title="Text" open={isOpen("Text content")} onToggle={() => toggle("Text content")}>
          <textarea
            className={`${inputCls} h-20 py-2`}
            value={fieldValue}
            maxLength={1000}
            onChange={(e) => update((d) => applyFieldValue(d, fieldId, e.target.value))}
            aria-label="Text"
          />
          <p className="text-[11px] text-fg-muted">Tip: click the text in the preview again to type right on the page.</p>
        </Collapsible>
      ) : TEXT_KINDS.includes(kind) ? (
        <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] text-fg-muted">
          This text comes from your store data (products, categories, built-in labels), so only its style can change here.
        </p>
      ) : null}

      {groups.map(([title, props]) => (
        <Collapsible key={title} title={title} open={isOpen(title)} onToggle={() => toggle(title)}>
          {props.includes("padding") || props.includes("margin") ? (
            <BoxModel
              padding={style.padding}
              margin={style.margin}
              computed={computed}
              withPadding={props.includes("padding")}
              onChange={(prop, v) => patch({ [prop]: v })}
            />
          ) : null}
          {props
            .filter((p) => p !== "padding" && p !== "margin")
            .map((prop) => (
              <Control key={prop} prop={prop} kind={kind} style={style} computed={computed} patch={patch} />
            ))}
        </Collapsible>
      ))}

      {/* Is kind ke bahar ki purani changes (jaise container par font size) → dikhao aur hatao */}
      {otherProps.length ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2">
          <p className="min-w-0 flex-1 text-[11px] text-warning">
            Also changed here: {otherProps.map((p) => propLabel(p, "_").toLowerCase()).join(", ")}. These still affect everything inside.
          </p>
          <button
            type="button"
            onClick={() => patch(Object.fromEntries(otherProps.map((p) => [p, null])))}
            className="shrink-0 text-[11px] font-semibold text-warning underline-offset-2 hover:underline"
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
