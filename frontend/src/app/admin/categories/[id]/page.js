"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";
import { toast } from "sonner";

/* =========================================================
   ICONS
========================================================= */

function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={sw}
        d={d}
      />
    </svg>
  );
}

const D = {
  back: "M10 19l-7-7m0 0l7-7m-7 7h18",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  folder: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  dots: "M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z", // Vertical dots
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
};

/* =========================================================
   HELPERS
========================================================= */

function getId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return getId(value._id);
    if (value.$oid) return String(value.$oid);
    if (typeof value.toString === "function") {
      const result = value.toString();
      if (result && result !== "[object Object]") return result;
    }
  }
  return "";
}

function formatDateTime(date) {
  if (!date) return "\u2014";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "\u2014";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAttributeId(attribute) {
  const aid = attribute?.attribute_id;
  if (!aid) return String(attribute?._id || "");
  if (typeof aid === "string") return aid;
  if (typeof aid === "object" && aid._id) return String(aid._id);
  return String(aid);
}

// ✅ FIX ISSUE 2: Robustly extract string labels from mixed option formats
function sanitizeOptionLabels(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (!item) continue;

    let label = "";
    if (typeof item === "string") {
      label = item;
    } else if (typeof item === "object" && item !== null) {
      const labelStr = typeof item.label === "string" ? item.label : (typeof item.value === "string" ? item.value : (typeof item.name === "string" ? item.name : ""));
      const valueStr = typeof item.value === "string" ? item.value : (typeof item.label === "string" ? item.label : (typeof item.name === "string" ? item.name : ""));
      label = labelStr || valueStr || "";
      // If label is still an object (corrupted nested data), coerce to string and filter
      if (typeof label !== "string") {
        label = String(label || "");
      }
      // If after coercion it still looks like [object Object], try to recover from nested properties
      if (label.trim() === "[object Object]" || label.trim() === "[object object]") {
        const nestedLabel = item.label?.label || item.label?.value || item.value?.label || item.value?.value || item.name?.label || item.name?.value || "";
        label = (typeof nestedLabel === "string" ? nestedLabel : String(nestedLabel || "")).trim();
      }
    } else {
      label = String(item);
    }

    if (typeof label !== "string") continue;

    const trimmed = label.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

function getDataTypeLabel(type) {
  const map = { multi_select: "Multi Select", select: "Select", color: "Color", boolean: "Yes / No" };
  return map[type] || type || "Multi Select";
}

function getDataTypeBadgeStyle(type) {
  switch (type) {
    case "multi_select":
    case "select":
      return { backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" };
    case "boolean":
      return { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" };
    case "color":
      return { backgroundColor: "rgba(236,72,153,0.1)", color: "#f472b6", border: "1px solid rgba(236,72,153,0.2)" };
    default:
      return { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" };
  }
}

/* =========================================================
   UI COMPONENTS
========================================================= */

const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

function StatusBadge({ active = true }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: active ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
        color: active ? "#34d399" : "#ef4444",
        border: `1px solid ${active ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-red-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button", icon, className = "" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: primary ? "var(--accent)" : "transparent",
        color: primary ? "white" : danger ? "#ef4444" : "var(--text-secondary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,0.2)" : "1px solid var(--border-color)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* =========================================================
   SIDE PANEL FOR VIEWING OPTIONS
========================================================= */

function AttributeOptionsPanel({ attr, onClose }) {
  if (!attr) return null;
  
  const optionLabels = sanitizeOptionLabels(attr.values);
  const isBoolean = attr.data_type === "boolean";
  const isActive = attr.is_active !== false;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[1px] transition-opacity" 
        onClick={onClose}
      />
      
      {/* Side Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-[360px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-[var(--text-primary)] truncate pr-4">{attr.name}</h3>
            <p className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">{attr.code}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
          >
            <Ico d={D.close} className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Details */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Details</h4>
            <div className="space-y-0 rounded-lg border border-[var(--border-color)] overflow-hidden">
              <div className="flex justify-between items-center px-3 py-2.5 bg-[var(--bg-input)]">
                <span className="text-[12px] text-[var(--text-muted)]">Type</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={getDataTypeBadgeStyle(attr.data_type)}>
                  {getDataTypeLabel(attr.data_type)}
                </span>
              </div>
              <div className="flex justify-between items-center px-3 py-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <span className="text-[12px] text-[var(--text-muted)]">Status</span>
                <StatusBadge active={isActive} />
              </div>
              {attr.category_config?.is_variant_option && (
                <div className="flex justify-between items-center px-3 py-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <span className="text-[12px] text-[var(--text-muted)]">Variant</span>
                  <span className="text-[11px] font-medium text-[var(--accent)]">Yes</span>
                </div>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {isBoolean ? "Boolean Values" : "Available Options"}
              </h4>
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                {optionLabels.length}
              </span>
            </div>
            
            <div className="space-y-1.5">
              {optionLabels.length > 0 ? (
                optionLabels.map((label, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg group hover:border-[var(--accent)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 flex items-center justify-center rounded bg-[var(--bg-tertiary)] text-[10px] font-bold text-[var(--text-muted)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] transition-colors">
                        {idx + 1}
                      </span>
                      <span className="text-[12px] font-medium text-[var(--text-primary)]">{label}</span>
                    </div>
                    {isBoolean && (
                       <span className={`w-2 h-2 rounded-full ${label.toLowerCase() === 'yes' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                   <p className="text-[12px] text-[var(--text-muted)]">No options defined.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[var(--border-color)]">
           <Button primary onClick={onClose} className="w-full justify-center">
             Close Panel
           </Button>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   MAIN PAGE
======================================================== */

function AttributeFormModal({ open, onClose, mode = "create", initialData, onSave, isSaving = false }) {
  const isEdit = mode === "edit";

  const [form, setForm] = useState({
    name: "",
    data_type: "multi_select",
    values: [],
    value: isEdit ? false : "",
    is_active: true,
  });
  const [optionInput, setOptionInput] = useState("");

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        const dataType = initialData.data_type || "multi_select";
        let booleanValue = false;
        if (dataType === "boolean") {
          const vals = initialData.values || [];
          const trueEntry = vals.find(
            (v) =>
              (v?.value || v)?.toString() === "true" ||
              (v?.label || v)?.toString()?.toLowerCase() === "yes"
          );
          if (trueEntry) booleanValue = true;
        }
        // ✅ FIX ISSUE 2: Ensure we extract strings correctly when loading into form
        const values = (initialData.values || [])
          .map((v) => {
            if (typeof v === "string") return v.trim();
            if (typeof v === "object" && v !== null) {
              const labelStr = typeof v.label === "string" ? v.label : (typeof v.value === "string" ? v.value : (typeof v.name === "string" ? v.name : ""));
              const valueStr = typeof v.value === "string" ? v.value : (typeof v.label === "string" ? v.label : (typeof v.name === "string" ? v.name : ""));
              let label = (labelStr || valueStr || "").trim();
              if (label === "[object Object]" || label === "[object object]") {
                const nestedLabel = v.label?.label || v.label?.value || v.value?.label || v.value?.value || v.name?.label || v.name?.value || "";
                label = (typeof nestedLabel === "string" ? nestedLabel : String(nestedLabel || "")).trim();
              }
              return label || "";
            }
            return String(v || "").trim();
          })
          .filter((s) => s && s !== "[object Object]" && s !== "[object object]");
        setForm({
          name: initialData.name || "",
          data_type: dataType,
          values,
          value: booleanValue,
          is_active: initialData.is_active !== false,
        });
        setOptionInput("");
      } else {
        setForm({
          name: "",
          data_type: "multi_select",
          values: [],
          value: "",
          is_active: true,
        });
        setOptionInput("");
      }
    }
  }, [open, isEdit, initialData]);

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
    const val = optionInput.trim();
    if (!val) return;
    if (form.data_type === "multi_select" && form.values.some((v) => v.toLowerCase() === val.toLowerCase())) {
      setOptionInput("");
      return;
    }
    setForm({ ...form, values: [...(form.values || []), val] });
    setOptionInput("");
  };

  const removeOption = (idx) => {
    setForm({ ...form, values: (form.values || []).filter((_, i) => i !== idx) });
  };

  const title = isEdit ? "Edit Attribute" : "Add New Attribute";
  const subtitle = isEdit ? "Update attribute details and values." : "Configure properties for products in this category.";
  const saveText = isEdit ? (isSaving ? "Saving..." : "Save Changes") : (isSaving ? "Adding..." : "Add Attribute");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-[400px] max-w-[92vw] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 85vh)" }}>
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
              <ModalLayersIcon className="w-4 h-4" />
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
            <ModalCloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Attribute Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
              placeholder="e.g. Color, Size, RAM"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Attribute Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "multi_select", label: "Multi Options" },
                { id: "boolean", label: "Yes / No" },
              ].map((type) => {
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
                    className={`h-auto py-3 px-3 text-[12px] font-semibold rounded-lg border transition-all text-left flex flex-col gap-0.5 ${
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
            <div className="space-y-2.5">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options</label>
              {(form.values || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(form.values || []).map((val, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded-md border border-[var(--accent)]/15">
                      {val}
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--accent)]/20 transition-colors ml-0.5"
                      >
                        <ModalCloseIcon className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="Add an option (e.g. 8 GB)"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0"
                >
                  <ModalPlusIcon className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          )}

          {form.data_type === "boolean" && (
            <div className="space-y-2.5">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Default Value
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "yes", label: "Yes" },
                  { id: "no", label: "No" },
                ].map((opt) => {
                  const isActive = (opt.id === "yes" && form.value === true) || (opt.id === "no" && form.value === false);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm({ ...form, value: opt.id === "yes" })}
                      className={`h-11 text-[12px] font-semibold flex items-center justify-center gap-2 rounded-lg border transition-all ${
                        isActive
                          ? opt.id === "yes"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10"
                            : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--text-muted)]/30 shadow-sm"
                          : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                        isActive
                          ? opt.id === "yes" ? "bg-emerald-500 border-emerald-500" : "bg-[var(--text-muted)] border-[var(--text-muted)]"
                          : "border-[var(--border-color)] bg-transparent"
                      }`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !form.name || !form.name.trim()}
            className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const categoryId = getId(params?.id);
  const backPath = "/admin/categories";

  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);
  
  // ✅ NEW: Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);

  // ✅ Attribute edit within category detail
  const [attrEditOpen, setAttrEditOpen] = useState(false);
  const [attrEditLoading, setAttrEditLoading] = useState(false);
  const [attrEditTarget, setAttrEditTarget] = useState(null);

  // Create New Attribute state (matches Attribute Management form)
  const [showCreateAttrModal, setShowCreateAttrModal] = useState(false);
  const [createAttrLoading, setCreateAttrLoading] = useState(false);

  // ✅ NEW: Action Menu & Side Panel States
  const [activeMenuId, setActiveMenuId] = useState(null); // ID of attribute with open menu
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [viewPanelAttr, setViewPanelAttr] = useState(null); // Attribute object for side panel

  useAttributeSocketSync();

  // Queries
  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  const { data: category, isLoading: loading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => categoryApi.getById(categoryId),
    enabled: !!categoryId,
    retry: false,
  });

  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", categoryId],
    queryFn: () => categoryApi.getAttributes(categoryId),
    enabled: !!categoryId,
  });

  // Derived data
  const variantAttributes = useMemo(() => {
    return categoryAttributes.filter((attr) => attr.category_config?.is_variant_option);
  }, [categoryAttributes]);

  const parentCategoryName = useMemo(() => {
    if (!category) return "None";
    const parentId = getId(category.parent_category_id);
    if (!parentId) return "None";
    if (category.parent_category_id && typeof category.parent_category_id === "object") {
      return category.parent_category_id.name || "None";
    }
    const found = allCategories.find((item) => String(item._id) === String(parentId));
    return found?.name || "None";
  }, [category, allCategories]);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.removeQueries({ queryKey: ["category", categoryId] });
      toast.success("Category deleted successfully");
      router.push(backPath);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to delete category");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ attrId, currentActive }) => {
      return await attributeApi.update(attrId, { is_active: !currentActive });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success(variables.currentActive ? "Attribute disabled" : "Attribute enabled");
      setActiveMenuId(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update attribute status");
    },
  });

  const createAttributeMutation = useMutation({
    mutationFn: async (data) => {
      return await attributeApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["all-attributes"] });
      setShowCreateAttrModal(false);
      toast.success("Attribute created successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to create attribute");
    },
  });

  // Click outside handler for menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (activeMenuId && !event.target.closest('.action-menu-container') && !event.target.closest('.dropdown-menu-portal')) {
        setActiveMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuId]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full min-h-[600px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spin className="w-6 h-6 text-[var(--accent)]" />
          <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
            Loading category details...
          </span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="w-full min-h-[600px] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <Ico d={D.folder} className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
          </div>
          <h2 className="text-[16px] font-semibold mb-1.5 text-[var(--text-primary)]">Category Not Found</h2>
          <p className="text-[12px] mb-5" style={{ color: "var(--text-muted)" }}>The category you're looking for doesn't exist or has been removed.</p>
          <Button primary onClick={() => router.push(backPath)}>
            Back to Categories
          </Button>
        </div>
      </div>
    );
  }

  return (
    // UPDATED: Wider container (98%), less bottom padding (pb-6), small top padding (pt-2)
    <div className="w-[98%] max-w-[1600px] mx-auto space-y-5 pb-6 pt-2 relative" style={{ color: "var(--text-primary)" }}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all shrink-0 mt-0.5"
          >
            <Ico d={D.back} className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[22px] leading-tight font-bold tracking-tight text-[var(--text-primary)]">{category.name}</h1>
              <StatusBadge active={category.is_active !== false} />
            </div>
            {category.description && (
              <p className="text-[13px] mt-1.5 max-w-xl leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {category.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                <Ico d={D.box} className="w-3.5 h-3.5" /> {categoryAttributes.length} attribute{categoryAttributes.length !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                <Ico d={D.clock} className="w-3.5 h-3.5" /> {formatDateTime(category.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setShowEditModal(true)} icon={<Ico d={D.edit} className="w-3.5 h-3.5" />}>
            Edit
          </Button>
          <Button
            danger
            onClick={() => setShowDelete(true)}
            icon={<Ico d={D.trash} className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--border-color)" }}>
        {[
          { id: "overview", label: "Overview", icon: D.eye },
          { id: "attributes", label: "Attributes", count: categoryAttributes.length, icon: D.box },
          { id: "history", label: "History", icon: D.clock },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative inline-flex items-center gap-1.5 px-4 py-3 text-[12px] font-medium transition-colors outline-none"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              <Ico d={item.icon} className="w-3.5 h-3.5" />
              {item.label}
              {item.count !== undefined && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold tabular-nums"
                  style={{
                    backgroundColor: active ? "rgba(16,185,129,0.12)" : "var(--bg-tertiary)",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {item.count}
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        // UPDATED: Grid uses minmax for left column and fixed width for right column to balance proportions
        // Added items-stretch to ensure both cards match height
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_400px] gap-6 items-stretch">
          
          {/* LEFT COLUMN: Assigned Attributes Table */}
          {/* Added h-full to stretch to match right column */}
          <div className="rounded-xl overflow-hidden flex flex-col h-full" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Assigned Attributes</h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">These attributes are available for products in this category.</p>
              </div>
              <Button primary icon={<Ico d={D.box} className="w-3.5 h-3.5" />} onClick={() => setTab("attributes")}>
                Manage Attributes
              </Button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-10">#</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Name</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Data Type</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options / Values</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryAttributes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center">
                        <p className="text-[13px] text-[var(--text-muted)]">No attributes assigned yet.</p>
                      </td>
                    </tr>
                  ) : (
                    categoryAttributes.slice(0, 5).map((attr, idx) => {
                      const optionLabels = sanitizeOptionLabels(attr.values);
                      const isMultiSelect = attr.data_type === "multi_select" || attr.data_type === "select";
                      const isBoolean = attr.data_type === "boolean";
                      const isActive = attr.is_active !== false;
                      const attrId = getAttributeId(attr);
                      const isMenuOpen = activeMenuId === attrId;

                      const PREVIEW_LIMIT = 3;
                      const visibleOptions = optionLabels.slice(0, PREVIEW_LIMIT);
                      const hiddenCount = optionLabels.length - PREVIEW_LIMIT;

                      return (
                        <tr
                          key={attr._id}
                          className="transition-colors hover:bg-[var(--bg-tertiary)]/20 relative group"
                          style={{ borderBottom: "1px solid var(--border-color)", opacity: isActive ? 1 : 0.5 }}
                        >
                          <td className="px-5 py-3 text-[12px] text-[var(--text-muted)] font-mono">{idx + 1}</td>
                          <td className="px-5 py-3 text-[13px] font-medium text-[var(--text-primary)]">{attr.name}</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={getDataTypeBadgeStyle(attr.data_type)}>
                              {getDataTypeLabel(attr.data_type)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {isMultiSelect ? (
                              <div className="flex flex-wrap gap-1">
                                {visibleOptions.map((label, i) => (
                                  <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded truncate max-w-[80px]" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                    {label}
                                  </span>
                                ))}
                                {hiddenCount > 0 && <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>+{hiddenCount} more</span>}
                              </div>
                            ) : isBoolean ? (
                              <span className="text-[11px] text-[var(--text-secondary)]">Yes, No</span>
                            ) : (
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>\u2014</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                              style={{
                                backgroundColor: isActive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                color: isActive ? "#34d399" : "#f87171",
                                border: `1px solid ${isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}`,
                              }}
                            >
                              <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          
                          {/* ACTION COLUMN */}
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end relative action-menu-container">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(isMenuOpen ? null : attrId);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                <Ico d={D.dots} className="w-4 h-4" />
                              </button>

                              {/* DROPDOWN MENU */}
                              {isMenuOpen && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl z-50 overflow-visible pointer-events-auto">
                                  <div className="py-1">
                                    <button
                                      onClick={() => {
                                        setViewPanelAttr(attr);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <Ico d={D.eye} className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                      View Options
                                    </button>
                                    
                                    <button
                                      onClick={(e) => {
                                        // ✅ FIX ISSUE 1: Stop propagation to prevent row click
                                        e.stopPropagation();
                                        const fullAttr = categoryAttributes.find((a) => getAttributeId(a) === attrId);
                                        if (fullAttr) {
                                          // ✅ FIX ISSUE 1: Close view panel if open
                                          setViewPanelAttr(null);
                                          setAttrEditTarget(fullAttr);
                                          setAttrEditOpen(true);
                                        }
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                    >
                                      <Ico d={D.edit} className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                      Edit Attribute
                                    </button>

                                    <div className="h-px bg-[var(--border-color)] my-1" />

                                    <button
                                      onClick={() => handleToggleAttributeActive(attr)}
                                      className="w-full px-4 py-2 text-left text-[12px] font-medium hover:bg-[var(--bg-tertiary)] flex items-center gap-2"
                                      style={{ color: isActive ? "#f87171" : "#34d399" }}
                                    >
                                      <Ico d={isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} className="w-3.5 h-3.5" />
                                      {isActive ? "Disable" : "Enable"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {categoryAttributes.length > 5 && (
              <div className="px-5 py-3 border-t border-[var(--border-color)] text-center shrink-0">
                <button onClick={() => setTab("attributes")} className="text-[11px] font-medium text-[var(--accent)] hover:underline">
                  View all {categoryAttributes.length} attributes
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Category Information */}
          {/* Added h-full to stretch to match left column */}
          <div className="rounded-xl overflow-hidden flex flex-col h-full" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] shrink-0">
              <h3 className="text-[14px] font-bold text-[var(--text-primary)]">Category Information</h3>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] w-28 shrink-0 pt-0.5">Category Name</span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] text-right">{category.name}</span>
                </div>
                
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] w-28 shrink-0 pt-0.5">Slug</span>
                  <span className="text-[13px] font-mono font-medium text-[var(--text-secondary)] text-right break-all">{category.slug || category.category_code || "\u2014"}</span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] w-28 shrink-0 pt-0.5">Created At</span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] text-right">{formatDateTime(category.created_at)}</span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] w-28 shrink-0 pt-0.5">Created By</span>
                  <span className="text-[13px] font-medium text-[var(--text-primary)] text-right">{category.createdby?.name || "—"}</span>
                </div>
              </div>

              {category.description && (
                <div className="pt-4 border-t border-[var(--border-color)]">
                  <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Description</p>
                  <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--border-color)]">
                    {category.description}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ATTRIBUTES TAB */}
      {tab === "attributes" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-[var(--text-primary)]">
                {categoryAttributes.length} {categoryAttributes.length === 1 ? "Attribute" : "Attributes"}
              </h3>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                Assigned to {category.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {variantAttributes.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.12)" }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  {variantAttributes.length} Variant {variantAttributes.length === 1 ? "Attribute" : "Attributes"}
                </span>
              )}
            </div>
          </div>

          {categoryAttributes.length === 0 ? (
            <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <Ico d={D.box} className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>No attributes assigned</p>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>This category does not have any attributes assigned yet.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider w-10">#</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Data Type</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryAttributes.map((attr, idx) => {
                      const optionLabels = sanitizeOptionLabels(attr.values);
                      const optionCount = optionLabels.length;
                      const isMultiSelect = attr.data_type === "multi_select" || attr.data_type === "select";
                      const isBoolean = attr.data_type === "boolean";
                      const isVariant = attr.category_config?.is_variant_option;
                      const isActive = attr.is_active !== false;
                      const attrId = getAttributeId(attr);
                      const isMenuOpen = activeMenuId === attrId;

                      const PREVIEW_LIMIT = 3;
                      const visibleOptions = optionLabels.slice(0, PREVIEW_LIMIT);
                      const hiddenCount = optionCount - PREVIEW_LIMIT;

                      const boolValue = isBoolean ? (() => {
                        const trueEntry = optionLabels.find((l) => l.toLowerCase() === "yes" || l.toLowerCase() === "true");
                        const falseEntry = optionLabels.find((l) => l.toLowerCase() === "no" || l.toLowerCase() === "false");
                        if (attr.value === true || attr.value === "true" || trueEntry) return "Yes";
                        if (attr.value === false || attr.value === "false" || falseEntry) return "No";
                        return null;
                      })() : null;

                      return (
                        <tr
                          key={attr._id}
                          onClick={() => setViewPanelAttr(attr)}
                          className="transition-colors hover:bg-[var(--bg-tertiary)]/20 relative group cursor-pointer"
                          style={{ borderBottom: idx < categoryAttributes.length - 1 ? "1px solid var(--border-color)" : "none", opacity: isActive ? 1 : 0.5 }}
                        >
                          <td className="px-5 py-3 text-[12px] text-[var(--text-muted)] font-mono">{idx + 1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.12)" }}>
                                <Ico d={D.box} className="w-4 h-4" style={{ color: "#a78bfa" }} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{attr.name}</p>
                                  {isVariant && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.08)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.12)" }}>
                                      Variant
                                    </span>
                                  )}
                                  {!isActive && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.12)" }}>
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={getDataTypeBadgeStyle(attr.data_type)}>
                              {getDataTypeLabel(attr.data_type)}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {isMultiSelect ? (
                              optionCount > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {visibleOptions.map((label, i) => (
                                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded truncate max-w-[80px]" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                      {label}
                                    </span>
                                  ))}
                                  {hiddenCount > 0 && <span className="text-[9px] font-medium" style={{ color: "var(--text-muted)" }}>+{hiddenCount} more</span>}
                                </div>
                              ) : (
                                <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>No options</span>
                              )
                            ) : isBoolean ? (
                              boolValue ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: boolValue === "Yes" ? "rgba(16,185,129,0.08)" : "rgba(107,114,128,0.08)", color: boolValue === "Yes" ? "#34d399" : "#9ca3af", border: `1px solid ${boolValue === "Yes" ? "rgba(16,185,129,0.12)" : "rgba(107,114,128,0.12)"}` }}>
                                  {boolValue}
                                </span>
                              ) : (
                                <span className="text-[10px] italic" style={{ color: "var(--text-muted)" }}>Not set</span>
                              )
                            ) : (
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>\u2014</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                              style={{
                                backgroundColor: isActive ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                color: isActive ? "#34d399" : "#f87171",
                                border: `1px solid ${isActive ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}`,
                              }}
                            >
                              <span className={`w-1 h-1 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          
                          {/* ACTION COLUMN */}
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end relative action-menu-container">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const btnEl = e.currentTarget;
                                  const rect = btnEl.getBoundingClientRect();
                                  const menuW = 192;
                                  const adjustedLeft = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8));
                                  setMenuPos({ top: rect.bottom + 4, left: adjustedLeft });
                                  setActiveMenuId(isMenuOpen ? null : attrId);
                                }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                <Ico d={D.dots} className="w-4 h-4" />
                              </button>

                              {/* DROPDOWN MENU - Fixed portal to escape overflow clipping */}
                              {isMenuOpen && (() => {
                                const isTogglingThis = toggleStatusMutation.isPending && toggleStatusMutation.variables?.attrId === attrId;
                                return createPortal(
                                  <div
                                  className="fixed z-[9999] w-48 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl overflow-visible pointer-events-auto dropdown-menu-portal"
                                  style={{
                                    top: menuPos.top,
                                    left: menuPos.left,
                                    pointerEvents: "auto",
                                  }}
                                  >
                                    <div className="py-1">
                                      <button
                                        onClick={() => {
                                          setViewPanelAttr(attr);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 opacity-100 pointer-events-auto cursor-pointer"
                                      >
                                        <Ico d={D.eye} className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                        View Options
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          // ✅ FIX ISSUE 1: Stop propagation to prevent row click
                                          e.stopPropagation();
                                          const fullAttr = categoryAttributes.find((a) => getAttributeId(a) === attrId);
                                          if (fullAttr) {
                                            // ✅ FIX ISSUE 1: Close view panel if open
                                            setViewPanelAttr(null);
                                            setAttrEditTarget(fullAttr);
                                            setAttrEditOpen(true);
                                          }
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 opacity-100 pointer-events-auto cursor-pointer"
                                      >
                                        <Ico d={D.edit} className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                        Edit Attribute
                                      </button>

                                      <div className="h-px bg-[var(--border-color)] my-1" />

                                      <button
                                        type="button"
                                        disabled={isTogglingThis}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isTogglingThis) return;
                                          setActiveMenuId(null);
                                          toggleStatusMutation.mutate({ attrId, currentActive: isActive });
                                        }}
                                        className={`w-full px-4 py-2 text-left text-[12px] font-medium flex items-center gap-2 transition-colors duration-150 ${isTogglingThis ? "opacity-80 cursor-wait" : "opacity-100 cursor-pointer hover:bg-[var(--bg-tertiary)]"}`}
                                        style={{ color: isActive ? "#f87171" : "#34d399", pointerEvents: isTogglingThis ? "none" : "auto" }}
                                      >
                                        {isTogglingThis ? (
                                          <>
                                            <Spin className="w-3.5 h-3.5" />
                                            <span className="opacity-70">{isActive ? "Disabling..." : "Enabling..."}</span>
                                          </>
                                        ) : (
                                          <>
                                            <Ico d={isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} className="w-3.5 h-3.5" />
                                            <span className="opacity-100">{isActive ? "Disable" : "Enable"}</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full Attribute Edit Modal - Reuses AttributeFormModal */}
      <AttributeFormModal
        open={attrEditOpen && !!attrEditTarget}
        onClose={() => { setAttrEditOpen(false); setAttrEditTarget(null); }}
        mode="edit"
        initialData={attrEditTarget ? {
          name: attrEditTarget.name || "",
          data_type: attrEditTarget.data_type || "multi_select",
          values: (attrEditTarget.values || []).map((v) => {
            // ✅ FIX ISSUE 2: Ensure we extract strings correctly when loading into form
            if (typeof v === "string") return v;
            if (typeof v === "object") return String(v.label || v.value || v.name || "");
            return String(v);
          }).filter(Boolean),
          value: (() => {
            if (attrEditTarget.data_type === "boolean") {
              const vals = attrEditTarget.values || [];
              const trueEntry = vals.find(
                (v) => (v?.value || v)?.toString() === "true" || (v?.label || v)?.toString()?.toLowerCase() === "yes"
              );
              return !!trueEntry;
            }
            return false;
          })(),
          is_active: attrEditTarget.is_active !== false,
        } : null}
        isSaving={attrEditLoading}
        onSave={async (payload) => {
          if (!attrEditTarget) return;
          setAttrEditLoading(true);
          try {
            const attrId = getAttributeId(attrEditTarget);
            const valuesPayload = payload.data_type === "multi_select"
              ? (payload.values || []).map((opt) => {
                  if (typeof opt === "string") {
                    const label = String(opt || "").trim();
                    return { label, value: label.toLowerCase() };
                  }
                  if (typeof opt === "object" && opt !== null) {
                    const labelStr = typeof opt.label === "string" ? opt.label : (typeof opt.value === "string" ? opt.value : (typeof opt.name === "string" ? opt.name : ""));
                    const valueStr = typeof opt.value === "string" ? opt.value : (typeof opt.label === "string" ? opt.label : (typeof opt.name === "string" ? opt.name : ""));
                    const label = (labelStr || valueStr || "").trim();
                    const value = (valueStr || labelStr || "").trim();
                    return { label: label || value, value: value || label.toLowerCase(), sort_order: typeof opt.sort_order === "number" ? opt.sort_order : 0, is_active: opt.is_active !== false };
                  }
                  const label = String(opt || "").trim();
                  return { label, value: label.toLowerCase() };
                })
              : payload.data_type === "boolean"
                ? [{ label: payload.value ? "Yes" : "No", value: payload.value ? "true" : "false", sort_order: 0, is_active: true }]
                : [];
            const savePayload = {
              name: payload.name.trim(),
              data_type: payload.data_type,
              is_active: payload.is_active !== false,
              values: valuesPayload,
            };
            await attributeApi.update(attrId, savePayload);
            await queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] });
            toast.success("Attribute updated successfully");
            setAttrEditOpen(false);
            setAttrEditTarget(null);
          } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || "Failed to update attribute");
          } finally {
            setAttrEditLoading(false);
          }
        }}
      />

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-3.5 border-b border-[var(--border-color)]">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Activity History</h3>
          </div>
          <div className="p-6">
            <div className="space-y-5 relative before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-px before:bg-[var(--border-color)]">
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-emerald-500 shadow-sm" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Created</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{category.createdby?.name || "—"}</span>
                    </p>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{formatDateTime(category.created_at)}</span>
                </div>
              </div>
              {category.updatedby && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-blue-500 shadow-sm" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Updated</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{category.updatedby?.name || "—"}</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{formatDateTime(category.updated_at)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[400px] rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.12)" }}>
                <Ico d={D.trash} className="w-5 h-5" style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Delete Category?</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span className="font-medium text-[var(--text-primary)]">{category.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button
                danger
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                icon={deleteMutation.isPending ? <Spin className="w-3.5 h-3.5" /> : null}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* EDIT CATEGORY MODAL */}
      {showEditModal && (
        <CategoryEditModal
          categoryId={categoryId}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
            queryClient.invalidateQueries({ queryKey: ["categories"] });
            toast.success("Category updated successfully");
          }}
        />
      )}

      {/* ATTRIBUTE OPTIONS SIDE PANEL */}
      {viewPanelAttr && (
        <AttributeOptionsPanel 
          attr={viewPanelAttr} 
          onClose={() => setViewPanelAttr(null)} 
        />
      )}

    </div>
  );
}

/* =========================================================
   EDIT CATEGORY MODAL (Same as Main Page)
========================================================= */
/* =========================================================
   EXACT SAME EDIT CATEGORY MODAL (Self-Contained Replica)
========================================================= */
const ModalPlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const ModalSearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ModalChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ModalLayersIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>);
const ModalCloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ModalSpinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);

function CategoryEditModal({ categoryId, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({ category_code: "", name: "", description: "", parent_category_id: "", status: "active", attributes: [] });
  const [showAttrSelectModal, setShowAttrSelectModal] = useState(false);
  const [attrSearch, setAttrSearch] = useState("");
  const [tempSelectedAttrIds, setTempSelectedAttrIds] = useState([]);
  const [showCreateAttrModal, setShowCreateAttrModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("multi_select");
  const [newAttrValues, setNewAttrValues] = useState([]);
  const [newAttrValueInput, setNewAttrValueInput] = useState("");
  const [newAttrDefaultValue, setNewAttrDefaultValue] = useState("yes");
  const [creatingAttribute, setCreatingAttribute] = useState(false);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const parentDropdownRef = useRef(null);
  const [parentDropdownPos, setParentDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const { data: category, isLoading: categoryLoading } = useQuery({ queryKey: ["category", categoryId], queryFn: () => categoryApi.getById(categoryId), enabled: !!categoryId });
  const { data: allCategories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: allAttributes = [] } = useQuery({ queryKey: ["all-attributes"], queryFn: () => attributeApi.getAll(), enabled: showAttrSelectModal || showCreateAttrModal });

  useEffect(() => {
    if (category) {
      const loadedAttrs = (category.attributes || []).map((a, i) => {
        let value = a.value;
        const attrObj = a.attribute_id;
        const dataType = (attrObj && typeof attrObj === "object") ? attrObj.data_type : null;
        if (dataType === "boolean") value = (value === "true" || value === true);
        let seed_name = "", seed_code = "", seed_type = "", seed_options = [];
        if (attrObj && typeof attrObj === "object" && attrObj.name) {
          seed_name = attrObj.name || ""; seed_code = attrObj.code || "";
          seed_type = (attrObj.data_type === "select" || attrObj.data_type === "color") ? "multi_select" : (attrObj.data_type || "");
          seed_options = (attrObj.values || []).map((v) => v.label || v.value || v);
        } else if (a.seed_name) { seed_name = a.seed_name || ""; seed_code = a.seed_code || ""; seed_type = a.seed_type || ""; seed_options = a.seed_options || []; }
        return { ...a, value, seed_name, seed_code, seed_type, seed_options, ui_key: a.ui_key || `edit-${getAttributeId(a) || seed_code || `idx-${i}`}-${i}` };
      });
      setFormData({
        category_code: category.category_code || "", name: category.name || "", description: category.description || "",
        parent_category_id: getId(category.parent_category_id), status: category.is_active !== false ? "active" : "inactive", attributes: loadedAttrs,
      });
    }
  }, [category]);

  const updateMutation = useMutation({
    mutationFn: (data) => categoryApi.update(categoryId, data),
    onSuccess: async () => {
      const attrs = formData.attributes || [];
      const properAttrs = attrs.filter((a) => a && (a.attribute_id || a.seed_code)).map((a) => {
        const raw = a.attribute_id || a._id; let aid = !raw ? undefined : (typeof raw === "string" ? raw : (typeof raw === "object" && raw._id ? String(raw._id) : String(raw)));
        return { attribute_id: aid || undefined, is_visible: a.is_visible !== false, is_searchable: Boolean(a.is_searchable), is_variant_option: a.is_variant_option !== false, sort_order: typeof a.sort_order === "number" ? a.sort_order : 0, value: Array.isArray(a.value) ? a.value : (a.value != null ? String(a.value) : "") };
      }).filter((a) => !!a.attribute_id);
      if (properAttrs.length > 0) { try { await categoryApi.updateAttributes(String(categoryId), properAttrs); } catch (err) { console.error("Attribute sync failed:", err); } }
      onSuccess();
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    updateMutation.mutate({ ...formData, parent_category_id: formData.parent_category_id || null, is_active: formData.status === "active" });
  };

  const removeAttributeFromForm = (attrId) => setFormData((p) => ({ ...p, attributes: p.attributes.filter((a) => String(getAttributeId(a)) !== String(attrId)) }));
  const openAttrSelectModal = () => { setTempSelectedAttrIds(formData.attributes.map((a) => getAttributeId(a)).filter(Boolean)); setAttrSearch(""); setShowAttrSelectModal(true); };
  const toggleTempAttribute = (attrId) => setTempSelectedAttrIds((prev) => prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]);
  
  const applyAttributeSelection = () => {
    const newAttrs = [];
    tempSelectedAttrIds.forEach((attrId, index) => {
      const existing = formData.attributes.find((a) => String(getAttributeId(a)) === String(attrId));
      if (existing) newAttrs.push({ ...existing, sort_order: index });
      else {
        const attr = allAttributes.find((a) => String(a._id) === String(attrId));
        if (attr) {
          const mappedSeedType = attr.data_type === "select" || attr.data_type === "color" ? "multi_select" : attr.data_type;
          newAttrs.push({ ui_key: `sel-${attrId}-${Date.now()}`, attribute_id: attr._id, seed_code: attr.code, seed_name: attr.name, seed_type: mappedSeedType, seed_options: (attr.values || []).map(v => v.label || v.value || v), is_visible: true, is_searchable: true, sort_order: index, value: mappedSeedType === "multi_select" ? [] : "" });
        }
      }
    });
    setFormData((p) => ({ ...p, attributes: newAttrs })); setShowAttrSelectModal(false);
  };

  const handleCreateAttribute = async () => {
    if (!newAttrName.trim() || creatingAttribute) return;
    if (newAttrType === "multi_select" && newAttrValues.length === 0) { toast.error("At least one option is required"); return; }
    setCreatingAttribute(true);
    try {
      const code = newAttrName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const payload = { name: newAttrName.trim(), code, data_type: newAttrType, description: "", values: newAttrType === "multi_select" ? newAttrValues.map((v) => ({ label: v, value: v })) : [{ label: newAttrDefaultValue === "yes" ? "Yes" : "No", value: newAttrDefaultValue }] };
      const created = await attributeApi.create(payload); queryClient.invalidateQueries({ queryKey: ["all-attributes"] });
      if (created && created._id) {
        const mappedType = created.data_type === "select" || created.data_type === "color" ? "multi_select" : created.data_type;
        const newAttrEntry = { ui_key: `sel-${created._id}-${Date.now()}`, attribute_id: created._id, seed_code: created.code, seed_name: created.name, seed_type: mappedType, seed_options: (created.values || []).map(v => v.label || v.value || v), is_visible: true, is_searchable: true, sort_order: formData.attributes.length, value: mappedType === "multi_select" ? [] : (newAttrDefaultValue === "yes" ? true : false) };
        setFormData((p) => ({ ...p, attributes: [...p.attributes, newAttrEntry] })); setTempSelectedAttrIds((prev) => [...prev, created._id]);
      }
      setShowCreateAttrModal(false); setNewAttrName(""); setNewAttrType("multi_select"); setNewAttrValues([]); setNewAttrValueInput(""); setNewAttrDefaultValue("yes"); setAttrSearch("");
      toast.success(`Attribute "${created?.name}" created`);
    } catch (err) { toast.error(err.response?.data?.message || "Failed to create attribute"); } finally { setCreatingAttribute(false); }
  };

  const filteredAllAttributes = useMemo(() => !attrSearch.trim() ? allAttributes : allAttributes.filter((a) => a.name?.toLowerCase().includes(attrSearch.toLowerCase()) || a.code?.toLowerCase().includes(attrSearch.toLowerCase())), [allAttributes, attrSearch]);
  
  const buildHierarchy = (cats, parentId = null, depth = 0) => {
    const result = []; const normalizedParent = parentId === null ? "" : getId(parentId);
    const children = cats.filter((c) => getId(c.parent_category_id) === normalizedParent && String(c._id) !== String(categoryId));
    for (const cat of children) { result.push({ ...cat, depth }); result.push(...buildHierarchy(cats, cat._id, depth + 1)); } return result;
  };
  const hierarchicalCategories = buildHierarchy(allCategories);
  const selectedParentName = formData.parent_category_id ? allCategories.find((c) => String(c._id) === String(formData.parent_category_id))?.name || "None" : "None";

  if (categoryLoading || !category) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-[580px] max-h-[85vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0"><Ico d={D.folder} className="w-4 h-4" /></div>
              <div><h2 className="text-[14px] font-bold text-[var(--text-primary)]">Edit Category</h2><p className="text-[11px] text-[var(--text-muted)] mt-0.5">Define category details, attributes, and hierarchy.</p></div>
            </div>
            <button type="button" onClick={onClose} disabled={updateMutation.isPending} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"><Ico d={D.close} className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
            <div className="p-5 space-y-4">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5"><label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Code</label><input type="text" value={formData.category_code} readOnly className="w-full h-[38px] px-3 text-[12px] font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] opacity-60" /></div>
                  <div className="space-y-1.5"><label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Name <span className="text-red-500">*</span></label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)]" /></div>
                </div>
                <div className="space-y-1.5"><label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 text-[12px] outline-none resize-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)]" /></div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Category Hierarchy</p>
                <div className="space-y-1.5"><label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Parent Category</label>
                  <div className="relative">
                    <button ref={parentDropdownRef} type="button" onClick={() => { if (!showParentDropdown && parentDropdownRef.current) { const rect = parentDropdownRef.current.getBoundingClientRect(); setParentDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width }); } setShowParentDropdown(!showParentDropdown); }} className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] transition-colors cursor-pointer flex items-center justify-between gap-2">
                      <span className="truncate text-left">{selectedParentName}</span><ModalChevronDownIcon className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${showParentDropdown ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Product Attributes</p>
                <div className="space-y-1.5"><label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Attributes</label>
                  <button type="button" onClick={openAttrSelectModal} className="w-full min-h-[38px] px-3 py-2 text-[12px] text-left outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] transition-colors flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0"><ModalLayersIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />{formData.attributes.length === 0 ? <span className="text-[var(--text-muted)]">Select Attributes</span> : <span className="text-[var(--text-secondary)]">{formData.attributes.length} attribute{formData.attributes.length !== 1 ? "s" : ""} selected</span>}</span>
                    <span className="text-[var(--text-muted)] text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] shrink-0">Browse</span>
                  </button>
                  {formData.attributes.length > 0 && (<div className="flex flex-wrap gap-[6px] pt-1.5">{formData.attributes.map((attr, i) => (<span key={attr.ui_key || i} className="inline-flex items-center gap-1.5 pl-[10px] pr-[8px] py-[3px] text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-[5px] border border-[var(--border-color)] h-[28px]">{attr.seed_name || `Attribute ${i + 1}`}<button type="button" onClick={() => removeAttributeFromForm(getAttributeId(attr))} className="w-[22px] h-[22px] flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-card)] transition-colors ml-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"><Ico d={D.close} className="w-[10px] h-[10px]" /></button></span>))}</div>)}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Status</p>
                <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-0.5 h-[38px] max-w-xs">
                  {[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }].map((opt) => {
                    const isActive = formData.status === opt.id;
                    return (<button key={opt.id} type="button" onClick={() => setFormData({ ...formData, status: opt.id })} className={`flex-1 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}><span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? (opt.id === "active" ? "bg-emerald-500" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />{opt.label}</button>);
                  })}
                </div>
              </div>
            </div>
          </form>
          <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={onClose} disabled={updateMutation.isPending} className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">Cancel</button>
            <button type="submit" onClick={handleSubmit} disabled={updateMutation.isPending} className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50">{updateMutation.isPending ? <ModalSpinner className="w-3.5 h-3.5" /> : <Ico d={D.check} className="w-3.5 h-3.5" />}Update Category</button>
          </div>
        </div>
      </div>

      {showParentDropdown && createPortal(<>
        <div className="fixed inset-0 z-[9998]" onClick={() => setShowParentDropdown(false)} />
        <div className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl overflow-hidden" style={{ top: parentDropdownPos.top, left: parentDropdownPos.left, width: parentDropdownPos.width, maxHeight: "240px" }}>
          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            <button type="button" onClick={() => { setFormData({ ...formData, parent_category_id: "" }); setShowParentDropdown(false); }} className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${!formData.parent_category_id ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}><span>None</span>{!formData.parent_category_id && <Ico d={D.check} className="w-3.5 h-3.5 text-[var(--accent)]" />}</button>
            {hierarchicalCategories.map((cat) => (<button key={cat._id} type="button" onClick={() => { setFormData({ ...formData, parent_category_id: cat._id }); setShowParentDropdown(false); }} className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${String(formData.parent_category_id) === String(cat._id) ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`} style={{ paddingLeft: `${12 + cat.depth * 16}px` }}><span className="truncate">{cat.name}</span>{String(formData.parent_category_id) === String(cat._id) && <Ico d={D.check} className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}</button>))}
          </div>
        </div>
      </>, document.body)}

      {showAttrSelectModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 80vh)" }}>
            <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0"><div><h3 className="text-[13px] font-bold text-[var(--text-primary)]">Select Attributes</h3><p className="text-[11px] text-[var(--text-muted)] mt-0.5">Select attributes to use for products in this category.</p></div><button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }} className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"><Ico d={D.close} className="w-3.5 h-3.5" /></button></div>
            {tempSelectedAttrIds.length > 0 && (
              <div className="px-5 py-2.5 border-b border-[var(--border-color)] shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Selected Attributes</span>
                  <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded tabular-nums">{tempSelectedAttrIds.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto">
                  {tempSelectedAttrIds.map((attrId) => {
                    const attr = allAttributes.find((a) => String(a._id) === String(attrId));
                    if (!attr) return null;
                    return (
                      <span key={attrId} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-md border border-[var(--border-color)]">
                        {attr.name}
                        <button type="button" onClick={() => toggleTempAttribute(attrId)}
                          className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--bg-card)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                          <ModalCloseIcon className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="px-5 py-2.5 border-b border-[var(--border-color)] shrink-0"><div className="relative"><span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><ModalSearchIcon className="w-3.5 h-3.5" /></span><input type="text" placeholder="Search attributes..." value={attrSearch} onChange={(e) => setAttrSearch(e.target.value)} className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" autoFocus /></div></div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {allAttributes.length > 0 ? (filteredAllAttributes.length > 0 ? filteredAllAttributes.map((attr) => { const isChecked = tempSelectedAttrIds.includes(attr._id); return (<button key={attr._id} type="button" onClick={() => toggleTempAttribute(attr._id)} className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors border-b border-[var(--border-color)] last:border-b-0 ${isChecked ? "bg-[var(--accent-soft)]/30" : "hover:bg-[var(--bg-tertiary)]"}`}><div className={`w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded border-[1.5px] transition-colors ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-input)]"}`}>{isChecked && <Ico d={D.check} className="w-3 h-3 text-white" />}</div><div className="flex-1 min-w-0"><p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{attr.name}</p><p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{attr.code} &middot; {attr.data_type || "text"}</p></div>{attr.values && attr.values.length > 0 && <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">{attr.values.length} values</span>}</button>); }) : <div className="px-5 py-6 text-center"><p className="text-[12px] text-[var(--text-muted)] mb-1">No matching attributes found</p></div>) : <div className="px-5 py-8 text-center"><p className="text-[12px] text-[var(--text-muted)] mb-1">No attributes available yet</p></div>}
            </div>
            {!showCreateAttrModal && (<div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">{attrSearch.trim() && filteredAllAttributes.length === 0 ? (<div className="px-5 py-2.5"><button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(attrSearch.trim()); }} className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]"><ModalPlusIcon className="w-3.5 h-3.5 shrink-0" /><span className="text-[12px] font-medium">Create "{attrSearch.trim()}"</span></button></div>) : !attrSearch.trim() ? (<div className="px-5 py-2.5"><button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(""); }} className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]"><ModalPlusIcon className="w-3.5 h-3.5 shrink-0" /><span className="text-[12px] font-medium">Create new attribute</span></button></div>) : null}</div>)}
            <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0"><button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }} className="h-8 px-3 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">Cancel</button><button type="button" onClick={applyAttributeSelection} className="h-8 px-4 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm">Apply{tempSelectedAttrIds.length > 0 ? ` (${tempSelectedAttrIds.length})` : ""}</button></div>
          </div>
        </div>, document.body
      )}

      {showCreateAttrModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-[400px] max-w-[92vw] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 85vh)" }}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between shrink-0"><div className="flex items-start gap-3 min-w-0"><div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0"><ModalLayersIcon className="w-4 h-4" /></div><div className="min-w-0 pt-0.5"><h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Add New Attribute</h3><p className="text-[11px] text-[var(--text-muted)] mt-0.5">Configure properties for products in this category.</p></div></div><button type="button" onClick={() => { setShowCreateAttrModal(false); setNewAttrName(""); setNewAttrType("multi_select"); setNewAttrValues([]); setNewAttrValueInput(""); setNewAttrDefaultValue("yes"); }} className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"><Ico d={D.close} className="w-3.5 h-3.5" /></button></div>
            <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              <div className="space-y-1.5"><label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label><input type="text" value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} autoFocus className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" placeholder="e.g. Color, Size, RAM" /></div>
              <div className="space-y-2"><label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Type</label><div className="grid grid-cols-2 gap-3">{[{ id: "multi_select", label: "Multi Options" }, { id: "boolean", label: "Yes / No" }].map((type) => { const isActive = newAttrType === type.id; return (<button key={type.id} type="button" onClick={() => { setNewAttrType(type.id); setNewAttrValues([]); setNewAttrValueInput(""); if (type.id === "boolean") setNewAttrDefaultValue("yes"); }} className={`h-auto py-3 px-3 text-[12px] font-semibold rounded-lg border transition-all text-left flex flex-col gap-0.5 ${isActive ? "bg-[var(--accent-soft)]/40 text-[var(--accent)] border-[var(--accent)]/40 shadow-sm" : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}><span>{type.label}</span></button>); })}</div></div>
              {newAttrType === "multi_select" && (<div className="space-y-2.5"><label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options</label>{newAttrValues.length > 0 && (<div className="flex flex-wrap gap-1.5">{newAttrValues.map((val, idx) => (<span key={idx} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded-md border border-[var(--accent)]/15"><span className="w-4 h-4 flex items-center justify-center rounded bg-[var(--accent)]/10 text-[9px] font-bold text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">{idx + 1}</span>{val}<button type="button" onClick={() => setNewAttrValues((p) => p.filter((_, i) => i !== idx))} className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--accent)]/20 transition-colors ml-0.5"><Ico d={D.close} className="w-2.5 h-2.5" /></button></span>))}</div>)}<div className="flex gap-2"><input type="text" value={newAttrValueInput} onChange={(e) => setNewAttrValueInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const val = newAttrValueInput.trim(); if (!val) return; if (newAttrValues.some((v) => v.toLowerCase() === val.toLowerCase())) { toast.error("Option already exists"); return; } setNewAttrValues((p) => [...p, val]); setNewAttrValueInput(""); } }} className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" placeholder="Add an option" /><button type="button" onClick={() => { const val = newAttrValueInput.trim(); if (!val) return; if (newAttrValues.some((v) => v.toLowerCase() === val.toLowerCase())) { toast.error("Option already exists"); setNewAttrValueInput(""); return; } setNewAttrValues((p) => [...p, val]); setNewAttrValueInput(""); }} className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0"><ModalPlusIcon className="w-3 h-3" /> Add</button></div></div>)}
              {newAttrType === "boolean" && (<div className="space-y-2.5"><label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Default Value</label><div className="grid grid-cols-2 gap-3">{[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }].map((opt) => { const isActive = newAttrDefaultValue === opt.id; return (<button key={opt.id} type="button" onClick={() => setNewAttrDefaultValue(opt.id)} className={`h-11 text-[12px] font-semibold flex items-center justify-center gap-2 rounded-lg border transition-all ${isActive ? opt.id === "yes" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10" : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--text-muted)]/30 shadow-sm" : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}><span className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${isActive ? opt.id === "yes" ? "bg-emerald-500 border-emerald-500" : "bg-[var(--text-muted)] border-[var(--text-muted)]" : "border-[var(--border-color)] bg-transparent"}`} />{opt.label}</button>); })}</div></div>)}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 shrink-0"><button type="button" onClick={() => { setShowCreateAttrModal(false); setNewAttrName(""); setNewAttrType("multi_select"); setNewAttrValues([]); setNewAttrValueInput(""); setNewAttrDefaultValue("yes"); }} className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors">Cancel</button><button type="button" onClick={handleCreateAttribute} disabled={!newAttrName.trim() || creatingAttribute} className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{creatingAttribute ? <span className="flex items-center gap-1.5"><ModalSpinner className="w-3.5 h-3.5" /> Adding...</span> : "Add Attribute"}</button></div>
          </div>
        </div>, document.body
      )}
    </>
  );
}