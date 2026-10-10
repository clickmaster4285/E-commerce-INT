"use client";

import { LoaderCircle } from "lucide-react";

export default function PrimaryButton({
  children,
  icon: Icon,
  iconEnd: IconEnd,
  loading = false,
  loadingText,
  disabled = false,
  className = "",
  type = "button",
  ...buttonProps
}) {
  const isDisabled = disabled || loading;
  const widthClass = className.split(/\s+/).includes("w-auto") ? "" : "w-full";

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`primary-btn inline-flex ${widthClass} items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && IconEnd ? (
        <IconEnd aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : null}
    </button>
  );
}
