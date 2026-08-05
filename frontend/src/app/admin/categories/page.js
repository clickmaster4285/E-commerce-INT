"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Grid3x3,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { categoryApi } from "@/apis/categoryApi";

const ITEMS_PER_PAGE = 20;

const initialForm = {
  category_code: "",
  name: "",
  description: "",
  is_active: true,
};

export default function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("table");
  const [currentPage, setCurrentPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const [formData, setFormData] = useState(initialForm);

  // ==========================================
  // GET CATEGORIES
  // ==========================================

  const {
    data: categories = [],
    isLoading,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  // ==========================================
  // CREATE / UPDATE
  // ==========================================

  const categoryMutation = useMutation({
    mutationFn: ({ id, data }) => {
      return id
        ? categoryApi.update(id, data)
        : categoryApi.create(data);
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      toast.success(
        variables.id
          ? "Category updated successfully"
          : "Category added successfully"
      );

      closeFormModal();
    },

    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          "Category operation failed"
      );
    },
  });

  // ==========================================
  // DELETE
  // ==========================================

  const deleteMutation = useMutation({
    mutationFn: categoryApi.delete,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      toast.success("Category deleted successfully");

      setShowDeleteModal(false);
      setCategoryToDelete(null);
    },

    onError: (error) => {
      toast.error(
        error.response?.data?.message ||
          "Category delete failed"
      );
    },
  });

  // ==========================================
  // FILTER
  // ==========================================

  const filteredCategories = categories.filter((category) => {
    const keyword = search.trim().toLowerCase();

    const matchSearch =
      !keyword ||
      category.name?.toLowerCase().includes(keyword) ||
      category.category_code?.toLowerCase().includes(keyword);

    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && category.is_active) ||
      (filterStatus === "inactive" && !category.is_active);

    return matchSearch && matchStatus;
  });

  // ==========================================
  // PAGINATION
  // ==========================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCategories.length / ITEMS_PER_PAGE)
  );

  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // ==========================================
  // STATS
  // ==========================================

  const totalCategories = categories.length;

  const activeCategories = categories.filter(
    (category) => category.is_active
  ).length;

  const inactiveCategories =
    totalCategories - activeCategories;

  // ==========================================
  // DETAIL PAGE
  // ==========================================

  const openCategoryDetails = (category) => {
    router.push(`/admin/categories/${category._id}`);
  };

  // ==========================================
  // FORM
  // ==========================================

  const resetForm = () => {
    setFormData(initialForm);
    setEditingCategory(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleEdit = (category) => {
    setEditingCategory(category);

    setFormData({
      category_code: category.category_code || "",
      name: category.name || "",
      description: category.description || "",
      is_active:
        category.is_active !== undefined
          ? category.is_active
          : true,
    });

    setShowModal(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    categoryMutation.mutate({
      id: editingCategory?._id,

      data: {
        category_code: formData.category_code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
      },
    });
  };

  // ==========================================
  // DELETE MODAL
  // ==========================================

  const handleDeleteClick = (category) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setCategoryToDelete(null);
  };

  const confirmDelete = () => {
    if (!categoryToDelete) return;

    deleteMutation.mutate(categoryToDelete._id);
  };

  // ==========================================
  // SEARCH
  // ==========================================

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (event) => {
    setFilterStatus(event.target.value);
    setCurrentPage(1);
  };

  const isSubmitting = categoryMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <div
      className="min-h-screen space-y-6 p-6"
      style={{
        // backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <FolderOpen
              className="h-8 w-8"
              style={{ color: "var(--accent)" }}
            />

            Categories
          </h1>

          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Organize and manage your product categories
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-lg p-1"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`rounded-md p-2 transition ${
                viewMode === "table"
                  ? "bg-emerald-600 text-white"
                  : ""
              }`}
              style={{
                color:
                  viewMode !== "table"
                    ? "var(--text-muted)"
                    : undefined,
              }}
            >
              <List className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`rounded-md p-2 transition ${
                viewMode === "grid"
                  ? "bg-emerald-600 text-white"
                  : ""
              }`}
              style={{
                color:
                  viewMode !== "grid"
                    ? "var(--text-muted)"
                    : undefined,
              }}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:scale-105"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Categories"
          value={totalCategories}
        />

        <StatCard
          title="Active"
          value={activeCategories}
          color="var(--success)"
        />

        <StatCard
          title="Inactive"
          value={inactiveCategories}
          color="var(--danger)"
        />
      </div>

      {/* SEARCH */}

     <div
  className="rounded-xl p-4"
  style={{
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
  }}
>
  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
    
    {/* SEARCH - BIG */}
    <div className="relative w-full">
      <Search
        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2"
        style={{ color: "var(--text-muted)" }}
      />

      <input
        type="text"
        value={search}
        onChange={handleSearchChange}
        placeholder="Search by category name or code..."
        className="input-field w-full !pl-10"
      />
    </div>

    {/* STATUS - SMALL */}
    <select
      value={filterStatus}
      onChange={handleFilterChange}
      className="input-field w-full"
    >
      <option value="all">All Status</option>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
    </select>

  </div>
</div>

      {/* TABLE */}

      {viewMode === "table" && (
        <div
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                }}
              >
                <tr>
                  <TableHeading>Category Code</TableHeading>
                  <TableHeading>Category Name</TableHeading>

                  <TableHeading className="hidden md:table-cell">
                    Description
                  </TableHeading>

                  <TableHeading>Status</TableHeading>

                  <TableHeading right>
                    Actions
                  </TableHeading>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-14 text-center"
                    >
                      Loading categories...
                    </td>
                  </tr>
                ) : paginatedCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-14 text-center"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      <FolderOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />

                      No categories found
                    </td>
                  </tr>
                ) : (
                  paginatedCategories.map((category) => (
                    <tr
                      key={category._id}
                      onClick={() =>
                        openCategoryDetails(category)
                      }
                      className="cursor-pointer transition hover:bg-black/5"
                      style={{
                        borderTop:
                          "1px solid var(--border-color)",
                      }}
                    >
                      <td className="px-6 py-4">
                        <code
                          className="rounded-md px-2 py-1 text-xs font-mono"
                          style={{
                            backgroundColor:
                              "var(--bg-tertiary)",

                            color: "var(--accent)",
                          }}
                        >
                          {category.category_code || "—"}
                        </code>
                      </td>

                      <td className="px-6 py-4">
                        <p
                          className="font-semibold transition hover:underline"
                          style={{
                            color: "var(--text-primary)",
                          }}
                        >
                          {category.name}
                        </p>
                      </td>

                      <td className="hidden max-w-xs px-6 py-4 md:table-cell">
                        <p
                          className="truncate text-sm"
                          style={{
                            color: "var(--text-secondary)",
                          }}
                        >
                          {category.description || "—"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <StatusBadge
                          active={category.is_active}
                        />
                      </td>

                      <td
                        className="px-6 py-4"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            title="Edit category"
                            color="var(--info)"
                            background="rgba(59,130,246,.10)"
                            onClick={() =>
                              handleEdit(category)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </IconButton>

                          <IconButton
                            title="Delete category"
                            color="var(--danger)"
                            background="rgba(239,68,68,.10)"
                            disabled={isDeleting}
                            onClick={() =>
                              handleDeleteClick(category)
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID */}

      {viewMode === "grid" && (
        <>
          {paginatedCategories.length === 0 ? (
            <div
              className="rounded-xl py-14 text-center"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              <FolderOpen className="mx-auto mb-3 h-10 w-10 opacity-30" />

              No categories found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedCategories.map((category) => (
                <div
                  key={category._id}
                  onClick={() =>
                    openCategoryDetails(category)
                  }
                  className="cursor-pointer space-y-4 rounded-xl p-5 transition hover:-translate-y-1"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-lg font-bold"
                      style={{
                        backgroundColor:
                          "var(--bg-tertiary)",

                        color: "var(--accent)",
                      }}
                    >
                      {category.name
                        ?.charAt(0)
                        .toUpperCase()}
                    </div>

                    <StatusBadge
                      active={category.is_active}
                    />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold">
                      {category.name}
                    </h3>

                    <code
                      className="mt-1 block text-xs font-mono"
                      style={{
                        color: "var(--accent)",
                      }}
                    >
                      {category.category_code}
                    </code>
                  </div>

                  <p
                    className="line-clamp-2 min-h-10 text-sm"
                    style={{
                      color: "var(--text-secondary)",
                    }}
                  >
                    {category.description ||
                      "No description provided."}
                  </p>

                  <div
                    onClick={(event) =>
                      event.stopPropagation()
                    }
                    className="flex justify-end gap-2 border-t pt-3"
                    style={{
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <IconButton
                      title="Edit category"
                      color="var(--info)"
                      background="rgba(59,130,246,.10)"
                      onClick={() =>
                        handleEdit(category)
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>

                    <IconButton
                      title="Delete category"
                      color="var(--danger)"
                      background="rgba(239,68,68,.10)"
                      onClick={() =>
                        handleDeleteClick(category)
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* PAGINATION */}

      {filteredCategories.length > ITEMS_PER_PAGE && (
        <div
          className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: "var(--border-color)",
          }}
        >
          <p
            className="text-sm"
            style={{
              color: "var(--text-muted)",
            }}
          >
            Showing{" "}
            {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
            {Math.min(
              currentPage * ITEMS_PER_PAGE,
              filteredCategories.length
            )}{" "}
            of {filteredCategories.length} categories
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.max(1, page - 1)
                )
              }
              className="rounded-lg p-2 disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-2 text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1)
                )
              }
              className="rounded-lg p-2 disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}

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

                borderBottom:
                  "1px solid var(--border-color)",
              }}
            >
              <div>
                <h3 className="text-xl font-bold">
                  {editingCategory
                    ? "Edit Category"
                    : "Add Category"}
                </h3>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  {editingCategory
                    ? "Update category information"
                    : "Enter category information"}
                </p>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={closeFormModal}
                className="rounded-lg p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Category Code *">
                  <input
                    required
                    type="text"
                    disabled={isSubmitting}
                    value={formData.category_code}
                    placeholder="e.g. CAT-001"
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        category_code:
                          event.target.value,
                      })
                    }
                    className="input-field"
                  />
                </Field>

                <Field label="Category Name *">
                  <input
                    required
                    type="text"
                    disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  value={formData.description}
                  placeholder="Enter category description..."
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      description:
                        event.target.value,
                    })
                  }
                  className="input-field resize-none"
                />
              </Field>

              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg p-3"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                }}
              >
                <input
                  type="checkbox"
                  disabled={isSubmitting}
                  checked={formData.is_active}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      is_active:
                        event.target.checked,
                    })
                  }
                  className="h-5 w-5"
                  style={{
                    accentColor: "var(--accent)",
                  }}
                />

                <div>
                  <p className="text-sm font-medium">
                    Active Category
                  </p>

                  <p
                    className="text-xs"
                    style={{
                      color: "var(--text-muted)",
                    }}
                  >
                    Category is available for products
                  </p>
                </div>
              </label>

              <div
                className="flex gap-3 border-t pt-5"
                style={{
                  borderColor: "var(--border-color)",
                }}
              >
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={closeFormModal}
                  className="flex-1 rounded-lg px-4 py-2.5"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",

                    border:
                      "1px solid var(--border-color)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-text)",
                  }}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editingCategory
                      ? "Update Category"
                      : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}

      {showDeleteModal && categoryToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>

              <div>
                <h3 className="font-semibold">
                  Delete "{categoryToDelete.name}"?
                </h3>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  This action cannot be undone. The category
                  will be permanently removed.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={closeDeleteModal}
                className="rounded-lg px-4 py-2.5"
                style={{
                  backgroundColor:
                    "var(--bg-tertiary)",

                  border:
                    "1px solid var(--border-color)",
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="rounded-lg bg-red-500 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ==========================================
// COMPONENTS
// ==========================================

function StatCard({ title, value, color }) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      <p
        className="text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </p>

      <p
        className="mt-1 text-2xl font-bold"
        style={{
          color: color || "var(--text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

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

function StatusBadge({ active }) {
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: active
          ? "rgba(16,185,129,.15)"
          : "rgba(239,68,68,.15)",

        color: active
          ? "var(--success)"
          : "var(--danger)",
      }}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  color = "var(--text-muted)",
  background = "var(--bg-card)",
  disabled = false,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-2 transition hover:scale-110 disabled:opacity-50"
      style={{
        color,
        backgroundColor: background,
      }}
    >
      {children}
    </button>
  );
}

function TableHeading({
  children,
  right = false,
  className = "",
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider ${
        right ? "text-right" : "text-left"
      } ${className}`}
      style={{
        color: "var(--text-muted)",
      }}
    >
      {children}
    </th>
  );
}