"use client";

import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { useCategorySocketSync } from "@/hooks/useCategorySocketSync";

// ================= ICONS =================
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const FolderIcon = ({ className = "w-6 h-6" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const LayersIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>);
const FilterIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1.994 1.994 0 013 6.586V4z" /></svg>);
const FileTextIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>);

const SortIndicator = ({ active, direction }) => (
  <svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    {active && direction === "desc" ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />}
  </svg>
);

/* ================= Helpers ================= */
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

const getCategoryName = (categoryId, categories) => {
  const category = categories.find((item) => String(item._id) === String(categoryId));
  return category?.name || "Root category";
};

/* ================= MAIN PAGE COMPONENT ================= */
export default function CategoriesPage() {
  useCategorySocketSync();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filterParent, setFilterParent] = useState("all");
const [viewMode, setViewMode] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768 ? "grid" : "list";
  }
  return "list";
});
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [deleteTarget, setDeleteTarget] = useState(null);

  // Create/Edit Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [openAttributeKey, setOpenAttributeKey] = useState(null);

  // Attribute Selection Modal
  const [showAttrSelectModal, setShowAttrSelectModal] = useState(false);
  const [attrSearch, setAttrSearch] = useState("");
  const [tempSelectedAttrIds, setTempSelectedAttrIds] = useState([]);

  // Inline Create Attribute Panel
  const [showCreateAttrModal, setShowCreateAttrModal] = useState(false);
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState("multi_select");
  const [newAttrValues, setNewAttrValues] = useState([]);
  const [newAttrValueInput, setNewAttrValueInput] = useState("");
  const [newAttrDefaultValue, setNewAttrDefaultValue] = useState("yes");
  const [creatingAttribute, setCreatingAttribute] = useState(false);

  // Parent Category Dropdown
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const parentDropdownRef = useRef(null);
  const [parentDropdownPos, setParentDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // Form Data
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

  // Queries
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

  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => categoryApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedIds([]);
      toast.success("Category deleted successfully");
      setDeleteTarget(null);
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Category delete failed"),
  });

  // ================= FORM MUTATIONS =================
  const createMutation = useMutation({
    mutationFn: (data) => categoryApi.create(data),
    onSuccess: async (savedRes, variables) => {
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
      setShowCreateModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Create failed"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: async (_saved, variables) => {
      try {
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
        if (properAttrs.length > 0) {
          try { await categoryApi.updateAttributes(String(variables.id), properAttrs); } catch (err) { console.error("Attribute sync failed:", err); }
        }
      } catch (syncErr) { console.error("Attribute sync step failed:", syncErr); }
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success("Category updated successfully");
      setShowEditModal(false);
      setEditingCategory(null);
      resetForm();
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  // ================= FORM HELPERS =================
  const resetForm = () => {
    setFormData({
      category_code: "",
      name: "",
      description: "",
      parent_category_id: "",
      status: "active",
      attributes: [],
    });
    setAutoCode("");
    setOpenAttributeKey(null);
    setShowCreateAttrModal(false);
    setNewAttrName("");
    setNewAttrType("multi_select");
    setNewAttrValues([]);
    setNewAttrValueInput("");
    setNewAttrDefaultValue("yes");
    setShowParentDropdown(false);
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

  const handleOpenCreate = () => {
    resetForm();
    setShowCreateModal(true);
    fetchNextCode();
  };

  const handleOpenEdit = (category) => {
    const loadedAttrs = (category.attributes || []).map((a, i) => {
      let value = a.value;
      const attrObj = a.attribute_id;
      const dataType = (attrObj && typeof attrObj === "object") ? attrObj.data_type : null;
      if (dataType === "boolean") {
        if (value === "true" || value === true) value = true;
        else if (value === "false" || value === false) value = false;
        else value = false;
      }
      let seed_name = "", seed_code = "", seed_type = "", seed_options = [];
      if (attrObj && typeof attrObj === "object" && attrObj.name) {
        seed_name = attrObj.name || "";
        seed_code = attrObj.code || "";
        seed_type = (attrObj.data_type === "select" || attrObj.data_type === "color") ? "multi_select" : (attrObj.data_type || "");
        seed_options = (attrObj.values || []).map((v) => v.label || v.value || v);
      } else if (a.seed_name) {
        seed_name = a.seed_name || "";
        seed_code = a.seed_code || "";
        seed_type = a.seed_type || "";
        seed_options = a.seed_options || [];
      }
      return {
        ...a, value, seed_name, seed_code, seed_type, seed_options,
        ui_key: a.ui_key || `edit-${getAttributeId(a) || seed_code || `idx-${i}`}-${i}`,
      };
    });
    setFormData({
      category_code: category.category_code || "",
      name: category.name || "",
      description: category.description || "",
      parent_category_id: getId(category.parent_category_id),
      status: category.status || "active",
      attributes: loadedAttrs,
    });
    setEditingCategory(category);
    setAutoCode(category.category_code || "");
    setShowEditModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    const payload = { ...formData, parent_category_id: formData.parent_category_id || null };
    if (showEditModal && editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

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

  const removeAttributeFromForm = (attrId) => {
    setFormData((p) => ({
      ...p,
      attributes: p.attributes.filter((a) => String(getAttributeId(a)) !== String(attrId)),
    }));
  };

  // Attribute Selection Modal handlers
  const openAttrSelectModal = () => {
    const currentIds = formData.attributes.map((a) => getAttributeId(a)).filter(Boolean);
    setTempSelectedAttrIds([...currentIds]);
    setAttrSearch("");
    setShowAttrSelectModal(true);
    setShowCreateAttrModal(false);
    setNewAttrName("");
    setNewAttrType("multi_select");
    setNewAttrValues([]);
    setNewAttrValueInput("");
    setNewAttrDefaultValue("yes");
  };

  const toggleTempAttribute = (attrId) => {
    setTempSelectedAttrIds((prev) =>
      prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId]
    );
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
        name: newAttrName.trim(),
        code,
        data_type: newAttrType,
        description: "",
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

  const filteredAllAttributes = useMemo(() => {
    if (!attrSearch.trim()) return allAttributes;
    const q = attrSearch.toLowerCase();
    return allAttributes.filter((a) =>
      a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q)
    );
  }, [allAttributes, attrSearch]);



  /* ---------- Derived data ---------- */
  const filteredCategories = useMemo(() => categories.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.category_code?.toLowerCase().includes(search.toLowerCase());
    const matchParent = filterParent === "all" || (filterParent === "root" && !c.parent_category_id) || (filterParent === "child" && c.parent_category_id);
    return matchSearch && matchParent;
  }), [categories, search, filterParent]);

  const sortedCategories = useMemo(() => {
    const arr = [...filteredCategories];
    if (!sortConfig.key) {
      arr.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return arr;
    }
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "code": va = a.category_code?.toLowerCase() || ""; vb = b.category_code?.toLowerCase() || ""; break;
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredCategories, sortConfig]);

  const totalCategories = sortedCategories.length;
  const totalPages = Math.ceil(totalCategories / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = sortedCategories.slice(startIndex, endIndex);

  useEffect(() => setCurrentPage(1), [search, filterParent]);

  // Close parent category dropdown on scroll inside the modal body
  useEffect(() => {
    if (!showParentDropdown) return;
    const handleScroll = () => setShowParentDropdown(false);
    const modalForm = document.getElementById("category-modal-form");
    if (modalForm) modalForm.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      if (modalForm) modalForm.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [showParentDropdown]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== "Escape") return;
      if (showCreateAttrModal) {
        setShowCreateAttrModal(false);
        setNewAttrName("");
        setNewAttrType("multi_select");
        setNewAttrValues([]);
        setNewAttrValueInput("");
        setNewAttrDefaultValue("yes");
      } else if (showAttrSelectModal) {
        setShowAttrSelectModal(false);
        setAttrSearch("");
      } else if (showParentDropdown) {
        setShowParentDropdown(false);
      } else if (showCreateModal) {
        setShowCreateModal(false);
        resetForm();
      } else if (showEditModal) {
        setShowEditModal(false);
        setEditingCategory(null);
        resetForm();
      }
    };
    if (showCreateModal || showEditModal || showAttrSelectModal) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [showCreateModal, showEditModal, showAttrSelectModal, showCreateAttrModal, showParentDropdown]);

  const allCategories = categories.length;
  const rootCategoriesCount = categories.filter((c) => !c.parent_category_id).length;
  const childCategoriesCount = allCategories - rootCategoriesCount;
  const categoriesWithAttributes = categories.filter((c) => c.attributes && c.attributes.length > 0).length;

  const allSelected = paginatedCategories.length > 0 && paginatedCategories.every((c) => selectedIds.includes(c._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : paginatedCategories.map((c) => c._id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const isDeleting = deleteMutation.isPending;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  /* ---------- Handlers ---------- */
  const handleEdit = (category) => handleOpenEdit(category);
  const handleCreate = () => handleOpenCreate();
  const handleDelete = (category) => setDeleteTarget({ categories: [category] });
  const handleBulkDelete = () => setDeleteTarget({ categories: categories.filter((c) => selectedIds.includes(c._id)) });
  const handleViewDetail = (category) => {
    const id = category?._id;
    if (!id) return;
    router.push(`/admin/categories/${id}`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ids = deleteTarget.categories.map((c) => c._id);
    deleteMutation.mutate(ids, { onSettled: () => setDeleteTarget(null) });
  };

  const handleSort = (key) => setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
  const goToPage = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const renderPageNumbers = () => {
    const pages = []; const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  /* ---------- Reusable styles ---------- */
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button type="button" onClick={() => handleSort(sortKey)} className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80" style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label} <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const SelectFilter = ({ value, onChange, children }) => (
    <div className="relative">
      <select value={value} onChange={onChange} className="appearance-none h-10 md:h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[16px] md:text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
        {children}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
    </div>
  );

  const ActionButtons = ({ category }) => (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button onClick={(e) => { e.stopPropagation(); handleViewDetail(category); }} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><EyeIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleEdit(category); }} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); handleDelete(category); }} disabled={isDeleting} className="flex-shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[44px] sm:min-h-[44px] p-1.5 sm:p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center" title="Delete"><TrashIcon className="w-4 h-4" /></button>
    </div>
  );

  /* ================= MODAL RENDERER ================= */
  const renderCategoryFormModal = () => {
    const isEdit = showEditModal && editingCategory;
    if (!showCreateModal && !showEditModal) return null;

    // Build hierarchical category list for custom dropdown
    const buildHierarchy = (cats, parentId = null, depth = 0) => {
      const result = [];
      const normalizedParent = parentId === null ? "" : getId(parentId);
      const children = cats.filter((c) => {
        const cParentId = getId(c.parent_category_id);
        return cParentId === normalizedParent && String(c._id) !== String(editingCategory?._id);
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

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-[580px] max-h-[85vh] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden">
          {/* Modal Header */}
          <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">
                <FolderIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{isEdit ? "Edit Category" : "Create Category"}</h2>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Define category details, attributes, and hierarchy.</p>
              </div>
            </div>
            <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingCategory(null); resetForm(); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
              aria-label="Close modal">
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Body */}
          <form id="category-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
            <div className="p-5 space-y-4">
              {/* ── SECTION 1: BASIC INFORMATION ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Basic Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">Category Code</label>
                    <div className="relative">
                      <input type="text" value={formData.category_code} onChange={(e) => setFormData({ ...formData, category_code: e.target.value })} readOnly={isEdit}
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

              {/* ── SECTION 2: CATEGORY HIERARCHY ── */}
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

              {/* ── SECTION 3: PRODUCT ATTRIBUTES ── */}
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

              {/* ── SECTION 4: STATUS ── */}
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

          {/* ── PARENT CATEGORY DROPDOWN (portaled to body) ── */}
          {showParentDropdown && createPortal(
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
          )}

          {/* Modal Footer */}
          <div className="px-5 py-2.5 border-t border-[var(--border-color)] flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingCategory(null); resetForm(); }}
              className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
              Cancel
            </button>
            <button type="submit" form="category-modal-form" disabled={isSaving}
              className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? <Spinner className="w-3.5 h-3.5" /> : <CheckIcon className="w-3.5 h-3.5" />}
              {isEdit ? "Update Category" : "Create Category"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  /* ================= ATTRIBUTE SELECTION MODAL ================= */
  const renderAttributeSelectModal = () => {
    if (!showAttrSelectModal) return null;

    const noSearchResults = attrSearch.trim() && filteredAllAttributes.length === 0;
    const hasAnyAttributes = allAttributes.length > 0;

    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 80vh)" }}>
          {/* Header - Fixed */}
          <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Select Attributes</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Select attributes to use for products in this category.</p>
            </div>
            <button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
              aria-label="Close attribute selector">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search - Fixed */}
          <div className="px-5 py-2.5 border-b border-[var(--border-color)] shrink-0">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"><SearchIcon className="w-3.5 h-3.5" /></span>
              <input type="text" placeholder="Search attributes..." value={attrSearch}
                onChange={(e) => setAttrSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] outline-none bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                autoFocus />
            </div>
          </div>

          {/* Attribute List - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {hasAnyAttributes ? (
              <>
                {filteredAllAttributes.length > 0 ? (
                  filteredAllAttributes.map((attr) => {
                    const isChecked = tempSelectedAttrIds.includes(attr._id);
                    return (
                      <button key={attr._id} type="button" onClick={() => toggleTempAttribute(attr._id)}
                        className={`w-full px-5 py-2.5 flex items-center gap-3 text-left transition-colors border-b border-[var(--border-color)] last:border-b-0 ${isChecked ? "bg-[var(--accent-soft)]/30" : "hover:bg-[var(--bg-tertiary)]"}`}>
                        {/* Checkbox */}
                        <div className={`w-[18px] h-[18px] flex items-center justify-center shrink-0 rounded border-[1.5px] transition-colors ${isChecked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-input)]"}`}>
                          {isChecked && <CheckIcon className="w-3 h-3 text-white" />}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{attr.name}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{attr.code} &middot; {attr.data_type || "text"}</p>
                        </div>
                        {/* Values count */}
                        {attr.values && attr.values.length > 0 && (
                          <span className="text-[10px] text-[var(--text-muted)] shrink-0 tabular-nums">{attr.values.length} values</span>
                        )}
                      </button>
                    );
                  })
                ) : (
                  /* No matching results when searching */
                  <div className="px-5 py-6 text-center">
                    <p className="text-[12px] text-[var(--text-muted)] mb-1">No matching attributes found</p>
                    <p className="text-[11px] text-[var(--text-muted)]">We couldn&apos;t find an attribute matching &quot;{attrSearch}&quot;</p>
                  </div>
                )}

              </>
            ) : (
              /* Empty State: No attributes in system at all */
              <div className="px-5 py-8 text-center">
                <p className="text-[12px] text-[var(--text-muted)] mb-1">No attributes available yet</p>
                <p className="text-[11px] text-[var(--text-muted)] mb-3">Create an attribute to start defining product specifications.</p>
              </div>
            )}
          </div>

          {/* Create New Attribute - Sticky Bottom */}
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

          {/* Footer - Fixed */}
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

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Category Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage category hierarchy and dynamic attributes</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <button onClick={handleCreate} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><PlusIcon /> Add Category</button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Total Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1">{allCategories}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Root Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-blue-500">{rootCategoriesCount}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>Child Categories</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-emerald-500">{childCategoriesCount}</p></div>
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}><p className="text-[11px] sm:text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>With Attributes</p><p className="text-[18px] sm:text-[20px] font-bold mt-1 text-purple-500">{categoriesWithAttributes}</p></div>
        </div>

        {/* ===== Search ===== */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>

        {/* ===== Filters ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <SelectFilter value={filterParent} onChange={(e) => setFilterParent(e.target.value)}>
            <option value="all">All Categories</option><option value="root">Root Categories</option><option value="child">Child Categories</option>
          </SelectFilter>
        </div>

        {/* ===== Bulk selection bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 rounded-lg p-2.5 sm:p-0 sm:px-4 sm:h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold px-1.5 sm:px-0" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => setSelectedIds([])} className="flex-1 sm:flex-none h-9 sm:h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="flex-1 sm:flex-none h-9 sm:h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* ===== Loading / Empty / Table / Grid ===== */}
        {categoriesLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading categories...</span></div>
        ) : paginatedCategories.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterParent !== "all" ? "No categories match your filters" : "No categories yet"}</p>
            {!search && filterParent === "all" && <button onClick={handleCreate} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>+ Add your first category</button>}
          </div>
        ) : viewMode === "list" ? (
          <>
          <div className="hidden md:block rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    <SortHeader label="Category Code" sortKey="code" />
                    <SortHeader label="Category Name" sortKey="name" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Description</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Parent</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((category, index) => {
                    const isSelected = selectedIds.includes(category._id);
                    const parentName = getCategoryName(category.parent_category_id, categories);
                    const isActive = category.status !== "inactive";
                    return (
                      <tr key={category._id} className="transition cursor-pointer" style={{ borderBottom: index < paginatedCategories.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}
                        onClick={() => handleViewDetail(category)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(category._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-2.5"><span className="text-[13px] font-mono truncate max-w-[100px] block" style={{ color: "var(--text-secondary)" }}>{category.category_code || "—"}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
                            <span className="font-medium text-[13px] truncate max-w-[140px]">{category.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell max-w-[200px]"><p className="truncate text-[13px]" style={{ color: "var(--text-muted)" }}>{category.description || "—"}</p></td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{parentName === "Root category" ? "—" : parentName}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={isActive
                              ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" }
                              : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1"><ActionButtons category={category} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE card list */}
          <div className="md:hidden space-y-2.5">
            {paginatedCategories.map((category) => {
              const isMobileSelected = selectedIds.includes(category._id);
              const parentName = getCategoryName(category.parent_category_id, categories);
              const isMobileActive = category.status !== "inactive";
              return (
                <div key={category._id} onClick={() => handleViewDetail(category)} className="rounded-lg p-3 space-y-2.5 transition cursor-pointer"
                  style={{ ...cardStyle, backgroundColor: isMobileSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input type="checkbox" checked={isMobileSelected} onChange={() => toggleSelect(category._id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded cursor-pointer shrink-0" style={{ accentColor: "var(--accent)" }} />
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate leading-tight">{category.name}</p>
                      <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{category.category_code || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[11px] truncate min-w-0" style={{ color: "var(--text-muted)" }}>{parentName === "Root category" ? "Root" : parentName}</span>
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap" style={isMobileActive ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" } : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }}>{isMobileActive ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="flex items-center justify-end pt-2" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    <ActionButtons category={category} />
                  </div>
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
            {paginatedCategories.map((category) => {
              const parentName = getCategoryName(category.parent_category_id, categories);
              return (
                <div key={category._id} className="rounded-lg p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle} onClick={() => handleViewDetail(category)}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-5 h-5" /></div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[12px] sm:text-[13px] truncate">{category.name}</p>
                    <p className="text-[10px] sm:text-[11px] font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{category.category_code || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 sm:pt-3 gap-1" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] sm:text-[12px] truncate flex-1 min-w-0" style={{ color: "var(--text-muted)" }}>{parentName === "Root category" ? "Root" : parentName}</span>
                    <ActionButtons category={category} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalCategories > 20 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {startIndex + 1}-{Math.min(endIndex, totalCategories)} of {totalCategories} categories</p>
            <div className="flex items-center gap-2">
              <span className="sm:hidden text-[13px] font-medium whitespace-nowrap" style={{ color: "var(--text-primary)" }}>Page {currentPage} of {totalPages}</span>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Previous page"><ChevronLeftIcon className="w-4 h-4" /></button>
              <span className="hidden sm:inline-flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                      <button onClick={() => goToPage(page)} className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}` }}>{page}</button>
                    )}
                  </React.Fragment>
                ))}
              </span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }} title="Next page"><ChevronRightIcon className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        {paginatedCategories.length > 0 && totalCategories <= 20 && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Showing {paginatedCategories.length} of {allCategories} categories</p>}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-lg p-6" style={cardStyle}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}><svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <div className="flex-1 min-w-0"><h3 className="text-sm font-semibold">{deleteTarget.categories.length === 1 ? `Delete "${deleteTarget.categories[0].name}"?` : `Delete ${deleteTarget.categories.length} categories?`}</h3><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The category(ies) will be permanently removed.</p></div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-medium disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>{isDeleting ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Category Modal */}
      {renderCategoryFormModal()}

      {/* Attribute Selection Modal */}
      {renderAttributeSelectModal()}

      {/* ADD NEW ATTRIBUTE MODAL */}
      {showCreateAttrModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-[400px] max-w-[92vw] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 85vh)" }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-start justify-between shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] rounded-lg border border-[var(--accent)]/20 shrink-0">
                  <LayersIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Add New Attribute</h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Configure properties for products in this category.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowCreateAttrModal(false); setNewAttrName(""); setNewAttrType("multi_select"); setNewAttrValues([]); setNewAttrValueInput(""); setNewAttrDefaultValue("yes"); }}
                className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"
                aria-label="Close"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Attribute Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  autoFocus
                  className="w-full h-[40px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder="e.g. Color, Size, RAM"
                />
              </div>

              {/* Attribute Type */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "multi_select", label: "Multi Options" },
                    { id: "boolean", label: "Yes / No" },
                  ].map((type) => {
                    const isActive = newAttrType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          setNewAttrType(type.id);
                          setNewAttrValues([]);
                          setNewAttrValueInput("");
                          if (type.id === "boolean") setNewAttrDefaultValue("yes");
                        }}
                        className={`h-auto py-3 px-3 text-[12px] font-semibold rounded-lg border transition-all text-left flex flex-col gap-0.5 ${isActive
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

              {/* Multi Options Section */}
              {newAttrType === "multi_select" && (
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Options</label>
                  {newAttrValues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {newAttrValues.map((val, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] rounded-md border border-[var(--accent)]/15">
                          <span className="w-4 h-4 flex items-center justify-center rounded bg-[var(--accent)]/10 text-[9px] font-bold text-[var(--accent)] border border-[var(--accent)]/20 shrink-0">{idx + 1}</span>
                          {val}
                          <button
                            type="button"
                            onClick={() => setNewAttrValues((p) => p.filter((_, i) => i !== idx))}
                            className="w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--accent)]/20 transition-colors ml-0.5"
                          >
                            <CloseIcon className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAttrValueInput}
                      onChange={(e) => setNewAttrValueInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const val = newAttrValueInput.trim();
                          if (!val) return;
                          if (newAttrValues.some((v) => v.toLowerCase() === val.toLowerCase())) {
                            toast.error("Option already exists");
                            return;
                          }
                          setNewAttrValues((p) => [...p, val]);
                          setNewAttrValueInput("");
                        }
                      }}
                      className="flex-1 min-w-0 h-[36px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                      placeholder="Add an option (e.g. 8 GB)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newAttrValueInput.trim();
                        if (!val) return;
                        if (newAttrValues.some((v) => v.toLowerCase() === val.toLowerCase())) {
                          toast.error("Option already exists");
                          setNewAttrValueInput("");
                          return;
                        }
                        setNewAttrValues((p) => [...p, val]);
                        setNewAttrValueInput("");
                      }}
                      className="h-[36px] px-3 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1 transition-colors shrink-0"
                    >
                      <PlusIcon className="w-3 h-3" /> Add
                    </button>
                  </div>
                </div>
              )}

              {/* Yes / No Section */}
              {newAttrType === "boolean" && (
                <div className="space-y-2.5">
                  <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Default Value</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "yes", label: "Yes" },
                      { id: "no", label: "No" },
                    ].map((opt) => {
                      const isActive = newAttrDefaultValue === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setNewAttrDefaultValue(opt.id)}
                          className={`h-11 text-[12px] font-semibold flex items-center justify-center gap-2 rounded-lg border transition-all ${isActive
                            ? opt.id === "yes"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10"
                              : "bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-[var(--text-muted)]/30 shadow-sm"
                            : "bg-[var(--bg-input)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${isActive
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

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--border-color)] flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setShowCreateAttrModal(false); setNewAttrName(""); setNewAttrType("multi_select"); setNewAttrValues([]); setNewAttrValueInput(""); setNewAttrDefaultValue("yes"); }}
                className="h-9 px-4 text-[12px] font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card-alt)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAttribute}
                disabled={!newAttrName.trim() || creatingAttribute}
                className="h-9 px-5 text-[12px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingAttribute ? (
                  <span className="flex items-center gap-1.5"><Spinner className="w-3.5 h-3.5" /> Adding...</span>
                ) : "Add Attribute"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
