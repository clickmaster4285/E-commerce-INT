"use client";

/* ==========================================================
   ADMIN · PAGE EDITOR (/admin/pages/new | /admin/pages/<id>)
   Title, URL slug, rich content (Tiptap), SEO, draft/published.
   Backend sanitize karta hai; slug har store me unique (409).
   ========================================================== */

import Link from "next/link";
import dynamic from "next/dynamic";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { pageApi, apiError } from "@/apis/admin/themeApi";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-subtle" />,
});

const inputCls =
  "h-10 w-full rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

const slugify = (v) =>
  String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const EMPTY = { title: "", slug: "", content: "", status: "draft", seo: { title: "", description: "" } };

function PageForm({ initial, isNew }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, seo: { ...EMPTY.seo, ...(initial?.seo || {}) } }));
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [errors, setErrors] = useState({});

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: (status) => {
      const body = { ...form, status };
      return isNew ? pageApi.create(body) : pageApi.update(initial._id, body);
    },
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ["storePages"] });
      queryClient.invalidateQueries({ queryKey: ["storeEditor", "pages"] });
      toast.success(page.status === "published" ? "Page published" : "Draft saved");
      setErrors({});
      if (isNew) router.replace(`/admin/pages/${page._id}`);
      else setForm((f) => ({ ...f, status: page.status, slug: page.slug }));
    },
    onError: (error) => {
      const e = apiError(error);
      setErrors(e.errors || {});
      toast.error(e.message);
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/admin/pages" className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Back">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold text-fg">{isNew ? "New page" : form.title || "Edit page"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate("draft")}
            className="h-9 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-fg-secondary hover:bg-subtle disabled:opacity-50"
          >
            {form.status === "published" ? "Unpublish" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate("published")}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            {form.status === "published" ? "Update" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 rounded-xl border border-line-card bg-card p-4 sm:p-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-fg-secondary">Title</span>
            <input
              className={inputCls}
              maxLength={120}
              value={form.title}
              onChange={(e) => {
                set("title", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
            />
            {errors.title ? <span className="text-xs text-danger">{errors.title}</span> : null}
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-fg-secondary">Content</span>
            <RichTextEditor value={form.content} onChange={(v) => set("content", v)} minHeight={320} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-3 rounded-xl border border-line-card bg-card p-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-fg-secondary">URL</span>
              <div className="flex items-center rounded-lg border border-line bg-input ps-3 text-sm text-fg-muted focus-within:border-accent">
                /pages/
                <input
                  className="h-10 min-w-0 flex-1 bg-transparent px-1 text-fg outline-none"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                />
              </div>
              {errors.slug ? <span className="text-xs text-danger">{errors.slug}</span> : null}
              {!isNew ? <span className="block text-[11px] text-fg-muted">Changing the URL breaks old links to this page.</span> : null}
            </label>
            <p className="text-xs text-fg-muted">
              Status: <span className={form.status === "published" ? "font-semibold text-success" : "font-semibold text-fg-secondary"}>{form.status === "published" ? "Published" : "Draft"}</span>
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-line-card bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-fg-muted">Search engine</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-fg-secondary">SEO title</span>
              <input className={inputCls} maxLength={120} placeholder={form.title} value={form.seo.title} onChange={(e) => set("seo", { ...form.seo, title: e.target.value })} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-fg-secondary">Meta description</span>
              <textarea className={`${inputCls} h-24 py-2`} maxLength={300} value={form.seo.description} onChange={(e) => set("seo", { ...form.seo, description: e.target.value })} />
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function PageEditorRoute({ params }) {
  const { id } = use(params);
  const isNew = id === "new";
  const pageQuery = useQuery({ queryKey: ["storePage", id], queryFn: () => pageApi.get(id), enabled: !isNew });

  if (isNew) return <PageForm isNew initial={EMPTY} />;
  if (pageQuery.isLoading) {
    return (
      <div className="flex justify-center py-16 text-fg-muted">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }
  if (pageQuery.error || !pageQuery.data) {
    return <p className="p-6 text-sm text-danger">{pageQuery.error ? apiError(pageQuery.error).message : "Page not found"}</p>;
  }
  return <PageForm key={pageQuery.data._id} initial={pageQuery.data} isNew={false} />;
}
