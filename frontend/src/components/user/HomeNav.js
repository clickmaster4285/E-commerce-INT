"use client";

/* ==========================================================
   HOME NAV — User home page ka doosra header row
   Home | Deals | Best Selling | New Arrivals | 3 parent categories (real API data) | More
   ========================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { categoryApi } from "@/apis/user/categoryApi";
import { productApi } from "@/apis/user/productApi";
import CategoryIcon from "./CategoryIcon";
import {
  idOf,
  isTopLevelCategory,
  sortByPopularity,
} from "@/utils/homeCatalog";

/* Nav tabs — Best Offers / New Arrivals click par neeche Featured section
   me scroll + wahi tab select hota hai (FeaturedProducts sunta hai:
   "featured-tab-select" event + ?tab= URL param). */
export const FEATURED_TAB_EVENT = "featured-tab-select";

export function scrollToFeatured() {
  try {
    document
      .getElementById("featured-products")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {}
}

const NAV_LINKS = [
  { label: "Home", href: "/", tab: null, isActive: (path, activeTab) => path === "/" && !activeTab },
  { label: "Best Offers", href: "/?tab=offers", tab: "offers", isActive: (_path, activeTab) => activeTab === "offers" },
  { label: "New Arrivals", href: "/?tab=new", tab: "new", isActive: (_path, activeTab) => activeTab === "new" },
];

const PARENT_LIMIT = 3;
const MORE_DROPDOWN_LIMIT = 5;
const ALL_CATEGORY_LIMIT = 24;

const itemClass = (active) =>
  `shrink-0 inline-flex items-center h-11 lg:h-12 px-3 lg:px-3.5 text-[0.78125rem] font-semibold whitespace-nowrap border-b-2 transition-colors duration-200 ${
    active
      ? "text-[var(--user-text)] border-[var(--user-accent)]"
      : "text-[var(--user-text-muted)] border-transparent hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)]"
  }`;

/* ---------- Dropdown shell (fixed position = parent ke overflow me clip nahi hota) ---------- */
function DropdownPanel({ style, panelRef, title, meta, footer, children, onMouseEnter, onMouseLeave }) {
  const panelElementRef = useRef(null);
  const leaveTimerRef = useRef(null);
  
  const isMouseOverPanel = (e) => {
    const panel = panelElementRef.current;
    if (!panel) return false;
    // Use elementFromPoint for accurate check including scrollbar
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return panel.contains(el);
  };

  const handleMouseLeave = (e) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      if (!isMouseOverPanel(e)) {
        onMouseLeave(e);
      }
    }, 100);
  };

  const handleMouseEnter = (e) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    onMouseEnter(e);
  };

  return (
    <div
      ref={(el) => {
        panelElementRef.current = el;
        if (panelRef) panelRef.current = el;
      }}
      style={style}
      className="fixed z-[60] overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-elevated)] shadow-[var(--user-shadow-lg)]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)] px-3.5 py-2.5">
          <p className="text-[0.6875rem] font-black uppercase tracking-[0.16em] text-[var(--user-text)]">{title}</p>
          {meta ? <span className="text-[0.625rem] font-semibold text-[var(--user-text-subtle)]">{meta}</span> : null}
        </div>
      ) : null}
      <div className="max-h-[64vh] overflow-y-auto p-2">{children}</div>
      {footer}
    </div>
  );
}

function CategoryRow({ category, count = 0, onPick }) {
  return (
    <Link
      href={`/filtering-product?category=${category._id}`}
      onClick={onPick}
      className="flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--user-bg-hover)]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)] text-[var(--user-accent)]">
        <CategoryIcon name={category.name} size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.78125rem] font-medium capitalize text-[var(--user-text-secondary)]">
        {category.name}
      </span>
      {count > 0 ? (
        <span className="shrink-0 rounded-full bg-[var(--user-bg-hover)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--user-text-subtle)]">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export default function HomeNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams?.get("tab");
  const [panel, setPanel] = useState(null);
  const [panelStyle, setPanelStyle] = useState(null);
  const moreRef = useRef(null);
  const panelRef = useRef(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Counts server facets se (direct, nav parity) — full catalog nahi.
  // Key ["shopFacets","global"] home page ke saath shared (ek hi request).
  const { data: facets = null } = useQuery({
    queryKey: ["shopFacets", "global"],
    queryFn: () => productApi.getFacets({}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const counts = useMemo(() => {
    const map = {};
    (facets?.categoryDirect || []).forEach((c) => {
      map[String(c._id)] = c.count || 0;
    });
    return map;
  }, [facets]);
  const sortedCategories = useMemo(
    () => sortByPopularity(categories, counts),
    [categories, counts],
  );

  // Parent categories = jin ka koi parent nahi (real data se)
  const parentCategories = useMemo(() => {
    const parents = sortedCategories.filter(isTopLevelCategory);
    return parents.length ? parents : sortedCategories;
  }, [sortedCategories]);

  const visibleParents = parentCategories.slice(0, PARENT_LIMIT);
  const hiddenParents = parentCategories.slice(PARENT_LIMIT);

  const positionPanel = useCallback((key) => {
    const anchor = key === "more" ? moreRef.current : document.querySelector(`[data-panel-id="${key}"]`);
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(key === "more" ? 288 : 220, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
    setPanelStyle({ left, top: rect.bottom + 6, width });
  }, []);

  const togglePanel = (key) => {
    const next = panel === key ? null : key;
    if (next) positionPanel(next);
    setPanel(next);
  };

  const closePanel = () => setPanel(null);

  /* Best Offers / New Arrivals: ?tab= URL me set + Featured section tak
     smooth scroll + wahi tab select (event se, taake same-page click par
     bhi foran kaam kare). Home: tab clear + top par scroll. */
  const handleNavClick = useCallback(
    (event, link) => {
      if (link.tab) {
        event.preventDefault();
        try {
          const sp = new URLSearchParams(searchParams?.toString() || "");
          sp.set("tab", link.tab);
          router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent(FEATURED_TAB_EVENT, { detail: link.tab }),
          );
        } catch {}
        requestAnimationFrame(() => scrollToFeatured());
      } else {
        // Home — tab param hatao aur top par le jao
        if (activeTab) {
          event.preventDefault();
          try {
            const sp = new URLSearchParams(searchParams?.toString() || "");
            sp.delete("tab");
            const query = sp.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent(FEATURED_TAB_EVENT, { detail: "featured" }),
            );
          } catch {}
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {}
        }
      }
    },
    [pathname, router, searchParams, activeTab],
  );

  useEffect(() => {
    if (!panel) return undefined;
    const reposition = () => positionPanel(panel);
    const closeOnScroll = () => setPanel(null);
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      const anchor = panel === "more" ? moreRef.current : document.querySelector(`[data-panel-id="${panel}"]`);
      if (anchor?.contains(event.target)) return;
      setPanel(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", closeOnScroll, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", closeOnScroll, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel, positionPanel]);

  return (
    <nav aria-label="Primary" className="sticky top-14 z-40 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] lg:top-16">
      <div className="w-full max-w-none px-3 sm:px-4 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex h-11 items-center justify-center gap-0.5 overflow-x-auto scrollbar-hide lg:h-12 lg:gap-1.5">
          {/* PLAIN LINKS — Home | Best Offers | New Arrivals */}
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(event) => handleNavClick(event, link)}
              className={itemClass(link.isActive(pathname, activeTab))}
            >
              {link.label}
            </Link>
          ))}

          {/* 3 PARENT CATEGORIES — real API data */}
          {visibleParents.map((category) => (
            <Link
              key={category._id}
              href={`/filtering-product?category=${category._id}`}
              className={`${itemClass(pathname.startsWith(`/?category=${category._id}`))} max-w-[200px}`}
            >
              <span className="truncate capitalize">{category.name}</span>
            </Link>
          ))}

          {/* MORE — only dropdown */}
          <div className="relative shrink-0" ref={moreRef}>
            <div
              aria-expanded={panel === "more"}
              className={`${itemClass(panel === "more")} gap-1.5`}
              onMouseEnter={() => togglePanel("more")}
              onMouseLeave={() => {
                setTimeout(() => {
                  if (panel === "more" && !panelRef.current?.matches(":hover")) {
                    closePanel();
                  }
                }, 100);
              }}
            >
              More
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${panel === "more" ? "rotate-180" : ""}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MORE PANEL */}
      {panel === "more" && panelStyle ? (
        <DropdownPanel
          panelRef={panelRef}
          style={panelStyle}
          onMouseEnter={() => {}}
          onMouseLeave={() => {
            setTimeout(() => {
              if (panel === "more" && !moreRef.current?.matches(":hover")) {
                closePanel();
              }
            }, 100);
          }}
        >
          {hiddenParents.length > 0 ? (
            <>
              <p className="px-2.5 pb-1.5 pt-1 text-[0.625rem] font-black uppercase tracking-[0.16em] text-[var(--user-text-subtle)]">
                More Categories
              </p>
              {hiddenParents.slice(0, MORE_DROPDOWN_LIMIT).map((category) => (
                <CategoryRow
                  key={category._id}
                  category={category}
                  count={counts[idOf(category._id)] || 0}
                  onPick={closePanel}
                />
              ))}
              {hiddenParents.length > MORE_DROPDOWN_LIMIT && (
                <Link
                  href="/filtering-product?allCategories=1"
                  onClick={closePanel}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--user-bg-hover)] text-[var(--user-accent)] font-medium"
                >
                  <span className="text-[0.78125rem]">All Categories</span>
                  <ChevronDown size={14} />
                </Link>
              )}
            </>
          ) : null}
        </DropdownPanel>
      ) : null}
    </nav>
  );
}