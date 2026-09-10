"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom"; // Added for dropdowns
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";

/* ================= ICONS ================= */
const Icons = {
  Plus: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  X: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  ChevronDown: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  Check: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Spinner: ({ className }) => (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  ),
  Filter: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1.994 1.994 0 013 6.586V4z" />
    </svg>
  ),

  Search: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  ArrowLeft: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  Folder: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Layers: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  FileText: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

/* ================= HELPERS & HOOKS ================= */
const getId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value._id) return getId(value._id);
    if (value.$oid) return String(value.$oid);
  }
  return "";
};

const getAttributeId = (attribute) => {
  const aid = attribute?.attribute_id;
  if (!aid) return String(attribute?._id || "");
  if (typeof aid === "string") return aid;
  if (typeof aid === "object" && aid._id) return String(aid._id);
  return String(aid);
};

const sanitizeOptionLabels = (raw) => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    if (!item) continue;
    let label = typeof item === "string" ? item : item.label || item.value || item.name;
    if (typeof label !== "string") continue;
    const trimmed = label.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
};

function useClickOutside(ref, handler, triggerRef) {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      if (triggerRef?.current?.contains(event.target)) return;
      handlerRef.current(event);
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, triggerRef]);
}

function useDropdownPosition(triggerRef, isOpen) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !isOpen) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const DROPDOWN_MAX_H = 320;
    const GAP = 6;
    const shouldFlip = spaceBelow < DROPDOWN_MAX_H && spaceAbove > spaceBelow;
    const vw = window.innerWidth;
    let width = Math.max(rect.width, 280);
    if (width > vw - 32) width = vw - 32;
    let left = rect.left;
    if (left + width > vw - 16) left = vw - width - 16;
    if (left < 16) left = 16;
    let top;
    if (shouldFlip) {
      top = rect.top - GAP - DROPDOWN_MAX_H;
      if (top < 16) top = 16;
    } else {
      top = rect.bottom + GAP;
      if (top + DROPDOWN_MAX_H > window.innerHeight - 16) {
        top = window.innerHeight - DROPDOWN_MAX_H - 16;
      }
    }
    setPosition({ top, left, width });
  }, [triggerRef, isOpen]);
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen, updatePosition]);
  return position;
}

/* ================= REUSABLE COMPONENTS ================= */

// --- ADDED: Professional Multi-Select Component ---
const ProfessionalMultiSelect = ({ attribute, value, onChange, onAddNewOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newOption, setNewOption] = useState("");
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const pos = useDropdownPosition(triggerRef, isOpen);
  
  useClickOutside(dropdownRef, () => setIsOpen(false), triggerRef);
  
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const options = sanitizeOptionLabels(attribute?.values);
  const selected = sanitizeOptionLabels(Array.isArray(value) ? value : []).filter((v) => options.includes(v));
  const filteredValues = options.filter((l) => l.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = (label) => {
    const exists = selected.includes(label);
    onChange(exists ? selected.filter((i) => i !== label) : [...selected, label]);
  };

  const handleAddNewOption = async () => {
    const trimmed = newOption.trim();
    if (!trimmed || !onAddNewOption) return;
    try {
      await onAddNewOption(trimmed);
      if (!selected.includes(trimmed)) onChange([...selected, trimmed]);
      setNewOption("");
      setSearch("");
    } catch (err) { console.error(err); }
  };

  const renderDropdown = () => (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-xl flex flex-col overflow-hidden"
      style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: '320px' }}
    >
      <div className="p-2 border-b border-[var(--border-color)] shrink-0">
        <div className="relative">
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full h-8 pl-8 pr-2.5 text-xs outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]" 
            autoFocus 
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-0.5 min-h-0 scrollbar-thin">
        {filteredValues.length > 0 ? (
          filteredValues.map((label, idx) => {
            const isSelected = selected.includes(label);
            return (
              <button key={idx} type="button" onClick={() => toggleOption(label)} className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${isSelected ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>
                <span className="truncate">{label}</span>
                <span className={`w-4 h-4 flex items-center justify-center shrink-0 ml-2 rounded border transition-colors ${isSelected ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)]"}`}>
                  {isSelected && <Icons.Check className="w-2.5 h-2.5 text-white" />}
                </span>
              </button>
            );
          })
        ) : (
          <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">No matching values</div>
        )}
      </div>
      {onAddNewOption && (
        <div className="px-2 py-1.5 border-t border-[var(--border-color)] shrink-0 bg-[var(--bg-tertiary)]/30">
          <div className="flex gap-1">
            <input type="text" placeholder="Add new..." value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddNewOption()} className="flex-1 min-w-0 h-7 px-2 text-[11px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]" />
            <button onClick={handleAddNewOption} disabled={!newOption.trim()} className="h-7 px-2 text-[10px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-0.5 shrink-0">
              <Icons.Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative w-full">
      <button type="button" ref={triggerRef} onClick={() => setIsOpen(!isOpen)} className={`w-full min-h-[36px] px-2.5 py-1.5 text-xs flex items-center justify-between outline-none transition-colors rounded border ${isOpen ? "border-[var(--accent)] ring-1 ring-[var(--accent-soft)] bg-[var(--bg-input)]" : "border-[var(--border-color)] hover:border-[var(--text-muted)] bg-[var(--bg-input)]"}`}>
        <div className="flex flex-wrap items-center gap-1 text-left w-full min-w-0">
          {selected.length === 0 ? (
            <span className="text-[var(--text-muted)]">Select values...</span>
          ) : (
            <>
              {selected.slice(0, 3).map((item) => (
                <span key={item} className="inline-flex items-center gap-0.5 px-1.5 py-px text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/20">{item}</span>
              ))}
              {selected.length > 3 && <span className="text-[10px] font-medium text-[var(--text-muted)]">+{selected.length - 3}</span>}
            </>
          )}
        </div>
        <Icons.ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ml-1.5 text-[var(--text-muted)] ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(renderDropdown(), document.body)}
    </div>
  );
};

/* ================= MAIN EDIT PAGE ================= */
export default function CategoryEditPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const categoryId = params?.id;
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const [activeTab, setActiveTab] = useState("details");
  const [openAttributeKey, setOpenAttributeKey] = useState(null);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [newAttributeData, setNewAttributeData] = useState({ name: "", code: "", data_type: "multi_select", values: [], value: "" });
  const [formData, setFormData] = useState({
    category_code: "",
    category_type: "",
    name: "",
    description: "",
    parent_category_id: "",
    attributes: [],
  });
  const loadedSeedTypeRef = useRef("");

  /* ---------- QUERIES ---------- */
  const { data: existingCategory, isLoading: isLoadingCategory } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => categoryApi.getById(categoryId),
    enabled: !!categoryId,
  });
  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
  });
  const { data: seededAttributes = [] } = useQuery({
    queryKey: ["seeded-attributes", formData.category_type?.toLowerCase()],
    queryFn: () => attributeApi.getAll({ category: formData.category_type?.toLowerCase() }),
    enabled: !!formData.category_type,
  });

  /* ---------- POPULATE FORM FROM EXISTING CATEGORY ---------- */
  useEffect(() => {
    if (!existingCategory) return;
    const cat = existingCategory;
    const catType = cat.category_type || "";
    const loadedAttrs = (cat.attributes || []).map((a, i) => {
      let value = a.value;
      const attrObj = a.attribute_id;
      const dataType = (attrObj && typeof attrObj === "object") ? attrObj.data_type : null;
      if (dataType === "boolean") {
        if (value === "true" || value === true) value = true;
        else if (value === "false" || value === false) value = false;
        else value = false;
      }
      return {
        ...a,
        value,
        ui_key: a.ui_key || `edit-${getAttributeId(a) || a.seed_code || `idx-${i}`}-${i}`,
      };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      category_code: cat.category_code || "",
      category_type: catType,
      name: cat.name || "",
      description: cat.description || "",
      parent_category_id: getId(cat.parent_category_id),
      attributes: loadedAttrs,
    });
    loadedSeedTypeRef.current = catType;
  }, [existingCategory]);

  /* ---------- ENRICH ATTRIBUTES WITH SEEDED DATA ---------- */
  useEffect(() => {
    const categoryType = formData.category_type?.toLowerCase();
    const isSeededCategory = ["mobile", "pc", "clothing"].includes(categoryType);
    if (!isSeededCategory) {
      if (loadedSeedTypeRef.current) {
        loadedSeedTypeRef.current = "";
      }
      return;
    }
    if (seededAttributes.length === 0) return;
    const firstSeededCategory = seededAttributes[0]?.category?.toLowerCase();
    if (firstSeededCategory && firstSeededCategory !== categoryType) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData((p) => {
      const needsEnrichment = p.attributes.some((a) => a.attribute_id && !a.seed_name) ||
        p.attributes.some((a) => {
          const attrId = getAttributeId(a);
          const seedAttr = seededAttributes.find((sa) => String(sa._id) === String(attrId));
          return seedAttr && a.seed_name !== seedAttr.name;
        });
      if (!needsEnrichment) return p;
      const enrichedAttrs = p.attributes.map((existingAttr) => {
        const attrId = getAttributeId(existingAttr);
        const seedAttr = seededAttributes.find((sa) => String(sa._id) === String(attrId));
        if (seedAttr) {
          const mappedSeedType = seedAttr.data_type === "select" || seedAttr.data_type === "color" ? "multi_select" : seedAttr.data_type;
          const seedOptions = (seedAttr.values || []).map(v => v.label || v.value || v);
          let normalizedValue = existingAttr.value;
          if (mappedSeedType === "boolean") {
            if (normalizedValue === "true" || normalizedValue === true) normalizedValue = true;
            else if (normalizedValue === "false" || normalizedValue === false) normalizedValue = false;
            else normalizedValue = false;
          }
          return {
            ...existingAttr,
            value: normalizedValue,
            seed_code: seedAttr.code,
            seed_name: seedAttr.name,
            seed_type: mappedSeedType,
            seed_options: seedOptions,
          };
        }
        const populatedAttr = existingAttr.attribute_id;
        if (populatedAttr && typeof populatedAttr === "object" && populatedAttr.name) {
          const mappedSeedType = populatedAttr.data_type === "select" || populatedAttr.data_type === "color" ? "multi_select" : populatedAttr.data_type;
          const seedOptions = (populatedAttr.values || []).map(v => v.label || v.value || v);
          let normalizedValue = existingAttr.value;
          if (mappedSeedType === "boolean") {
            if (normalizedValue === "true" || normalizedValue === true) normalizedValue = true;
            else if (normalizedValue === "false" || normalizedValue === false) normalizedValue = false;
            else normalizedValue = false;
          }
          return {
            ...existingAttr,
            value: normalizedValue,
            seed_code: populatedAttr.code,
            seed_name: populatedAttr.name,
            seed_type: mappedSeedType,
            seed_options: seedOptions,
          };
        }
        return existingAttr;
      });
      return { ...p, attributes: enrichedAttrs };
    });
  }, [formData.category_type, seededAttributes, formData.attributes]);

  /* ---------- SAVE MUTATION ---------- */
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: async (_saved, variables) => {
      try {
        // 1. Sirf wohi attributes pick karein jinki value assigned hai aur ID valid hai
        const validAttributes = formData.attributes
          .filter((a) => {
            const hasValue = Array.isArray(a.value)
              ? a.value.length > 0
              : (a.value != null && String(a.value).trim() !== "");
            return hasValue && a.attribute_id;
          })
          .map((a) => {
            const raw = a.attribute_id || a._id;
            let aid;
            if (!raw) aid = undefined;
            else if (typeof raw === "string") aid = raw;
            else if (typeof raw === "object" && raw._id) aid = String(raw._id);
            else aid = String(raw);
            return {
              attribute_id: aid || undefined,
              value: a.value,
              is_required: Boolean(a.is_required),
              is_visible: a.is_visible !== false,
              is_filterable: Boolean(a.is_filterable),
              is_searchable: Boolean(a.is_searchable),
              is_variant_option: Boolean(a.is_variant_option),
              sort_order: Number(a.sort_order) || 0,
            };
          });
        
        console.log("Updating Attributes:", JSON.stringify(validAttributes));
        
        // 2. Agar koi valid attributes hain to unhein alag se update karein
        if (validAttributes.length > 0) {
          await categoryApi.updateAttributes(String(variables.id), validAttributes);
        }
      } catch (err) {
        console.error("Attribute sync failed:", err);
        toast.warning("Category updated, but some attributes failed to save.");
      }
      // 3. Cache refresh karein taake nayi values foran nazar ayen
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["category", variables.id] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success("Category updated successfully");
      router.push("/admin/categories");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  /* ---------- HANDLERS ---------- */
  const updateAttributeConfig = (key, field, val) => {
    setFormData((p) => ({
      ...p,
      attributes: p.attributes.map((item) => {
        const keyStr = String(key || "");
        const itemKey = String(item.ui_key || "");
        const itemAttrId = getAttributeId(item);
        if (itemKey === keyStr || itemAttrId === keyStr || String(item.seed_code || "") === keyStr) {
          return { ...item, [field]: val };
        }
        return item;
      }),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    if (!formData.category_type) { toast.error("Category type is required"); return; }
    
    saveMutation.mutate({
      id: categoryId,
      data: {
        category_code: formData.category_code,
        category_type: formData.category_type,
        name: formData.name,
        description: formData.description,
        parent_category_id: formData.parent_category_id || null,
      },
    });
  };

  const handleAddAttributeFromModal = async () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const code = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/\s+/g, "_");
    const tempKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAttrConfig = {
      ui_key: tempKey,
      attribute_id: null,
      seed_code: code,
      seed_name: newAttributeData.name,
      seed_type: newAttributeData.data_type,
      seed_options: newAttributeData.values || [],
      is_required: false,
      is_visible: true,
      is_filterable: true,
      is_searchable: true,
      sort_order: formData.attributes.length,
      value: newAttributeData.data_type === "multi_select" ? newAttributeData.values || [] : (newAttributeData.value || ""),
      _creating: true,
    };
    setFormData((p) => ({ ...p, attributes: [...p.attributes, newAttrConfig] }));
    setShowAttributeModal(false);
    setNewAttributeData({ name: "", code: "", data_type: "multi_select", values: [], value: "" });
    toast.success("Attribute added");
    try {
      const valuesPayload = (newAttrConfig.seed_options || []).map((opt) => {
        const label = typeof opt === "string" ? opt : (opt?.label || opt?.value || String(opt));
        return { label, value: String(label).toLowerCase() };
      });
      const created = await attributeApi.create({
        code: newAttrConfig.seed_code,
        name: newAttrConfig.seed_name,
        data_type: newAttrConfig.seed_type,
        values: valuesPayload,
      });
      const createdId = created?._id || created?.id || created?.data?._id || created?.data?.id;
      if (createdId) {
        setFormData((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (
            a.ui_key === tempKey ? { ...a, attribute_id: String(createdId), _creating: false } : a
          )),
        }));
      } else {
        setFormData((p) => ({
          ...p,
          attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false } : a)),
        }));
      }
    } catch (err) {
      console.error("Failed to persist attribute", err);
      setFormData((p) => ({
        ...p,
        attributes: p.attributes.map((a) => (a.ui_key === tempKey ? { ...a, _creating: false, _createError: true } : a)),
      }));
    }
  };

  const handleAddAttributeValue = async (inputKey, config) => {
    const raw = String(config?._draftValue || "").trim();
    if (!raw) return;
    if (!config) return;
    const currentSelected = Array.isArray(config.value) ? config.value : [];
    const currentSeedOptions = Array.isArray(config.seed_options) ? config.seed_options : [];
    if (currentSelected.some((v) => String(v).toLowerCase() === raw.toLowerCase())) {
      toast.error("Option already assigned");
      return;
    }
    if (currentSeedOptions.some((o) => String(o).toLowerCase() === raw.toLowerCase())) {
      toast.error("Option already exists");
      return;
    }
    const queryKey = ["seeded-attributes", formData.category_type?.toLowerCase()];
    try {
      let nextSelected = [...currentSelected, raw];
      let nextSeedOptions = currentSeedOptions;
      let nextAttributeId = config.attribute_id ? getAttributeId(config) : null;
      if (nextAttributeId) {
        const fullAttr = seededAttributes.find((a) => String(a._id) === String(nextAttributeId));
        const existingValues = Array.isArray(fullAttr?.values) ? fullAttr.values : [];
        const normalized = existingValues.map((v) => ({
          label: v.label || v.value || "",
          value: v.value || v.label || "",
          sort_order: typeof v.sort_order === "number" ? v.sort_order : 0,
          is_active: v.is_active !== false,
        }));
        if (normalized.some((v) => String(v.value).toLowerCase() === raw.toLowerCase())) {
          toast.error("Option already exists");
          return;
        }
        const newValue = { label: raw, value: raw.toLowerCase(), sort_order: normalized.length, is_active: true };
        const response = await attributeApi.update(nextAttributeId, { values: [...normalized, newValue] });
        const responseValues = Array.isArray(response?.values) ? response.values : [...normalized, newValue];
        nextSeedOptions = responseValues.map((v) => v.label || v.value || "").filter(Boolean);
      } else {
        const created = await attributeApi.create({
          code: `${config.seed_code || inputKey}-value-${Date.now()}`,
          name: raw,
          data_type: config.seed_type || "text",
          values: [{ label: raw, value: raw.toLowerCase(), sort_order: 0, is_active: true }],
        });
        nextAttributeId = String(created?._id || created?.id || created?.data?._id || created?.data?.id || "");
        nextSeedOptions = [raw];
      }
      updateAttributeConfig(inputKey, "value", nextSelected);
      updateAttributeConfig(inputKey, "seed_options", nextSeedOptions);
      if (nextAttributeId && nextAttributeId !== getAttributeId(config)) {
        updateAttributeConfig(inputKey, "attribute_id", nextAttributeId);
      }
      if (nextAttributeId) {
        queryClient.setQueryData(queryKey, (prev) => {
          const list = Array.isArray(prev) ? [...prev] : [];
          const idx = list.findIndex((a) => String(a._id) === String(nextAttributeId));
          if (idx >= 0) {
            list[idx] = { ...list[idx], values: nextSeedOptions.map((v) => ({ label: v, value: v })) };
          }
          return list;
        });
      }
      toast.success("Option added successfully");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to save option");
    }
  };

  /* ---------- LOADING ---------- */
  if (isLoadingCategory) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icons.Spinner className="w-7 h-7 text-[var(--accent)]" />
          <p className="text-xs text-[var(--text-muted)]">Loading category details...</p>
        </div>
      </div>
    );
  }

  /* ---------- RENDER ---------- */
  return (
    <div className="w-full h-full overflow-y-auto space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            <h1 className="text-[24px] leading-7 font-bold tracking-tight text-[var(--text-primary)]">Edit Category</h1>
            <p className="text-[13px] mt-1 text-[var(--text-muted)]">Configure product classification and attributes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="h-9 px-4 text-[13px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
            Cancel
          </button>
          <button type="submit" form="edit-category-form" disabled={saveMutation.isPending} className="h-9 px-4 text-[13px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {saveMutation.isPending ? <Icons.Spinner className="w-4 h-4" /> : <Icons.Check className="w-4 h-4" />}
            Update Category
          </button>
        </div>
      </div>

      {/* FORM */}
      <form id="edit-category-form" onSubmit={handleSubmit} className="w-full">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* LEFT â    CATEGORY INFORMATION */}
          <section className="rounded-lg overflow-hidden flex flex-col" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                <Icons.Folder className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Category Information</h2>
                <p className="text-[10px] text-[var(--text-muted)]">Basic details and classification</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Code â    read-only */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Category Code</label>
                <input
                  type="text"
                  value={formData.category_code}
                  readOnly
                  className="w-full h-[42px] px-4 text-sm font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed"
                  placeholder="AUTO-GENERATED"
                />
              </div>
              {/* Name */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Name <span className="text-[var(--danger)]">*</span></label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full h-[42px] px-4 text-sm outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="e.g. Smartphones"
                />
              </div>
              {/* Type â    read-only */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Type <span className="text-[var(--danger)]">*</span></label>
                <div className="w-full h-[42px] px-4 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-2 cursor-not-allowed">
                  <span className="truncate">{formData.category_type || "â   "}</span>
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] shrink-0">Locked</span>
                </div>
              </div>
              {/* Parent Category */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Parent Category</label>
                <select
                  value={formData.parent_category_id}
                  onChange={(e) => setFormData({ ...formData, parent_category_id: e.target.value })}
                  className="w-full h-[42px] px-4 text-sm outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors cursor-pointer appearance-none"
                >
                  <option value="">Root Category</option>
                  {allCategories.filter((c) => String(c._id) !== String(categoryId)).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Description */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 text-sm outline-none resize-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="Brief description..."
                />
              </div>
            </div>
          </section>

          {/* RIGHT â    ATTRIBUTES & FEATURES (SAME UI AS CREATE) */}
          <section className="rounded-lg overflow-hidden flex flex-col w-full min-w-0 max-h-[calc(100vh-140px)]" style={cardStyle}>
            <div className="px-3 sm:px-5 py-4 border-b border-[var(--border-color)] flex flex-col items-stretch sm:flex-row sm:items-center sm:justify-between gap-2 bg-[var(--bg-tertiary)]/30">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                  <Icons.Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">Attributes & Features</h2>
                  <p className="text-[10px] text-[var(--text-muted)] truncate">Define product specifications</p>
                </div>
              </div>
              {formData.category_type && (
                <button
                  type="button"
                  onClick={() => setShowAttributeModal(true)}
                  className="h-10 sm:h-9 px-3 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center justify-center sm:justify-start gap-1.5 transition-colors shadow-sm w-full sm:w-auto shrink-0"
                >
                  <Icons.Plus className="w-3.5 h-3.5" /> Add Attribute
                </button>
              )}
            </div>
            <div className="p-5 flex-1 overflow-auto scrollbar-thin">
              {!formData.category_type ? (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/30 text-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-4 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-color)]">
                    <Icons.Filter className="w-7 h-7 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">No Category Type</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-[240px]">Category type is required to configure attributes.</p>
                </div>
              ) : formData.attributes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                  {formData.attributes.map((config, index) => {
                    const seedName = config.seed_name || `Attribute ${index + 1}`;
                    const inputKey = config.ui_key || `attr-${getAttributeId(config) || config.seed_code || index}`;
                    const isOpen = openAttributeKey === inputKey;
                    const selectedValues = Array.isArray(config.value) ? config.value : [];
                    let TypeIcon = Icons.Filter;
                    if (config.seed_type === "boolean") TypeIcon = Icons.Check;

                    const assignedCount = config.seed_type === "multi_select"
                      ? selectedValues.length
                      : (config.value !== undefined && config.value !== null && String(config.value).trim() !== "" ? 1 : 0);
                    const isAssigned = assignedCount > 0;
                    
                    // Badge Label Logic
                    let typeBadgeLabel = "Multi Select";
                    if (config.seed_type === "boolean") typeBadgeLabel = "Boolean";
                    
                    return (
                      <div
                        key={inputKey}
                        className={`rounded-xl border overflow-visible transition-all duration-200 ${isOpen ? "border-[var(--accent)]/50 bg-[var(--bg-primary)] shadow-md ring-1 ring-[var(--accent)]/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-muted)]"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setOpenAttributeKey((prev) => (prev === inputKey ? null : inputKey))}
                          className="w-full px-4 py-4 flex flex-col lg:flex-row lg:items-center text-left group"
                        >
                          <div className="flex items-start lg:items-center gap-3 min-w-0 flex-1 w-full lg:w-auto">
                            <div className={`w-10 h-10 flex items-center justify-center shrink-0 rounded-lg transition-colors ${isOpen ? "bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25" : "bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border-color)] group-hover:border-[var(--text-muted)]"}`}>
                              <TypeIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 lg:gap-y-1.5 mb-1.5 min-w-0">
                                <h4 className="text-sm font-bold text-[var(--text-primary)] truncate w-full lg:w-auto">{seedName}</h4>
                                <span className="inline-flex max-w-full min-w-0 items-center px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded border border-[var(--border-color)]">
                                  <span className="truncate">{typeBadgeLabel}</span>
                                </span>
                                {isAssigned && (
                                  <span className="inline-flex max-w-full min-w-0 items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/25">
                                    <span className="w-1 h-1 rounded-full bg-[var(--accent)] shrink-0" />
                                    <span className="truncate">Assigned</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 min-h-[20px] items-center">
                                {config.seed_type === "boolean" ? (
                                  // FIXED: BOOLEAN TOGGLE IN CARD HEADER (Using Div instead of Button)
                                  <div 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-0.5 cursor-pointer"
                                  >
                                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                                      const isActive = config.value === opt.id;
                                      return (
                                        <div
                                          key={String(opt.id)}
                                          onClick={() => updateAttributeConfig(inputKey, "value", opt.id)}
                                          className={`px-3 py-1 text-[10px] font-medium flex items-center justify-center gap-1.5 rounded transition-all select-none ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                                          {opt.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  selectedValues.length > 0 ? (
                                    <>
                                      {selectedValues.slice(0, 3).map((val, i) => (
                                        <span key={i} className="inline-flex max-w-full min-w-0 items-center px-2 py-0.5 text-[10px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded border border-[var(--accent)]/15">
                                          <span className="truncate">{val}</span>
                                        </span>
                                      ))}
                                      {selectedValues.length > 3 && (
                                        <span className="text-[10px] font-medium text-[var(--text-muted)] self-center">+{selectedValues.length - 3}</span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[11px] italic text-[var(--text-muted)]">No options assigned</span>
                                  )
                                )}
                              </div>
                            </div>
                            <Icons.ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180 text-[var(--accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`} />
                          </div>
                        </button>
                        
                        {isOpen && (
                          <div className="px-4 pb-4 pt-3 border-t border-[var(--border-color)]/50 bg-[var(--bg-primary)]/50 rounded-b-xl">
                            
                            {/* FIXED: Use ProfessionalMultiSelect for multi_select types */}
                            {config.seed_type === "multi_select" ? (
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Assigned Options</label>
                                  <span className="text-[10px] font-medium text-[var(--text-muted)]">{selectedValues.length} assigned</span>
                                </div>
                                
                                {/* Replaced manual list with ProfessionalMultiSelect */}
                                <ProfessionalMultiSelect 
                                  attribute={config}
                                  value={config.value}
                                  onChange={(newVal) => updateAttributeConfig(inputKey, "value", newVal)}
                                  onAddNewOption={(newOpt) => handleAddAttributeValue(inputKey, { ...config, _draftValue: newOpt })}
                                />

                                {/* Keep the manual list view below if you want to see them as removable chips, or remove this block if dropdown is enough */}
                                <div className="space-y-1.5 mt-2">
                                  {selectedValues.length > 0 ? (
                                    selectedValues.map((val, i) => (
                                      <div
                                        key={`${inputKey}-opt-${i}`}
                                        className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg"
                                      >
                                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                                          {i + 1}
                                        </span>
                                        <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate">{val}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next = selectedValues.filter((_, idx) => idx !== i);
                                            updateAttributeConfig(inputKey, "value", next);
                                            const attrIdForUpdate = getAttributeId(config);
                                            if (attrIdForUpdate) {
                                              const fullAttr = seededAttributes.find(a => String(a._id) === attrIdForUpdate);
                                              if (fullAttr) {
                                                const remaining = (fullAttr.values || []).filter((v) => {
                                                  const lbl = v.label || v.value || "";
                                                  return lbl !== val;
                                                });
                                                attributeApi.update(attrIdForUpdate, {
                                                  values: remaining.map((v) => ({
                                                    label: v.label || v.value || "",
                                                    value: v.value || v.label || "",
                                                    sort_order: v.sort_order ?? 0,
                                                    is_active: v.is_active !== false,
                                                  })),
                                                }).then(() => {
                                                  queryClient.invalidateQueries({ queryKey: ["seeded-attributes", formData.category_type?.toLowerCase()] });
                                                }).catch(() => {});
                                              }
                                            }
                                          }}
                                          className="w-9 h-9 sm:w-6 sm:h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                          aria-label={`Remove ${val}`}
                                        >
                                          <Icons.X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-3 text-center text-[11px] italic text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/40">
                                      No options assigned yet
                                    </div>
                                  )}
                                </div>
                                
                                {/* Optional: Keep manual add input if you prefer it over dropdown's "Add new" feature, otherwise remove this block */}
                                <div className="flex gap-2 pt-1">
                                  <input
                                    type="text"
                                    id={`opt-input-${inputKey}`}
                                    placeholder={`Add option (e.g. 8 GB)`}
                                    className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                                    onKeyDown={async (e) => {
                                      if (e.key !== "Enter") return;
                                      e.preventDefault();
                                      const input = e.currentTarget;
                                      const raw = input.value.trim();
                                      if (!raw) return;
                                      input.value = "";
                                      await handleAddAttributeValue(inputKey, { ...config, _draftValue: raw });
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const input = document.getElementById(`opt-input-${inputKey}`);
                                      if (!input) return;
                                      const raw = input.value.trim();
                                      if (!raw) return;
                                      await handleAddAttributeValue(inputKey, { ...config, _draftValue: raw });
                                      input.value = "";
                                    }}
                                    className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                                  >
                                    <Icons.Plus className="w-3.5 h-3.5" /> Add Option
                                  </button>
                                </div>
                              </div>
                             ) : config.seed_type === "boolean" ? (
                               // BOOLEAN EXPANDED VIEW
                               <div className="space-y-2">
                                   <label className="block text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Current State</label>
                                   <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                                     {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                                       const isActive = config.value === opt.id;
                                       return (
                                         <button
                                           key={String(opt.id)}
                                           type="button"
                                           onClick={() => updateAttributeConfig(inputKey, "value", opt.id)}
                                           className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                                         >
                                           <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                                           {opt.label}
                                         </button>
                                       );
                                     })}
                                   </div>
                                    <p className="text-[10px] text-[var(--text-muted)]">Toggle to switch between Yes and No.</p>
                                </div>
                            ) : (
                              <span className="text-[11px] italic text-[var(--text-muted)]">No configuration needed</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/30 text-center">
                  <div className="w-16 h-16 flex items-center justify-center mb-4 bg-[var(--bg-tertiary)] rounded-2xl border border-[var(--border-color)]">
                    <Icons.Layers className="w-7 h-7 text-[var(--text-muted)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-secondary)] mb-1">No Attributes Added</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-[240px] mb-5">Start defining what makes products unique.</p>
                  <button
                    type="button"
                    onClick={() => setShowAttributeModal(true)}
                    className="h-9 px-4 text-[10px] font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Icons.Plus className="w-3.5 h-3.5" /> Create First Attribute
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </form>

      {/* ADD ATTRIBUTE MODAL (SAME AS CREATE) */}
      {showAttributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-card)] shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-card)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <Icons.FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Add New Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Configure properties for products in this category.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAttributeModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--bg-tertiary)]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-[var(--danger)]">*</span></label>
                <input
                  type="text"
                  value={newAttributeData.name}
                  onChange={(e) => setNewAttributeData({ ...newAttributeData, name: e.target.value })}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Data Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "multi_select", label: "Options", icon: <Icons.Filter className="w-4 h-4" /> },
                    { id: "boolean", label: "Boolean", icon: <Icons.Check className="w-4 h-4" /> },
                  ].map((type) => {
                    const isActive = newAttributeData.data_type === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewAttributeData({ ...newAttributeData, data_type: type.id })}
                        className={`h-12 text-[11px] font-semibold flex flex-col items-center justify-center gap-1.5 rounded-lg border transition-colors ${isActive ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40" : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)]"}`}
                      >
                        {type.icon}
                        <span>{type.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {newAttributeData.data_type === "multi_select" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Options</label>
                  <div className="space-y-1.5">
                    {(newAttributeData.values || []).map((opt, idx) => (
                      <div
                        key={`opt-${idx}`}
                        className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg"
                      >
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold border border-[var(--accent)]/20">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-xs text-[var(--text-primary)] truncate">{opt}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = (newAttributeData.values || []).filter((_, i) => i !== idx);
                            setNewAttributeData({ ...newAttributeData, values: next });
                          }}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          aria-label="Remove option"
                        >
                          <Icons.X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-attr-option-input"
                      placeholder="Add an option (e.g. 8 GB)"
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (!val) return;
                          const exists = (newAttributeData.values || []).some((v) => v.toLowerCase() === val.toLowerCase());
                          if (exists) return;
                          setNewAttributeData({ ...newAttributeData, values: [...(newAttributeData.values || []), val] });
                          e.currentTarget.value = "";
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("new-attr-option-input");
                        if (!input) return;
                        const val = input.value.trim();
                        if (!val) return;
                        const exists = (newAttributeData.values || []).some((v) => v.toLowerCase() === val.toLowerCase());
                        if (exists) { input.value = ""; return; }
                        setNewAttributeData({ ...newAttributeData, values: [...(newAttributeData.values || []), val] });
                        input.value = "";
                      }}
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Icons.Plus className="w-3.5 h-3.5" /> Add Option
                    </button>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Add one or more options. You can also add more after creating the attribute.</p>
                </div>
              )}

              {/* BOOLEAN TOGGLE UI - YES / NO */}
              {newAttributeData.data_type === "boolean" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider">Default State</label>
                  <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                    {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                      const isActive = newAttributeData.value === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => setNewAttributeData({ ...newAttributeData, value: opt.id })}
                          className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
                        >
                          <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? (opt.id === true ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">This will be the default Yes/No state for this attribute.</p>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border-card)] flex items-center justify-end gap-3 bg-[var(--bg-primary)]/30">
              <button
                type="button"
                onClick={() => setShowAttributeModal(false)}
                className="h-9 px-4 text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAttributeFromModal}
                className="h-9 px-5 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm"
              >
                Add Attribute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}