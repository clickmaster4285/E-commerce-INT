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

  const isSuccess = confirmTone === "success";

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
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-lg)]">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute end-4 top-4 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          aria-label="Close"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="flex items-start gap-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--warning-soft)", color: "var(--warning-text)" }}
          >
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-[var(--text-primary)]">
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
            className="btn-primary h-11 px-5 disabled:opacity-60"
            style={
              isSuccess
                ? { background: "var(--success)" }
                : { background: "var(--danger)" }
            }
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
