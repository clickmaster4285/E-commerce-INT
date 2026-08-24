"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import bannerAPI from "@/apis/admin/bannerApi";// ICONS
// ======================================================

const ArrowLeftIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

const ImageIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const CalendarIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const LinkIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 13a5 5 0 007.07.07l1.42-1.42a5 5 0 000-7.07 5 5 0 00-7.07 0L10 6m4 5a5 5 0 00-7.07-.07l-1.42 1.42a5 5 0 000 7.07 5 5 0 007.07 0L14 18"
    />
  </svg>
);

const MonitorIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm4 16h8m-4-4v4"
    />
  </svg>
);

const SmartphoneIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 3h10a1 1 0 011 1v16a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1zm4 15h2"
    />
  </svg>
);

const TabletIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zm5 15h2"
    />
  </svg>
);

const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const InfoIcon = ({ className = "w-4 h-4" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const Spinner = ({ className = "w-5 h-5" }) => (
  <svg
    className={`${className} animate-spin`}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    />
  </svg>
);

// ======================================================
// HELPERS
// ======================================================

const API_BASE =
  process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5000";

const formatDate = (date) => {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (date) => {
  if (!date) return "—";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatType = (value) => {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getImageUrl = (image) => {
  if (!image) return null;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_BASE}/${image.replace(/^\/+/, "")}`;
};

// ======================================================
// STATUS BADGE
// ======================================================

const StatusBadge = ({ status }) => {
  const styles = {
    active: {
      backgroundColor: "rgba(16,185,129,0.10)",
      color: "#34d399",
      border: "1px solid rgba(16,185,129,0.25)",
    },
    inactive: {
      backgroundColor: "rgba(239,68,68,0.10)",
      color: "#f87171",
      border: "1px solid rgba(239,68,68,0.25)",
    },
    scheduled: {
      backgroundColor: "rgba(59,130,246,0.10)",
      color: "#60a5fa",
      border: "1px solid rgba(59,130,246,0.25)",
    },
    expired: {
      backgroundColor: "rgba(107,114,128,0.10)",
      color: "#9ca3af",
      border: "1px solid rgba(107,114,128,0.25)",
    },
    draft: {
      backgroundColor: "rgba(245,158,11,0.10)",
      color: "#fbbf24",
      border: "1px solid rgba(245,158,11,0.25)",
    },
  };

  const style = styles[status] || styles.draft;

  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide"
      style={style}
    >
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
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: "var(--bg-tertiary)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2 border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        <span style={{ color: "#34d399" }}>{icon}</span>

        <span
          className="text-xs font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </span>
      </div>

      <div className="p-3">
        {imageUrl ? (
          <div className="rounded-md overflow-hidden border aspect-video">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-video rounded-md flex flex-col items-center justify-center gap-2 border border-dashed"
            style={{
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            <ImageIcon className="w-7 h-7" />
            <span className="text-xs">No image uploaded</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ======================================================
// LIST TAG
// ======================================================

const Tag = ({ children }) => (
  <span
    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs border"
    style={{
      backgroundColor: "var(--bg-tertiary)",
      borderColor: "var(--border-color)",
      color: "var(--text-primary)",
    }}
  >
    {children}
  </span>
);

// ======================================================
// MAIN PAGE
// ======================================================

export default function BannerDetailPage() {
  const params = useParams();
  const router = useRouter();

  const bannerId = params?.id;

  // ====================================================
  // QUERY
  // ====================================================

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

  // ====================================================
  // IMAGE DATA
  // ====================================================

  const images = useMemo(
    () => ({
      desktop: banner?.desktopImage,
      tablet: banner?.tabletImage,
      mobile: banner?.mobileImage,
    }),
    [banner]
  );

  // ====================================================
  // LOADING
  // ====================================================

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ color: "var(--text-primary)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner className="w-7 h-7" />

          <p
            className="text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            Loading banner...
          </p>
        </div>
      </div>
    );
  }

  // ====================================================
  // ERROR
  // ====================================================

  if (isError || !banner) {
    return (
      <div
        className="min-h-screen p-6"
        style={{ color: "var(--text-primary)" }}
      >
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm mb-6 transition hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeftIcon />
            Back
          </button>

          <div
            className="rounded-lg border p-10 text-center"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-color)",
            }}
          >
            <div className="text-red-400 text-sm font-semibold mb-2">
              Unable to load banner
            </div>

            <p
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {error?.response?.data?.message ||
                error?.message ||
                "Banner not found"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================
  // DATA
  // ====================================================

  const pages = banner.displayRules?.pages || [];
  const devices = banner.displayRules?.devices || [];

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      className="w-full min-h-screen p-6"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="w-full max-w-7xl mx-auto space-y-5">

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

          <button
            onClick={() => router.push(`/admin/banners?edit=${banner._id}`)}
            className="h-9 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            <EditIcon />
            Edit Banner
          </button>
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
        </Section>

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
        </Section>

        {/* ==================================================
            BOTTOM ACTIONS
        ================================================== */}

        <div className="flex flex-col sm:flex-row justify-between gap-3 pt-1 pb-5">

          <button
            onClick={() => router.back()}
            className="h-10 px-5 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition hover:opacity-80"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--bg-card)",
              color: "var(--text-primary)",
            }}
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Banners
          </button>

          <button
            onClick={() =>
              router.push(`/admin/banners?edit=${banner._id}`)
            }
            className="h-10 px-5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            <EditIcon />
            Edit Banner
          </button>

        </div>

      </div>
    </div>
  );
}