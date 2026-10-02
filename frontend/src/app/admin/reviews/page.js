"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Search,
  Eye,
  EyeOff,
  MoreVertical,
  RefreshCw,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  X,
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

// ==========================================
// 3-DOT (KEBAB) ROW ACTION MENU
// ==========================================
function RowActions({ review, hidden, isToggling, onToggle }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const openMenu = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 190;
    const menuH = 92;
    const flipUp = window.innerHeight - rect.bottom < menuH;
    let left = rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    setPos({ top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4, left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const itemClass = "w-full px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors duration-150 text-left";
  const hoverOn = (e) => { e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; };
  const hoverOff = (e) => { e.currentTarget.style.backgroundColor = "transparent"; };

  return (
    <div className="relative flex justify-end">
      <button
        ref={btnRef}
        type="button"
        aria-label="Review actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-80"
        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
      >
        <MoreVertical size={16} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[100] w-[190px] rounded-lg border py-1 shadow-2xl"
              style={{ top: pos.top, left: pos.left, backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}
            >
              <Link
                href={`/admin/reviews/${review._id}`}
                role="menuitem"
                className={itemClass}
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                <Eye size={15} style={{ color: "var(--text-muted)" }} /> View full review
              </Link>
              <button
                type="button"
                role="menuitem"
                disabled={isToggling}
                onClick={() => { setOpen(false); onToggle(); }}
                className={`${itemClass} disabled:opacity-50`}
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {hidden ? <Eye size={15} style={{ color: "var(--success-text)" }} /> : <EyeOff size={15} style={{ color: "var(--warning-text)" }} />}
                {hidden ? "Show review" : "Hide review"}
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

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
                    <th
                      key={h}
                      className={`px-4 py-3 text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap ${h === "Actions" ? "text-right" : "text-left"}`}
                      style={{ color: "var(--text-muted)" }}
                    >
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
                          <RowActions
                            review={r}
                            hidden={hidden}
                            isToggling={statusMutation.isPending}
                            onToggle={() => statusMutation.mutate({ id: r._id, next: hidden ? "active" : "hidden" })}
                          />
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
      </div>
    </div>
  );
}





