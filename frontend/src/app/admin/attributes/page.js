"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { useAttributeSocketSync } from "../../../hooks/admin/useAttributeSocketSync";
import { useLocalized } from "@/i18n/localize";
import { useTranslation } from "@/i18n/LanguageProvider";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";

// --- Icons ---
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>
);
const SlidersIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
);
/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Wahi pattern jo products page par use hua hai: wrapper, paddings aur column
      widths real table jaise hi rakhe gaye hain, is liye data aane par layout
      shift nahi hota (pehle yahan sirf spinner tha).
   ✅ Sirf loading state ke liye — real table design me koi change nahi.
========================================================= */
// `.skeleton` (globals.css) apna border-radius deta hai, is liye pills/circles ke liye inline radius
const SKELETON_ROUND = { borderRadius: "9999px" };

function AttributeRowsSkeleton({ rows = ATTRS_PER_PAGE }) {
  const { t } = useTranslation();
  return (
    <tbody aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`attr-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
          {/* attribute name — icon + name + code */}
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="skeleton h-8 w-8 shrink-0" style={SKELETON_ROUND} />
              <div className="flex flex-col gap-1.5">
                <span className="skeleton inline-block h-3 w-[120px] rounded align-middle" />
                <span className="skeleton inline-block h-2.5 w-[70px] rounded align-middle" />
              </div>
            </div>
          </td>
          {/* data type */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-4 w-[72px] rounded align-middle" /></td>
          {/* category */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-3 w-[70px] rounded align-middle" /></td>
          {/* options count */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-3 w-[62px] rounded align-middle" /></td>
          {/* status */}
          <td className="px-4 py-2.5"><span className="skeleton inline-block h-4 w-[60px] rounded align-middle" /></td>
          {/* actions */}
          <td className="px-4 py-2.5 text-right">
            <div className="flex items-center justify-end"><span className="skeleton block h-[38px] w-[36px] rounded-md" /></div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
);
const SortIndicator = ({ active, direction }) => (
  <svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    {active && direction === "desc" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);
const DotsVerticalIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);
const EyeIcon = ({ className = "w-4 h-4", style }) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);
const ShieldCheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
);
const TagIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
);

// --- Helpers ---
const getDataTypeLabel = (type) => {
  const map = {
    text: "dataType.text",
    number: "dataType.number",
    decimal: "dataType.decimal",
    multi_select: "dataType.multi_select",
    select: "dataType.select",
    color: "dataType.color",
    boolean: "dataType.boolean",
  };
  return map[type] || type;
};

const ATTRS_PER_PAGE = 15;

// ==================== RIGHT SIDE DETAIL PANEL ====================
function AttributeOptionsPanel({ attr, onClose, onAddAttribute, onAddOption, isAddingOption = false }) {
  // DB-sourced values (attribute name + option labels) — locale ke hisaab se.
  const { nameOf, descriptionOf, optionLabelOf } = useLocalized();
  // Static UI labels — `t()` se.
  const { t: __t } = useTranslation();
  const t = (k, p) => __t(k.startsWith("admin.") || k.startsWith("common.") ? k : `admin.attributes.${k}`, p);
  // ✅ Slide-in/out animation — mount par drawer right se smoothly slide hota hai,
  //    close par pehle slide-out animation, phir parent se unmount hota hai.
  const [visible, setVisible] = useState(false);
  const [newOption, setNewOption] = useState("");
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const onAddAttributeRef = useRef(onAddAttribute);
  useEffect(() => {
    onAddAttributeRef.current = onAddAttribute;
  }, [onAddAttribute]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    // ✅ Drawer open hone par background scroll lock (existing modal behavior ke mutabiq)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // ESC se bhi close — standard drawer UX
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape" || closingRef.current) return;
      closingRef.current = true;
      setVisible(false);
      setTimeout(() => onCloseRef.current(), 280);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const requestClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(() => onCloseRef.current(), 280);
  };

  // ✅ Panel se naya attribute add karne ka flow — pehle drawer ka slide-out
  //    animation complete hota hai, phir parent ka existing "Add Attribute" form
  //    open hota hai. Is tarah drawer ka z-[70] overlay aur form modal overlap
  //    (z-index conflict) nahi karte aur form ka code duplicate nahi hota.
  const handleAddAttribute = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setVisible(false);
    setTimeout(() => {
      onCloseRef.current();
      if (onAddAttributeRef.current) onAddAttributeRef.current();
    }, 280);
  };

  if (!attr) return null;

  // ✅ Robust option label extraction — values objects ({label, value}) ya strings
  //    dono handle, "[object Object]" kabhi show nahi hota.
  //    Localize yahi kiya jata hai (values[].label_translations) — option ka raw
  //    `value` kabhi nahi badalta, wahi DB me rehta hai.
  const getOptionLabel = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return String(optionLabelOf(v) || v.value || v.name || "").trim();
  };

  const options = (attr.values || []).map(getOptionLabel).filter(Boolean);
  const isActive = attr.is_active !== false;
  const isBoolean = attr.data_type === "boolean";
  // ✅ Sirf multi_select ke paas options hote hain (existing form modal ke mutabiq)
  const canAddOptions = attr.data_type === "multi_select";

  const submitNewOption = () => {
    const val = newOption.trim();
    if (!val || isAddingOption) return;
    const exists = options.some((o) => o.toLowerCase() === val.toLowerCase());
    if (exists) {
      toast.error(t("toast.optionExists", { value: val }));
      return;
    }
    onAddOption && onAddOption(val);
    setNewOption("");
  };

  return (
    <>
      {/* Backdrop — ✅ NO blur (user request). Sirf halka dim + click-to-close.
          Page blur ke bajaye content "minimize" (scale down) hota hai — neeche wrapper. */}
      <div
        className={`fixed inset-0 z-[60] bg-black/10 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Slide-in Drawer */}
      <div className={`fixed top-0 right-0 bottom-0 z-[70] w-full sm:max-w-md bg-[var(--bg-secondary)] border-l border-[var(--border-color)] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}>
        
        {/* Header — Panel title (Attribute Options) + Close */}
        <div className="px-5 sm:px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between gap-3 bg-[var(--bg-card)]">
          <div className="flex items-center gap-2 min-w-0">
            <SlidersIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">{t("detailPanel.title")}</h3>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t("detailPanel.close")}
            title={t("detailPanel.close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Attribute identity — name + data type badge */}
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-card)]">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] shrink-0">
            <SlidersIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[16px] font-bold text-[var(--text-primary)] truncate">{nameOf(attr)}</h4>
            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20 mt-1">
              {t(getDataTypeLabel(attr.data_type))}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {descriptionOf(attr) && (
            <section className="space-y-2">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t("admin.categories.form.description")}
              </h4>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {descriptionOf(attr)}
              </p>
            </section>
          )}

          {/* Summary Section — Code / Data Type / Status / Options Count */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t("detailPanel.summary")}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0">
                <span className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">{t("detailPanel.code")}</span>
                <span className="block text-xs font-mono font-semibold text-[var(--text-primary)] truncate">{attr.code || "—"}</span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0">
                <span className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">{t("detailPanel.dataType")}</span>
                <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/20">
                  {t(getDataTypeLabel(attr.data_type))}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0">
                <span className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">{t("detailPanel.status")}</span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {isActive ? t("filter.active") : t("filter.inactive")}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] min-w-0">
                <span className="block text-[10px] font-medium text-[var(--text-muted)] mb-1">{t("detailPanel.optionsCount")}</span>
                <span className="block text-xs font-bold text-[var(--text-primary)]">{options.length}</span>
              </div>
            </div>
            
            {/* Variant Option Row */}
            {attr.category_config?.is_variant_option && (
               <div className="p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] flex justify-between items-center">
                 <span className="text-[10px] font-medium text-[var(--text-muted)]">{ t("detailPanel.variantOption") }</span>
                  <span className="text-xs font-semibold text-[var(--accent)]">{ t("common.yes") }</span>
                 <span className="text-xs font-semibold text-[var(--accent)]">{ t("common.yes") }</span>
               </div>
            )}
          </div>

          {/* Options Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                { isBoolean ? t("detailPanel.booleanValues") : t("detailPanel.availableOptions") }
              </h4>
              <span className="text-[10px] font-medium bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full text-[var(--text-secondary)]">
                { t("detailPanel.itemsCount", { count: options.length }) }
              </span>
            </div>

            <div className="space-y-2">
              {options.length > 0 ? (
                options.map((opt, idx) => (
                  <div
                    key={`${opt}-${idx}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] group hover:border-[var(--accent)]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 flex items-center justify-center rounded bg-[var(--bg-tertiary)] text-[10px] font-bold text-[var(--text-muted)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--accent)] transition-colors shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">{opt}</span>
                    </div>
                    {isBoolean && (
                       <span className={`w-2 h-2 rounded-full shrink-0 ${opt.toLowerCase() === 'yes' || opt.toLowerCase() === 'true' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg">
                  <TagIcon className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
                  <p className="text-sm text-[var(--text-muted)]">{t("detailPanel.noOptions")}</p>
                </div>
              )}
            </div>

            {/* ✅ Add Option — existing attribute update API (PUT /attributes/:id) reuse karta hai,
                koi naya endpoint/schema nahi. Drawer ke andar hi option add ho jata hai. */}
            {canAddOptions && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNewOption(); } }}
                    placeholder={t("form.optionPlaceholder")}
                    disabled={isAddingOption}
                    className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={submitNewOption}
                    disabled={isAddingOption || !newOption.trim()}
                    className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingOption ? <Spinner className="w-3 h-3" /> : <PlusIcon className="w-3 h-3" />}
                    <span>{isAddingOption ? "Adding..." : "Add Option"}</span>
                  </button>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — panel actions */}
        <div className="p-5 sm:p-6 border-t border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleAddAttribute}
              title={t("form.createTitle")}
              aria-label={t("form.createTitle")}
              className="flex-1 h-10 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 border border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-primary)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{t("form.create")}</span>
            </button>
            <button
              type="button"
              onClick={requestClose}
              title={t("detailPanel.close")}
              aria-label={t("detailPanel.close")}
              className="flex-1 h-10 rounded-lg text-[13px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
            >
              <span>{t("detailPanel.closePanel")}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ==================== ATTRIBUTE FORM MODAL ====================
function AttributeFormModal({ open, onClose, mode = "create", initialData, onSave, isSaving = false }) {
  const isEdit = mode === "edit";
  const { t: __t } = useTranslation();
  const t = (key, params) => __t(key.startsWith("admin.") || key.startsWith("common.") ? key : `admin.attributes.${key}`, params);
  const [form, setForm] = useState({
    name: "",
    description: "",
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
        const values = (initialData.values || [])
          .map((v) => {
            const label = typeof v === "string" ? v : (v?.label || v?.value || v);
            return String(label);
          })
          .filter(Boolean);
        setForm({
          name: (typeof initialData.name === "object" && initialData.name) ? String(initialData.name.en || initialData.name.name || initialData.name.label || Object.values(initialData.name)[0] || "") : (initialData.name || ""),
          description: (typeof initialData.description === "object" && initialData.description) ? String(initialData.description.en || initialData.description.description || Object.values(initialData.description)[0] || "") : (initialData.description || ""),
          data_type: dataType,
          values,
          value: booleanValue,
          is_active: initialData.is_active !== false,
        });
        setEditOptionInput("");
        setNewOptionInput("");
      } else {
        setForm({
          name: "",
          description: "",
          data_type: "multi_select",
          values: [],
          value: "",
          is_active: true,
        });
        setNewOptionInput("");
        setEditOptionInput("");
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
      description: form.description.trim(),
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
            <span>×</span>
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
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {t("admin.categories.form.description")}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm outline-none resize-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
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
}

export default function AttributesPage() {
  useAttributeSocketSync();
  const queryClient = useQueryClient();
  // Static UI labels (headers, stats, buttons, toasts) — database ke nahi,
  // is liye `t()` se aati hain. Nahi milne par English fallback rehta hai.
  const { t: __t, locale } = useTranslation();
  const t = (k, p) => __t(k.startsWith("admin.") || k.startsWith("common.") ? k : `admin.attributes.${k}`, p);
  // `code` aur har option ka raw `value` kabhi translate nahi hote (variant
  // matching unhi par chalti hai) — sirf `name` + option `label` localized.
  const { nameOf, attributeOf, optionLabelOf, text } = useLocalized();

  // State
  const [attributeSearch, setAttributeSearch] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [attributePage, setAttributePage] = useState(1);
  
  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(attributeSearch.trim());
      setAttributePage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [attributeSearch]);

  // Add Attribute Modal State
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  
  // Edit Attribute Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState(null);
  
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Status filter
  const [statusFilter, setStatusFilter] = useState("all");
  
  // ✅ NEW: Detail Panel State
  const [detailAttr, setDetailAttr] = useState(null);

  // Edit from URL param (e.g. ?edit=attrId)
  const searchParams = useSearchParams();
  const editParam = searchParams?.get("edit") || null;
  const [editParamHandled, setEditParamHandled] = useState(false);

  useEffect(() => {
    if (!editParam || editParamHandled) return;
    const openFromUrl = async () => {
      try {
        const attr = await attributeApi.getById(editParam);
        openEditModal(attr);
      } catch (err) {
        console.error("Failed to load attribute for edit:", err);
        toast.error(t("toast.loadFailed"));
      }
      setEditParamHandled(true);
    };
    openFromUrl();
  }, [editParam, editParamHandled]);

  // ===== SERVER-SIDE PAGINATED QUERY =====
  const { data: paginatedAttrsData, isLoading: attributesLoading, isFetching } = useQuery({
    queryKey: ["attributes", "paginated", attributePage, search],
    queryFn: () =>
      attributeApi.getAllPaginated({
        page: attributePage,
        limit: ATTRS_PER_PAGE,
        search,
      }),
    retry: false,
    staleTime: 0,
    keepPreviousData: true,
  });

  // Normalize response (handles both paginated and legacy array)
  const attributesRaw = Array.isArray(paginatedAttrsData)
    ? paginatedAttrsData
    : paginatedAttrsData?.items || paginatedAttrsData?.data || paginatedAttrsData?.attributes || [];
  
  const pagination = Array.isArray(paginatedAttrsData)
    ? { total: attributesRaw.length, page: 1, limit: ATTRS_PER_PAGE, pages: 1 }
    : paginatedAttrsData?.pagination || { total: 0, page: 1, limit: ATTRS_PER_PAGE, pages: 1 };

  usePageTranslations({
    model: "Attribute",
    records: attributesRaw,
    locale,
    ready: !isFetching && pagination.page === attributePage,
    queryKey: ["attributes", "paginated", attributePage, search],
    queryClient,
  });

  // Client-side sort within the current page (server handles search + paging)
  const sortedAttributes = useMemo(() => {
    const arr = [...attributesRaw];
    if (!sortConfig.key) return arr;
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        case "type": va = a.data_type || ""; vb = b.data_type || ""; break;
        case "options": va = a.values?.length || 0; vb = b.values?.length || 0; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [attributesRaw, sortConfig]);

  const totalAttributes = pagination.total || 0;
  const totalAttributePages = Math.max(1, pagination.pages || 1);
  const attrStartIndex = totalAttributes === 0 ? 0 : (attributePage - 1) * ATTRS_PER_PAGE + 1;
  const attrEndIndex = Math.min(attributePage * ATTRS_PER_PAGE, totalAttributes);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [attributePage]);

  // ===== ALL ATTRIBUTES (for stats) =====
  const { data: allAttrs = [] } = useQuery({
    queryKey: ["attributes", "all"],
    queryFn: () => attributeApi.getAll(),
    retry: false,
    staleTime: 0,
  });

  // ===== STATS (computed from real API data) =====
  const stats = useMemo(() => {
    const all = Array.isArray(allAttrs) ? allAttrs : [];
    const total = all.length;
    const active = all.filter((a) => a.is_active !== false).length;
    const withOptions = all.filter((a) => Array.isArray(a.values) && a.values.length > 0).length;
    
    const LEGACY_DATA_TYPE_MAP = { select: "multi_select", color: "multi_select", date: "text", datetime: "text", url: "text", measurement: "decimal" };
    const SUPPORTED_TYPES = ["multi_select", "boolean"];
    const dataTypeSet = new Set(all.map((a) => LEGACY_DATA_TYPE_MAP[a.data_type] || a.data_type).filter((t) => SUPPORTED_TYPES.includes(t)));
    
    return { total, active, withOptions, dataTypes: dataTypeSet.size };
  }, [allAttrs]);

  const goToAttributePage = (p) => {
    if (p >= 1 && p <= totalAttributePages && p !== attributePage) {
      setAttributePage(p);
    }
  };

  // ===== ADD ATTRIBUTE MUTATION =====
  const addAttributeMutation = useMutation({
    mutationFn: async (data) => {
      const created = await attributeApi.create(data);
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      setShowAttributeModal(false);
      toast.success(t("toast.created"));
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || t("toast.createFailed")),
  });

  // ===== EDIT ATTRIBUTE =====
  const openEditModal = (attr) => {
    setEditingAttribute(attr);
    setShowEditModal(true);
  };

  const editAttributeMutation = useMutation({
    mutationFn: async (data) => {
      return await attributeApi.update(editingAttribute?._id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      setShowEditModal(false);
      setEditingAttribute(null);
      toast.success(t("toast.updated"));
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || t("toast.updateFailed")),
  });

  // ===== TOGGLE ATTRIBUTE STATUS =====
  const handleToggleAttributeActive = async (attr) => {
    if (!attr) return;
    const attrId = attr._id;
    const currentActive = attr.is_active !== false;
    try {
      await attributeApi.update(attrId, { is_active: !currentActive });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      toast.success(currentActive ? t("toast.disabled") : t("toast.enabled"));
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || t("toast.statusFailed"));
    }
  };

  // ===== DELETE ATTRIBUTE =====
  const deleteAttributeMutation = useMutation({
    mutationFn: async (id) => {
      return attributeApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      setDeleteTarget(null);
      toast.success(t("toast.deleted"));
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || t("toast.deleteFailed")),
  });

  const handleDeleteAttribute = () => {
    if (!deleteTarget) return;
    deleteAttributeMutation.mutate(deleteTarget._id);
  };

  // ===== ADD OPTION (View Options drawer se) =====
  // ✅ Existing update API reuse — PUT /attributes/:id with full values array.
  //    Koi naya endpoint/schema nahi; purane options preserve hoke naya option append hota hai.
  const addOptionMutation = useMutation({
    mutationFn: async ({ attrId, values }) => attributeApi.update(attrId, { values }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      // Drawer turant fresh data dikhaye — API updated attribute return karta hai
      setDetailAttr((prev) => (prev ? { ...prev, ...(updated || {}) } : prev));
      toast.success(t("toast.optionAdded"));
    },
    onError: (err) => toast.error(err?.response?.data?.message || err?.message || t("toast.optionAddFailed")),
  });

  const handleAddOption = (label) => {
    if (!detailAttr) return;
    const clean = String(label || "").trim();
    if (!clean) return;
    // ✅ Existing values ko {label, value} shape mein normalize karo — form modal jaisa hi
    const existing = (detailAttr.values || [])
      .map((v) => {
        if (typeof v === "string") return { label: v, value: v.toLowerCase() };
        return { label: String(v?.label || v?.value || ""), value: String(v?.value || v?.label || "").toLowerCase() };
      })
      .filter((v) => v.label);
    const next = [...existing, { label: clean, value: clean.toLowerCase() }];
    addOptionMutation.mutate({ attrId: detailAttr._id, values: next });
  };

  // ===== CLIENT-SIDE STATUS FILTER =====
  const filteredAttributes = useMemo(() => {
    if (statusFilter === "all") return sortedAttributes;
    if (statusFilter === "active") return sortedAttributes.filter((a) => a.is_active !== false);
    if (statusFilter === "inactive") return sortedAttributes.filter((a) => a.is_active === false);
    return sortedAttributes;
  }, [sortedAttributes, statusFilter]);

  // ===== RENDER HELPERS =====
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button onClick={() => setSortConfig(prev => ({ key: sortKey, direction: prev.key === sortKey && prev.direction === "asc" ? "desc" : "asc" }))}
        className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80"
        style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label} <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const Pagination = ({ current, total, go, label }) => {
    if (total <= 1) return null;
    const pages = [];
    if (total <= 5) for (let i = 1; i <= total; i++) pages.push(i);
    else if (current <= 3) pages.push(1, 2, 3, 4, "...", total);
    else if (current >= total - 2) pages.push(1, "...", total - 3, total - 2, total - 1, total);
    else pages.push(1, "...", current - 1, current, current + 1, "...", total);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4 mt-4" style={cardStyle}>
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => go(current - 1)} disabled={current === 1}
            className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title={t("admin.shared.pagination.prev")}>
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="hidden sm:inline-flex items-center gap-1">
            {pages.map((page, i) => (
              <React.Fragment key={i}>
                {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> :
                <button onClick={() => go(page)}
                  className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
                  style={{ backgroundColor: current === page ? "var(--accent)" : "var(--bg-tertiary)", color: current === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${current === page ? "var(--accent)" : "var(--border-color)"}` }}>
                  {page}
                </button>}
              </React.Fragment>
            ))}
          </span>
          <button onClick={() => go(current + 1)} disabled={current === total}
            className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title={t("admin.shared.pagination.next")}>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const ActionButtons = ({ attr }) => {
    const [open, setOpen] = useState(false);
    const btnRef = React.useRef(null);
    const menuRef = React.useRef(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const isActive = attr.is_active !== false;

    const openMenu = () => {
      const rect = btnRef.current.getBoundingClientRect();
      const menuW = 170;
      const menuH = 200;
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < menuH;
      const left = rect.right - menuW;
      const adjustedLeft = left < 8 ? 8 : left + menuW > window.innerWidth - 8 ? window.innerWidth - menuW - 8 : left;
      setMenuPos({
        top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4,
        left: adjustedLeft,
      });
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      const handleClick = (e) => {
        if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
      };
      const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
      return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
    }, [open]);

    const menuItemClass = "w-full px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors duration-150";

    return (
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); open ? setOpen(false) : openMenu(); } }}
          className="w-8 h-8 inline-flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: "var(--text-secondary)", backgroundColor: "transparent" }}
          aria-label={t("action.more")}
          aria-haspopup="true"
          aria-expanded={open}
          title={t("action.more")}
        >
          <DotsVerticalIcon className="w-[18px] h-[18px]" />
        </button>
        {open && ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-[170px] rounded-lg border shadow-lg py-1"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-color)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            }}
          >
            <button
              type="button"
              onClick={(e) => { 
                e.stopPropagation(); 
                setOpen(false); 
                setDetailAttr(attr); // ✅ Opens Right Panel
              }}
              className={menuItemClass}
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <EyeIcon className="w-4 h-4 shrink-0" style={{ color: "var(--success-text)" }} /> {t("action.viewOptions")}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); openEditModal(attr); }}
              className={menuItemClass}
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <EditIcon className="w-4 h-4 shrink-0" style={{ color: "var(--text-secondary)" }} /> {t("action.edit")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                handleToggleAttributeActive(attr);
              }}
              className={menuItemClass}
              style={{ color: isActive ? "var(--danger-text)" : "var(--success-text)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <ShieldCheckIcon className="w-4 h-4 shrink-0" /> {isActive ? t("action.disable") : t("action.enable")}
            </button>
            <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); setDeleteTarget(attr); }}
              className={menuItemClass}
              style={{ color: "var(--danger-text)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--danger-soft)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <TrashIcon className="w-4 h-4 shrink-0" /> {t("action.delete")}
            </button>
          </div>,
          document.body
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      
      {/* ✅ RENDER DETAIL PANEL */}
      {detailAttr && (
        <AttributeOptionsPanel
          attr={detailAttr}
          onClose={() => setDetailAttr(null)}
          onAddAttribute={() => setShowAttributeModal(true)}
          onAddOption={handleAddOption}
          isAddingOption={addOptionMutation.isPending}
        />
      )}

      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("page.title")}</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{t("page.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowAttributeModal(true)}
              title={t("form.createTitle")}
              aria-label={t("form.createTitle")}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              <PlusIcon className="w-4 h-4" />
              <span>{t("page.addButton")}</span>
            </button>
          </div>
        </div>

        {/* ✅ Main content wrapper — drawer open hone par table/list MINIMIZE + focus
            ho jati hai (subtle scale-down + dim). Blur intentionally NAHI hai (user request);
            drawer close par smoothly wapas normal ho jata hai. */}
        <div className={`space-y-5 origin-top-left transition-all duration-300 ease-out ${detailAttr ? "scale-[0.98] opacity-60 pointer-events-none select-none" : "scale-100 opacity-100"}`}>
        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{t("stat.total")}</p><p className="text-[18px] sm:text-[20px] font-bold mt-1">{stats.total}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{t("stat.active")}</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-emerald-500">{stats.active}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{t("stat.withOptions")}</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-blue-500">{stats.withOptions}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{t("stat.dataTypes")}</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-purple-500">{stats.dataTypes}</p></div>
        </div>

        {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Wider Search Bar (Left Side) */}
          <div className="relative w-full md:w-[400px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
            <input
              type="text"
              placeholder={t("search.placeholder")}
              value={attributeSearch}
              onChange={e => setAttributeSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
              style={inputStyle}
            />
          </div>
          {/* Filters (Right Side) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setAttributePage(1); }}
                className="h-9 pl-3 pr-8 rounded-lg text-[13px] font-medium appearance-none cursor-pointer outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                <option value="all">{t("filter.allStatus")}</option>
                <option value="active">{t("filter.active")}</option>
                <option value="inactive">{t("filter.inactive")}</option>
              </select>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
            </div>
          </div>
        </div>

        {/* Attribute Table */}
        <div className={`rounded-lg transition-opacity ${isFetching && !attributesLoading ? "opacity-60" : "opacity-100"}`} style={cardStyle}>
          {attributesLoading ? (
            /* ✅ SKELETON — spinner ki jagah real table ka same shell (thead + shimmer rows) */
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.name")}</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.type")}</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.category")}</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.optionsCount")}</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.status")}</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)", width: "52px" }}>{t("table.actions")}</th>
                  </tr>
                </thead>
                <AttributeRowsSkeleton rows={ATTRS_PER_PAGE} />
              </table>
            </div>
          ) : filteredAttributes.length === 0 ? (
            <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3">
              <SlidersIcon className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search ? t("table.emptyFiltered") : t("table.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <SortHeader label={t("table.name")} sortKey="name" />
                    <SortHeader label={t("table.type")} sortKey="type" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.category")}</th>
                    <SortHeader label={t("table.optionsCount")} sortKey="options" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{t("table.status")}</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)", width: "52px" }}>{t("table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttributes.map((attr, index) => {
                    const isActive = attr.is_active !== false;
                    const opts = attr.values?.length || 0;
                    return (
                      <tr
                        key={attr._id}
                        tabIndex={0}
                        aria-label={`View options for ${nameOf(attr)}`}
                        title={t("action.viewOptions")}
                        onClick={() => setDetailAttr(attr)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailAttr(attr); }
                        }}
                        className="transition cursor-pointer outline-none"
                        style={{ borderBottom: index < filteredAttributes.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: "var(--bg-card)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; e.currentTarget.style.boxShadow = "inset 3px 0 0 var(--accent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card)"; e.currentTarget.style.boxShadow = "none"; }}
                        onFocus={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; e.currentTarget.style.boxShadow = "inset 3px 0 0 var(--accent)"; }}
                        onBlur={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--purple-soft)", color: "var(--purple-text)" }}>
                              <SlidersIcon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-medium text-[13px] truncate block" style={{ color: "var(--text-primary)" }}>{nameOf(attr)}</span>
                              {attr.code && <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={attr.data_type === 'multi_select' || attr.data_type === 'select'
                              ? { backgroundColor: "var(--purple-soft)", color: "var(--purple-text)", border: "1px solid color-mix(in srgb, var(--purple) 28%, transparent)" }
                              : attr.data_type === 'text'
                              ? { backgroundColor: "var(--info-soft)", color: "var(--info-text)", border: "1px solid color-mix(in srgb, var(--info) 28%, transparent)" }
                              : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                            {t(getDataTypeLabel(attr.data_type))}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[12px] font-medium capitalize" style={{ color: "var(--text-secondary)" }}>
                            {text(attr.category, attr.category_translations) || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>{t("detailPanel.itemsCount", { count: opts })}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={isActive ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" } : { backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
                            {isActive ? t("filter.active") : t("filter.inactive")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right"><ActionButtons attr={attr} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Pagination current={attributePage} total={totalAttributePages} go={goToAttributePage}
          label={totalAttributes > 0 ? `${t("table.showingRange", { start: attrStartIndex, end: attrEndIndex, total: totalAttributes })}` : t("table.empty")} />
        </div>

      </div>

      {/* ===== Add Attribute Modal ===== */}
      <AttributeFormModal
        open={showAttributeModal}
        onClose={() => setShowAttributeModal(false)}
        mode="create"
        isSaving={addAttributeMutation.isPending}
        onSave={async (payload) => {
          const code = payload.name.trim().toLowerCase().replace(/\s+/g, "_");
          addAttributeMutation.mutate({
            ...payload,
            code,
            values: payload.values || [],
          });
        }}
      />

      {/* ===== Edit Attribute Modal ===== */}
      <AttributeFormModal
        open={showEditModal && !!editingAttribute}
        onClose={() => {
          setShowEditModal(false);
          setEditingAttribute(null);
        }}
        mode="edit"
        initialData={editingAttribute ? {
          name: editingAttribute.name || "",
          description: editingAttribute.description || "",
          data_type: editingAttribute.data_type || "multi_select",
          values: (editingAttribute.values || []).map((v) => {
            const label = typeof v === "string" ? v : (v?.label || v?.value || String(v));
            return String(label);
          }).filter(Boolean),
          value: (() => {
            if (editingAttribute.data_type === "boolean") {
              const vals = editingAttribute.values || [];
              const trueEntry = vals.find(
                (v) =>
                  (v?.value || v)?.toString() === "true" ||
                  (v?.label || v)?.toString()?.toLowerCase() === "yes"
              );
              return !!trueEntry;
            }
            return false;
          })(),
          is_active: editingAttribute.is_active !== false,
        } : null}
        isSaving={editAttributeMutation.isPending}
        onSave={async (payload) => {
          const valuesPayload = payload.data_type === "multi_select"
            ? (payload.values || []).map((opt) => {
                const label = String(opt || "").trim();
                return { label, value: label.toLowerCase() };
              })
            : payload.data_type === "boolean"
            ? [
                {
                  label: payload.value ? "Yes" : "No",
                  value: payload.value ? "true" : "false",
                  sort_order: 0,
                  is_active: true,
                },
              ]
            : [];
          editAttributeMutation.mutate({
            name: payload.name.trim(),
            description: payload.description,
            data_type: payload.data_type,
            values: valuesPayload,
            is_active: payload.is_active !== false,
          });
        }}
      />

      {/* ===== Delete Confirmation Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <TrashIcon className="w-5 h-5" style={{ color: "var(--danger-text)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t("delete.titleOne", { name: deleteTarget.name })}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t("delete.body")}</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteAttributeMutation.isPending}
                className="flex-1 h-10 sm:h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                {t("delete.cancel")}
              </button>
              <button onClick={handleDeleteAttribute} disabled={deleteAttributeMutation.isPending}
                className="flex-1 h-10 sm:h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger, var(--danger))" }}>
                {deleteAttributeMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> {t("delete.deleting")}</> : t("delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
