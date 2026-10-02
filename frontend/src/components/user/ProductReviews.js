"use client";

// ==========================================
// ⭐ PRODUCT RATING WIDGET (order-based ratings + photos/video)
// ==========================================
// Ratings ab product page ke public "Ratings & Reviews" section se nahi aati.
// User apni rating ORDER par deta hai (sirf delivered orders ke liye) — stars,
// headline, comment aur photos/video ke saath — aur product page par sirf apni
// di hui rating (media ke saath) dekhta hai.
//
// Ye file 2 tarah se use hoti hai:
//   • variant="compact" → orders list + order detail ke items par "Rate" button / rated badge
//   • variant="detail"  → product page par "Your rating" card (sirf tab jab rated ho)
// ==========================================

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Star, Loader2, X, Check, ImagePlus, Video, AlertCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { reviewApi, getReviewErrorMessage } from "@/apis/user/reviewApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const mediaUrl = (raw) => {
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_ORIGIN}${path}`;
};

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;   // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;   // 50MB
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
const VIDEO_ACCEPT = VIDEO_TYPES.join(",");

/* ---------- Stars (display + interactive) ---------- */
function StarRow({ value = 0, hover = 0, size = 16, interactive = false, onPick, onHover }) {
  const shown = hover || value;
  return (
    <span className="inline-flex items-center gap-0.5" onMouseLeave={() => interactive && onHover && onHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          onClick={interactive ? (e) => { e.preventDefault(); e.stopPropagation(); onPick && onPick(i); } : undefined}
          onMouseEnter={interactive && onHover ? () => onHover(i) : undefined}
          className={interactive ? "p-0.5 cursor-pointer transition-transform hover:scale-110 active:scale-90" : "p-0.5 cursor-default"}
        >
          <Star
            size={size}
            strokeWidth={interactive ? 1.8 : 2}
            className={
              i <= Math.round(shown)
                ? "text-amber-400 fill-amber-400 drop-shadow-[0_1px_2px_rgba(251,191,36,0.45)]"
                : "text-[var(--user-text-subtle)]"
            }
          />
        </button>
      ))}
    </span>
  );
}

/* ---------- Saved media thumbnails (already uploaded) ---------- */
function SavedMedia({ images = [], videos = [], onPreview }) {
  const imgs = images.map((m) => mediaUrl(m.img_url)).filter(Boolean);
  const vids = videos.map((m) => mediaUrl(m.video_url)).filter(Boolean);
  if (!imgs.length && !vids.length) return null;
  const thumb =
    "relative w-14 h-14 rounded-xl overflow-hidden border border-[var(--user-border)] bg-[var(--user-bg-hover)] shrink-0";
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {imgs.map((url, i) => (
        <button key={`i-${i}`} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreview && onPreview({ type: "image", url }); }} className={thumb} aria-label="View photo">
          <img src={url} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
      {vids.map((url, i) => (
        <button key={`v-${i}`} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreview && onPreview({ type: "video", url }); }} className={`${thumb} flex items-center justify-center bg-black`} aria-label="Play video">
          <video src={url} muted preload="metadata" className="absolute inset-0 w-full h-full object-cover opacity-60" />
          <span className="relative w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"><Play size={13} className="text-white fill-white" /></span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Modal (portal — Link/anchor ke andar safe rehne ke liye) ---------- */
function RatingModal({
  productName, rated, saving, rating, hover, title, comment, images, video, error, existingImages = 0, existingVideo = false,
  onPick, onHover, onTitle, onComment, onPickImages, onRemoveImage, onPickVideo, onRemoveVideo,
  onSubmit, onClose,
}) {
  const imgId = useId();
  const vidId = useId();
  const [previews, setPreviews] = useState([]);
  const [videoPreview, setVideoPreview] = useState("");

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    const videoUrl = video ? URL.createObjectURL(video) : "";
    const frame = window.requestAnimationFrame(() => {
      setPreviews(urls);
      setVideoPreview(videoUrl);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      urls.forEach(URL.revokeObjectURL);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [images, video]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const inputCls =
    "w-full rounded-xl bg-[var(--user-bg)] border border-[var(--user-border)] px-3.5 py-2.5 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15 transition resize-none";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose && onClose(); }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur bg-gradient-to-r from-amber-400/10 to-transparent">
          <div className="min-w-0">
            <p className="text-[0.625rem] font-black uppercase tracking-[0.14em] text-amber-500">
              {rated ? "Update your rating" : "Rate this product"}
            </p>
            {productName ? (
              <h3 className="mt-1 text-sm font-black text-[var(--user-text)] leading-snug line-clamp-2">{productName}</h3>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pt-6 pb-4 space-y-4">
          <div className="text-center">
            <div className="flex justify-center">
              <StarRow value={rating} hover={hover} size={40} interactive onPick={onPick} onHover={onHover} />
            </div>
            <p className={`mt-2.5 text-sm font-black ${(hover || rating) ? "text-amber-500" : "text-[var(--user-text-subtle)]"}`}>
              {RATING_LABELS[hover || rating] || "Tap a star to rate"}
            </p>
          </div>

          <input type="text" value={title} onChange={(e) => onTitle(e.target.value)} maxLength={120}
            placeholder="Add a headline (optional)" className={inputCls} />

          <textarea value={comment} onChange={(e) => onComment(e.target.value)} rows={3} maxLength={800}
            placeholder="Tell others about your experience (optional)" className={inputCls} />


          {/* Media */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[0.6875rem] font-black uppercase tracking-wider text-[var(--user-text-secondary)] flex items-center gap-1.5">
                <ImagePlus size={13} /> Add photos &amp; video
              </p>
              <span className="text-[0.5625rem] font-semibold text-[var(--user-text-subtle)]">Optional</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* ✅ <label htmlFor> — real native file-picker trigger (button + JS .click()
                  tab se "silently kuch nahi hota" ka issue avoid karta hai) */}
              <label htmlFor={imgId}
                className={`h-10 px-3.5 rounded-xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] flex items-center gap-1.5 transition ${images.length + existingImages >= MAX_IMAGES ? "opacity-40 pointer-events-none" : "cursor-pointer hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)]"}`}>
                <ImagePlus size={15} /> Photos ({images.length + existingImages}/{MAX_IMAGES})
              </label>
              <label htmlFor={vidId}
                className={`h-10 px-3.5 rounded-xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] flex items-center gap-1.5 transition ${video || existingVideo ? "opacity-40 pointer-events-none" : "cursor-pointer hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)]"}`}>
                <Video size={15} /> {video || existingVideo ? "1 video added" : "Video (max 1)"}
              </label>
            </div>

            <input id={imgId} type="file" accept={IMAGE_ACCEPT} multiple hidden
              onChange={(e) => { onPickImages(e.target.files); e.target.value = ""; }} />
            <input id={vidId} type="file" accept={VIDEO_ACCEPT} hidden
              onChange={(e) => { onPickVideo(e.target.files && e.target.files[0]); e.target.value = ""; }} />

            {(previews.length > 0 || videoPreview) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {previews.map((src, i) => (
                  <span key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 bg-[var(--user-bg-hover)]">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => onRemoveImage(i)} aria-label="Remove photo"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition"><X size={12} /></button>
                  </span>
                ))}
                {videoPreview && (
                  <span className="relative w-28 h-16 rounded-xl overflow-hidden border border-[var(--user-border)] shrink-0 bg-black flex items-center justify-center">
                    <video src={videoPreview} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-70" />
                    <span className="relative w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"><Play size={13} className="text-white fill-white" /></span>
                    <button type="button" onClick={onRemoveVideo} aria-label="Remove video"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90 transition"><X size={12} /></button>
                  </span>
                )}
              </div>
            )}

            <p className="text-[0.625rem] text-[var(--user-text-subtle)] leading-relaxed">
              Photos: JPG / PNG / WEBP, up to 10MB each &middot; Video: MP4 / WEBM / MOV, up to 50MB.
            </p>
          </div>


          {error ? (
            <div className="px-4 py-3 rounded-xl bg-[var(--user-danger)]/10 border border-[var(--user-danger)]/30 flex items-start gap-2">
              <AlertCircle size={15} className="text-[var(--user-danger)] shrink-0 mt-0.5" />
              <p className="text-[var(--user-danger)] text-[0.8125rem] font-medium">{error}</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 px-5 py-4 border-t border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 h-11 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-sm font-bold text-[var(--user-text)] hover:opacity-80 transition disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onSubmit} disabled={saving || !rating}
            className="flex-[1.4] h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving..." : rated ? "Update rating" : "Submit rating"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Lightbox (saved media full view) ---------- */
function MediaLightbox({ preview, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[210] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition" aria-label="Close">
        <X size={20} />
      </button>
      {preview.type === "video" ? (
        <video src={preview.url} controls autoPlay playsInline className="max-w-[92vw] max-h-[82vh] rounded-lg" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={preview.url} alt="" className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      )}
    </div>,
    document.body
  );
}


/* ==========================================
// ⭐ ProductRating — main export
// Props:
//   productId   : string (required)
//   productName : string (modal header)
//   review      : user ki existing review (ya null)
//   variant     : "compact" (default) | "detail"
//   onSaved     : optional callback
// ========================================== */
export default function ProductRating({ productId, productName = "", review = null, variant = "compact", showMedia = false, onSaved, autoOpen = false }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hover, setHover] = useState(0);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  const rated = !!review;
  const savedCount = review ? (review.images || []).length + (review.videos || []).length : 0;

  const openModal = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setRating(review ? review.rating || 0 : 0);
    setTitle(review ? review.title || "" : "");
    setComment(review ? review.comment || "" : "");
    setImages([]);
    setVideo(null);
    setError("");
    setHover(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!autoOpen || !review) return;
    const frame = window.requestAnimationFrame(() => {
      setRating(review.rating || 0);
      setTitle(review.title || "");
      setComment(review.comment || "");
      setImages([]);
      setVideo(null);
      setError("");
      setOpen(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoOpen, review]);

  const closeModal = () => { if (!saving) setOpen(false); };

  const pickImages = (files) => {
    const selected = Array.from(files || []);
    const available = MAX_IMAGES - images.length - (rated ? (review?.images || []).length : 0);
    const list = selected.slice(0, Math.max(0, available));
    const invalid = selected.find((file) => !IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES);
    if (invalid) { setError(!IMAGE_TYPES.includes(invalid.type) ? `${invalid.name} is not a supported photo type.` : `${invalid.name} is larger than 10MB.`); }
    if (!list.length) { if (!invalid) setError("You can add up to 5 photos to a review."); return; }
    const valid = list.filter((file) => IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES);
    if (valid.length !== list.length) return;
    if (selected.length > list.length && !invalid) setError(`You can add ${available} more photo${available === 1 ? "" : "s"}.`);
    setImages((prev) => [...prev, ...valid]);
  };
  const removeImage = (i) => setImages((prev) => prev.filter((_, x) => x !== i));
  const pickVideo = (file) => {
    if (!file) return;
    if (!VIDEO_TYPES.includes(file.type)) { setError("Choose an MP4, WEBM, or MOV video."); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError("Videos must be 50MB or smaller."); return; }
    if (rated && (review?.videos || []).length) { setError("This review already has a video."); return; }
    setVideo(file); setError("");
  };
  const removeVideo = () => setVideo(null);

  const submit = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!rating) { setError("Please select a star rating."); return; }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("product_id", productId);
      fd.append("rating", String(rating));
      fd.append("title", title.trim());
      fd.append("comment", comment.trim());
      images.forEach((f) => fd.append("images", f));
      if (video) fd.append("videos", video);

      if (rated) {
        await reviewApi.update(review._id, fd);
        toast.success("Your rating was updated");
      } else {
        await reviewApi.create(fd);
        toast.success("Thanks for rating this product!");
      }
      await queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      if (onSaved) onSaved();
      setOpen(false);
    } catch (err) {
      setError(getReviewErrorMessage(err, "Could not save your rating. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (!productId) return null;
  // Product page par sirf apni rating dikhani hai — rating na ho to kuch nahi.
  if (variant === "detail" && !rated) return null;

  const modal = open ? (
    <RatingModal
      productName={productName}
      rated={rated}
      saving={saving}
      rating={rating}
      hover={hover}
      title={title}
      comment={comment}
      images={images}
      video={video}
      error={error}
      existingImages={rated ? (review?.images || []).length : 0}
      existingVideo={rated ? (review?.videos || []).length > 0 : false}
      onPick={setRating}
      onHover={setHover}
      onTitle={setTitle}
      onComment={setComment}
      onPickImages={pickImages}
      onRemoveImage={removeImage}
      onPickVideo={pickVideo}
      onRemoveVideo={removeVideo}
      onSubmit={submit}
      onClose={closeModal}
    />
  ) : null;

  const lightbox = preview ? <MediaLightbox preview={preview} onClose={() => setPreview(null)} /> : null;


  /* ---------- DETAIL variant — product page "Your rating" card ---------- */
  if (variant === "detail") {
    return (
      <>
        <section className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/25 flex items-center justify-center shrink-0">
                <Star size={20} className="fill-amber-400 text-amber-400" />
              </span>
              <div className="min-w-0">
                <p className="text-[0.625rem] font-black uppercase tracking-[0.14em] text-[var(--user-text-secondary)]">Your rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <StarRow value={review.rating} size={17} />
                  <span className="text-xs font-black text-[var(--user-text)]">{RATING_LABELS[review.rating]}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={openModal}
              className="h-9 px-4 rounded-xl border border-[var(--user-border)] text-[0.75rem] font-bold text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)] transition">
              Edit rating
            </button>
          </div>
          {(review.title || review.comment) ? (
            <div className="mt-3 pt-3 border-t border-[var(--user-border)] space-y-1">
              {review.title ? <p className="text-sm font-bold text-[var(--user-text)]">{review.title}</p> : null}
              {review.comment ? <p className="text-sm text-[var(--user-text-muted)] leading-relaxed">{review.comment}</p> : null}
            </div>
          ) : null}
          {savedCount > 0 ? (
            <div className="mt-3 pt-3 border-t border-[var(--user-border)]">
              <SavedMedia images={review.images} videos={review.videos} onPreview={setPreview} />
            </div>
          ) : null}
        </section>
        {modal}
        {lightbox}
      </>
    );
  }

  /* ---------- COMPACT variant — order items ---------- */
  return (
    <>
      {rated ? (
        <div className="mt-2 space-y-1.5">
          <div className="w-full rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <StarRow value={review.rating} size={11} />
              <p className="text-[0.5rem] sm:text-[0.5625rem] font-black text-amber-500 mt-0.5 truncate">
                You rated {review.rating}/5{savedCount > 0 ? ` \u00b7 ${savedCount} media` : ""}
              </p>
            </div>
            <button type="button" onClick={openModal}
              className="shrink-0 text-[0.5625rem] font-bold text-[var(--user-accent)] hover:underline">
              Edit
            </button>
          </div>
          {showMedia && savedCount > 0 ? (
            <SavedMedia images={review.images} videos={review.videos} onPreview={setPreview} />
          ) : null}
        </div>
      ) : (
        <button type="button" onClick={openModal}
          className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-lg bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[0.5625rem] sm:text-[0.625rem] font-black hover:opacity-90 active:scale-[0.98] transition">
          <Star size={11} className="fill-current" /> Rate this product
        </button>
      )}
      {modal}
      {lightbox}
    </>
  );
}
