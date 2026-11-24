"use client";

/* ==========================================================
   STORE EDITOR — Product page template panel
   templates.product = { settings, info: {order, blocks}, below: {order, blocks} }
   Schema: GET /theme/schema → product.{blockTypes, settings, zones}
   ========================================================== */

import { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ChevronLeft, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useThemeEditorStore } from "../useThemeEditorStore";
import { buildDefaultProductTemplate } from "@/storefront/themeDefaults";
import { SettingField } from "./fields";

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition hover:bg-subtle hover:text-fg disabled:opacity-30";

export const productTemplateOf = (draft) => {
  const t = draft?.templates?.product;
  const fallback = buildDefaultProductTemplate();
  if (!t) return fallback;
  return {
    settings: { ...fallback.settings, ...(t.settings || {}) },
    info: t.info || fallback.info,
    below: t.below || fallback.below,
  };
};

function BlockRow({ zone, id, block, label, selected }) {
  const controls = useDragControls();
  const { select, updateProductTemplate } = useThemeEditorStore();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      className={`group flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm transition ${
        selected ? "border-accent bg-accent-soft" : "border-transparent bg-card hover:border-line"
      }`}
    >
      <button type="button" onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none rounded p-1 text-fg-muted active:cursor-grabbing" aria-label="Drag to reorder">
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={() => select({ kind: "productBlock", zone, id })}
        className={`min-w-0 flex-1 truncate text-start font-medium ${block.disabled ? "text-fg-muted line-through" : "text-fg"}`}
      >
        {label}
      </button>
      <button
        type="button"
        className={iconBtn}
        onClick={() =>
          updateProductTemplate((tpl) => {
            if (tpl[zone].blocks[id]) tpl[zone].blocks[id].disabled = !tpl[zone].blocks[id].disabled;
          })
        }
        aria-label={block.disabled ? "Show" : "Hide"}
      >
        {block.disabled ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </Reorder.Item>
  );
}

function ZoneList({ schema, zone, template, selected }) {
  const { updateProductTemplate, addProductBlock } = useThemeEditorStore();
  const [adding, setAdding] = useState(false);
  const zoneData = template[zone];
  const zoneDef = schema.product.zones[zone];
  const counts = zoneData.order.reduce((acc, id) => {
    const t = zoneData.blocks[id]?.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const addable = Object.entries(schema.product.blockTypes).filter(
    ([type, def]) => def.zones.includes(zone) && (counts[type] || 0) < def.limit,
  );
  const full = zoneData.order.length >= zoneDef.max;

  return (
    <section className="space-y-2">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{zoneDef.label}</p>
        <p className="text-[11px] text-fg-muted">{zoneDef.hint}</p>
      </div>
      {zoneData.order.length ? (
        <Reorder.Group
          axis="y"
          values={zoneData.order}
          onReorder={(order) =>
            updateProductTemplate((tpl) => {
              tpl[zone].order = order;
            })
          }
          className="space-y-1"
        >
          {zoneData.order.map((id) => {
            const block = zoneData.blocks[id];
            if (!block) return null;
            const def = schema.product.blockTypes[block.type];
            return (
              <BlockRow
                key={id}
                zone={zone}
                id={id}
                block={block}
                label={def?.label || block.type}
                selected={selected?.kind === "productBlock" && selected.zone === zone && selected.id === id}
              />
            );
          })}
        </Reorder.Group>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-3 py-2 text-xs text-fg-muted">Nothing here yet.</p>
      )}
      {adding ? (
        <div className="space-y-1 rounded-lg border border-line bg-card-alt p-2">
          {addable.length ? (
            addable.map(([type, def]) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  addProductBlock(zone, type, def);
                  setAdding(false);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-start text-sm text-fg hover:bg-subtle"
              >
                {def.label}
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-fg-muted">All blocks for this area are already used.</p>
          )}
          <button type="button" onClick={() => setAdding(false)} className="w-full pt-1 text-xs text-fg-muted hover:text-fg">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={full}
          onClick={() => setAdding(true)}
          className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-xs font-semibold text-accent transition hover:border-accent disabled:opacity-50"
        >
          <Plus size={13} /> Add block
        </button>
      )}
    </section>
  );
}

export function ProductTemplatePanel({ schema }) {
  const { draft, selected, updateProductTemplate } = useThemeEditorStore();
  if (!draft || !schema?.product) return null;
  const template = productTemplateOf(draft);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">All product pages</p>
        {schema.product.settings.map((field) => (
          <SettingField
            key={field.key}
            field={field}
            value={template.settings[field.key]}
            onChange={(v) =>
              updateProductTemplate((tpl) => {
                tpl.settings = { ...tpl.settings, [field.key]: v };
              })
            }
          />
        ))}
      </section>
      <ZoneList schema={schema} zone="info" template={template} selected={selected} />
      <ZoneList schema={schema} zone="below" template={template} selected={selected} />
    </div>
  );
}

export function ProductBlockSettings({ schema, zone, id, onBack }) {
  const { draft, updateProductTemplate, removeProductBlock } = useThemeEditorStore();
  const template = productTemplateOf(draft);
  const block = template[zone]?.blocks?.[id];
  if (!block) return null;
  const def = schema.product.blockTypes[block.type];
  const builtIn = def && def.settings.length === 0;

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-fg-muted hover:text-fg">
        <ChevronLeft size={14} /> Product page
      </button>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-fg">{def?.label || block.type}</h2>
        <div className="flex items-center">
          <button
            type="button"
            className={iconBtn}
            onClick={() =>
              updateProductTemplate((tpl) => {
                tpl[zone].blocks[id].disabled = !tpl[zone].blocks[id].disabled;
              })
            }
            title={block.disabled ? "Show" : "Hide"}
          >
            {block.disabled ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className={`${iconBtn} hover:text-danger`}
            onClick={() => {
              if (window.confirm("Remove this block?")) {
                removeProductBlock(zone, id);
                onBack();
              }
            }}
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {!def ? (
        <p className="text-sm text-warning">This block type is no longer supported and will be removed when you save.</p>
      ) : builtIn ? (
        <p className="text-sm text-fg-muted">This block shows your product data automatically. Drag it to change its position, or hide it.</p>
      ) : (
        def.settings.map((field) => (
          <SettingField
            key={field.key}
            field={field}
            value={block.settings?.[field.key]}
            onChange={(v) =>
              updateProductTemplate((tpl) => {
                tpl[zone].blocks[id].settings = { ...tpl[zone].blocks[id].settings, [field.key]: v };
              })
            }
            linkTypes={schema.linkTypes}
          />
        ))
      )}
    </div>
  );
}
