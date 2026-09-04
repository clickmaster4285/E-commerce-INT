"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import { useSocket } from "@/hooks/useSocket";
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
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function StatusBadge({ active = true }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(16,185,129,0.10)",
        color: "#10b981",
        border: "1px solid rgba(16,185,129,0.20)",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button", icon }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: primary
          ? "var(--accent)"
          : danger
          ? "rgba(239,68,68,0.08)"
          : "var(--bg-tertiary)",
        color: primary
          ? "var(--accent-text)"
          : danger
          ? "var(--danger)"
          : "var(--text-primary)",
        border: primary
          ? "none"
          : danger
          ? "1px solid rgba(239,68,68,0.25)"
          : "1px solid var(--border-color)",
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

function AttributePill({ label }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium"
      style={{
        backgroundColor: "rgba(139,92,246,0.10)",
        color: "#8b5cf6",
        border: "1px solid rgba(139,92,246,0.20)",
      }}
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
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();

  const categoryId = getId(params?.id);
  const { socket } = useSocket();
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/categories";

  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    parent_category_id: "",
    sort_order: 0,
  });

  useAttributeSocketSync();

  // Queries
  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  const { data: category, isLoading: loading, isError } = useQuery({
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

  const totalVariantAttrs = variantAttributes.length;

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
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowEdit(false);
      toast.success("Category updated successfully");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to update category");
    },
  });

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

  // Handlers
  function openEdit() {
    if (!category) return;
    setForm({
      name: category.name || "",
      slug: category.slug || category.category_code || "",
      description: category.description || "",
      parent_category_id: getId(category.parent_category_id) || "",
      sort_order: category.sort_order ?? 0,
    });
    setShowEdit(true);
  }

  function submitEdit(e) {
    e.preventDefault();
    updateMutation.mutate({
      id: categoryId,
      data: {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        parent_category_id: getId(form.parent_category_id) || null,
        sort_order: Number(form.sort_order) || 0,
      },
    });
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />
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
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Category Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>
            Back to Categories
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full pb-8" style={{ color: "var(--text-primary)" }}>
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => router.push(backPath)}
              className="font-medium transition hover:text-[var(--accent)]"
              style={{ color: "var(--text-muted)" }}
            >
              Back to Category Types
            </button>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight">{category.name}</h1>
                <StatusBadge active={true} />
              </div>
              <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                {category.description || "No description provided"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={openEdit} icon={<Ico d={D.edit} className="w-4 h-4" />}>
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
                className="relative py-3 text-[13px] font-medium transition-colors"
                style={{
                  color: active ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    ({item.count})
                  </span>
                )}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: "var(--accent)" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT - Category Type Information */}
            <div className="lg:col-span-2">
              <Card>
                <div className="p-6">
                  <h3 className="text-[15px] font-semibold mb-5">Category Type Information</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Name</p>
                        <p className="text-[14px] font-medium">{category.name}</p>
                      </div>
                      <div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Category Code</p>
                        <p className="text-[14px] font-mono">{category.category_code || category.slug || "—"}</p>
                      </div>
                    </div>

                    {category.description && (
                      <div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</p>
                        <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
                          {category.description}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</p>
                      <StatusBadge active={true} />
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
                      <div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Created At</p>
                        <p className="text-[14px]">{formatDateTime(category.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-[12px] mb-1.5" style={{ color: "var(--text-secondary)" }}>Updated At</p>
                        <p className="text-[14px]">{formatDateTime(category.updated_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* RIGHT - Summary */}
            <div className="space-y-4">
              <Card>
                <div className="p-6">
                  <h3 className="text-[15px] font-semibold mb-4">Summary</h3>
                  
                  <div className="space-y-0">
                    <StatRow label="Total Attributes" value={categoryAttributes.length} />
                    <StatRow label="Root Category" value={parentCategoryName} />
                  </div>
                </div>
              </Card>

              {/* Variant Attributes */}
              {variantAttributes.length > 0 && (
                <Card>
                  <div className="p-4">
                    <h3 className="text-[13px] font-semibold mb-2.5">Variant Attributes</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {variantAttributes.map((attr) => (
                        <AttributePill key={attr._id} label={attr.name} />
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Attributes Preview */}
            <div className="lg:col-span-3">
              <Card>
                <div className="p-6">
                  <h3 className="text-[15px] font-semibold mb-5">Attributes Preview</h3>
                  {categoryAttributes.length === 0 ? (
                    <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      No attributes assigned yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {categoryAttributes.slice(0, 5).map((attr) => (
                        <div
                          key={attr._id}
                          className="p-4 rounded-lg border"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-color)",
                          }}
                        >
                          <p className="text-[13px] font-medium mb-1">{attr.name}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            {attr.data_type || "Text"}
                          </p>
                        </div>
                      ))}
                      {categoryAttributes.length > 5 && (
                        <div
                          className="p-4 rounded-lg border flex items-center justify-center"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            borderColor: "var(--border-color)",
                            borderStyle: "dashed",
                          }}
                        >
                          <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                            +{categoryAttributes.length - 5} more
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ATTRIBUTES TAB */}
        {tab === "attributes" && (
          <Card>
            <div className="p-6">
              <h3 className="text-[14px] font-semibold mb-4">Category Attributes</h3>
              {categoryAttributes.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  No attributes assigned yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {categoryAttributes.map((attr) => (
                    <div
                      key={attr._id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div>
                        <p className="text-[13px] font-medium">{attr.name}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {attr.code} • {attr.data_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {attr.category_config?.is_required && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{
                            backgroundColor: "rgba(239,68,68,0.10)",
                            color: "var(--danger)",
                          }}>
                            Required
                          </span>
                        )}
                        {attr.category_config?.is_variant_option && (
                          <span className="text-[10px] px-2 py-0.5 rounded" style={{
                            backgroundColor: "rgba(139,92,246,0.10)",
                            color: "#8b5cf6",
                          }}>
                            Variant
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <Card>
            <div className="p-6">
              <h3 className="text-[14px] font-semibold mb-6">Activity History</h3>
              <div className="space-y-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-color)]">
                
                {/* Created Event */}
                <div className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-emerald-500" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <p className="text-[13px] font-medium">Category Created</p>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                        Initial category setup and configuration.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                      {formatDateTime(category.created_at)}
                    </span>
                  </div>
                </div>

                {/* Updated Event */}
                {category.updated_at && category.updated_at !== category.created_at && (
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-card)] bg-blue-500" />
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div>
                        <p className="text-[13px] font-medium">Category Updated</p>
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                          Category details or attributes were modified.
                        </p>
                      </div>
                      <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                        {formatDateTime(category.updated_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-xl overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-[14px] font-semibold">Edit Category</h2>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Update category information
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
              >
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Name *
                </label>
                <input
                  value={form.name}
                  required
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg text-[13px] outline-none"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Slug
                </label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg text-[13px] outline-none font-mono"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none resize-none"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <Button onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button
                  primary
                  type="submit"
                  disabled={updateMutation.isPending}
                  icon={updateMutation.isPending ? <Spin className="w-4 h-4" /> : <Ico d={D.check} className="w-4 h-4" />}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.10)", color: "var(--danger)" }}
              >
                <Ico d={D.trash} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold mb-1">Delete Category?</h3>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span className="font-medium" style={{ color: "var(--text-primary)" }}>{category.name}</span>? This action cannot be undone.
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
    </div>
  );
}