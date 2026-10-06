"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  AlertTriangle,
  BadgeCheck,
  Loader2,
  Send,
  Eye,
  EyeOff,
  MessageSquareText,
  Package,
  ShoppingCart,
  Star,
  Pencil,
  Trash2,
  X,
  Image as ImageIcon,
  Film,
  User,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  Shield,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { adminReviewApi } from "@/apis/admin/reviewApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const mediaUrl = (value) =>
  !value ? "" : value.startsWith("http") ? value : `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PK", options);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function StarRating({ rating, size = 14, showValue = true }) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-px" aria-label={`${r} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={size}
            className={star <= r ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-[10px] font-bold text-[var(--text-muted)]">{r}/5</span>
      )}
    </div>
  );
}

function StatusPill({ hidden, size = "sm" }) {
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={hidden ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" } : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}
    >
      <span className={`rounded-full bg-current ${isSm ? "h-1 w-1" : "h-1.5 w-1.5"}`} />
      {hidden ? "Hidden" : "Visible"}
    </span>
  );
}

function VerifiedBadge({ verified }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={verified ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)" } : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
    >
      {verified ? <><BadgeCheck size={10} /> Verified</> : "Unverified"}
    </span>
  );
}

function buildSuggestedReply(review, customerName) {
  const rating = Number(review?.rating) || 0;
  const firstName = String(customerName || "").trim().split(/\s+/)[0];
  const title = String(review?.title || "").trim();
  const comment = String(review?.comment || "").trim();
  const commentExcerpt = comment.length > 220 ? `${comment.slice(0, 220).trimEnd()}…` : comment;
  const context = [title ? `Title: "${title}"` : "", commentExcerpt ? `Comment: "${commentExcerpt}"` : ""].filter(Boolean).join(" | ");
  const reviewContext = context ? ` Your review mentions ${context}.` : "";
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  if (rating <= 2) {
    return `${greeting}\n\nWe're sorry your experience did not meet expectations, and we acknowledge the concerns you raised.${reviewContext} Please contact our support team through the store's Contact page and include your order number. We'll look into this and explain the available next steps, including refund or replacement options where applicable.\n\nKind regards,\nCustomer Support`;
  }
  if (rating === 3) {
    return `${greeting}\n\nThank you for taking the time to share your feedback.${reviewContext} Your comments help us see where we can improve. If there is anything about your order that needs attention, please contact our support team through the store's Contact page.\n\nKind regards,\nCustomer Support`;
  }
  return `${greeting}\n\nThank you for your ${rating}-star review and for sharing your experience.${reviewContext} We're delighted to hear about your positive experience, and we truly appreciate your support.\n\nKind regards,\nCustomer Support`;
}

export default function AdminReviewDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [responseDraft, setResponseDraft] = useState("");
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [isDeleteResponseConfirmOpen, setIsDeleteResponseConfirmOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const responseDraftRef = React.useRef("");

  const initResponseDraft = React.useCallback((message) => {
    responseDraftRef.current = message || "";
    setResponseDraft(message || "");
  }, []);

  const { data: review, isLoading, isError } = useQuery({
    queryKey: ["adminReview", id],
    queryFn: () => adminReviewApi.get(id),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status) => adminReviewApi.setStatus(id, status),
    onSuccess: (_data, status) => {
      toast.success(status === "hidden" ? "Review hidden" : "Review visible");
      queryClient.invalidateQueries({ queryKey: ["adminReview", id] });
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not update review"),
  });

  const responseMutation = useMutation({
    mutationFn: (message) => adminReviewApi.setResponse(id, message),
    onSuccess: (savedReview, message) => {
      const storeResponse = savedReview?.storeResponse || {
        message,
        responded_at: new Date().toISOString(),
        responded_by_name: "Store Support",
      };
      queryClient.setQueryData(["adminReview", id], (current) =>
        current ? { ...current, storeResponse, updated_at: savedReview?.updated_at || current.updated_at } : savedReview
      );
      initResponseDraft(storeResponse.message);
      setIsEditingResponse(false);
      toast.success("Store response saved");
      queryClient.invalidateQueries({ queryKey: ["adminReview", id] });
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Could not publish response"),
  });

  const deleteResponseMutation = useMutation({
    mutationFn: () => adminReviewApi.deleteResponse(id),
    onSuccess: () => {
      queryClient.setQueryData(["adminReview", id], (current) => (current ? { ...current, storeResponse: null } : current));
      initResponseDraft("");
      setIsEditingResponse(false);
      setIsDeleteResponseConfirmOpen(false);
      toast.success("Store response deleted");
      queryClient.invalidateQueries({ queryKey: ["adminReview", id] });
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not delete response"),
  });

  if (isLoading || !id) {
    return (
      <div className="w-full space-y-4">
        <div className="flex items-center gap-3">
          <span className="skeleton h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <span className="skeleton block h-4 w-36" />
            <span className="skeleton block h-3 w-48" />
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,.82fr)]">
          <div className="skeleton h-[420px] rounded-lg" />
          <div className="skeleton h-[420px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="w-full space-y-4">
        <Link href="/admin/reviews" className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
          <ArrowLeft size={14} /> Back to reviews
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)]">
            <MessageSquareText size={22} className="text-[var(--text-muted)]" />
          </div>
          <h1 className="mt-3 text-base font-bold text-[var(--text-primary)]">Review not found</h1>
          <p className="mt-1.5 max-w-xs text-xs text-[var(--text-muted)]">
            This review may have been removed or is no longer available.
          </p>
          <Link href="/admin/reviews" className="mt-4 inline-flex h-9 items-center rounded-lg px-4 text-xs font-bold text-white" style={{ backgroundColor: "var(--accent)" }}>
            View all reviews
          </Link>
        </div>
      </div>
    );
  }

  const user = review.user_id && typeof review.user_id === "object" ? review.user_id : {};
  const product = review.product_id && typeof review.product_id === "object" ? review.product_id : {};
  const hidden = review.status === "hidden";
  const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
  const productId = product._id || (typeof review.product_id === "string" ? review.product_id : null);
  const orderId = review.relatedOrder?._id || null;
  const reviewerName = user.name || "Customer name unavailable";
  const attachments = [
    ...(review.images || []).map((image, index) => ({ key: `image-${index}`, type: "image", url: mediaUrl(image.img_url), index })),
    ...(review.videos || []).map((video, index) => ({ key: `video-${index}`, type: "video", url: mediaUrl(video.video_url), index })),
  ];
  const customerReviews = review.customerReviews || [];

  const handlePublishResponse = () => {
    const message = responseDraft.trim();
    if (!message) {
      toast.error("Write a response before publishing.");
      return;
    }
    if (message.length > 1000) {
      toast.error("Response must be 1,000 characters or fewer.");
      return;
    }
    responseMutation.mutate(message);
  };

  return (
    <div className="w-full space-y-4 pb-6">
      {/* Header */}
      <header className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/reviews"
              aria-label="Back to reviews"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-color)] transition hover:opacity-70"
              style={{ color: "var(--text-secondary)" }}
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-bold tracking-tight text-[var(--text-primary)]">Review Details</h1>
                <StatusPill hidden={hidden} size="md" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-11 md:pl-0">
            {productId ? (
              <Link
                href={`/admin/products/${productId}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <Package size={14} /> View Product
              </Link>
            ) : null}
            {orderId ? (
              <Link
                href={`/admin/orders/${orderId}`}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <ShoppingCart size={14} /> View Order
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="No matching order is linked to this review"
                className="inline-flex h-9 cursor-not-allowed items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3.5 text-xs font-semibold text-[var(--text-muted)] opacity-70"
              >
                <ShoppingCart size={14} /> View Order
              </button>
            )}
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(hidden ? "active" : "hidden")}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {hidden ? <Eye size={13} /> : <EyeOff size={13} />}
              {statusMutation.isPending ? "Updating…" : hidden ? "Make Visible" : "Hide Review"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(260px,.82fr)]">
        {/* Left Column */}
        <main className="space-y-4">
          {/* Review Content */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {user.avatar ? <img src={mediaUrl(user.avatar)} alt="" className="h-full w-full object-cover" /> : reviewerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{reviewerName}</h2>
                  </div>
                  <div className="mt-1">
                    <StarRating rating={rating} size={15} showValue={false} />
                  </div>
                </div>
              </div>
            </div>

            {review.title && (
              <div className="mt-3.5 rounded-md border-l-2 border-[var(--accent)] bg-[var(--bg-tertiary)]/60 px-3 py-2">
                <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{review.title}</h3>
              </div>
            )}

            {review.comment && (
              <div className="mt-3">
                <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--text-secondary)]">
                  {review.comment}
                </p>
              </div>
            )}

            {attachments.length ? (
              <div className="mt-3.5">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((item) => (
                    <div
                      key={item.key}
                      className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-[var(--border-color)] transition hover:border-[var(--accent)]/40"
                      style={{ backgroundColor: "var(--bg-tertiary)" }}
                    >
                      {item.type === "image" ? (
                        <button
                          type="button"
                          onClick={() => setLightboxMedia({ type: "image", url: item.url })}
                          className="block h-full w-full"
                        >
                          <img
                            src={item.url}
                            alt={`Review photo ${item.index + 1}`}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                            <ExternalLink size={14} className="text-white" />
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setLightboxMedia({ type: "video", url: item.url })}
                          className="block h-full w-full"
                        >
                          <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                              <Play size={12} className="ml-0.5 fill-[var(--text-primary)] text-[var(--text-primary)]" />
                            </span>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>

          {/* Store Response */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-color)] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                  <MessageSquareText size={14} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[12px] font-bold text-[var(--text-primary)]">Store Response</h2>
                    {review.storeResponse?.message && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
                        Published
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {review.storeResponse?.message ? (
                  <>
                    <button
                      type="button"
                      disabled={responseMutation.isPending || deleteResponseMutation.isPending}
                      onClick={() => {
                        initResponseDraft(review.storeResponse.message);
                        setIsEditingResponse(true);
                        document.getElementById("review-store-response")?.focus();
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-color)] px-2 text-[10px] font-semibold transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={responseMutation.isPending || deleteResponseMutation.isPending}
                      onClick={() => setIsDeleteResponseConfirmOpen(true)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ borderColor: "var(--danger-soft)", backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}
                    >
                      {deleteResponseMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    </button>
                  </>
                ) : null}
                {(!review.storeResponse?.message || isEditingResponse) && (
                  <button
                    type="button"
                    disabled={responseMutation.isPending}
                    onClick={() => initResponseDraft(buildSuggestedReply(review, user.name))}
                    className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-[var(--accent-soft)] bg-[var(--accent-soft)] px-2 text-[10px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ color: "var(--accent)" }}
                  >
                    <Sparkles size={11} /> Suggested Reply
                  </button>
                )}
              </div>
            </div>

            <div className="p-3.5 sm:p-4">
              {review.storeResponse?.message && !isEditingResponse ? (
                <div className="rounded-md border-l-2 border-[var(--accent)] bg-[var(--bg-tertiary)] p-3">
                  <p className="whitespace-pre-wrap break-words text-[12px] leading-5 text-[var(--text-primary)]">
                    {review.storeResponse.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[var(--text-muted)]">
                    <span className="inline-flex items-center gap-1">
                      <User size={9} />
                      Published by {review.storeResponse.responded_by_name || "Store Support"}
                    </span>
                    {review.storeResponse.responded_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={9} />
                        {formatDateTime(review.storeResponse.responded_at)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {(!review.storeResponse?.message || isEditingResponse) && (
                <div className="space-y-2.5">
                  <label htmlFor="review-store-response" className="sr-only">
                    Store response message
                  </label>
                  <textarea
                    id="review-store-response"
                    value={responseDraft}
                    onChange={(event) => initResponseDraft(event.target.value.slice(0, 1000))}
                    disabled={responseMutation.isPending}
                    maxLength={1000}
                    rows={4}
                    placeholder="Write a thoughtful response to this customer…"
                    className="min-h-28 w-full resize-y rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-[12px] leading-5 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1.5 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--text-secondary)]">{responseDraft.length}/1,000</span> chars
                    </div>
                    <div className="flex items-center gap-1.5">
                      {review.storeResponse?.message && isEditingResponse && (
                        <button
                          type="button"
                          disabled={responseMutation.isPending}
                          onClick={() => {
                            initResponseDraft(review.storeResponse.message);
                            setIsEditingResponse(false);
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border-color)] px-2.5 text-[10px] font-semibold transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}
                        >
                          <X size={11} /> Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={responseMutation.isPending}
                        onClick={handlePublishResponse}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ backgroundColor: "var(--accent)" }}
                      >
                        {responseMutation.isPending ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            {review.storeResponse?.message ? "Updating…" : "Publishing…"}
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            {review.storeResponse?.message ? "Update" : "Publish"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* All Reviews by This Customer */}
          {customerReviews.length > 0 && (
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">All Reviews by This Customer</h3>
                <span className="text-[10px] text-[var(--text-muted)]">{customerReviews.length} more</span>
              </div>
              <div className="space-y-2">
                {customerReviews.map((customerReview) => {
                  const relatedProduct = customerReview.product_id && typeof customerReview.product_id === "object"
                    ? customerReview.product_id
                    : {};
                  const relatedRating = Math.max(0, Math.min(5, Number(customerReview.rating) || 0));
                  return (
                    <Link
                      key={customerReview._id}
                      href={`/admin/reviews/${customerReview._id}`}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 transition hover:border-[var(--accent)]/30"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-[var(--text-primary)]">{relatedProduct.name || "Product unavailable"}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                          {customerReview.title || customerReview.comment || "No written comment"}
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          <StarRating rating={relatedRating} size={10} showValue={false} />
                          <span className="text-[10px] font-semibold text-[var(--text-muted)]">{relatedRating}/5</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill hidden={customerReview.status === "hidden"} />
                        <span className="text-[10px] text-[var(--text-muted)]">{formatDate(customerReview.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Right Column */}
        <aside className="space-y-4">
          {/* Customer Information */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-color)] px-3.5 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Customer Information</h3>
            </div>
            <div className="p-3.5">
              <div className="flex flex-col items-center gap-2.5 border-b border-[var(--border-color)] pb-3">
                <div
                  className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full text-base font-bold"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {user.avatar ? <img src={mediaUrl(user.avatar)} alt="" className="h-full w-full object-cover" /> : reviewerName.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-[12px] font-bold text-[var(--text-primary)]">{reviewerName}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    <Mail size={10} /> Email
                  </span>
                  {user.email ? (
                    <a href={`mailto:${user.email}`} className="text-[11px] font-bold hover:underline" style={{ color: "var(--accent)" }}>{user.email}</a>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    <Phone size={10} /> Phone
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{user.phone || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    <Calendar size={10} /> Joined
                  </span>
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">{user.created_at ? formatDate(user.created_at) : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Information */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-color)] px-3.5 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Product Information</h3>
            </div>
            <div className="p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                  {product.image ? (
                    <img src={mediaUrl(product.image)} alt="" className="h-full w-full rounded-md object-cover" />
                  ) : (
                    <Package size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-[var(--text-primary)]">{product.name || "Product unavailable"}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">ID: {productId || "—"}</p>
                </div>
              </div>
              {productId && (
                <Link
                  href={`/admin/products/${productId}`}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                >
                  <Package size={13} /> View Product
                </Link>
              )}
            </div>
          </div>

          {/* Review Information */}
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="border-b border-[var(--border-color)] px-3.5 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Review Information</h3>
            </div>
            <div className="p-3.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Posted On</span>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">{formatDateTime(review.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Review ID</span>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">{review._id}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Purchase</span>
                <VerifiedBadge verified={review.verifiedPurchase} />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(hidden ? "active" : "hidden")}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border-color)] px-2 text-[10px] font-bold transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--bg-card)", color: hidden ? "var(--success-text)" : "var(--warning-text)" }}
            >
              {hidden ? <Eye size={11} /> : <EyeOff size={11} />}
              {hidden ? "Show" : "Hide"}
            </button>
            <Link
              href="/admin/reviews"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border-color)] px-2 text-[10px] font-bold transition hover:bg-[var(--bg-tertiary)]"
              style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }}
            >
              <MessageSquareText size={11} /> All Reviews
            </Link>
          </div>
        </aside>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteResponseConfirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteResponseMutation.isPending) {
              setIsDeleteResponseConfirmOpen(false);
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-response-title"
            aria-describedby="delete-response-description"
            className="w-full max-w-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-2xl"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}>
                <AlertTriangle size={18} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-response-title" className="text-[12px] font-bold text-[var(--text-primary)]">
                  Delete this store response?
                </h2>
                <p id="delete-response-description" className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  Customers will no longer see it.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={deleteResponseMutation.isPending}
                onClick={() => setIsDeleteResponseConfirmOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-md text-[11px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteResponseMutation.isPending}
                onClick={() => deleteResponseMutation.mutate()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: "var(--danger-text)" }}
              >
                {deleteResponseMutation.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Deleting…
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Media Lightbox */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxMedia(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxMedia(null)}
            className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Close lightbox"
          >
            <X size={18} />
          </button>
          {lightboxMedia.type === "video" ? (
            <video
              src={lightboxMedia.url}
              controls
              autoPlay
              playsInline
              className="max-w-[92vw] max-h-[85vh] rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxMedia.url}
              alt=""
              className="max-w-[92vw] max-h-[85vh] object-contain rounded-md"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
