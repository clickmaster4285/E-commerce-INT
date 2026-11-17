"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  confirmTone = "danger",
  onCancel,
  onConfirm,
  loading = false,
}) {
  if (!open) return null;

  const toneClass =
    confirmTone === "success"
      ? "bg-emerald-600 hover:bg-emerald-700 focus-visible:outline-emerald-600"
      : "bg-red-600 hover:bg-red-700 focus-visible:outline-red-600";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-extrabold text-[var(--text-primary)]">
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary h-11">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-5 text-sm font-semibold text-white transition ${toneClass} disabled:opacity-60`}
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
