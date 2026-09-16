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

function sanitizeOptionLabels(raw) {
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
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: active ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
        color: active ? "#34d399" : "#ef4444",
        border: `1px solid ${active ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
      }}
    >
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
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: primary ? "var(--accent)" : "transparent",
        color: primary ? "white" : danger ? "var(--danger)" : "var(--text-secondary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,0.25)" : "1px solid var(--border-color)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-0" style={{ borderColor: "var(--border-color)" }}>
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function AttributePill({ label }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium"
      style={{ backgroundColor: "rgba(139,92,246,0.10)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.20)" }}
    >
      {label}
    </span>
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
   MAIN PAGE
========================================================= */

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();

  const categoryId = getId(params?.id);
  const backPath = "/admin/categories";

  const [tab, setTab] = useState("overview");
  const [showDelete, setShowDelete] = useState(false);
  const [attrToToggle, setAttrToToggle] = useState(null);
  
  // ✅ NEW: Edit Modal States (same as main page)
  const [showEditModal, setShowEditModal] = useState(false);

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
    if (!category) return "Root Category";
    const parentId = getId(category.parent_category_id);
    if (!parentId) return "Root Category";
    if (category.parent_category_id && typeof category.parent_category_id === "object") {
      return category.parent_category_id.name || "Root Category";
    }
    const found = allCategories.find((item) => String(item._id) === String(parentId));
    return found?.name || "Root Category";
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

  const handleToggleAttributeActive = async (attr) => {
    if (!attr) return;
    const attrId = getAttributeId(attr);
    const currentActive = attr.is_active !== false;
    try {
      await categoryApi.updateAttributes(attrId, { is_active: !currentActive });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] }),
        queryClient.invalidateQueries({ queryKey: ["category", categoryId] }),
      ]);
      toast.success(currentActive ? "Attribute disabled" : "Attribute enabled");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update attribute status");
    }
    setAttrToToggle(null);
  };

  // Loading state
  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5 text-[var(--accent)]" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading category details...
          </span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="p-8 text-center max-w-sm rounded-xl" style={cardStyle}>
          <h2 className="text-lg font-semibold mb-2 text-[var(--text-primary)]">Category Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>
            Back to Categories
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-5 pb-10" style={{ color: "var(--text-primary)" }}>

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] transition-all shrink-0 mt-1"
          >
            <Ico d={D.back} className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[24px] leading-7 font-bold tracking-tight">{category.name}</h1>
              <StatusBadge active={category.is_active !== false} />
            </div>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              {category.description || "No description provided"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setShowEditModal(true)} icon={<Ico d={D.edit} className="w-4 h-4" />}>
  Edit
</Button>
          <Button
            danger
            onClick={() => setShowDelete(true)}
            icon={<Ico d={D.trash} className="w-4 h-4" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 border-b" style={{ borderColor: "var(--border-color)" }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "attributes", label: "Attributes", count: categoryAttributes.length },
          { id: "history", label: "History" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative py-3 text-[13px] font-medium transition-colors outline-none"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {item.label}
              {item.count !== undefined && (
                <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  ({item.count})
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-3 bg-[var(--bg-tertiary)]/30">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20">
                  <Ico d={D.folder} className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Category Details</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Basic information and metadata</p>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Name</p>
                      <p className="text-[14px] font-medium text-[var(--text-primary)]">{category.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Category Code</p>
                      <p className="text-[14px] font-mono text-[var(--text-secondary)]">{category.category_code || category.slug || "\u2014"}</p>
                    </div>
                  </div>
                  {category.description && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Description</p>
                      <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">{category.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-[var(--border-color)]">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Created At</p>
                      <p className="text-[14px] text-[var(--text-secondary)]">{formatDateTime(category.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Updated At</p>
                      <p className="text-[14px] text-[var(--text-secondary)]">{formatDateTime(category.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Summary</h3>
              </div>
              <div className="p-5 space-y-1">
                <StatRow label="Total Attributes" value={categoryAttributes.length} />
                <StatRow label="Parent Category" value={parentCategoryName} />
                <StatRow label="Status" value={<StatusBadge active={category.is_active !== false} />} />
              </div>
            </div>

            {variantAttributes.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={cardStyle}>
                <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Variant Attributes</h3>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap gap-2">
                    {variantAttributes.map((attr) => (
                      <AttributePill key={attr._id} label={attr.name} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="rounded-xl overflow-hidden" style={cardStyle}>
              <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Attributes Preview</h3>
              </div>
              <div className="p-5">
                {categoryAttributes.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-[var(--border-color)] rounded-lg bg-[var(--bg-primary)]/30">
                    <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No attributes assigned yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {categoryAttributes.slice(0, 5).map((attr) => (
                      <div key={attr._id} className="p-3 rounded-lg border bg-[var(--bg-input)]" style={{ borderColor: "var(--border-color)" }}>
                        <p className="text-[13px] font-medium mb-1 truncate text-[var(--text-primary)]">{attr.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{getDataTypeLabel(attr.data_type)}</p>
                      </div>
                    ))}
                    {categoryAttributes.length > 5 && (
                      <div className="p-3 rounded-lg border flex items-center justify-center bg-[var(--bg-input)]" style={{ borderColor: "var(--border-color)", borderStyle: "dashed" }}>
                        <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>+{categoryAttributes.length - 5} more</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                Assigned attributes for {category.name} category
              </p>
            </div>
            <div className="flex items-center gap-2">
              {variantAttributes.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
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
            <div className="rounded-xl py-12 flex flex-col items-center justify-center gap-3" style={cardStyle}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
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
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Attribute</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Data Type</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Assigned Options</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider text-right">Action</th>
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
                          className="transition-colors hover:bg-[var(--bg-tertiary)]/30"
                          style={{ borderBottom: idx < categoryAttributes.length - 1 ? "1px solid var(--border-color)" : "none", opacity: isActive ? 1 : 0.5 }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>
                                <Ico d={D.box} className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{attr.name}</p>
                                  {isVariant && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                      </svg>
                                      Variant
                                    </span>
                                  )}
                                  {!isActive && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                                      Disabled
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider" style={getDataTypeBadgeStyle(attr.data_type)}>
                              {getDataTypeLabel(attr.data_type)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
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
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: boolValue === "Yes" ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)", color: boolValue === "Yes" ? "#34d399" : "#9ca3af", border: `1px solid ${boolValue === "Yes" ? "rgba(16,185,129,0.2)" : "rgba(107,114,128,0.2)"}` }}>
                                  {boolValue}
                                </span>
                              ) : (
                                <span className="text-[10px] italic" style={{ color: "var(--text-muted)" }}>Not set</span>
                              )
                            ) : (
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>\u2014</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => router.push(`/admin/attributes/${getAttributeId(attr)}/edit`)}
                                className="h-7 px-3 text-[10px] font-semibold flex items-center justify-center gap-1 rounded-md transition-colors"
                                style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                              >
                                <Ico d={D.edit} className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isActive) {
                                    setAttrToToggle(attr);
                                  } else {
                                    handleToggleAttributeActive(attr);
                                  }
                                }}
                                className="h-7 px-3 text-[10px] font-semibold flex items-center justify-center gap-1 rounded-md transition-colors"
                                style={{ color: isActive ? "#f87171" : "#34d399", backgroundColor: "var(--bg-card)", border: `1px solid ${isActive ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}` }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = isActive ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.5)"; e.currentTarget.style.backgroundColor = isActive ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = isActive ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"; e.currentTarget.style.backgroundColor = "var(--bg-card)"; }}
                              >
                                {isActive ? (
                                  <><Ico d={"M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"} className="w-3 h-3" /> Disable</>
                                ) : (
                                  <><Ico d={"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} className="w-3 h-3" /> Enable</>
                                )}
                              </button>
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

      {/* HISTORY TAB */}
      {tab === "history" && (
        <div className="rounded-xl overflow-hidden" style={cardStyle}>
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Activity History</h3>
          </div>
          <div className="p-6">
            <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-color)]">
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-emerald-500 shadow-sm" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Created</p>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Initial category setup and configuration.</p>
                  </div>
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{formatDateTime(category.created_at)}</span>
                </div>
              </div>
              {category.updated_at && category.updated_at !== category.created_at && (
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-blue-500 shadow-sm" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">Category Updated</p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Category details or attributes were modified.</p>
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
          <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.10)", color: "var(--danger)" }}>
                <Ico d={D.trash} className="w-5 h-5" />
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
                icon={deleteMutation.isPending ? <Spin className="w-4 h-4" /> : null}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
           {/* EDIT CATEGORY MODAL - EXACT SAME AS MAIN PAGE */}
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
      {/* TOGGLE ATTRIBUTE STATUS MODAL */}
      {attrToToggle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: attrToToggle.is_active !== false ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.10)", color: attrToToggle.is_active !== false ? "var(--danger)" : "var(--success)" }}
              >
                {attrToToggle.is_active !== false ? (
                  <Ico d={"M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"} className="w-5 h-5" />
                ) : (
                  <Ico d={"M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                  {attrToToggle.is_active !== false ? "Disable Attribute?" : "Enable Attribute?"}
                </h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {attrToToggle.is_active !== false ? (
                    <>Are you sure you want to disable <span className="font-medium text-[var(--text-primary)]">{attrToToggle.name}</span>? It will be hidden from product forms until re-enabled.</>
                  ) : (
                    <>Are you sure you want to enable <span className="font-medium text-[var(--text-primary)]">{attrToToggle.name}</span>? It will become available for product forms.</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setAttrToToggle(null)}>Cancel</Button>
              <Button
                danger={attrToToggle.is_active !== false}
                primary={attrToToggle.is_active === false}
                onClick={() => handleToggleAttributeActive(attrToToggle)}
              >
                {attrToToggle.is_active !== false ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </div>
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
  const selectedParentName = formData.parent_category_id ? allCategories.find((c) => String(c._id) === String(formData.parent_category_id))?.name || "Root Category" : "Root Category";

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
            <button type="button" onClick={() => { setFormData({ ...formData, parent_category_id: "" }); setShowParentDropdown(false); }} className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${!formData.parent_category_id ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`}><span>Root Category</span>{!formData.parent_category_id && <Ico d={D.check} className="w-3.5 h-3.5 text-[var(--accent)]" />}</button>
            {hierarchicalCategories.map((cat) => (<button key={cat._id} type="button" onClick={() => { setFormData({ ...formData, parent_category_id: cat._id }); setShowParentDropdown(false); }} className={`w-full px-3 py-2 text-[12px] text-left flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors ${String(formData.parent_category_id) === String(cat._id) ? "bg-[var(--accent-soft)]/30 text-[var(--accent)]" : "text-[var(--text-primary)]"}`} style={{ paddingLeft: `${12 + cat.depth * 16}px` }}><span className="truncate">{cat.name}</span>{String(formData.parent_category_id) === String(cat._id) && <Ico d={D.check} className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}</button>))}
          </div>
        </div>
      </>, document.body)}

      {showAttrSelectModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "min(640px, 80vh)" }}>
            <div className="px-5 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between shrink-0"><div><h3 className="text-[13px] font-bold text-[var(--text-primary)]">Select Attributes</h3><p className="text-[11px] text-[var(--text-muted)] mt-0.5">Select attributes to use for products in this category.</p></div><button type="button" onClick={() => { setShowAttrSelectModal(false); setShowCreateAttrModal(false); setAttrSearch(""); }} className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors shrink-0"><Ico d={D.close} className="w-3.5 h-3.5" /></button></div>
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