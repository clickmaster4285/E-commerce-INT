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

import { useMemo, useState } from "react";
import {
  BadgePercent,
  Boxes,
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
  getBrandCounts,
  getCategorySubtreeCounts,
  getDealBadgeText,
  idOf,
  isTopLevelCategory,
  priceBounds,
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
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--user-bg-hover)]"
      >
        {Icon ? <Icon size={14} className="shrink-0 text-[var(--user-accent)]" /> : null}
        <span className="flex-1 text-[0.6875rem] font-black uppercase tracking-[0.14em] text-[var(--user-text)]">
          {title}
        </span>
        {hint ? (
          <span className="shrink-0 rounded-full bg-[var(--user-bg-hover)] px-1.5 py-0.5 text-[0.625rem] font-bold text-[var(--user-text-subtle)]">
            {hint}
          </span>
        ) : null}
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--user-text-muted)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="px-3 pb-4">{children}</div> : null}
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
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
        disabled
          ? "cursor-not-allowed opacity-45"
          : checked
            ? "bg-[var(--user-accent-soft)]"
            : "hover:bg-[var(--user-bg-hover)]"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? "border-[var(--user-accent)] bg-[var(--user-accent)] text-[var(--user-accent-text)]"
            : "border-[var(--user-border-hover)]"
        }`}
      >
        {checked ? <Check size={11} /> : null}
      </span>
      {icon}
      <span
        className={`min-w-0 flex-1 line-clamp-2 break-words text-[0.78125rem] font-medium capitalize ${
          checked ? "text-[var(--user-text)]" : "text-[var(--user-text-muted)]"
        }`}
      >
        {label}
      </span>
      {count !== null ? (
        <span className="shrink-0 text-[0.625rem] font-bold tabular-nums text-[var(--user-text-subtle)]">
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
      className="mt-1.5 w-full rounded-lg py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent)] transition-colors hover:bg-[var(--user-bg-hover)]"
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

function PriceRangeSlider({ min, max, value, onChange }) {
  const span = max - min;
  if (span <= 0) return null;

  const percent = (price) => ((price - min) / span) * 100;
  const lowPercent = Math.min(100, Math.max(0, percent(value[0])));
  const highPercent = Math.min(100, Math.max(0, percent(value[1])));

  return (
    <div className="relative h-6 select-none">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--user-border)]" />
      <div
        className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--user-accent)]"
        style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[0]}
        onChange={(event) => onChange([Math.min(Number(event.target.value), value[1]), value[1]])}
        aria-label="Minimum price"
        className={THUMB_CLASS}
        style={{ zIndex: lowPercent > 70 ? 30 : 10 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value[1]}
        onChange={(event) => onChange([value[0], Math.max(Number(event.target.value), value[0])])}
        aria-label="Maximum price"
        className={THUMB_CLASS}
        style={{ zIndex: 20 }}
      />
    </div>
  );
}

/* Min / max input box — uncontrolled (value sirf commit par apply hoti hai,
   external value badalne par parent `key` change kar ke input reset karta hai) */
function PriceInput({ label, defaultValue, onCommit }) {
  const [draft, setDraft] = useState(() => String(defaultValue ?? ""));

  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-input)] px-2.5 focus-within:border-[var(--user-accent)]">
      <span className="shrink-0 text-[0.625rem] font-bold uppercase text-[var(--user-text-subtle)]">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(draft);
        }}
        className="min-w-0 flex-1 bg-transparent text-[0.75rem] font-semibold tabular-nums text-[var(--user-text)] outline-none"
      />
    </label>
  );
}

export default function HomeSidebar({
  categories = [],
  brands = [],
  products = [],
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
  isLoading = false,
  scrollable = false,
  className = "",
  showAllDealsView = false,
  onToggleAllDealsView,
}) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllDeals, setShowAllDeals] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [showAllBrands, setShowAllBrands] = useState(false);

  const categoryCounts = useMemo(() => getCategorySubtreeCounts(categories, products), [categories, products]);
  const brandCounts = useMemo(() => getBrandCounts(products), [products]);

  /* Selected ids (strings me normalize) — select hote hi wo item apne
     section me TOP par ajata hai (neeche sort me selected-first). Plain
     consts hain taake selection change par sorting foran update ho. */
  const strSet = (values) => new Set((values || []).map((value) => String(idOf(value) || value)).filter(Boolean));
  const selectedCategorySet = strSet(filters?.categoryIds);
  const selectedBrandSet = strSet(filters?.brandIds);
  const selectedDealSet = strSet(filters?.dealIds);
  const selectedStockSet = strSet(filters?.stockStates);
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

  const bounds = useMemo(() => priceBounds(products), [products]);

  const filterMin = filters?.minPrice ?? null;
  const filterMax = filters?.maxPrice ?? null;

  // Controlled value — filter state hi single source of truth hai
  // (isliye koi effect/derived-state sync ki zaroorat nahi).
  const sliderValue = [filterMin ?? bounds.min, filterMax ?? bounds.max];

  const selectedBrandIds = filters?.brandIds || [];
  const selectedStock = filters?.stockStates || [];
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

  const toggleStock = (id) => {
    onChange({
      stockStates: selectedStock.includes(id)
        ? selectedStock.filter((item) => item !== id)
        : [...selectedStock, id],
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

  const handleSlider = ([low, high]) => {
    const minValue = Math.min(Math.max(low, bounds.min), bounds.max);
    const maxValue = Math.max(Math.min(high, bounds.max), minValue);
    onChange({
      minPrice: minValue <= bounds.min ? null : Math.round(minValue),
      maxPrice: maxValue >= bounds.max ? null : Math.round(maxValue),
    });
  };

  const commitMin = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= bounds.min) return onChange({ minPrice: null });
    onChange({ minPrice: Math.min(Math.round(value), filterMax ?? bounds.max) });
  };

  const commitMax = (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value >= bounds.max) return onChange({ maxPrice: null });
    onChange({ maxPrice: Math.max(Math.round(value), filterMin ?? bounds.min) });
  };

  if (isLoading && !products.length) {
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
      className={`overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] ${className}`}
    >
      <div className={scrollable ? "max-h-[calc(100vh-8.5rem)] overflow-y-auto" : ""}>
        {/* HEADER */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-3.5">
          <SlidersHorizontal size={15} className="shrink-0 text-[var(--user-accent)]" />
          <h2 className="flex-1 text-[0.8125rem] font-black uppercase tracking-[0.12em] text-[var(--user-text)]">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClear}
            disabled={!filtersActive}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[0.625rem] font-bold uppercase tracking-wider transition-colors ${
              filtersActive
                ? "text-[var(--user-accent)] hover:bg-[var(--user-bg-hover)]"
                : "cursor-not-allowed text-[var(--user-text-disabled)]"
            }`}
          >
            <RotateCcw size={11} /> Clear All
          </button>
        </div>

        <p className="border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] px-4 py-2 text-[0.6875rem] font-semibold text-[var(--user-text-subtle)]">
          <span className="font-black text-[var(--user-text)]">{matchCount}</span>{" "}
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

        {/* PRICE RANGE */}
        <Section title="Price Range" icon={Wallet}>
          <p className="mb-2.5 flex items-center justify-between gap-2 text-[0.75rem] font-bold text-[var(--user-text)]">
            <span className="tabular-nums">
              {formatPrice(sliderValue[0])} — {formatPrice(sliderValue[1])}
            </span>
          </p>

          {bounds.max > bounds.min ? (
            <PriceRangeSlider
              min={bounds.min}
              max={bounds.max}
              value={sliderValue}
              onChange={handleSlider}
            />
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <PriceInput
              key={`min-${sliderValue[0]}`}
              label="Min"
              defaultValue={sliderValue[0]}
              onCommit={commitMin}
            />
            <PriceInput
              key={`max-${sliderValue[1]}`}
              label="Max"
              defaultValue={sliderValue[1]}
              onCommit={commitMax}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[0.625rem] font-semibold text-[var(--user-text-subtle)]">
            <span>{formatPrice(bounds.min)}</span>
            <span>{formatPrice(bounds.max)}</span>
          </div>
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
        {/* AVAILABILITY — selected state sab se upar */}
        <Section title="Availability" icon={Boxes}>
          <div className="space-y-0.5">
            {stockFacet.length === 0
              ? <LoadingRows count={3} />
              : [...stockFacet]
                  .sort((a, b) => selectedFirst(selectedStockSet, a.id, b.id))
                  .map((state) => (
                    <CheckRow
                      key={state.id}
                      checked={selectedStock.includes(state.id)}
                      label={state.label}
                      count={state.count}
                      disabled={state.count === 0 && !selectedStock.includes(state.id)}
                      onClick={() => toggleStock(state.id)}
                    />
                  ))}
          </div>
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

