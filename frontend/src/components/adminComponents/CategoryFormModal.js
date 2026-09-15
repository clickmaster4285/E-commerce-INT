"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";

const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const FolderIcon = ({ className = "w-6 h-6" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const LayersIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>);

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

const cardStyle = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border-color)",
};

const inputStyle = {
  backgroundColor: "var(--bg-tertiary)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
};

export default function CategoryFormModal({ open, onClose, onCreated }) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    category_code: "",
    name: "",
    description: "",
    parent_category_id: "",
    status: "active",
    attributes: [],
  });
  const [autoCode, setAutoCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

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

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: categoryApi.getAllAdmin,
    retry: false,
    staleTime: 0,
  });

  const { data: allAttributes = [] } = useQuery({
    queryKey: ["all-attributes"],
    queryFn: () => attributeApi.getAll(),
    enabled: showAttrSelectModal,
  });

  const resetForm = () => {
    setFormData({ category_code: "", name: "", description: "", parent_category_id: "", status: "active", attributes: [] });
    setAutoCode("");
    setShowParentDropdown(false);
    setShowAttrSelectModal(false);
    setShowCreateAttrModal(false);
  };

  const fetchNextCode = async () => {
    try {
      setLoadingCode(true);
      const res = await categoryApi.getNextCode();
      const nextCode = res?.nextCode || res?.data?.nextCode || res;
      if (nextCode) {
        setAutoCode(nextCode);
        setFormData((p) => ({ ...p, category_code: nextCode }));
      }
    } catch { setAutoCode(""); } finally { setLoadingCode(false); }
  };

  useEffect(() => {
    if (open) {
      resetForm();
      fetchNextCode();
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (data) => categoryApi.create(data),
    onSuccess: async (savedRes) => {
      try {
        const savedCategory = savedRes?.data?.data || savedRes?.data || savedRes;
        const catId = savedCategory?._id;
        const attrs = formData.attributes || [];
        const properAttrs = attrs
          .filter((a) => a && (a.attribute_id || a.seed_code))
          .map((a) => {
            const raw = a.attribute_id || a._id;
            let aid;
            if (!raw) aid = undefined;
            else if (typeof raw === "string") aid = raw;
            else if (typeof raw === "object" && raw._id) aid = String(raw._id);
            else aid = String(raw);
            return {
              attribute_id: aid || undefined,
              is_visible: a.is_visible !== false,
              is_searchable: Boolean(a.is_searchable),
              is_variant_option: a.is_variant_option !== false,
              sort_order: typeof a.sort_order === "number" ? a.sort_order : 0,
              value: Array.isArray(a.value) ? a.value : (a.value != null ? String(a.value) : ""),
            };
          })
          .filter((a) => !!a.attribute_id);
        if (catId && properAttrs.length > 0) {
          try { await categoryApi.updateAttributes(String(catId), properAttrs); } catch (err) { console.error("Attribute sync failed:", err); }
        }
      } catch (syncErr) { console.error("Attribute sync step failed:", syncErr); }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success("Category created successfully");
      const savedCategory = savedRes?.data?.data || savedRes?.data || savedRes;
      if (onCreated && savedCategory?._id) onCreated(savedCategory);
      onClose();
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Create failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    const payload = { ...formData, parent_category_id: formData.parent_category_id || null };
    createMutation.mutate(payload);
  };

  const isSaving = createMutation.isPending;

  const buildHierarchy = (cats, parentId = null, depth = 0) => {
    const result = [];
    const normalizedParent = parentId === null ? "" : getId(parentId);
    const children = cats.filter((c) => {
      const cParentId = getId(c.parent_category_id);
      return cParentId === normalizedParent;
    });
    for (const cat of children) {
      result.push({ ...cat, depth });
      result.push(...buildHierarchy(cats, cat._id, depth + 1));
    }
    return result;
  };
  const hierarchicalCategories = buildHierarchy(categories);
  const selectedParentName = formData.parent_category_id
    ? categories.find((c) => String(c._id) === String(formData.parent_category_id))?.name || "Root Category"
    : "Root Category";

  const filteredAllAttributes = useMemo(() => {
    if (!attrSearch.trim()) return allAttributes;
    const q = attrSearch.toLowerCase();
    return allAttributes.filter((a) => a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q));
  }, [allAttributes, attrSearch]);

  const toggleTempAttribute = (attrId) => {
    setTempSelectedAttrIds((prev) => prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]);
  };

  const applyAttributeSelection = () => {
    const existingAttrs = [...formData.attributes];
    const newAttrs = [];
    tempSelectedAttrIds.forEach((attrId, index) => {
      const existing = existingAttrs.find((a) => String(getAttributeId(a)) === String(attrId));
      if (existing) {
        newAttrs.push({ ...existing, sort_order: index });
      } else {
        const attr = allAttributes.find((a) => String(a._id) === String(attrId));
        if (attr) {
          const mappedSeedType = attr.data_type === "select" || attr.data_type === "color" ? "multi_select" : attr.data_type;
          const options = (attr.values || []).map(v => v.label || v.value || v);
          newAttrs.push({
            ui_key: `sel-${attrId}-${Date.now()}`,
            attribute_id: attr._id,
            seed_code: attr.code,
            seed_name: attr.name,
            seed_type: mappedSeedType,
            seed_options: options,
            is_visible: true,
            is_searchable: true,
            sort_order: index,
            value: mappedSeedType === "multi_select" ? [] : "",
          });
        }
      }
    });
    setFormData((p) => ({ ...p, attributes: newAttrs }));
    setShowAttrSelectModal(false);
  };

  const openAttrSelectModal = () => {
    const currentIds = formData.attributes.map((a) => getAttributeId(a)).filter(Boolean);
    setTempSelectedAttrIds([...currentIds]);
    setAttrSearch("");
    setShowAttrSelectModal(true);
    setShowCreateAttrModal(false);
  };

  const removeAttributeFromForm = (attrId) => {
    setFormData((p) => ({ ...p, attributes: p.attributes.filter((a) => String(getAttributeId(a)) !== String(attrId)) }));
  };

  const handleCreateAttribute = async () => {
    if (!newAttrName.trim() || creatingAttribute) return;
    if (newAttrType === "multi_select" && newAttrValues.length === 0) {
      toast.error("At least one option is required for Multi Options type");
      return;
    }
    setCreatingAttribute(true);
    try {
      const code = newAttrName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const payload = {
        name: newAttrName.trim(), code, data_type: newAttrType, description: "",
        values: newAttrType === "multi_select"
          ? newAttrValues.map((v) => ({ label: v, value: v }))
          : [{ label: newAttrDefaultValue === "yes" ? "Yes" : "No", value: newAttrDefaultValue }],
      };
      const created = await attributeApi.create(payload);
      queryClient.invalidateQueries({ queryKey: ["all-attributes"] });
      if (created && created._id) {
        const mappedType = created.data_type === "select" || created.data_type === "color" ? "multi_select" : created.data_type;
        const options = (created.values || []).map(v => v.label || v.value || v);
        const newAttrEntry = {
          ui_key: `sel-${created._id}-${Date.now()}`,
          attribute_id: created._id,
          seed_code: created.code,
          seed_name: created.name,
          seed_type: mappedType,
          seed_options: options,
          is_visible: true,
          is_searchable: true,
          sort_order: formData.attributes.length,
          value: mappedType === "multi_select" ? [] : (newAttrDefaultValue === "yes" ? true : false),
        };
        setFormData((p) => ({ ...p, attributes: [...p.attributes, newAttrEntry] }));
        setTempSelectedAttrIds((prev) => [...prev, created._id]);
      }
      setShowCreateAttrModal(false);
      setNewAttrName("");
      setNewAttrType("multi_select");
      setNewAttrValues([]);
      setNewAttrValueInput("");
      setNewAttrDefaultValue("yes");
      setAttrSearch("");
      toast.success(`Attribute "${created?.name}" created`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create attribute");
    } finally {
      setCreatingAttribute(false);
    }
  };

  if (!open) return null;

  const renderParentDropdown = () => {
    if (!showParentDropdown) return null;
    return createPortal(
      <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setShowParentDropdown(false)} />
        <div
          className="fixed z-[9999] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-2xl overflow-hidden"
          style={{ top: parentDropdownPos.top, left: parentDropdownPos.left, width: parentDropdownPos.width, maxHeight: "240px" }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            <button type="button"
              onClick={() => { setFormData({ ...formData, parent_category_id: "" }); setShowParentDropdown(false); }}
              className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${!formData.parent_category_id ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
              <span>Root Category</span>
              {!formData.parent_category_id && <CheckIcon className="w-3.5 h-3.5 text-[var(--accent)]" />}
            </button>
            {categoriesLoading ? (
              <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">Loading categories...</div>
            ) : hierarchicalCategories.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-[var(--text-muted)]">No categories available</div>
            ) : (
              hierarchicalCategories.map((cat) => (
                <button key={cat._id} type="button"
                  onClick={() => { setFormData({ ...formData, parent_category_id: cat._id }); setShowParentDropdown(false); }}
                  className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${String(formData.parent_category_id) === String(cat._id) ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}
                  style={{ paddingLeft: `${12 + cat.depth * 16}px` }}>
                  <span className="truncate">{cat.name}</span>
                  {String(formData.parent_category_id) === String(cat._id) && <CheckIcon className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      </>,
      document.body
    );
  };

  const renderAttributeSelectModal = () => {
    if (!showAttrSelectModal) return null;
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 80vh)" }}>
          <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Select Attributes</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Select attributes for products in this category.</p>
            </div>
            <button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-5 py-2.5 border-b border-[var(--border-color)] shrink-0">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><SearchIcon className="w-3.5 h-3.5" /></span>
              <input type="text" placeholder="Search attributes..." value={attrSearch}
                onChange={(e) => setAttrSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                autoFocus />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {allAttributes.length > 0 ? (
              filteredAllAttributes.length > 0 ? (
                filteredAllAttributes.map((attr) => {
                  const isChecked = tempSelectedAttrIds.includes(attr._id);
                  return (
                    <button key={attr._id} type="button" onClick={() => toggleTempAttribute(attr._id)}
                      className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors border-b border-[var(--border-color)] last:border-b-0 ${isChecked ? "bg-[var(--accent-soft)]/30" : "hover:bg-[var(--bg-tertiary)]"}`}>
                      <div className={`w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded border-[1.5px] transition-colors ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-input)]"}`}>
                        {isChecked && <CheckIcon className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{attr.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{attr.code} &middot; {attr.data_type || "text"}</p>
                      </div>
                      {attr.values && attr.values.length > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">{attr.values.length} values</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="text-[12px] text-[var(--text-muted)] mb-1">No matching attributes found</p>
                  <p className="text-[11px] text-[var(--text-muted)]">No attribute matches &quot;{attrSearch}&quot;</p>
                </div>
              )
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-[var(--text-muted)] mb-1">No attributes available yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mb-3">Create an attribute to start defining product specifications.</p>
              </div>
            )}
          </div>
          {!showCreateAttrModal && (
            <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
              {attrSearch.trim() && filteredAllAttributes.length === 0 ? (
                <div className="px-5 py-2.5">
                  <button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(attrSearch.trim()); }}
                    className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]">
                    <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[12px] font-medium">Create &quot;{attrSearch.trim()}&quot;</span>
                  </button>
                </div>
              ) : !attrSearch.trim() ? (
                <div className="px-5 py-2.5">
                  <button type="button" onClick={() => { setShowCreateAttrModal(true); setNewAttrName(""); }}
                    className="w-full flex items-center gap-2 text-left transition-colors hover:bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-[var(--accent)]">
                    <PlusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[12px] font-medium">Create new attribute</span>
                  </button>
                </div>
              ) : null}
            </div>
          )}
          <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }}
              className="h-8 px-3 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
              Cancel
            </button>
            <button type="button" onClick={applyAttributeSelection}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm">
              Apply{tempSelectedAttrIds.length > 0 ? ` (${tempSelectedAttrIds.length})` : ""}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderCreateAttrInline = () => {
    if (!showCreateAttrModal) return null;
    return createPortal(
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-sm bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Create Attribute</h3>
            <button type="button" onClick={() => setShowCreateAttrModal(false)} className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Name <span className="text-red-500">*</span></label>
              <input type="text" value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} autoFocus
                className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                placeholder="e.g. Color" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Type</label>
              <select value={newAttrType} onChange={(e) => setNewAttrType(e.target.value)}
                className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]">
                <option value="multi_select">Multi Select</option>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>
            {newAttrType === "multi_select" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Options</label>
                <div className="flex gap-2">
                  <input type="text" value={newAttrValueInput} onChange={(e) => setNewAttrValueInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (newAttrValueInput.trim()) { setNewAttrValues((p) => [...p, newAttrValueInput.trim()]); setNewAttrValueInput(""); } } }}
                    className="flex-1 h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)]"
                    placeholder="Type and press Enter" />
                  <button type="button" onClick={() => { if (newAttrValueInput.trim()) { setNewAttrValues((p) => [...p, newAttrValueInput.trim()]); setNewAttrValueInput(""); } }}
                    className="h-[38px] px-3 text-[12px] font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90">Add</button>
                </div>
                {newAttrValues.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newAttrValues.map((v, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                        {v}
                        <button type="button" onClick={() => setNewAttrValues((p) => p.filter((_, idx) => idx !== i))} className="text-[var(--text-muted)] hover:text-red-500">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-[var(--border-color)] flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowCreateAttrModal(false)}
              className="h-8 px-3 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)]">
              Cancel
            </button>
            <button type="button" onClick={handleCreateAttribute} disabled={creatingAttribute || !newAttrName.trim()}
              className="h-8 px-4 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 disabled:opacity-50">
              {creatingAttribute && <Spinner className="w-3 h-3" />}
              Create
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[580px] max-h-[85vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
              <FolderIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Create Category</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Define category details, attributes, and hierarchy.</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
            aria-label="Close modal">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form id="category-shared-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
          <div className="p-5 space-y-4">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Code</label>
                  <div className="relative">
                    <input type="text" value={formData.category_code} onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                      className="w-full h-[38px] px-3 text-[12px] font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                      placeholder="AUTO-GENERATED" />
                    {loadingCode && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--accent)]" />}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required autoFocus
                    className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                    placeholder="e.g. Smartphones" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 text-[12px] outline-none resize-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="Briefly describe what products belong in this category..." />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Category Hierarchy</p>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Parent Category</label>
                <div className="relative">
                  <button ref={parentDropdownRef} type="button"
                    onClick={() => {
                      if (!showParentDropdown && parentDropdownRef.current) {
                        const rect = parentDropdownRef.current.getBoundingClientRect();
                        setParentDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                      }
                      setShowParentDropdown(!showParentDropdown);
                    }}
                    className="w-full h-[38px] px-3 text-[12px] outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors cursor-pointer flex items-center justify-between gap-2">
                    <span className="truncate text-left">{selectedParentName}</span>
                    <ChevronDownIcon className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${showParentDropdown ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Product Attributes</p>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Attributes</label>
                <button type="button" onClick={openAttrSelectModal}
                  className="w-full min-h-[38px] px-3 py-2 text-[12px] text-left outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:border-[var(--accent)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 min-w-0">
                    <LayersIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                    {formData.attributes.length === 0 ? (
                      <span className="text-[var(--text-muted)]">Select Attributes</span>
                    ) : (
                      <span className="text-[var(--text-secondary)]">{formData.attributes.length} attribute{formData.attributes.length !== 1 ? "s" : ""} selected</span>
                    )}
                  </span>
                  <span className="text-[var(--text-muted)] text-[10px] font-medium px-2 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] shrink-0">
                    Browse
                  </span>
                </button>
                {formData.attributes.length > 0 && (
                  <div className="flex flex-wrap gap-[6px] pt-1.5">
                    {formData.attributes.map((attr, i) => (
                      <span key={attr.ui_key || i} className="inline-flex items-center gap-1.5 pl-[10px] pr-[8px] py-[3px] text-[11px] font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-[5px] border border-[var(--border-color)] h-[28px]">
                        {attr.seed_name || `Attribute ${i + 1}`}
                        <button type="button" onClick={() => removeAttributeFromForm(getAttributeId(attr))}
                          className="w-[22px] h-[22px] flex items-center justify-center rounded-[4px] hover:bg-[var(--bg-card)] transition-colors ml-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                          <CloseIcon className="w-[10px] h-[10px]" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Status</p>
              <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-0.5 h-[38px] max-w-xs">
                {[{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }].map((opt) => {
                  const isActive = formData.status === opt.id;
                  return (
                    <button key={opt.id} type="button" onClick={() => setFormData({ ...formData, status: opt.id })}
                      className={`flex-1 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${isActive ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? (opt.id === "active" ? "bg-emerald-500" : "bg-[var(--text-muted)]") : "bg-transparent"}`} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </form>

        <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
            Cancel
          </button>
          <button type="submit" form="category-shared-form" disabled={isSaving}
            className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
            Create Category
          </button>
        </div>
      </div>

      {renderParentDropdown()}
      {renderAttributeSelectModal()}
      {renderCreateAttrInline()}
    </div>,
    document.body
  );
}
