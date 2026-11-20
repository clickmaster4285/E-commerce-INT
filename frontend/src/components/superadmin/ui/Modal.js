"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/**
 * Generic dialog. Escape/overlay se band hota hai (jab tak `busy` na ho).
 * `as="form"` + onSubmit de kar form dialog banta hai; footer me submit button rakho.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  iconTone = "accent",
  size = "md",
  busy = false,
  as: Tag = "div",
  onSubmit,
  footer,
  children,
  bodyClassName,
  role = "dialog",
}) {
  const titleId = useId();
  const panelRef = useRef(null);

  // Escape + body scroll lock + initial focus
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose?.(); };
    document.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector("[autofocus], input:not([disabled]), textarea, select, button:not([data-close])");
      first?.focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const tone = {
    accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
    danger: "bg-[var(--danger-soft)] text-[var(--danger-text)]",
    warning: "bg-[var(--warning-soft)] text-[var(--warning-text)]",
    success: "bg-[var(--success-soft)] text-[var(--success-text)]",
  }[iconTone];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close dialog" tabIndex={-1} onClick={busy ? undefined : onClose} className="absolute inset-0 cursor-default bg-slate-950/55 backdrop-blur-[2px]" />
      <Tag
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        noValidate={Tag === "form" ? true : undefined}
        className={cx("sa-card sa-modal-panel relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-b-none rounded-t-2xl shadow-[var(--shadow-pop)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl", SIZES[size] || SIZES.md)}
      >
        <div className="flex items-start gap-3.5 px-5 pt-5 pb-4 sm:px-6">
          {Icon ? (
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone)}>
              <Icon size={20} aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-[16px] font-semibold leading-6 text-[var(--text-primary)]">{title}</h2>
            {description ? <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{description}</p> : null}
          </div>
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} disabled={busy} data-close className="-me-1.5 -mt-1" />
        </div>
        {children ? <div className={cx("min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6", bodyClassName)}>{children}</div> : null}
        {footer ? <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-color)] bg-[var(--bg-card-alt)] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end sm:px-6">{footer}</div> : null}
      </Tag>
    </div>
  );
}
