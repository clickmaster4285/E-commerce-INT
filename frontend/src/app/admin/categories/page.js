"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const SettingsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const FolderIcon = ({ className = "w-6 h-6" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);

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

const getAttributeId = (attribute) => String(attribute?.attribute_id || attribute?._id || "");

// ✅ FIX: Robust normalization to STRICTLY preserve values during edit
const normalizeConfig = (attribute, index = 0) => {
  const config = attribute?.category_config || attribute || {};
  const has = (key) => config[key] !== undefined && config[key] !== null;

  return {
    attribute_id: attribute?.attribute_id || attribute?._id,
    is_required: has("is_required") ? Boolean(config.is_required) : false,
    is_visible: has("is_visible") ? Boolean(config.is_visible) : true,
    is_filterable: has("is_filterable") ? Boolean(config.is_filterable) : false,
    is_searchable: has("is_searchable") ? Boolean(config.is_searchable) : false,
    sort_order: Number.isFinite(Number(config.sort_order)) ? Number(config.sort_order) : index,
    // Critical: Preserve 'value' exactly as stored in DB
    value: has("value") ? config.value : "",
  };
};

const getCategoryName = (categoryId, categories) => {
  const category = categories.find((item) => String(item._id) === String(categoryId));
  return category?.name || "Root category";
};

/* ================= CONFIGURATION ================= */
const FIXED_CATEGORIES = [
  { name: "Mobile", code: "mobile" },
  { name: "PC", code: "pc" },
  { name: "Clothing", code: "clothing" },
];

const CATEGORY_ATTRIBUTE_MAP = {
  Mobile: ["ram", "rom", "storage", "screen_size", "color", "battery", "camera", "processor", "brand", "model"],
  PC: ["ram", "storage", "processor", "gpu", "graphics", "screen_size", "screen_resolution", "os", "operating_system", "color", "brand", "model"],
  Clothing: ["size", "color", "fabric", "fit", "pattern", "gender", "sleeve_type", "brand"]
};

/* ================= PROFESSIONAL DROPDOWN COMPONENT ================= */
const ProfessionalDropdown = ({ attribute, value, onChange, onAddNewValue }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newVal, setNewVal] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredValues = (attribute.values || []).filter(v => 
    v.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (newVal.trim() && !filteredValues.some(v => v.label.toLowerCase() === newVal.trim().toLowerCase())) {
      onAddNewValue(attribute._id, newVal.trim());
      setNewVal("");
      setSearch("");
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-9 px-3 rounded-md text-sm flex items-center justify-between outline-none transition focus:ring-1 focus:ring-emerald-500/40"
        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: value ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        <span className="truncate">{value || `Select ${attribute.name}...`}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md shadow-lg overflow-hidden"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          
          <div className="p-2 border-b" style={{ borderColor: "var(--border-color)" }}>
            <input
              type="text"
              placeholder="Search values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-7 px-2 text-xs rounded outline-none"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
              autoFocus
            />
          </div>

          <div className="max-h-40 overflow-y-auto py-1">
            {filteredValues.map((val, idx) => (
              <button key={idx} type="button"
                onClick={() => { onChange(val.label); setIsOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-emerald-500/10 transition flex items-center gap-2"
                style={{ color: value === val.label ? "var(--accent)" : "var(--text-primary)" }}
              >
                {value === val.label && <CheckIcon className="w-3 h-3" />}
                {val.label}
              </button>
            ))}
            
            {filteredValues.length === 0 && (
              <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>No values found</div>
            )}
          </div>

          <div className="p-2 border-t flex gap-2" style={{ borderColor: "var(--border-color)" }}>
            <input
              type="text"
              placeholder="Add new value..."
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 h-7 px-2 text-xs rounded outline-none"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            />
            <button type="button" onClick={handleAdd}
              className="h-7 px-2 rounded text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition">
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ================= MAIN PAGE COMPONENT ================= */
export default function CategoriesPage() {
  useCategorySocketSync();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [filterParent, setFilterParent] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [showModal, setShowModal] = useState(false);
  const [showAttributeDropdown, setShowAttributeDropdown] = useState(false);
  const [showAddAttrModal, setShowAddAttrModal] = useState(false);
  const [newAttrForm, setNewAttrForm] = useState({ name: "", code: "", data_type: "text", unit: "" });
  const [editingAttrId, setEditingAttrId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [attributeSearch, setAttributeSearch] = useState("");
  
  const [activeTab, setActiveTab] = useState("details");

  const [formData, setFormData] = useState({
    category_code: "",
    category_type: "",
    name: "",
    description: "",
    parent_category_id: "",
    status: "active",
    attributes: [],
  });

  const [autoCode, setAutoCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  
  // ✅ FIX: Set staleTime to 0 to ensure fresh data on every render/refetch
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useQuery({
    queryKey: ["admin-categories"], 
    queryFn: categoryApi.getAllAdmin, 
    retry: false,
    staleTime: 0, 
  });

  const { data: availableAttributes = [], isLoading: attributesLoading, refetch: refetchAttributes } = useQuery({
    queryKey: ["active-attributes"],
    queryFn: () => attributeApi.getAll().then((items) => items.filter((item) => item.is_active !== false && item.is_deleted !== true)),
    enabled: showModal || showAddAttrModal,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ FIX: Robust Mutation with forced refetch and safe toast handling
  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => id ? categoryApi.update(id, data) : categoryApi.create(data),
    onSuccess: async (_, variables) => {
      try {
        // Force immediate refetch instead of just invalidation
        await queryClient.refetchQueries({ queryKey: ["admin-categories"], type: "active" });
        await queryClient.refetchQueries({ queryKey: ["categories"], type: "active" });
        
        // Safe toast that works even if response structure varies
        toast.success(variables.id ? "Category updated successfully" : "Category created successfully");
        closeModal();
      } catch (err) {
        console.error("Post-save refresh failed:", err);
        // Fallback: still show success and close modal since mutation succeeded
        toast.success(variables.id ? "Category updated" : "Category created");
        closeModal();
      }
    },
    onError: (error) => {
      console.error("Save mutation error:", error);
      toast.error(error.response?.data?.message || error.message || "Category save failed");
    },
  });

  const createOrUpdateAttrMutation = useMutation({
    mutationFn: ({ id, data }) => id ? attributeApi.update(id, data) : attributeApi.create(data),
    onSuccess: (updatedAttr) => {
      toast.success(`"${updatedAttr.name}" ${editingAttrId ? 'updated' : 'created'} & assigned!`);
      setShowAddAttrModal(false);
      setNewAttrForm({ name: "", code: "", data_type: "text", unit: "" });
      setEditingAttrId(null);
      refetchAttributes().then(() => toggleAttribute(updatedAttr));
    },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to process attribute"),
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

  /* ---------- Derived data ---------- */
  const filteredCategories = useMemo(() => categories.filter((c) => {
    const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.category_code?.toLowerCase().includes(search.toLowerCase());
    const matchParent = filterParent === "all" || (filterParent === "root" && !c.parent_category_id) || (filterParent === "child" && c.parent_category_id);
    return matchSearch && matchParent;
  }), [categories, search, filterParent]);

  const sortedCategories = useMemo(() => {
    const arr = [...filteredCategories];
    if (!sortConfig.key) return arr;
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

  const allCategories = categories.length;
  const rootCategoriesCount = categories.filter((c) => !c.parent_category_id).length;
  const childCategoriesCount = allCategories - rootCategoriesCount;
  const categoriesWithAttributes = categories.filter((c) => c.attributes && c.attributes.length > 0).length;

  const allSelected = paginatedCategories.length > 0 && paginatedCategories.every((c) => selectedIds.includes(c._id));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : paginatedCategories.map((c) => c._id));
  const toggleSelect = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const isSubmitting = saveMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  /* ---------- Handlers ---------- */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) { toast.error("Category name is required"); return; }
    if (!formData.category_type) { toast.error("Please select a Category Type"); return; }

    const attributes = (formData.attributes || []).map((attribute, index) => ({
      attribute_id: attribute.attribute_id,
      is_required: Boolean(attribute.is_required),
      is_visible: attribute.is_visible !== false,
      is_filterable: Boolean(attribute.is_filterable),
      is_searchable: Boolean(attribute.is_searchable),
      sort_order: Number.isFinite(Number(attribute.sort_order)) ? Number(attribute.sort_order) : index,
      value: attribute.value || "",
    }));

    const payload = {
      category_code: formData.category_code.trim(),
      name: formData.name.trim(),
      category_type: formData.category_type,
      description: formData.description.trim(),
      parent_category_id: formData.parent_category_id || null,
      status: formData.status || "active",
      attributes,
    };
    saveMutation.mutate({ id: editingCategory?._id, data: payload });
  };

  // ✅ FIX: Robust Edit Handler with fallback type detection
  const handleEdit = (category) => {
    const directAttributes = (category.attributes || []).map((attribute, index) => normalizeConfig(attribute, index));

    // Detect type with multiple fallbacks
    const normalizeKey = (s) => String(s || "").trim().toLowerCase();
    let detectedType = category.category_type;

    if (!detectedType) {
      const nameMatch = FIXED_CATEGORIES.find((c) => normalizeKey(c.name) === normalizeKey(category.name));
      if (nameMatch) detectedType = nameMatch.name;
    }
    if (!detectedType) {
      const codeMatch = FIXED_CATEGORIES.find((c) => normalizeKey(c.code) === normalizeKey(category.category_code));
      if (codeMatch) detectedType = codeMatch.name;
    }
    // Final validation
    if (detectedType && !FIXED_CATEGORIES.some((c) => c.name === detectedType)) {
      const recovery = FIXED_CATEGORIES.find((c) => normalizeKey(c.name) === normalizeKey(detectedType));
      detectedType = recovery ? recovery.name : "";
    }

    setEditingCategory(category);
    setFormData({
      category_code: category.category_code || "",
      category_type: detectedType || "",
      name: category.name || "",
      description: category.description || "",
      parent_category_id: getId(category.parent_category_id),
      status: category.status || "active",
      attributes: directAttributes,
    });
    setAutoCode(category.category_code || "");
    setActiveTab("details");
    setShowModal(true);
  };

  const handleOpenAddModal = async () => {
    setEditingCategory(null);
    setFormData({ category_code: "", category_type: "", name: "", description: "", parent_category_id: "", status: "active", attributes: [] });
    setActiveTab("details");
    setShowModal(true);
    await fetchNextCode();
  };

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

  const closeModal = () => {
    setShowModal(false); setShowAttributeDropdown(false); setEditingCategory(null);
    setFormData({ category_code: "", category_type: "", name: "", description: "", parent_category_id: "", status: "active", attributes: [] });
    setAutoCode(""); setAttributeSearch("");
  };

  const fetchNextCode = async () => {
    try {
      setLoadingCode(true);
      const response = await categoryApi.getNextCode();
      const nextCode = response?.nextCode || response?.data?.nextCode || response;
      if (nextCode) { setAutoCode(nextCode); setFormData((previous) => ({ ...previous, category_code: nextCode })); }
    } catch { setAutoCode(""); } finally { setLoadingCode(false); }
  };

  const handleParentChange = (parentId) => setFormData((previous) => ({ ...previous, parent_category_id: parentId }));

  const toggleAttribute = (attribute) => {
    const attributeId = String(attribute._id);
    setFormData((previous) => {
      const current = previous.attributes || [];
      const existing = current.find((item) => getAttributeId(item) === attributeId);
      if (existing) return { ...previous, attributes: current.filter((item) => getAttributeId(item) !== attributeId) };
      return { ...previous, attributes: [...current, { attribute_id: attribute._id, is_required: false, is_visible: true, is_filterable: attribute.filterable || false, is_searchable: attribute.searchable || false, sort_order: current.length, value: "" }] };
    });
  };

  const updateAttributeConfig = (attributeId, field, value) => {
    setFormData((previous) => ({
      ...previous,
      attributes: (previous.attributes || []).map((item) => {
        if (getAttributeId(item) !== String(attributeId)) return item;
        return { ...item, [field]: value };
      }),
    }));
  };

  const handleEditAttribute = (attribute) => {
    setEditingAttrId(attribute._id);
    setNewAttrForm({ name: attribute.name, code: attribute.code, data_type: attribute.data_type, unit: attribute.unit || "" });
    setShowAddAttrModal(true);
  };

  const handleAddAttributeValue = async (attrId, newValueLabel) => {
    const attr = availableAttributes.find(a => String(a._id) === String(attrId));
    if (!attr) return;
    
    const updatedValues = [...(attr.values || []), { label: newValueLabel, value: newValueLabel.toLowerCase().replace(/\s+/g, '_'), sort_order: attr.values.length, is_active: true }];
    
    try {
      await attributeApi.update(attrId, { values: updatedValues });
      toast.success(`Added "${newValueLabel}" to ${attr.name}`);
      refetchAttributes();
    } catch (err) {
      toast.error("Failed to add value");
    }
  };

  const selectedAttributeIds = new Set((formData.attributes || []).map((attribute) => getAttributeId(attribute)));
  
  // ✅ FIX: Always show assigned attributes regardless of type filter
  const filteredAttributes = useMemo(() => {
    const text = attributeSearch.trim().toLowerCase();
    let allowedCodes = [];
    if (formData.category_type && CATEGORY_ATTRIBUTE_MAP[formData.category_type]) {
      allowedCodes = CATEGORY_ATTRIBUTE_MAP[formData.category_type];
    }

    return availableAttributes.filter((attribute) => {
      const matchesSearch = !text || attribute.name?.toLowerCase().includes(text) || attribute.code?.toLowerCase().includes(text);
      const attrCode = attribute.code?.toLowerCase();
      const isAlreadyAssigned = selectedAttributeIds.has(String(attribute._id));

      // Show if: matches search AND (no type filter OR matches type OR already assigned)
      const matchesCategory = !formData.category_type || allowedCodes.length === 0 || allowedCodes.includes(attrCode) || isAlreadyAssigned;

      return matchesSearch && matchesCategory;
    });
  }, [availableAttributes, attributeSearch, formData.category_type, selectedAttributeIds]);

  useEffect(() => { if (categoriesError) toast.error("Unable to load categories"); }, [categoriesError]);

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

  // ✅ UPDATED: Action Buttons with Eye Icon
  const ActionButtons = ({ category }) => (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      {/* Eye/View Button */}
      <button onClick={(e) => { e.stopPropagation(); handleViewDetail(category); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><EyeIcon className="w-4 h-4" /></button>
      {/* Edit Button */}
      <button onClick={(e) => { e.stopPropagation(); handleEdit(category); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
      {/* Delete Button */}
      <button onClick={(e) => { e.stopPropagation(); handleDelete(category); }} disabled={isDeleting} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center" title="Delete"><TrashIcon className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Category Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage category hierarchy and dynamic attributes</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <button onClick={handleOpenAddModal} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><PlusIcon /> Add Category</button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Categories</p><p className="text-[20px] font-bold mt-1">{allCategories}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Root Categories</p><p className="text-[20px] font-bold mt-1 text-blue-500">{rootCategoriesCount}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Child Categories</p><p className="text-[20px] font-bold mt-1 text-emerald-500">{childCategoriesCount}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>With Attributes</p><p className="text-[20px] font-bold mt-1 text-purple-500">{categoriesWithAttributes}</p></div>
        </div>

        {/* ===== Search ===== */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>

        {/* ===== Filters ===== */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter value={filterParent} onChange={(e) => setFilterParent(e.target.value)}>
            <option value="all">All Categories</option><option value="root">Root Categories</option><option value="child">Child Categories</option>
          </SelectFilter>
        </div>

        {/* ===== Bulk selection bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} disabled={isDeleting} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* ===== Loading / Empty / Table / Grid ===== */}
        {categoriesLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading categories...</span></div>
        ) : paginatedCategories.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterParent !== "all" ? "No categories match your filters" : "No categories yet"}</p>
            {!search && filterParent === "all" && <button onClick={handleOpenAddModal} className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>+ Add your first category</button>}
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
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
                    const hasChildren = categories.some((c) => String(c.parent_category_id) === String(category._id));
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
                        {/* ✅ ADDED: Status Column */}
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedCategories.map((category) => {
              const parentName = getCategoryName(category.parent_category_id, categories);
              return (
                <div key={category._id} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle} onClick={() => handleViewDetail(category)}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-5 h-5" /></div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] truncate">{category.name}</p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{category.category_code || "—"}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{parentName === "Root category" ? "Root" : parentName}</span>
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

      {/* ===== PROFESSIONAL ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          {/* Increased max-width for better margins and professional look */}
          <div className="w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            
            {/* Modal Header */}
            <div className="px-8 py-5 flex items-center justify-between border-b" style={{ borderColor: "var(--border-color)" }}>
              <div>
                <h3 className="text-xl font-bold">{editingCategory ? "Edit Category" : "Create New Category"}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Configure details and assign specific attributes</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-white/5 transition"><CloseIcon className="w-5 h-5" /></button>
            </div>

            {/* Professional Tabs */}
            <div className="flex border-b px-8 gap-8" style={{ borderColor: "var(--border-color)" }}>
              <button 
                type="button"
                onClick={() => setActiveTab("details")}
                className={`pb-4 text-sm font-medium flex items-center gap-2 border-b-2 transition ${activeTab === "details" ? "border-emerald-500 text-emerald-500" : "border-transparent text-gray-400 hover:text-gray-200"}`}
              >
                <TagIcon className="w-4 h-4" /> Category Details
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab("attributes")}
                className={`pb-4 text-sm font-medium flex items-center gap-2 border-b-2 transition ${activeTab === "attributes" ? "border-emerald-500 text-emerald-500" : "border-transparent text-gray-400 hover:text-gray-200"}`}
              >
                <SettingsIcon className="w-4 h-4" /> Attributes & Features
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1">
              
              {/* TAB 1: DETAILS — Professional 2-Column Layout */}
              {activeTab === "details" && (
                <div className="space-y-6 max-w-3xl mx-auto">

                  {/* ROW 1: Category Code (left) | Category Name (right) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Category Code</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.category_code}
                          onChange={(e) => setFormData({ ...formData, category_code: e.target.value })}
                          readOnly={!!editingCategory}
                          className="h-11 px-4 rounded-md text-sm w-full outline-none font-mono transition-all duration-200"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                          placeholder="AUTO-GENERATED"
                        />
                        {loadingCode && <span className="absolute right-4 top-1/2 -translate-y-1/2"><Spinner className="w-4 h-4" /></span>}
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{editingCategory ? "Code cannot be changed" : "Automatically generated"}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Category Name <span style={{ color: "var(--danger)" }}>*</span></label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="h-11 px-4 rounded-md text-sm w-full outline-none transition-all duration-200"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                        placeholder="e.g. Smartphones, Laptops, T-Shirts"
                      />
                    </div>
                  </div>

                  {/* ROW 2: Category Type (left) | Parent Category (right) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Category Type <span style={{ color: "var(--danger)" }}>*</span></label>
                      <select
                        value={formData.category_type}
                        onChange={(e) => setFormData({ ...formData, category_type: e.target.value })}
                        required
                        disabled={!!editingCategory}
                        className="h-11 px-4 rounded-md text-sm w-full outline-none appearance-none cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">Select Type</option>
                        {FIXED_CATEGORIES.map((cat) => (<option key={cat.code} value={cat.name}>{cat.name}</option>))}
                      </select>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Determines available attributes</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Parent Category</label>
                      <select
                        value={formData.parent_category_id}
                        onChange={(e) => handleParentChange(e.target.value)}
                        className="h-11 px-4 rounded-md text-sm w-full outline-none appearance-none cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      >
                        <option value="">Root</option>
                        {categories.filter((c) => String(c._id) !== String(editingCategory?._id)).map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Leave empty for Root category</p>
                    </div>
                  </div>

                  {/* ROW 3: Description (full width) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="4"
                      className="px-4 py-3 rounded-md text-sm w-full outline-none resize-none transition-all duration-200"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                      placeholder="Brief description about this category..."
                    />
                  </div>

                  {/* ROW 4: Active toggle (full width) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Status</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === "active" ? "inactive" : "active" })}
                      className="h-11 px-4 rounded-md text-sm w-full outline-none flex items-center justify-between transition-all duration-200"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                    >
                      <span style={{ color: "var(--text-primary)" }}>{formData.status === "active" ? "Active" : "Inactive"}</span>
                      <span
                        className="relative inline-block w-10 h-5 rounded-full transition-colors"
                        style={{ backgroundColor: formData.status === "active" ? "#10b981" : "#6b7280" }}
                      >
                        <span
                          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                          style={{ transform: formData.status === "active" ? "translateX(20px)" : "translateX(0)" }}
                        />
                      </span>
                    </button>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Controls category visibility</p>
                  </div>
                </div>
              )}

              {/* TAB 2: ATTRIBUTES */}
              {activeTab === "attributes" && (
                <div className="space-y-6 max-w-4xl mx-auto">
                  {!formData.category_type ? (
                    <div className="text-center py-16 rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                      <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>Please select a Category Type first</p>
                      <button type="button" onClick={() => setActiveTab("details")} className="text-xs font-bold underline hover:opacity-80" style={{ color: "var(--accent)" }}>Go to Details Tab</button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg p-5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold">Available Attributes for {formData.category_type}</h4>
                          <span className="text-[10px] px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)" }}>{formData.attributes.length} Assigned</span>
                        </div>
                        
                        <div className="flex gap-3 mb-4">
                          <div className="relative flex-1">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                            <input 
                              value={attributeSearch} 
                              onChange={(e) => setAttributeSearch(e.target.value)} 
                              placeholder="Search attributes..." 
                              className="w-full h-10 pl-10 pr-3 rounded-md text-sm outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
                              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} 
                            />
                          </div>
                          <button type="button" onClick={() => { setEditingAttrId(null); setNewAttrForm({ name: "", code: "", data_type: "text", unit: "" }); setShowAddAttrModal(true); }} className="h-10 px-4 rounded-md text-xs font-bold flex items-center gap-1.5 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                            <PlusIcon className="w-3.5 h-3.5" /> Create New
                          </button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                          {filteredAttributes.map((attribute) => {
                            const isSelected = selectedAttributeIds.has(String(attribute._id));
                            return (
                              <button 
                                type="button" 
                                key={attribute._id} 
                                onClick={() => toggleAttribute(attribute)}
                                className={`h-10 px-3 rounded-md text-xs font-medium flex items-center justify-between transition border ${isSelected ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" : "bg-transparent border-transparent hover:bg-white/5"}`}
                              >
                                <span className="truncate">{attribute.name}</span>
                                {isSelected && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {formData.attributes.length > 0 ? (
                        <div className="space-y-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Configured Attributes</h4>
                          {formData.attributes.map((config, index) => {
                            const attribute = availableAttributes.find((item) => String(item._id) === getAttributeId(config));
                            if (!attribute) return null;
                            const uniqueKey = `${getAttributeId(config)}-${index}`;
                            const isDropdown = ["select", "multi_select", "color"].includes(attribute.data_type);

                            return (
                              <div key={uniqueKey} className="rounded-lg p-5 relative group transition-all hover:border-emerald-500/30" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleEditAttribute(attribute); }} className="absolute top-4 right-4 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition opacity-0 group-hover:opacity-100" title="Edit Attribute Definition"><EditIcon className="w-3.5 h-3.5" /></button>

                                <div className="flex items-center gap-3 pr-8">
                                  <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{attribute.name}</p>
                                    <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attribute.code} • {attribute.data_type}</p>
                                  </div>
                                </div>

                                {/* Attribute value/details input — same control as the
                                    previous "Default Value" but framed as the category-level
                                    attribute value that flows into the product form. */}
                                <div className="mt-4">
                                  <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--text-muted)" }}>Attribute Value</label>
                                  {isDropdown ? (
                                    <ProfessionalDropdown
                                      attribute={attribute}
                                      value={config.value}
                                      onChange={(val) => updateAttributeConfig(getAttributeId(config), "value", val)}
                                      onAddNewValue={handleAddAttributeValue}
                                    />
                                  ) : (
                                    <input
                                      type={attribute.data_type === "number" ? "number" : "text"}
                                      value={config.value || ""}
                                      onChange={(e) => updateAttributeConfig(getAttributeId(config), "value", e.target.value)}
                                      placeholder={`e.g. ${attribute.name === "RAM" ? "8GB" : attribute.name === "ROM" ? "128GB" : attribute.name === "Color" || attribute.name === "Colour" ? "Black" : attribute.name}`}
                                      className="w-full h-10 px-3 rounded-md text-sm outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                                      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                    />
                                  )}
                                </div>

                                {/* Toggles */}
                                <div className="grid grid-cols-3 gap-3 mt-4">
                                  <label className="flex items-center gap-2 p-2.5 rounded cursor-pointer transition hover:bg-white/5" style={{ border: "1px solid var(--border-color)" }}>
                                    <input type="checkbox" checked={Boolean(config.is_required)} onChange={(e) => updateAttributeConfig(getAttributeId(config), "is_required", e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
                                    <span className="text-xs font-medium">Required</span>
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded cursor-pointer transition hover:bg-white/5" style={{ border: "1px solid var(--border-color)" }}>
                                    <input type="checkbox" checked={config.is_visible !== false} onChange={(e) => updateAttributeConfig(getAttributeId(config), "is_visible", e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
                                    <span className="text-xs font-medium">Visible</span>
                                  </label>
                                  <label className="flex items-center gap-2 p-2.5 rounded cursor-pointer transition hover:bg-white/5" style={{ border: "1px solid var(--border-color)" }}>
                                    <input type="checkbox" checked={Boolean(config.is_filterable)} onChange={(e) => updateAttributeConfig(getAttributeId(config), "is_filterable", e.target.checked)} className="w-4 h-4 rounded accent-emerald-500" />
                                    <span className="text-xs font-medium">Filterable</span>
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No attributes assigned yet. Select some from above.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Footer Actions - STEPPER LOGIC IMPLEMENTED HERE */}
              <div className="flex items-center justify-between pt-6 mt-8 border-t" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={closeModal} className="h-11 px-6 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                
                <div className="flex gap-3">
                   {/* ✅ LOGIC: Only show "Next" button on Details tab */}
                   {activeTab === "details" && (
                     <button type="button" onClick={() => setActiveTab("attributes")} className="h-11 px-8 rounded-md text-sm font-bold transition hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                       Next: Attributes <ChevronRightIcon className="w-4 h-4" />
                     </button>
                   )}

                   {/* ✅ LOGIC: Only show "Back" and "Submit" buttons on Attributes tab */}
                   {activeTab === "attributes" && (
                     <>
                       <button type="button" onClick={() => setActiveTab("details")} className="h-11 px-6 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                         Back to Details
                       </button>
                       <button type="submit" disabled={isSubmitting || loadingCode} className="h-11 px-8 rounded-md text-sm font-bold transition disabled:opacity-50 hover:opacity-90 shadow-lg shadow-emerald-500/20" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                         {isSubmitting ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                       </button>
                     </>
                   )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Attribute Modal */}
      {showAddAttrModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl border border-gray-700" style={{backgroundColor: "var(--bg-card)"}}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-bold text-white">{editingAttrId ? "Edit Attribute" : "Quick Add Attribute"}</h3>
              <button onClick={() => { setShowAddAttrModal(false); setEditingAttrId(null); }} className="text-gray-400 hover:text-white transition"><CloseIcon /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Name *</label><input autoFocus required value={newAttrForm.name} onChange={e => setNewAttrForm({...newAttrForm, name: e.target.value})} className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition" style={inputStyle} placeholder="e.g. RAM" /></div>
                <div><label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Code *</label><input required value={newAttrForm.code} onChange={e => setNewAttrForm({...newAttrForm, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} className="w-full h-10 px-3 rounded-lg text-sm outline-none font-mono focus:ring-2 focus:ring-emerald-500/50 transition" style={inputStyle} placeholder="e.g. ram" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Type</label><select value={newAttrForm.data_type} onChange={e => setNewAttrForm({...newAttrForm, data_type: e.target.value})} className="w-full h-10 px-3 rounded-lg text-sm outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/50 transition appearance-none" style={inputStyle}><option value="text">Text</option><option value="number">Number</option><option value="select">Select</option><option value="multi_select">Multi Select</option><option value="color">Color</option><option value="boolean">Boolean</option></select></div>
                <div><label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Unit</label><input value={newAttrForm.unit} onChange={e => setNewAttrForm({...newAttrForm, unit: e.target.value})} className="w-full h-10 px-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 transition" style={inputStyle} placeholder="Optional" /></div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setShowAddAttrModal(false); setEditingAttrId(null); }} className="flex-1 h-10 rounded-lg border border-gray-600 text-xs font-semibold hover:bg-white/5 transition text-gray-300">Cancel</button>
                <button type="button" disabled={createOrUpdateAttrMutation.isPending || !newAttrForm.name || !newAttrForm.code} onClick={() => createOrUpdateAttrMutation.mutate({ id: editingAttrId, data: newAttrForm })} className="flex-1 h-10 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5">{createOrUpdateAttrMutation.isPending ? <><Spinner className="w-3 h-3" /> Saving...</> : (editingAttrId ? "Update Attribute" : "Create & Assign")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full max-w-sm rounded-xl p-6" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}><svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <div className="flex-1 min-w-0"><h3 className="text-sm font-semibold">{deleteTarget.categories.length === 1 ? `Delete "${deleteTarget.categories[0].name}"?` : `Delete ${deleteTarget.categories.length} categories?`}</h3><p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The category(ies) will be permanently removed.</p></div>
            </div>
            <div className="flex items-center gap-3 mt-5 p-3 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><FolderIcon className="w-4 h-4" /></div>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{deleteTarget.categories[0].name}</p><p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{deleteTarget.categories.length === 1 ? deleteTarget.categories[0].category_code || "—" : `+ ${deleteTarget.categories.length - 1} more`}</p></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 h-10 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>{isDeleting ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}