"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/categoryApi";

import {
  ArrowLeft,
  FolderOpen,
  Hash,
  FileText,
  Activity,
  CalendarDays,
} from "lucide-react";

export default function CategoryDetailPage({ params }) {
  const router = useRouter();
  const { id } = use(params);

  const {
    data: category,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["category", id],
    queryFn: () => categoryApi.getById(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent"
          style={{
            borderColor: "var(--accent)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );
  }

  if (isError || !category) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        <p style={{ color: "var(--danger)" }}>
          Category not found
        </p>

        <button
          onClick={() => router.push("/admin/categories")}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-text)",
          }}
        >
          Back to Categories
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg p-2 transition hover:scale-105"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-secondary)",
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div>
          <h1 className="text-2xl font-bold">
            Category Details
          </h1>

          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            View category information
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div
        className="rounded-xl"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Category Header */}
        <div
          className="flex items-center gap-4 border-b p-6"
          style={{
            borderColor: "var(--border-color)",
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            <FolderOpen className="h-7 w-7" />
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {category.name}
            </h2>

            <p
              className="mt-1 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              {category.category_code}
            </p>
          </div>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: category.is_active
                ? "rgba(16,185,129,.15)"
                : "rgba(239,68,68,.15)",

              color: category.is_active
                ? "var(--success)"
                : "var(--danger)",
            }}
          >
            {category.is_active ? "ACTIVE" : "INACTIVE"}
          </span>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <DetailItem
            icon={Hash}
            label="Category Code"
            value={category.category_code}
          />

          <DetailItem
            icon={Activity}
            label="Status"
            value={
              category.is_active
                ? "Active"
                : "Inactive"
            }
          />

          <DetailItem
            icon={CalendarDays}
            label="Created At"
            value={
              category.created_at
                ? new Date(
                    category.created_at
                  ).toLocaleString()
                : "—"
            }
          />

          <DetailItem
            icon={CalendarDays}
            label="Updated At"
            value={
              category.updated_at
                ? new Date(
                    category.updated_at
                  ).toLocaleString()
                : "—"
            }
          />
        </div>

        {/* Description */}
        <div
          className="border-t p-6"
          style={{
            borderColor: "var(--border-color)",
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <FileText
              className="h-4 w-4"
              style={{ color: "var(--accent)" }}
            />

            <p
              className="text-sm font-semibold"
              style={{
                color: "var(--text-secondary)",
              }}
            >
              Description
            </p>
          </div>

          <p
            className="text-sm leading-6"
            style={{
              color: "var(--text-muted)",
            }}
          >
            {category.description ||
              "No description available."}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: "var(--bg-tertiary)",
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon
          className="h-4 w-4"
          style={{ color: "var(--accent)" }}
        />

        <span
          className="text-xs font-medium uppercase"
          style={{
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
      </div>

      <p className="font-medium">
        {value || "—"}
      </p>
    </div>
  );
}