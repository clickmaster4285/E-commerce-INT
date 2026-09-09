"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { adminCategoryApi } from "../../../apis/admin/categoryApi";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";

const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ListIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const GridIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const SlidersIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SortIndicator = ({ active, direction }) => (
  <svg className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    {active && direction === "desc" ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
    )}
  </svg>
);

const getDataTypeLabel = (type) => {
  const map = {
    text: "Text",
    number: "Number",
    decimal: "Decimal",
    multi_select: "Multi Select",
    select: "Select",
    color: "Color",
  };
  return map[type] || type;
};

const getDataTypeBadgeStyle = (type) => {
  switch (type) {
    case "multi_select":
    case "select":
      return { backgroundColor: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" };
    case "text":
      return { backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.2)" };
    case "number":
    case "decimal":
      return { backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" };
    default:
      return { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" };
  }
};

export default function AttributesPage() {
  useAttributeSocketSync();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: attributes = [], isLoading, isError } = useQuery({
    queryKey: ["attributes"],
    queryFn: () => attributeApi.getAll(),
    retry: false,
    staleTime: 0,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: adminCategoryApi.getAllAdmin,
  });

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c._id] = c; });
    return map;
  }, [categories]);

  // ✅ UPDATED: Filter out deleted categories before mapping to attributes
  const attributesWithCategoryInfo = useMemo(() => {
    return attributes.map((attr) => {
      const assignedCategories = [];
      
      // Only iterate through categories that are NOT deleted
      categories.forEach((cat) => {
        if (cat.is_deleted === true) return; // Skip deleted categories

        const attrConfig = (cat.attributes || []).find(
          (a) => String(a.attribute_id) === String(attr._id)
        );
        if (attrConfig) {
          assignedCategories.push({ _id: cat._id, name: cat.name, config: attrConfig });
        }
      });
      return { ...attr, assignedCategories };
    });
  }, [attributes, categories]);

  const filteredAttributes = useMemo(() => {
    return attributesWithCategoryInfo.filter((attr) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        attr.name?.toLowerCase().includes(s) ||
        attr.code?.toLowerCase().includes(s)
      );
    });
  }, [attributesWithCategoryInfo, search]);

  const sortedAttributes = useMemo(() => {
    const arr = [...filteredAttributes];
    if (!sortConfig.key) return arr;
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        case "type": va = a.data_type || ""; vb = b.data_type || ""; break;
        case "categories": va = a.assignedCategories.length; vb = b.assignedCategories.length; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredAttributes, sortConfig]);

  const totalAttributes = sortedAttributes.length;
  const totalPages = Math.ceil(totalAttributes / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAttributes = sortedAttributes.slice(startIndex, endIndex);

  useEffect(() => setCurrentPage(1), [search]);

  const goToPage = (page) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => setSortConfig((prev) => ({ key: sortKey, direction: prev.key === sortKey && prev.direction === "asc" ? "desc" : "asc" }))}
        className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80"
        style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {label} <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const handleEdit = (attr) => {
    router.push(`/admin/attributes/${attr._id}/edit`);
  };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Attribute Management
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Manage product attributes and their category assignments
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="h-9 w-9 rounded-lg flex items-center justify-center transition"
                style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
                title="List view"
              >
                <ListIcon />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className="h-9 w-9 rounded-lg flex items-center justify-center transition"
                style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
                title="Grid view"
              >
                <GridIcon />
              </button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Attributes</p>
            <p className="text-[20px] font-bold mt-1">{attributes.length}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active</p>
            <p className="text-[20px] font-bold mt-1 text-emerald-500">{attributes.filter((a) => a.is_active !== false).length}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>With Options</p>
            <p className="text-[20px] font-bold mt-1 text-purple-500">{attributes.filter((a) => a.values && a.values.length > 0).length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
            style={inputStyle}
          />
        </div>

        {/* Loading / Empty / Table / Grid */}
        {isLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}>
            <Spinner />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading attributes...</span>
          </div>
        ) : paginatedAttributes.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <SlidersIcon className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search ? "No attributes match your search" : "No attributes found"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <SortHeader label="Attribute Name" sortKey="name" />
                    <SortHeader label="Data Type" sortKey="type" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                      Assigned Categories
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Options
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAttributes.map((attr, index) => {
                    const isActive = attr.is_active !== false;
                    const optionCount = attr.values ? attr.values.length : 0;

                    return (
                      <tr
                        key={attr._id}
                        className="transition cursor-pointer"
                        style={{
                          borderBottom: index < paginatedAttributes.length - 1 ? "1px solid var(--border-color)" : "none",
                          backgroundColor: "var(--bg-card)",
                        }}
                        onClick={() => handleEdit(attr)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                              style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
                            >
                              <SlidersIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-[13px] truncate block">{attr.name}</span>
                              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{attr.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={getDataTypeBadgeStyle(attr.data_type)}
                          >
                            {getDataTypeLabel(attr.data_type)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {attr.assignedCategories.length > 0 ? (
                              attr.assignedCategories.slice(0, 3).map((cat) => (
                                <span
                                  key={cat._id}
                                  className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border"
                                  style={{
                                    backgroundColor: "rgba(16,185,129,0.1)",
                                    color: "#34d399",
                                    border: "1px solid rgba(16,185,129,0.2)",
                                  }}
                                >
                                  {cat.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>None</span>
                            )}
                            {attr.assignedCategories.length > 3 && (
                              <span className="text-[10px] font-medium self-center" style={{ color: "var(--text-muted)" }}>
                                +{attr.assignedCategories.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
                            {optionCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={
                              isActive
                                ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" }
                                : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }
                            }
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(attr); }}
                              className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
                              style={{ color: "var(--text-secondary)" }}
                              title="Edit"
                            >
                              <EditIcon className="w-4 h-4" />
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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedAttributes.map((attr) => {
              const isActive = attr.is_active !== false;
              const optionCount = attr.values ? attr.values.length : 0;

              return (
                <div
                  key={attr._id}
                  className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer"
                  style={cardStyle}
                  onClick={() => handleEdit(attr)}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
                    >
                      <SlidersIcon className="w-5 h-5" />
                    </div>
                    <span
                      className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={
                        isActive
                          ? { backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.2)" }
                          : { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)" }
                      }
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] truncate">{attr.name}</p>
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{attr.code}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                      style={getDataTypeBadgeStyle(attr.data_type)}
                    >
                      {getDataTypeLabel(attr.data_type)}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{optionCount} options</span>
                  </div>
                  {attr.assignedCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
                      {attr.assignedCategories.slice(0, 3).map((cat) => (
                        <span
                          key={cat._id}
                          className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-medium rounded"
                          style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399" }}
                        >
                          {cat.name}
                        </span>
                      ))}
                      {attr.assignedCategories.length > 3 && (
                        <span className="text-[9px] font-medium self-center" style={{ color: "var(--text-muted)" }}>
                          +{attr.assignedCategories.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalAttributes > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Showing {startIndex + 1}-{Math.min(endIndex, totalAttributes)} of {totalAttributes} attributes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                title="Previous page"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="hidden sm:inline-flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? (
                      <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span>
                    ) : (
                      <button
                        onClick={() => goToPage(page)}
                        className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
                        style={{
                          backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)",
                          color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)",
                          border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}`,
                        }}
                      >
                        {page}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                title="Next page"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {paginatedAttributes.length > 0 && totalAttributes <= itemsPerPage && (
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Showing {paginatedAttributes.length} of {attributes.length} attributes
          </p>
        )}
      </div>
    </div>
  );
}
