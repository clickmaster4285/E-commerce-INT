"use client";

/* ==========================================================
   HOME SIDEBAR — Home page ka left filter panel
   Sections (saare REAL API data par):
     Category     → parent categories + children ka total count
     Price Range  → real min/max + dual slider + input boxes
     Brands       → real brand list (search + counts)
     Deals        → active deals (click → right side me us deal ke products)
     Availability → real variant stock (In / Low / Out of stock)
     Discount     → real active discounts/deals ka percentage
   Facet counts baaki active filters ke hisaab se update hote hain.
   ========================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePercent,
  Check,
  ChevronDown,
  Flame,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Store,
  Tags,
  Wallet,
} from "lucide-react";
import CategoryIcon from "./CategoryIcon";
import {
  formatPrice,
  getDealBadgeText,
  idOf,
  isTopLevelCategory,
  sortByPopularity,
} from "@/utils/homeCatalog";

const CATEGORY_PREVIEW = 7;
const BRAND_PREVIEW = 6;
const DEAL_PREVIEW = 6;

/* ---------- Collapsible filter section ---------- */
function Section({ title, icon: Icon, hint, children }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-[var(--user-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[var(--user-bg-hover)]"
      >
        {Icon ? <Icon size={13} className="shrink-0 text-[var(--user-accent)]" /> : null}
        <span className="flex-1 text-xs font-semibold text-[var(--user-text)]">
          {title}
        </span>
        {hint ? (
          <span className="shrink-0 rounded-full bg-[var(--user-bg-hover)] px-1.5 py-0.5 text-[0.625rem] font-medium text-[var(--user-text-subtle)]">
            {hint}
          </span>
        ) : null}
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--user-text-muted)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="px-2.5 pb-3">{children}</div> : null}
    </div>
  );
}

function LoadingRows({ count = 5 }) {
  return (
    <div className="space-y-1.5">
      {[...Array(count).keys()].map((index) => (
        <div key={index} className="h-7 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
      ))}
    </div>
  );
}

/* ---------- Checkbox row (category / brand / availability / discount / deals) ---------- */
function CheckRow({ checked, label, title, count = null, icon = null, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={typeof title === "string" ? title : typeof label === "string" ? label : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-45"
          : checked
            ? "bg-[var(--user-accent-soft)]"
            : "hover:bg-[var(--user-bg-hover)]"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-[var(--user-accent)] bg-[var(--user-accent)] text-[var(--user-accent-text)]"
            : "border-[var(--user-border-hover)]"
        }`}
      >
        {checked ? <Check size={11} /> : null}
      </span>
      {icon}
      <span
        className={`min-w-0 flex-1 line-clamp-2 break-words text-xs font-normal capitalize ${
          checked ? "text-[var(--user-text)]" : "text-[var(--user-text-muted)]"
        }`}
      >
        {label}
      </span>
      {count !== null ? (
        <span className="shrink-0 text-[0.625rem] font-normal tabular-nums text-[var(--user-text-subtle)]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ShowMore({ open, total, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1 w-full rounded-md py-1.5 text-[0.6875rem] font-medium text-[var(--user-accent)] transition-colors hover:bg-[var(--user-bg-hover)]"
    >
      {open ? "Show less" : `Show all (${total})`}
    </button>
  );
}

/* ---------- Dual-thumb price slider (koi extra CSS file nahi) ---------- */
const THUMB_CLASS =
  "pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--user-bg-card)] [&::-webkit-slider-thumb]:bg-[var(--user-accent)] " +
  "[&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 " +
  "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[var(--user-accent)]";

function PriceRangeSlider({ min, max, value, step = 1, onChange, onRelease }) {
  const span = max - min;
  if (span <= 0) return null;

  const percent = (price) => ((price - min) / span) * 100;
  const lowPercent = Math.min(100, Math.max(0, percent(value[0])));
  const highPercent = Math.min(100, Math.max(0, percent(value[1])));

  return (
    <div
      className="relative h-6 select-none"
      onMouseUp={onRelease}
      onTouchEnd={onRelease}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--user-border)]" />
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--user-accent)]"
        style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={(event) => onChange([Math.min(Number(event.target.value), value[1]), value[1]])}
        onKeyUp={onRelease}
        onBlur={onRelease}
        aria-label="Minimum price"
        className={THUMB_CLASS}
        style={{ zIndex: lowPercent > 70 ? 30 : 10 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[1]}
        onChange={(event) => onChange([value[0], Math.max(Number(event.target.value), value[0])])}
        onKeyUp={onRelease}
        onBlur={onRelease}
        aria-label="Maximum price"
        className={THUMB_CLASS}
        style={{ zIndex: 20 }}
      />
    </div>
  );
}

/* ---------- Price filter (Amazon style) ----------
   - Min / Max inputs + Go button: type karo, Go/Enter dabao → EK baar filter.
   - Slider: drag karte waqt sirf LOCAL move hota hai (koi refetch nahi),
     chhodne (release) par ek baar apply.
   - Inputs kabhi remount nahi hote (stable keys + focused-hote-hue external
     sync nahi) → click/type par focus nahi toot-ta. */
function PriceFilter({ bounds, filterMin, filterMax, onApply }) {
  const externalMin = filterMin ?? bounds.min;
  const externalMax = filterMax ?? bounds.max;

  const [minDraft, setMinDraft] = useState(String(externalMin ?? ""));
  const [maxDraft, setMaxDraft] = useState(String(externalMax ?? ""));
  const [sliderDraft, setSliderDraft] = useState(null);
  const sliderDraftRef = useRef(null);
  const focusedRef = useRef({ min: false, max: false });

  // External value (slider commit / Clear All / URL) sirf tab sync ho jab
  // us field me typing/focus na ho — is liye focus kabhi nahi toot-ta.
  useEffect(() => {
    if (!focusedRef.current.min) setMinDraft(String(externalMin ?? ""));
  }, [externalMin]);
  useEffect(() => {
    if (!focusedRef.current.max) setMaxDraft(String(externalMax ?? ""));
  }, [externalMax]);

  const span = (bounds.max ?? 0) - (bounds.min ?? 0);
  // Bari range par chhota step slider ko bekaar-sensitive banata hai
  const sliderStep = span > 50000 ? 500 : span > 10000 ? 100 : span > 1000 ? 10 : 1;

  const shownLow = sliderDraft ? sliderDraft[0] : externalMin;
  const shownHigh = sliderDraft ? sliderDraft[1] : externalMax;

  const applyRange = (lowRaw, highRaw) => {
    const lo = Number(bounds.min) || 0;
    const hi = Number(bounds.max) || 0;
    let low = Number(lowRaw);
    let high = Number(highRaw);
    if (!Number.isFinite(low)) low = lo;
    if (!Number.isFinite(high)) high = hi;
    low = Math.round(low);
    high = Math.round(high);
    if (low > high) [low, high] = [high, low];
    low = Math.min(Math.max(low, lo), hi);
    high = Math.min(Math.max(high, lo), hi);
    sliderDraftRef.current = null;
    setSliderDraft(null);
    onApply({
      minPrice: low <= lo ? null : low,
      maxPrice: high >= hi ? null : high,
    });
  };

  const setDraft = (value) => {
    sliderDraftRef.current = value;
    setSliderDraft(value);
  };

  const commitSlider = () => {
    const pending = sliderDraftRef.current;
    if (!pending) return;
    applyRange(pending[0], pending[1]);
  };

  if (span <= 0) {
    return (
      <p className="px-2 py-3 text-[0.6875rem] text-[var(--user-text-subtle)]">
        No price data yet.
      </p>
    );
  }

  const inputClass =
    "min-w-0 flex-1 bg-transparent text-[0.75rem] font-semibold tabular-nums text-[var(--user-text)] outline-none";

  return (
    <div>
      <p className="mb-2.5 flex items-center justify-between gap-2 text-[0.75rem] font-bold text-[var(--user-text)]">
        <span className="tabular-nums">
          {formatPrice(shownLow)} — {formatPrice(shownHigh)}
        </span>
      </p>

      <PriceRangeSlider
        min={bounds.min}
        max={bounds.max}
        step={sliderStep}
        value={[shownLow, shownHigh]}
        onChange={setDraft}
        onRelease={commitSlider}
      />

      <div className="mt-3 flex items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-2.5 focus-within:border-[var(--user-accent)]">
          <span className="shrink-0 text-[0.625rem] font-bold uppercase text-[var(--user-text-subtle)]">Min</span>
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            value={minDraft}
            onChange={(event) => setMinDraft(event.target.value)}
            onFocus={() => {
              focusedRef.current.min = true;
            }}
            onBlur={() => {
              focusedRef.current.min = false;
              applyRange(minDraft, maxDraft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Minimum price"
            className={inputClass}
          />
        </label>
        <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-2.5 focus-within:border-[var(--user-accent)]">
          <span className="shrink-0 text-[0.625rem] font-bold uppercase text-[var(--user-text-subtle)]">Max</span>
          <input
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            value={maxDraft}
            onChange={(event) => setMaxDraft(event.target.value)}
            onFocus={() => {
              focusedRef.current.max = true;
            }}
            onBlur={() => {
              focusedRef.current.max = false;
              applyRange(minDraft, maxDraft);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Maximum price"
            className={inputClass}
          />
        </label>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => applyRange(minDraft, maxDraft)}
          className="h-9 shrink-0 rounded-lg bg-[var(--user-accent)] px-3.5 text-[0.6875rem] font-black uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
        >
          Go
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between text-[0.625rem] font-semibold text-[var(--user-text-subtle)]">
        <span>{formatPrice(bounds.min)}</span>
        <span>{formatPrice(bounds.max)}</span>
      </div>
      <p className="mt-1.5 text-[0.625rem] font-medium leading-relaxed text-[var(--user-text-subtle)]">
        Discount ke baad wali (final) qeemat par lagta hai.
      </p>
    </div>
  );
}

export default function HomeSidebar({
  categories = [],
  brands = [],
  deals = [],
  dealFacet = [],
  dealsLoading = false,
  filters,
  onChange,
  onClear,
  matchCount = 0,
  filtersActive = false,
  stockFacet = [],
  discountFacet = [],
  // ✅ Server facet counts + bounds (products full load ki jagah)
  facets = null,
  isLoading = false,
  facetsLoading = false,
  scrollable = false,
  className = "",
  collapsed = false,
  showAllDealsView = false,
  onToggleAllDealsView,
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllDeals, setShowAllDeals] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);

  // ✅ Counts server se (facets endpoint) — full catalog browser me nahi ata
  const categoryCounts = useMemo(() => {
    const map = {};
    (facets?.categories || []).forEach((c) => {
      map[idOf(c._id)] = c.count || 0;
    });
    return map;
  }, [facets]);
  const brandCounts = useMemo(() => {
    const map = {};
    (facets?.brands || []).forEach((b) => {
      map[idOf(b._id)] = b.count || 0;
    });
    return map;
  }, [facets]);

  /* Selected ids (strings me normalize) — select hote hi wo item apne
     section me TOP par ajata hai (neeche sort me selected-first). Plain
     consts hain taake selection change par sorting foran update ho. */
  const strSet = (values) => new Set((values || []).map((value) => String(idOf(value) || value)).filter(Boolean));
  const selectedCategorySet = strSet(filters?.categoryIds);
  const selectedBrandSet = strSet(filters?.brandIds);
  const selectedDealSet = strSet(filters?.dealIds);
  const selectedBandSet = strSet([
    ...(filters?.discountBands || []),
    ...(filters?.discountBand ?? null) !== null ? [filters.discountBand] : [],
  ]);

  /* 1 = b selected, -1 = a selected, 0 = dono same (agla sort rule lagta hai) */
  const selectedFirst = (set, aKey, bKey) =>
    (set.has(String(bKey)) ? 1 : 0) - (set.has(String(aKey)) ? 1 : 0);

  const categoryList = useMemo(() => {
    const parents = categories.filter(isTopLevelCategory);
    return (parents.length ? parents : categories)
      .map((category) => ({ ...category, count: categoryCounts[idOf(category._id)] || 0 }))
      .filter((category) => category.count > 0)
      .sort(
        (a, b) =>
          selectedFirst(selectedCategorySet, idOf(a._id), idOf(b._id)) ||
          b.count - a.count ||
          String(a.name).localeCompare(String(b.name)),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, categoryCounts, filters]);

  const brandList = useMemo(
    () =>
      sortByPopularity(brands, brandCounts)
        .map((brand) => ({ ...brand, count: brandCounts[idOf(brand._id)] || 0 }))
        .filter((brand) => brand.count > 0)
        .sort(
          (a, b) =>
            selectedFirst(selectedBrandSet, idOf(a._id), idOf(b._id)) ||
            b.count - a.count ||
            String(a?.name || "").localeCompare(String(b?.name || "")),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brands, brandCounts, filters],
  );

  const bounds = useMemo(
    () => ({
      min: Number(facets?.bounds?.min) || 0,
      max: Number(facets?.bounds?.max) || 0,
    }),
    [facets],
  );

  const filterMin = filters?.minPrice ?? null;
  const filterMax = filters?.maxPrice ?? null;

  const selectedBrandIds = filters?.brandIds || [];
  // discountBand (singular — sidebar likhta hai) + discountBands (plural) dono support
  const selectedBand = filters?.discountBand ?? null;
  const selectedDealIds = (filters?.dealIds || []).map(idOf).filter(Boolean);
  const activeCategoryIds = filters?.categoryIds || [];

  // Active deals — selected deal sab se upar, phir facet counts ke hisaab se
  const dealList = useMemo(() => {
    const source = dealFacet.length ? dealFacet : deals;
    return [...(source || [])].sort(
      (a, b) =>
        selectedFirst(selectedDealSet, idOf(a?._id), idOf(b?._id)) ||
        (b.count || 0) - (a.count || 0) ||
        String(a?.name || "").localeCompare(String(b?.name || "")),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealFacet, deals, filters]);
  const visibleDeals = showAllDeals ? dealList : dealList.slice(0, DEAL_PREVIEW);
  const visibleCategories = showAllCategories ? categoryList : categoryList.slice(0, CATEGORY_PREVIEW);

  const searchedBrands = useMemo(() => {
    const query = brandQuery.trim().toLowerCase();
    if (!query) return brandList;
    return brandList.filter((brand) => String(brand.name || "").toLowerCase().includes(query));
  }, [brandList, brandQuery]);

  const visibleBrands = showAllBrands ? searchedBrands : searchedBrands.slice(0, BRAND_PREVIEW);

  const toggleCategory = (id) => {
    const value = idOf(id);
    onChange({
      categoryIds: activeCategoryIds.includes(value)
        ? activeCategoryIds.filter((item) => item !== value)
        : [...activeCategoryIds, value],
    });
  };

  const toggleBrand = (id) => {
    const value = idOf(id);
    onChange({
      brandIds: selectedBrandIds.includes(value)
        ? selectedBrandIds.filter((item) => item !== value)
        : [...selectedBrandIds, value],
    });
  };

  const toggleBand = (band) => {
    onChange({
      discountBand: selectedBand === band ? null : band,
      discountBands: selectedBand === band ? [] : [band],
    });
  };

  const toggleDeal = (id) => {
    const value = idOf(id);
    // Single deal click par All Deals cards view band (taake mix na ho)
    if (showAllDealsView && typeof onToggleAllDealsView === "function") {
      onToggleAllDealsView(false);
    }
    onChange({
      dealIds: selectedDealIds.includes(value)
        ? selectedDealIds.filter((item) => item !== value)
        : [...selectedDealIds, value],
    });
  };

  if (collapsed) {
    return (
      <aside
        aria-label="Filters"
        title="Filters"
        className={`flex min-h-12 justify-center overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-2 text-[var(--user-text-muted)] ${className}`}
      >
        <div className="flex h-6 w-6 items-center justify-center">
          <SlidersHorizontal size={16} />
        </div>
      </aside>
    );
  }

  if (isLoading) {
    return (
      <aside className={`overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] ${className}`}>
        <div className="flex items-center gap-2 border-b border-[var(--user-border)] px-4 py-3.5">
          <SlidersHorizontal size={15} className="shrink-0 text-[var(--user-accent)]" />
          <h2 className="flex-1 text-[0.8125rem] font-black uppercase tracking-[0.12em] text-[var(--user-text)]">
            Filters
          </h2>
        </div>
        <div className="space-y-5 p-4">
          <LoadingRows count={1} />
          <LoadingRows count={6} />
          <LoadingRows count={2} />
          <LoadingRows count={5} />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-[var(--user-shadow-sm)] ${className}`}
    >
      <div className={scrollable ? "max-h-[calc(100vh-8.5rem)] overflow-y-auto" : ""}>
        {/* HEADER */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-3">
        <SlidersHorizontal size={14} className="shrink-0 text-[var(--user-accent)]" />
        <h2 className="flex-1 text-xs font-semibold text-[var(--user-text)]">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClear}
            disabled={!filtersActive}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[0.625rem] font-medium transition-colors ${
              filtersActive
                ? "text-[var(--user-accent)] hover:bg-[var(--user-bg-hover)]"
                : "cursor-not-allowed text-[var(--user-text-disabled)]"
            }`}
          >
            <RotateCcw size={11} /> Clear All
          </button>
        </div>

        <p className="border-b border-[var(--user-border)] px-3 py-2 text-[0.6875rem] text-[var(--user-text-subtle)]">
          <span className="font-medium text-[var(--user-text)]">{matchCount}</span>{" "}
          {matchCount === 1 ? "product" : "products"} {filtersActive ? "match your filters" : "available"}
        </p>

        {/* CATEGORY — nothing is pre-selected: the list starts clean and any
            click adds a filter (clicking the same category again removes it).
            "Clear All" in the header resets everything. */}
        <Section title="Category" icon={Tags} hint={categoryList.length ? `${categoryList.length}` : null}>
          <div className={showAllCategories ? "max-h-[16.25rem] space-y-0.5 overflow-y-auto pr-0.5" : "space-y-0.5"}>
            {visibleCategories.map((category) => (
              <CheckRow
                key={category._id}
                checked={activeCategoryIds.includes(idOf(category._id))}
                label={category.name}
                count={category.count}
                icon={<CategoryIcon name={category.name} size={13} className="shrink-0 text-[var(--user-accent)]" />}
                onClick={() => toggleCategory(category._id)}
              />
            ))}
            {!categoryList.length ? (
              <p className="px-2 py-3 text-[0.6875rem] text-[var(--user-text-subtle)]">No categories yet.</p>
            ) : null}
          </div>

          {categoryList.length > CATEGORY_PREVIEW ? (
            <ShowMore
              open={showAllCategories}
              total={categoryList.length}
              onClick={() => setShowAllCategories((value) => !value)}
            />
          ) : null}
        </Section>

        {/* PRICE RANGE — Amazon style: Min/Max + Go, slider release par apply.
            Discount ke baad wali final qeemat par filter hota hai (backend). */}
        <Section title="Price Range" icon={Wallet}>
          <PriceFilter
            bounds={bounds}
            filterMin={filterMin}
            filterMax={filterMax}
            onApply={(patch) => onChange(patch)}
          />
        </Section>

        {/* TOP BRANDS */}
        <Section title="Brand" icon={Store} hint={brandList.length ? `${brandList.length}` : null}>
          <div className="relative mb-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)]"
            />
            <input
              value={brandQuery}
              onChange={(event) => setBrandQuery(event.target.value)}
              placeholder="Search brand..."
              aria-label="Search brands"
              className="w-full rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] py-1.5 pl-7 pr-2.5 text-[0.75rem] text-[var(--user-text)] outline-none transition-colors placeholder:text-[var(--user-text-disabled)] focus:border-[var(--user-accent)]"
            />
          </div>

          {searchedBrands.length === 0 ? (
            <p className="px-2 py-3 text-[0.6875rem] text-[var(--user-text-subtle)]">No brands found.</p>
          ) : (
            <div className={showAllBrands ? "max-h-[16.25rem] space-y-0.5 overflow-y-auto pr-0.5" : "space-y-0.5"}>
              {visibleBrands.map((brand) => (
                <CheckRow
                  key={brand._id}
                  checked={selectedBrandIds.includes(idOf(brand._id))}
                  label={brand.name}
                  count={brand.count}
                  onClick={() => toggleBrand(brand._id)}
                />
              ))}
            </div>
          )}

          {searchedBrands.length > BRAND_PREVIEW ? (
            <ShowMore
              open={showAllBrands}
              total={searchedBrands.length}
              onClick={() => setShowAllBrands((value) => !value)}
            />
          ) : null}
        </Section>

        {/* DEALS — active deals (Brand ke neeche): click karne par right side
            me us deal ke products filter ho kar show hote hain
            (dobara click = remove). "Clear All" se reset. */}
        <Section title="Deals" icon={Flame} hint={dealList.length ? `${dealList.length}` : null}>
          {dealsLoading && !dealList.length ? (
            <LoadingRows count={4} />
          ) : !dealList.length ? (
            <p className="px-2 py-3 text-[0.6875rem] text-[var(--user-text-subtle)]">
              No active deals right now.
            </p>
          ) : (
            <>
              {/* ALL DEALS — fixed upar (scroll nahi hota): click par right
                  side me deal cards (10 per page), koi deal select nahi hoti. */}
              <div className="space-y-0.5">
                <CheckRow
                  checked={!!showAllDealsView}
                  title="All Deals"
                  label={
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-bold">All Deals</span>
                      <span className="w-fit rounded-full bg-[var(--user-accent-soft)] px-1.5 py-px text-[0.5625rem] font-black uppercase tracking-wider text-[var(--user-accent)]">
                        All offers
                      </span>
                    </span>
                  }
                  count={dealList.length || null}
                  icon={<Flame size={13} className="shrink-0 text-[var(--user-accent)]" />}
                  onClick={() => onToggleAllDealsView?.(!showAllDealsView)}
                />
              </div>
              <div className="mx-2 my-1 border-t border-dashed border-[var(--user-border)]" />
              {/* INDIVIDUAL DEALS — Brand ki tarah: expand par poora lamba
                  nahi hota, usi block me scrollbar ban jata hai. */}
              <div className={showAllDeals ? "max-h-[16.25rem] space-y-0.5 overflow-y-auto pr-0.5" : "space-y-0.5"}>
                {visibleDeals.map((deal) => {
                  const dealId = idOf(deal._id);
                  const checked = selectedDealIds.includes(dealId);
                  const badge = getDealBadgeText(deal);
                  return (
                    <CheckRow
                      key={dealId}
                      checked={checked}
                      title={deal.name || "Deal"}
                      label={
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate">{deal.name || "Deal"}</span>
                          {badge ? (
                            <span className="w-fit rounded-full bg-[var(--user-accent-soft)] px-1.5 py-px text-[0.5625rem] font-black uppercase tracking-wider text-[var(--user-accent)]">
                              {badge}
                            </span>
                          ) : null}
                        </span>
                      }
                      count={typeof deal.count === "number" ? deal.count : null}
                      icon={<Flame size={13} className="shrink-0 text-[var(--user-accent)]" />}
                      disabled={(deal.count || 0) === 0 && !checked}
                      onClick={() => toggleDeal(deal._id)}
                    />
                  );
                })}
              </div>
              {showAllDealsView ? (
                <p className="mt-2 rounded-lg bg-[var(--user-accent-soft)] px-2.5 py-1.5 text-[0.625rem] font-semibold leading-relaxed text-[var(--user-text-muted)]">
                  Showing all deal cards on the right (10 per page) →
                </p>
              ) : selectedDealIds.length > 0 ? (
                <p className="mt-2 rounded-lg bg-[var(--user-accent-soft)] px-2.5 py-1.5 text-[0.625rem] font-semibold leading-relaxed text-[var(--user-text-muted)]">
                  Showing products from {selectedDealIds.length}{" "}
                  {selectedDealIds.length === 1 ? "deal" : "deals"} on the right →
                </p>
              ) : null}
              {dealList.length > DEAL_PREVIEW ? (
                <ShowMore
                  open={showAllDeals}
                  total={dealList.length}
                  onClick={() => setShowAllDeals((value) => !value)}
                />
              ) : null}
            </>
          )}
        </Section>

        {/* DISCOUNT — selected band sab se upar */}
        <Section title="Discount" icon={BadgePercent}>
          <div className="space-y-0.5">
            {discountFacet.length === 0 ? (
              <LoadingRows count={4} />
            ) : (
              [...discountFacet]
                .sort((a, b) => selectedFirst(selectedBandSet, a.band, b.band))
                .map((band) => (
                  <CheckRow
                    key={band.band}
                    checked={selectedBand === band.band}
                    label={`${band.band}% or more`}
                    count={band.count}
                    disabled={band.count === 0 && selectedBand !== band.band}
                    onClick={() => toggleBand(band.band)}
                  />
                ))
            )}
          </div>
        </Section>
      </div>
    </aside>
  );
}
