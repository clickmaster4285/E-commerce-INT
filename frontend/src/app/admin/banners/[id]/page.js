"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, Image, Monitor, Tablet, Smartphone, Link2, Calendar,
  Info, Check, Tag, Eye, Clock, Globe, Layers, Zap, Hash, Edit3,
  Trash2, Plus, Pencil, AlertTriangle, Activity, User, Sparkles,
  Settings, ExternalLink, Type, Palette, MousePointer, Target
} from "lucide-react";
import bannerAPI from "@/apis/admin/bannerApi";

/* =========================================================
   HELPERS
========================================================= */
const API_BASE = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function fd(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fdt(date) {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function tago(date) {
  if (!date) return "";
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : fd(date);
}

const formatType = (value) => {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const getImageUrl = (image) => {
  if (!image) return null;
  if (typeof image !== "string") return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${API_BASE}/${image.replace(/^\/+/, "")}`;
};

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusBadge({ status }) {
  const config = {
    active: { bg: "rgba(16,185,129,0.12)", color: "#10b981", border: "rgba(16,185,129,0.3)", label: "ACTIVE" },
    scheduled: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "rgba(59,130,246,0.3)", label: "SCHEDULED" },
    expired: { bg: "rgba(107,114,128,0.12)", color: "#6b7280", border: "rgba(107,114,128,0.3)", label: "EXPIRED" },
    draft: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.3)", label: "DRAFT" },
    inactive: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", border: "rgba(239,68,68,0.3)", label: "INACTIVE" },
  };
  const item = config[status] || config.draft;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
      {item.label}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, color = "emerald" }) {
  const colors = {
    emerald: { bg: "rgba(16,185,129,0.08)", text: "#10b981", border: "rgba(16,185,129,0.2)" },
    blue: { bg: "rgba(59,130,246,0.08)", text: "#3b82f6", border: "rgba(59,130,246,0.2)" },
    purple: { bg: "rgba(168,85,247,0.08)", text: "#a855f7", border: "rgba(168,85,247,0.2)" },
    amber: { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    red: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.2)" },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className="rounded-xl p-4 transition-all hover:shadow-md" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}>
          <Icon className="w-5 h-5" style={{ color: c.text }} />
        </div>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{value}</p>
      {subValue && <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{subValue}</p>}
    </div>
  );
}

function InfoCard({ icon: Icon, title, children, action, bodyClassName = "" }) {
  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className={`p-5 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, icon: Icon }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className={`text-[13px] font-semibold text-right truncate max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "#10b981" : "var(--text-primary)" }}>{value || "—"}</span>
    </div>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const colors = {
    emerald: { bg: "rgba(16,185,129,0.12)", text: "#10b981" },
    blue: { bg: "rgba(59,130,246,0.12)", text: "#3b82f6" },
    purple: { bg: "rgba(168,85,247,0.12)", text: "#a855f7" },
  };
  const c = colors[color] || colors.emerald;

  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: c.bg, color: c.text }}>
      {ini(user?.name || user?.email || "?")}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
        <Icon className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-[12px] max-w-sm mb-5" style={{ color: "var(--text-muted)" }}>{description}</p>
      {action}
    </div>
  );
}

function DeviceImageCard({ title, image, icon: Icon, aspect = "video" }) {
  const imageUrl = getImageUrl(image);
  return (
    <div className="rounded-xl overflow-hidden h-full flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      <div className="p-5 flex-1 flex items-center justify-center">
        {imageUrl ? (
          <div className="w-full overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-color)" }}>
            <img src={imageUrl} alt={title} className="w-full h-auto object-cover" />
          </div>
        ) : (
          <div className="w-full aspect-video rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
            <Image className="w-10 h-10 mb-3" style={{ color: "var(--text-muted)" }} />
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>No image uploaded</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */
export default function BannerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/banners";

  const bannerId = params?.id;
  const [tab, setTab] = useState("info");

  const { data: banner, isLoading, isError, error } = useQuery({
    queryKey: ["banner", bannerId],
    queryFn: async () => {
      const response = await bannerAPI.get(bannerId);
      return response?.data?.data || response?.data || null;
    },
    enabled: !!bannerId,
    retry: false,
  });

  const images = useMemo(() => ({
    desktop: banner?.desktopImage,
    tablet: banner?.tabletImage,
    mobile: banner?.mobileImage,
  }), [banner]);

  const pages = banner?.displayRules?.pages || [];
  const devices = banner?.displayRules?.devices || [];
  const hasUpdates = Boolean(banner?.createdAt && banner?.updatedAt && banner.createdAt !== banner.updatedAt);

  // Loading
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
          <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading banner details...</p>
        </div>
      </div>
    );
  }

  // Not Found
  if (isError || !banner) {
    return (
      <div className="w-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
            <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Banner Not Found</h2>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {error?.response?.data?.message || error?.message || "This banner does not exist or has been deleted."}
          </p>
          <button onClick={() => router.push(backPath)} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <ArrowLeft className="w-4 h-4" /> Back to Banners
          </button>
        </div>
      </div>
    );
  }

  const tabList = [
    { id: "info", label: "Overview", icon: Eye },
    { id: "images", label: "Images", icon: Image, badge: "3" },
    { id: "rules", label: "Rules & Schedule", icon: Settings },
  ];

  return (
    <div className="w-full pb-8 space-y-6">
      {/* HEADER */}
      <div>
        <button onClick={() => router.push(backPath)} className="flex items-center gap-2 text-[12px] font-medium mb-4 hover:opacity-80 transition" style={{ color: "var(--text-muted)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Banners
        </button>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-6 md:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Banner Preview */}
              <div className="w-full lg:w-64 shrink-0">
                <div className="w-full aspect-video rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  {images.desktop ? (
                    <img src={getImageUrl(images.desktop)} alt={banner.title} className="w-full h-full object-cover" />
                  ) : (
                    <Image className="w-16 h-16" style={{ color: "var(--text-muted)" }} />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h1 className="text-2xl md:text-3xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {banner.title || "Banner Details"}
                      </h1>
                      <StatusBadge status={banner.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1.5"><Type className="w-3.5 h-3.5" />{formatType(banner.bannerType)}</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />Position {banner.position ?? 0}</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{pages.length} Pages</span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{fd(banner.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => router.push(backPath)} className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={() => router.push(`${backPath}?edit=${bannerId}`)} className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                      <Edit3 className="w-4 h-4" /> Edit Banner
                    </button>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Type</p>
                    <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{formatType(banner.bannerType)}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Position</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{banner.position ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Devices</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{devices.length} configured</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Pages</p>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{pages.length} pages</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)", scrollbarWidth: "none" }}>
        {tabList.map((tb) => {
          const active = tab === tb.id;
          const Icon = tb.icon;
          return (
            <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
              className="relative flex items-center gap-2 whitespace-nowrap pb-2.5 text-[12px] font-semibold transition-all bg-transparent border-none shadow-none"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}>
              <Icon className="w-4 h-4" />
              {tb.label}
              {tb.badge && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                  style={{ backgroundColor: active ? "var(--accent-soft)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  {tb.badge}
                </span>
              )}
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full transition-all" style={{ backgroundColor: active ? "var(--accent)" : "transparent" }} />
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {tab === "info" && (
        <div className="space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Activity} label="Status" value={banner.status?.toUpperCase() || "DRAFT"} color={banner.status === "active" ? "emerald" : "amber"} />
            <MetricCard icon={Hash} label="Position" value={String(banner.position ?? 0)} color="blue" />
            <MetricCard icon={Tag} label="Type" value={formatType(banner.bannerType)} color="purple" />
            <MetricCard icon={Target} label="Target Pages" value={String(pages.length)} subValue={`${devices.length} devices`} color="amber" />
          </div>

          {/* Banner Preview */}
          <InfoCard icon={Eye} title="Banner Preview" action={
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
              Desktop View
            </span>
          }>
            {images.desktop ? (
              <div className="w-full overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-color)" }}>
                <img src={getImageUrl(images.desktop)} alt={banner.altText || banner.title || "Banner"} className="w-full h-auto object-cover" />
              </div>
            ) : (
              <EmptyState icon={Image} title="No Desktop Image" description="No desktop banner image has been uploaded." />
            )}
          </InfoCard>

          {/* Info LEFT + Content RIGHT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard icon={Info} title="Basic Information">
              <div className="space-y-1">
                <DataRow icon={Type} label="Banner Title" value={banner.title} />
                <DataRow icon={Tag} label="Banner Type" value={formatType(banner.bannerType)} />
                <DataRow icon={Hash} label="Position" value={String(banner.position ?? 0)} />
                <DataRow icon={Activity} label="Status" value={banner.status?.toUpperCase()} highlight={banner.status === "active"} />
                <DataRow icon={Palette} label="Background Color" value={banner.backgroundColor || "—"} mono />
                <DataRow icon={Image} label="Alt Text" value={banner.altText || "—"} />
              </div>
            </InfoCard>

            <InfoCard icon={Type} title="Banner Content" bodyClassName="flex flex-col">
              <div className="space-y-4 flex-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Eyebrow / Small Heading</p>
                  <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{banner.eyebrow || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Main Heading</p>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{banner.heading || "—"}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Description</p>
                  <div className="p-3 rounded-lg text-[12px] leading-relaxed" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                    {banner.description || "No description provided."}
                  </div>
                </div>
              </div>
            </InfoCard>
          </div>

          {/* Call to Action + Created/Updated */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard icon={Link2} title="Call to Action">
              <div className="space-y-1">
                <DataRow icon={MousePointer} label="Button Text" value={banner.primaryButton?.text || "—"} />
                <DataRow icon={Link2} label="Link Type" value={formatType(banner.primaryButton?.linkType)} />
                {banner.primaryButton?.linkType === "deal" && banner.primaryButton?.dealId ? (
                  <DataRow icon={Tag} label="Linked Deal" value={typeof banner.primaryButton.dealId === "object" ? banner.primaryButton.dealId.name || "—" : "Deal"} highlight />
                ) : (
                  <DataRow icon={ExternalLink} label="Target Link" value={banner.primaryButton?.link || "—"} mono />
                )}
              </div>
            </InfoCard>

            <InfoCard icon={User} title="Created & Updated">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Created</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                      <Plus className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                        {banner.createdBy?.name || banner.createdBy?.email || "System"}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {fdt(banner.createdAt)} · {tago(banner.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                {hasUpdates && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Last Updated</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                        <Pencil className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                          {banner.updatedBy?.name || banner.updatedBy?.email || "System"}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {fdt(banner.updatedAt)} · {tago(banner.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </InfoCard>
          </div>
        </div>
      )}

      {/* IMAGES TAB */}
      {tab === "images" && (
        <div className="space-y-6">
          <InfoCard icon={Image} title="Responsive Images" action={
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
              3 Device Variants
            </span>
          }>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DeviceImageCard title="Desktop" image={images.desktop} icon={Monitor} />
              <DeviceImageCard title="Tablet" image={images.tablet} icon={Tablet} />
              <DeviceImageCard title="Mobile" image={images.mobile} icon={Smartphone} />
            </div>
          </InfoCard>
        </div>
      )}

      {/* RULES TAB */}
      {tab === "rules" && (
        <div className="space-y-6">
          {/* Display Rules */}
          <InfoCard icon={Globe} title="Display Rules">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Show On Pages</p>
                {pages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pages.map((page) => (
                      <span key={page} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <Check className="w-3 h-3" />
                        {formatType(page)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No pages configured</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Show On Devices</p>
                {devices.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {devices.map((device) => (
                      <span key={device} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>
                        {device === "desktop" && <Monitor className="w-3 h-3" />}
                        {device === "tablet" && <Tablet className="w-3 h-3" />}
                        {device === "mobile" && <Smartphone className="w-3 h-3" />}
                        {formatType(device)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No devices configured</p>
                )}
              </div>
            </div>
          </InfoCard>

          {/* Schedule */}
          <InfoCard icon={Calendar} title="Schedule">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
              <DataRow icon={Calendar} label="Start Date & Time" value={fdt(banner.startDate)} />
              <DataRow icon={Calendar} label="End Date & Time" value={fdt(banner.endDate)} />
              <DataRow icon={Zap} label="Auto Publish" value={banner.autoPublish ? "Enabled" : "Disabled"} highlight={banner.autoPublish} />
              <DataRow icon={Zap} label="Auto Disable" value={banner.autoDisable ? "Enabled" : "Disabled"} highlight={banner.autoDisable} />
            </div>
          </InfoCard>
        </div>
      )}
    </div>
  );
}