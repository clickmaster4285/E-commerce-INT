"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Briefcase,
  Package,
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  User,
  Loader2,
  ChevronDown,
  Pencil,
  X,
  Eye,
  EyeOff,
  Trash2,
  Power,
  ShoppingCart,
  Star,
  TrendingUp,
  MapPin,
  IdCard,
  Tag,
  Store,
  FileText,
  Camera,
  ShoppingBag,
  CreditCard,
  LogIn,
  Settings,
  BarChart3,
  Layers,
  ShieldCheck,
  Percent,
  Image, // ✅ Added for Banners
} from "lucide-react";

import { employeeApi } from "@/apis/admin/employeeApi";
import adminHttp from "@/apis/axiosInstance";
import { useEmployeeSocketSync } from "@/hooks/useEmployeeSocket";

// ==========================================
// ✅ ALLOWED PERMISSIONS — sab by default true
// (admin chahe to koi bhi toggle off kar sakta hai)
// ==========================================
const ALLOWED_PERMISSIONS = {
  dashboard: { label: "Dashboard", default: true },
  employees: { label: "Employees", default: true },
  products: { label: "Products", default: true },
  featuredProducts: { label: "Featured Products", default: true },
  reviews: { label: "Reviews", default: true },
  brands: { label: "Brands", default: true },
  categories: { label: "Categories", default: true },
  discounts: { label: "Discounts", default: true },
  deals: { label: "Deals", default: true },
  bundles: { label: "Bundles", default: true },
  profile: { label: "Profile", default: true },
  store: { label: "Store", default: true },
  banners: { label: "Banners", default: true }, // ✅ Added Banners Permission
  manageStock: { label: "Manage Stock", default: true }, // ✅ Manage Stock module
  shipping: { label: "Shipping", default: true },
  order: { label: "Order", default: true },
  attribute: { label: "Attribute", default: true },
};

// ==========================================
// HELPER COMPONENTS
// ==========================================
function StatusBadge({ status }) {
  const active = status === "active";

  return (
    <span
      className="badge"
      style={
        active
          ? {
              backgroundColor: "var(--success-soft)",
              color: "var(--success-text)",
              borderColor:
                "color-mix(in srgb, var(--success) 26%, transparent)",
            }
          : {
              backgroundColor: "var(--danger-soft)",
              color: "var(--danger-text)",
              borderColor:
                "color-mix(in srgb, var(--danger) 26%, transparent)",
            }
      }
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: "currentColor" }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const PREDEFINED_DEPARTMENTS = [
  "HR",
  "Manager",
  "IT",
  "Finance",
  "Marketing",
  "Customer Service",
  "Operations",
  "Store Manager",
];

function DepartmentDropdown({ value, onChange, disabled }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(
    PREDEFINED_DEPARTMENTS
  );

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value || "");
    }
  }, [value]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(PREDEFINED_DEPARTMENTS);
    } else {
      setFilteredOptions(
        PREDEFINED_DEPARTMENTS.filter((d) =>
          d.toLowerCase().includes(inputValue.toLowerCase())
        )
      );
    }
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "6px",
    height: "32px",
    fontSize: "13px",
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Type or select..."
          disabled={disabled}
          className="w-full h-10 md:h-8 pl-3 pr-7 rounded-md text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
          style={inputStyle}
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute z-10 w-full mb-1 rounded-md shadow-lg max-h-48 overflow-auto py-1"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
            bottom: "100%",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              className="px-3 py-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              No matching departments
            </div>
          ) : (
            filteredOptions.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => {
                  setInputValue(dept);
                  onChange(dept);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-1.5 text-[13px] transition"
                style={{
                  color: "var(--text-primary)",
                  backgroundColor:
                    inputValue === dept
                      ? "var(--success-soft)"
                      : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (inputValue !== dept) {
                    e.currentTarget.style.backgroundColor =
                      "var(--bg-tertiary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (inputValue !== dept) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {dept}
              </button>
            ))
          )}

          {inputValue.trim() &&
            !PREDEFINED_DEPARTMENTS.includes(inputValue.trim()) && (
              <div
                className="px-3 py-1.5 text-[11px] border-t"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-muted)",
                }}
              >
                Custom: &quot;{inputValue.trim()}&quot;
              </div>
            )}
        </div>
      )}
    </div>
  );
}
// ==========================================
// EMPLOYEE OVERVIEW (visible layout)
// ==========================================
function EmployeeOverview({
  employee,
  name,
  email,
  phone,
  role,
  status,
  avatar,
  department,
  empId,
  joinDate,
  ordersHandled,
  salesGenerated,
  productsAdded,
  performanceRating,
  permissions,
  filteredPermissions,
  enabledCount,
  totalCount,
  activities,
  canEditPermissions,
  setPermissionsData,
  setShowPermissionsModal,
  openEditModal,
  router,
  updatedInfo,
}) {
  const openPermissions = () => {
    const initialData = {};
    Object.keys(ALLOWED_PERMISSIONS).forEach((key) => {
      initialData[key] =
        permissions?.[key] !== undefined
          ? permissions[key]
          : ALLOWED_PERMISSIONS[key].default;
    });
    setPermissionsData(initialData);
    setShowPermissionsModal(true);
  };

  const relativeTime = (ts) => {
    if (!ts) return "";
    const minutes = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  const infoItems = [
    ["Full Name", name, User],
    ["Username", email.split("@")[0], IdCard],
    ["Email Address", email, Mail],
    ["Phone Number", phone || "N/A", Phone],
    ["Department", department, Layers],
    ["Employee Code", empId, Tag],
    ["Joined At", joinDate, Clock],
  ];

  const STAT_TONES = {
    success: { bg: "var(--success-soft)", color: "var(--success-text)" },
    warning: { bg: "var(--warning-soft)", color: "var(--warning-text)" },
    info: { bg: "var(--info-soft)", color: "var(--info-text)" },
    accent: { bg: "var(--accent-soft)", color: "var(--accent)" },
  };

  const stats = [
    { label: "Orders Handled", value: String(ordersHandled ?? 0), icon: ShoppingCart, tone: "success", hint: "Lifetime processed" },
    { label: "Sales Generated", value: `$${Number(salesGenerated || 0).toLocaleString()}`, icon: DollarSign, tone: "warning", hint: "Total revenue" },
    { label: "Products Added", value: String(productsAdded ?? 0), icon: Package, tone: "info", hint: "Catalog listings" },
    { label: "Performance Rating", value: `${Number(performanceRating || 0).toFixed(1)}/5`, icon: Star, tone: "accent", hint: "Average score" },
  ];

  const enabledPercent =
    totalCount ? Math.round((enabledCount / totalCount) * 100) : 0;

  const [activityFilter, setActivityFilter] = useState("all");

  const activityCategories = Array.from(
    new Set(activities.map((a) => a.category).filter(Boolean))
  );

  const visibleActivities =
    activityFilter === "all"
      ? activities
      : activities.filter((a) => a.category === activityFilter);

  return (
    <>
      {/* ============ TOP BAR ============ */}
      <div className="page-header">
        <div className="min-w-0">
          <nav
            className="mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px]"
            style={{ color: "var(--text-muted)" }}
            aria-label="Breadcrumb"
          >
            <button
              onClick={() => router.push("/admin/employees")}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Employees
            </button>
            <span style={{ opacity: 0.5 }}>/</span>
            <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
              {name}
            </span>
          </nav>

          <h1 className="page-title">
            <span className="page-title-icon">
              <User className="h-[18px] w-[18px]" />
            </span>
            Employee Profile
          </h1>

          <p className="page-subtitle">
            Complete record, performance and access control for this staff member.
          </p>
        </div>

        <div className="page-actions">
          {canEditPermissions && (
            <button
              onClick={openPermissions}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Manage Access
            </button>
          )}

          <button
            onClick={() => openEditModal(employee)}
            className="btn-primary inline-flex items-center gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit Employee
          </button>
        </div>
      </div>

      {/* ============ HERO CARD ============ */}
      <section className="card overflow-hidden">
        <div
          aria-hidden="true"
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--accent), var(--purple), var(--info))",
          }}
        />

        <div className="p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            {/* Identity */}
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="relative shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="h-20 w-20 rounded-2xl border object-cover"
                    style={{
                      borderColor: "var(--border-color)",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  />
                ) : (
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold"
                    style={{
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent)",
                      border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
                    }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}

                <span
                  title={status === "active" ? "Online account active" : "Account inactive"}
                  className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px]"
                  style={{
                    backgroundColor:
                      status === "active" ? "var(--success)" : "var(--danger)",
                    borderColor: "var(--bg-card)",
                  }}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    className="truncate text-[20px] font-bold tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {name}
                  </h2>
                  <StatusBadge status={status} />
                  {role && role !== "staff" && (
                    <span className="badge badge-neutral capitalize">
                      {role === "admin" ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <Briefcase className="h-3 w-3" />
                      )}
                      {role}
                    </span>
                  )}
                </div>

                <div
                  className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
                    style={{ backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{email}</span>
                  </span>

                  {phone && phone !== "N/A" && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
                      style={{ backgroundColor: "var(--bg-tertiary)" }}
                    >
                      <Phone className="h-3 w-3 shrink-0" />
                      {phone}
                    </span>
                  )}

                  {department && department !== "Not assigned" && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium"
                      style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      <Layers className="h-3 w-3 shrink-0" />
                      {department}
                    </span>
                  )}

                  <span
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1"
                    style={{ backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <Calendar className="h-3 w-3 shrink-0" />
                    Joined {joinDate}
                  </span>
                </div>

                {updatedInfo && (
                  <div
                    className="mt-3 flex items-center gap-2 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <Pencil className="h-3 w-3 shrink-0" style={{ color: "var(--info)" }} />
                    <span>
                      Last updated by{" "}
                      <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>
                        {updatedInfo.name}
                      </span>{" "}
                      · {updatedInfo.date}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Key facts */}
            <div
              className="grid shrink-0 grid-cols-2 gap-3 rounded-xl border p-4 sm:grid-cols-4 xl:min-w-[420px]"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--bg-card-alt)",
              }}
            >
              {[
                ["Employee Code", empId, IdCard],
                ["Department", department, Layers],
                ["Joined At", joinDate, Calendar],
                ["Access Level", `${enabledCount}/${totalCount}`, ShieldCheck],
              ].map(([label, value, Icon]) => (
                <div key={label} className="min-w-0">
                  <span
                    className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}
                  >
                    <Icon className="h-3 w-3" />
                  </span>

                  <p
                    className="text-[9.5px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </p>

                  <p
                    className="mt-0.5 truncate text-[12.5px] font-bold capitalize"
                    style={{ color: "var(--text-primary)" }}
                    title={value || "—"}
                  >
                    {value || "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ PERFORMANCE STATS ============ */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tone, hint }) => {
          const toneStyle = STAT_TONES[tone];
          return (
            <div key={label} className="card card-hover p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[9.5px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </p>
                  <p
                    className="mt-1 truncate text-[18px] font-extrabold tabular-nums tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {value}
                  </p>
                </div>

                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: toneStyle.bg,
                    color: toneStyle.color,
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
              </div>

              <p
                className="mt-3 border-t pt-2.5 text-[10.5px] font-medium"
                style={{ color: "var(--text-muted)", borderColor: "var(--border-color)" }}
              >
                {hint}
              </p>
            </div>
          );
        })}
      </div>

      {/* ============ MAIN CONTENT GRID ============ */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* Left column */}
        <div className="space-y-3 xl:col-span-7">
          {/* Personal Information */}
          <section className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-2 border-b pb-3" style={{ borderColor: "var(--border-color)" }}>
              <h3 className="section-header mb-0">
                <User className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                Personal Information
              </h3>

              <button
                onClick={() => openEditModal(employee)}
                className="btn-ghost inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            </div>

            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {infoItems.map(([label, value, Icon]) => (
                <div key={label} className="flex min-w-0 items-start gap-2.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>

                  <div className="min-w-0">
                    <p
                      className="text-[9.5px] font-medium uppercase tracking-wide"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {label}
                    </p>
                    <p
                      className="mt-0.5 break-words text-[12.5px] font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {value || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Access Control */}
          <section className="card p-5">
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3"
              style={{ borderColor: "var(--border-color)" }}
            >
              <h3 className="section-header mb-0">
                <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                Access Control
              </h3>

              <div className="flex items-center gap-2">
                <span className="badge badge-accent">
                  {enabledCount} of {totalCount} enabled
                </span>

                {canEditPermissions && (
                  <button
                    onClick={openPermissions}
                    className="btn-ghost inline-flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                )}
              </div>
            </div>

            {/* Coverage bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>
                <span>Permission coverage</span>
                <span className="tabular-nums">{enabledPercent}%</span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${enabledPercent}%`,
                    background: "linear-gradient(90deg, var(--success), var(--info))",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPermissions.map(({ key, label, value }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors"
                  style={{
                    borderColor: value
                      ? "color-mix(in srgb, var(--success) 24%, transparent)"
                      : "var(--border-color)",
                    backgroundColor: value ? "var(--success-soft)" : "var(--bg-card-alt)",
                  }}
                >
                  <span
                    className="truncate text-[11.5px] font-semibold"
                    style={{ color: "var(--text-primary)" }}
                    title={label}
                  >
                    {label}
                  </span>

                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide"
                    style={{ color: value ? "var(--success-text)" : "var(--danger-text)" }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "currentColor" }}
                    />
                    {value ? "On" : "Off"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column — Activity Log */}
        <section className="card flex flex-col p-5 xl:col-span-5">
          <div
            className="mb-4 flex items-center justify-between gap-2 border-b pb-3"
            style={{ borderColor: "var(--border-color)" }}
          >
            <h3 className="section-header mb-0">
              <Clock className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
              Activity Log
            </h3>

            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: "var(--success-soft)",
                  color: "var(--success-text)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ backgroundColor: "currentColor" }}
                />
                Live
              </span>

              <span
                className="text-[11px] font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                {activities.length} {activities.length === 1 ? "event" : "events"}
              </span>
            </div>
          </div>

          {activityCategories.length > 1 && (
            <div className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto pb-0.5">
              {[{ label: "All", value: "all" }, ...activityCategories.map((c) => ({ label: c, value: c }))].map(
                (chip) => {
                  const activeChip = activityFilter === chip.value;

                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setActivityFilter(chip.value)}
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors"
                      style={{
                        backgroundColor: activeChip ? "var(--accent-soft)" : "transparent",
                        color: activeChip ? "var(--accent)" : "var(--text-muted)",
                        border: "1px solid",
                        borderColor: activeChip
                          ? "color-mix(in srgb, var(--accent) 28%, transparent)"
                          : "var(--border-color)",
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                }
              )}
            </div>
          )}

          <div className="custom-scrollbar max-h-[620px] min-h-[220px] flex-1 overflow-y-auto pr-1">
            {visibleActivities.length ? (
              visibleActivities.map((activity, index) => {
                const colors = getActivityColor(activity.category);
                const isLast = index === visibleActivities.length - 1;

                return (
                  <div
                    key={activity._id || index}
                    className="group relative flex gap-3 pb-4 last:pb-0"
                  >
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className="absolute left-[13px] top-8 h-full w-px"
                        style={{ backgroundColor: "var(--border-color)" }}
                      />
                    )}

                    <span className="relative z-10 mt-0.5">
                      <ActivityIcon category={activity.category} size="sm" />
                    </span>

                    <div className="min-w-0 flex-1 rounded-lg py-1.5 pl-2 pr-1 transition-colors hover:bg-[var(--bg-card-alt)]">
                      <p
                        className="text-[12px] font-semibold leading-snug"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {activity.action}
                      </p>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide"
                          style={{ backgroundColor: colors.bg, color: colors.color }}
                        >
                          {activity.category}
                        </span>

                        {activity.performedByName && (
                          <span className="text-[9.5px]" style={{ color: "var(--text-muted)" }}>
                            by{" "}
                            <span
                              className="font-semibold"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {activity.performedByName}
                            </span>
                          </span>
                        )}

                        <span
                          className="text-[9.5px] font-semibold"
                          style={{ color: "var(--info-text)" }}
                        >
                          {relativeTime(activity.timestamp)}
                        </span>
                      </div>

                      <p
                        className="mt-1 text-[9.5px]"
                        style={{ color: "var(--text-muted)", opacity: 0.85 }}
                      >
                        {new Date(activity.timestamp).toLocaleString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon">
                  <FileText className="h-6 w-6" />
                </span>
                <p className="text-[12px]">
                  {activityFilter === "all"
                    ? "No activity found for this employee yet."
                    : `No ${activityFilter} activity recorded yet.`}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}






// ==========================================
// ACTIVITY STYLES
// ==========================================
const ACTIVITY_STYLES = {
  "Employee Management": {
    icon: Users,
    bg: "var(--info-soft)",
    color: "var(--indigo-text)",
  },

  "Order Management": {
    icon: ShoppingCart,
    bg: "var(--success-soft)",
    color: "var(--success-text)",
  },

  "Product Management": {
    icon: Package,
    bg: "var(--info-soft)",
    color: "var(--info-text)",
  },

  "Customer Management": {
    icon: Users,
    bg: "rgba(251, 191, 36, 0.1)",
    color: "var(--warning-text)",
  },

  "Coupon Management": {
    icon: Star,
    bg: "var(--purple-soft)",
    color: "var(--purple-text)",
  },

  Authentication: {
    icon: LogIn,
    bg: "rgba(34, 211, 238, 0.1)",
    color: "#22d3ee",
  },

  "Store Management": {
    icon: Store,
    bg: "rgba(244, 114, 182, 0.1)",
    color: "var(--pink)",
  },

  "Discount Management": {
    icon: Percent,
    bg: "rgba(236, 72, 153, 0.1)",
    color: "var(--pink)",
  },
};

const DEFAULT_ACTIVITY_STYLE = {
  icon: FileText,
  bg: "rgba(148, 163, 184, 0.1)",
  color: "var(--text-muted)",
};

function ActivityIcon({ category, size = "sm" }) {
  const style =
    ACTIVITY_STYLES[category] || DEFAULT_ACTIVITY_STYLE;

  const IconComponent = style.icon;

  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-7 h-7",
    md: "w-8 h-8",
  };

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center shrink-0`}
      style={{ backgroundColor: style.bg }}
    >
      <IconComponent
        className={iconSizes[size]}
        style={{ color: style.color }}
        strokeWidth={1.75}
      />
    </div>
  );
}

function getActivityColor(category) {
  const style =
    ACTIVITY_STYLES[category] || DEFAULT_ACTIVITY_STYLE;

  return {
    bg: style.bg,
    color: style.color,
  };
}

// ==========================================
// MAIN EMPLOYEE DETAIL PAGE
// ==========================================
export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();

  const employeeId = params.id;

  const queryClient =
    useQueryClient();

  const { markSelfAction } =
    useEmployeeSocketSync(employeeId);

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [
    showPermissionsModal,
    setShowPermissionsModal,
  ] = useState(false);

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });

  // ==========================================
  // ✅ PERMISSIONS STATE — sab by default true
  // ==========================================
  const [
    permissionsData,
    setPermissionsData,
  ] = useState({
    dashboard: true,
    employees: true,
    products: true,
    featuredProducts: true,
    reviews: true,
    brands: true,
    categories: true,
    discounts: true,
    deals: true,
    bundles: true,
    profile: true,
    store: true,
    banners: true,
    manageStock: true,
    shipping: true,
    order: true,
    attribute: true,
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  // ==========================================
  // CURRENT USER (from backend via TanStack Query)
  // ==========================================
  const { data: currentUserProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await adminHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = currentUserProfile
    ? { _id: currentUserProfile._id || currentUserProfile.id }
    : null;

  // ✅ Jis ko 'employees' permission hai wahi dusre employee ko edit / permission de sakta hai
  // (admin bypass). Khud ki permission change karna waise bhi blocked hai (neeche + backend).
  const isCurrentAdmin =
    String(currentUserProfile?.role || "").toLowerCase() === "admin";
  const canManageEmployees =
    isCurrentAdmin || currentUserProfile?.permissions?.employees !== false;
  const denyEmployeesAccess = () =>
    toast.error("Access denied. You don't have 'employees' permission.", {
      duration: 5000,
      description: "Contact an administrator or another staff member to grant you access.",
    });

  // ==========================================
  // GET EMPLOYEE
  // ==========================================
  const {
    data: employee,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "employee",
      employeeId,
    ],

    queryFn: () => {
      if (!employeeId) {
        throw new Error(
          "No Employee ID provided"
        );
      }

      return employeeApi.getById(
        employeeId
      );
    },

    enabled: !!employeeId,
    retry: 1,
    staleTime: 0,
    refetchInterval: false,
  });

  // ==========================================
  // UPDATE EMPLOYEE
  // ==========================================
  const updateMutation =
    useMutation({
      mutationFn: (data) =>
        employeeApi.update(
          employeeId,
          data
        ),

      onSuccess: async (
        updatedEmployee
      ) => {
        markSelfAction();

        if (
          updatedEmployee &&
          updatedEmployee._id
        ) {
          queryClient.setQueryData(
            ["employee", employeeId],
            updatedEmployee
          );
        }

        await queryClient.invalidateQueries(
          {
            queryKey: ["employees"],
          }
        );

        toast.success(
          "Employee updated successfully"
        );

        closeEditModal();
      },

      onError: (err) =>
        toast.error(
          err.message ||
            "Update failed"
        ),
    });

  // ==========================================
  // UPDATE PERMISSIONS
  // ==========================================
  const updatePermissionsMutation =
    useMutation({
      mutationFn: async (
        newPermissions
      ) => {

        // ✅ 'employees' permission ke baghair koi permission change nahi kar sakta
        if (!canManageEmployees) {
          throw new Error(
            "Access denied. You don't have 'employees' permission."
          );
        }

        const currentStaffId =
          currentUser?._id || null;

        const isSelf =
          String(currentStaffId) ===
            String(employeeId) ||
          (employee?.userId?._id &&
            String(currentStaffId) ===
              String(
                employee.userId._id
              ));

        if (isSelf) {
          throw new Error(
            "Security Restriction: You cannot modify your own permissions."
          );
        }

        return employeeApi.update(
          employeeId,
          {
            permissions:
              newPermissions,
          }
        );
      },

      onSuccess: async (
        updatedEmployee,
        newPermissions
      ) => {

        queryClient.setQueryData(
          ["employee", employeeId],
          (oldData) => {
            if (!oldData)
              return updatedEmployee;

            const oldUserId =
              typeof oldData.userId ===
              "object"
                ? oldData.userId
                : {
                    _id:
                      oldData.userId,
                  };

            return {
              ...oldData,

              userId: {
                ...oldUserId,

                permissions:
                  newPermissions,
              },
            };
          }
        );

        markSelfAction();

        await queryClient.invalidateQueries(
          {
            queryKey: ["employees"],
          }
        );

        toast.success(
          "Permissions updated successfully"
        );

        setShowPermissionsModal(
          false
        );
      },

      onError: (err) => {
        console.error(
          "❌ Permission Update Error:",
          err
        );

        toast.error(
          err?.message ||
            "Failed to update permissions"
        );
      },
    });

  // ==========================================
  // CLOSE EDIT MODAL
  // ==========================================
  const closeEditModal = () => {
    setShowEditModal(false);

    setFormData({
      name: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ==========================================
  // OPEN EDIT MODAL
  // ==========================================
  const openEditModal = (emp) => {
    // ✅ 'employees' permission ke baghair edit nahi
    if (!canManageEmployees) {
      denyEmployeesAccess();
      return;
    }
    const userData =
      emp.userId || {};

    setFormData({
      name:
        userData.name ||
        emp.name ||
        "",

      email:
        userData.email ||
        emp.email ||
        "",

      phone:
        userData.phone ||
        emp.phone ||
        "",

      department:
        emp.department ||
        "",

      status:
        userData.status ||
        emp.status ||
        "active",

      password: "",
      confirmPassword: "",
    });

    setShowEditModal(true);
  };

  // ==========================================
  // SUBMIT EMPLOYEE UPDATE
  // ==========================================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return toast.error(
        "Name is required"
      );
    }

    if (!formData.email.trim()) {
      return toast.error(
        "Email is required"
      );
    }

    if (!formData.department.trim()) {
      return toast.error(
        "Department is required"
      );
    }

    if (
      formData.password ||
      formData.confirmPassword
    ) {
      if (!formData.password) {
        return toast.error(
          "Password is required"
        );
      }
      if (!formData.confirmPassword) {
        return toast.error(
          "Confirm Password is required"
        );
      }
      if (
        formData.password.length < 6
      ) {
        return toast.error(
          "Password must be at least 6 characters"
        );
      }
      if (
        formData.password !==
        formData.confirmPassword
      ) {
        return toast.error(
          "Passwords do not match"
        );
      }
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone || "",
      department:
        formData.department.trim(),
      status: formData.status,
    };

    if (formData.password) {
      payload.password =
        formData.password;
    }

    updateMutation.mutate(
      payload
    );
  };

  // ==========================================
  // LOADING
  // ==========================================
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{
              color: "var(--accent)",
            }}
          />

          <p
            className="text-[13px]"
            style={{
              color:
                "var(--text-muted)",
            }}
          >
            Loading employee details...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (isError || !employee) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-500 opacity-60" />

        <p
          className="text-[14px] text-center max-w-md"
          style={{
            color:
              "var(--text-muted)",
          }}
        >
          Failed to load employee
          details.
          <br />

          <span className="text-[12px] text-red-400 block mt-2 bg-red-500/10 p-2 rounded">
            {error?.message ||
              "Employee not found"}
          </span>
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="min-h-[44px] h-9 px-4 rounded-lg text-[13px] font-semibold border border-gray-600 hover:bg-gray-800"
            style={{
              color:
                "var(--text-primary)",
            }}
          >
            Try Again
          </button>

          <button
            onClick={() =>
              router.back()
            }
            className="min-h-[44px] h-9 px-4 rounded-lg text-[13px] font-semibold"
            style={{
              backgroundColor:
                "var(--accent)",
              color:
                "var(--accent-text)",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // EMPLOYEE DATA
  // ==========================================
  const userData =
    employee.userId || {};

  const extractedStatus =
    userData.status ||
    employee.status ||
    "active";

  const {
    name =
      userData.name ||
      "Unknown",

    email =
      userData.email ||
      "N/A",

    phone =
      userData.phone ||
      "N/A",

    role =
      userData.role ||
      "staff",

    status =
      extractedStatus,

    avatar =
      userData.avatar ||
      employee.avatar ||
      null,

    created_at =
      employee.created_at ||
      null,

    department =
      employee.department ||
      "Not assigned",

    employeeId: empId =
      employee.employeeCode ||
      "N/A",

    ordersHandled =
      employee.ordersHandled ||
      0,

    salesGenerated =
      employee.salesGenerated ||
      0,

    productsAdded =
      employee.productsAdded ||
      0,

    performanceRating =
      employee.performanceRating ||
      0,

    activities =
      employee.activities ||
      [],

    permissions =
      userData.permissions ||
      employee.permissions ||
      {},
  } = employee;

  const joinDate = created_at
    ? new Date(
        created_at
      ).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      )
    : "N/A";

  // ==========================================
  // "LAST UPDATED" INFO — shown only when the
  // record was genuinely updated after creation
  // ==========================================
  const updatedInfo = (() => {
    const updatedDate = employee.updated_at ? new Date(employee.updated_at) : null;
    const createdDate = employee.created_at ? new Date(employee.created_at) : null;

    if (!updatedDate || Number.isNaN(updatedDate.getTime())) return null;
    if (!createdDate || Number.isNaN(createdDate.getTime())) return null;
    if (updatedDate.getTime() - createdDate.getTime() < 60000) return null;

    return {
      name:
        employee.updatedby?.name ||
        employee.updatedby?.email ||
        "Admin",
      date: updatedDate.toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  })();

  const cardStyle = {
    backgroundColor:
      "var(--bg-card)",
    border:
      "1px solid var(--border-color)",
    borderRadius: "12px",
  };

  const inputStyle = {
    backgroundColor:
      "var(--bg-card)",
    border:
      "1px solid var(--border-color)",
    color:
      "var(--text-primary)",
    borderRadius: "8px",
  };

  const isSubmitting =
    updateMutation.isPending;

  const isSelfView =
    String(
      currentUser?._id
    ) === String(employeeId) ||
    (employee?.userId?._id &&
      String(
        currentUser?._id
      ) ===
        String(
          employee.userId._id
        ));

  const canEditPermissions =
    !isSelfView && canManageEmployees;

  // ==========================================
  // PERMISSIONS
  // ==========================================
  const filteredPermissions =
    Object.entries(
      ALLOWED_PERMISSIONS
    ).map(
      ([key, config]) => ({
        key,
        label: config.label,

        value:
          permissions?.[key] !==
          undefined
            ? permissions[key]
            : config.default,
      })
    );

  const enabledCount =
    filteredPermissions.filter(
      (p) => p.value
    ).length;

  const totalCount =
    filteredPermissions.length;

  return (
    <div
      className="w-full min-h-screen space-y-3"
      style={{
        color:
          "var(--text-primary)",
      }}
    >
      <EmployeeOverview
        employee={employee}
        name={name}
        email={email}
        phone={phone}
        role={role}
        status={status}
        avatar={avatar}
        department={department}
        empId={empId}
        joinDate={joinDate}
        ordersHandled={ordersHandled}
        salesGenerated={salesGenerated}
        productsAdded={productsAdded}
        performanceRating={performanceRating}
        permissions={permissions}
        filteredPermissions={filteredPermissions}
        enabledCount={enabledCount}
        totalCount={totalCount}
        activities={activities || []}
        canEditPermissions={canEditPermissions}
        setPermissionsData={setPermissionsData}
        setShowPermissionsModal={setShowPermissionsModal}
        openEditModal={openEditModal}
        router={router}
        updatedInfo={updatedInfo}
      />

      {/* ==========================================
          EDIT EMPLOYEE MODAL
      ========================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
            style={cardStyle}
          >
            <div
              className="px-5 py-4 flex items-center justify-between rounded-t-xl shrink-0"
              style={{
                borderBottom:
                  "1px solid var(--border-color)",
                backgroundColor:
                  "var(--bg-card)",
              }}
            >
              <div>
                <h3 className="text-base font-semibold">
                  Edit Employee
                </h3>

                <p
                  className="text-[11px] mt-0.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Update employee details
                </p>
              </div>

              <button
                onClick={
                  closeEditModal
                }
                disabled={
                  isSubmitting
                }
                className="p-1 rounded transition disabled:opacity-50 hover:opacity-70"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="p-5 space-y-3 overflow-y-auto flex-1"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Full Name *
                  </label>

                  <input
                    type="text"
                    value={
                      formData.name
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target
                          .value,
                      })
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                    style={
                      inputStyle
                    }
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Email *
                  </label>

                  <input
                    type="email"
                    value={
                      formData.email
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target
                          .value,
                      })
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                    style={
                      inputStyle
                    }
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{
                    color:
                      "var(--text-secondary)",
                  }}
                >
                  Phone number
                </label>

                <input
                  type="tel"
                  value={
                    formData.phone
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target
                        .value,
                    })
                  }
                  disabled={
                    isSubmitting
                  }
                  className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                  style={inputStyle}
                  placeholder="+92 300 1234567"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        formData.password
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          password:
                            e.target
                              .value,
                        })
                      }
                      disabled={
                        isSubmitting
                      }
                      className="w-full h-10 md:h-9 px-3 pr-9 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                      style={
                        inputStyle
                      }
                      placeholder="Min 6 chars"
                      minLength={6}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Confirm Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        formData.confirmPassword
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword:
                            e.target
                              .value,
                        })
                      }
                      disabled={
                        isSubmitting
                      }
                      className="w-full h-10 md:h-9 px-3 pr-9 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                      style={
                        inputStyle
                      }
                      placeholder="Confirm"
                      minLength={6}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Status
                  </label>

                  <select
                    value={
                      formData.status
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status:
                          e.target
                            .value,
                      })
                    }
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50"
                    style={
                      inputStyle
                    }
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Department *
                  </label>

                  <DepartmentDropdown
                    value={
                      formData.department
                    }
                    onChange={(val) =>
                      setFormData({
                        ...formData,
                        department:
                          val,
                      })
                    }
                    disabled={
                      isSubmitting
                    }
                  />
                </div>
              </div>

              <div
                className="flex gap-2 pt-3"
                style={{
                  borderTop:
                    "1px solid var(--border-color)",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    isSubmitting
                  }
                  className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",
                    border:
                      "1px solid var(--border-color)",
                    color:
                      "var(--text-primary)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting
                  }
                  className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
                  style={{
                    backgroundColor:
                      "var(--accent)",
                    color:
                      "var(--accent-text)",
                  }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Update Employee"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          PERMISSIONS EDIT MODAL
      ========================================== */}
      {showPermissionsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]"
            style={cardStyle}
          >
            <div
              className="px-6 py-4 flex items-center justify-between border-b"
              style={{
                borderColor:
                  "var(--border-color)",
              }}
            >
              <div>
                <h3 className="text-base font-bold">
                  Configure Access
                </h3>

                <p
                  className="text-[11px] mt-0.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Editing permissions
                  for{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {name}
                  </span>
                </p>
              </div>

              <button
                onClick={() =>
                  setShowPermissionsModal(
                    false
                  )
                }
                className="p-2 rounded-lg hover:bg-white/10 transition"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {Object.entries(
                ALLOWED_PERMISSIONS
              ).map(
                ([key, config]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 group"
                    style={{
                      borderColor:
                        permissionsData[
                          key
                        ]
                          ? "color-mix(in srgb, var(--success) 28%, transparent)"
                          : "var(--border-color)",

                      backgroundColor:
                        permissionsData[
                          key
                        ]
                          ? "rgba(16,185,129,0.03)"
                          : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          backgroundColor:
                            permissionsData[
                              key
                            ]
                              ? "var(--success-soft)"
                              : "var(--bg-tertiary)",

                          color:
                            permissionsData[
                              key
                            ]
                              ? "var(--success-text)"
                              : "var(--text-muted)",
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </div>

                      <span
                        className="text-[13px] font-semibold"
                        style={{
                          color:
                            "var(--text-primary)",
                        }}
                      >
                        {config.label}
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          permissionsData[
                            key
                          ] ??
                          config.default
                        }
                        onChange={(e) =>
                          setPermissionsData(
                            {
                              ...permissionsData,

                              [key]:
                                e.target
                                  .checked,
                            }
                          )
                        }
                        className="sr-only peer"
                      />

                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                )
              )}
            </div>

            <div
              className="px-6 py-4 flex flex-col sm:flex-row gap-3 border-t"
              style={{
                borderColor:
                  "var(--border-color)",
              }}
            >
              <button
                onClick={() =>
                  setShowPermissionsModal(
                    false
                  )
                }
                className="min-h-[44px] flex-1 h-10 rounded-lg text-sm font-semibold transition hover:bg-white/5 border"
                style={{
                  borderColor:
                    "var(--border-color)",
                  color:
                    "var(--text-primary)",
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const finalPermissions =
                    {};

                  Object.keys(
                    ALLOWED_PERMISSIONS
                  ).forEach(
                    (k) => {
                      finalPermissions[
                        k
                      ] = Boolean(
                        permissionsData[
                          k
                        ]
                      );
                    }
                  );

                  updatePermissionsMutation.mutate(
                    finalPermissions
                  );
                }}
                disabled={
                  updatePermissionsMutation.isPending
                }
                className="min-h-[44px] flex-1 h-10 rounded-lg text-sm font-bold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center shadow-lg shadow-purple-900/20"
                style={{
                  backgroundColor:
                    "var(--purple-text)",
                  color: "#fff",
                }}
              >
                {updatePermissionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Permissions"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          GLOBAL STYLES
      ========================================== */}
      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
