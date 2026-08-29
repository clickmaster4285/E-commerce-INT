"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, usePathname, useRouter } from "next/navigation";
import bannerAPI from "@/apis/admin/bannerApi";

/* =========================================================
ICONS
========================================================= */
function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z",
  link: "M10 13a5 5 0 007.07.07l1.42-1.42a5 5 0 000-7.07 5 5 0 00-7.07 0L10 6m4 5a5 5 0 00-7.07-.07l-1.42 1.42a5 5 0 000 7.07 5 5 0 007.07 0L14 18",
  monitor: "M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm4 16h8m-4-4v4",
  smartphone: "M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm4 15h2",
  tablet: "M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zm5 15h2",
  check: "M5 13l4 4L19 7",
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  chevron: "M9 5l7 7-7 7",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

/* =========================================================
HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

const API_BASE =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const formatDateTime = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const formatType = (value) => {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const getImageUrl = (image) => {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return `${API_BASE}/${image.replace(/^\/+/, "")}`;
};

/* =========================================================
UI COMPONENTS (Matching Brand Page)
========================================================= */
function StatusPill({ status }) {
  const styles = {
    active: { bg: "rgba(34,197,94,.10)", color: "var(--success)", border: "rgba(34,197,94,.25)" },
    scheduled: { bg: "rgba(59,130,246,.10)", color: "#60a5fa", border: "rgba(59,130,246,.25)" },
    expired: { bg: "rgba(107,114,128,.10)", color: "#9ca3af", border: "rgba(107,114,128,.25)" },
    draft: { bg: "rgba(245,158,11,.10)", color: "#fbbf24", border: "rgba(245,158,11,.25)" },
    inactive: { bg: "rgba(239,68,68,.10)", color: "var(--danger)", border: "rgba(239,68,68,.25)" },
  };
  const item = styles[status] || styles.draft;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
      {status || "draft"}
    </span>
  );
}

function Button({ children, onClick, primary = false, disabled = false, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="inline-flex min-h-[44px] h-10 md:h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: primary ? "var(--accent)" : "var(--bg-tertiary)",
        color: primary ? "var(--accent-text)" : "var(--text-primary)",
        border: primary ? "none" : "1px solid var(--border-color)",
      }}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
    </div>
  );
}

function InfoRow({ label, value, green = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`text-[12px] text-right truncate max-w-[62%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function ImageCard({ title, image, icon }) {
  const imageUrl = getImageUrl(image);
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <div className="p-4">
        {imageUrl ? (
          <div className="rounded-lg overflow-hidden aspect-video" style={{ border: "1px solid var(--border-color)" }}>
            <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="aspect-video rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
            <Ico d={D.image} className="w-7 h-7 mb-3" sw={1.4} />
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No image uploaded</p>
          </div>
        )}
      </div>
    </Card>
  );
}

/* =========================================================
MAIN PAGE
======================================================== */
export default function BannerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/banners";

  const bannerId = params?.id;
  const [tab, setTab] = useState("info");

  const {
    data: banner,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["banner", bannerId],
    queryFn: async () => {
      const response = await bannerAPI.get(bannerId);
      return response?.data?.data || null;
    },
    enabled: !!bannerId,
    retry: false,
  });

  const images = useMemo(
    () => ({
      desktop: banner?.desktopImage,
      tablet: banner?.tabletImage,
      mobile: banner?.mobileImage,
    }),
    [banner]
  );

  const pages = banner?.displayRules?.pages || [];
  const devices = banner?.displayRules?.devices || [];
  const hasUpdates = Boolean(banner?.createdAt && banner?.updatedAt && banner.createdAt !== banner.updatedAt);

  if (isLoading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading banner details...</span>
        </div>
      </div>
    );
  }

  if (isError || !banner) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Banner Not Found</h2>
          <p className="text-[12px] mb-4" style={{ color: "var(--text-muted)" }}>
            {error?.response?.data?.message || error?.message || "This banner does not exist or has been deleted."}
          </p>
          <Button primary onClick={() => router.push(backPath)}>Back to Banners</Button>
        </Card>
      </div>
    );
  }

  const thumbSrc = getImageUrl(images.desktop);

  return (
    <div className="w-full pb-8" style={{ color: "var(--text-primary)" }}>
      <div className="space-y-6">

        {/* HEADER */}
        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button onClick={() => router.push(backPath)} className="transition hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>Banners</button>
            <Ico d={D.chevron} className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <span style={{ color: "var(--text-primary)" }}>Banner Details</span>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}>
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={banner.title} className="h-full w-full object-cover" />
                  ) : (
                    <Ico d={D.image} className="h-7 w-7" sw={1.4} style={{ color: "var(--accent)" }} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{banner.title || "Untitled Banner"}</h1>
                    <StatusPill status={banner.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                    <span>{formatType(banner.bannerType)}</span>
                    <span>•</span>
                    <span>Position {banner.position ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => router.push(backPath)}><Ico d={D.back} className="h-3.5 w-3.5" /> Back</Button>
                <Button primary onClick={() => router.push(`/admin/banners?edit=${banner._id}`)}>
                  <Ico d={D.edit} className="h-3.5 w-3.5" /> Edit Banner
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
          {[
            { id: "info", label: "Overview" },
            { id: "images", label: "Images", badge: 3 },
            { id: "rules", label: "Rules & Schedule" },
            { id: "activity", label: "Activity" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                {item.label}
                {item.badge !== undefined && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px]" style={{ backgroundColor: active ? "rgba(34,197,94,.10)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                    {item.badge}
                  </span>
                )}
                {active && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "info" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
            {/* Left column */}
            <div className="space-y-4 min-w-0">
              <Card>
                <CardHeader title="Banner Information" icon={<Ico d={D.tag} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Banner Title" value={banner.title} />
                  <InfoRow label="Banner Type" value={formatType(banner.bannerType)} />
                  <InfoRow label="Position" value={banner.position ?? 0} mono />
                  <InfoRow label="Status" value={banner.status || "draft"} green={banner.status === "active"} />
                  <InfoRow label="Alt Text" value={banner.altText || "—"} />
                  <InfoRow label="Background Color" value={banner.backgroundColor || "—"} />

                  {/* Detailed Creation Info */}
                  <div className="py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created By</span>
                      <span className="text-[12px] font-medium">{banner.createdby?.name || banner.createdBy?.name || "System"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created At</span>
                      <span className="text-[12px]">{formatDateTime(banner.createdAt)}</span>
                    </div>
                  </div>

                  {/* Detailed Update Info */}
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated By</span>
                      <span className="text-[12px] font-medium">{banner.updatedby?.name || banner.updatedBy?.name || (hasUpdates ? "Unknown" : "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated At</span>
                      <span className="text-[12px]">{hasUpdates ? formatDateTime(banner.updatedAt) : "Never"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Content */}
              <Card>
                <CardHeader title="Banner Content" icon={<Ico d={D.info} className="w-4 h-4" />} />
                <div className="px-4 pb-2">
                  <InfoRow label="Eyebrow / Small Heading" value={banner.eyebrow || "—"} />
                  <InfoRow label="Main Heading" value={banner.heading || "—"} />
                </div>
                <div className="p-4 pt-0">
                  <p className="text-[10px] uppercase tracking-wide mb-2 mt-2" style={{ color: "var(--text-muted)" }}>Description</p>
                  {banner.description ? (
                    <p className="text-[12px] leading-6 whitespace-pre-wrap break-words rounded-lg p-3" style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-tertiary)" }}>{banner.description}</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-6">
                      <Ico d={D.info} className="w-7 h-7 mb-3" sw={1.4} />
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No description provided.</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right column — Preview */}
            <Card>
              <CardHeader title="Banner Preview" icon={<Ico d={D.monitor} className="w-4 h-4" />} action={
                <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  Position: {banner.position ?? 0}
                </span>
              } />
              <div className="p-4">
                {thumbSrc ? (
                  <div className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-color)", backgroundColor: banner.backgroundColor || "transparent" }}>
                    <img src={thumbSrc} alt={banner.altText || banner.title || "Banner"} className="w-full object-cover max-h-[240px]" />
                  </div>
                ) : (
                  <div className="h-[170px] rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                    <Ico d={D.image} className="w-7 h-7 mb-3" sw={1.4} />
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No desktop image available</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] truncate" style={{ color: "var(--text-primary)" }}>{String(images.desktop || "").split("/").pop() || "—"}</p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{formatType(banner.bannerType)}</p>
                  </div>
                  {thumbSrc && (
                    <a href={thumbSrc} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center gap-1 shrink-0" style={{ color: "var(--accent)" }}>
                      View <Ico d={D.link} className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* IMAGES TAB */}
        {tab === "images" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ImageCard title="Desktop" image={images.desktop} icon={<Ico d={D.monitor} className="w-4 h-4" />} />
            <ImageCard title="Tablet" image={images.tablet} icon={<Ico d={D.tablet} className="w-4 h-4" />} />
            <ImageCard title="Mobile" image={images.mobile} icon={<Ico d={D.smartphone} className="w-4 h-4" />} />
          </div>
        )}

        {/* RULES & SCHEDULE TAB */}
        {tab === "rules" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Call to Action */}
              <Card>
                <CardHeader title="Call to Action" icon={<Ico d={D.link} className="w-4 h-4" />} />
                <div className="px-4 pb-1">
                  <InfoRow label="Button Text" value={banner.primaryButton?.text || "—"} />
                  <InfoRow label="Link Type" value={formatType(banner.primaryButton?.linkType)} />
                  <div className="py-3">
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Target Link</p>
                    {banner.primaryButton?.link ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <Ico d={D.link} className="w-3.5 h-3.5 shrink-0" style={{ color: "#34d399" }} />
                        <span className="text-[12px] break-all">{banner.primaryButton.link}</span>
                      </div>
                    ) : (
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </div>
                </div>
              </Card>

              {/* Schedule */}
              <Card>
                <CardHeader title="Schedule" icon={<Ico d={D.calendar} className="w-4 h-4" />} />
                <div className="px-4 pb-1">
                  <InfoRow label="Start Date & Time" value={formatDateTime(banner.startDate)} />
                  <InfoRow label="End Date & Time" value={formatDateTime(banner.endDate)} />
                  <InfoRow label="Auto Publish" value={banner.autoPublish ? "Enabled" : "Disabled"} green={banner.autoPublish} />
                  <InfoRow label="Auto Disable" value={banner.autoDisable ? "Enabled" : "Disabled"} />
                </div>
              </Card>
            </div>

            {/* Display Rules */}
            <Card>
              <CardHeader title="Display Rules" icon={<Ico d={D.monitor} className="w-4 h-4" />} />
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Show On Pages</p>
                  {pages.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {pages.map((page) => (
                        <span key={page} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium capitalize" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <Ico d={D.check} className="w-3 h-3" style={{ color: "#34d399" }} />
                          {formatType(page)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No pages configured</span>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Show On Devices</p>
                  {devices.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {devices.map((device) => (
                        <span key={device} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium capitalize" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <Ico d={D.check} className="w-3 h-3" style={{ color: "#34d399" }} />
                          {formatType(device)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No devices configured</span>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader title="Activity Timeline" icon={<Ico d={D.activity} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">

                {/* Created Event */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,.10)", color: "var(--accent)" }}>
                      <Ico d={D.plus} className="w-4 h-4" />
                    </div>
                    {hasUpdates && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-[13px] font-medium">Banner Created</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{banner.createdby?.name || banner.createdBy?.name || "System"}</span>
                      {(banner.createdby?.email || banner.createdBy?.email) && <span className="block text-[10px] opacity-70">{banner.createdby?.email || banner.createdBy?.email}</span>}
                    </p>
                    <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(banner.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Updated Event */}
                {hasUpdates ? (
                  <div className="flex gap-4">
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,.10)", color: "#60a5fa" }}>
                        <Ico d={D.pencil} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Banner Updated</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{banner.updatedby?.name || banner.updatedBy?.name || "Unknown"}</span>
                      </p>
                      <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(banner.updatedAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ml-11 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No updates recorded yet.</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Activity Info Side Panel */}
            <Card>
              <CardHeader title="User Details" icon={<Ico d={D.user} className="w-4 h-4" />} />
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Creator</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                      {ini(banner.createdby?.name || banner.createdBy?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{banner.createdby?.name || banner.createdBy?.name || "System"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{banner.createdby?.email || banner.createdBy?.email || "—"}</p>
                    </div>
                  </div>
                </div>

                {hasUpdates && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                        {ini(banner.updatedby?.name || banner.updatedBy?.name)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium">{banner.updatedby?.name || banner.updatedBy?.name || "Unknown"}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{banner.updatedby?.email || banner.updatedBy?.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
