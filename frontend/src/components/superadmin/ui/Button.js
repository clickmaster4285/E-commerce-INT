"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";

const ICON_SIZE = { sm: 14, md: 16, lg: 17 };

/**
 * Super Admin button — ek hi jagah se saare variants.
 * variant: primary | secondary | ghost | danger | danger-outline | success | link
 * size: sm | md | lg
 * href diya ho to Link (ya external <a>) render hota hai.
 */
export default function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  href,
  external = false,
  fullWidth = false,
  type = "button",
  disabled,
  className,
  children,
  ...rest
}) {
  const iconSize = ICON_SIZE[size] || 16;
  const cls = cx("sa-btn", `sa-btn--${variant}`, variant !== "link" && `sa-btn--${size}`, fullWidth && "w-full", className);
  const content = (
    <>
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={iconSize} aria-hidden="true" />
      ) : null}
      {children}
      {IconRight ? <IconRight size={iconSize} aria-hidden="true" /> : null}
    </>
  );

  if (href && !disabled) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
          {content}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
}

/** Sirf icon wala button — label hamesha aria-label + tooltip banta hai. */
export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  tone,
  size = "md",
  href,
  external = false,
  className,
  iconSize,
  ...rest
}) {
  const cls = cx("sa-iconbtn", `sa-iconbtn--${variant}`, `sa-iconbtn--${size}`, tone === "danger" && "sa-iconbtn--danger", className);
  const glyph = <Icon size={iconSize || (size === "sm" ? 15 : 17)} aria-hidden="true" />;

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls} {...rest}>
          {glyph}
        </a>
      );
    }
    return (
      <Link href={href} aria-label={label} title={label} className={cls} {...rest}>
        {glyph}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} title={label} className={cls} {...rest}>
      {glyph}
    </button>
  );
}
