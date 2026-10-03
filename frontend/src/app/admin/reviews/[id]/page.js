"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowUpRight, AlertTriangle, BadgeCheck, Check, Loader2, Send,
  Eye, EyeOff, MessageSquareText, Package, ShieldCheck, Star, Pencil, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { adminReviewApi } from "@/apis/admin/reviewApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const mediaUrl = (value) => (!value ? "" : value.startsWith("http") ? value : `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`);
const card = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

function formatDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-PK", options);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DetailRow({ label, children }) {
  return <div className="grid grid-cols-[minmax(75px,.7fr)_minmax(0,1.3fr)] gap-3 text-[12px]"><dt style={{ color: "var(--text-muted)" }}>{label}</dt><dd className="min-w-0 break-words font-medium" style={{ color: "var(--text-secondary)" }}>{children || "—"}</dd></div>;
}

function StatusPill({ hidden }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={hidden ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" } : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
    {hidden ? <EyeOff size={12} /> : <Eye size={12} />}{hidden ? "Hidden" : "Visible"}
  </span>;
}

function buildSuggestedReply(review, customerName) {
  const rating = Number(review?.rating) || 0;
  const firstName = String(customerName || "").trim().split(/\s+/)[0];
  const title = String(review?.title || "").trim();
  const comment = String(review?.comment || "").trim();
  const commentExcerpt = comment.length > 220 ? `${comment.slice(0, 220).trimEnd()}…` : comment;
  const context = [
    title ? `Title: “${title}”` : "",
    commentExcerpt ? `Comment: “${commentExcerpt}”` : "",
  ].filter(Boolean).join(" | ");
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
  const { data: review, isLoading, isError } = useQuery({ queryKey: ["adminReview", id], queryFn: () => adminReviewApi.get(id), enabled: !!id });
  useEffect(() => {
    setResponseDraft(review?.storeResponse?.message || "");
  }, [id, review?.storeResponse?.message]);
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
      queryClient.setQueryData(["adminReview", id], (current) => current
        ? { ...current, storeResponse, updated_at: savedReview?.updated_at || current.updated_at }
        : savedReview);
      setResponseDraft(storeResponse.message);
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
      queryClient.setQueryData(["adminReview", id], (current) => current ? { ...current, storeResponse: null } : current);
      setResponseDraft("");
      setIsEditingResponse(false);
      setIsDeleteResponseConfirmOpen(false);
      toast.success("Store response deleted");
      queryClient.invalidateQueries({ queryKey: ["adminReview", id] });
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not delete response"),
  });

  if (isLoading || !id) return (
    <div className="w-full space-y-5" style={{ color: "var(--text-primary)" }}>
      <span className="skeleton block h-4 w-48" />
      <span className="skeleton block h-9 w-64" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,.82fr)]"><div className="skeleton h-[420px] rounded-xl" /><div className="skeleton h-[420px] rounded-xl" /></div>
    </div>
  );

  if (isError || !review) return (
    <div className="w-full space-y-5" style={{ color: "var(--text-primary)" }}>
      <Link href="/admin/reviews" className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--accent)" }}><ArrowLeft size={15} /> Back to reviews</Link>
      <div className="rounded-xl p-8 text-center" style={card}><h1 className="font-bold">Review not found</h1><p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>This review may have been removed or is no longer available.</p></div>
    </div>
  );

  const user = review.user_id && typeof review.user_id === "object" ? review.user_id : {};
  const product = review.product_id && typeof review.product_id === "object" ? review.product_id : {};
  const hidden = review.status === "hidden";
  const rating = Math.max(0, Math.min(5, Number(review.rating) || 0));
  const productId = product._id || (typeof review.product_id === "string" ? review.product_id : null);
  const reviewerName = user.name || "Customer name unavailable";
  const attachments = [
    ...(review.images || []).map((image, index) => ({ key: `image-${index}`, type: "image", url: mediaUrl(image.img_url), index })),
    ...(review.videos || []).map((video, index) => ({ key: `video-${index}`, type: "video", url: mediaUrl(video.video_url), index })),
  ];
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
  const confirmDeleteResponse = () => deleteResponseMutation.mutate();

  return (
    <div className="w-full space-y-4 pb-8" style={{ color: "var(--text-primary)" }}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        <Link href="/admin/reviews" className="transition hover:opacity-70">Reviews</Link><span>/</span><span style={{ color: "var(--text-secondary)" }}>Review details</span>
      </nav>

      <header className="flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/admin/reviews" aria-label="Back to reviews" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:opacity-75" style={{ ...card, color: "var(--text-secondary)" }}><ArrowLeft size={16} /></Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[21px] font-bold tracking-tight">Review Details</h1><StatusPill hidden={hidden} /></div>
            <p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>Review ID: {review._id} <span className="mx-1">·</span> Posted {formatDateTime(review.created_at)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-12 md:pl-0">
          {productId ? <Link href={`/product/${productId}`} target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition hover:opacity-80" style={{ ...card, color: "var(--text-secondary)" }}><Eye size={14} /> View on Store</Link> : null}
          <button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(hidden ? "active" : "hidden")} className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "var(--accent)" }}>
            {hidden ? <Eye size={14} /> : <EyeOff size={14} />}{statusMutation.isPending ? "Updating…" : hidden ? "Make Visible" : "Hide Review"}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,.82fr)]">
        <main className="space-y-4">
          <article className="rounded-xl p-4 sm:p-5" style={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                  {user.avatar ? <img src={mediaUrl(user.avatar)} alt="" className="h-full w-full object-cover" /> : reviewerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">{reviewerName}{review.verifiedPurchase ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: "var(--success-text)" }}><BadgeCheck size={13} /> Verified Buyer</span> : null}</p>
                  <div className="mt-1 flex items-center gap-2"><span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} className={star <= rating ? "fill-current" : "opacity-25"} />)}</span><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{rating} / 5</span></div>
                </div>
              </div>
              <StatusPill hidden={hidden} />
            </div>

            {review.title ? <h2 className="mt-5 text-base font-bold">{review.title}</h2> : null}
            <p className={`whitespace-pre-wrap break-words text-[13px] leading-6 ${review.title ? "mt-1.5" : "mt-5"}`} style={{ color: "var(--text-secondary)" }}>{review.comment || "No written comment was included with this rating."}</p>

            {attachments.length ? <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1" aria-label="Review photos and videos">
              {attachments.map((item) => <div key={item.key} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                {item.type === "image" ? <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open review photo ${item.index + 1}`} className="block h-full w-full"><img src={item.url} alt={`Review photo ${item.index + 1}`} className="h-full w-full object-cover" /></a> : <video src={item.url} controls preload="metadata" aria-label={`Review video ${item.index + 1}`} className="h-full w-full object-cover" />}
              </div>)}
            </div> : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}><ShieldCheck size={13} /> Moderation tools are in the header</span>
            </div>
          </article>

          <section className="rounded-xl border-l-[3px] p-4 shadow-sm sm:p-5" style={{ ...card, borderLeftColor: "var(--accent)" }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}><MessageSquareText size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold">Store response</h2>
                      {review.storeResponse?.message ? <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>Published</span> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>Reply publicly as your store. Keep it helpful, respectful, and specific.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {review.storeResponse?.message ? <>
                      <button type="button" disabled={responseMutation.isPending || deleteResponseMutation.isPending} onClick={() => { setResponseDraft(review.storeResponse.message); setIsEditingResponse(true); document.getElementById("review-store-response")?.focus(); }} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}><Pencil size={14} /> Edit reply</button>
                      <button type="button" disabled={responseMutation.isPending || deleteResponseMutation.isPending} onClick={() => setIsDeleteResponseConfirmOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ borderColor: "var(--danger-soft)", backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}>{deleteResponseMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete reply</button>
                    </> : null}
                    {(isEditingResponse || !review.storeResponse?.message) ? <button type="button" disabled={responseMutation.isPending} onClick={() => setResponseDraft(buildSuggestedReply(review, user.name))} className="inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-semibold transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50" style={{ borderColor: "var(--accent-soft)", backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>Use suggested reply</button> : null}
                  </div>
                </div>
                {review.storeResponse?.message ? <div className="mt-4 rounded-lg border-l-2 p-3.5" style={{ borderColor: "var(--accent-soft)", backgroundColor: "var(--bg-tertiary)" }}><p className="whitespace-pre-wrap break-words text-sm leading-6" style={{ color: "var(--text-primary)" }}>{review.storeResponse.message}</p><p className="mt-2 border-t pt-2 text-[11px]" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>Published by {review.storeResponse.responded_by_name || "Store Support"}{review.storeResponse.responded_at ? ` · ${formatDateTime(review.storeResponse.responded_at)}` : ""}</p></div> : null}
                {(!review.storeResponse?.message || isEditingResponse) ? <>
                <label htmlFor="review-store-response" className="sr-only">Store response message</label>
                <textarea id="review-store-response" value={responseDraft} onChange={(event) => setResponseDraft(event.target.value.slice(0, 1000))} disabled={responseMutation.isPending} maxLength={1000} rows={5} placeholder="Write a thoughtful response to this customer…" className="mt-4 min-h-36 w-full resize-y rounded-lg border px-3.5 py-3 text-sm leading-6 outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:opacity-60" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}><span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{responseDraft.length}/1,000</span> characters <span className="mx-1">·</span> Customers will see this after publishing</div>
                  <div className="flex items-center gap-2">
                    {review.storeResponse?.message ? <button type="button" disabled={responseMutation.isPending} onClick={() => { setResponseDraft(review.storeResponse.message); setIsEditingResponse(false); }} className="inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}><X size={14} /> Cancel</button> : null}
                    <button type="button" disabled={responseMutation.isPending} onClick={handlePublishResponse} className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: "var(--accent)" }}>{responseMutation.isPending ? <><Loader2 size={15} className="animate-spin" />{review.storeResponse?.message ? "Updating…" : "Publishing…"}</> : <><Send size={15} />{review.storeResponse?.message ? "Update response" : "Publish response"}</>}</button>
                  </div>
                </div>
                </> : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl p-4 sm:p-5" style={card}>
            <h2 className="text-[13px] font-bold">Order Delivery Verification</h2>
            <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>This review is tied to the customer’s purchase eligibility.</p>
            <div className="mt-4 flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: review.verifiedPurchase ? "var(--success-soft)" : "var(--bg-tertiary)" }}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: review.verifiedPurchase ? "var(--success)" : "var(--border-color)", color: "white" }}>{review.verifiedPurchase ? <Check size={14} /> : <Package size={13} />}</span>
              <div><p className="text-xs font-bold" style={{ color: review.verifiedPurchase ? "var(--success-text)" : "var(--text-secondary)" }}>{review.verifiedPurchase ? "Verified purchase" : "Purchase not verified"}</p><p className="mt-0.5 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>{review.verifiedPurchase ? "The customer had a delivered order for this product when the review was submitted." : "This review is not marked as coming from a verified purchase."}</p></div>
            </div>
          </section>

          <section className="rounded-xl p-4 sm:p-5" style={card}>
            <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[13px] font-bold">All Reviews by This Customer</h2><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{review.customerReviews?.length || 0} more</span></div>
            {review.customerReviews?.length ? <div className="space-y-2">
              {review.customerReviews.map((customerReview) => {
                const relatedProduct = customerReview.product_id && typeof customerReview.product_id === "object" ? customerReview.product_id : {};
                return <Link key={customerReview._id} href={`/admin/reviews/${customerReview._id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg p-3 transition hover:opacity-80" style={{ ...card }}>
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{relatedProduct.name || "Product unavailable"}</p><p className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{customerReview.title || customerReview.comment || "No written comment"}</p><span className="mt-1 inline-flex items-center gap-0.5 text-amber-500">{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={11} className={star <= (Number(customerReview.rating) || 0) ? "fill-current" : "opacity-25"} />)}<span className="ml-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{Number(customerReview.rating) || 0}/5</span></span></div>
                  <div className="flex shrink-0 items-center gap-2"><StatusPill hidden={customerReview.status === "hidden"} /><span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatDate(customerReview.created_at)}</span></div>
                </Link>;
              })}
            </div> : <p className="rounded-lg px-3 py-4 text-center text-[11px]" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>No other reviews from this customer.</p>}
          </section>
        </main>

        <aside className="rounded-xl p-4 sm:p-5" style={card}>
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[12px] font-bold">Customer Information</h2><span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>Reviewer</span></div>
            <dl className="space-y-2.5">
              <DetailRow label="Name">{user.name}</DetailRow>
              <DetailRow label="Email">{user.email ? <a href={`mailto:${user.email}`} className="hover:underline">{user.email}</a> : null}</DetailRow>
              <DetailRow label="Phone">{user.phone || null}</DetailRow>
              <DetailRow label="Joined">{user.created_at ? formatDate(user.created_at) : null}</DetailRow>
            </dl>
          </section>

          <section className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
            <h2 className="mb-3 text-[12px] font-bold">Product Information</h2>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}><Package size={21} /></span>
              <div className="min-w-0"><p className="truncate text-xs font-bold">{product.name || "Product unavailable"}</p><p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Product ID: {productId || "—"}</p></div>
            </div>
            {productId ? <Link href={`/product/${productId}`} target="_blank" className="mt-3 inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold" style={{ ...card, color: "var(--text-secondary)" }}>View Product <ArrowUpRight size={12} /></Link> : null}
          </section>

          <section className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
            <h2 className="mb-3 text-[12px] font-bold">Review Information</h2>
            <dl className="space-y-2.5">
              <DetailRow label="Status"><StatusPill hidden={hidden} /></DetailRow>
              <DetailRow label="Posted On">{formatDateTime(review.created_at)}</DetailRow>
              <DetailRow label="Review ID">{review._id}</DetailRow>
              <DetailRow label="Rating">{rating} / 5</DetailRow>
              <DetailRow label="Purchase"><span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold" style={review.verifiedPurchase ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)" } : { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{review.verifiedPurchase ? <><BadgeCheck size={11} /> Verified</> : "Unverified"}</span></DetailRow>
            </dl>
          </section>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
            <button type="button" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(hidden ? "active" : "hidden")} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition hover:opacity-80 disabled:opacity-50" style={{ border: "1px solid var(--border-color)", color: hidden ? "var(--success-text)" : "var(--warning-text)" }}>{hidden ? <Eye size={12} /> : <EyeOff size={12} />}{hidden ? "Show Review" : "Hide Review"}</button>
            <Link href="/admin/reviews" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] font-bold transition hover:opacity-80" style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}><MessageSquareText size={12} /> All Reviews</Link>
          </div>
        </aside>
      </div>
      {isDeleteResponseConfirmOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteResponseMutation.isPending) setIsDeleteResponseConfirmOpen(false); }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-response-title" aria-describedby="delete-response-description" className="w-full max-w-sm rounded-xl border p-5 shadow-2xl" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}><AlertTriangle size={19} /></span>
            <div className="min-w-0"><h2 id="delete-response-title" className="text-sm font-bold">Delete this store response?</h2><p id="delete-response-description" className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Customers will no longer see it.</p></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" disabled={deleteResponseMutation.isPending} onClick={() => setIsDeleteResponseConfirmOpen(false)} className="inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition hover:opacity-80 disabled:opacity-60" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>Cancel</button>
            <button type="button" disabled={deleteResponseMutation.isPending} onClick={confirmDeleteResponse} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: "var(--danger-text)" }}>{deleteResponseMutation.isPending ? <><Loader2 size={15} className="animate-spin" /> Deleting…</> : "Delete"}</button>
          </div>
        </section>
      </div> : null}
    </div>
  );
}
