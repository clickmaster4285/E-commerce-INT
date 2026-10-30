"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Bookmark,
  ClipboardList,
  History,
  RotateCcw,
  SlidersHorizontal,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Percent,
  Printer,
  Search,
  Settings2,
  ArrowUpRight,
  ShoppingCart,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
import { customerApi } from "@/apis/admin/customerApi";
import { storeApi } from "@/apis/admin/storeApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import { posApi } from "@/apis/admin/posApi";
import PosReturnPanel from "./PosReturnPanel";
import { getProductImage } from "@/utils/homeCatalog";

const PAGE_SIZE = 30;
const HISTORY_PAGE_SIZE = 20;
const money = (value, locale) => `Rs. ${(Number(value) || 0).toLocaleString(locale, { maximumFractionDigits: 2 })}`;
const itemGrossTotal = (item) => (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);
const itemDiscountTotal = (item) => {
  const gross = itemGrossTotal(item);
  const percentDiscount = gross * (Math.min(100, Math.max(0, Number(item.discount_rate) || 0)) / 100);
  const flatDiscount = Math.max(0, Number(item.flat_discount) || 0) * (Number(item.quantity) || 0);
  return percentDiscount + Math.min(gross - percentDiscount, flatDiscount);
};
const itemNetTotal = (item) => Math.max(0, itemGrossTotal(item) - itemDiscountTotal(item));
const getDiscountType = (item) => item.discount_type || (Number(item.flat_discount) > 0 && !(Number(item.discount_rate) > 0) ? "flat" : "percentage");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const paymentMethods = [
  { value: "cash", Icon: Wallet },
  { value: "card", Icon: CreditCard },
  { value: "bank_transfer", Icon: Banknote },
];

const paymentLabel = (method, t) => {
  const normalized = String(method || "cash").toLowerCase();
  const key = { cash: "cash", card: "card", bank_transfer: "bankTransfer" }[normalized];
  return key ? t(`admin.pos.payment.${key}`) : normalized.replaceAll("_", " ");
};
const variantLabel = (variant, t) => {
  const attributes = Object.entries(variant?.attributes || {}).filter(([, value]) => (
    value !== null && value !== undefined && String(value).trim() !== ""
  ));
  const size = attributes.find(([name]) => /size/i.test(name));
  const value = size?.[1];
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : variant?.title || t("admin.pos.ui.defaultVariant");
};

function PosDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  fieldLabel,
  prefix = "",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  placement = "bottom",
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const SelectedIcon = selectedOption?.Icon;

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className={`relative min-w-0 ${className}`} ref={dropdownRef}>
      {fieldLabel && <span className="mb-1 block text-[10px] font-semibold text-slate-500">{fieldLabel}</span>}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-start text-xs font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-blue-300 hover:bg-[var(--bg-card-alt)] focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${buttonClassName}`}
      >
        {SelectedIcon && <SelectedIcon size={15} className="shrink-0 text-slate-500" />}
        <span className="min-w-0 flex-1 truncate">{prefix}{selectedOption?.label || t("admin.pos.ui.selectAnOption")}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={`absolute ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"} start-0 z-[70] min-w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 ${menuClassName}`}>
          <div role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-xs transition ${isSelected ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-alt)] hover:text-[var(--text-primary)]"}`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SaleActionsMenu({ sale, direction = "ltr", onEdit, onPrint }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 184;
      const menuHeight = 132;
      const placeAbove = window.innerHeight - rect.bottom < menuHeight + 12 && rect.top > window.innerHeight - rect.bottom;
      const preferredLeft = direction === "rtl" ? rect.left : rect.right - menuWidth;
      setPosition({
        left: Math.max(8, Math.min(preferredLeft, window.innerWidth - menuWidth - 8)),
        top: placeAbove ? Math.max(8, rect.top - menuHeight - 8) : Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 8),
      });
    };
    const closeOutside = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    updatePosition();
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, direction]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("admin.orders.page.actionsFor", { number: sale.sale_number || t("common.notProvided") })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => { setPosition(null); setOpen((current) => !current); }}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${open ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
      ><MoreVertical size={18}/></button>
      {open && position && typeof document !== "undefined" && createPortal(
        <div ref={menuRef} role="menu" className="fixed z-[1000] min-w-[184px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/15 ring-1 ring-black/5" style={position}>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(sale); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-xs font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:outline-none"><Pencil size={14}/>{t("admin.pos.ui.editSaleInPOSCart")}</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onPrint(sale); }} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-xs font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:outline-none"><Printer size={14}/>{t("admin.pos.ui.printReceipt")}</button>
          <Link role="menuitem" href={`/admin/pos/history/${sale._id}`} onClick={() => setOpen(false)} className="flex w-full items-center justify-between gap-2.5 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:outline-none">{t("admin.pos.ui.details")}<ArrowUpRight size={13}/></Link>
        </div>,
        document.body,
      )}
    </>
  );
}

export default function PosPage() {
  const { t, locale, dir } = useTranslation();
  const formatMoney = (value) => money(value, locale);
  const { productNameOf } = useLocalized();
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);
  const saleFormRef = useRef(null);
  const customerBoxRef = useRef(null);
  const filtersPanelRef = useRef(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedStock, setSelectedStock] = useState("");
  const [selectedSort, setSelectedSort] = useState("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", address: "" });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [additionalTaxRate, setAdditionalTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [cart, setCart] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [rateEditorVariantId, setRateEditorVariantId] = useState(null);
  const [activeView, setActiveView] = useState("pos");
  const viewMode = "grid";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [heldCarts, setHeldCarts] = useState([]);
  const heldCartsLoaded = useRef(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPayment, setHistoryPayment] = useState("all");
  const [historyRange, setHistoryRange] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [editingSaleNumber, setEditingSaleNumber] = useState("");
  const [editingOriginalQuantities, setEditingOriginalQuantities] = useState({});
  const [returnSaleId, setReturnSaleId] = useState("");
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnNote, setReturnNote] = useState("");

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!filtersPanelRef.current?.contains(event.target)) setFiltersOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [filtersOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setHeldCarts(JSON.parse(window.localStorage.getItem("admin-pos-held-carts") || "[]")); } catch { setHeldCarts([]); }
      heldCartsLoaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!heldCartsLoaded.current) return;
    window.localStorage.setItem("admin-pos-held-carts", JSON.stringify(heldCarts));
  }, [heldCarts]);

  const historyQuery = useQuery({
    queryKey: ["pos-sales-history"],
    queryFn: async () => {
      const firstPage = await posApi.getSales({ page: 1, limit: 50 });
      const allSales = Array.isArray(firstPage.data) ? [...firstPage.data] : [];
      const pages = Math.max(1, Number(firstPage.pagination?.totalPages) || 1);
      for (let page = 2; page <= pages; page += 1) {
        const response = await posApi.getSales({ page, limit: 50 });
        if (Array.isArray(response.data)) allSales.push(...response.data);
      }
      return allSales;
    },
    enabled: activeView === "history" || activeView === "returns",
  });
  const salesOverviewQuery = useQuery({
    queryKey: ["pos-sales-overview"],
    queryFn: async () => {
      const firstPage = await posApi.getSales({ page: 1, limit: 50 });
      const totalTransactions = Number(firstPage.pagination?.total) || 0;
      const pageCount = Math.max(1, Number(firstPage.pagination?.totalPages) || 1);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      let todayCount = 0;
      let todayRevenue = 0;
      let pageData = Array.isArray(firstPage.data) ? firstPage.data : [];
      for (let page = 1; page <= pageCount && pageData.length; page += 1) {
        for (const sale of pageData) {
          if (new Date(sale.created_at) >= startOfToday) {
            todayCount += 1;
            todayRevenue += Number(sale.total) || 0;
          }
        }
        if (page === pageCount || pageData.some((sale) => new Date(sale.created_at) < startOfToday)) break;
        const nextPage = await posApi.getSales({ page: page + 1, limit: 50 });
        pageData = Array.isArray(nextPage.data) ? nextPage.data : [];
      }
      return { totalTransactions, todayCount, todayRevenue };
    },
    staleTime: 30_000,
  });
  const { data: storeInfo = {} } = useQuery({
    queryKey: ["store"],
    queryFn: async () => (await storeApi.get()) || {},
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const historySales = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const now = new Date();
    const from = historyRange === "today" ? new Date(now) : historyRange === "7days" ? new Date(now) : historyRange === "30days" ? new Date(now) : null;
    if (historyRange === "today") from.setHours(0, 0, 0, 0);
    if (historyRange === "7days") from.setDate(from.getDate() - 7);
    if (historyRange === "30days") from.setDate(from.getDate() - 30);
    return (historyQuery.data || []).filter((sale) => {
      const method = String(sale.payment?.method || "cash").toLowerCase();
      const saleDate = new Date(sale.created_at);
      const matchesSearch = !query || [sale.sale_number, sale.customer_snapshot?.name, sale.customer_snapshot?.phone, method].filter(Boolean).join(" ").toLowerCase().includes(query);
      return matchesSearch && (historyPayment === "all" || method === historyPayment) && (!from || (saleDate >= from && saleDate <= now));
    });
  }, [historyQuery.data, historySearch, historyPayment, historyRange]);
  const historyPageCount = Math.max(1, Math.ceil(historySales.length / HISTORY_PAGE_SIZE));
  const visibleHistorySales = historySales.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
  const selectedReturnSale = (historyQuery.data || []).find((sale) => sale._id === returnSaleId) || null;

  const holdCart = () => {
    if (editingSaleId) { toast.error(t("admin.pos.toast.cannotHoldEditedSale")); return; }
    if (!cart.length) { toast.error(t("admin.pos.toast.addItemsBeforeHolding")); return; }
    setHeldCarts((current) => [{ id: `${Date.now()}`, createdAt: new Date().toISOString(), cart, customer: selectedCustomer, paymentMethod, paymentReference, discountAmount, additionalTaxRate, notes, editingSaleId, editingSaleNumber, editingOriginalQuantities }, ...current]);
    setCart([]); setSelectedCustomer(null); setDiscountAmount(""); setAdditionalTaxRate("0"); setNotes("");
    setPaymentReference("");
    setEditingSaleId(null); setEditingSaleNumber(""); setEditingOriginalQuantities({});
    toast.success(t("admin.pos.toast.saleHeld"));
  };
  const resumeHeldCart = (held, restoredAt) => {
    const currentDraft = cart.length ? {
      id: `current-${held.id}`, createdAt: restoredAt, cart,
      customer: selectedCustomer, paymentMethod, paymentReference, discountAmount, additionalTaxRate, notes,
      editingSaleId, editingSaleNumber, editingOriginalQuantities,
    } : null;
    setCart(held.cart || []); setSelectedCustomer(held.customer || null); setPaymentMethod(held.paymentMethod || "cash");
    setPaymentReference(held.paymentReference || "");
    setDiscountAmount(held.discountAmount || ""); setAdditionalTaxRate(held.additionalTaxRate ?? "0"); setNotes(held.notes || "");
    setEditingSaleId(held.editingSaleId || null); setEditingSaleNumber(held.editingSaleNumber || ""); setEditingOriginalQuantities(held.editingOriginalQuantities || {});
    setHeldCarts((current) => [...(currentDraft ? [currentDraft] : []), ...current.filter((item) => item.id !== held.id)]); setActiveView("pos");
    toast.success(t(currentDraft ? "admin.pos.toast.heldSaleRestoredWithDraft" : "admin.pos.toast.heldSaleRestored"));
  };
  const editHistorySale = (sale) => {
    if (cart.length) {
      toast.error(t("admin.pos.toast.saveOrCancelCartBeforeEditing"));
      return;
    }
    const saleItems = sale.items || [];
    const originalQuantities = saleItems.reduce((result, item) => {
      const variantId = String(item.variant_id?._id || item.variant_id || "");
      if (variantId) result[variantId] = (result[variantId] || 0) + (Number(item.quantity) || 0);
      return result;
    }, {});
    const itemDiscountTotal = saleItems.reduce((sum, item) => sum + (Number(item.discount_amount) || 0), 0);
    const customerSnapshot = sale.customer_snapshot || {};
    const customer = sale.customer_id && typeof sale.customer_id === "object"
      ? sale.customer_id
      : sale.customer_id
        ? { _id: sale.customer_id, name: customerSnapshot.name, phone: customerSnapshot.phone }
        : null;
    setCart(saleItems.map((item) => ({
      variant_id: String(item.variant_id?._id || item.variant_id),
      product_id: String(item.product_id?._id || item.product_id || ""),
      product_name: productNameOf(item) || t("admin.pos.ui.product"),
      variant_title: item.variant_title || t("admin.pos.ui.defaultVariant"),
      sku: item.sku || "",
      unit_price: Number(item.unit_price) || 0,
      quantity: Number(item.quantity) || 1,
      stock: Number.MAX_SAFE_INTEGER,
      tax_rate: Number(item.tax_rate) || 0,
      discount_rate: Number(item.discount_rate) || 0,
      flat_discount: Number(item.flat_discount) || 0,
      discount_type: Number(item.discount_rate) > 0 && Number(item.flat_discount) > 0
        ? "combined"
        : Number(item.flat_discount) > 0 ? "flat" : "percentage",
      image: getProductImage({ variants: [{ images: item.product_image ? [{ img_url: item.product_image }] : [] }] }),
    })));
    setSelectedCustomer(customer);
    setPaymentMethod(sale.payment?.method || "cash");
    setPaymentReference(sale.payment?.reference || "");
    setDiscountAmount(String(Math.max(0, (Number(sale.discount_amount) || 0) - itemDiscountTotal)));
    setAdditionalTaxRate(String(Math.max(0, Number(sale.additional_tax_rate) || 0)));
    setNotes(sale.notes || "");
    setEditingSaleId(sale._id);
    setEditingSaleNumber(sale.sale_number || t("common.notProvided"));
    setEditingOriginalQuantities(originalQuantities);
    setRateEditorVariantId(null);
    setActiveView("pos");
    toast.success(t("admin.pos.toast.editingSale", { sale: sale.sale_number || t("admin.pos.ui.posSale") }));
  };
  const cancelSaleEdit = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountAmount("");
    setAdditionalTaxRate("0");
    setNotes("");
    setPaymentReference("");
    setEditingSaleId(null);
    setEditingSaleNumber("");
    setEditingOriginalQuantities({});
    toast.info(t("admin.pos.toast.saleEditCancelled"));
  };

  const { data: productsPayload = {}, isLoading: productsLoading, isError: productsError } = useQuery({
    queryKey: ["pos-products", search, selectedCategory, selectedBrand, selectedStock, selectedSort, currentPage],
    queryFn: () => posApi.getProducts({
      search: search.trim(),
      category: selectedCategory,
      brand: selectedBrand,
      stock: selectedStock,
      sort: selectedSort,
      page: currentPage,
      limit: PAGE_SIZE,
    }),
    placeholderData: (previousData) => previousData,
  });
  const products = Array.isArray(productsPayload.data) ? productsPayload.data : [];
  const variantCards = products.flatMap((product) =>
    (Array.isArray(product.variants) ? product.variants : []).map((variant) => ({ product, variant })),
  ).slice(0, PAGE_SIZE);
  const categoryOptions = productsPayload.filters?.categories || [];
  const brandOptions = productsPayload.filters?.brands || [];
  const totalPages = Math.max(1, Number(productsPayload.pagination?.totalPages) || 1);

  const customerResults = useQuery({
    queryKey: ["pos-customer-picker", customerSearch],
    queryFn: () => customerApi.getAll({ search: customerSearch.trim() }),
    enabled: customerOpen,
  });

  useEffect(() => {
    if (!customerOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(event.target)) setCustomerOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setCustomerOpen(false); };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [customerOpen]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
    [cart],
  );
  const itemDiscount = useMemo(
    () => cart.reduce((sum, item) => sum + itemDiscountTotal(item), 0),
    [cart],
  );
  const itemTax = useMemo(
    () => cart.reduce((sum, item) => sum + itemNetTotal(item) * item.tax_rate / 100, 0),
    [cart],
  );
  const taxableSubtotal = cart.reduce((sum, item) => sum + itemNetTotal(item), 0);
  const additionalTax = taxableSubtotal * (Math.min(100, Math.max(0, Number(additionalTaxRate) || 0)) / 100);
  const tax = itemTax + additionalTax;
  const overallDiscount = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal - itemDiscount + tax);
  const discount = itemDiscount + overallDiscount;
  const total = Math.max(0, Math.round(Math.round(subtotal) + Math.round(tax) - discount));
  const itemCount = cart.reduce((count, item) => count + item.quantity, 0);

  const selectCategory = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const addToCart = (product, variant, requestedQuantity = 1) => {
    if (!variant?._id) {
      toast.error(t("admin.pos.toast.variantCannotBeAdded"));
      return;
    }
    const quantityToAdd = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
    const stock = Number(variant.quantity) || 0;
    const saleCredit = Number(editingOriginalQuantities[variant._id]) || 0;
    const availableStock = stock + saleCredit;
    if (availableStock < 1) {
      toast.error(t("admin.pos.toast.variantOutOfStock"));
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.variant_id === variant._id);
      const currentQuantity = existing?.quantity || 0;
      if (currentQuantity + quantityToAdd > (existing?.stock || availableStock)) {
        toast.error(t("admin.pos.toast.moreAvailableForVariant", { count: Math.max((existing?.stock || availableStock) - currentQuantity, 0) }));
        return currentCart;
      }
      if (existing) {
        return currentCart.map((item) => (
          item.variant_id === variant._id ? { ...item, quantity: item.quantity + quantityToAdd, stock: Math.max(item.stock, availableStock) } : item
        ));
      }
      const image = getProductImage({ ...product, variants: [variant] });
      return [...currentCart, {
        variant_id: variant._id,
        product_id: product._id,
        product_name: product.name,
        translations: product.translations,
        variant_title: variant.title || "Default",
        sku: variant.sku || "",
        unit_price: Number(variant.selling_price) || 0,
        quantity: quantityToAdd,
        stock: availableStock,
        tax_rate: Number(product.tax) || 0,
        discount_rate: 0,
        flat_discount: 0,
        discount_type: "percentage",
        image,
      }];
    });
  };

  const changeQuantity = (variantId, delta) => {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[variantId];
      return next;
    });
    setCart((currentCart) => currentCart.map((item) => {
      if (item.variant_id !== variantId) return item;
      return { ...item, quantity: Math.min(item.stock, Math.max(1, item.quantity + delta)) };
    }));
  };

  const commitQuantity = (variantId) => {
    const draft = quantityDrafts[variantId];
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[variantId];
      return next;
    });
    if (draft === undefined || draft === "") return;
    const requested = Number.parseInt(draft, 10);
    if (!Number.isFinite(requested)) return;
    setCart((currentCart) => currentCart.map((item) => item.variant_id === variantId
      ? { ...item, quantity: Math.min(item.stock, Math.max(1, requested)) }
      : item));
  };

  const customerMutation = useMutation({
    mutationFn: () => customerApi.create(customerForm),
    onSuccess: (response) => {
      const customer = response?.data || response;
      setSelectedCustomer(customer);
      setCustomerForm({ name: "", phone: "", address: "" });
      setShowCustomerForm(false);
      setCustomerOpen(false);
      setCustomerSearch("");
      queryClient.invalidateQueries({ queryKey: ["pos-customer-picker"] });
      toast.success(t("admin.pos.toast.customerAdded"));
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.pos.toast.customerCreateFailed")),
  });

  const saleMutation = useMutation({
    mutationFn: () => {
      const saleData = {
        customer_id: selectedCustomer?._id || null,
        customer_name: selectedCustomer?.name || t("admin.pos.ui.walkInCustomer"),
        customer_phone: selectedCustomer?.phone || "",
        customer_email: selectedCustomer?.email || "",
        customer_address: selectedCustomer?.address || "",
        payment_method: paymentMethod,
        reference: paymentReference,
        amount_received: total,
        discount_amount: overallDiscount,
        additional_tax_rate: Math.min(100, Math.max(0, Number(additionalTaxRate) || 0)),
        notes,
        items: cart.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_rate: item.discount_rate,
          flat_discount: item.flat_discount,
          tax_rate: item.tax_rate,
        })),
      };
      return editingSaleId ? posApi.updateSale(editingSaleId, saleData) : posApi.createSale(saleData);
    },
    onSuccess: () => {
      toast.success(editingSaleId ? t("admin.pos.toast.saleUpdated", { sale: editingSaleNumber || t("admin.pos.ui.posSale") }) : t("admin.pos.toast.saleCreated"));
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount("");
      setAdditionalTaxRate("0");
      setNotes("");
      setPaymentReference("");
      setEditingSaleId(null);
      setEditingSaleNumber("");
      setEditingOriginalQuantities({});
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales-overview"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sale-detail"] });
      queryClient.invalidateQueries({ queryKey: ["customer-detail"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || t(editingSaleId ? "admin.pos.toast.saleUpdateFailed" : "admin.pos.toast.saleCreateFailed")),
  });

  const returnMutation = useMutation({
    mutationFn: () => {
      const sale = (historyQuery.data || []).find((item) => item._id === returnSaleId);
      if (!sale) throw new Error(t("admin.pos.validation.chooseSaleFirst"));
      if (!returnNote.trim()) throw new Error(t("admin.pos.validation.returnReasonRequired"));
      const items = (sale.items || []).map((item) => ({ variant_id: String(item.variant_id?._id || item.variant_id), quantity: Number(returnQuantities[String(item.variant_id?._id || item.variant_id)] || 0) })).filter((item) => item.quantity > 0);
      return posApi.returnSale(returnSaleId, { items, note: returnNote.trim() });
    },
    onSuccess: (result) => {
      toast.success(t("admin.pos.toast.returnRecorded", { amount: formatMoney(result?.data?.refund_total || 0) }));
      setReturnQuantities({}); setReturnSaleId(""); setReturnNote("");
      queryClient.invalidateQueries({ queryKey: ["pos-sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales-overview"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || error.message || t("admin.pos.toast.returnFailed")),
  });

  const submitSale = (event) => {
    event.preventDefault();
    if (!cart.length) {
      toast.error(t("admin.pos.toast.cartNeedsAnItem"));
      return;
    }
    if (["card", "bank_transfer"].includes(paymentMethod) && !paymentReference.trim()) {
      toast.error(t("admin.pos.toast.transactionIdRequired"));
      return;
    }
    saleMutation.mutate();
  };

  const printReceipt = () => {
    if (!cart.length) { toast.error(t("admin.pos.toast.addItemsBeforePrinting")); return; }
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) { toast.error(t("admin.pos.toast.allowPopupsToPrint")); return; }

    const storeName = storeInfo.store_name || t("admin.pos.ui.ourStore");
    const storeAddress = [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", ");
    const storePhone = storeInfo.phone || storeInfo.support_phone;
    const storeEmail = storeInfo.email || storeInfo.support_email;
    const receiptDate = new Date().toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
    const rows = cart.map((item) => {
      const gross = itemGrossTotal(item);
      const percentageDiscount = gross * (Number(item.discount_rate) || 0) / 100;
      const flatDiscount = Math.min(gross - percentageDiscount, (Number(item.flat_discount) || 0) * item.quantity);
      const discountDetails = [
        Number(item.discount_rate) > 0 ? `${t("admin.pos.receipt.discount")} ${Number(item.discount_rate)}%: - ${formatMoney(percentageDiscount)}` : "",
        Number(item.flat_discount) > 0 ? `${t("admin.pos.receipt.flatDiscount")} ${formatMoney(item.flat_discount)}/${t("admin.pos.receipt.unit")}: - ${formatMoney(flatDiscount)}` : "",
      ].filter(Boolean).join(" | ");
      const variantDetails = [item.variant_title, item.sku].filter(Boolean).join(" | ");
      return `<tr><td><strong>${escapeHtml(item.product_name)}</strong>${variantDetails ? `<small>${escapeHtml(variantDetails)}</small>` : ""}${discountDetails ? `<small class="discount">${escapeHtml(discountDetails)}</small>` : ""}</td><td class="qty">${item.quantity} x ${formatMoney(item.unit_price)}</td><td class="amount">${formatMoney(itemNetTotal(item))}</td></tr>`;
    }).join("");
    const discountRows = [
      itemDiscount > 0 ? `<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.itemDiscounts"))}</span><span>- ${formatMoney(itemDiscount)}</span></div>` : "",
      overallDiscount > 0 ? `<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.saleDiscount"))}</span><span>- ${formatMoney(overallDiscount)}</span></div>` : "",
    ].join("");
    const contact = [storeAddress, storePhone, storeEmail].filter(Boolean).map(escapeHtml).join(" | ");
    const notesMarkup = notes.trim() ? `<div class="notes"><strong>${escapeHtml(t("admin.pos.receipt.notes"))}:</strong> ${escapeHtml(notes.trim())}</div>` : "";
    const paymentText = paymentLabel(paymentMethod, t);

    const receiptDocument = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(storeName)} Receipt</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:370px;margin:0 auto;padding:20px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#fff}
      header{text-align:center;padding-bottom:10px;border-bottom:1px solid #bbb}.store-name{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#444;font-size:10px;overflow-wrap:anywhere}.receipt-title{margin:12px 0 8px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px}
      .meta{padding:8px 0;border-top:1px dashed #999;border-bottom:1px dashed #999}.meta-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.meta-row span:first-child{color:#555}.meta-row span:last-child{text-align:right;font-weight:600}
      table{width:100%;margin-top:9px;border-collapse:collapse;table-layout:fixed}th{padding:6px 2px;border-bottom:1px solid #999;text-align:left;font-size:10px}th:first-child{width:45%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:25%;text-align:right}td{padding:8px 2px;border-bottom:1px solid #ddd;vertical-align:top;font-size:11px;overflow-wrap:anywhere}.qty{text-align:center;white-space:nowrap;color:#444}td.amount{text-align:right;white-space:nowrap}small{display:block;margin-top:3px;color:#555;font-size:10px}.discount{color:#333}
      .summary{margin-top:8px;padding-top:6px;border-top:1px dashed #999}.summary-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:11px}.summary-row span:last-child{white-space:nowrap}.total{display:flex;justify-content:space-between;margin-top:7px;padding:9px 0;border-top:1px solid #333;border-bottom:1px solid #333;font-size:15px;font-weight:700}.payment{display:flex;justify-content:space-between;margin-top:8px;font-size:11px}.notes{margin-top:8px;font-size:11px;overflow-wrap:anywhere}.thanks{margin-top:14px;text-align:center;color:#555;font-size:10px}
      @page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment,.notes{break-inside:avoid}}
    </style></head><body><header><h1 class="store-name">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header>
      <div class="receipt-title">${escapeHtml(t("admin.pos.receipt.salesReceipt"))}</div><div class="meta"><div class="meta-row"><span>${escapeHtml(t("admin.pos.receipt.customer"))}</span><span>${escapeHtml(selectedCustomer?.name || t("admin.pos.ui.walkInCustomer"))}</span></div>${selectedCustomer?.phone ? `<div class="meta-row"><span>${escapeHtml(t("common.phone"))}</span><span>${escapeHtml(selectedCustomer.phone)}</span></div>` : ""}<div class="meta-row"><span>${escapeHtml(t("common.date"))}</span><span>${escapeHtml(receiptDate)}</span></div></div>
      <table><thead><tr><th>${escapeHtml(t("admin.pos.receipt.item"))}</th><th>${escapeHtml(t("admin.pos.receipt.quantityPrice"))}</th><th>${escapeHtml(t("admin.pos.receipt.total"))}</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.subtotal"))}</span><span>${formatMoney(subtotal)}</span></div>${discountRows}<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.tax"))}</span><span>${formatMoney(tax)}</span></div></div><div class="total"><span>${escapeHtml(t("admin.pos.receipt.total"))}</span><span>${formatMoney(total)}</span></div><div class="payment"><span>${escapeHtml(t("admin.pos.receipt.payment"))}</span><strong>${escapeHtml(paymentText)}</strong></div>${notesMarkup}<footer class="thanks">${escapeHtml(t("admin.pos.receipt.thankYou"))}</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receiptDocument);
    printWindow.document.close();
  };

  const printHistoryReceipt = (sale) => {
    const printWindow = window.open("", "_blank", "width=460,height=760");
    if (!printWindow) { toast.error(t("admin.pos.toast.allowPopupsToPrint")); return; }
    const storeName = storeInfo.store_name || t("admin.pos.ui.ourStore");
    const contact = [
      [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", "),
      storeInfo.phone || storeInfo.support_phone,
      storeInfo.email || storeInfo.support_email,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    const customer = sale.customer_snapshot || {};
    const payment = sale.payment || {};
    const paymentText = paymentLabel(payment.method, t);
    const rows = (sale.items || []).map((item) => {
      const variant = [item.variant_title, item.sku].filter(Boolean).join(" · ");
      return `<tr><td><strong>${escapeHtml(productNameOf(item) || t("admin.pos.ui.product"))}</strong>${variant ? `<small>${escapeHtml(variant)}</small>` : ""}</td><td>${Number(item.quantity) || 0} × ${formatMoney(item.unit_price)}</td><td>${formatMoney(item.line_total)}</td></tr>`;
    }).join("");
    const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.sale_number || t("admin.pos.receipt.salesReceipt"))}</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:390px;margin:0 auto;padding:22px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#172033;background:#fff}header{text-align:center;padding-bottom:12px;border-bottom:1px solid #dbe2ea}.store{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#64748b;font-size:10px}.title{margin:13px 0;text-align:center;color:#334155;font-size:10px;font-weight:700;letter-spacing:1.2px}.meta{padding:9px 0;border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1}.meta-row,.summary-row,.total,.payment{display:flex;justify-content:space-between;gap:12px;padding:4px 0}.meta-row span:first-child,.summary-row span:first-child,.payment span{color:#64748b}.meta-row span:last-child{text-align:right;font-weight:600}table{width:100%;margin-top:10px;border-collapse:collapse;table-layout:fixed}th{padding:7px 3px;border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b;font-size:10px}th:first-child{width:46%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:24%;text-align:right}td{padding:8px 3px;border-bottom:1px solid #e8edf3;vertical-align:top;font-size:10px;overflow-wrap:anywhere}td:nth-child(2){text-align:center;color:#475569}td:last-child{text-align:right;white-space:nowrap;font-weight:600}small{display:block;margin-top:3px;color:#64748b;font-size:9px}.summary{margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1}.summary-row{font-size:11px}.total{margin-top:6px;padding:10px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;font-size:15px;font-weight:700}.payment{font-size:11px}.thanks{margin-top:16px;text-align:center;color:#64748b;font-size:10px}@page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment{break-inside:avoid}}
    </style></head><body><header><h1 class="store">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header><div class="title">${escapeHtml(t("admin.pos.receipt.salesReceipt"))}</div><div class="meta"><div class="meta-row"><span>${escapeHtml(t("admin.pos.receipt.receipt"))}</span><span>${escapeHtml(sale.sale_number || t("common.notProvided"))}</span></div><div class="meta-row"><span>${escapeHtml(t("admin.pos.receipt.customer"))}</span><span>${escapeHtml(customer.name || t("admin.pos.ui.walkInCustomer"))}</span></div>${customer.phone ? `<div class="meta-row"><span>${escapeHtml(t("common.phone"))}</span><span>${escapeHtml(customer.phone)}</span></div>` : ""}<div class="meta-row"><span>${escapeHtml(t("common.date"))}</span><span>${escapeHtml(sale.created_at ? new Date(sale.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "")}</span></div></div><table><thead><tr><th>${escapeHtml(t("admin.pos.receipt.item"))}</th><th>${escapeHtml(t("admin.pos.receipt.quantityPrice"))}</th><th>${escapeHtml(t("admin.pos.receipt.total"))}</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.subtotal"))}</span><span>${formatMoney(sale.subtotal)}</span></div>${Number(sale.discount_amount) > 0 ? `<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.discount"))}</span><span>− ${formatMoney(sale.discount_amount)}</span></div>` : ""}<div class="summary-row"><span>${escapeHtml(t("admin.pos.receipt.tax"))}</span><span>${formatMoney(sale.tax_amount)}</span></div></div><div class="total"><span>${escapeHtml(t("admin.pos.receipt.total"))}</span><span>${formatMoney(sale.total)}</span></div><div class="payment"><span>${escapeHtml(t("admin.pos.receipt.payment"))} ? ${escapeHtml(paymentText)}</span><strong>${formatMoney(payment.amount_received)}</strong></div>${Number(payment.change_due) > 0 ? `<div class="payment"><span>${escapeHtml(t("admin.pos.receipt.change"))}</span><strong>${formatMoney(payment.change_due)}</strong></div>` : ""}<footer class="thanks">${escapeHtml(t("admin.pos.receipt.thankYou"))}</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receipt);
    printWindow.document.close();
  };
  const matchingCustomers = Array.isArray(customerResults.data) ? customerResults.data : [];

  return (
    <div dir={dir} className="admin-pos-workspace flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-secondary)] px-0 py-0 text-[var(--text-primary)]">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-card)] px-3 sm:px-4">
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto whitespace-nowrap py-2" aria-label={t("admin.pos.ui.posSections")}>
          {[["pos", ShoppingCart, t("admin.pos.ui.pos")], ["history", History, t("admin.pos.ui.saleHistoryTab")], ["returns", RotateCcw, t("admin.pos.ui.returnTab")], ["hold", Bookmark, `${t("admin.pos.ui.holdTab")}${heldCarts.length ? ` (${heldCarts.length})` : ""}`]].map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => {
    if (editingSaleId && key !== "pos") {
                toast.error(t("admin.pos.toast.saveOrCancelEditBeforeLeaving"));
                return;
              }
              setActiveView(key);
            }} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeView === key ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"}`}>
              <Icon size={15} />{key === "hold" ? <>{t("admin.pos.ui.holdTab")}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeView === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>{heldCarts.length}</span></> : label}
            </button>
          ))}
        </nav>
        <div className="hidden h-9 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 text-[11px] text-[var(--text-muted)] sm:flex">
          <span className="font-medium text-[var(--text-secondary)]">{t("admin.pos.ui.today")}</span>
          <span className="font-semibold text-[var(--text-primary)]">{salesOverviewQuery.isLoading ? "…" : formatMoney(salesOverviewQuery.data?.todayRevenue)}</span>
          <span aria-hidden="true">·</span>
          <span>{salesOverviewQuery.isLoading ? "…" : (salesOverviewQuery.data?.todayCount || 0).toLocaleString(locale)} {salesOverviewQuery.data?.todayCount === 1 ? t("admin.pos.ui.sale") : t("admin.pos.ui.sales")}</span>
        </div>
      </header>
      <div dir="ltr" className="grid min-h-0 flex-1 grid-cols-1 items-stretch overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
        <section dir={dir} className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden bg-transparent py-2 pe-0 lg:overscroll-contain lg:pe-3">
          {activeView === "pos" ? <>
          <div className="relative z-20 mb-3 flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="relative min-w-28 flex-1">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t("admin.pos.ui.searchProductsSKUOrName")}
                aria-label={t("admin.pos.ui.searchProductsByNameOrSKU")}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const scanned = search.trim().toLowerCase();
                  const match = variantCards.find(({ variant }) => String(variant.sku || "").trim().toLowerCase() === scanned);
                  if (!match) return;
                  event.preventDefault();
                  addToCart(match.product, match.variant);
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-lg border-0 bg-[#F3F4F6] ps-9 pe-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-blue-500/20 dark:bg-slate-900 sm:text-sm"
              />
            </div>
            <PosDropdown
              value={selectedSort}
              options={[
                { value: "recent", label: t("admin.pos.sort.featured") },
                { value: "name", label: t("admin.pos.sort.name") },
                { value: "price_asc", label: t("admin.pos.sort.priceLowToHigh") },
                { value: "price_desc", label: t("admin.pos.sort.priceHighToLow") },
              ]}
              onChange={(value) => { setSelectedSort(value); setCurrentPage(1); }}
              ariaLabel={t("admin.pos.ui.sortProducts")}
              prefix={`${t("admin.pos.ui.sortPrefix")} `}
              className="w-36 shrink-0 sm:w-40"
              buttonClassName="h-9 justify-between rounded-lg border-0 bg-transparent px-2 text-[11px] font-medium shadow-none hover:bg-[var(--bg-tertiary)]"
              menuClassName="w-48"
            />
            <div ref={filtersPanelRef} className="relative flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-label={t("admin.pos.ui.productFilters")} aria-expanded={filtersOpen} className={`flex h-9 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${selectedCategory || selectedBrand || selectedStock ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`}><SlidersHorizontal size={14}/><span>{t("admin.pos.ui.filter")}</span></button>
              {filtersOpen && <div className="absolute end-0 top-full z-30 mt-2 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-xl">
                <div className="mb-2 text-xs font-bold text-[var(--text-primary)]">{t("admin.pos.ui.productFilters")}</div>
                <PosDropdown fieldLabel={t("admin.pos.ui.category")} value={selectedCategory} options={[{ value: "", label: t("admin.pos.ui.allCategories") }, ...categoryOptions.map((category) => ({ value: category, label: category }))]} onChange={selectCategory} ariaLabel={t("admin.pos.ui.filterByCategory")} className="mb-2" buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                <PosDropdown fieldLabel={t("admin.pos.ui.brand")} value={selectedBrand} options={[{ value: "", label: t("admin.pos.ui.allBrands") }, ...brandOptions.map((brand) => ({ value: brand, label: brand }))]} onChange={(value) => { setSelectedBrand(value); setCurrentPage(1); }} ariaLabel={t("admin.pos.ui.filterByBrand")} className="mb-2" buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                <PosDropdown fieldLabel={t("admin.pos.ui.stock")} value={selectedStock} options={[{ value: "", label: t("admin.pos.ui.anyStock") }, { value: "in_stock", label: t("admin.pos.ui.inStock") }, { value: "low_stock", label: t("admin.pos.ui.lowStock") }, { value: "out_of_stock", label: t("admin.pos.ui.outOfStock") }]} onChange={(value) => { setSelectedStock(value); setCurrentPage(1); }} ariaLabel={t("admin.pos.ui.filterByStock")} buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                {(selectedCategory || selectedBrand || selectedStock || selectedSort !== "recent") && <button type="button" onClick={() => { setSelectedCategory(""); setSelectedBrand(""); setSelectedStock(""); setSelectedSort("recent"); setCurrentPage(1); }} className="mt-3 w-full rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">{t("admin.pos.ui.clearAllFilters")}</button>}
              </div>}
            </div>
          </div>

          {productsError ? (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-5 text-center text-sm text-[var(--danger-text)]">
              {t("admin.pos.ui.couldNotLoadProductsPleaseTryAgain")}
            </div>
          ) : productsLoading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="animate-pulse rounded-xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-[var(--bg-card)]"><div className="aspect-square rounded-lg bg-[var(--bg-tertiary)]"/><div className="mt-2 h-3 w-3/4 rounded bg-[var(--bg-tertiary)]"/><div className="mt-2 h-3 w-1/2 rounded bg-[var(--bg-tertiary)]"/></div>
              ))}
            </div>
          ) : variantCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] p-8 text-center text-sm text-[var(--text-muted)]">
              {t("admin.pos.ui.noProductVariantsFoundForTheseSearchAndFilterSettings")}
            </div>
          ) : (
            <div className={viewMode === "list" ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]"}>
              {variantCards.map(({ product, variant }) => {
                const image = getProductImage({ ...product, variants: [variant] });
                const variantName = variant.title && variant.title !== "Default" ? variant.title : variantLabel(variant, t);
                const stockQuantity = Math.max(0, Number(variant.quantity) || 0);
                const inStock = stockQuantity > 0;
                const heldQuantity = heldCarts.reduce((total, held) => total + (held.cart || []).reduce(
                  (heldTotal, item) => heldTotal + (item.variant_id === variant._id ? Number(item.quantity) || 0 : 0),
                  0,
                ), 0);

                return (
                  <article key={variant._id} role={inStock ? "button" : undefined} tabIndex={inStock ? 0 : undefined} aria-disabled={!inStock} aria-label={t("admin.pos.ui.addProductToCart", { product: productNameOf(product), variant: variantName })} onClick={() => { if (inStock) addToCart(product, variant); }} onKeyDown={(event) => { if (inStock && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); addToCart(product, variant); } }} className={`${viewMode === "list" ? "grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 p-2 sm:p-2.5" : "flex flex-col overflow-hidden"} group min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-sm transition dark:border-slate-700 dark:bg-[var(--bg-card)] ${inStock ? "cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" : "cursor-not-allowed opacity-60"}`}>
                  <div className={`relative ${viewMode === "list" ? "aspect-square rounded-lg" : "aspect-square rounded-t-xl rounded-b-none"} w-full shrink-0 overflow-hidden bg-slate-100`}>
                      <FallbackImage nextImage src={image} alt={`${productNameOf(product)} ${variantName}`} fill unoptimized sizes="(max-width: 640px) 44vw, (max-width: 1280px) 22vw, 16vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                      <span className={`absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${!inStock ? "bg-rose-50/95 text-rose-700" : stockQuantity < 10 ? "bg-amber-50/95 text-amber-700" : "bg-emerald-50/95 text-emerald-700"}`}>
                        {inStock && <Check size={11} strokeWidth={3} />}{!inStock ? t("admin.pos.ui.outOfStock") : stockQuantity < 10 ? t("admin.pos.ui.lowStock") : t("admin.pos.ui.inStock")}
                      </span>
                      {heldQuantity > 0 && <span className="absolute bottom-2 start-2 inline-flex items-center rounded-full bg-amber-50/95 px-2 py-1 text-[9px] font-bold text-amber-800">{t("admin.pos.ui.onHold")} {heldQuantity}</span>}
                      {inStock && <span aria-hidden="true" title={t("admin.pos.ui.addToCart")} className="absolute bottom-2 end-2 flex h-7 w-7 scale-95 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 transition group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"><Plus size={15} strokeWidth={2.5}/></span>}
                    </div>
                    <div className={`min-w-0 ${viewMode === "list" ? "" : "p-2 pt-1.5 sm:p-2.5 sm:pt-1.5"}`}>
                    <h3 className="line-clamp-2 min-h-9 text-[13px] font-medium leading-[18px] text-[var(--text-primary)]" title={productNameOf(product)}>{productNameOf(product)}</h3>
                    <p className="mt-1 flex h-4 items-center gap-1.5 truncate text-[11px] text-[var(--text-muted)]"><Tag size={12} fill="currentColor" /> {t("admin.pos.ui.sku")} {variant.sku || "—"}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{formatMoney(variant.selling_price)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3" aria-label={t("admin.pos.ui.productPages")}>
              <span className="text-xs text-[var(--text-muted)]">{t("admin.pos.ui.page")} {currentPage} {t("admin.pos.ui.of")} {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                >
                  {t("admin.pos.ui.previous")}
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                >
                  {t("admin.pos.ui.next")}
                </button>
              </div>
            </nav>
          )}
          </> : activeView === "history" ? <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-sm dark:border-slate-700 dark:bg-[var(--bg-card)]"><ClipboardList size={18}/></span>
                <div><h2 className="text-base font-bold leading-5 text-slate-900 dark:text-slate-100">{t("admin.pos.ui.salesHistory")}</h2><p className="mt-1 text-xs leading-4 text-slate-500">{t("admin.pos.ui.reviewCompletedPOSTransactionsAndPaymentDetails")}</p></div>
              </div>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_155px_155px_auto]">
              <label className="relative min-w-0"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder={t("admin.pos.ui.searchSaleCustomerOrPhone")} aria-label={t("admin.pos.ui.searchPOSSales")} className="h-10 w-full rounded-xl border border-slate-200 bg-white ps-9 pe-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"/></label>
              <PosDropdown value={historyPayment} options={[{ value: "all", label: `${t("admin.pos.ui.paymentPrefix")}: ${t("common.all")}` }, { value: "cash", label: `${t("admin.pos.ui.paymentPrefix")}: ${t("admin.pos.payment.cash")}` }, { value: "card", label: `${t("admin.pos.ui.paymentPrefix")}: ${t("admin.pos.payment.card")}` }, { value: "bank_transfer", label: `${t("admin.pos.ui.paymentPrefix")}: ${t("admin.pos.payment.bankTransfer")}` }]} onChange={(value) => { setHistoryPayment(value); setHistoryPage(1); }} ariaLabel={t("admin.pos.ui.filterSalesByPaymentMethod")} buttonClassName="h-10 shadow-sm" />
              <PosDropdown value={historyRange} options={[{ value: "all", label: `${t("admin.pos.ui.timePrefix")}: ${t("common.all")}` }, { value: "today", label: `${t("admin.pos.ui.timePrefix")}: ${t("admin.pos.ui.today")}` }, { value: "7days", label: `${t("admin.pos.ui.timePrefix")}: ${t("admin.pos.ui.last7Days")}` }, { value: "30days", label: `${t("admin.pos.ui.timePrefix")}: ${t("admin.pos.ui.last30Days")}` }]} onChange={(value) => { setHistoryRange(value); setHistoryPage(1); }} ariaLabel={t("admin.pos.ui.filterSalesByDate")} buttonClassName="h-10 shadow-sm" />
              <button type="button" onClick={() => { setHistorySearch(""); setHistoryPayment("all"); setHistoryRange("all"); setHistoryPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{t("admin.pos.ui.resetFilters")}</button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-start">
                <thead className="border-b border-slate-200 bg-white text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:bg-[var(--bg-card)]">
                  <tr>{["sale", "customer", "date", "payment", "items", "total", ""].map((label) => <th key={label} className={`px-4 py-3.5 text-start font-semibold ${label === "sale" ? "ps-12" : ""}`}>{label ? t(`admin.pos.ui.historyTable.${label}`) : ""}</th>)}</tr>
                </thead>
                <tbody>
                  {historyQuery.isLoading ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-500">{t("admin.pos.ui.loadingSalesHistory")}</td></tr>
                    : historyQuery.isError ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-rose-600">{t("admin.pos.ui.couldNotLoadSalesHistoryPleaseRetry")}</td></tr>
                      : visibleHistorySales.length ? visibleHistorySales.map((sale) => {
                        const payment = paymentLabel(sale.payment?.method, t);
                        const saleItems = sale.items || [];
                        const previewItems = saleItems.slice(0, 4);
                        const quantity = saleItems.reduce((count, item) => count + (Number(item.quantity) || 0), 0);
                        const saleDate = sale.created_at ? new Date(sale.created_at) : null;
                        const editHistory = Array.isArray(sale.edit_history) ? sale.edit_history : [];
                        const latestEdit = editHistory[editHistory.length - 1] || null;
                        const latestEditDate = latestEdit?.edited_at ? new Date(latestEdit.edited_at) : null;
                        const isExpanded = expandedSaleId === sale._id;
                        return <Fragment key={sale._id}><tr className={`border-b border-slate-200 bg-white text-xs transition-colors dark:bg-[var(--bg-card)] ${isExpanded ? "!bg-blue-50/40 dark:!bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                          <td className="px-4 py-4"><div className="flex items-center gap-2"><button type="button" aria-label={t(`admin.pos.ui.${isExpanded ? "hide" : "show"}SaleDetails`, { sale: sale.sale_number || t("common.notProvided") })} aria-expanded={isExpanded} onClick={() => setExpandedSaleId(isExpanded ? null : sale._id)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${isExpanded ? "border-blue-200 bg-blue-100 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"}`}><ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}/></button><div className="min-w-0"><Link href={`/admin/pos/history/${sale._id}`} className="font-mono text-xs font-semibold text-blue-700 hover:text-blue-800">{sale.sale_number || t("common.notProvided")}</Link>{latestEdit ? <><span className="mt-1 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">{t("admin.pos.ui.saleEdited")}</span><span className="mt-1 block max-w-48 truncate text-[10px] text-slate-500" title={t("admin.pos.ui.saleEditedBy", { name: latestEdit.edited_by_name || t("admin.pos.ui.unknownStaff"), time: latestEditDate && !Number.isNaN(latestEditDate.getTime()) ? latestEditDate.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "" })}>{t("admin.pos.ui.saleEditedBy", { name: latestEdit.edited_by_name || t("admin.pos.ui.unknownStaff"), time: latestEditDate && !Number.isNaN(latestEditDate.getTime()) ? latestEditDate.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : "" })}</span></> : <span className="mt-1 block text-[10px] text-slate-500">{t("admin.pos.ui.posTransaction")}</span>}</div></div></td>
                          <td className="px-4 py-4"><span className="block max-w-[180px] truncate text-[13px] font-medium text-slate-800">{sale.customer_snapshot?.name || t("admin.pos.ui.walkInCustomer")}</span>{sale.customer_snapshot?.phone && <span className="mt-1 block text-[11px] text-slate-500">{sale.customer_snapshot.phone}</span>}</td>
                          <td className="whitespace-nowrap px-4 py-4"><span className="block font-medium text-slate-700">{saleDate ? saleDate.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—"}</span><span className="mt-1 block text-[11px] text-slate-500">{saleDate ? saleDate.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }) : ""}</span></td>
                          <td className="px-4 py-4"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-700">{payment}</span></td>
                          <td className="px-4 py-4"><span className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-700">{quantity}</span></td>
                          <td className="whitespace-nowrap px-4 py-4 text-start text-[13px] font-semibold tabular-nums text-slate-900">{formatMoney(sale.total)}</td>
                          <td className="px-4 py-4 text-start"><SaleActionsMenu sale={sale} direction={dir} onEdit={editHistorySale} onPrint={printHistoryReceipt} /></td>
                        </tr>{isExpanded && <tr className="border-b border-slate-100 bg-slate-50/70"><td colSpan={7} className="px-4 py-3 sm:px-12"><div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,1fr)]"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.itemsInSaleCount", { count: quantity })}</p><div className="space-y-1.5">{previewItems.map((item, index) => { const image = getProductImage({ variants: [{ images: item.product_image ? [{ img_url: item.product_image }] : [] }] }); return <div key={`${item.variant_id || item.sku || item.product_name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5"><div className="flex min-w-0 items-center gap-2.5"><span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">{image ? <FallbackImage nextImage src={image} alt={productNameOf(item) || t("admin.pos.ui.product")} fill unoptimized sizes="36px" className="object-cover"/> : <ShoppingCart size={14} className="absolute inset-0 m-auto text-slate-400"/>}</span><span className="min-w-0 truncate text-xs font-medium text-slate-700">{productNameOf(item) || t("admin.pos.ui.product")}{item.variant_title ? <span className="font-normal text-slate-400"> · {item.variant_title}</span> : null}</span></div><span className="shrink-0 text-[11px] text-slate-500">× {item.quantity}</span></div>; })}{!saleItems.length && <p className="text-xs text-slate-500">{t("admin.pos.ui.noItemDetailsRecorded")}</p>}{saleItems.length > 4 && <Link href={`/admin/pos/history/${sale._id}`} className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-blue-700 hover:text-blue-800">{t("admin.pos.ui.showMoreItems", { count: saleItems.length - 4 })}<ArrowUpRight size={13}/></Link>}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t("admin.pos.ui.paymentSummary")}</p><div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3 text-xs"><div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.subtotal")}</span><span className="font-medium text-slate-700">{formatMoney(sale.subtotal)}</span></div>{Number(sale.discount_amount) > 0 && <div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.discount")}</span><span className="font-medium text-emerald-700">− {formatMoney(sale.discount_amount)}</span></div>}<div className="flex justify-between gap-3 text-slate-500"><span>{t("admin.pos.ui.tax")}</span><span className="font-medium text-slate-700">{formatMoney(sale.tax_amount)}</span></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-bold text-slate-900"><span>{t("admin.pos.ui.total")}</span><span>{formatMoney(sale.total)}</span></div>{sale.payment?.reference && <div className="flex justify-between gap-3 pt-1 text-slate-500"><span>{t("admin.pos.ui.reference")}</span><span className="max-w-[180px] truncate text-slate-700">{sale.payment.reference}</span></div>}</div>{sale.customer_snapshot?.phone && <p className="mt-2 text-[11px] text-slate-500">{t("admin.pos.ui.customerPhone")} <span className="font-medium text-slate-700">{sale.customer_snapshot.phone}</span></p>}</div></div></td></tr>}</Fragment>;
                      }) : <tr><td colSpan={7} className="px-4 py-14 text-center"><span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><History size={18}/></span><span className="block text-sm font-semibold text-slate-700">{t(historySearch || historyPayment !== "all" || historyRange !== "all" ? "admin.pos.ui.noSalesMatchFilters" : "admin.pos.ui.noSalesYet")}</span><span className="mt-1 block text-xs text-slate-500">{t(historySearch || historyPayment !== "all" || historyRange !== "all" ? "admin.pos.ui.tryAdjustingSearchOrFilters" : "admin.pos.ui.completedSalesWillAppearHere")}</span></td></tr>}
                </tbody>
              </table>
            </div>

            {historyPageCount > 1 && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500">
              <span>{t("admin.pos.ui.showing")} <strong className="font-semibold text-slate-700">{historySales.length ? (historyPage - 1) * HISTORY_PAGE_SIZE + 1 : 0}-{Math.min(historyPage * HISTORY_PAGE_SIZE, historySales.length)}</strong> {t("admin.pos.ui.of")} <strong className="font-semibold text-slate-700">{historySales.length}</strong> {t("admin.pos.ui.sales")}</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label={t("admin.pos.ui.previousSalesPage")} disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15}/></button>
                {Array.from({ length: historyPageCount }, (_, index) => index + 1).slice(Math.max(0, historyPage - 3), historyPage + 2).map((page) => <button key={page} type="button" aria-current={page === historyPage ? "page" : undefined} onClick={() => setHistoryPage(page)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${page === historyPage ? "bg-blue-600 text-white shadow-sm" : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"}`}>{page}</button>)}
                <button type="button" aria-label={t("admin.pos.ui.nextSalesPage")} disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage((page) => page + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15}/></button>
              </div>
            </div>}
          </div> : activeView === "returns" ?
            <PosReturnPanel sales={(historyQuery.data || []).filter((sale) => sale.status === "completed")} historySales={historyQuery.data || []} historyLoading={historyQuery.isLoading} historyError={historyQuery.isError} selectedSale={selectedReturnSale} returnSaleId={returnSaleId} setReturnSaleId={(id) => { setReturnSaleId(id); if (!id) setReturnQuantities({}); }} returnQuantities={returnQuantities} setReturnQuantities={setReturnQuantities} returnNote={returnNote} setReturnNote={setReturnNote} returnMutation={returnMutation} />
          : <div>
            <div className="mb-4"><h2 className="text-lg font-extrabold text-slate-900">{t("admin.pos.ui.heldSales")}</h2><p className="mt-1 text-xs text-slate-500">{t("admin.pos.ui.savedCartsStayAvailableInThisBrowserUntilResumedOrRemoved")}</p></div>
            {heldCarts.length ? <div className="space-y-2">{heldCarts.map((held) => <article key={held.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Bookmark size={17}/></span><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{held.customer?.name || t("admin.pos.ui.walkInCustomer")} · {held.cart.length} {t("admin.pos.ui.items")}</div>{held.editingSaleNumber && <div className="mt-0.5 text-[10px] font-semibold text-blue-700">{t("admin.pos.ui.editDraftFor")} {held.editingSaleNumber} {t("admin.pos.ui.originalSaleUnchanged")}</div>}<div className="mt-1 text-xs text-slate-500">{new Date(held.createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })} · {formatMoney(held.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))}</div></div></div><div className="flex gap-2"><button type="button" onClick={() => resumeHeldCart(held, new Date().toISOString())} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">{t("admin.pos.ui.resumeSale")}</button><button type="button" onClick={() => setHeldCarts((current) => current.filter((item) => item.id !== held.id))} aria-label={t("admin.pos.ui.deleteHeldSale")} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button></div></article>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">{t("admin.pos.ui.noHeldSalesYetUseHoldInTheCartToSaveASaleForLater")}</div>}
          </div>}
        </section>

        <form ref={saleFormRef} dir={dir} onSubmit={submitSale} className={`${cartDrawerOpen ? "fixed inset-0 z-[60] flex min-h-0 flex-col overflow-hidden sm:start-auto sm:w-[420px] lg:static lg:h-full lg:w-full" : "hidden lg:flex lg:h-full lg:w-full"} min-h-0 min-w-0 self-stretch overflow-hidden border-s border-[var(--border-color)] bg-white p-3 text-[var(--text-primary)] dark:bg-[var(--bg-card)] lg:flex-col lg:p-3`}>
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-medium text-[var(--text-primary)]">
              <ShoppingCart size={17} className="shrink-0 text-[var(--text-secondary)]" />
              <span>{t("admin.pos.ui.currentOrder")}</span>
              {itemCount > 0 && <span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{itemCount}</span>}
            </h2>
            <div className="flex items-center gap-2">
              {cart.length > 0 && !editingSaleId && <button type="button" onClick={() => { setCart([]); setDiscountAmount(""); setAdditionalTaxRate("0"); setRateEditorVariantId(null); }} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)]"><Trash2 size={13}/>{t("admin.pos.ui.clearAll")}</button>}
              <button type="button" onClick={() => setCartDrawerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] lg:hidden" aria-label={t("admin.pos.ui.closeCart")}><X size={18} /></button>
            </div>
          </div>

          {editingSaleId && <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent)]"><Pencil size={13}/><span className="truncate">{t("admin.pos.ui.editing")} {editingSaleNumber}</span></div>}

          <div className="relative mb-2 flex shrink-0 items-center gap-2" ref={customerBoxRef}>
            <button type="button" role="combobox" aria-controls="pos-customer-options" aria-expanded={customerOpen} aria-haspopup="listbox" onClick={() => { setCustomerOpen((open) => !open); setCustomerSearch(""); }} aria-label={t("admin.pos.ui.searchCustomerByNameOrPhone2")} className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[var(--bg-tertiary)] px-2.5 text-start text-xs text-[var(--text-primary)] transition hover:bg-[var(--bg-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Search size={14} className="shrink-0 text-[var(--text-muted)]" />
              <span className="min-w-0 flex-1 truncate font-medium">{selectedCustomer?.name || t("admin.pos.ui.walkInCustomer")}</span>
              <ChevronDown size={14} className={`shrink-0 text-[var(--text-muted)] transition-transform ${customerOpen ? "rotate-180" : ""}`} />
            </button>
            <button type="button" onClick={() => { setShowCustomerForm(true); setCustomerOpen(false); }} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-blue-600 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/40"><Plus size={13}/>{t("admin.pos.ui.addShort")}</button>
            {customerOpen && <div className="absolute start-0 end-0 top-full z-40 mt-2 overflow-hidden rounded-lg bg-[var(--bg-card)] shadow-lg ring-1 ring-black/10">
              <label className="relative block border-b border-[var(--border-color)] p-2"><Search size={14} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"/><input autoFocus value={customerSearch} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerOpen(true); }} placeholder={t("admin.pos.ui.searchCustomerByNameOrPhone")} aria-label={t("admin.pos.ui.searchCustomerByNameOrPhone2")} className="h-9 w-full rounded-md bg-[var(--bg-tertiary)] ps-8 pe-2 text-xs text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-blue-500/20"/></label>
              <div id="pos-customer-options" role="listbox" aria-label={t("admin.pos.ui.customers")} className="max-h-56 overflow-y-auto px-2 py-1">
                <button type="button" role="option" aria-selected={!selectedCustomer} onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); setCustomerOpen(false); }} className={`my-0.5 w-full rounded-xl border px-3 py-2.5 text-start text-xs transition-all duration-150 ${!selectedCustomer ? "border-[var(--accent)]/20 bg-[var(--accent-soft)]" : "border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-card-alt)]"}`}>
                  <span className="block font-bold">{t("admin.pos.ui.walkInCustomer")}</span><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">{t("admin.pos.ui.continueWithoutAssigningACustomer")}</span>
                </button>
                {customerResults.isFetching && !matchingCustomers.length && <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">{t("admin.pos.ui.loadingCustomers")}</p>}
                {matchingCustomers.map((customer) => <button key={customer._id} type="button" role="option" aria-selected={selectedCustomer?._id === customer._id} onClick={() => { setSelectedCustomer(customer); setCustomerSearch(""); setCustomerOpen(false); }} className={`my-0.5 w-full rounded-xl border px-3 py-2.5 text-start transition-all duration-150 ${selectedCustomer?._id === customer._id ? "border-[var(--accent)]/20 bg-[var(--accent-soft)]" : "border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-card-alt)]"}`}>
                  <span className="block truncate text-[13px] font-bold text-[var(--text-primary)]">{customer.name}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{[customer.phone, customer.email].filter(Boolean).join(" · ") || t("admin.pos.ui.noContactDetails")}</span>
                </button>)}
                {!customerResults.isFetching && !customerSearch.trim() && !matchingCustomers.length && <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">{t("admin.pos.ui.noSavedCustomersYet")}</p>}
                {!customerResults.isFetching && customerSearch.trim() && !matchingCustomers.length && <p className="px-3 py-5 text-center text-xs text-[var(--text-muted)]">{t("admin.pos.ui.noCustomersFound")}</p>}
              </div>
            </div>}
          </div>

          <CustomerFormModal open={showCustomerForm} form={customerForm} setForm={setCustomerForm} isPending={customerMutation.isPending} onSave={() => customerMutation.mutate()} onClose={() => setShowCustomerForm(false)} />

          {cart.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><ShoppingCart size={22} /></span>
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("admin.pos.ui.noItemsYetTapAProductToAdd")}</p>
            </div>
          ) : (
          <>
          <div className="mb-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
            {cart.map((item) => (
              <article key={item.variant_id} className="border-b border-[var(--border-color)] px-2.5 py-2 last:border-0 hover:bg-[var(--bg-row-hover)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-card-alt)]">
                    <FallbackImage nextImage src={item.image} alt={productNameOf(item) || item.product_name} fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{productNameOf(item) || item.product_name}</p>
                    <div className="flex min-w-0 items-center justify-between gap-1">
                    <p className="min-w-0 truncate text-[10px] text-[var(--text-secondary)]">{item.variant_title}{item.sku ? ` · ${item.sku}` : ""}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex h-6 items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
                        <button type="button" onClick={() => changeQuantity(item.variant_id, -1)} className="flex h-full w-6 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)]" aria-label={t("admin.pos.ui.decreaseQuantity")}><Minus size={12} /></button>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={quantityDrafts[item.variant_id] ?? String(item.quantity)} onChange={(event) => {
                          const value = event.target.value;
                          if (/^\d*$/.test(value)) setQuantityDrafts((current) => ({ ...current, [item.variant_id]: value }));
                        }} onBlur={() => commitQuantity(item.variant_id)} onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }} className="h-5 w-9 rounded px-0.5 text-center text-xs tabular-nums text-[var(--text-primary)] outline-none focus:bg-[var(--accent-soft)]" aria-label={t("admin.pos.ui.quantityForProduct", { product: productNameOf(item) })} title={t("admin.pos.ui.availableStock", { count: item.stock })} />
                        <button type="button" onClick={() => changeQuantity(item.variant_id, 1)} disabled={item.quantity >= item.stock} className="flex h-full w-6 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30" aria-label={t("admin.pos.ui.increaseQuantity")}><Plus size={12} /></button>
                      </div>
                    </div>
                    </div>
                  </div>
                  <div className="flex h-full shrink-0 flex-col items-end justify-between self-stretch">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{formatMoney(itemNetTotal(item))}</span>
                    <div className="flex items-center">
                    <button type="button" onClick={() => setRateEditorVariantId((current) => current === item.variant_id ? null : item.variant_id)} className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${rateEditorVariantId === item.variant_id || item.discount_rate > 0 || item.flat_discount > 0 || item.tax_rate > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`} aria-label={t("admin.pos.ui.openItemPriceSettings")} aria-expanded={rateEditorVariantId === item.variant_id} title={t("admin.pos.ui.itemPriceSettings")}><Settings2 size={15} /></button>
                    <button type="button" onClick={() => setCart((current) => current.filter((entry) => entry.variant_id !== item.variant_id))} className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger-text)]" aria-label={t("admin.pos.ui.removeProductFromCart", { product: productNameOf(item) })}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
                {rateEditorVariantId === item.variant_id && (
                  <div className="mt-2 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-2.5">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Settings2 size={12}/></span>{t("admin.pos.ui.adjustments")}<span className="ms-auto text-[9px] font-medium text-[var(--text-muted)]">{t("admin.pos.ui.discountBeforeTax")}</span></div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
                      <span className="col-span-2 mb-1 flex h-5 items-center text-[10px] font-semibold text-[var(--text-secondary)]">{t("admin.pos.ui.discount")}</span>
                      <span className="mb-1 flex h-5 items-center text-[10px] font-semibold text-[var(--text-secondary)]">{t("admin.pos.ui.tax")}</span>
                      <div role="group" aria-label={t("admin.pos.ui.discountTypeForProduct", { product: productNameOf(item) })} className="flex h-8 items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
                        {[['percentage', t("admin.pos.ui.percent")], ['flat', t("admin.pos.ui.flat")]].map(([type, label]) => <button key={type} type="button" aria-label={label} title={t("admin.pos.ui.discountTypeTitle", { type: label })} aria-pressed={getDiscountType(item) === type} onClick={() => setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? { ...entry, discount_type: type, discount_rate: type === "flat" ? 0 : entry.discount_rate, flat_discount: type === "percentage" ? 0 : entry.flat_discount } : entry))} className={`flex h-full min-w-0 ${type === "percentage" ? "flex-[1.35]" : "flex-1"} items-center justify-center gap-1 rounded-md px-1 text-[10px] font-semibold transition ${getDiscountType(item) === type ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`}>{type === "percentage" ? <><Percent size={14} strokeWidth={2.5} /><span>{t("admin.pos.ui.percent")}</span></> : label}</button>)}
                      </div>
                      <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
                        {getDiscountType(item) === "flat" && <span className="shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.pos.ui.rs")}</span>}
                        <input type="number" min="0" max={getDiscountType(item) === "flat" ? item.unit_price : 100} step="1" value={getDiscountType(item) === "flat" ? item.flat_discount || 0 : item.discount_rate || 0} onChange={(event) => {
                          const value = event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0);
                          setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? getDiscountType(item) === "flat" ? { ...entry, discount_type: "flat", discount_rate: 0, flat_discount: Math.min(entry.unit_price, value) } : { ...entry, discount_type: "percentage", discount_rate: Math.min(100, value), flat_discount: 0 } : entry));
                        }} className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-[var(--text-primary)] outline-none" aria-label={t("admin.pos.ui.productDiscountSetting", { setting: getDiscountType(item) === "flat" ? t("admin.pos.ui.flatDiscountPerUnit") : t("admin.pos.ui.discountPercentage"), product: productNameOf(item) })} />
                        <span className="shrink-0 text-[10px] font-medium text-[var(--text-muted)]">{getDiscountType(item) === "flat" ? t("admin.pos.ui.perUnit") : "%"}</span>
                      </div>
                      <label className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
                        <input type="number" min="0" max="100" step="1" value={item.tax_rate} onChange={(event) => {
                          const value = event.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(event.target.value) || 0));
                          setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? { ...entry, tax_rate: value } : entry));
                        }} className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-[var(--text-primary)] outline-none" aria-label={t("admin.pos.ui.taxPercentageForProduct", { product: productNameOf(item) })} /><span className="text-[10px] font-semibold text-[var(--text-muted)]">%</span>
                      </label>
                    </div>
                    {item.discount_type === "combined" && <p className="mt-1.5 text-[9px] leading-3 text-amber-700">{t("admin.pos.ui.chooseADiscountTypeToEditThisSavedSale")}</p>}
                  </div>
                )}
              </article>
            ))}
          </div>

          <section className="shrink-0 border-t border-[var(--border-color)] pt-2">
            <div className="space-y-0.5 text-xs">
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-[var(--text-secondary)]">{t("admin.pos.ui.subtotal")}</span>
              <span className="font-medium text-[var(--text-primary)]">{formatMoney(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                <span className="shrink-0 text-[var(--text-secondary)]">{t("admin.pos.ui.discount")}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={Math.round(subtotal - itemDiscount + tax)}
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  placeholder="0"
                    className="h-7 w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-end text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  aria-label={t("admin.pos.ui.additionalDiscountAmount")}
                />
                <span className="min-w-16 text-end font-medium">− {formatMoney(discount)}</span>
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
              <span className="shrink-0 text-[var(--text-secondary)]">{t("admin.pos.ui.tax2")}</span>
              <span className="flex items-center gap-2">
                <span className="relative block w-20">
                  <input type="number" min="0" max="100" step="0.01" value={additionalTaxRate} onChange={(event) => setAdditionalTaxRate(event.target.value)} placeholder="0" className="h-7 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 pe-6 text-end text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" aria-label={t("admin.pos.ui.tax2")} />
                  <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center text-[10px] text-[var(--text-muted)]">%</span>
                </span>
                <span className="min-w-16 text-end font-medium text-[var(--text-primary)]">{formatMoney(tax)}</span>
              </span>
            </label>
            <div className="flex items-center justify-between border-t border-[var(--border-color)] px-1 pt-2 text-lg font-bold text-[var(--text-primary)]">
              <span>{t("admin.pos.ui.total")}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            </div>
          </section>

          <fieldset className="mt-1 shrink-0">
            <legend className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.pos.ui.paymentMethod")}</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-tertiary)] p-1">
              {paymentMethods.map(({ value, Icon }) => <button key={value} type="button" aria-pressed={paymentMethod === value} onClick={() => { setPaymentMethod(value); if (!["card", "bank_transfer"].includes(value)) setPaymentReference(""); }} className={`flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${paymentMethod === value ? "bg-[var(--bg-card)] text-blue-600 shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}><Icon size={13}/><span className="truncate">{paymentLabel(value, t)}</span></button>)}
            </div>
          </fieldset>

          {["card", "bank_transfer"].includes(paymentMethod) && <label className="mt-2 block shrink-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.pos.ui.transactionID")} <span className="text-red-500">*</span></span>
            <input type="text" required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder={t("admin.pos.ui.enterTransactionID")} autoComplete="off" className="h-9 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100" />
          </label>}

          <div className="mt-1 shrink-0">
            <button type="button" aria-expanded={notesExpanded || Boolean(notes)} onClick={() => setNotesExpanded((open) => !open)} className="flex h-7 items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"><Plus size={13} className={`transition-transform ${notesExpanded || notes ? "rotate-45" : ""}`}/>{t("admin.pos.ui.addNote")}</button>
            {(notesExpanded || Boolean(notes)) && <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder={t("admin.pos.ui.addAnyNotesForThisSale")} className="mt-1 w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />}
          </div>

          <div className={`mt-2 grid shrink-0 gap-2 ${editingSaleId ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-[auto_auto_minmax(0,1fr)]"}`}>
          {editingSaleId ? <button type="button" onClick={cancelSaleEdit} className="flex h-12 items-center justify-center rounded-lg px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]">{t("admin.pos.ui.cancelEdit")}</button> : <>
          <button type="button" onClick={holdCart} disabled={!cart.length} className="flex h-12 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-45"><Bookmark size={14}/>{t("admin.pos.ui.hold")}</button>
          <button type="button" onClick={printReceipt} disabled={!cart.length} aria-label={t("admin.pos.ui.print")} title={t("admin.pos.ui.print")} className="flex h-12 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-45"><Printer size={15}/></button>
          </>}
          <button
            type="submit"
            disabled={saleMutation.isPending || cart.length === 0}
            className="flex h-12 w-full min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2 text-xs font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            id="pos-complete-sale"
          >
            <CreditCard size={15} />
            {saleMutation.isPending ? (editingSaleId ? t("admin.pos.ui.savingChanges") : t("admin.pos.ui.processingSale")) : (editingSaleId ? t("common.saveChanges") : <>{t("admin.pos.ui.completeSale")} · {formatMoney(total)}</>)}
          </button>
          </div>
          </>
          )}
        </form>
        {cartDrawerOpen && <button type="button" aria-label={t("admin.pos.ui.closeCart")} onClick={() => setCartDrawerOpen(false)} className="fixed inset-x-0 top-0 bottom-0 z-[55] bg-slate-950/35 backdrop-blur-[1px] lg:hidden" />}
        <button type="button" onClick={() => setCartDrawerOpen(true)} className="fixed bottom-4 end-4 z-50 flex h-12 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-bold text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-700 lg:hidden" aria-label={t("admin.pos.ui.openCartSummary", { count: itemCount, total: formatMoney(total) })}>
          <ShoppingCart size={18} />
          <span>{t("admin.pos.ui.cart2")}{itemCount > 0 ? ` · ${itemCount}` : ""}</span>
          <span className="border-s border-white/30 ps-2 tabular-nums">{formatMoney(total)}</span>
        </button>
      </div>
    </div>
  );
}
