"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Search,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { adminReviewApi } from "@/apis/admin/reviewApi";

const PER_PAGE = 20;
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const mediaUrl = (u) => {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  return `${API_ORIGIN}${u.startsWith("/") ? "" : "/"}${u}`;
};

function buildPageList(currentPage, totalPages, MID = 5) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);
  if (total <= MID + 2) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, Math.min(current - Math.floor((MID - 1) / 2), total - MID));
  const end = start + MID - 1;
  const pages = [1];
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const EMPTY_STATS = { total: 0, visible: 0, hidden: 0, five: 0, avg: 0 };
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

const Stars = ({ value = 0, size = 13 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={i <= Math.round(Number(value) || 0) ? "fill-amber-400 text-amber-400" : "text-[var(--border-color)]"}
      />
    ))}
  </span>
);

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const queryKey = ["adminReviews", page, search, rating, status, sort];
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => adminReviewApi.list({ page, limit: PER_PAGE, search, rating, status, sort }),
    staleTime: 30 * 1000,
    keepPreviousData: true,
  });

  const reviews = data?.reviews || [];
  const stats = data?.stats || EMPTY_STATS;
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };
  const pageList = useMemo(() => buildPageList(pagination.page, pagination.pages), [pagination.page, pagination.pages]);

  const handleSearchChange = (value) => {
    setSearchInput(value);
    setSearch(value.trim());
    setPage(1);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["adminReviews"] });

  const statusMutation = useMutation({
    mutationFn: ({ id, next }) => adminReviewApi.setStatus(id, next),
    onSuccess: (_d, v) => {
      toast.success(v.next === "hidden" ? "Review hidden" : "Review visible");
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Status update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminReviewApi.remove(id),
    onSuccess: () => {
      toast.success("Review deleted");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Delete failed"),
  });

  const selectClass =
    "h-9 rounded-lg px-2.5 text-[13px] font-medium outline-none transition cursor-pointer focus:ring-1 focus:ring-emerald-500/40";
  const selectStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const statCards = [
    { key: "total", label: "Total Reviews", icon: MessageSquareText, value: stats.total, color: "var(--accent)", soft: "var(--accent-soft)" },
    { key: "visible", label: "Visible", icon: Eye, value: stats.visible, color: "var(--success)", soft: "var(--success-soft)" },
    { key: "hidden", label: "Hidden", icon: EyeOff, value: stats.hidden, color: "var(--danger)", soft: "var(--danger-soft)" },
    { key: "avg", label: "Average Rating", icon: Star, value: stats.avg, color: "var(--warning)", soft: "var(--warning-soft)" },
    { key: "five", label: "5-Star", icon: Sparkles, value: stats.five, color: "var(--purple)", soft: "var(--purple-soft)" },
  ];

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Review Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Moderate customer reviews — hide, unhide, or delete. Only delivered-order buyers can write reviews.</p>
          </div>
          <button
            type="button"
            onClick={() => { invalidate(); refetch(); }}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ===== Stat cards ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {statCards.map((c) => (
            <div key={c.key} className="rounded-lg p-3 sm:p-4" style={cardStyle}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: c.soft, color: c.color }}>
                  <c.icon size={17} />
                </div>
                <p className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{c.label}</p>
              </div>
              {isLoading ? (
                <span className="skeleton mt-2 inline-block h-6 w-12" />
              ) : (
                <p className="mt-2 text-[18px] sm:text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>{c.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* ===== Toolbar ===== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-[400px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search review title or comment…"
              className="h-9 w-full rounded-lg pl-9 pr-9 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            />
            {searchInput ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select value={rating} onChange={(e) => { setRating(e.target.value); setPage(1); }} className={selectClass} style={selectStyle} aria-label="Filter by rating">
              <option value="all">All ratings</option>
              <option value="5">5 star</option>
              <option value="4">4 star</option>
              <option value="3">3 star</option>
              <option value="2">2 star</option>
              <option value="1">1 star</option>
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectClass} style={selectStyle} aria-label="Filter by status">
              <option value="all">All status</option>
              <option value="active">Visible</option>
              <option value="hidden">Hidden</option>
            </select>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={selectClass} style={selectStyle} aria-label="Sort reviews">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="helpful">Most helpful</option>
              <option value="high">Highest rated</option>
              <option value="low">Lowest rated</option>
            </select>
          </div>
        </div>
        {/* ===== Table ===== */}
        <div className="overflow-hidden rounded-lg" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  {["Reviewer", "Product", "Rating", "Review", "Visibility", "Submitted", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`sk-${i}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="px-4 py-3"><span className="skeleton block h-8 w-36" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-4 w-28" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-4 w-24" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-4 w-56" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-5 w-16" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-4 w-20" /></td>
                      <td className="px-4 py-3"><span className="skeleton block h-8 w-28" /></td>
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Could not load reviews</p>
                      <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-2 h-9 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : !reviews.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <MessageSquareText size={28} className="mx-auto" style={{ color: "var(--text-muted)" }} />
                      <p className="mt-2 text-sm font-bold" style={{ color: "var(--text-primary)" }}>No reviews found</p>
                      <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Try changing or clearing the filters.</p>
                    </td>
                  </tr>
                ) : (
                  reviews.map((r) => {
                    const user = r.user_id && typeof r.user_id === "object" ? r.user_id : {};
                    const product = r.product_id && typeof r.product_id === "object" ? r.product_id : {};
                    const hidden = r.status === "hidden";
                    return (
                      <tr
                        key={r._id}
                        className="transition"
                        style={{ borderBottom: "1px solid var(--border-color)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[11px] font-extrabold"
                              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                            >
                              {user?.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mediaUrl(user.avatar) || user.avatar} alt={user?.name || "user"} className="h-full w-full object-cover" />
                              ) : (
                                String(user?.name || "U").charAt(0).toUpperCase()
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block max-w-[140px] truncate text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                                {user?.name || "Customer"}
                              </span>
                              <span className="mt-0.5 block max-w-[165px] truncate text-[11px]" style={{ color: "var(--text-muted)" }} title={user?.email || "Email unavailable"}>
                                {user?.email || "Email unavailable"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block max-w-[150px] truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }} title={product?.name || r.product_id}>
                            {product?.name || "Product"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Stars value={r.rating} />
                          <span className="mt-0.5 block text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>{r.rating}/5</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/reviews/${r._id}`} className="block max-w-[300px] text-left">
                            {r.title ? (
                              <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{r.title}</span>
                            ) : null}
                            <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                              {r.comment || "— rating only —"}
                            </span>
                            {(r.images?.length || r.videos?.length) ? (
                              <span className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                                {(r.images?.length || 0) + (r.videos?.length || 0)} media
                              </span>
                            ) : null}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
                            style={hidden
                              ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }
                              : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}
                          >
                            {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                            {hidden ? "Hidden" : "Visible"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/admin/reviews/${r._id}`}
                              title="View full review"
                              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-80"
                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                            >
                              <Eye size={14} />
                            </Link>
                            <button
                              type="button"
                              title={hidden ? "Show review" : "Hide review"}
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ id: r._id, next: hidden ? "active" : "hidden" })}
                              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-80 disabled:opacity-50"
                              style={{ backgroundColor: hidden ? "var(--success-soft)" : "var(--warning-soft)", color: hidden ? "var(--success-text)" : "var(--warning-text)", border: "1px solid var(--border-color)" }}
                            >
                              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              type="button"
                              title="Delete review"
                              onClick={() => setConfirmDelete(r)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-80"
                              style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid var(--border-color)" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ===== Pagination ===== */}
          {pagination.pages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border-color)" }}>
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                Page {pagination.page} of {pagination.pages} — {pagination.total} total
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                </button>
                {pageList.map((p, i) =>
                  p === "…" ? (
                    <span key={`e-${i}`} className="w-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(Number(p))}
                      className="h-8 min-w-8 rounded-lg px-2 text-[12px] font-bold"
                      style={Number(p) === pagination.page
                        ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" }
                        : { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  aria-label="Next page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ===== Delete confirmation ===== */}
        {confirmDelete ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="alertdialog" aria-modal="true">
            <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
            <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                  <AlertTriangle size={20} style={{ color: "var(--danger)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Delete this review?</h3>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    This action cannot be undone. The review will be soft-deleted and its media files removed.
                  </p>
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 h-10 sm:h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(confirmDelete._id)}
                  className="flex-1 h-10 sm:h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--danger)" }}
                >
                  {deleteMutation.isPending ? (<><Spinner className="w-3.5 h-3.5" /> Deleting...</>) : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}





