"use client";

/* ==========================================================
   STORE EDITOR — Category page template (templates.collection.settings)
   /filtering-product: columns, per page, default sort, sidebar, banner
   ========================================================== */

import { useThemeEditorStore } from "../useThemeEditorStore";
import { DEFAULT_COLLECTION_SETTINGS } from "@/storefront/themeDefaults";
import { SettingField } from "./fields";

const isVisible = (field, values, fields) => {
  if (!field?.showIf) return true;
  const dep = fields.find((f) => f.key === field.showIf.key);
  return (values?.[field.showIf.key] ?? dep?.default) === field.showIf.equals;
};

export function CollectionTemplatePanel({ schema }) {
  const draft = useThemeEditorStore((s) => s.draft);
  const update = useThemeEditorStore((s) => s.update);
  const fields = schema?.collection?.settings || [];
  if (!draft || !fields.length) return null;
  const values = { ...DEFAULT_COLLECTION_SETTINGS, ...(draft.templates?.collection?.settings || {}) };

  const setValue = (key, value) =>
    update((d) => {
      d.templates = d.templates || {};
      d.templates.collection = d.templates.collection || { settings: { ...DEFAULT_COLLECTION_SETTINGS } };
      d.templates.collection.settings = { ...d.templates.collection.settings, [key]: value };
    });

  return (
    <div className="space-y-4">
      <div className="px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">Category & product list pages</p>
        <p className="text-[11px] text-fg-muted">Applies to category links, filters and “All products”.</p>
      </div>
      {fields
        .filter((field) => isVisible(field, values, fields))
        .map((field) => (
          <SettingField key={field.key} field={field} value={values[field.key]} onChange={(v) => setValue(field.key, v)} linkTypes={schema.linkTypes} />
        ))}
    </div>
  );
}
