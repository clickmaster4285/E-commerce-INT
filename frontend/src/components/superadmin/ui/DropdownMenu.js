"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "./Button";
import { cx } from "./cx";

const ITEM_H = 34;

/**
 * Row actions menu. position: fixed — taake table ke overflow container me clip na ho.
 * items: [{ label, icon, onClick?, href?, external?, tone?: "danger", disabled?, hint?, separator? }]
 */
export default function DropdownMenu({ items, label = "More actions", icon = MoreHorizontal, variant = "ghost", size = "sm" }) {
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const open = Boolean(pos);

  const close = useCallback((focusTrigger = false) => {
    setPos(null);
    if (focusTrigger) triggerRef.current?.querySelector?.("button")?.focus();
  }, []);

  const toggle = () => {
    if (open) return close();
    const rect = triggerRef.current.getBoundingClientRect();
    const height = items.reduce((h, it) => h + (it.separator ? 11 : ITEM_H), 12);
    const fitsBelow = window.innerHeight - rect.bottom > height + 12;
    setPos({
      top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
      right: Math.max(8, window.innerWidth - rect.right),
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === "Escape") return close(true);
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
      const idx = nodes.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (idx + 1) % nodes.length : (idx - 1 + nodes.length) % nodes.length;
      nodes[next]?.focus();
    };
    const dismiss = () => close();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open, close]);

  return (
    <span ref={triggerRef} className="inline-flex" onClick={(e) => e.stopPropagation()}>
      <IconButton icon={icon} label={label} variant={variant} size={size} aria-haspopup="menu" aria-expanded={open} onClick={toggle} />
      {open ? (
        <div ref={menuRef} role="menu" aria-label={label} className="sa-menu" style={{ top: pos.top, right: pos.right }}>
          {items.map((item, i) => {
            if (item.separator) return <div key={`sep-${i}`} className="sa-menu__sep" role="separator" />;
            const Icon = item.icon;
            const cls = cx("sa-menu__item", item.tone === "danger" && "sa-menu__item--danger");
            const inner = (
              <>
                {Icon ? <Icon size={15} aria-hidden="true" /> : null}
                <span className="truncate">{item.label}</span>
              </>
            );
            if (item.href && !item.disabled) {
              return item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" role="menuitem" className={cls} onClick={() => close()}>
                  {inner}
                </a>
              ) : (
                <Link key={item.label} href={item.href} role="menuitem" className={cls} onClick={() => close()}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.disabled ? item.hint : undefined}
                className={cls}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}
