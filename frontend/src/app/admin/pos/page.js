"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Bookmark,
  ClipboardList,
  History,
  RotateCcw,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Minus,
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
import { customerApi } from "@/apis/admin/customerApi";
import { storeApi } from "@/apis/admin/storeApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import { posApi } from "@/apis/admin/posApi";
import PosReturnPanel from "./PosReturnPanel";
import PosReturnHistoryPanel from "./PosReturnHistoryPanel";
import { getProductImage } from "@/utils/homeCatalog";

const PAGE_SIZE = 30;
const HISTORY_PAGE_SIZE = 10;
const money = (value) => `Rs. ${(Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  { value: "cash", label: "Cash", Icon: Wallet },
  { value: "card", label: "Card", Icon: CreditCard },
  { value: "bank_transfer", label: "Bank Transfer", Icon: Banknote },
];

const variantLabel = (variant) => {
  const attributes = Object.entries(variant?.attributes || {}).filter(([, value]) => (
    value !== null && value !== undefined && String(value).trim() !== ""
  ));
  const size = attributes.find(([name]) => /size/i.test(name));
  const value = size?.[1];
  if (Array.isArray(value)) return value.join(", ");
  return value ? String(value) : variant?.title || "Default";
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
        className={`flex w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-left text-xs font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-blue-300 hover:bg-[var(--bg-card-alt)] focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${buttonClassName}`}
      >
        {SelectedIcon && <SelectedIcon size={15} className="shrink-0 text-slate-500" />}
        <span className="min-w-0 flex-1 truncate">{prefix}{selectedOption?.label || "Select an option"}</span>
        <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={`absolute ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"} left-0 z-[70] min-w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5 ${menuClassName}`}>
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
                  className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${isSelected ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-alt)] hover:text-[var(--text-primary)]"}`}
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

export default function PosPage() {
  const queryClient = useQueryClient();
  const searchInputRef = useRef(null);
  const customerBoxRef = useRef(null);
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
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [rateEditorVariantId, setRateEditorVariantId] = useState(null);
  const [activeView, setActiveView] = useState("pos");
  const [viewMode, setViewMode] = useState("grid");
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
    enabled: activeView === "history" || activeView === "returns" || activeView === "return-history",
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
    if (editingSaleId) { toast.error("An edited history sale cannot be placed on Hold. Save or cancel the edit."); return; }
    if (!cart.length) { toast.error("Add items before holding this sale."); return; }
    setHeldCarts((current) => [{ id: `${Date.now()}`, createdAt: new Date().toISOString(), cart, customer: selectedCustomer, paymentMethod, paymentReference, discountAmount, notes, editingSaleId, editingSaleNumber, editingOriginalQuantities }, ...current]);
    setCart([]); setSelectedCustomer(null); setDiscountAmount(""); setNotes("");
    setPaymentReference("");
    setEditingSaleId(null); setEditingSaleNumber(""); setEditingOriginalQuantities({});
    toast.success("Sale held. You can resume it from Hold.");
  };
  const resumeHeldCart = (held, restoredAt) => {
    const currentDraft = cart.length ? {
      id: `current-${held.id}`, createdAt: restoredAt, cart,
      customer: selectedCustomer, paymentMethod, paymentReference, discountAmount, notes,
      editingSaleId, editingSaleNumber, editingOriginalQuantities,
    } : null;
    setCart(held.cart || []); setSelectedCustomer(held.customer || null); setPaymentMethod(held.paymentMethod || "cash");
    setPaymentReference(held.paymentReference || "");
    setDiscountAmount(held.discountAmount || ""); setNotes(held.notes || "");
    setEditingSaleId(held.editingSaleId || null); setEditingSaleNumber(held.editingSaleNumber || ""); setEditingOriginalQuantities(held.editingOriginalQuantities || {});
    setHeldCarts((current) => [...(currentDraft ? [currentDraft] : []), ...current.filter((item) => item.id !== held.id)]); setActiveView("pos");
    toast.success(currentDraft ? "Held sale restored. Your previous cart was saved to Hold." : "Held sale restored to cart.");
  };
  const editHistorySale = (sale) => {
    if (cart.length) {
      toast.error("Save or cancel the current cart before editing a history sale.");
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
      product_name: item.product_name || "Product",
      variant_title: item.variant_title || "Default",
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
    setNotes(sale.notes || "");
    setEditingSaleId(sale._id);
    setEditingSaleNumber(sale.sale_number || "");
    setEditingOriginalQuantities(originalQuantities);
    setRateEditorVariantId(null);
    setActiveView("pos");
    toast.success(`Editing ${sale.sale_number || "POS sale"}. Save Sale will update the original history record.`);
  };
  const cancelSaleEdit = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountAmount("");
    setNotes("");
    setPaymentReference("");
    setEditingSaleId(null);
    setEditingSaleNumber("");
    setEditingOriginalQuantities({});
    toast.info("Sale edit cancelled. The saved history record is unchanged.");
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
  const tax = useMemo(
    () => cart.reduce((sum, item) => sum + itemNetTotal(item) * item.tax_rate / 100, 0),
    [cart],
  );
  const taxableSubtotal = cart.reduce((sum, item) => sum + itemNetTotal(item), 0);
  const effectiveTaxRate = taxableSubtotal > 0 ? (tax / taxableSubtotal) * 100 : 0;
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
      toast.error("This product variant cannot be added to the sale.");
      return;
    }
    const quantityToAdd = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
    const stock = Number(variant.quantity) || 0;
    const saleCredit = Number(editingOriginalQuantities[variant._id]) || 0;
    const availableStock = stock + saleCredit;
    if (availableStock < 1) {
      toast.error("This variant is out of stock.");
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.variant_id === variant._id);
      const currentQuantity = existing?.quantity || 0;
      if (currentQuantity + quantityToAdd > (existing?.stock || availableStock)) {
        toast.error(`Only ${Math.max((existing?.stock || availableStock) - currentQuantity, 0)} more available for this variant.`);
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
      toast.success("Customer added to this sale.");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not create customer."),
  });

  const saleMutation = useMutation({
    mutationFn: () => {
      const saleData = {
        customer_id: selectedCustomer?._id || null,
        customer_name: selectedCustomer?.name || "Walk-in Customer",
        customer_phone: selectedCustomer?.phone || "",
        customer_email: selectedCustomer?.email || "",
        customer_address: selectedCustomer?.address || "",
        payment_method: paymentMethod,
        reference: paymentReference,
        amount_received: total,
        discount_amount: overallDiscount,
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
      toast.success(editingSaleId ? `${editingSaleNumber || "POS sale"} updated.` : "POS sale created.");
      setCart([]);
      setSelectedCustomer(null);
      setDiscountAmount("");
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
    onError: (error) => toast.error(error?.response?.data?.message || (editingSaleId ? "Could not update sale." : "Could not create sale.")),
  });

  const returnMutation = useMutation({
    mutationFn: () => {
      const sale = (historyQuery.data || []).find((item) => item._id === returnSaleId);
      if (!sale) throw new Error("Choose a sale first");
      if (!returnNote.trim()) throw new Error("Add a reason before confirming this return");
      const items = (sale.items || []).map((item) => ({ variant_id: String(item.variant_id?._id || item.variant_id), quantity: Number(returnQuantities[String(item.variant_id?._id || item.variant_id)] || 0) })).filter((item) => item.quantity > 0);
      return posApi.returnSale(returnSaleId, { items, note: returnNote.trim() });
    },
    onSuccess: (result) => {
      toast.success(`Return recorded · ${money(result?.data?.refund_total || 0)} refund`);
      setReturnQuantities({}); setReturnSaleId(""); setReturnNote("");
      queryClient.invalidateQueries({ queryKey: ["pos-sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["pos-sales-overview"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || error.message || "Could not process return."),
  });

  const submitSale = (event) => {
    event.preventDefault();
    if (!cart.length) {
      toast.error("Add at least one item to the cart.");
      return;
    }
    if (["card", "bank_transfer"].includes(paymentMethod) && !paymentReference.trim()) {
      toast.error("Transaction ID is required for card or bank payments.");
      return;
    }
    saleMutation.mutate();
  };

  const printReceipt = () => {
    if (!cart.length) { toast.error("Add items before printing a receipt."); return; }
    const printWindow = window.open("", "_blank", "width=420,height=720");
    if (!printWindow) { toast.error("Allow pop-ups to print this receipt."); return; }

    const storeName = storeInfo.store_name || "Our Store";
    const storeAddress = [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", ");
    const storePhone = storeInfo.phone || storeInfo.support_phone;
    const storeEmail = storeInfo.email || storeInfo.support_email;
    const receiptDate = new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
    const rows = cart.map((item) => {
      const gross = itemGrossTotal(item);
      const percentageDiscount = gross * (Number(item.discount_rate) || 0) / 100;
      const flatDiscount = Math.min(gross - percentageDiscount, (Number(item.flat_discount) || 0) * item.quantity);
      const discountDetails = [
        Number(item.discount_rate) > 0 ? `Discount ${Number(item.discount_rate)}%: - ${money(percentageDiscount)}` : "",
        Number(item.flat_discount) > 0 ? `Flat discount ${money(item.flat_discount)}/unit: - ${money(flatDiscount)}` : "",
      ].filter(Boolean).join(" | ");
      const variantDetails = [item.variant_title, item.sku].filter(Boolean).join(" | ");
      return `<tr><td><strong>${escapeHtml(item.product_name)}</strong>${variantDetails ? `<small>${escapeHtml(variantDetails)}</small>` : ""}${discountDetails ? `<small class="discount">${escapeHtml(discountDetails)}</small>` : ""}</td><td class="qty">${item.quantity} x ${money(item.unit_price)}</td><td class="amount">${money(itemNetTotal(item))}</td></tr>`;
    }).join("");
    const discountRows = [
      itemDiscount > 0 ? `<div class="summary-row"><span>Item discounts</span><span>- ${money(itemDiscount)}</span></div>` : "",
      overallDiscount > 0 ? `<div class="summary-row"><span>Sale discount</span><span>- ${money(overallDiscount)}</span></div>` : "",
    ].join("");
    const contact = [storeAddress, storePhone, storeEmail].filter(Boolean).map(escapeHtml).join(" | ");
    const notesMarkup = notes.trim() ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(notes.trim())}</div>` : "";
    const paymentLabel = paymentMethod.replaceAll("_", " ");

    const receiptDocument = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(storeName)} Receipt</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:370px;margin:0 auto;padding:20px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;background:#fff}
      header{text-align:center;padding-bottom:10px;border-bottom:1px solid #bbb}.store-name{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#444;font-size:10px;overflow-wrap:anywhere}.receipt-title{margin:12px 0 8px;text-align:center;font-size:10px;font-weight:700;letter-spacing:1px}
      .meta{padding:8px 0;border-top:1px dashed #999;border-bottom:1px dashed #999}.meta-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.meta-row span:first-child{color:#555}.meta-row span:last-child{text-align:right;font-weight:600}
      table{width:100%;margin-top:9px;border-collapse:collapse;table-layout:fixed}th{padding:6px 2px;border-bottom:1px solid #999;text-align:left;font-size:10px}th:first-child{width:45%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:25%;text-align:right}td{padding:8px 2px;border-bottom:1px solid #ddd;vertical-align:top;font-size:11px;overflow-wrap:anywhere}.qty{text-align:center;white-space:nowrap;color:#444}td.amount{text-align:right;white-space:nowrap}small{display:block;margin-top:3px;color:#555;font-size:10px}.discount{color:#333}
      .summary{margin-top:8px;padding-top:6px;border-top:1px dashed #999}.summary-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;font-size:11px}.summary-row span:last-child{white-space:nowrap}.total{display:flex;justify-content:space-between;margin-top:7px;padding:9px 0;border-top:1px solid #333;border-bottom:1px solid #333;font-size:15px;font-weight:700}.payment{display:flex;justify-content:space-between;margin-top:8px;font-size:11px}.notes{margin-top:8px;font-size:11px;overflow-wrap:anywhere}.thanks{margin-top:14px;text-align:center;color:#555;font-size:10px}
      @page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment,.notes{break-inside:avoid}}
    </style></head><body><header><h1 class="store-name">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header>
      <div class="receipt-title">SALES RECEIPT</div><div class="meta"><div class="meta-row"><span>Customer</span><span>${escapeHtml(selectedCustomer?.name || "Walk-in Customer")}</span></div>${selectedCustomer?.phone ? `<div class="meta-row"><span>Phone</span><span>${escapeHtml(selectedCustomer.phone)}</span></div>` : ""}<div class="meta-row"><span>Date</span><span>${escapeHtml(receiptDate)}</span></div></div>
      <table><thead><tr><th>Item</th><th>Qty x Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>${discountRows}<div class="summary-row"><span>Tax</span><span>${money(tax)}</span></div></div><div class="total"><span>Total</span><span>${money(total)}</span></div><div class="payment"><span>Payment</span><strong>${escapeHtml(paymentLabel)}</strong></div>${notesMarkup}<footer class="thanks">Thank you for your purchase</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receiptDocument);
    printWindow.document.close();
  };

  const printHistoryReceipt = (sale) => {
    const printWindow = window.open("", "_blank", "width=460,height=760");
    if (!printWindow) { toast.error("Allow pop-ups to print this receipt."); return; }
    const storeName = storeInfo.store_name || "Our Store";
    const contact = [
      [storeInfo.address, storeInfo.city, storeInfo.state, storeInfo.zip_code].filter(Boolean).join(", "),
      storeInfo.phone || storeInfo.support_phone,
      storeInfo.email || storeInfo.support_email,
    ].filter(Boolean).map(escapeHtml).join(" · ");
    const customer = sale.customer_snapshot || {};
    const payment = sale.payment || {};
    const rows = (sale.items || []).map((item) => {
      const variant = [item.variant_title, item.sku].filter(Boolean).join(" · ");
      return `<tr><td><strong>${escapeHtml(item.product_name || "Product")}</strong>${variant ? `<small>${escapeHtml(variant)}</small>` : ""}</td><td>${Number(item.quantity) || 0} × ${money(item.unit_price)}</td><td>${money(item.line_total)}</td></tr>`;
    }).join("");
    const receipt = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(sale.sale_number || "Sales Receipt")}</title><style>
      *{box-sizing:border-box}body{width:100%;max-width:390px;margin:0 auto;padding:22px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#172033;background:#fff}header{text-align:center;padding-bottom:12px;border-bottom:1px solid #dbe2ea}.store{margin:0;font-size:19px;font-weight:700}.contact{margin-top:5px;color:#64748b;font-size:10px}.title{margin:13px 0;text-align:center;color:#334155;font-size:10px;font-weight:700;letter-spacing:1.2px}.meta{padding:9px 0;border-top:1px dashed #cbd5e1;border-bottom:1px dashed #cbd5e1}.meta-row,.summary-row,.total,.payment{display:flex;justify-content:space-between;gap:12px;padding:4px 0}.meta-row span:first-child,.summary-row span:first-child,.payment span{color:#64748b}.meta-row span:last-child{text-align:right;font-weight:600}table{width:100%;margin-top:10px;border-collapse:collapse;table-layout:fixed}th{padding:7px 3px;border-bottom:1px solid #cbd5e1;text-align:left;color:#64748b;font-size:10px}th:first-child{width:46%}th:nth-child(2){width:30%;text-align:center}th:last-child{width:24%;text-align:right}td{padding:8px 3px;border-bottom:1px solid #e8edf3;vertical-align:top;font-size:10px;overflow-wrap:anywhere}td:nth-child(2){text-align:center;color:#475569}td:last-child{text-align:right;white-space:nowrap;font-weight:600}small{display:block;margin-top:3px;color:#64748b;font-size:9px}.summary{margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1}.summary-row{font-size:11px}.total{margin-top:6px;padding:10px 0;border-top:1px solid #334155;border-bottom:1px solid #334155;font-size:15px;font-weight:700}.payment{font-size:11px}.thanks{margin-top:16px;text-align:center;color:#64748b;font-size:10px}@page{size:80mm auto;margin:4mm}@media print{body{width:72mm;max-width:72mm;margin:0 auto;padding:0}tr,.summary,.total,.payment{break-inside:avoid}}
    </style></head><body><header><h1 class="store">${escapeHtml(storeName)}</h1>${contact ? `<div class="contact">${contact}</div>` : ""}</header><div class="title">SALES RECEIPT</div><div class="meta"><div class="meta-row"><span>Receipt</span><span>${escapeHtml(sale.sale_number || "—")}</span></div><div class="meta-row"><span>Customer</span><span>${escapeHtml(customer.name || "Walk-in Customer")}</span></div>${customer.phone ? `<div class="meta-row"><span>Phone</span><span>${escapeHtml(customer.phone)}</span></div>` : ""}<div class="meta-row"><span>Date</span><span>${escapeHtml(sale.created_at ? new Date(sale.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "")}</span></div></div><table><thead><tr><th>Item</th><th>Qty × Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><div class="summary-row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>${Number(sale.discount_amount) > 0 ? `<div class="summary-row"><span>Discount</span><span>− ${money(sale.discount_amount)}</span></div>` : ""}<div class="summary-row"><span>Tax</span><span>${money(sale.tax_amount)}</span></div></div><div class="total"><span>Total</span><span>${money(sale.total)}</span></div><div class="payment"><span>Payment · ${escapeHtml(String(payment.method || "cash").replaceAll("_", " "))}</span><strong>${money(payment.amount_received)}</strong></div>${Number(payment.change_due) > 0 ? `<div class="payment"><span>Change</span><strong>${money(payment.change_due)}</strong></div>` : ""}<footer class="thanks">Thank you for your purchase</footer><script>window.onload=()=>window.print();window.onafterprint=()=>window.close()</script></body></html>`;
    printWindow.document.write(receipt);
    printWindow.document.close();
  };
  const matchingCustomers = Array.isArray(customerResults.data) ? customerResults.data : [];

  return (
    <div className="admin-pos-workspace min-h-[calc(100vh-6rem)] w-full overflow-visible bg-[var(--bg-secondary)] px-0 pt-0 pb-2 text-[var(--text-primary)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-sm lg:mr-[min(31vw,420px)]">
        <nav className="flex flex-wrap gap-2" aria-label="POS sections">
          {[["pos", ShoppingCart, "POS"], ["history", History, "Sale History"], ["returns", RotateCcw, "Return"], ["return-history", ClipboardList, "Return History"], ["hold", Bookmark, `Hold${heldCarts.length ? ` (${heldCarts.length})` : ""}`]].map(([key, Icon, label]) => (
            <button key={key} type="button" onClick={() => {
              if (editingSaleId && key !== "pos") {
                toast.error("Save or cancel the history sale edit before leaving the POS cart.");
                return;
              }
              setActiveView(key);
            }} className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-bold transition ${activeView === key ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-blue-300 hover:text-blue-500"}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </nav>
        <div className="grid min-w-[260px] flex-1 grid-cols-3 gap-2 sm:max-w-[420px]">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 shadow-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--success-soft)] text-[var(--success-text)]"><CreditCard size={14}/></span><span className="min-w-0"><span className="block truncate text-[9px] font-medium text-[var(--text-muted)]">Today’s Sales</span><b className="block truncate text-xs text-[var(--text-primary)]">{salesOverviewQuery.isLoading ? "…" : money(salesOverviewQuery.data?.todayRevenue)}</b></span></div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 shadow-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><History size={14}/></span><span className="min-w-0"><span className="block truncate text-[9px] font-medium text-[var(--text-muted)]">Transactions</span><b className="block text-xs text-[var(--text-primary)]">{salesOverviewQuery.isLoading ? "…" : (salesOverviewQuery.data?.totalTransactions || 0).toLocaleString()}</b></span></div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 shadow-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><ShoppingCart size={14}/></span><span className="min-w-0"><span className="block truncate text-[9px] font-medium text-[var(--text-muted)]">Items in Cart</span><b className="block text-xs text-[var(--accent)]">{itemCount}</b></span></div>
        </div>
      </div>
      <div className="grid items-start gap-y-3 gap-x-0 lg:grid-cols-[minmax(0,1fr)_min(31vw,420px)]">
        <section className="min-w-0 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-md transition-shadow duration-200 hover:shadow-lg sm:p-2.5">
          {activeView === "pos" ? <>
          <div className="relative z-20 mb-3 flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="relative min-w-28 flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                ref={searchInputRef}
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search products, SKU, or name..."
                aria-label="Search products by name or SKU"
                className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] pl-9 pr-3 text-xs text-[var(--text-primary)] outline-none transition-all duration-200 placeholder:text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:shadow-sm focus:border-[var(--accent)] focus:shadow-md focus:ring-4 focus:ring-[var(--accent-soft)] sm:text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => searchInputRef.current?.focus()}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              aria-label="Focus the search field to scan a barcode"
              title="Use a barcode scanner to type into the search field"
            >
              <Barcode size={16} />
            </button>
            <PosDropdown
              value={selectedSort}
              options={[
                { value: "recent", label: "Featured" },
                { value: "name", label: "Name" },
                { value: "price_asc", label: "Price: low to high" },
                { value: "price_desc", label: "Price: high to low" },
              ]}
              onChange={(value) => { setSelectedSort(value); setCurrentPage(1); }}
              ariaLabel="Sort products"
              prefix="Sort: "
              className="w-28 shrink-0 sm:w-32"
              buttonClassName="h-10 justify-between px-2 text-[10px] font-semibold"
              menuClassName="w-48"
            />
            <div className="relative flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-label="Product filters" aria-expanded={filtersOpen} className={`flex h-10 items-center gap-1.5 rounded-xl border px-2 text-[10px] font-semibold ${selectedCategory || selectedBrand || selectedStock ? "border-blue-300 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-blue-500"}`}><SlidersHorizontal size={14}/><span>Filter</span></button>
              <button type="button" onClick={() => setViewMode("grid")} aria-label="Grid view" aria-pressed={viewMode === "grid"} className={`hidden h-10 w-9 items-center justify-center rounded-xl border sm:flex ${viewMode === "grid" ? "border-blue-300 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)]"}`}><LayoutGrid size={14}/></button>
              <button type="button" onClick={() => setViewMode("list")} aria-label="List view" aria-pressed={viewMode === "list"} className={`hidden h-10 w-9 items-center justify-center rounded-xl border sm:flex ${viewMode === "list" ? "border-blue-300 bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)]"}`}><List size={14}/></button>
              {filtersOpen && <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-xl">
                <div className="mb-2 text-xs font-bold text-[var(--text-primary)]">Product filters</div>
                <PosDropdown fieldLabel="Category" value={selectedCategory} options={[{ value: "", label: "All categories" }, ...categoryOptions.map((category) => ({ value: category, label: category }))]} onChange={selectCategory} ariaLabel="Filter by category" className="mb-2" buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                <PosDropdown fieldLabel="Brand" value={selectedBrand} options={[{ value: "", label: "All brands" }, ...brandOptions.map((brand) => ({ value: brand, label: brand }))]} onChange={(value) => { setSelectedBrand(value); setCurrentPage(1); }} ariaLabel="Filter by brand" className="mb-2" buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                <PosDropdown fieldLabel="Stock" value={selectedStock} options={[{ value: "", label: "Any stock" }, { value: "in_stock", label: "In stock" }, { value: "low_stock", label: "Low stock" }, { value: "out_of_stock", label: "Out of stock" }]} onChange={(value) => { setSelectedStock(value); setCurrentPage(1); }} ariaLabel="Filter by stock" buttonClassName="h-9 rounded-lg px-2" menuClassName="w-full" />
                {(selectedCategory || selectedBrand || selectedStock || selectedSort !== "recent") && <button type="button" onClick={() => { setSelectedCategory(""); setSelectedBrand(""); setSelectedStock(""); setSelectedSort("recent"); setCurrentPage(1); }} className="mt-3 w-full rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Clear all filters</button>}
              </div>}
            </div>
          </div>

          {productsError ? (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-soft)] p-5 text-center text-sm text-[var(--danger-text)]">
              Could not load products. Please try again.
            </div>
          ) : productsLoading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="h-56 animate-pulse rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]" />
              ))}
            </div>
          ) : variantCards.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] p-8 text-center text-sm text-[var(--text-muted)]">
              No product variants found for these search and filter settings.
            </div>
          ) : (
            <div className={viewMode === "list" ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"}>
              {variantCards.map(({ product, variant }) => {
                const image = getProductImage({ ...product, variants: [variant] });
                const variantName = variant.title && variant.title !== "Default" ? variant.title : variantLabel(variant);
                const stockQuantity = Math.max(0, Number(variant.quantity) || 0);
                const inStock = stockQuantity > 0;
                const heldQuantity = heldCarts.reduce((total, held) => total + (held.cart || []).reduce(
                  (heldTotal, item) => heldTotal + (item.variant_id === variant._id ? Number(item.quantity) || 0 : 0),
                  0,
                ), 0);

                return (
                  <article key={variant._id} role={inStock ? "button" : undefined} tabIndex={inStock ? 0 : undefined} aria-disabled={!inStock} aria-label={`Add ${product.name} ${variantName} to cart`} onClick={() => { if (inStock) addToCart(product, variant); }} onKeyDown={(event) => { if (inStock && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); addToCart(product, variant); } }} className={`${viewMode === "list" ? "grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 p-2 sm:p-2.5" : "flex flex-col overflow-hidden"} group min-w-0 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all duration-200 ${inStock ? "cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)]/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" : "cursor-not-allowed opacity-75"}`}>
                  <div className={`relative ${viewMode === "list" ? "aspect-square rounded-xl" : "aspect-square rounded-t-2xl rounded-b-none"} w-full shrink-0 overflow-hidden bg-slate-100`}>
                      {image ? (
                        <Image src={image} alt={`${product.name} ${variantName}`} fill unoptimized sizes="(max-width: 640px) 44vw, (max-width: 1280px) 22vw, 16vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                      ) : <ShoppingCart size={25} className="absolute inset-0 m-auto text-[var(--text-muted)]" />}
                      <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold shadow-sm backdrop-blur-sm ${inStock ? "bg-emerald-50/95 text-emerald-700" : "bg-rose-50/95 text-rose-700"}`}>
                        {inStock && <Check size={11} strokeWidth={3} />}{inStock ? `Stock: ${stockQuantity}` : "Out of Stock"}
                      </span>
                      {heldQuantity > 0 && <span className="absolute bottom-2 left-2 inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50/95 px-2 py-1 text-[9px] font-bold text-amber-800 shadow-sm backdrop-blur-sm">On hold: {heldQuantity}</span>}
                      <span aria-hidden="true" title={inStock ? "Add to cart" : "Out of stock"} className={`absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-lg transition ${inStock ? "bg-blue-600 shadow-blue-900/25 group-hover:scale-105 group-hover:bg-blue-700" : "bg-slate-400 shadow-none"}`}><Plus size={19} strokeWidth={2.5}/></span>
                    </div>
                    <div className={`min-w-0 ${viewMode === "list" ? "" : "p-2 pt-1.5 sm:p-2.5 sm:pt-1.5"}`}>
                    <h3 className="line-clamp-1 min-h-5 text-xs font-bold leading-5 tracking-tight text-[var(--text-primary)]" title={product.name}>{product.name}</h3>
                    <p className="mt-1 flex h-4 items-center gap-1.5 truncate text-[10px] text-[var(--text-muted)]"><Tag size={12} fill="currentColor" /> SKU: {variant.sku || "—"}</p>
                    <p className="mt-0.5 truncate text-sm font-bold tracking-tight text-[var(--text-primary)]">{money(variant.selling_price)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-4 flex items-center justify-between border-t border-[var(--border-color)] pt-3" aria-label="Product pages">
              <span className="text-xs text-[var(--text-muted)]">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </nav>
          )}
          </> : activeView === "history" ? <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ClipboardList size={18}/></span>
                <div><h2 className="text-lg font-extrabold tracking-tight text-slate-900">Sales history</h2><p className="mt-0.5 text-xs text-slate-500">Review completed POS transactions and payment details.</p></div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"><History size={13}/>{historySales.length.toLocaleString()} {historySales.length === 1 ? "sale" : "sales"}</span>
            </div>

            <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-[minmax(220px,1fr)_155px_155px_auto]">
              <label className="relative min-w-0"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} placeholder="Search sale, customer, or phone..." aria-label="Search POS sales" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"/></label>
              <PosDropdown value={historyPayment} options={[{ value: "all", label: "Payment: All" }, { value: "cash", label: "Payment: Cash" }, { value: "card", label: "Payment: Card" }, { value: "bank_transfer", label: "Payment: Bank" }]} onChange={(value) => { setHistoryPayment(value); setHistoryPage(1); }} ariaLabel="Filter sales by payment method" buttonClassName="h-10 shadow-sm" />
              <PosDropdown value={historyRange} options={[{ value: "all", label: "Time: All" }, { value: "today", label: "Time: Today" }, { value: "7days", label: "Time: Last 7 days" }, { value: "30days", label: "Time: Last 30 days" }]} onChange={(value) => { setHistoryRange(value); setHistoryPage(1); }} ariaLabel="Filter sales by date" buttonClassName="h-10 shadow-sm" />
              <button type="button" onClick={() => { setHistorySearch(""); setHistoryPayment("all"); setHistoryRange("all"); setHistoryPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Reset filters</button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50/90 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>{["Sale", "Customer", "Date", "Payment", "Items", "Total", ""].map((label) => <th key={label} className="px-4 py-3 font-bold">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {historyQuery.isLoading ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-slate-500">Loading sales history...</td></tr>
                    : historyQuery.isError ? <tr><td colSpan={7} className="px-4 py-14 text-center text-sm text-rose-600">Could not load sales history. Please retry.</td></tr>
                      : visibleHistorySales.length ? visibleHistorySales.map((sale) => {
                        const payment = String(sale.payment?.method || "cash").replaceAll("_", " ");
                        const saleItems = sale.items || [];
                        const previewItems = saleItems.slice(0, 4);
                        const quantity = saleItems.reduce((count, item) => count + (Number(item.quantity) || 0), 0);
                        const saleDate = sale.created_at ? new Date(sale.created_at) : null;
                        const isExpanded = expandedSaleId === sale._id;
                        return <Fragment key={sale._id}><tr className={`border-b border-slate-100 text-xs transition-colors ${isExpanded ? "bg-blue-50/40" : "hover:bg-blue-50/40"}`}>
                          <td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" aria-label={`${isExpanded ? "Hide" : "Show"} details for ${sale.sale_number || "sale"}`} aria-expanded={isExpanded} onClick={() => setExpandedSaleId(isExpanded ? null : sale._id)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${isExpanded ? "border-blue-200 bg-blue-100 text-blue-700" : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"}`}><ChevronRight size={14} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}/></button><div className="min-w-0"><Link href={`/admin/pos/history/${sale._id}`} className="font-mono text-[11px] font-bold text-blue-700 hover:text-blue-800">{sale.sale_number || "—"}</Link><span className="mt-1 block text-[10px] text-slate-400">POS transaction</span></div></div></td>
                          <td className="px-4 py-3"><span className="block max-w-[180px] truncate font-semibold text-slate-800">{sale.customer_snapshot?.name || "Walk-in Customer"}</span>{sale.customer_snapshot?.phone && <span className="mt-1 block text-[10px] text-slate-500">{sale.customer_snapshot.phone}</span>}</td>
                          <td className="whitespace-nowrap px-4 py-3"><span className="block font-medium text-slate-700">{saleDate ? saleDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—"}</span><span className="mt-1 block text-[10px] text-slate-500">{saleDate ? saleDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span></td>
                          <td className="px-4 py-3"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">{payment}</span></td>
                          <td className="px-4 py-3"><span className="inline-flex min-w-8 justify-center rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold tabular-nums text-slate-700">{quantity}</span></td>
                          <td className="whitespace-nowrap px-4 py-3 font-extrabold tabular-nums text-slate-900">{money(sale.total)}</td>
                          <td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => editHistorySale(sale)} aria-label={`Edit sale ${sale.sale_number || "sale"}`} title="Edit sale in POS cart" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><Pencil size={14}/></button><button type="button" onClick={() => printHistoryReceipt(sale)} aria-label={`Print receipt for ${sale.sale_number || "sale"}`} title="Print receipt" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Printer size={14}/></button><Link href={`/admin/pos/history/${sale._id}`} aria-label={`View sale ${sale.sale_number || "details"}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 text-[10px] font-bold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">Details<ArrowUpRight size={13}/></Link></div></td>
                        </tr>{isExpanded && <tr className="border-b border-slate-100 bg-slate-50/70"><td colSpan={7} className="px-4 py-3 sm:px-12"><div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,1fr)]"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Items in sale ({quantity})</p><div className="space-y-1.5">{previewItems.map((item, index) => { const image = getProductImage({ variants: [{ images: item.product_image ? [{ img_url: item.product_image }] : [] }] }); return <div key={`${item.variant_id || item.sku || item.product_name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5"><div className="flex min-w-0 items-center gap-2.5"><span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">{image ? <Image src={image} alt={item.product_name || "Product variant"} fill unoptimized sizes="36px" className="object-cover"/> : <ShoppingCart size={14} className="absolute inset-0 m-auto text-slate-400"/>}</span><span className="min-w-0 truncate text-xs font-medium text-slate-700">{item.product_name || "Product"}{item.variant_title ? <span className="font-normal text-slate-400"> · {item.variant_title}</span> : null}</span></div><span className="shrink-0 text-[11px] text-slate-500">× {item.quantity}</span></div>; })}{!saleItems.length && <p className="text-xs text-slate-500">No item details recorded.</p>}{saleItems.length > 4 && <Link href={`/admin/pos/history/${sale._id}`} className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-blue-700 hover:text-blue-800">Show more ({saleItems.length - 4})<ArrowUpRight size={13}/></Link>}</div></div><div><p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Payment summary</p><div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-white p-3 text-xs"><div className="flex justify-between gap-3 text-slate-500"><span>Subtotal</span><span className="font-medium text-slate-700">{money(sale.subtotal)}</span></div>{Number(sale.discount_amount) > 0 && <div className="flex justify-between gap-3 text-slate-500"><span>Discount</span><span className="font-medium text-emerald-700">− {money(sale.discount_amount)}</span></div>}<div className="flex justify-between gap-3 text-slate-500"><span>Tax</span><span className="font-medium text-slate-700">{money(sale.tax_amount)}</span></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-bold text-slate-900"><span>Total</span><span>{money(sale.total)}</span></div>{sale.payment?.reference && <div className="flex justify-between gap-3 pt-1 text-slate-500"><span>Reference</span><span className="max-w-[180px] truncate text-slate-700">{sale.payment.reference}</span></div>}</div>{sale.customer_snapshot?.phone && <p className="mt-2 text-[11px] text-slate-500">Customer phone: <span className="font-medium text-slate-700">{sale.customer_snapshot.phone}</span></p>}</div></div></td></tr>}</Fragment>;
                      }) : <tr><td colSpan={7} className="px-4 py-14 text-center"><span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><History size={18}/></span><span className="block text-sm font-semibold text-slate-700">{historySearch || historyPayment !== "all" || historyRange !== "all" ? "No sales match these filters" : "No sales yet"}</span><span className="mt-1 block text-xs text-slate-500">{historySearch || historyPayment !== "all" || historyRange !== "all" ? "Try adjusting your search or filters." : "Completed sales will appear here."}</span></td></tr>}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-xs text-slate-500">
              <span>Showing <strong className="font-semibold text-slate-700">{historySales.length ? (historyPage - 1) * HISTORY_PAGE_SIZE + 1 : 0}-{Math.min(historyPage * HISTORY_PAGE_SIZE, historySales.length)}</strong> of <strong className="font-semibold text-slate-700">{historySales.length}</strong> sales</span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous sales page" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => page - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15}/></button>
                {Array.from({ length: historyPageCount }, (_, index) => index + 1).slice(Math.max(0, historyPage - 3), historyPage + 2).map((page) => <button key={page} type="button" aria-current={page === historyPage ? "page" : undefined} onClick={() => setHistoryPage(page)} className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${page === historyPage ? "bg-blue-600 text-white shadow-sm" : "border border-transparent text-slate-600 hover:border-slate-200 hover:bg-white"}`}>{page}</button>)}
                <button type="button" aria-label="Next sales page" disabled={historyPage >= historyPageCount} onClick={() => setHistoryPage((page) => page + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15}/></button>
              </div>
            </div>
          </div> : activeView === "returns" ? <PosReturnPanel sales={(historyQuery.data || []).filter((sale) => sale.status === "completed")} selectedSale={selectedReturnSale} returnSaleId={returnSaleId} setReturnSaleId={setReturnSaleId} returnQuantities={returnQuantities} setReturnQuantities={setReturnQuantities} returnNote={returnNote} setReturnNote={setReturnNote} returnMutation={returnMutation} />
          : activeView === "return-history" ? <PosReturnHistoryPanel sales={historyQuery.data || []} isLoading={historyQuery.isLoading} isError={historyQuery.isError} />
          : <div>
            <div className="mb-4"><h2 className="text-lg font-extrabold text-slate-900">Held sales</h2><p className="mt-1 text-xs text-slate-500">Saved carts stay available in this browser until resumed or removed.</p></div>
            {heldCarts.length ? <div className="space-y-2">{heldCarts.map((held) => <article key={held.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Bookmark size={17}/></span><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{held.customer?.name || "Walk-in Customer"} · {held.cart.length} items</div>{held.editingSaleNumber && <div className="mt-0.5 text-[10px] font-semibold text-blue-700">Edit draft for {held.editingSaleNumber} · original sale unchanged</div>}<div className="mt-1 text-xs text-slate-500">{new Date(held.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · {money(held.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0))}</div></div></div><div className="flex gap-2"><button type="button" onClick={() => resumeHeldCart(held, new Date().toISOString())} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">Resume sale</button><button type="button" onClick={() => setHeldCarts((current) => current.filter((item) => item.id !== held.id))} aria-label="Delete held sale" className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button></div></article>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">No held sales yet. Use “Hold” in the cart to save a sale for later.</div>}
          </div>}
        </section>

        <form onSubmit={submitSale} className={`${cartDrawerOpen ? "fixed inset-x-0 top-0 bottom-0 z-[60] flex min-h-0 flex-col overflow-y-auto overflow-x-hidden sm:left-auto sm:w-[420px] lg:left-auto lg:right-1 lg:top-[68px] lg:bottom-3 lg:h-[calc(100vh-5rem)] lg:w-[min(31vw,420px)] lg:overflow-y-auto" : "hidden lg:fixed lg:right-1 lg:top-[68px] lg:bottom-3 lg:z-40 lg:flex lg:h-[calc(100vh-5rem)] lg:w-[min(31vw,420px)] lg:overflow-y-auto"} min-w-0 self-start rounded-none p-3 text-[var(--text-primary)] transition-shadow duration-200 hover:shadow-xl sm:p-5 lg:min-h-0 lg:flex-col lg:border-r-0 lg:border-y-0 lg:p-3`} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-md)" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-base font-extrabold tracking-tight text-[var(--text-primary)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><ShoppingCart size={17} /></span>
              Cart ({itemCount})
            </h2>
            <div className="flex items-center gap-2">
              {cart.length > 0 && !editingSaleId && <button type="button" onClick={() => { setCart([]); setDiscountAmount(""); setRateEditorVariantId(null); }} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-bold text-[var(--text-muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger-text)]"><Trash2 size={13}/>Clear All</button>}
              <button type="button" onClick={() => setCartDrawerOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] lg:hidden" aria-label="Close cart"><X size={18} /></button>
            </div>
          </div>

          {editingSaleId && <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent)]"><Pencil size={13}/><span className="truncate">Editing {editingSaleNumber}</span></div>}

          <div className="relative mb-2" ref={customerBoxRef}>
            <div className="flex h-9 w-full items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 shadow-sm transition-all duration-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <Search size={14} className="shrink-0 text-blue-500" />
              <input role="combobox" aria-controls="pos-customer-options" aria-autocomplete="list" value={customerOpen ? customerSearch : selectedCustomer?.name || ""} onFocus={() => setCustomerOpen(true)} onChange={(event) => { setCustomerSearch(event.target.value); setCustomerOpen(true); }} placeholder="Search customer by name or phone..." aria-label="Search customer by name or phone" aria-expanded={customerOpen} aria-haspopup="listbox" className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]" />
              <button type="button" onClick={() => setCustomerOpen((open) => !open)} aria-label={customerOpen ? "Close customer list" : "Open customer list"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-card-alt)]"><ChevronDown size={15} className={`transition-transform ${customerOpen ? "rotate-180" : ""}`} /></button>
            </div>
            {customerOpen && <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl">
              <div id="pos-customer-options" role="listbox" aria-label="Customers" className="max-h-56 overflow-y-auto px-2 py-1">
                <button type="button" role="option" aria-selected={!selectedCustomer} onClick={() => { setSelectedCustomer(null); setCustomerSearch(""); setCustomerOpen(false); }} className={`my-0.5 w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-150 ${!selectedCustomer ? "border-[var(--accent)]/20 bg-[var(--accent-soft)]" : "border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-card-alt)]"}`}>
                  <span className="block font-bold">Walk-in Customer</span><span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">Continue without assigning a customer</span>
                </button>
                {customerResults.isFetching && !matchingCustomers.length && <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">Loading customers…</p>}
                {matchingCustomers.map((customer) => <button key={customer._id} type="button" role="option" aria-selected={selectedCustomer?._id === customer._id} onClick={() => { setSelectedCustomer(customer); setCustomerSearch(""); setCustomerOpen(false); }} className={`my-0.5 w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${selectedCustomer?._id === customer._id ? "border-[var(--accent)]/20 bg-[var(--accent-soft)]" : "border-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-card-alt)]"}`}>
                  <span className="block truncate text-[13px] font-bold text-[var(--text-primary)]">{customer.name}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}</span>
                </button>)}
                {!customerResults.isFetching && !customerSearch.trim() && !matchingCustomers.length && <p className="px-3 py-4 text-center text-xs text-[var(--text-muted)]">No saved customers yet.</p>}
                {!customerResults.isFetching && customerSearch.trim() && !matchingCustomers.length && <p className="px-3 py-5 text-center text-xs text-[var(--text-muted)]">No customers found.</p>}
              </div>
              <div className="border-t border-[var(--border-color)] bg-[var(--bg-card-alt)] p-2">
                <button type="button" onClick={() => { setShowCustomerForm(true); setCustomerOpen(false); }} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)] transition hover:shadow-md"><Plus size={15} /> Add New Customer</button>
              </div>
            </div>}
          </div>

          <CustomerFormModal open={showCustomerForm} form={customerForm} setForm={setCustomerForm} isPending={customerMutation.isPending} onSave={() => customerMutation.mutate()} onClose={() => setShowCustomerForm(false)} />

          {cart.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card-alt)] px-5 py-8 text-center xl:min-h-0 xl:flex-1">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ShoppingCart size={22} /></span>
              <p className="text-sm font-bold text-[var(--text-primary)]">Your cart is empty</p>
              <p className="mt-1 max-w-[220px] text-xs leading-5 text-[var(--text-muted)]">Add a product variant and it will appear here.</p>
            </div>
          ) : (
          <>
          <div className="mb-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-xl border border-[var(--border-color)]">
            {cart.map((item) => (
              <article key={item.variant_id} className="border-b border-[var(--border-color)] px-2.5 py-2 last:border-0 hover:bg-[var(--bg-row-hover)]">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-card-alt)]">
                    {item.image && <Image src={item.image} alt={item.product_name} fill unoptimized className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{item.product_name}</p>
                    <div className="flex min-w-0 items-center justify-between gap-1">
                    <p className="min-w-0 truncate text-[10px] text-[var(--text-secondary)]">{item.variant_title}{item.sku ? ` · ${item.sku}` : ""}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex h-6 items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
                        <button type="button" onClick={() => changeQuantity(item.variant_id, -1)} className="flex h-full w-6 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)]" aria-label="Decrease quantity"><Minus size={12} /></button>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={quantityDrafts[item.variant_id] ?? String(item.quantity)} onChange={(event) => {
                          const value = event.target.value;
                          if (/^\d*$/.test(value)) setQuantityDrafts((current) => ({ ...current, [item.variant_id]: value }));
                        }} onBlur={() => commitQuantity(item.variant_id)} onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }} className="h-5 w-9 rounded px-0.5 text-center text-xs tabular-nums text-[var(--text-primary)] outline-none focus:bg-[var(--accent-soft)]" aria-label={`Quantity for ${item.product_name}`} title={`Available stock: ${item.stock}`} />
                        <button type="button" onClick={() => changeQuantity(item.variant_id, 1)} disabled={item.quantity >= item.stock} className="flex h-full w-6 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] disabled:opacity-30" aria-label="Increase quantity"><Plus size={12} /></button>
                      </div>
                    </div>
                    </div>
                  </div>
                  <div className="flex h-full shrink-0 flex-col items-end justify-between self-stretch">
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">{money(itemNetTotal(item))}</span>
                    <div className="flex items-center">
                    <button type="button" onClick={() => setRateEditorVariantId((current) => current === item.variant_id ? null : item.variant_id)} className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${rateEditorVariantId === item.variant_id || item.discount_rate > 0 || item.flat_discount > 0 || item.tax_rate > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`} aria-label="Open item price settings" aria-expanded={rateEditorVariantId === item.variant_id} title="Item price settings"><Settings2 size={15} /></button>
                    <button type="button" onClick={() => setCart((current) => current.filter((entry) => entry.variant_id !== item.variant_id))} className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--danger-soft)] hover:text-[var(--danger-text)]" aria-label={`Remove ${item.product_name}`}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
                {rateEditorVariantId === item.variant_id && (
                  <div className="mt-2 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-2.5">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]"><Settings2 size={12}/></span>Adjustments<span className="ml-auto text-[9px] font-medium text-[var(--text-muted)]">Discount before tax</span></div>
                    <div className="grid grid-cols-[112px_minmax(0,1fr)_minmax(0,1fr)] gap-x-2">
                      <span className="col-span-2 mb-1 flex h-5 items-center text-[10px] font-semibold text-[var(--text-secondary)]">Discount</span>
                      <span className="mb-1 flex h-5 items-center text-[10px] font-semibold text-[var(--text-secondary)]">Tax</span>
                      <div role="group" aria-label={`Discount type for ${item.product_name}`} className="flex h-8 items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5">
                        {[['percentage', 'Percent'], ['flat', 'Flat']].map(([type, label]) => <button key={type} type="button" aria-label={label} title={`${label} discount`} aria-pressed={getDiscountType(item) === type} onClick={() => setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? { ...entry, discount_type: type, discount_rate: type === "flat" ? 0 : entry.discount_rate, flat_discount: type === "percentage" ? 0 : entry.flat_discount } : entry))} className={`flex h-full min-w-0 ${type === "percentage" ? "flex-[1.35]" : "flex-1"} items-center justify-center gap-1 rounded-md px-1 text-[10px] font-semibold transition ${getDiscountType(item) === type ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"}`}>{type === "percentage" ? <><Percent size={14} strokeWidth={2.5} /><span>Percent</span></> : label}</button>)}
                      </div>
                      <div className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
                        {getDiscountType(item) === "flat" && <span className="shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">Rs</span>}
                        <input type="number" min="0" max={getDiscountType(item) === "flat" ? item.unit_price : 100} step="1" value={getDiscountType(item) === "flat" ? item.flat_discount || 0 : item.discount_rate || 0} onChange={(event) => {
                          const value = event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0);
                          setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? getDiscountType(item) === "flat" ? { ...entry, discount_type: "flat", discount_rate: 0, flat_discount: Math.min(entry.unit_price, value) } : { ...entry, discount_type: "percentage", discount_rate: Math.min(100, value), flat_discount: 0 } : entry));
                        }} className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-[var(--text-primary)] outline-none" aria-label={`${getDiscountType(item) === "flat" ? "Flat discount per unit" : "Discount percentage"} for ${item.product_name}`} />
                        <span className="shrink-0 text-[10px] font-medium text-[var(--text-muted)]">{getDiscountType(item) === "flat" ? "/unit" : "%"}</span>
                      </div>
                      <label className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-50">
                        <input type="number" min="0" max="100" step="1" value={item.tax_rate} onChange={(event) => {
                          const value = event.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(event.target.value) || 0));
                          setCart((current) => current.map((entry) => entry.variant_id === item.variant_id ? { ...entry, tax_rate: value } : entry));
                        }} className="w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-[var(--text-primary)] outline-none" aria-label={`Tax percentage for ${item.product_name}`} /><span className="text-[10px] font-semibold text-[var(--text-muted)]">%</span>
                      </label>
                    </div>
                    {item.discount_type === "combined" && <p className="mt-1.5 text-[9px] leading-3 text-amber-700">Choose a discount type to edit this saved sale.</p>}
                  </div>
                )}
              </article>
            ))}
          </div>

          <section className="shrink-0 border-t border-[var(--border-color)] pt-1.5">
            <div className="space-y-0.5 text-xs">
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-[var(--text-secondary)]">Subtotal</span>
              <span className="font-medium text-[var(--text-primary)]">{money(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between gap-2 px-1 py-1 text-xs">
                <span className="shrink-0 text-[var(--text-secondary)]">Discount</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max={Math.round(subtotal - itemDiscount + tax)}
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                  placeholder="0"
                    className="h-7 w-20 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-right text-xs font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                  aria-label="Additional discount amount"
                />
                <span className="min-w-16 text-right font-medium">− {money(discount)}</span>
              </span>
            </label>
            <div className="flex items-center justify-between px-1 py-1 text-xs">
                <span className="text-[var(--text-secondary)]">
                  Tax ({Number(effectiveTaxRate.toFixed(2))}%)
                </span>
              <span className="font-medium text-[var(--text-primary)]">{money(tax)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm font-extrabold text-[var(--accent)]">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            </div>
          </section>

          <label className="mt-1.5 block shrink-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Payment Method</span>
            <PosDropdown value={paymentMethod} options={paymentMethods} onChange={(value) => {
              setPaymentMethod(value);
              if (!["card", "bank_transfer"].includes(value)) setPaymentReference("");
            }} ariaLabel="Payment method" className="w-full" buttonClassName="h-8 rounded-xl px-3" placement="top" />
          </label>

          {["card", "bank_transfer"].includes(paymentMethod) && <label className="mt-2 block shrink-0">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Transaction ID <span className="text-red-500">*</span></span>
            <input type="text" required value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Enter transaction ID" autoComplete="off" className="h-9 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-xs font-medium text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-blue-100" />
          </label>}

          <label className="mt-1.5 block shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-muted)]">Notes <span className="font-medium normal-case text-[var(--text-muted)]">(Optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={1}
            placeholder="Add any notes for this sale..."
            className="mt-1.5 w-full resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200"
          />
          </label>

          <div className={`mt-1.5 grid gap-2 ${editingSaleId ? "grid-cols-2" : "grid-cols-[1fr_1fr_1.5fr]"}`}>
          {editingSaleId ? <button type="button" onClick={cancelSaleEdit} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)]">Cancel Edit</button> : <>
          <button type="button" onClick={holdCart} disabled={!cart.length} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white text-sm font-extrabold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45"><Bookmark size={15}/>Hold</button>
          <button type="button" onClick={printReceipt} disabled={!cart.length} className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-45"><Printer size={14}/>Print</button>
          </>}
          <button
            type="submit"
            disabled={saleMutation.isPending || cart.length === 0}
            className="flex h-9 w-full shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
          >
            <CreditCard size={15} />
            {saleMutation.isPending ? (editingSaleId ? "Saving Changes..." : "Processing Sale...") : (editingSaleId ? "Save Changes" : "Complete Sale")}
          </button>
          </div>
          </>
          )}
        </form>
        {cartDrawerOpen && <button type="button" aria-label="Close cart" onClick={() => setCartDrawerOpen(false)} className="fixed inset-x-0 top-0 bottom-0 z-[55] bg-slate-950/35 backdrop-blur-[1px] lg:hidden" />}
        <button type="button" onClick={() => setCartDrawerOpen(true)} className="fixed bottom-4 right-4 z-50 flex h-12 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-bold text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-700 lg:hidden" aria-label={`Open cart, ${itemCount} items, ${money(total)}`}>
          <ShoppingCart size={18} />
          <span>Cart{itemCount > 0 ? ` · ${itemCount}` : ""}</span>
          <span className="border-l border-white/30 pl-2 tabular-nums">{money(total)}</span>
        </button>
      </div>
    </div>
  );
}
