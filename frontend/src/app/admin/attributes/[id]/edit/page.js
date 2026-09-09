"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { attributeApi } from "@/apis/admin/attributeApi";
import { adminCategoryApi } from "@/apis/admin/categoryApi";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";

/* ================= ICONS ================= */
const Icons = {
  ArrowLeft: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
  Layers: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  Folder: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  Sliders: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  Text: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 4h7" />
    </svg>
  ),
  Hash: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  ),
  Filter: ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1.994 1.994 0 013 6.586V4z" />
    </svg>
  ),
};

/* ================= MAIN EDIT PAGE ================= */
export default function AttributeEditPage() {
  useAttributeSocketSync();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const attributeId = params?.id;

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    data_type: "multi_select",
    is_active: true,
    boolean_value: false,
  });

  const [values, setValues] = useState([]);
  const [newOption, setNewOption] = useState("");
  const [assignedCategoryIds, setAssignedCategoryIds] = useState([]);
  const [hasLoadedAssignments, setHasLoadedAssignments] = useState(false);

  /* ---------- QUERIES ---------- */
  const { data: attribute, isLoading: isLoadingAttribute } = useQuery({
    queryKey: ["attribute", attributeId],
    queryFn: () => attributeApi.getById(attributeId),
    enabled: !!attributeId,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: adminCategoryApi.getAllAdmin,
  });

  const { data: assignedCategories = [], isLoading: isLoadingAssigned } = useQuery({
    queryKey: ["attribute-categories", attributeId],
    queryFn: () => attributeApi.getCategories(attributeId),
    enabled: !!attributeId,
  });

  /* ---------- POPULATE FORM ---------- */
  useEffect(() => {
    if (!attribute) return;
    const dataType = attribute.data_type || "multi_select";
    let booleanValue = false;
    if (dataType === "boolean") {
      const vals = attribute.values || [];
      const trueEntry = vals.find((v) => v.value === "true");
      const falseEntry = vals.find((v) => v.value === "false");
      if (trueEntry) booleanValue = true;
      else if (falseEntry) booleanValue = false;
      else booleanValue = false;
    }
    setFormData({
      name: attribute.name || "",
      code: attribute.code || "",
      data_type: dataType,
      is_active: attribute.is_active !== false,
      boolean_value: booleanValue,
    });
    setValues(
      (attribute.values || []).map((v) => ({
        _id: v._id,
        label: v.label || v.value || "",
        value: v.value || v.label || "",
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active !== false,
      }))
    );
  }, [attribute]);

  useEffect(() => {
    if (assignedCategories.length > 0 && !hasLoadedAssignments) {
      setAssignedCategoryIds(assignedCategories.map((c) => String(c._id)));
      setHasLoadedAssignments(true);
    }
  }, [assignedCategories, hasLoadedAssignments]);

  /* ---------- SAVE MUTATIONS ---------- */
  const saveAttributeMutation = useMutation({
    mutationFn: (data) => attributeApi.update(attributeId, data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attribute", attributeId] }),
        queryClient.invalidateQueries({ queryKey: ["attributes"] }),
        queryClient.invalidateQueries({ queryKey: ["attribute-categories", attributeId] }),
      ]);
      toast.success("Attribute updated successfully");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: (categoryIds) => attributeApi.updateCategories(attributeId, categoryIds),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attribute", attributeId] }),
        queryClient.invalidateQueries({ queryKey: ["attributes"] }),
        queryClient.invalidateQueries({ queryKey: ["attribute-categories", attributeId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-categories"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
      toast.success("Category assignments updated");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  const saveOptionsMutation = useMutation({
    mutationFn: (newValues) => attributeApi.update(attributeId, { values: newValues }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["attribute", attributeId] }),
        queryClient.invalidateQueries({ queryKey: ["attributes"] }),
      ]);
      toast.success("Options updated successfully");
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || "Update failed"),
  });

  /* ---------- HANDLERS ---------- */
  const handleSaveAll = async () => {
    if (!formData.name.trim()) {
      toast.error("Attribute name is required");
      return;
    }

    try {
      await saveAttributeMutation.mutateAsync({
        name: formData.name.trim(),
        data_type: formData.data_type,
        is_active: formData.is_active,
      });

      await saveCategoriesMutation.mutateAsync(assignedCategoryIds);

      let valuesToSave;
      if (formData.data_type === "boolean") {
        const boolLabel = formData.boolean_value ? "Yes" : "No";
        const boolVal = formData.boolean_value ? "true" : "false";
        valuesToSave = [{ label: boolLabel, value: boolVal, sort_order: 0, is_active: true }];
      } else {
        valuesToSave = values.map((v, i) => ({
          _id: v._id || undefined,
          label: v.label,
          value: v.value,
          sort_order: i,
          is_active: v.is_active,
        }));
      }
      await saveOptionsMutation.mutateAsync(valuesToSave);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;

    const exists = values.some(
      (v) => v.label.toLowerCase() === trimmed.toLowerCase() || v.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      toast.error("Option already exists");
      return;
    }

    const newValues = [
      ...values,
      {
        label: trimmed,
        value: trimmed,
        sort_order: values.length,
        is_active: true,
      },
    ];
    setValues(newValues);
    setNewOption("");
  };

  const handleRemoveOption = (index) => {
    const newValues = values.filter((_, i) => i !== index);
    setValues(newValues);
  };

  const handleToggleOptionActive = (index) => {
    setValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, is_active: !v.is_active } : v))
    );
  };

  const handleToggleCategory = (catId) => {
    setAssignedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleToggleAllCategories = () => {
    if (assignedCategoryIds.length === allCategories.length) {
      setAssignedCategoryIds([]);
    } else {
      setAssignedCategoryIds(allCategories.map((c) => String(c._id)));
    }
  };

  const isSaving = saveAttributeMutation.isPending || saveCategoriesMutation.isPending || saveOptionsMutation.isPending;

  /* ---------- LOADING ---------- */
  if (isLoadingAttribute) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icons.Spinner className="w-7 h-7 text-[var(--accent)]" />
          <p className="text-xs text-[var(--text-muted)]">Loading attribute details...</p>
        </div>
      </div>
    );
  }

  if (!attribute) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--text-muted)]">Attribute not found</p>
          <button
            onClick={() => router.push("/admin/attributes")}
            className="h-9 px-4 text-[13px] font-medium text-white bg-[var(--accent)] rounded-lg"
          >
            Back to Attributes
          </button>
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
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all"
          >
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div className="leading-tight">
            <h1 className="text-[24px] leading-7 font-bold tracking-tight text-[var(--text-primary)]">
              Edit Attribute
            </h1>
            <p className="text-[13px] mt-1 text-[var(--text-muted)]">
              Configure attribute properties and assignments
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 px-4 text-[13px] font-medium text-[var(--text-secondary)] bg-transparent border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="h-9 px-4 text-[13px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Icons.Spinner className="w-4 h-4" /> : <Icons.Check className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">

        {/* LEFT: ATTRIBUTE DETAILS */}
        <section className="rounded-lg overflow-hidden flex flex-col" style={cardStyle}>
          <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
              <Icons.Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Attribute Details</h2>
              <p className="text-[10px] text-[var(--text-muted)]">Basic attribute configuration</p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Attribute Name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-[42px] px-4 text-sm outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                placeholder="e.g. RAM, Color, Size"
              />
            </div>

            {/* Code (read-only) */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Code
              </label>
              <input
                type="text"
                value={formData.code}
                readOnly
                className="w-full h-[42px] px-4 text-sm font-mono outline-none rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-secondary)] cursor-not-allowed"
              />
            </div>

            {/* Data Type - Read Only */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Data Type
              </label>
              <div className="w-full h-[42px] px-4 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-primary)] flex items-center gap-2 cursor-not-allowed">
                <span className="flex items-center gap-2">
                  {formData.data_type === "boolean" ? (
                    <Icons.Check className="w-4 h-4 text-[var(--accent)]" />
                  ) : (
                    <Icons.Filter className="w-4 h-4 text-[var(--accent)]" />
                  )}
                  <span className="truncate">{formData.data_type === "boolean" ? "Boolean" : "Multi Select"}</span>
                </span>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] shrink-0">Locked</span>
              </div>
            </div>

            {/* Boolean Value Field */}
            {formData.data_type === "boolean" && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Boolean Value
                </label>
                <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                  {[{ id: true, label: "Yes" }, { id: false, label: "No" }].map((opt) => {
                    const isActive = formData.boolean_value === opt.id;
                    return (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => setFormData({ ...formData, boolean_value: opt.id })}
                        className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${
                          isActive
                            ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full transition-colors ${
                            isActive ? (opt.id ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"
                          }`}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">Toggle to switch between Yes and No.</p>
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Status
              </label>
              <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] overflow-hidden p-1">
                {[
                  { id: true, label: "Active" },
                  { id: false, label: "Inactive" },
                ].map((opt) => {
                  const isActive = formData.is_active === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setFormData({ ...formData, is_active: opt.id })}
                      className={`flex-1 h-9 text-xs font-medium flex items-center justify-center gap-2 rounded-md transition-all ${
                        isActive
                          ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full transition-colors ${
                          isActive ? (opt.id ? "bg-[var(--success)]" : "bg-[var(--text-muted)]") : "bg-transparent"
                        }`}
                      />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT TOP: ASSIGNED CATEGORIES */}
        <section className="rounded-lg overflow-hidden flex flex-col" style={cardStyle}>
          <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
              <Icons.Folder className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Assigned Categories</h2>
              <p className="text-[10px] text-[var(--text-muted)]">
                {assignedCategoryIds.length} of {allCategories.length} selected
              </p>
            </div>
            {allCategories.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAllCategories}
                className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
              >
                {assignedCategoryIds.length === allCategories.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>

          <div className="p-5">
            {allCategories.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No categories found</p>
            ) : (
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto scrollbar-thin">
                {allCategories.map((cat) => {
                  const isChecked = assignedCategoryIds.includes(String(cat._id));
                  return (
                    <label
                      key={cat._id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[var(--accent-soft)]/50 border border-[var(--accent)]/20"
                          : "hover:bg-[var(--bg-tertiary)] border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCategory(String(cat._id))}
                        className="w-4 h-4 rounded cursor-pointer shrink-0"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-medium block truncate">{cat.name}</span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                          {cat.category_code || "—"} {cat.category_type ? `(${cat.category_type})` : ""}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT BOTTOM: ATTRIBUTE OPTIONS */}
        {(formData.data_type === "multi_select") && (
          <section className="rounded-lg overflow-hidden flex flex-col xl:col-span-2" style={cardStyle}>
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                <Icons.Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">Attribute Options</h2>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {values.length} option{values.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Add new option */}
              <div className="flex gap-2">
                <input
                  type={formData.data_type === "number" ? "number" : "text"}
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddOption(); } }}
                  className="flex-1 min-w-0 h-[38px] px-3 text-sm outline-none bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-soft)] transition-colors"
                  placeholder={formData.data_type === "number" ? "Enter number (e.g. 128, 256)" : formData.data_type === "text" ? "Enter value (e.g. Black, Red, Blue)" : "Add a new option (e.g. 8 GB, Red, Large)"}
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  disabled={!newOption.trim()}
                  className="h-[38px] px-4 text-[11px] font-semibold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icons.Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              {/* Options list */}
              {values.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {values.map((opt, index) => (
                    <div
                      key={opt._id || `opt-${index}`}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors ${
                        opt.is_active
                          ? "bg-[var(--bg-input)] border-[var(--border-color)]"
                          : "bg-[var(--bg-tertiary)] border-[var(--border-color)] opacity-60"
                      }`}
                    >
                      <span
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[10px] font-bold border"
                        style={{
                          backgroundColor: "var(--accent-soft)",
                          color: "var(--accent)",
                          borderColor: "var(--accent)",
                          borderWidth: "0.5px",
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className={`flex-1 min-w-0 text-xs truncate ${opt.is_active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}`}>
                        {opt.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleOptionActive(index)}
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        title={opt.is_active ? "Deactivate" : "Activate"}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {opt.is_active ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          )}
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        aria-label={`Remove ${opt.label}`}
                      >
                        <Icons.X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--bg-primary)]/30 text-center">
                  <Icons.Layers className="w-8 h-8 mb-2" style={{ color: "var(--text-muted)" }} />
                  <p className="text-xs text-[var(--text-muted)]">No options yet. Add one above.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
