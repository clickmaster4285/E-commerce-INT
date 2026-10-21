"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { customerApi } from "@/apis/admin/customerApi";
import { stockApi } from "@/apis/admin/stockApi";
import { variantApi } from "@/apis/admin/variantApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import CalculationSummaryCard from "@/components/admin/CalculationSummaryCard";
import { toast } from "sonner";
import {
  Bolt, CalendarDays, CheckCircle2, ChevronDown, ChevronRight,
  FileText, Package, Plus, Save, Search,
  Trash2, UserRound, X,
} from "lucide-react";

const localDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => localDateInput(new Date());
const defaultExpiry = () => { const value = new Date(); value.setDate(value.getDate() + 30); return localDateInput(value); };
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const input = "h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-card)] focus:ring-4 focus:ring-blue-500/10";
const label = "mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]";
const unwrapList = (value) => Array.isArray(value) ? value : value?.data || value?.items || value?.leads || [];
const rowId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url || "";
  return API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;
};

const initialForm = (quote) => quote ? {
  customer_type: quote.customer_type || "Customer",
  customer_key: quote.customer_id ? `customer:${quote.customer_id}` : "",
  customer_name: quote.customer_name || "", customer_email: quote.customer_email || "", customer_phone: quote.customer_phone || "", customer_address: quote.customer_address || "",
  quote_date: quote.quote_date?.slice(0, 10) || today(), expiry_date: quote.expiry_date?.slice(0, 10) || defaultExpiry(),
  terms: quote.terms || "", notes: quote.notes || "", tax_rate: String(quote.tax_rate || 0), overall_discount_rate: String(quote.overall_discount_rate || 0), overall_discount_type: "percent",
  items: (quote.items || []).map((item, index) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    return { ...item, row_id: item._id || `saved-${index}`, quantity: item.quantity || 1, unit_price: item.unit_price || 0, discount_rate: item.discount_rate ?? (gross ? round((Number(item.discount) || 0) / gross * 100) : 0), tax_rate: item.tax_rate || 0 };
  }),
} : {
  customer_type: "Customer", customer_key: "", customer_name: "", customer_email: "", customer_phone: "", customer_address: "",
  quote_date: today(), expiry_date: defaultExpiry(), terms: "", notes: "", tax_rate: "0", overall_discount_rate: "0", overall_discount_type: "percent", items: [],
};

function QuotesNewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quote");
  const customerId = searchParams.get("customer");
  const { data: quote, isLoading, isError } = useQuery({ queryKey: ["quote-admin", quoteId], queryFn: () => quoteApi.getById(quoteId), enabled: !!quoteId });
  if (quoteId && isLoading) return <div className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}>Loading quote...</div>;
  if (quoteId && (isError || !["Pending", "Draft"].includes(quote?.status))) return <div className={`${card} p-8 text-center text-sm text-[var(--text-secondary)]`}>{isError ? "Could not load this quote." : "Only pending quotes can be edited."}<button type="button" onClick={() => router.push("/admin/quotes")} className="ml-2 font-semibold text-[var(--accent)]">Back to quotes</button></div>;
  return <QuoteEditor key={`${quoteId || "new"}:${customerId || ""}`} quoteId={quoteId} quote={quote || null} customerId={customerId} />;
}

export default function NewQuotePage() {
  return <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--text-muted)]">Loading quote form...</div>}><QuotesNewContent /></Suspense>;
}

function QuoteEditor({ quoteId, quote, customerId }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => initialForm(quote));
  const [showAllQuoteItems, setShowAllQuoteItems] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const customerPickerRef = useRef(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [productBrand, setProductBrand] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const { data: customersRaw = [] } = useQuery({ queryKey: ["quote-customers"], queryFn: () => customerApi.getAll({ limit: 500 }) });
  const { data: prefilledCustomer } = useQuery({ queryKey: ["quote-customer-prefill", customerId], queryFn: () => customerApi.getById(customerId), enabled: Boolean(customerId && !quoteId) });
  const { data: stockRaw = [] } = useQuery({ queryKey: ["quote-product-variants-stock"], queryFn: () => stockApi.getAll(), staleTime: 2 * 60 * 1000 });
  const { data: variantsRaw = [], isLoading: productsLoading } = useQuery({ queryKey: ["quote-all-variants"], queryFn: () => variantApi.getAll(), staleTime: 2 * 60 * 1000 });
  const customers = useMemo(() => unwrapList(customersRaw).filter((item) => !item.is_deleted), [customersRaw]);
  useEffect(() => {
    if (!customerId || quoteId) return;
    const customer = prefilledCustomer;
    if (!customer) return;
    setForm((current) => {
      const next = { customer_type: "Customer", customer_key: `customer:${customer._id}`, customer_name: customer.name || "", customer_email: customer.email || "", customer_phone: customer.phone || "", customer_address: customer.address || "" };
      if (current.customer_type === next.customer_type && current.customer_key === next.customer_key && current.customer_name === next.customer_name && current.customer_email === next.customer_email && current.customer_phone === next.customer_phone && current.customer_address === next.customer_address) return current;
      return { ...current, ...next };
    });
  }, [customerId, prefilledCustomer, quoteId]);
  const customerOptions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return customers.filter((customer) => !query || [customer.name, customer.email, customer.phone].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [customers, customerSearch]);
  const products = useMemo(() => {
    const stockByVariant = new Map();
    unwrapList(stockRaw).forEach((item) => stockByVariant.set(String(item.variant_id?._id || item.variant_id || item._id || ""), item));
    return unwrapList(variantsRaw).filter((variant) => !variant.is_deleted).map((variant) => {
      const id = String(variant._id || "");
      const stock = stockByVariant.get(id) || {};
      const product = variant.product_id && typeof variant.product_id === "object" ? variant.product_id : {};
      return { id, product_id: product._id || variant.product_id || null, name: stock.product_name || product.name || "Product", variant: variant.title || variant.sku || "Variant", sku: variant.sku || "", price: Number(variant.selling_price ?? stock.selling_price ?? stock.sell_price ?? 0), image: variant.images?.[0]?.img_url || stock.image || "", stock: Number(variant.quantity ?? stock.quantity ?? stock.stock ?? 0), categoryId: String(stock.category_id?._id || stock.category_id || ""), categoryName: stock.category_name || stock.category_id?.name || "", brandId: String(stock.brand_id?._id || stock.brand_id || ""), brandName: stock.brand_name || stock.brand_id?.name || "" };
    }).filter((variant) => variant.id);
  }, [variantsRaw, stockRaw]);
  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || `${product.name} ${product.variant} ${product.sku}`.toLowerCase().includes(query);
      return matchesQuery && (productCategory === "all" || product.categoryId === productCategory) && (productBrand === "all" || product.brandId === productBrand);
    });
  }, [products, productSearch, productCategory, productBrand]);
  const productCategories = useMemo(() => [...new Map(products.filter((item) => item.categoryId && item.categoryName).map((item) => [item.categoryId, item.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const productBrands = useMemo(() => [...new Map(products.filter((item) => item.brandId && item.brandName).map((item) => [item.brandId, item.brandName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [products]);
  const pickerPageSize = 8;
  const pickerPageCount = Math.max(1, Math.ceil(matchingProducts.length / pickerPageSize));
  const visibleVariants = matchingProducts.slice((productPage - 1) * pickerPageSize, productPage * pickerPageSize);

  const totals = useMemo(() => {
    const subtotal = round(form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
    const itemDiscount = round(form.items.reduce((sum, item) => sum + round(Number(item.quantity || 0) * Number(item.unit_price || 0) * Number(item.discount_rate || 0) / 100), 0));
    const overallDiscountBase = Math.max(0, subtotal - itemDiscount);
    const overallDiscountInput = Math.max(0, Number(form.overall_discount_rate || 0));
    const overallDiscount = round(form.overall_discount_type === "flat" ? Math.min(overallDiscountBase, overallDiscountInput) : overallDiscountBase * Math.min(100, overallDiscountInput) / 100);
    const itemTax = round(form.items.reduce((sum, item) => {
      const base = Number(item.quantity || 0) * Number(item.unit_price || 0);
      return sum + round((base - base * Number(item.discount_rate || 0) / 100) * Number(item.tax_rate || 0) / 100);
    }, 0));
    const overallTax = round(Math.max(0, subtotal - itemDiscount - overallDiscount) * Number(form.tax_rate || 0) / 100);
    const tax = round(itemTax + overallTax);
    const discount = round(itemDiscount + overallDiscount);
    return { subtotal, itemDiscount, overallDiscount, discount, itemTax, overallTax, tax, total: round(subtotal - discount + tax) };
  }, [form.items, form.overall_discount_rate, form.overall_discount_type, form.tax_rate]);
  const visibleQuoteItems = showAllQuoteItems ? form.items : form.items.slice(0, 10);

  const saveMutation = useMutation({
    mutationFn: ({ status, payload }) => quoteId ? quoteApi.update(quoteId, { ...payload, status }) : quoteApi.create({ ...payload, status }),
    onSuccess: (saved, variables) => {
      const message = variables.status === "Sent" ? `Quote ${saved.quote_number} marked as sent` : `Quote ${saved.quote_number} saved as pending`;
      toast.success(message);
      qc.invalidateQueries({ queryKey: ["quotes-admin"] });
      qc.invalidateQueries({ queryKey: ["quote-admin", quoteId] });
      router.push(`/admin/quotes/${saved._id}`);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not save quote"),
  });
  const createCustomerMutation = useMutation({
    mutationFn: () => customerApi.create(newCustomer),
    onSuccess: async (result) => {
      const created = result?.data || result?.customer || result;
      await qc.invalidateQueries({ queryKey: ["quote-customers"] });
      setForm((current) => ({ ...current, customer_type: "Customer", customer_key: `customer:${created._id}`, customer_name: created.name, customer_email: created.email || "", customer_phone: created.phone || "", customer_address: created.address || "" }));
      setCustomerModalOpen(false);
      setNewCustomer({ name: "", email: "", phone: "", address: "", notes: "" });
      toast.success("Customer added");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not add customer"),
  });

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const selectCustomer = (person) => {
    setForm((current) => ({ ...current, customer_type: "Customer", customer_key: `customer:${person._id}`, customer_name: person.name || "", customer_email: person.email || "", customer_phone: person.phone || "", customer_address: person.address || "" }));
    setCustomerPickerOpen(false);
    setCustomerSearch("");
  };
  const updateItem = (rowId, key, value) => setForm((current) => ({ ...current, items: current.items.map((item) => item.row_id === rowId ? { ...item, [key]: value } : item) }));
  const addItem = () => setForm((current) => ({ ...current, items: [...current.items, { row_id: rowId(), product_id: null, variant_id: "", name: "", variant_name: "", sku: "", quantity: 1, unit_price: 0, discount_rate: 0, tax_rate: 0 }] }));
  const removeItem = (rowId) => setForm((current) => ({ ...current, items: current.items.filter((item) => item.row_id !== rowId) }));
  const addSelectedProducts = () => {
    const selected = products.filter((product) => selectedVariantIds.includes(product.id) && !form.items.some((item) => String(item.variant_id) === product.id));
    if (!selected.length) { toast.error("Select at least one variant that has not already been added"); return; }
    setForm((current) => ({ ...current, items: [...current.items, ...selected.map((product) => ({ row_id: rowId(), product_id: product.product_id, variant_id: product.id, name: product.name, variant_name: product.variant, sku: product.sku, quantity: 1, unit_price: product.price, discount_rate: 0, tax_rate: 0 }))] }));
    setProductPickerOpen(false);
    setSelectedVariantIds([]);
  };
  const openProductPicker = () => { setProductSearch(""); setProductCategory("all"); setProductBrand("all"); setProductPage(1); setSelectedVariantIds([]); setProductPickerOpen(true); };
  const submitNewCustomer = () => {
    if (!newCustomer.name.trim()) { toast.error("Customer name is required"); return; }
    createCustomerMutation.mutate();
  };

  useEffect(() => {
    const closePicker = (event) => {
      if (customerPickerRef.current && !customerPickerRef.current.contains(event.target)) setCustomerPickerOpen(false);
    };
    document.addEventListener("mousedown", closePicker);
    return () => document.removeEventListener("mousedown", closePicker);
  }, []);

  const save = (status) => {
    if (!form.customer_key || !form.customer_name.trim()) { toast.error("Select a customer or lead and enter their name"); return; }
    if (!form.items.length || form.items.some((item) => !item.variant_id)) { toast.error("Add a product to each quote item"); return; }
    if (!form.quote_date || !form.expiry_date || form.expiry_date < form.quote_date) { toast.error("Expiry date must be on or after the quote date"); return; }
    const [type, id] = form.customer_key.split(":");
    const payload = {
      customer_type: "Customer",
      customer_id: id,
      lead_id: null,
      customer_name: form.customer_name.trim(), customer_email: form.customer_email.trim(), customer_phone: form.customer_phone.trim(), customer_address: form.customer_address.trim(),
      quote_date: form.quote_date, expiry_date: form.expiry_date,
      items: form.items.map(({ row_id, variant_name, ...item }) => ({ ...item, name: variant_name ? `${item.name} / ${variant_name}` : item.name, quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)), unit_price: Math.max(0, Number(item.unit_price) || 0), discount_rate: Math.min(100, Math.max(0, Number(item.discount_rate) || 0)), tax_rate: Math.min(100, Math.max(0, Number(item.tax_rate) || 0)) })),
      tax_rate: Math.min(100, Math.max(0, Number(form.tax_rate) || 0)),
      overall_discount_rate: form.overall_discount_type === "flat"
        ? (totals.subtotal > totals.itemDiscount ? Math.min(100, Math.max(0, Number(form.overall_discount_rate) || 0) / (totals.subtotal - totals.itemDiscount) * 100) : 0)
        : Math.min(100, Math.max(0, Number(form.overall_discount_rate) || 0)),
      terms: form.terms, notes: form.notes, status,
    };
    saveMutation.mutate({ status, payload });
  };

  return <div id="quote-print-area" className="w-full space-y-2.5 pb-5 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div><nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)]"><button type="button" onClick={() => router.push("/admin/quotes")} className="hover:text-[var(--accent)]">Quotes</button><ChevronRight size={11} /><span>Create New Quote</span></nav><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{quoteId ? "Edit Quote" : "Create New Quote"}</h1><p className="mt-0.5 text-[10px] text-[var(--text-muted)] sm:text-xs">Fill in the details below to create a professional quote for your customer.</p></div>
      <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={saveMutation.isPending} onClick={() => save("Pending")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-[10px] font-bold text-white shadow-sm disabled:opacity-60"><Save size={13} /> Save Quote</button></div>
    </header>

    <div className="grid items-stretch gap-3 md:grid-cols-2">
      <section className={`${card} overflow-visible bg-gradient-to-br from-white via-white to-slate-50/70`}>
        <div className="mb-4 flex items-center gap-2.5 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]"><UserRound size={15} /></span>
          <div><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">1. Customer Information</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Select a customer to fill in their contact details.</p></div>
          {form.customer_key && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={11} /> Selected</span>}
        </div>
        <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <div ref={customerPickerRef} className="relative">
            <label className={label} htmlFor="customer-select">Customer <Required /></label>
            <button id="customer-select" type="button" aria-haspopup="listbox" aria-expanded={customerPickerOpen} onClick={() => { setCustomerPickerOpen((open) => !open); setCustomerSearch(""); }} className={`${input} flex items-center justify-between gap-3 text-left`}>
              <span className={`flex min-w-0 items-center gap-2.5 truncate ${form.customer_key ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}><UserRound size={15} className="shrink-0 text-blue-600" />{form.customer_name || "Select a customer"}</span><ChevronDown size={15} className={`shrink-0 text-[var(--text-muted)] transition-transform ${customerPickerOpen ? "rotate-180" : ""}`} />
            </button>
            {customerPickerOpen && <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
              <div className="border-b border-[var(--border-color)] p-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input autoFocus value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search by customer name, email, or phone..." className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></div></div>
              <div className="max-h-56 overflow-y-auto p-1.5" role="listbox">{customerOptions.length ? customerOptions.map((customer) => <button key={customer._id} type="button" role="option" aria-selected={form.customer_key === `customer:${customer._id}`} onClick={() => selectCustomer(customer)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50 ${form.customer_key === `customer:${customer._id}` ? "bg-blue-50" : ""}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">{(customer.name || "C").slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[var(--text-primary)]">{customer.name}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">{[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact details"}</span></span>{form.customer_key === `customer:${customer._id}` && <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />}</button>) : <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">{customers.length ? "No customers match your search." : "No customers found yet."}</p>}</div>
              <div className="border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/60 p-2.5"><button type="button" onClick={() => { setCustomerPickerOpen(false); setNewCustomer({ name: "", email: "", phone: "", address: "", notes: "" }); setCustomerModalOpen(true); }} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 transition hover:bg-blue-100"><Plus size={14} /> Create New Customer</button></div>
            </div>}
          </div>
          {form.customer_key ? <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/50 p-3 shadow-inner">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-wider text-blue-700"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Bolt size={11} /></span>Customer Details <span className="font-medium normal-case tracking-normal text-slate-500">(editable for this quote)</span></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className={label}>Customer Name <Required /><input value={form.customer_name} onChange={(event) => setField("customer_name", event.target.value)} className={input} placeholder="Customer name" /></label>
              <label className={label}>Email<input type="email" value={form.customer_email} onChange={(event) => setField("customer_email", event.target.value)} className={input} placeholder="Email address" /></label>
              <label className={label}>Phone<input value={form.customer_phone} onChange={(event) => setField("customer_phone", event.target.value)} className={input} placeholder="Phone number" /></label>
              <label className={label}>Address<input value={form.customer_address} onChange={(event) => setField("customer_address", event.target.value)} className={input} placeholder="Address" /></label>
            </div>
          </div> : <div className="flex min-h-[88px] items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm"><UserRound size={16} /></span><div><p className="text-xs font-semibold text-[var(--text-secondary)]">Choose a customer to continue</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Their name and contact details will fill in automatically.</p></div></div>}
        </div>
      </section>

      <section className={`${card} overflow-hidden bg-gradient-to-br from-white via-white to-slate-50/70`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]"><CalendarDays size={15} /></span><div><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">2. Quote Details</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Set the schedule and customer-facing conditions.</p></div></div><span className="hidden rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700 sm:inline-flex">Required <span className="ml-1 text-rose-500">*</span></span></div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div><label className={label} htmlFor="quote-date">Quote Date <Required /></label><div className="relative"><CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" /><input id="quote-date" type="date" value={form.quote_date} onChange={(event) => setField("quote_date", event.target.value)} className={`${input} pl-10`} /></div><p className="mt-1 text-[9px] text-[var(--text-muted)]">Date this quote is issued.</p></div>
            <div><label className={label} htmlFor="expiry-date">Expiry Date <Required /></label><div className="relative"><CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" /><input id="expiry-date" type="date" min={form.quote_date} value={form.expiry_date} onChange={(event) => setField("expiry_date", event.target.value)} className={`${input} pl-10`} /></div><p className="mt-1 text-[9px] text-[var(--text-muted)]">The offer expires after this date.</p></div>
            <div className="sm:col-span-2"><div className="mb-1.5 flex items-center justify-between gap-2"><label className="text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="quote-terms">Terms &amp; Conditions</label><span className="rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">Optional</span></div><textarea id="quote-terms" value={form.terms} onChange={(event) => setField("terms", event.target.value)} maxLength={1000} rows={3} placeholder="Add payment terms, delivery details, or other conditions..." className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-xs leading-5 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-card)] focus:ring-4 focus:ring-blue-500/10" /><div className="mt-1 flex items-center justify-between"><span className="text-[9px] text-[var(--text-muted)]">These terms will appear on the customer quote.</span><span className="text-[9px] font-medium text-[var(--text-muted)]">{form.terms.length} / 1000</span></div></div>
          </div>
        </div>
      </section>
    </div>

    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className={`${card} min-w-0 overflow-visible`}>
        <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]"><Package size={17} /></span><h2 className="truncate text-sm font-extrabold tracking-tight text-[var(--text-primary)]">2. Products / Items</h2><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{form.items.length} in order</span></div><div className="quote-no-print ml-auto"><button type="button" onClick={openProductPicker} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/15"><Plus size={14} /> Add Product</button></div></div>
        {form.items.length ? <><div className="overflow-x-auto px-3 pt-3"><table className="w-full min-w-[980px] border-separate border-spacing-0 text-left"><thead className="bg-[var(--bg-card-alt)] text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)]"><tr><th className="w-8 rounded-l-xl px-2 py-3">#</th><th className="min-w-56 px-2 py-3">Product / Variant</th><th className="w-20 px-2 py-3">SKU</th><th className="w-20 px-2 py-3">Quantity</th><th className="w-28 px-2 py-3">Unit Price</th><th className="w-24 px-2 py-3">Discount</th><th className="w-24 px-2 py-3">Tax (%)</th><th className="w-24 px-2 py-3">Tax Amount</th><th className="w-28 px-2 py-3">Total</th><th className="w-20 rounded-r-xl px-2 py-3 text-center">Actions</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{visibleQuoteItems.map((item, index) => {
          const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
          const itemDiscount = gross * Number(item.discount_rate || 0) / 100;
          const itemTax = (gross - itemDiscount) * Number(item.tax_rate || 0) / 100;
          const selectedVariant = products.find((product) => product.id === String(item.variant_id));
          const displayName = selectedVariant?.name || item.name || "Quote item";
          const displayVariant = item.variant_name || selectedVariant?.variant;
          return <tr key={item.row_id} className="group transition-colors hover:bg-[var(--bg-tertiary)]/45"><td className="border-b border-[var(--border-color)] px-2 py-3 text-[10px] font-medium text-[var(--text-muted)]">{index + 1}</td><td className="border-b border-[var(--border-color)] px-2 py-3"><div className="flex min-w-0 items-center gap-3">{selectedVariant?.image ? <Image src={getImageUrl(selectedVariant.image)} alt={displayName} width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover shadow-sm" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Package size={19} /></span>}<span className="min-w-0"><span className="block truncate text-xs font-bold text-[var(--text-primary)]">{displayName}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">{displayVariant || "Selected variant"}</span></span></div></td><td className="border-b border-[var(--border-color)] px-2 py-3 text-[9px] font-medium text-[var(--text-muted)]">{item.sku || selectedVariant?.sku || "—"}</td><td className="border-b border-[var(--border-color)] px-2 py-3"><input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(item.row_id, "quantity", event.target.value)} className="h-9 w-[68px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" aria-label={`Quantity for item ${index + 1}`} /></td><td className="border-b border-[var(--border-color)] px-2 py-3"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(item.row_id, "unit_price", event.target.value)} className="h-9 w-24 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" aria-label={`Unit price for item ${index + 1}`} /></td><td className="border-b border-[var(--border-color)] px-2 py-3"><PercentInput value={item.discount_rate} onChange={(value) => updateItem(item.row_id, "discount_rate", value)} label={`Discount for item ${index + 1}`} /></td><td className="border-b border-[var(--border-color)] px-2 py-3"><PercentInput value={item.tax_rate} onChange={(value) => updateItem(item.row_id, "tax_rate", value)} label={`Tax for item ${index + 1}`} /></td><td className="whitespace-nowrap border-b border-[var(--border-color)] px-2 py-3 text-[10px] font-medium text-[var(--text-secondary)]">{money(itemTax)}</td><td className="whitespace-nowrap border-b border-[var(--border-color)] px-2 py-3 text-xs font-bold text-[var(--text-primary)]">{money(Math.max(0, gross - itemDiscount + itemTax))}</td><td className="quote-no-print border-b border-[var(--border-color)] px-2 py-3"><div className="flex justify-center gap-1.5"><button type="button" onClick={() => removeItem(item.row_id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100" aria-label={`Remove item ${index + 1}`}><Trash2 size={13} /></button></div></td></tr>;
        })}</tbody></table></div>{form.items.length > 10 && <div className="quote-no-print flex justify-center border-t border-[var(--border-color)] px-3 py-3"><button type="button" onClick={() => setShowAllQuoteItems((show) => !show)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">{showAllQuoteItems ? "Show less" : `Show ${form.items.length - 10} more items`}<ChevronDown size={14} className={`transition-transform ${showAllQuoteItems ? "rotate-180" : ""}`} /></button></div>}</> : <div className="m-3 flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-[var(--bg-tertiary)]/55 to-[var(--bg-card)] px-5 py-8 text-center sm:m-4 sm:min-h-[280px]"><span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-400 shadow-inner"><Package size={30} strokeWidth={1.8} /></span><h3 className="text-sm font-bold text-[var(--text-primary)]">{productsLoading ? "Loading products..." : "No products added"}</h3><p className="mt-1.5 max-w-sm text-[11px] leading-5 text-[var(--text-muted)]">Add products to enter unit price, quantity, discount, and tax details.</p><button type="button" onClick={openProductPicker} className="quote-no-print mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-xs font-bold text-white shadow-[0_5px_15px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:shadow-lg"><Search size={14} /> Browse products</button></div>}
        {form.items.length > 0 && <div className="m-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-3 sm:m-4"><label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)]" htmlFor="quote-notes"><FileText size={12} className="text-blue-600" /> Add notes (optional)</label><textarea id="quote-notes" value={form.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={1000} rows={2} placeholder="Enter any additional notes about this quote..." className="w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 text-[10px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-blue-400" /><p className="text-right text-[9px] text-[var(--text-muted)]">{form.notes.length} / 1000</p></div>}
      </section>

      <aside className="space-y-3">
        <CalculationSummaryCard
          itemCount={form.items.length}
          documentLabel="quote"
          totals={totals}
          discountType={form.overall_discount_type}
          discountValue={form.overall_discount_rate}
          onDiscountTypeChange={(value) => setField("overall_discount_type", value)}
          onDiscountValueChange={(value) => setField("overall_discount_rate", value)}
          taxRate={form.tax_rate}
          onTaxRateChange={(value) => setField("tax_rate", value)}
          money={money}
        />
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><CalendarDays size={15} /></span><div><h2 className="text-xs font-extrabold text-[var(--text-primary)]">Offer Validity</h2><p className="mt-0.5 text-[9px] text-[var(--text-muted)]">Expiry date for this quote</p></div></div>
          <div className="p-3"><div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm"><CalendarDays size={16} /></span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700">Valid until</p><p className="mt-0.5 truncate text-sm font-extrabold text-emerald-900">{form.expiry_date ? new Date(`${form.expiry_date}T00:00:00`).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "Choose an expiry date"}</p></div></div></div>
        </section>

      </aside>
    </div>

    {productPickerOpen && <div className="quote-no-print fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setProductPickerOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="quote-variant-picker-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <header className="shrink-0 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card-alt)] to-[var(--bg-tertiary)] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md"><Package size={19} /></span><div><h2 id="quote-variant-picker-title" className="text-base font-extrabold tracking-tight text-[var(--text-primary)]">Add variants</h2><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Select product variants to add to this quote.</p></div></div><button type="button" onClick={() => setProductPickerOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]" aria-label="Close variant picker"><X size={15} /></button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input autoFocus value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} placeholder="Search variant, product, or SKU..." className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>
            <select value={productCategory} onChange={(event) => { setProductCategory(event.target.value); setProductPage(1); }} aria-label="Filter variants by category" className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="all">Category: All</option>{productCategories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
            <select value={productBrand} onChange={(event) => { setProductBrand(event.target.value); setProductPage(1); }} aria-label="Filter variants by brand" className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="all">Brand: All</option>{productBrands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-secondary)]/35 px-3 py-2 sm:px-4">
          {productsLoading ? <div className="p-10 text-center text-xs font-medium text-[var(--text-muted)]">Loading variants...</div> : visibleVariants.length ? <div className="space-y-1.5">{visibleVariants.map((variant) => {
            const alreadyAdded = form.items.some((item) => String(item.variant_id) === variant.id);
            const checked = selectedVariantIds.includes(variant.id);
            return <label key={variant.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition sm:px-4 ${alreadyAdded ? "cursor-not-allowed border-emerald-200 bg-emerald-50/60 opacity-75" : checked ? "border-blue-300 bg-blue-50/80 shadow-sm" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-blue-200 hover:bg-blue-50/40"}`}>
              <input type="checkbox" checked={alreadyAdded || checked} disabled={alreadyAdded} onChange={(event) => setSelectedVariantIds((current) => event.target.checked ? [...current, variant.id] : current.filter((id) => id !== variant.id))} className="h-4 w-4 shrink-0 rounded border-[var(--border-color)] accent-blue-600" aria-label={`Select ${variant.name} ${variant.variant}`} />
              {variant.image ? <Image src={getImageUrl(variant.image)} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Package size={18} /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[var(--text-primary)]">{variant.name} <span className="font-medium text-[var(--text-secondary)]">/ {variant.variant}</span></span><span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]">{[variant.sku && `SKU ${variant.sku}`, `Stock ${variant.stock}`, variant.categoryName, variant.brandName].filter(Boolean).join(" · ")}</span></span>
              <span className="hidden shrink-0 text-right sm:block"><span className="block text-xs font-bold text-[var(--text-primary)]">{money(variant.price)}</span><span className="text-[9px] text-[var(--text-muted)]">Unit price</span></span>
              {alreadyAdded && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">Added</span>}
            </label>;
          })}</div> : <div className="p-10 text-center"><p className="text-sm font-bold text-[var(--text-primary)]">No variants found</p><p className="mt-1 text-xs text-[var(--text-muted)]">Try a different search or filter.</p></div>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 sm:px-5"><div className="text-[10px] font-medium text-[var(--text-muted)]">Page {productPage} / {pickerPageCount} ({matchingProducts.length} variants) · {selectedVariantIds.length} selected</div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={productPage <= 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40">Previous</button><button type="button" disabled={productPage >= pickerPageCount} onClick={() => setProductPage((page) => Math.min(pickerPageCount, page + 1))} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40">Next</button><button type="button" disabled={!selectedVariantIds.length} onClick={addSelectedProducts} className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">Add selected ({selectedVariantIds.length})</button><button type="button" onClick={() => setProductPickerOpen(false)} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)]">Close</button></div></footer>
      </section>
    </div>}
    <CustomerFormModal open={customerModalOpen} form={newCustomer} setForm={setNewCustomer} isPending={createCustomerMutation.isPending} onSave={submitNewCustomer} onClose={() => { if (!createCustomerMutation.isPending) setCustomerModalOpen(false); }} />
  </div>;
}

function Required() { return <span className="text-rose-500">*</span>; }
function SectionTitle({ icon: Icon, title, trailing, className = "mb-3" }) { return <div className={`flex items-center gap-2.5 ${className}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm"><Icon size={15} /></span><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">{title}</h2>{trailing && <div className="ml-auto">{trailing}</div>}</div>; }
function PercentInput({ value, onChange, label: ariaLabel }) { return <div className="flex h-9 w-[88px] items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10"><input type="number" min="0" max="100" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none" aria-label={ariaLabel} /><span className="ml-1 text-[10px] font-medium text-[var(--text-muted)]">%</span></div>; }
function SummaryRow({ label: title, value }) { return <div className="flex items-center justify-between gap-2"><span className="text-[9px] text-[var(--text-secondary)]">{title}</span><span className="text-[9px] font-semibold">{value}</span></div>; }
