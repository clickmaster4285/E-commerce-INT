"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  Hash,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  Monitor,
  Pencil,
  Trash2,
  Type,
  User,
} from "lucide-react";
import bannerAPI from "@/apis/admin/bannerApi";

const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

/* ============================================================
   HELPERS
   ============================================================ */

function formatType(value) {
  if (!value) return "\u2014";
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value, withTime = false) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return date.toLocaleString("en-US", withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function relativeDate(value) {
  if (!value) return "\u2014";
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

function imageUrl(image) {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${API_BASE}/${image.replace(/^\/+/, "")}`;
}

function resolveUser(user) {
  if (!user) return "System";
  if (typeof user === "object") return user.name || user.email || "Admin";
  return "Admin";
}

const STATUS_META = {
  active: { label: "Active", token: "success" },
  scheduled: { label: "Scheduled", token: "info" },
  inactive: { label: "Inactive", token: "warning" },
  draft: { label: "Draft", token: "neutral" },
  expired: { label: "Expired", token: "danger" },
};

const TOKEN_STYLES = {
  success: { bg: "var(--success-soft)", color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 25%, transparent)" },
  info: { bg: "var(--info-soft)", color: "var(--info-text)", border: "color-mix(in srgb, var(--info) 25%, transparent)" },
  warning: { bg: "var(--warning-soft)", color: "var(--warning-text)", border: "color-mix(in srgb, var(--warning) 25%, transparent)" },
  danger: { bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 25%, transparent)" },
  accent: { bg: "var(--accent-soft)", color: "var(--accent)", border: "color-mix(in srgb, var(--accent) 25%, transparent)" },
  purple: { bg: "var(--purple-soft)", color: "var(--purple-text)", border: "color-mix(in srgb, var(--purple) 25%, transparent)" },
  neutral: { bg: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "var(--border-color)" },
};

/* ============================================================
   UI PRIMITIVES
   ============================================================ */

function Chip({ tone = "neutral", icon: Icon, children }) {
  const s = TOKEN_STYLES[tone] || TOKEN_STYLES.neutral;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  const s = TOKEN_STYLES[meta.token];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
      {meta.label}
    </span>
  );
}

function SectionCard({ id, icon: Icon, title, action, children, className = "" }) {
  return (
    <section id={id} className={`card overflow-hidden scroll-mt-24 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <h2 className="truncate text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
            {title}
          </h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, children }) {
  return (
    <div
      className="flex min-h-10 items-center justify-between gap-4 border-b py-2 last:border-b-0"
      style={{ borderColor: "var(--border-color)" }}
    >
      <span className="shrink-0 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
        {children === null || children === undefined || children === "" ? "—" : children}
      </span>
    </div>
  );
}

function RailRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-start gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--border-color)" }}>
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className={`mt-0.5 truncate text-[12.5px] font-semibold ${mono ? "font-mono text-[11.5px]" : ""}`} style={{ color: "var(--text-primary)" }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="card flex min-w-0 items-center gap-3 p-3.5">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] font-bold" style={{ color: "var(--text-primary)" }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function ButtonCard({ label, tone, button }) {
  const s = TOKEN_STYLES[tone];
  return (
    <div className="rounded-xl p-3.5" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card-alt)" }}>
      <div className="mb-1 flex items-center justify-between gap-2 border-b pb-2" style={{ borderColor: "var(--border-color)" }}>
        <span className="inline-flex items-center gap-2 text-[11px] font-bold" style={{ color: s.color }}>
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "currentColor" }} />
          {label}
        </span>
        <Link2 className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
      </div>
      <InfoRow label="Text">{button?.text}</InfoRow>
      <InfoRow label="Link Type">{formatType(button?.linkType)}</InfoRow>
      <InfoRow label="Link">
        <span className="font-mono text-[11.5px]">{button?.link}</span>
      </InfoRow>
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */

const TABS = [
  { key: "content", label: "Content", target: "banner-content-section", icon: Type },
  { key: "buttons", label: "Buttons", target: "banner-buttons-section", icon: Link2 },
  { key: "timeline", label: "Timeline", target: "banner-history-section", icon: History },
];

export default function BannerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/banners";
  const bannerId = params?.id;
  const [showDelete, setShowDelete] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const queryClient = useQueryClient();

  const { data: banner, isLoading, isError, error } = useQuery({
    queryKey: ["banner", bannerId],
    queryFn: async () => {
      const response = await bannerAPI.get(bannerId);
      return response?.data?.data || response?.data || null;
    },
    enabled: !!bannerId,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: () => bannerAPI.delete(bannerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      router.push(backPath);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: () => bannerAPI.duplicate(bannerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminBanners"] });
      toast.success("Banner duplicated");
    },
    onError: () => toast.error("Failed to duplicate banner"),
  });

  const handleTabClick = (tab) => {
    setActiveTab(tab.key);
    document.getElementById(tab.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (isError || !banner) {
    return (
      <div className="empty-state py-24">
        <span className="empty-state-icon">
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--danger)" }} />
        </span>
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Banner Not Found</h2>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {error?.message || "This banner does not exist or has been deleted."}
        </p>
        <button onClick={() => router.push(backPath)} className="btn-primary mt-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Banners
        </button>
      </div>
    );
  }

  const desktopImage = imageUrl(banner.desktopImage);

  const createdBy = banner.createdby ?? banner.createdBy;
  const updatedBy = banner.updatedby ?? banner.updatedBy;
  const wasUpdated = banner.updatedAt && banner.createdAt &&
    new Date(banner.updatedAt).getTime() - new Date(banner.createdAt).getTime() > 60000;

  const headerActionCls = "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all duration-150";

  return (
    <>
      <div className="w-full space-y-4 pb-10">
        {/* ============ BREADCRUMB ============ */}
        <nav className="flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }} aria-label="Breadcrumb">
          <button onClick={() => router.push(backPath)} className="font-medium transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            Banners
          </button>
          <ChevronRight className="h-3.5 w-3.5" style={{ color: "var(--text-muted)", opacity: 0.6 }} />
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Banner Details</span>
        </nav>

        {/* ============ HEADER ============ */}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => router.push(backPath)}
              aria-label="Back to banners"
              className="btn-icon shrink-0"
              style={{ width: 38, height: 38 }}
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate text-[17px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                {banner.title || "Banner Details"}
              </h1>
              <Chip tone="accent">{formatType(banner.bannerType)}</Chip>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={banner.status} />
            <button
              onClick={() => router.push(`/admin/banners?edit=${bannerId}`)}
              className={`${headerActionCls} btn-secondary`}
              title="Edit this banner"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
              className={`${headerActionCls} btn-secondary`}
              title="Create a copy of this banner"
            >
              {duplicateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              Duplicate
            </button>
            <button
              onClick={() => setShowDelete(true)}
              disabled={deleteMutation.isPending}
              className={headerActionCls}
              style={{ backgroundColor: "var(--danger)", color: "#ffffff" }}
              title="Delete this banner"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>

        {/* ============ QUICK FACTS ============ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <InfoTile icon={Hash} label="Position" value={String(banner.position ?? 0)} />
          <InfoTile icon={Type} label="Type" value={formatType(banner.bannerType)} />
          <InfoTile icon={Calendar} label="Start Date" value={banner.startDate ? formatDate(banner.startDate, true) : null} />
          <InfoTile icon={Calendar} label="End Date" value={banner.endDate ? formatDate(banner.endDate, true) : null} />
        </div>

        {/* ============ MAIN GRID ============ */}
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* ----- LEFT COLUMN ----- */}
          <div className="min-w-0 space-y-4">
            {/* Preview */}
            <SectionCard
              icon={Eye}
              title="Banner Preview"
              action={(
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Monitor className="h-3 w-3" /> Desktop View
                </span>
              )}
            >
              {desktopImage ? (
                <div
                  className="overflow-hidden rounded-lg"
                  style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-secondary)" }}
                >
                  <img
                    src={desktopImage}
                    alt={banner.altText || banner.title || "Banner"}
                    className="block h-auto max-h-[420px] w-full object-contain"
                  />
                </div>
              ) : (
                <div className="empty-state" style={{ border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)" }}>
                  <span className="empty-state-icon"><ImageIcon className="h-6 w-6" /></span>
                  <p className="text-[13px] font-medium">No desktop image uploaded</p>
                </div>
              )}
            </SectionCard>

            {/* Basic Information */}
            <SectionCard icon={Info} title="Basic Information">
              <InfoRow label="Title">{banner.title}</InfoRow>
              <InfoRow label="Internal Name">
                <span className="font-mono text-[12px]">{banner.internalName || banner.slug}</span>
              </InfoRow>
              <InfoRow label="Banner Type">
                <Chip tone="accent">{formatType(banner.bannerType)}</Chip>
              </InfoRow>
              <InfoRow label="Status"><StatusPill status={banner.status} /></InfoRow>
              <InfoRow label="Position">{String(banner.position ?? 0)}</InfoRow>
            </SectionCard>

            {/* Section tabs */}
            <div
              className="flex items-center gap-1 overflow-x-auto rounded-xl p-1.5"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
              role="tablist"
              aria-label="Banner sections"
            >
              {TABS.map((tab) => {
                const TabIcon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => handleTabClick(tab)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold transition-all duration-150"
                    style={active
                      ? { backgroundColor: "var(--bg-card)", color: "var(--accent)", boxShadow: "var(--shadow-sm)" }
                      : { color: "var(--text-muted)" }}
                  >
                    <TabIcon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Content + Buttons */}
            <div id="banner-content-section" className="grid scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard icon={Type} title="Banner Content">
                <InfoRow label="Eyebrow">{banner.eyebrow}</InfoRow>
                <InfoRow label="Heading">{banner.heading}</InfoRow>
                <InfoRow label="Description">
                  <span className="line-clamp-3 whitespace-pre-wrap text-right" title={banner.description}>
                    {banner.description}
                  </span>
                </InfoRow>
              </SectionCard>

              <SectionCard id="banner-buttons-section" icon={Link2} title="Buttons">
                <div className="space-y-3">
                  <ButtonCard label="Primary Button" tone="accent" button={banner.primaryButton} />
                  {banner.secondaryButton?.text && (
                    <ButtonCard label="Secondary Button" tone="neutral" button={banner.secondaryButton} />
                  )}
                </div>
              </SectionCard>
            </div>

          </div>

          {/* ----- RIGHT RAIL ----- */}
          <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">
            <SectionCard icon={User} title="Banner Information">
              <RailRow icon={User} label="Created By" value={resolveUser(createdBy)} />
              <RailRow icon={Calendar} label="Created At" value={formatDate(banner.createdAt, true)} />
              {wasUpdated && (
                <>
                  <RailRow icon={Pencil} label="Updated By" value={resolveUser(updatedBy)} />
                  <RailRow icon={Clock} label="Updated At" value={formatDate(banner.updatedAt, true)} />
                </>
              )}
            </SectionCard>

            <SectionCard id="banner-history-section" icon={History} title="History">
              <div className="space-y-0">
                {wasUpdated && (
                  <div className="flex gap-3 border-b pb-4" style={{ borderColor: "var(--border-color)" }}>
                    <span className="flex flex-col items-center">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--info)" }} />
                      <span className="mt-1 w-px flex-1" style={{ backgroundColor: "var(--border-color)" }} />
                    </span>
                    <div className="min-w-0 pb-1">
                      <p className="text-[12.5px] font-bold" style={{ color: "var(--text-primary)" }}>Banner Updated</p>
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Banner details were updated</p>
                      <p className="mt-1 text-[10.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                        By {resolveUser(updatedBy)} · {relativeDate(banner.updatedAt)}
                      </p>
                      <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                        {formatDate(banner.updatedAt, true)}
                      </p>
                    </div>
                  </div>
                )}
                <div className={`flex gap-3 ${wasUpdated ? "pt-3.5" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--purple)" }} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold" style={{ color: "var(--text-primary)" }}>Banner Created</p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>Banner was created</p>
                    <p className="mt-1 text-[10.5px] font-semibold" style={{ color: "var(--text-secondary)" }}>
                      By {resolveUser(createdBy)} · {relativeDate(banner.createdAt)}
                    </p>
                    <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                      {formatDate(banner.createdAt, true)}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

          </aside>
        </div>

      </div>

      {/* ============ DELETE CONFIRM ============ */}
      {showDelete && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel" style={{ maxWidth: 400 }}>
            <div className="modal-body">
              <div className="flex gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)" }}
                >
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>
                    Delete &quot;{banner.title}&quot;?
                  </h3>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    This action cannot be undone. The banner will be permanently removed.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDelete(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn-danger"
              >
                {deleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {deleteMutation.isPending ? "Deleting..." : "Delete Banner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


