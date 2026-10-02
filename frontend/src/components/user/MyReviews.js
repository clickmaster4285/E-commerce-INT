"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { reviewApi } from "@/apis/user/reviewApi";
import { orderApi } from "@/apis/user/orderApi";
import { CalendarDays, Loader2, MessageSquareText, Package, Pencil, Play, Star, Trash2 } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const mediaUrl = (value) => {
  const raw = typeof value === "string" ? value : value?.img_url;
  return !raw ? "" : raw.startsWith("http") ? raw : `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};
const dateLabel = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Date unavailable";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const productIdOf = (value) => String(value?._id || value || "");

function ReviewMedia({ images = [], videos = [] }) {
  const media = [
    ...images.map((item) => ({ type: "image", url: mediaUrl(item.img_url) })),
    ...videos.map((item) => ({ type: "video", url: mediaUrl(item.video_url) })),
  ].filter((item) => item.url);
  if (!media.length) return null;
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Review photos and videos">
      {media.map((item, index) => (
        <a key={`${item.type}-${index}`} href={item.url} target="_blank" rel="noreferrer" className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]">
          {item.type === "video" ? <><video src={item.url} muted preload="metadata" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/25"><Play size={17} className="fill-white text-white" /></span></> : <img src={item.url} alt={`Review media ${index + 1}`} className="h-full w-full object-cover" />}
        </a>
      ))}
    </div>
  );
}

export default function MyReviews() {
  const queryClient = useQueryClient();
  const { data: reviews = [], isLoading, isError } = useQuery({ queryKey: ["myReviews"], queryFn: reviewApi.mine });
  const { data: orders = [] } = useQuery({ queryKey: ["myOrders"], queryFn: orderApi.myOrders });
  const orderItems = orders.flatMap((order) => (order.items || []).map((item) => ({ order, item })));
  const removeReview = async (review) => {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    try {
      await reviewApi.remove(review._id);
      await queryClient.invalidateQueries({ queryKey: ["myReviews"] });
      toast.success("Review deleted");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not delete the review");
    }
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-1 border-b border-[var(--user-border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--user-accent)]">Your feedback</p><h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--user-text)] sm:text-3xl">My Reviews</h1><p className="mt-1 text-sm text-[var(--user-text-muted)]">Manage and edit the reviews you have left</p></div>
        {!isLoading && !isError && <span className="inline-flex w-fit items-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-1 text-xs font-bold text-[var(--user-text-secondary)]">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>}
      </header>

      {isLoading ? <div className="flex min-h-48 items-center justify-center"><Loader2 size={26} className="animate-spin text-[var(--user-accent)]" /></div>
        : isError ? <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-8 text-center text-sm text-[var(--user-text-muted)]">Your reviews could not be loaded. Please try again.</div>
          : reviews.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-12 text-center"><MessageSquareText size={28} className="mx-auto text-[var(--user-text-subtle)]" /><h2 className="mt-3 font-bold text-[var(--user-text)]">No reviews yet</h2><p className="mt-1 text-sm text-[var(--user-text-muted)]">After a delivered order, you can share your experience here.</p><Link href="/orders" className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--user-accent)] px-4 text-sm font-bold text-[var(--user-accent-text)]">View orders</Link></div>
            : <div className="space-y-4">{reviews.map((review) => {
              const pid = productIdOf(review.product_id);
              const match = orderItems.find(({ item }) => productIdOf(item.product_id) === pid);
              const productName = match?.item?.name || review.product_id?.name || "Product review";
              const productImage = mediaUrl(match?.item?.image || review.product_id?.image || "");
              const published = review.status === "hidden" ? "Hidden" : "Published";
              return <article key={review._id} className="overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm transition hover:border-[var(--user-accent)]/30">
                <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[150px_minmax(0,1fr)_148px] md:gap-5">
                  <div className="flex gap-3 md:block">
                    <Link href={pid ? `/product/${pid}` : "/orders"} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] sm:h-24 sm:w-24 md:h-[150px] md:w-[150px]">
                      {productImage ? <img src={productImage} alt={productName} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center"><Package size={26} className="text-[var(--user-text-subtle)]" /></span>}
                    </Link>
                    <div className="min-w-0 self-center md:mt-2"><Link href={pid ? `/product/${pid}` : "/orders"} className="line-clamp-2 text-sm font-bold text-[var(--user-text)] hover:text-[var(--user-accent)]">{productName}</Link><p className="mt-1 text-xs text-[var(--user-text-muted)]">Order date: <span className="text-[var(--user-text-secondary)]">{dateLabel(match?.order?.created_at || match?.order?.order_date)}</span></p></div>
                  </div>
                  <div className="min-w-0 border-t border-[var(--user-border)] pt-4 md:border-0 md:pt-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${review.rating} out of 5 stars`}>{[1,2,3,4,5].map((star) => <Star key={star} size={16} className={star <= review.rating ? "fill-current" : "text-[var(--user-text-subtle)]"} />)}</span><span className="rounded-full border border-[var(--user-success)]/30 bg-[var(--user-success)]/10 px-2.5 py-1 text-[0.625rem] font-bold text-[var(--user-success)]">{review.rating === 5 ? "Excellent" : review.rating >= 4 ? "Very good" : review.rating >= 3 ? "Good" : review.rating >= 2 ? "Fair" : "Poor"}</span></div>
                    {review.title && <h2 className="mt-3 break-words text-base font-bold text-[var(--user-text)]">{review.title}</h2>}
                    {review.comment && <p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-[var(--user-text-secondary)]">{review.comment}</p>}
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--user-text-muted)]"><CalendarDays size={13} /> Posted {dateLabel(review.created_at)}</p>
                    <ReviewMedia images={review.images} videos={review.videos} />
                    {review.storeResponse?.message ? <div className="mt-4 rounded-xl border border-[var(--user-accent)]/20 bg-[var(--user-accent)]/5 p-3.5"><div className="flex items-center gap-2 text-xs font-bold text-[var(--user-accent)]"><MessageSquareText size={14} /> Store response</div><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[var(--user-text-secondary)]">{review.storeResponse.message}</p><p className="mt-2 text-[0.625rem] text-[var(--user-text-muted)]">{review.storeResponse.responded_by_name || "Store Support"}{review.storeResponse.responded_at ? ` · ${dateLabel(review.storeResponse.responded_at)}` : ""}</p></div> : null}
                  </div>
                  <div className="flex flex-row items-center justify-between gap-3 border-t border-[var(--user-border)] pt-3 md:flex-col md:items-stretch md:justify-start md:border-0 md:pt-1">
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.625rem] font-bold ${published === "Published" ? "border-[var(--user-success)]/30 bg-[var(--user-success)]/10 text-[var(--user-success)]" : "border-amber-400/30 bg-amber-400/10 text-amber-500"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{published}</span>
                    <div className="flex gap-2 md:mt-1 md:flex-col"><Link href={pid ? `/product/${pid}?editReview=1` : "/orders"} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--user-border)] px-3 text-xs font-bold text-[var(--user-text)] transition hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)]"><Pencil size={14} /> Edit review</Link><button type="button" onClick={() => removeReview(review)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--user-danger)]/25 px-3 text-xs font-bold text-[var(--user-danger)] transition hover:bg-[var(--user-danger)]/10"><Trash2 size={14} /> Delete</button></div>
                  </div>
                </div>
              </article>;
            })}</div>}
    </section>
  );
}
