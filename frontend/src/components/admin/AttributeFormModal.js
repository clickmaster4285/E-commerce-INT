"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/i18n/LanguageProvider";

const SlidersIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);

export default function AttributeFormModal({ open, onClose, mode = "create", initialData, initialName = "", onSave, isSaving = false, zIndexClassName = "z-[70]" }) {
  const isEdit = mode === "edit";
  const { t: __t, dir, locale } = useTranslation();
  const t = (key, params) => __t(key.startsWith("admin.") || key.startsWith("common.") ? key : `admin.attributes.${key}`, params);
  const [form, setForm] = useState({
    name: "",
    data_type: "multi_select",
    values: [],
    value: isEdit ? false : "",
    is_active: true,
  });
  const [newOptionInput, setNewOptionInput] = useState("");
  const [editOptionInput, setEditOptionInput] = useState("");
  const optionInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        const dataType = initialData.data_type || "multi_select";
        let booleanValue = typeof initialData.value === "boolean" ? initialData.value : false;
        if (dataType === "boolean") {
          const vals = initialData.values || [];
          const optionText = (entry, depth = 0) => {
            if (typeof entry === "string" || typeof entry === "number") {
              const text = String(entry).trim();
              return /^\[object object\]$/i.test(text) ? "" : text;
            }
            if (!entry || typeof entry !== "object" || depth > 4) return "";
            for (const key of ["en", locale, "label", "value", "name"]) {
              const text = optionText(entry[key], depth + 1);
              if (text) return text;
            }
            return "";
          };
          if (typeof initialData.value !== "boolean") {
            booleanValue = vals.some((entry) => {
              const value = optionText(entry?.value ?? entry).toLowerCase();
              const label = optionText(entry?.label_translations?.[locale])
                || optionText(entry?.label)
                || optionText(entry?.name);
              return value === "true" || label.toLowerCase() === "yes";
            });
          }
        }
        const getOptionText = (entry, depth = 0) => {
          if (typeof entry === "string" || typeof entry === "number") {
            const text = String(entry).trim();
            return /^\[object object\]$/i.test(text) ? "" : text;
          }
          if (!entry || typeof entry !== "object" || depth > 3) return "";
          const nested = entry[locale] || entry.en || entry.label || entry.value || entry.name;
          return nested && nested !== entry ? getOptionText(nested, depth + 1) : "";
        };
        // A Boolean attribute stores its selected default as one Yes/No value.
        // That value is not a Multi Select option, so don't seed it into the
        // options list when switching the saved attribute back to Multi Select.
        const values = dataType === "multi_select"
          ? (initialData.values || [])
              .map((entry) => getOptionText(entry?.label_translations?.[locale]) || getOptionText(entry?.label) || getOptionText(entry?.value) || getOptionText(entry?.name) || getOptionText(entry))
              .filter(Boolean)
          : [];
        setForm({
          name: (typeof initialData.name === "object" && initialData.name) ? String(initialData.name.en || initialData.name.name || initialData.name.label || Object.values(initialData.name)[0] || "") : (initialData.name || ""),
          data_type: dataType,
          values,
          value: booleanValue,
          is_active: initialData.is_active !== false,
        });
        setEditOptionInput("");
        setNewOptionInput("");
      } else {
        setForm({
          name: initialName,
          data_type: "multi_select",
          values: [],
          value: "",
          is_active: true,
        });
        setNewOptionInput("");
        setEditOptionInput("");
      }
    }
  }, [open, isEdit, initialData, initialName]);

  if (!open) return null;

  const handleSave = () => {
    if (!form.name || !form.name.trim()) return;
    const valuesPayload = form.data_type === "multi_select"
      ? (form.values || []).map((opt) => {
          const label = String(opt || "").trim();
          return { label, value: label.toLowerCase() };
        })
      : form.data_type === "boolean"
      ? [
          {
            label: form.value ? "Yes" : "No",
            value: form.value ? "true" : "false",
            sort_order: 0,
            is_active: true,
          },
        ]
      : [];
    const payload = {
      name: form.name.trim(),
      data_type: form.data_type,
      values: valuesPayload,
      is_active: form.is_active !== false,
    };
    if (!isEdit && !payload.name) return;
    if (isEdit) {
      payload.value = form.value;
    }
    onSave && onSave(payload);
  };

  const addOption = () => {
    const val = (isEdit ? editOptionInput : newOptionInput).trim();
    if (!val) return;
    const exists = (form.values || []).some(
      (v) => v.toLowerCase() === val.toLowerCase()
    );
    if (exists) {
      if (isEdit) setEditOptionInput("");
      else setNewOptionInput("");
      return;
    }
    setForm({ ...form, values: [...(form.values || []), val] });
    if (isEdit) setEditOptionInput("");
    else setNewOptionInput("");
  };

  const removeOption = (idx) => {
    setForm({ ...form, values: (form.values || []).filter((_, i) => i !== idx) });
  };

  const title = isEdit ? t("form.editTitle") : t("form.createTitle");
  const subtitle = isEdit ? t("form.editSubtitle") : t("form.createSubtitle");
  const saveText = isEdit
    ? isSaving ? t("form.saving") : t("form.save")
    : isSaving ? t("form.adding") : t("form.create");

  const dataTypeLabels = [
    { id: "multi_select", label: t("form.typeMulti") },
    { id: "boolean", label: t("form.typeYesNo") },
  ];

  const modal = (
    <div dir={dir} lang={locale} className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
      <div
        className="w-[400px] max-w-[92vw] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
              <SlidersIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-0" style={{ maxHeight: "min(640px, 85vh)" }}>
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t("admin.categories.detail.basicInformation")}</p>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t("form.name")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoFocus
                className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                placeholder={t("form.namePlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {t("form.type")}
            </label>
            <div className="grid grid-cols-2 gap-4">
              {dataTypeLabels.map((type) => {
                const isActive = form.data_type === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        data_type: type.id,
                        values: type.id === "boolean" ? form.values : form.values,
                      })
                    }
                    className={`h-auto py-3 px-3 text-[12px] font-semibold flex flex-col items-center justify-center gap-1.5 rounded-lg border transition-all duration-200 text-left ${
                      isActive
                        ? "bg-[var(--accent-soft)]/40 text-[var(--accent)] border-[var(--accent)]/40 shadow-sm"
                        : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {form.data_type === "multi_select" && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t("form.options")}</p>
              <div className="flex flex-wrap gap-1.5">
                {(form.values || []).map((opt, idx) => (
                  <span
                    key={`opt-${idx}`}
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded-md border border-[var(--accent)]/15"
                  >
                    {opt}
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--accent)]/20 transition-colors ml-0.5"
                      aria-label={t("action.delete")}
                    >
                      <CloseIcon className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  ref={optionInputRef}
                  type="text"
                  placeholder={t("form.optionPlaceholder")}
                  value={isEdit ? editOptionInput : newOptionInput}
                  onChange={(e) => (isEdit ? setEditOptionInput(e.target.value) : setNewOptionInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0"
                >
                  <PlusIcon className="w-3 h-3" /> <span>{t("form.addOption")}</span>
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t("form.optionsHint")}
              </p>
            </div>
          )}
          {form.data_type === "boolean" && (
            <div className="space-y-2.5">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t("form.defaultValue")}</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: true, label: t("form.yes") },
                  { id: false, label: t("form.no") },
                ].map((opt) => {
                  const isActive = form.value === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setForm({ ...form, value: opt.id })}
                      className={`h-11 text-[12px] font-semibold flex items-center justify-center gap-2 rounded-lg border transition-all ${isActive
                        ? opt.id === true
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--text-muted)]/30 shadow-sm"
                        : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${isActive
                          ? opt.id === true ? "bg-emerald-500 border-emerald-500" : "bg-[var(--text-muted)] border-[var(--text-muted)]"
                          : "border-[var(--border-color)] bg-transparent"
                        }`}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t("form.defaultValueHint")}
              </p>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
          >
            {t("form.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !form.name || !form.name.trim()}
            className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            {saveText}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? null : createPortal(modal, document.body);
}

