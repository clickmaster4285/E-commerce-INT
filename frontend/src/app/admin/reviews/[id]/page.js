"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Eye, EyeOff, Mail, MessageSquareText, Star, UserRound } from "lucide-react";
import { toast } from "sonner";
import { adminReviewApi } from "@/apis/admin/reviewApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const mediaUrl = (value) => (!value ? "" : value.startsWith("http") ? value : `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`);
const card = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

function dateParts(value) {
  if (!value) return { day: "Date unavailable", full: "—" };
  const date = new Date(value);
  return {
    day: date.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    full: date.toLocaleString("en-PK", { hour: "numeric", minute: "2-digit", hour12: true }),
  };
}

export default function AdminReviewDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: review, isLoading, isError } = useQuery({ queryKey: ["adminReview", id], queryFn: () => adminReviewApi.get(id), enabled: !!id });
  const statusMutation = useMutation({
    mutationFn: (status) => adminReviewApi.setStatus(id, status),
    onSuccess: (_data, status) => {
      toast.success(status === "hidden" ? "Review hidden" : "Review visible");
      queryClient.invalidateQueries({ queryKey: ["adminReview", id] });
      queryClient.invalidateQueries({ queryKey: ["adminReviews"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not update review"),
  });

  if (isLoading || !id) {
    return (
      <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
        <div className="w-full space-y-5">
          <span className="skeleton inline-block h-4 w-24" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.8fr)]">
            <div className="space-y-5">
              <div className="rounded-lg p-5" style={card}>
                <span className="skeleton block h-6 w-40" />
                <span className="skeleton mt-4 block h-24 w-full" />
              </div>
            </div>
            <div className="rounded-lg p-5" style={card}>
              <span className="skeleton block h-5 w-28" />
              <span className="skeleton mt-4 block h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
        <div className="w-full space-y-5">
          <Link href="/admin/reviews" className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            <ArrowLeft size={15} /> Back to reviews
          </Link>
          <div className="rounded-lg p-8 text-center" style={card}>
            <h1 className="font-bold" style={{ color: "var(--text-primary)" }}>Review not found</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>This review may have been removed or is no longer available.</p>
          </div>
        </div>
      </div>
    );
  }

  const user = review.user_id && typeof review.user_id === "object" ? review.user_id : {};
  const product = review.product_id && typeof review.product_id === "object" ? review.product_id : {};
  const date = dateParts(review.created_at);
  const hidden = review.status === "hidden";
  const rating = Number(review.rating) || 0;
  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0">
            <Link href="/admin/reviews" className="inline-flex items-center gap-2 text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft size={15} /> All reviews
            </Link>
            <h1 className="mt-2 text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Review details</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>{product.name || "Product review"} · Submitted {date.day} at {date.full}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm font-bold" style={hidden ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" } : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
            {hidden ? "Hidden" : "Visible"}
          </span>
        </div>

        {/* ===== Body ===== */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.8fr)]">
          <section className="space-y-5">
            <article className="rounded-lg p-5" style={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={19} className={i < rating ? "fill-current" : "opacity-25"} />
                    ))}
                  </span>
                  <strong className="text-sm" style={{ color: "var(--text-primary)" }}>{rating}/5</strong>
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{review.title ? "Review" : "Rating"}</span>
              </div>
              {review.title ? <h2 className="mt-6 text-xl font-bold" style={{ color: "var(--text-primary)" }}>{review.title}</h2> : null}
              <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7" style={{ color: "var(--text-secondary)" }}>{review.comment || "No written comment was included with this rating."}</p>
            </article>
            {(review.images?.length || review.videos?.length) ? (
              <section className="rounded-lg p-5" style={card}>
                <h2 className="mb-4 text-sm font-bold" style={{ color: "var(--text-primary)" }}>Photos and videos</h2>
                <div className="flex flex-wrap gap-3">
                  {(review.images || []).map((image, i) => (
                    <a key={`image-${i}`} href={mediaUrl(image.img_url)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(image.img_url)} alt={`Review attachment ${i + 1}`} className="h-28 w-28 rounded-lg border object-cover" style={{ borderColor: "var(--border-color)" }} />
                    </a>
                  ))}
                  {(review.videos || []).map((video, i) => (
                    <video key={`video-${i}`} src={mediaUrl(video.video_url)} controls className="max-h-56 max-w-full rounded-lg" />
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5">
            <section className="rounded-lg p-5" style={card}>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Submitted by</h2>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full text-sm font-bold" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (user.name || "U").charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold" style={{ color: "var(--text-primary)" }}>{user.name || "Customer name unavailable"}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>Reviewer</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <p className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><Mail size={16} className="mt-0.5 shrink-0" /><span className="break-all">{user.email || "Email unavailable"}</span></p>
                <p className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><CalendarDays size={16} className="mt-0.5 shrink-0" /><span>{date.day}<br /><span className="text-xs" style={{ color: "var(--text-muted)" }}>{date.full}</span></span></p>
                <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><MessageSquareText size={16} /> {product.name || "Product unavailable"}</p>
                <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}><UserRound size={16} /> {review.verifiedPurchase ? "Verified purchase" : "Purchase not verified"}</p>
              </div>
            </section>

            <section className="rounded-lg p-5" style={card}>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Review visibility</h2>
              <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>Choose whether customers can see this review.</p>
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate(hidden ? "active" : "hidden")}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: hidden ? "var(--success-soft)" : "var(--warning-soft)", color: hidden ? "var(--success-text)" : "var(--warning-text)" }}
              >
                {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                {hidden ? "Make review visible" : "Hide review"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}


