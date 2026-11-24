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
import { useLocalized } from "@/i18n/localize";
import { useTranslation } from "@/i18n/LanguageProvider";
import CategoryIcon from "./CategoryIcon";
import { useStoreTheme } from "@/storefront/ThemeProvider";
import { resolveThemeLink, isExternalHref } from "@/storefront/themeLinks";
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
  { labelKey: "mobileNav.home", href: "/", tab: null, isActive: (path, activeTab) => path === "/" && !activeTab },
  { labelKey: "storefront.navigation.bestOffers", href: "/?tab=offers", tab: "offers", isActive: (_path, activeTab) => activeTab === "offers" },
  { labelKey: "storefront.navigation.newProducts", href: "/?tab=new", tab: "new", isActive: (_path, activeTab) => activeTab === "new" },
];

const PARENT_LIMIT = 3; // default (store editor Navigation → "Top categories shown")
const MEGA_MAX_WIDTH = 1100;

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
const assetSrc = (url) => (!url ? "" : /^https?:/i.test(url) ? url : `${API_ORIGIN}${url}`);
const MORE_DROPDOWN_LIMIT = 5;
const ALL_CATEGORY_LIMIT = 24;

const itemClass = (active) =>
  `shrink-0 inline-flex items-center h-10 lg:h-11 px-3 py-2 text-sm font-normal whitespace-nowrap border-b-2 transition-colors duration-200 ${
    active
      ? "text-user-fg border-user-accent"
      : "text-user-fg-muted border-transparent hover:text-user-fg hover:bg-user-hover"
  }`;

/* ---------- Dropdown shell (fixed position = parent ke overflow me clip nahi hota) ---------- */
function DropdownPanel({ style, panelRef, title, meta, footer, children, onMouseEnter, onMouseLeave }) {
  const panelElementRef = useRef(null);
  const leaveTimerRef = useRef(null);

  const handleMouseLeave = (e) => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      if (!panelElementRef.current?.matches(":hover")) {
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
      className="storefront-popover fixed z-[60] overflow-hidden rounded-2xl border border-user-line bg-user-elevated shadow-[var(--user-shadow-lg)]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-user-line bg-user-card px-3.5 py-2.5">
          <p className="text-[0.6875rem] font-black uppercase tracking-[0.16em] text-user-fg">{title}</p>
          {meta ? <span className="text-[0.625rem] font-semibold text-user-fg-subtle">{meta}</span> : null}
        </div>
      ) : null}
      <div className="max-h-[64vh] overflow-y-auto p-2">{children}</div>
      {footer}
    </div>
  );
}

function CategoryRow({ category, count = 0, onPick, fieldOf }) {
  const categoryName = fieldOf(category, "name");
  return (
    <Link
      href={`/filtering-product?category=${category._id}`}
      onClick={onPick}
      className="flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-user-hover"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-user-line bg-user-hover text-user-accent">
        <CategoryIcon name={categoryName} size={15} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.78125rem] font-medium capitalize text-user-fg-secondary">
        {categoryName}
      </span>
      {count > 0 ? (
        <span className="shrink-0 rounded-full bg-user-hover px-1.5 py-0.5 text-[0.625rem] font-bold text-user-fg-subtle">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/* Internal → next/link, external → naya tab */
function MenuLink({ href, onClick, className, children }) {
  return isExternalHref(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

/* Mega menu: sub-links image tiles (image na ho to sirf naam) */
function MegaMenuGrid({ links, onPick }) {
  const withImages = links.some((l) => l.image);
  if (!withImages) {
    return (
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
        {links.map((link) => (
          <MenuLink
            key={link.id}
            href={link.href}
            onClick={onPick}
            className="block truncate rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium text-user-fg-secondary transition-colors hover:bg-user-hover hover:text-user-fg"
          >
            {link.label}
          </MenuLink>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {links.map((link) => (
        <MenuLink key={link.id} href={link.href} onClick={onPick} className="group block rounded-xl p-1.5 transition-colors hover:bg-user-hover">
          <span className="block aspect-[4/3] overflow-hidden rounded-lg border border-user-line bg-user-hover">
            {link.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={assetSrc(link.image)}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : null}
          </span>
          <span className="mt-1.5 block truncate px-0.5 text-[0.8125rem] font-semibold text-user-fg">{link.label}</span>
        </MenuLink>
      ))}
    </div>
  );
}

export default function HomeNav() {
  const { t } = useTranslation();
  const { fieldOf } = useLocalized();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useStoreTheme();
  // Store editor Theme → Navigation (default = purana nav)
  const navCfg = theme?.settings?.navigation || {};
  const showNav = navCfg.show !== false;
  const parentLimit = Number.isInteger(navCfg.categoryCount) ? Math.min(6, Math.max(0, navCfg.categoryCount)) : PARENT_LIMIT;
  const showMoreCategories = navCfg.showMoreCategories !== false;
  const isMega = navCfg.dropdownStyle === "mega";
  const alignStart = navCfg.align === "start";
  // Store editor main menu (top level) — invalid / deleted target wale links skip
  const themeMenu = useMemo(
    () =>
      (theme?.menus?.main || [])
        .map((item) => ({
          id: item.id,
          label: item.label,
          href: resolveThemeLink(item.link),
          children: (item.children || [])
            .map((c) => ({ id: c.id, label: c.label, href: resolveThemeLink(c.link), image: c.image || "" }))
            .filter((c) => c.label && c.href),
        }))
        // Parent ka link na ho tab bhi sub-links ho to dropdown dikhao
        .filter((item) => item.label && (item.href || item.children.length)),
    [theme],
  );
  const activeTab = searchParams?.get("tab");
  const [panel, setPanel] = useState(null);
  const [panelStyle, setPanelStyle] = useState(null);
  const navScrollRef = useRef(null);
  const moreRef = useRef(null);
  const panelRef = useRef(null);
  const moreCloseTimerRef = useRef(null);
  const morePinnedRef = useRef(false);

  useEffect(() => {
    if (navScrollRef.current) navScrollRef.current.scrollLeft = 0;
  }, [pathname, activeTab]);

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

  const visibleParents = parentCategories.slice(0, parentLimit);
  const hiddenParents = parentCategories.slice(parentLimit);
  const hasMoreCategories = showMoreCategories && hiddenParents.length > 0;

  const positionPanel = useCallback((key) => {
    const anchor = key === "more" ? moreRef.current : document.querySelector(`[data-panel-id="${key}"]`);
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    // Mega menu: nav ke neeche beech me chauda panel
    if (isMega && key.startsWith("menu-")) {
      const width = Math.min(MEGA_MAX_WIDTH, window.innerWidth - 24);
      setPanelStyle({ left: Math.max(12, (window.innerWidth - width) / 2), top: rect.bottom, width });
      return;
    }
    const width = Math.min(key === "more" ? 288 : 220, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
    setPanelStyle({ left, top: rect.bottom, width });
  }, [isMega]);

  const closePanel = useCallback(() => {
    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    morePinnedRef.current = false;
    setPanel(null);
  }, []);

  const openMorePanel = () => {
    if (!hasMoreCategories) return;
    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    positionPanel("more");
    setPanel("more");
  };

  const scheduleMoreClose = () => {
    if (morePinnedRef.current) return;
    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    moreCloseTimerRef.current = setTimeout(() => {
      if (
        !moreRef.current?.matches(":hover") &&
        !panelRef.current?.matches(":hover")
      ) {
        closePanel();
      }
    }, 150);
  };

  const toggleMorePanel = () => {
    if (panel === "more" && morePinnedRef.current) {
      closePanel();
      return;
    }
    morePinnedRef.current = true;
    openMorePanel();
  };

  /* Store editor menu dropdowns — key "menu-<id>" (positionPanel data-panel-id se anchor dhoondta hai) */
  const openMenuPanel = (key) => {
    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    morePinnedRef.current = false;
    positionPanel(key);
    setPanel(key);
  };
  const scheduleMenuClose = (key) => {
    if (morePinnedRef.current) return;
    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    moreCloseTimerRef.current = setTimeout(() => {
      const anchor = document.querySelector(`[data-panel-id="${key}"]`);
      if (!anchor?.matches(":hover") && !panelRef.current?.matches(":hover")) closePanel();
    }, 150);
  };
  const toggleMenuPanel = (key) => {
    if (panel === key && morePinnedRef.current) {
      closePanel();
      return;
    }
    openMenuPanel(key);
    morePinnedRef.current = true; // touch / click → hover band hone par bhi khula rahe
  };

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
    const closeOnScroll = closePanel;
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      const anchor = panel === "more" ? moreRef.current : document.querySelector(`[data-panel-id="${panel}"]`);
      if (anchor?.contains(event.target)) return;
      closePanel();
    };
    const onKey = (event) => {
      if (event.key === "Escape") closePanel();
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
  }, [panel, positionPanel, closePanel]);

  if (!showNav) return null;

  return (
    <nav
      aria-label={t("admin.sidebar.navigation")}
      className="user-home-nav sticky top-14 z-40 border-b border-user-line bg-user-elevated lg:top-16"
    >
      <div className="w-full min-w-0 max-w-full px-3 sm:px-4 lg:px-8 xl:px-10 2xl:px-12">
        <div
          ref={navScrollRef}
          className={`flex h-10 w-full min-w-0 items-center justify-start gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap scroll-smooth px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${alignStart ? "md:justify-start" : "md:justify-center"} md:gap-0.5 lg:h-11 lg:gap-1`}
        >
          {/* STORE EDITOR MAIN MENU — seller ne banaya ho to purane plain links ki jagah */}
          {themeMenu.map((item) =>
            item.children.length ? (
              <button
                key={item.id}
                type="button"
                data-panel-id={`menu-${item.id}`}
                aria-haspopup="menu"
                aria-expanded={panel === `menu-${item.id}`}
                onClick={() => toggleMenuPanel(`menu-${item.id}`)}
                onMouseEnter={() => {
                  if (!morePinnedRef.current) openMenuPanel(`menu-${item.id}`);
                }}
                onMouseLeave={() => scheduleMenuClose(`menu-${item.id}`)}
                className={`${itemClass(panel === `menu-${item.id}`)} gap-1.5`}
              >
                {item.label}
                <ChevronDown size={14} className={`transition-transform duration-200 ${panel === `menu-${item.id}` ? "rotate-180" : ""}`} />
              </button>
            ) : isExternalHref(item.href) ? (
              <a key={item.id} href={item.href} target="_blank" rel="noopener noreferrer" className={itemClass(false)}>
                {item.label}
              </a>
            ) : (
              <Link key={item.id} href={item.href} className={itemClass(pathname === item.href)}>
                {item.label}
              </Link>
            ),
          )}

          {/* PLAIN LINKS — Home | Best Offers | New Arrivals (default, menu khali ho to) */}
          {!themeMenu.length && NAV_LINKS.map((link) => (
            <Link
              key={link.labelKey}
              href={link.href}
              onClick={(event) => handleNavClick(event, link)}
              className={itemClass(link.isActive(pathname, activeTab))}
            >
              {t(link.labelKey)}
            </Link>
          ))}

          {/* 3 PARENT CATEGORIES — real API data */}
          {visibleParents.map((category) => (
            <Link
              key={category._id}
              href={`/filtering-product?category=${category._id}`}
              className={`${itemClass(pathname.startsWith(`/?category=${category._id}`))} max-w-[200px}`}
            >
              <span className="truncate capitalize">{fieldOf(category, "name")}</span>
            </Link>
          ))}

          {/* MORE — only dropdown (jab extra categories ho'n tabhi dikhaye) */}
          {hasMoreCategories ? (
            <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={panel === "more"}
                onClick={toggleMorePanel}
                onMouseEnter={() => {
                  if (!morePinnedRef.current) openMorePanel();
                }}
                onMouseLeave={scheduleMoreClose}
                className={`${itemClass(panel === "more")} gap-1.5`}
              >
                {t("storefront.navigation.moreCategories")}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${panel === "more" ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* STORE EDITOR MENU DROPDOWN */}
      {panel?.startsWith("menu-") && panelStyle
        ? (() => {
            const item = themeMenu.find((m) => `menu-${m.id}` === panel);
            if (!item) return null;
            const links = item.href ? [{ id: `${item.id}-self`, label: item.label, href: item.href }, ...item.children] : item.children;
            if (isMega) {
              return (
                <DropdownPanel
                  panelRef={panelRef}
                  style={panelStyle}
                  title={item.label}
                  onMouseEnter={() => {
                    if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
                  }}
                  onMouseLeave={() => scheduleMenuClose(panel)}
                  footer={
                    item.href ? (
                      <div className="border-t border-user-line px-3.5 py-2.5">
                        <MenuLink href={item.href} onClick={closePanel} className="text-[0.78125rem] font-semibold text-user-accent hover:underline">
                          {t("storefront.navigation.viewAll")} →
                        </MenuLink>
                      </div>
                    ) : null
                  }
                >
                  <MegaMenuGrid links={item.children} onPick={closePanel} />
                </DropdownPanel>
              );
            }
            return (
              <DropdownPanel
                panelRef={panelRef}
                style={panelStyle}
                onMouseEnter={() => {
                  if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
                }}
                onMouseLeave={() => scheduleMenuClose(panel)}
              >
                {links.map((link) =>
                  isExternalHref(link.href) ? (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={closePanel}
                      className="block rounded-xl px-2.5 py-2 text-[0.8125rem] font-medium text-user-fg-secondary transition-colors hover:bg-user-hover hover:text-user-fg"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      key={link.id}
                      href={link.href}
                      onClick={closePanel}
                      className="block rounded-xl px-2.5 py-2 text-[0.8125rem] font-medium text-user-fg-secondary transition-colors hover:bg-user-hover hover:text-user-fg"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </DropdownPanel>
            );
          })()
        : null}

      {/* MORE PANEL */}
      {panel === "more" && panelStyle ? (
        <DropdownPanel
          panelRef={panelRef}
          style={panelStyle}
          onMouseEnter={() => {
            if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
          }}
          onMouseLeave={scheduleMoreClose}
        >
          {hiddenParents.length > 0 ? (
            <>
              <p className="px-2.5 pb-1.5 pt-1 text-[0.625rem] font-black uppercase tracking-[0.16em] text-user-fg-subtle">
                {t("storefront.navigation.moreCategories")}
              </p>
              {hiddenParents.slice(0, MORE_DROPDOWN_LIMIT).map((category) => (
                <CategoryRow
                  key={category._id}
                  category={category}
                  count={counts[idOf(category._id)] || 0}
                  onPick={closePanel}
                  fieldOf={fieldOf}
                />
              ))}
              {hiddenParents.length > MORE_DROPDOWN_LIMIT && (
                <Link
                  href="/filtering-product?allCategories=1"
                  onClick={closePanel}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-user-hover text-user-accent font-medium"
                >
                  <span className="text-[0.78125rem]">{t("admin.products.filter.allCategories")}</span>
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
