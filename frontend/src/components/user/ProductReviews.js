"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Star, BadgeCheck, ThumbsUp, ImagePlus, Video, X, Loader2,
  PenLine, Trash2, AlertCircle, CheckCircle2, ChevronDown,
  Play, Camera, MessageSquareHeart,
} from "lucide-react";
import userHttp from "@/apis/userHttp";
import { reviewApi, getReviewErrorMessage } from "@/apis/user/reviewApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const mediaUrl = (raw) => {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_ORIGIN}${path}`;
};

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-PK", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "";
  }
};

function Stars({ value, size = 14, onRate }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type={onRate ? "button" : undefined}
          onClick={onRate ? () => onRate(i) : undefined}
          disabled={!onRate}
          aria-label={`${i} star`}
          className={onRate ? "p-0.5 transition active:scale-90 hover:scale-110" : ""}
        >
          <Star
            size={size}
            strokeWidth={onRate ? 1.8 : 2}
            className={
              i <= Math.round(value)
                ? "text-amber-400 fill-amber-400 drop-shadow-[0_1px_2px_rgba(251,191,36,0.45)]"
                : "text-[var(--user-text-subtle)]"
            }
          />
        </button>
      ))}
    </span>
  );
}

function RatingChip({ value }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.6875rem] font-black px-2 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-500">
      <Star size={11} className="fill-amber-400 text-amber-400" />
      {Number(value || 0).toFixed(1)}
    </span>
  );
}

function ReviewCard({ review, currentUserId, voted, onHelpful, onEdit, onDelete, onPreview }) {
  const user = review.user_id || {};
  const name = user.name || "Customer";
  const initial = String(name).charAt(0).toUpperCase() || "C";
  const isMine = currentUserId && String(user._id || user.id || "") === String(currentUserId);
  const images = (review.images || []).map((m) => mediaUrl(m.img_url)).filter(Boolean);
  const videos = (review.videos || []).map((m) => mediaUrl(m.video_url)).filter(Boolean);

  return (
    <article className="group relative rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:p-5 overflow-hidden transition-shadow hover:shadow-[var(--user-shadow-lg)]">
      <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start gap-3">
        <span className="relative w-11 h-11 rounded-full bg-gradient-to-br from-[var(--user-accent)]/25 to-[var(--user-accent)]/5 border border-[var(--user-accent)]/25 text-[var(--user-accent)] font-black flex items-center justify-center shrink-0 text-[0.9375rem]">
          {initial}
          {review.verifiedPurchase && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-[var(--user-bg-card)] flex items-center justify-center">
              <BadgeCheck size={14} className="text-[var(--user-success)]" />
            </span>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-[var(--user-text)] truncate">{name}</p>
            {isMine && (
              <span className="text-[0.5625rem] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-[var(--user-accent)]/10 text-[var(--user-accent)]">
                You
              </span>
            )}
            {review.verifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold text-[var(--user-success)]">
                <BadgeCheck size={11} /> Verified Purchase
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Stars value={review.rating} />
            <RatingChip value={review.rating} />
            <span className="text-[0.6875rem] text-[var(--user-text-subtle)]">· {formatDate(review.created_at)}</span>
          </div>
        </div>
        {isMine && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => onEdit(review)} aria-label="Edit review"
              className="w-8 h-8 rounded-lg border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/40 transition">
              <PenLine size={14} />
            </button>
            <button onClick={() => onDelete(review)} aria-label="Delete review"
              className="w-8 h-8 rounded-lg border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:border-[var(--user-danger)]/40 transition">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {review.title && (
        <p className="mt-3 text-sm font-bold text-[var(--user-text)] leading-snug">{review.title}</p>
      )}
      {review.comment && (
        <p className="mt-1.5 text-[0.8125rem] sm:text-sm leading-6 text-[var(--user-text-secondary)] whitespace-pre-line break-words">
          {review.comment}
        </p>
      )}

      {(images.length > 0 || videos.length > 0) && (
        <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {images.map((url, i) => (
            <button key={`img-${i}`} onClick={() => onPreview({ type: "image", url })}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 group/thumb">
              <img src={url} alt={`Review photo ${i + 1}`} loading="lazy"
                className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-110" />
              <span className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/20 transition" />
            </button>
          ))}
          {videos.map((url, i) => (
            <button key={`vid-${i}`} onClick={() => onPreview({ type: "video", url })}
              className="relative w-32 h-20 sm:w-40 sm:h-24 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 bg-black group/thumb">
              <video src={url} preload="metadata" muted playsInline className="w-full h-full object-cover opacity-80" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-9 h-9 rounded-full bg-white/95 flex items-center justify-center shadow-lg transition-transform group-hover/thumb:scale-110">
                  <Play size={14} className="text-black fill-black ml-0.5" />
                </span>
              </span>
              <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[0.5625rem] font-bold text-white/90">
                <Video size={10} /> Video
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3.5 pt-3 border-t border-[var(--user-border)] flex items-center justify-between gap-2">
        <button onClick={() => onHelpful(review)}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[0.75rem] font-bold border transition active:scale-95 ${
            voted
              ? "bg-[var(--user-accent)]/10 border-[var(--user-accent)]/40 text-[var(--user-accent)]"
              : "border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/40"
          }`}>
          <ThumbsUp size={13} className={voted ? "fill-[var(--user-accent)]/20" : ""} />
          Helpful{review.helpfulCount > 0 ? ` (${review.helpfulCount})` : ""}
        </button>
        {review.helpfulCount > 0 && (
          <span className="text-[0.6875rem] text-[var(--user-text-subtle)]">
            {review.helpfulCount} buyer{review.helpfulCount === 1 ? "" : "s"} found this helpful
          </span>
        )}
      </div>
    </article>
  );
}

function ReviewForm({ productId, editing, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(editing?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(editing?.title || "");
  const [comment, setComment] = useState(editing?.comment || "");
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);
  const vidRef = useRef(null);

  const ratingLabel = ["", "Poor", "Fair", "Good", "Very good", "Excellent"][hoverRating || rating] || "";

  const pickImages = (files) => {
    const list = Array.from(files || []).slice(0, 5 - images.length);
    if (!list.length) return;
    setImages((prev) => [...prev, ...list].slice(0, 5));
    setError("");
  };

  const pickVideo = (file) => {
    if (!file) return;
    setVideo(file);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rating || rating < 1 || rating > 5) {
      setError("Please select a star rating (1–5).");
      return;
    }
    if (!comment.trim() && !images.length && !video && !editing) {
      setError("Please write a comment or add a photo/video.");
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        await reviewApi.update(editing._id, { rating, title: title.trim(), comment: comment.trim() });
      } else {
        const fd = new FormData();
        fd.append("product_id", productId);
        fd.append("rating", String(rating));
        fd.append("title", title.trim());
        fd.append("comment", comment.trim());
        images.forEach((f) => fd.append("images", f));
        if (video) fd.append("videos", video);
        await reviewApi.create(fd);
      }
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      onDone();
    } catch (err) {
      setError(getReviewErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl bg-[var(--user-bg-input)] border border-[var(--user-border)] px-4 py-2.5 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition";

  return (
    <form onSubmit={handleSubmit}
      className="relative rounded-2xl border border-[var(--user-accent)]/30 bg-[var(--user-bg-card)] p-4 sm:p-6 space-y-4 overflow-hidden">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-300 via-amber-400 to-[var(--user-accent)]" />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-[var(--user-text)] flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-[var(--user-accent)]/10 flex items-center justify-center">
            <PenLine size={15} className="text-[var(--user-accent)]" />
          </span>
          {editing ? "Edit your review" : "Share your experience"}
        </p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[0.75rem] font-semibold text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition">
            Cancel
          </button>
        )}
      </div>

      <div className="rounded-xl bg-[var(--user-bg-hover)]/60 border border-[var(--user-border)] px-4 py-3 flex items-center gap-3 flex-wrap">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-text-secondary)]">Your rating *</p>
        <span className="inline-flex items-center gap-0.5" onMouseLeave={() => setHoverRating(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" onClick={() => setRating(i)} onMouseEnter={() => setHoverRating(i)}
              aria-label={`${i} star`} className="p-1 transition hover:scale-125 active:scale-90">
              <Star
                size={26}
                strokeWidth={1.8}
                className={
                  i <= (hoverRating || rating)
                    ? "text-amber-400 fill-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.5)]"
                    : "text-[var(--user-text-subtle)]"
                }
              />
            </button>
          ))}
        </span>
        {ratingLabel && (
          <span className="text-[0.8125rem] font-bold text-amber-500">{ratingLabel}</span>
        )}
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Review headline (optional)" className={inputCls} />
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000}
        placeholder="What did you like? Quality, delivery, packaging — share your experience..." className={`${inputCls} resize-y`} />

      {!editing && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => imgRef.current?.click()} disabled={images.length >= 5}
              className="h-10 px-3.5 rounded-xl border border-dashed border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] flex items-center gap-1.5 hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)] transition disabled:opacity-40">
              <ImagePlus size={15} /> Photos ({images.length}/5)
            </button>
            <button type="button" onClick={() => vidRef.current?.click()} disabled={!!video}
              className="h-10 px-3.5 rounded-xl border border-dashed border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] flex items-center gap-1.5 hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)] transition disabled:opacity-40">
              <Video size={15} /> {video ? "1 video added" : "Video (max 1)"}
            </button>
          </div>
          <input ref={imgRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple hidden
            onChange={(e) => { pickImages(e.target.files); e.target.value = ""; }} />
          <input ref={vidRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden
            onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ""; }} />
          <p className="text-[0.6875rem] text-[var(--user-text-subtle)]">Photos: JPG/PNG/WEBP, up to 10MB each. Video: MP4/WEBM/MOV, up to 50MB. Files are stored on our server.</p>
          {(images.length > 0 || video) && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((f, i) => (
                <span key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0">
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, x) => x !== i))} aria-label="Remove photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>
                </span>
              ))}
              {video && (
                <span className="relative w-28 h-16 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 bg-black">
                  <video src={URL.createObjectURL(video)} preload="metadata" muted className="w-full h-full object-cover opacity-80" />
                  <button type="button" onClick={() => setVideo(null)} aria-label="Remove video"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"><X size={12} /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
          <AlertCircle size={15} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
          <p className="text-[var(--user-danger)] text-[0.8125rem] font-medium">{error}</p>
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 shadow-lg">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        {loading ? "Saving..." : editing ? "Save changes" : "Submit review"}
      </button>
    </form>
  );
}

export default function ProductReviews({ productId, fallbackSummary }) {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState("newest");
  const [starFilter, setStarFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState("");

  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await userHttp.get("/users/profile");
      return res.data?.user || res.data || null;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const currentUserId = user?._id || user?.id || null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reviews", productId, sort, page, starFilter],
    queryFn: () => reviewApi.list(productId, { page, limit: 10, sort, rating: starFilter }),
    enabled: !!productId,
    retry: false,
    staleTime: 60 * 1000,
  });

  const summary = data?.summary || fallbackSummary || { avg: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  const reviews = data?.reviews || [];
  const pagination = data?.pagination || null;

  const distRows = useMemo(() => {
    const total = summary.count || 0;
    return [5, 4, 3, 2, 1].map((s) => {
      const c = summary.distribution?.[s] || 0;
      return { star: s, count: c, pct: total ? Math.round((c / total) * 100) : 0 };
    });
  }, [summary]);

  const buyerMedia = useMemo(() => {
    const out = [];
    reviews.forEach((r) => {
      (r.images || []).forEach((m) => {
        const url = mediaUrl(m.img_url);
        if (url) out.push({ type: "image", url });
      });
      (r.videos || []).forEach((m) => {
        const url = mediaUrl(m.video_url);
        if (url) out.push({ type: "video", url });
      });
    });
    return out.slice(0, 12);
  }, [reviews]);

  const pickStarFilter = (star) => {
    setStarFilter((prev) => (prev === star ? null : star));
    setPage(1);
  };

  const handleHelpful = async (review) => {
    if (!currentUserId) {
      setNotice("Please log in to mark a review as helpful.");
      setTimeout(() => setNotice(""), 2500);
      return;
    }
    try {
      await reviewApi.helpful(review._id);
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
    } catch {
      setNotice("Could not save your vote. Please try again.");
      setTimeout(() => setNotice(""), 2500);
    }
  };

  const handleDelete = async (review) => {
    if (!window.confirm("Delete this review?")) return;
    try {
      await reviewApi.remove(review._id);
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    } catch (err) {
      setNotice(getReviewErrorMessage(err, "Could not delete the review. Please try again."));
      setTimeout(() => setNotice(""), 3000);
    }
  };

  return (
    <section id="reviews" className="mt-10 sm:mt-12 lg:mt-14 scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-[0.9375rem] sm:text-base font-bold text-[var(--user-text)]">
        <span className="w-1 h-5 rounded-full bg-[var(--user-accent)]" />
        Ratings & Reviews
        {summary.count > 0 && (
          <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-[var(--user-bg-hover)] border border-[var(--user-border)] text-[var(--user-text-secondary)]">
            {summary.count} verified
          </span>
        )}
      </h2>

      {/* ===== Summary panel ===== */}
      <div className="relative mt-4 sm:mt-5 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden">
        <span className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--user-accent)]/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative grid gap-6 sm:gap-8 p-4 sm:p-6 lg:p-7 md:grid-cols-12">
          {/* Score */}
          <div className="md:col-span-4 flex md:flex-col items-center md:items-start md:justify-center gap-4 md:gap-3 md:border-r md:border-[var(--user-border)] md:pr-8">
            <p className="text-5xl sm:text-6xl font-black text-[var(--user-text)] leading-none tracking-tight">
              {Number(summary.avg || 0).toFixed(1)}
              <span className="text-lg sm:text-xl font-bold text-[var(--user-text-subtle)]">/5</span>
            </p>
            <div>
              <Stars value={summary.avg || 0} size={18} />
              <p className="mt-1.5 text-[0.75rem] text-[var(--user-text-muted)]">
                Based on <span className="font-bold text-[var(--user-text)]">{summary.count || 0}</span> verified review{summary.count === 1 ? "" : "s"}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--user-success)]">
                <BadgeCheck size={12} /> 100% from delivered orders
              </p>
            </div>
          </div>

          {/* Distribution (click to filter) */}
          <div className="md:col-span-5 flex flex-col justify-center gap-1">
            {distRows.map(({ star, count, pct }) => {
              const active = starFilter === star;
              return (
                <button key={star} onClick={() => pickStarFilter(star)} title={active ? "Clear filter" : `Show ${star}-star reviews`}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[0.75rem] transition group/row ${
                    active ? "bg-[var(--user-accent)]/10 ring-1 ring-[var(--user-accent)]/40" : "hover:bg-[var(--user-bg-hover)]/70"
                  }`}>
                  <span className={`w-7 font-black ${active ? "text-[var(--user-accent)]" : "text-[var(--user-text-secondary)]"}`}>{star}★</span>
                  <span className="flex-1 h-2.5 rounded-full bg-[var(--user-bg-hover)] overflow-hidden">
                    <span
                      className={`block h-full rounded-full transition-all duration-500 ${
                        active ? "bg-[var(--user-accent)]" : "bg-gradient-to-r from-amber-300 to-amber-400 group-hover/row:from-amber-400 group-hover/row:to-amber-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="w-10 text-right font-semibold text-[var(--user-text-muted)]">{count}</span>
                  <span className="w-10 text-right text-[var(--user-text-subtle)]">{pct}%</span>
                </button>
              );
            })}
            {starFilter && (
              <button onClick={() => { setStarFilter(null); setPage(1); }}
                className="mt-1 self-start inline-flex items-center gap-1 text-[0.6875rem] font-bold text-[var(--user-accent)] hover:underline">
                <X size={12} /> Clear {starFilter}-star filter
              </button>
            )}
          </div>

          {/* CTA */}
          <div className="md:col-span-3 flex flex-col items-stretch justify-center gap-2.5 md:border-l md:border-[var(--user-border)] md:pl-8">
            <span className="mx-auto w-12 h-12 rounded-2xl bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 hidden md:flex items-center justify-center">
              <MessageSquareHeart size={22} className="text-[var(--user-accent)]" />
            </span>
            <p className="hidden md:block text-center text-[0.8125rem] font-bold text-[var(--user-text)] leading-snug">
              Bought this product?<br />
              <span className="font-medium text-[var(--user-text-muted)]">Share your experience</span>
            </p>
            <button
              onClick={() => { setEditing(null); setShowForm((v) => !v); }}
              className="w-full h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition shadow-lg">
              <PenLine size={15} /> {showForm ? "Close form" : "Write a review"}
            </button>
            <p className="text-center text-[0.6875rem] text-[var(--user-text-subtle)]">
              Only delivered orders can review
            </p>
          </div>
        </div>
      </div>

      {/* ===== Buyer media strip ===== */}
      {buyerMedia.length > 0 && (
        <div className="mt-4 sm:mt-5 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:p-5">
          <p className="flex items-center gap-2 text-[0.8125rem] font-black text-[var(--user-text)]">
            <Camera size={15} className="text-[var(--user-accent)]" />
            Photos & videos from buyers
            <span className="text-[0.6875rem] font-semibold text-[var(--user-text-muted)]">({buyerMedia.length})</span>
          </p>
          <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
            {buyerMedia.map((m, i) => (
              <button key={i} onClick={() => setPreview(m)}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 bg-black group/strip">
                {m.type === "video" ? (
                  <>
                    <video src={m.url} preload="metadata" muted playsInline className="w-full h-full object-cover opacity-80" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center shadow transition-transform group-hover/strip:scale-110">
                        <Play size={13} className="text-black fill-black ml-0.5" />
                      </span>
                    </span>
                  </>
                ) : (
                  <img src={m.url} alt={`Buyer photo ${i + 1}`} loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/strip:scale-110" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== Form ===== */}
      {(showForm || editing) && (
        <div className="mt-4 sm:mt-5">
          <ReviewForm
            productId={productId}
            editing={editing}
            onDone={() => { setShowForm(false); setEditing(null); setPage(1); }}
            onCancel={editing ? () => setEditing(null) : undefined}
          />
        </div>
      )}

      {/* ===== Toolbar ===== */}
      <div className="mt-4 sm:mt-5 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => { setStarFilter(null); setPage(1); }}
            className={`h-8 px-3 rounded-full text-[0.6875rem] font-bold border transition ${
              !starFilter
                ? "bg-[var(--user-text)] text-[var(--user-bg)] border-[var(--user-text)]"
                : "border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)]"
            }`}>
            All
          </button>
          {[5, 4, 3, 2, 1].map((s) => (
            <button key={s} onClick={() => pickStarFilter(s)}
              className={`h-8 px-2.5 rounded-full text-[0.6875rem] font-bold border inline-flex items-center gap-1 transition ${
                starFilter === s
                  ? "bg-amber-400 border-amber-400 text-black"
                  : "border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)]"
              }`}>
              {s} <Star size={10} className={starFilter === s ? "fill-black text-black" : "fill-amber-400 text-amber-400"} />
            </button>
          ))}
          <span className="ml-1 text-[0.75rem] font-semibold text-[var(--user-text-muted)]">
            {pagination ? `${pagination.total} review${pagination.total === 1 ? "" : "s"}` : "Reviews"}
          </span>
        </div>
        <label className="relative inline-flex items-center gap-1.5 text-[0.75rem] font-semibold text-[var(--user-text-muted)]">
          Sort
          <span className="relative">
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="appearance-none h-9 pl-3 pr-8 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text)] text-[0.75rem] font-semibold outline-none focus:border-[var(--user-accent)] cursor-pointer">
              <option value="newest">Newest</option>
              <option value="helpful">Most helpful</option>
              <option value="high">Highest rated</option>
              <option value="low">Lowest rated</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </span>
        </label>
      </div>

      {notice && (
        <div className="mt-3 px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
          <AlertCircle size={15} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
          <p className="text-[var(--user-danger)] text-[0.8125rem]">{notice}</p>
        </div>
      )}

      {/* ===== List ===== */}
      <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4">
        {isLoading ? (
          [0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[var(--user-bg-hover)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-[var(--user-bg-hover)] rounded-full" />
                  <div className="h-3 w-24 bg-[var(--user-bg-hover)] rounded-full" />
                </div>
              </div>
              <div className="h-3 w-full bg-[var(--user-bg-hover)] rounded-full" />
              <div className="h-3 w-2/3 bg-[var(--user-bg-hover)] rounded-full" />
              <div className="flex gap-2">
                <div className="w-20 h-20 rounded-xl bg-[var(--user-bg-hover)]" />
                <div className="w-20 h-20 rounded-xl bg-[var(--user-bg-hover)]" />
              </div>
            </div>
          ))
        ) : isError ? (
          <p className="text-sm text-[var(--user-text-muted)] rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-center">
            Could not load reviews. Please refresh the page and try again.
          </p>
        ) : !reviews.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] p-6 sm:p-10 text-center overflow-hidden relative">
            <span className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-amber-400/10 blur-3xl" />
            <span className="relative mx-auto w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center">
              <MessageSquareHeart size={24} className="text-amber-500" />
            </span>
            <p className="relative mt-3 text-sm font-black text-[var(--user-text)]">
              {starFilter ? `No ${starFilter}-star reviews yet` : "No reviews yet"}
            </p>
            <p className="relative mt-1 text-[0.8125rem] text-[var(--user-text-muted)] max-w-sm mx-auto">
              {starFilter
                ? "Try a different star filter or sort order."
                : "Bought this product? Be the first to share your experience."}
            </p>
            {starFilter ? (
              <button onClick={() => { setStarFilter(null); setPage(1); }}
                className="relative mt-4 h-10 px-5 rounded-xl border border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)] transition">
                Show all reviews
              </button>
            ) : (
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="relative mt-4 h-10 px-5 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[0.75rem] font-bold hover:opacity-90 transition">
                Write the first review
              </button>
            )}
          </div>
        ) : (
          <>
            {reviews.map((r) => (
              <ReviewCard
                key={r._id}
                review={r}
                currentUserId={currentUserId}
                voted={(r.helpfulBy || []).some((id) => String(id) === String(currentUserId))}
                onHelpful={handleHelpful}
                onEdit={(rev) => { setEditing(rev); setShowForm(false); }}
                onDelete={handleDelete}
                onPreview={setPreview}
              />
            ))}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-10 px-4 rounded-xl border border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] disabled:opacity-40 hover:border-[var(--user-accent)]/50 transition">
                  Previous
                </button>
                <span className="text-[0.75rem] font-semibold text-[var(--user-text-muted)]">Page {pagination.page} / {pagination.pages}</span>
                <button disabled={!pagination.hasNext} onClick={() => setPage((p) => p + 1)}
                  className="h-10 px-4 rounded-xl border border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] disabled:opacity-40 hover:border-[var(--user-accent)]/50 transition">
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Media lightbox */}
      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition" aria-label="Close">
            <X size={20} />
          </button>
          {preview.type === "video" ? (
            <video src={preview.url} controls autoPlay playsInline className="max-w-[92vw] max-h-[82vh] rounded-lg" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={preview.url} alt="" className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </section>
  );
}
