"use client";

/* ==========================================================
   ADMIN · CUSTOM PAGES (/admin/pages) — About, FAQ, Contact ...
   Storefront URL: /pages/<slug>. Menus (store editor) se link hote hain.
   ========================================================== */

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, FileText, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { pageApi, apiError } from "@/apis/admin/themeApi";

export default function PagesListPage() {
  const queryClient = useQueryClient();
  const pagesQuery = useQuery({ queryKey: ["storePages"], queryFn: pageApi.list });
  const removeMutation = useMutation({
    mutationFn: pageApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storePages"] });
      toast.success("Page deleted");
    },
    onError: (error) => toast.error(apiError(error).message),
  });

  const error = pagesQuery.error ? apiError(pagesQuery.error) : null;
  const pages = pagesQuery.data || [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Pages</h1>
          <p className="text-sm text-fg-muted">Custom pages for your store — link them from the store editor menus.</p>
        </div>
        <Link href="/admin/pages/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
          <Plus size={15} /> New page
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-line-card bg-card">
        {pagesQuery.isLoading ? (
          <div className="flex justify-center py-12 text-fg-muted">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-fg-muted">
            <Lock size={20} />
            {error.code === "PLAN_FEATURE_DISABLED" ? "Custom pages aren't included in your plan." : error.message}
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-fg-muted">
            <FileText size={22} />
            No pages yet. Create an About or FAQ page to get started.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {pages.map((page) => (
              <li key={page._id} className="flex items-center gap-3 px-4 py-3 hover:bg-row-hover">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/pages/${page._id}`} className="block truncate text-sm font-semibold text-fg hover:text-accent">
                    {page.title}
                  </Link>
                  <p className="truncate text-xs text-fg-muted">/pages/{page.slug}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    page.status === "published" ? "bg-success-soft text-success" : "bg-subtle text-fg-muted"
                  }`}
                >
                  {page.status === "published" ? "Published" : "Draft"}
                </span>
                {page.status === "published" ? (
                  <a href={`/pages/${page.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" title="View">
                    <ExternalLink size={15} />
                  </a>
                ) : null}
                <Link href={`/admin/pages/${page._id}`} className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg" title="Edit">
                  <Pencil size={15} />
                </Link>
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => window.confirm(`Delete "${page.title}"?`) && removeMutation.mutate(page._id)}
                  className="rounded-md p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
