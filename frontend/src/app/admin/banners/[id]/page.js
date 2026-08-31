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
};

// ======================================================
// SECTION
// ======================================================

const Section = ({ title, description, icon, children }) => (
  <section
    className="rounded-lg border overflow-hidden"
    style={{
      backgroundColor: "var(--bg-card)",
      borderColor: "var(--border-color)",
    }}
  >
    <div
      className="px-5 py-4 border-b"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-tertiary)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: "rgba(16,185,129,0.10)",
            color: "#34d399",
          }}
        >
          {icon}
        </div>

        <div>
          <h2
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h2>

          {description && (
            <p
              className="text-[11px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>

    <div className="p-5">{children}</div>
  </section>
);

// ======================================================
// INFO ITEM
// ======================================================

const InfoItem = ({ label, value, children }) => (
  <div className="space-y-1">
    <p
      className="text-[11px] font-medium uppercase tracking-wide"
      style={{ color: "var(--text-muted)" }}
    >
      {label}
    </p>

    {children || (
      <p
        className="text-sm font-medium break-words"
        style={{ color: "var(--text-primary)" }}
      >
        {value ?? "—"}
      </p>
    )}
  </div>
);

// ======================================================
// IMAGE CARD
// ======================================================

const ImageCard = ({ title, image, icon }) => {
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

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          <div className="flex items-start gap-3">

            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-lg border flex items-center justify-center transition hover:opacity-80"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-secondary)",
              }}
              title="Back"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="text-xl sm:text-2xl font-bold tracking-tight"
                  style={{ color: "var(--text-primary)" }}
                >
                  {banner.title || "Banner Details"}
                </h1>

                <StatusBadge status={banner.status} />
              </div>

              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Banner details and configuration
              </p>
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

        {/* ==================================================
            HERO PREVIEW
        ================================================== */}

        <div
          className="rounded-lg border overflow-hidden"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="px-5 py-4 border-b flex items-center justify-between"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--bg-tertiary)",
            }}
          >
            <div>
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                Banner Preview
              </h2>

              <p
                className="text-[11px] mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Desktop banner preview
              </p>
            </div>

            <span
              className="text-xs px-2.5 py-1 rounded-md border"
              style={{
                borderColor: "var(--border-color)",
                color: "var(--text-secondary)",
              }}
            >
              Position: {banner.position ?? 0}
            </span>
          </div>

          <div className="p-5">
            {images.desktop ? (
              <div
                className="w-full overflow-hidden rounded-lg border"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor:
                    banner.backgroundColor || "transparent",
                }}
              >
                <img
                  src={getImageUrl(images.desktop)}
                  alt={banner.altText || banner.title || "Banner"}
                  className="w-full max-h-[420px] object-cover"
                />
              </div>
            ) : (
              <div
                className="h-64 rounded-lg border border-dashed flex flex-col items-center justify-center gap-3"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-muted)",
                }}
              >
                <ImageIcon className="w-10 h-10" />
                <span className="text-sm">
                  No desktop image available
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ==================================================
            BASIC INFORMATION
        ================================================== */}

        <Section
          title="Basic Information"
          description="Core information about this banner"
          icon={<InfoIcon />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <InfoItem
              label="Banner Title"
              value={banner.title}
            />

            <InfoItem
              label="Banner Type"
              value={formatType(banner.bannerType)}
            />

            <InfoItem
              label="Position"
              value={banner.position ?? 0}
            />

            <InfoItem label="Status">
              <StatusBadge status={banner.status} />
            </InfoItem>

            <InfoItem
              label="Alt Text"
              value={banner.altText || "—"}
            />

            <InfoItem
              label="Background Color"
              value={banner.backgroundColor || "—"}
            />

            <InfoItem
              label="Created"
              value={formatDateTime(banner.createdAt)}
            />

            <InfoItem
              label="Last Updated"
              value={formatDateTime(banner.updatedAt)}
            />
          </div>
        </Section>

        {/* ==================================================
            RESPONSIVE IMAGES
        ================================================== */}

        <Section
          title="Responsive Images"
          description="Images configured for different screen sizes"
          icon={<ImageIcon />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            <ImageCard
              title="Desktop"
              image={images.desktop}
              icon={<MonitorIcon />}
            />

            <ImageCard
              title="Tablet"
              image={images.tablet}
              icon={<TabletIcon />}
            />

            <ImageCard
              title="Mobile"
              image={images.mobile}
              icon={<SmartphoneIcon />}
            />

          </div>
        )}

        {/* ==================================================
            BANNER CONTENT
        ================================================== */}

        <Section
          title="Banner Content"
          description="Text displayed inside the banner"
          icon={<InfoIcon />}
        >
          <div className="space-y-5">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              <InfoItem
                label="Eyebrow / Small Heading"
                value={banner.eyebrow || "—"}
              />

              <InfoItem
                label="Main Heading"
                value={banner.heading || "—"}
              />

            </div>

            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-wide mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                Description
              </p>

              <div
                className="rounded-lg border p-4 text-sm leading-6"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                }}
              >
                {banner.description || "No description provided."}
              </div>
            </div>

          </div>
        </Section>

        {/* ==================================================
            CALL TO ACTION
        ================================================== */}

        <Section
          title="Call to Action"
          description="Button and destination configuration"
          icon={<LinkIcon />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <InfoItem
              label="Button Text"
              value={banner.primaryButton?.text || "—"}
            />

            <InfoItem
              label="Link Type"
              value={formatType(banner.primaryButton?.linkType)}
            />

            {banner.primaryButton?.linkType === "deal" &&
            banner.primaryButton?.dealId ? (
              <InfoItem label="Linked Deal">
                <span className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "#34d399" }}
                  >
                    {typeof banner.primaryButton.dealId === "object"
                      ? banner.primaryButton.dealId.name || "—"
                      : "Deal"}
                  </span>
                  {typeof banner.primaryButton.dealId === "object" &&
                    !banner.primaryButton.dealId.isActive && (
                      <StatusBadge status="inactive" />
                    )}
                </span>
              </InfoItem>
            ) : (
              <InfoItem
                label="Target Link"
              >
                {banner.primaryButton?.link ? (
                  <div className="flex items-center gap-2">
                    <LinkIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: "#34d399" }}
                    />
  
                    <span
                      className="text-sm break-all"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {banner.primaryButton.link}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    —
                  </span>
                )}
              </InfoItem>
            )}

          </div>
        </Section>

        {/* ==================================================
            DISPLAY RULES
        ================================================== */}

        <Section
          title="Display Rules"
          description="Where and on which devices this banner appears"
          icon={<MonitorIcon />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* PAGES */}

            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-wide mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Show On Pages
              </p>

              {pages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pages.map((page) => (
                    <Tag key={page}>
                      <CheckIcon
                        className="w-3.5 h-3.5 mr-1"
                        style={{ color: "#34d399" }}
                      />
                      {formatType(page)}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No pages configured
                </span>
              )}
            </div>

            {/* DEVICES */}

            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-wide mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                Show On Devices
              </p>

              {devices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {devices.map((device) => (
                    <Tag key={device}>
                      <CheckIcon
                        className="w-3.5 h-3.5 mr-1"
                        style={{ color: "#34d399" }}
                      />
                      {formatType(device)}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span
                  className="text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  No devices configured
                </span>
              )}
            </div>

          </div>
        </Section>

        {/* ==================================================
            SCHEDULE
        ================================================== */}

        <Section
          title="Schedule"
          description="Banner activation and expiration settings"
          icon={<CalendarIcon />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <InfoItem
              label="Start Date & Time"
              value={formatDateTime(banner.startDate)}
            />

            <InfoItem
              label="End Date & Time"
              value={formatDateTime(banner.endDate)}
            />

            <InfoItem label="Auto Publish">
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: banner.autoPublish
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(107,114,128,0.12)",
                    color: banner.autoPublish
                      ? "#34d399"
                      : "#9ca3af",
                  }}
                >
                  {banner.autoPublish ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : (
                    "—"
                  )}
                </span>

                {banner.autoPublish ? "Enabled" : "Disabled"}
              </span>
            </InfoItem>

            <InfoItem label="Auto Disable">
              <span className="flex items-center gap-2 text-sm">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: banner.autoDisable
                      ? "rgba(16,185,129,0.12)"
                      : "rgba(107,114,128,0.12)",
                    color: banner.autoDisable
                      ? "#34d399"
                      : "#9ca3af",
                  }}
                >
                  {banner.autoDisable ? (
                    <CheckIcon className="w-3.5 h-3.5" />
                  ) : (
                    "—"
                  )}
                </span>

                {banner.autoDisable ? "Enabled" : "Disabled"}
              </span>
            </InfoItem>

          </div>
        </Section>

        {/* ==================================================
            SYSTEM INFORMATION
        ================================================== */}

        <Section
          title="System Information"
          description="Database and record information"
          icon={<InfoIcon />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

            <InfoItem
              label="Banner ID"
              value={banner._id || "—"}
            />

            <InfoItem
              label="Created At"
              value={formatDateTime(banner.createdAt)}
            />

            <InfoItem
              label="Updated At"
              value={formatDateTime(banner.updatedAt)}
            />

            <InfoItem
              label="Current Position"
              value={banner.position ?? 0}
            />

          </div>
        )}

      </div>
    </div>
  );
}
