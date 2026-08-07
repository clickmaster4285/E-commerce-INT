"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryApi } from "@/apis/categoryApi";
import { toast } from "sonner";

import {
  ArrowLeft,
  FolderOpen,
  Hash,
  FileText,
  Activity,
  CalendarDays,
  User,
  Clock,
  Package,
  Database,
  Layers3,
  Pencil,
  X,
} from "lucide-react";

export default function CategoryDetailPage({ params }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState("overview");
  
  // ✅ Edit Modal States
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category_code: "",
    name: "",
    description: "",
  });

  const {
    data: category,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["category", id],
    queryFn: () => categoryApi.getById(id),
    enabled: !!id,
  });

  // ✅ Update Mutation
  const categoryMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated successfully");
      setShowModal(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Category update failed");
    },
  });

  // ✅ Handle Edit Click
  const handleEdit = () => {
    if (!category) return;
    setFormData({
      category_code: category.category_code || "",
      name: category.name || "",
      description: category.description || "",
    });
    setShowModal(true);
  };

  // ✅ Handle Form Submit
  const handleSubmit = (event) => {
    event.preventDefault();
    categoryMutation.mutate({
      id: category._id,
      data: {
        category_code: formData.category_code,
        name: formData.name.trim(),
        description: formData.description.trim(),
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "var(--accent)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  if (isError || !category) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <p style={{ color: "var(--danger)" }}>Category not found</p>
        <button
          onClick={() => router.push("/admin/categories")}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
          }}
        >
          Back to Categories
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-2" style={{ color: "var(--text-primary)" }}>
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-2 transition hover:scale-105"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Category Details</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            View category information, hierarchy, and activity
          </p>
        </div>
      </div>

      {/* TOP SUMMARY CARD */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-text)",
              }}
            >
              <FolderOpen className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{category.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span
                  className="text-sm font-mono px-2 py-0.5 rounded"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent)" }}
                >
                  {category.category_code}
                </span>
              </div>
            </div>
          </div>
          
          {/* ✅ Edit Button Added Here */}
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition hover:scale-105"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit Category
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div
        className="flex gap-1 rounded-xl p-1 overflow-x-auto"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Package className="h-4 w-4" /> Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition whitespace-nowrap ${
            activeTab === "activity"
              ? "bg-emerald-600 text-white"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Activity className="h-4 w-4" /> Activity
        </button>
      </div>

      {/* CONTENT CARD */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Category Information */}
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FolderOpen className="h-5 w-5" style={{ color: "var(--accent)" }} />
                Category Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Category Name</span>
                  <span className="text-sm font-semibold text-right">{category.name}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Category Code</span>
                  <span className="text-sm font-mono font-semibold text-right" style={{ color: "var(--accent)" }}>{category.category_code}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Sort Order</span>
                  <span className="text-sm font-semibold text-right">{category.sort_order || 0}</span>
                </div>
                <div className="py-3">
                  <span className="text-sm" style={{ color: "var(--text-muted)" }}>Description</span>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {category.description || "No description available."}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: System Metadata */}
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Database className="h-5 w-5" style={{ color: "var(--accent)" }} />
                System Metadata
              </h3>
              <div className="grid grid-cols-1 mt-5 gap-3">
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Created By</span>
                  <span className="text-sm font-semibold">{category.createdby?.email || category.createdby?.name || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Updated By</span>
                  <span className="text-sm font-semibold">{category.updatedby?.email || category.updatedby?.name || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Created At</span>
                  <span className="text-sm font-semibold">
                    {category.created_at ? new Date(category.created_at).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2.5 px-3 rounded-lg" style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <span className="text-xs font-medium uppercase" style={{ color: "var(--text-muted)" }}>Updated At</span>
                  <span className="text-sm font-semibold">
                    {category.updated_at ? new Date(category.updated_at).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Activity Log</h2>
              <p style={{ color: "var(--text-muted)" }}>Track all changes and updates made to this category</p>
            </div>

            <div className="relative space-y-6">
              {/* Timeline Line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5" style={{ backgroundColor: "var(--border-color)" }} />

              {/* Created Activity */}
              <div className="relative flex gap-6">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10"
                  style={{
                    backgroundColor: "rgba(16,185,129,.15)",
                    border: "2px solid var(--success)",
                  }}
                >
                  <User className="h-7 w-7" style={{ color: "var(--success)" }} />
                </div>
                <div
                  className="flex-1 rounded-xl p-5"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">Category Created</h3>
                      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Initial category creation</p>
                    </div>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: "rgba(16,185,129,.15)",
                        color: "var(--success)",
                      }}
                    >
                      Initial
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      >
                        <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Created by:</span>
                        <span className="ml-2 font-medium">
                          {category.createdby?.email || category.createdby?.name || "Unknown User"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--bg-secondary)" }}
                      >
                        <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                      </div>
                      <div>
                        <span style={{ color: "var(--text-muted)" }}>Created on:</span>
                        <span className="ml-2 font-medium">
                          {category.created_at ? new Date(category.created_at).toLocaleString() : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Updated Activity - Conditional */}
              {category.updatedby ? (
                <div className="relative flex gap-6">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10"
                    style={{
                      backgroundColor: "rgba(59,130,246,.15)",
                      border: "2px solid var(--info)",
                    }}
                  >
                    <Activity className="h-7 w-7" style={{ color: "var(--info)" }} />
                  </div>
                  <div
                    className="flex-1 rounded-xl p-5"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold">Category Updated</h3>
                        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Last modification details</p>
                      </div>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: "rgba(59,130,246,.15)",
                          color: "var(--info)",
                        }}
                      >
                        Modified
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: "var(--bg-secondary)" }}
                        >
                          <User className="h-4 w-4" style={{ color: "var(--accent)" }} />
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Updated by:</span>
                          <span className="ml-2 font-medium">
                            {category.updatedby?.email || category.updatedby?.name || "Unknown User"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: "var(--bg-secondary)" }}
                        >
                          <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)" }}>Updated on:</span>
                          <span className="ml-2 font-medium">
                            {category.updated_at ? new Date(category.updated_at).toLocaleString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex gap-6">
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl z-10"
                    style={{
                      backgroundColor: "var(--bg-secondary)",
                      border: "2px dashed var(--border-color)",
                    }}
                  >
                    <Clock className="h-7 w-7" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div
                    className="flex-1 rounded-xl p-5"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      opacity: 0.7,
                    }}
                  >
                    <h3 className="text-lg font-semibold">Category Updated</h3>
                    <p className="mt-2 text-sm font-medium" style={{ color: "var(--text-muted)" }}>Never</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      Category has not been updated since creation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between px-6 py-5"
              style={{
                backgroundColor: "var(--bg-card)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div>
                <h3 className="text-xl font-bold">Edit Category</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                  Update category information
                </p>
              </div>
              <button
                type="button"
                disabled={categoryMutation.isPending}
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Category Code *">
                  <input
                    type="text"
                    required
                    value={formData.category_code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category_code: e.target.value,
                      })
                    }
                    className="input-field"
                    placeholder="e.g. cat_1"
                  />
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Auto-generated • You can change it
                  </p>
                </Field>

                <Field label="Category Name *">
                  <input
                    required
                    type="text"
                    disabled={categoryMutation.isPending}
                    value={formData.name}
                    placeholder="e.g. Electronics"
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        name: event.target.value,
                      })
                    }
                    className="input-field"
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  rows={4}
                  disabled={categoryMutation.isPending}
                  value={formData.description}
                  placeholder="Enter category description..."
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description: event.target.value,
                    })
                  }
                  className="input-field resize-none"
                />
              </Field>

              <div className="flex gap-3 border-t pt-5" style={{ borderColor: "var(--border-color)" }}>
                <button
                  type="button"
                  disabled={categoryMutation.isPending}
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg px-4 py-2.5"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={categoryMutation.isPending}
                  className="flex-1 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-text)",
                  }}
                >
                  {categoryMutation.isPending ? "Saving..." : "Update Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// HELPER COMPONENTS
// ==========================================
function Field({ label, children }) {
  return (
    <div>
      <label
        className="mb-2 block text-sm font-medium"
        style={{
          color: "var(--text-secondary)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}