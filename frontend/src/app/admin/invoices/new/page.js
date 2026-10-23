"use client";import { useTranslation } from "@/i18n/LanguageProvider";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  Package, Plus, Save, Search, Trash2, UserRound, X } from
"lucide-react";
import { toast } from "sonner";
import { invoiceApi } from "@/apis/admin/invoiceApi";
import { quoteApi } from "@/apis/admin/quoteApi";
import { customerApi } from "@/apis/admin/customerApi";
import { variantApi } from "@/apis/admin/variantApi";
import { stockApi } from "@/apis/admin/stockApi";
import CalculationSummaryCard from "@/components/admin/CalculationSummaryCard";

const today = () => {const value = new Date();return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;};
const PAYMENT_TERM_DAYS = { "Due on receipt": 0, "Net 7": 7, "Net 14": 14, "Net 30": 30 };
const calculateDueDate = (invoiceDate, paymentTerms) => {
  if (!invoiceDate || paymentTerms === "Custom") return "";
  const [year, month, day] = invoiceDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + (PAYMENT_TERM_DAYS[paymentTerms] ?? 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const money = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
const listOf = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => !url || /^(https?:|blob:|data:)/i.test(url) ? url || "" : API_ORIGIN ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}` : url;
const card = "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const input = "h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-card)] focus:ring-4 focus:ring-blue-500/10";
const label = "mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]";
const rowId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const emptyInvoice = () => ({ customer_id: "", customer_name: "", customer_email: "", customer_phone: "", customer_address: "", invoice_date: today(), due_date: today(), payment_terms: "Due on receipt", overall_discount_rate: "0", overall_discount_type: "percent", tax_rate: "0", bank_details: "", terms: "", items: [] });

export default function NewInvoicePage() {const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyInvoice);
  const [prefillCustomerId, setPrefillCustomerId] = useState("");
  const [prefillQuoteId, setPrefillQuoteId] = useState("");
  const appliedQuoteId = useRef("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("all");
  const [productBrand, setProductBrand] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [pickedVariants, setPickedVariants] = useState([]);
  const [showAllInvoiceItems, setShowAllInvoiceItems] = useState(false);

  const { data: rawCustomers = [] } = useQuery({ queryKey: ["invoice-customers"], queryFn: () => customerApi.getAll({ limit: 500 }) });
  const { data: prefilledCustomer } = useQuery({ queryKey: ["invoice-customer-prefill", prefillCustomerId], queryFn: () => customerApi.getById(prefillCustomerId), enabled: Boolean(prefillCustomerId && !prefillQuoteId) });
  const { data: prefilledQuote } = useQuery({ queryKey: ["invoice-quote-prefill", prefillQuoteId], queryFn: () => quoteApi.getById(prefillQuoteId), enabled: Boolean(prefillQuoteId) });
  const { data: rawStock = [] } = useQuery({ queryKey: ["invoice-product-stock"], queryFn: stockApi.getAll, staleTime: 2 * 60 * 1000 });
  const { data: rawVariants = [], isLoading: productsLoading } = useQuery({ queryKey: ["invoice-variants"], queryFn: variantApi.getAll, staleTime: 2 * 60 * 1000 });
  const customers = useMemo(() => listOf(rawCustomers).filter((customer) => !customer.is_deleted), [rawCustomers]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPrefillCustomerId(params.get("customer") || "");
    setPrefillQuoteId(params.get("quote") || "");
  }, []);
  useEffect(() => {
    if (!prefillCustomerId || prefillQuoteId) return;
    const customer = prefilledCustomer;
    if (!customer) return;
    setForm((current) => {
      const next = { customer_id: customer._id, customer_name: customer.name || "", customer_email: customer.email || "", customer_phone: customer.phone || "", customer_address: customer.address || "" };
      if (current.customer_id === next.customer_id && current.customer_name === next.customer_name && current.customer_email === next.customer_email && current.customer_phone === next.customer_phone && current.customer_address === next.customer_address) return current;
      return { ...current, ...next };
    });
  }, [prefillCustomerId, prefilledCustomer, prefillQuoteId]);
  const variants = useMemo(() => {
    const stockByVariant = new Map();
    listOf(rawStock).forEach((item) => stockByVariant.set(String(item.variant_id?._id || item.variant_id || item._id || ""), item));
    return listOf(rawVariants).filter((variant) => !variant.is_deleted).map((variant) => {
      const stock = stockByVariant.get(String(variant._id || "")) || {};
      const product = variant.product_id && typeof variant.product_id === "object" ? variant.product_id : {};
      const productId = product._id || variant.product_id || "";
      return { id: String(variant._id || ""), product_id: String(productId), productName: stock.product_name || product.name || variant.name || "Product", variantName: variant.title || variant.sku || "Variant", sku: variant.sku || "", price: Number(variant.selling_price ?? stock.selling_price ?? stock.sell_price ?? 0), image: variant.images?.[0]?.img_url || stock.image || "", stock: Number(variant.quantity ?? stock.quantity ?? stock.stock ?? 0), categoryId: String(stock.category_id?._id || stock.category_id || ""), categoryName: stock.category_name || stock.category_id?.name || "", brandId: String(stock.brand_id?._id || stock.brand_id || ""), brandName: stock.brand_name || stock.brand_id?.name || "" };
    }).filter((variant) => variant.id && variant.product_id);
  }, [rawVariants, rawStock]);
  useEffect(() => {
    if (!prefillQuoteId || !prefilledQuote || productsLoading || appliedQuoteId.current === prefillQuoteId) return;
    const quoteItems = (prefilledQuote.items || []).map((item) => {
      const variantId = String(item.variant_id?._id || item.variant_id || "");
      const selectedVariant = variants.find((variant) => variant.id === variantId);
      return {
        row_id: rowId(),
        product_id: String(item.product_id?._id || item.product_id || selectedVariant?.product_id || ""),
        variant_id: variantId,
        name: item.name || selectedVariant?.productName || "",
        variant_name: "",
        sku: item.sku || selectedVariant?.sku || "",
        image: selectedVariant?.image || "",
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        discount_rate: Number(item.discount_rate) || 0,
        tax_rate: Number(item.tax_rate) || 0
      };
    });
    setForm((current) => ({
      ...current,
      customer_id: String(prefilledQuote.customer_id?._id || prefilledQuote.customer_id || ""),
      customer_name: prefilledQuote.customer_name || "",
      customer_email: prefilledQuote.customer_email || "",
      customer_phone: prefilledQuote.customer_phone || "",
      customer_address: prefilledQuote.customer_address || "",
      overall_discount_rate: String(prefilledQuote.overall_discount_rate ?? 0),
      overall_discount_type: "percent",
      tax_rate: String(prefilledQuote.tax_rate ?? 0),
      terms: prefilledQuote.terms || "",
      items: quoteItems
    }));
    appliedQuoteId.current = prefillQuoteId;
  }, [prefillQuoteId, prefilledQuote, productsLoading, variants]);
  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return customers.filter((customer) => !query || [customer.name, customer.email, customer.phone].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [customers, customerSearch]);
  const filteredVariants = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return variants.filter((variant) => {
      const matchesQuery = !query || `${variant.productName} ${variant.variantName} ${variant.sku}`.toLowerCase().includes(query);
      return matchesQuery && (productCategory === "all" || variant.categoryId === productCategory) && (productBrand === "all" || variant.brandId === productBrand);
    });
  }, [variants, productSearch, productCategory, productBrand]);
  const productCategories = useMemo(() => [...new Map(variants.filter((item) => item.categoryId && item.categoryName).map((item) => [item.categoryId, item.categoryName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [variants]);
  const productBrands = useMemo(() => [...new Map(variants.filter((item) => item.brandId && item.brandName).map((item) => [item.brandId, item.brandName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [variants]);
  const pickerPageCount = Math.max(1, Math.ceil(filteredVariants.length / 8));
  const visibleVariants = filteredVariants.slice((productPage - 1) * 8, productPage * 8);
  const visibleInvoiceItems = showAllInvoiceItems ? form.items : form.items.slice(0, 10);
  const selectedCustomer = customers.find((customer) => String(customer._id) === String(form.customer_id)) || (
  String(prefilledCustomer?._id) === String(form.customer_id) ? prefilledCustomer : null) || (
  prefilledQuote && form.customer_id && String(prefilledQuote.customer_id?._id || prefilledQuote.customer_id || "") === String(form.customer_id) ?
  { _id: form.customer_id, name: prefilledQuote.customer_name || "" } :
  null);

  const totals = useMemo(() => {
    const subtotal = round(form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0));
    const itemDiscount = round(form.items.reduce((sum, item) => sum + round(Number(item.quantity || 0) * Number(item.unit_price || 0) * Number(item.discount_rate || 0) / 100), 0));
    const discountBase = Math.max(0, subtotal - itemDiscount);
    const discountInput = Math.max(0, Number(form.overall_discount_rate || 0));
    const overallDiscount = round(form.overall_discount_type === "flat" ? Math.min(discountBase, discountInput) : discountBase * Math.min(100, discountInput) / 100);
    const itemTax = round(form.items.reduce((sum, item) => {
      const base = Number(item.quantity || 0) * Number(item.unit_price || 0);
      return sum + round((base - base * Number(item.discount_rate || 0) / 100) * Number(item.tax_rate || 0) / 100);
    }, 0));
    const overallTax = round(Math.max(0, discountBase - overallDiscount) * Math.min(100, Math.max(0, Number(form.tax_rate || 0))) / 100);
    const discount = round(itemDiscount + overallDiscount);
    const tax = round(itemTax + overallTax);
    return { subtotal, itemDiscount, overallDiscount, discount, itemTax, overallTax, tax, total: round(subtotal - discount + tax) };
  }, [form.items, form.overall_discount_rate, form.overall_discount_type, form.tax_rate]);

  const payload = () => ({
    customer_id: form.customer_id,
    customer_name: form.customer_name,
    customer_email: form.customer_email,
    customer_phone: form.customer_phone,
    customer_address: form.customer_address,
    invoice_date: form.invoice_date,
    due_date: form.due_date,
    payment_terms: form.payment_terms === "Custom" ? form.custom_payment_terms : form.payment_terms,
    status: "Unpaid",
    overall_discount_rate: form.overall_discount_rate,
    overall_discount_type: form.overall_discount_type,
    tax_rate: form.tax_rate,
    bank_details: form.bank_details,
    terms: form.terms,
    items: form.items.map(({ row_id, variant_name, ...item }) => ({ ...item, name: variant_name ? `${item.name} / ${variant_name}` : item.name }))
  });
  const canSubmit = Boolean(form.customer_id && form.customer_name.trim() && form.invoice_date && form.due_date && form.items.length);
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const draftMutation = useMutation({
    mutationFn: () => invoiceApi.create(payload()),
    onSuccess: async (invoice) => {
      toast.success(`${invoice.invoice_number} saved successfully`);
      await queryClient.invalidateQueries({ queryKey: ["stock"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-product-stock"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-variants"] });
      await queryClient.invalidateQueries({ queryKey: ["invoices-admin"] });
      router.push("/admin/invoices");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not save invoice")
  });
  const selectCustomer = (customer) => {
    setForm((current) => ({ ...current, customer_id: customer._id, customer_name: customer.name || "", customer_email: customer.email || "", customer_phone: customer.phone || "", customer_address: customer.address || "" }));
    setCustomerOpen(false);
    setCustomerSearch("");
  };
  const openProductPicker = () => {setProductSearch("");setProductCategory("all");setProductBrand("all");setProductPage(1);setPickedVariants([]);setProductPickerOpen(true);};
  const toggleProduct = (variantId) => setPickedVariants((current) => current.includes(variantId) ? current.filter((id) => id !== variantId) : [...current, variantId]);
  const addSelectedProducts = () => {
    const additions = pickedVariants.map((id) => variants.find((variant) => variant.id === id)).filter((variant) => variant && !form.items.some((item) => String(item.variant_id) === variant.id)).map((variant) => ({ row_id: rowId(), product_id: variant.product_id, variant_id: variant.id, name: variant.productName, variant_name: variant.variantName, sku: variant.sku, image: variant.image, quantity: 1, unit_price: variant.price, discount_rate: 0, tax_rate: 0 }));
    setForm((current) => ({ ...current, items: [...current.items, ...additions] }));
    setPickedVariants([]);
    setProductSearch("");
    setProductPickerOpen(false);
  };
  const updateItem = (id, key, value) => setForm((current) => ({ ...current, items: current.items.map((item) => item.row_id === id ? { ...item, [key]: value } : item) }));
  const removeItem = (id) => setForm((current) => ({ ...current, items: current.items.filter((item) => item.row_id !== id) }));
  return <div className="invoice-create-page w-full space-y-2.5 pb-5 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><div className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)]"><button onClick={() => router.push("/admin/invoices")} className="transition hover:text-blue-600">{t("admin.quoteInvoice.ui.invoices_35f8f37b")}</button><ChevronRight size={11} /><span>{t("admin.quoteInvoice.ui.create_new_invoice_1804881a")}</span></div><h1 className="text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">{t("admin.quoteInvoice.ui.create_new_invoice_1804881a")}</h1><p className="mt-0.5 text-[10px] text-[var(--text-muted)] sm:text-xs">{t("admin.quoteInvoice.ui.fill_in_the_details_below_to_create_a_new_invoice_for_yo_fdcff0fd")}</p></div>
      <div className="flex flex-wrap gap-1.5"><button type="button" disabled={!canSubmit || draftMutation.isPending} onClick={() => draftMutation.mutate()} className="invoice-primary-btn"><Save size={12} /> {draftMutation.isPending ? "Saving..." : "Save Invoice"}</button></div>
    </header>

    <div className="grid items-stretch gap-3 md:grid-cols-2">
      <section className={`${card} invoice-po-card flex h-full flex-col overflow-visible bg-gradient-to-br from-white via-white to-slate-50/70`}>
        <div className="flex items-center gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]"><UserRound size={15} /></span><div><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.1_customer_information_c04df194")}</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.select_a_customer_and_confirm_their_contact_details_9f5fec5c")}</p></div></div></div>
        <div className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5"><div className="grid flex-1 gap-3 sm:grid-cols-2"><div className="relative sm:col-span-2"><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="invoice-customer">{t("admin.quoteInvoice.ui.customer_0e85749a")} <span className="text-rose-500">*</span></label><button id="invoice-customer" type="button" onClick={() => {setCustomerOpen(!customerOpen);setCustomerSearch("");}} className="flex h-10 w-full items-center justify-between gap-2 rounded-xl px-3 text-xs font-medium shadow-sm outline-none transition-all duration-200 hover:border-blue-300 hover:shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" style={{ backgroundColor: "#fff", border: "1px solid #dbe3ef", color: selectedCustomer ? "#0f172a" : "#64748b" }}><span className="flex min-w-0 items-center gap-2.5 truncate"><UserRound size={14} className="shrink-0 text-blue-600" />{selectedCustomer?.name || "Select Customer"}</span><ChevronDown size={15} className="shrink-0 text-slate-400" /></button>
          {customerOpen && <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="border-b border-slate-200 bg-slate-50 p-3"><input autoFocus value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder={t("admin.quoteInvoice.ui.search_by_customer_name_email_or_phone_b3268ad1")} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-200" /></div><div className="max-h-56 overflow-y-auto px-2 py-1">{filteredCustomers.map((customer) => <button key={customer._id} type="button" onClick={() => selectCustomer(customer)} className="my-0.5 w-full rounded-xl px-4 py-3 text-left text-[13px] transition hover:bg-slate-50"><span className="block text-sm font-bold text-slate-900">{customer.name}</span><span className="text-[11px] text-slate-500">{customer.email || customer.phone}</span></button>)}{!filteredCustomers.length && <p className="px-4 py-6 text-center text-sm text-slate-400">{t("admin.quoteInvoice.ui.no_customers_found_5288ca15")}</p>}</div></div>}</div>
          <div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="customer-name">{t("admin.quoteInvoice.ui.customer_name_75636316")} <span className="text-rose-500">*</span></label><input id="customer-name" className="invoice-po-input" value={form.customer_name} onChange={(e) => setField("customer_name", e.target.value)} placeholder={t("admin.quoteInvoice.ui.enter_customer_name_e5fee2c5")} /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="customer-email">{t("admin.quoteInvoice.ui.email_84add5b2")}</label><input id="customer-email" type="email" className="invoice-po-input" value={form.customer_email} onChange={(e) => setField("customer_email", e.target.value)} placeholder={t("admin.quoteInvoice.ui.enter_email_address_122a389d")} /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="customer-phone">{t("admin.quoteInvoice.ui.phone_77064d52")}</label><input id="customer-phone" className="invoice-po-input" value={form.customer_phone} onChange={(e) => setField("customer_phone", e.target.value)} placeholder={t("admin.quoteInvoice.ui.enter_phone_number_a2260785")} /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="payment-terms">{t("admin.quoteInvoice.ui.payment_terms_abb6fb9c")}</label><select id="payment-terms" className="invoice-po-input" value={form.payment_terms} onChange={(e) => {const paymentTerms = e.target.value;setForm((current) => ({ ...current, payment_terms: paymentTerms, due_date: paymentTerms === "Custom" ? current.due_date : calculateDueDate(current.invoice_date, paymentTerms) }));}}><option>{t("admin.quoteInvoice.ui.due_on_receipt_f8944228")}</option><option>{t("admin.quoteInvoice.ui.net_7_0c66a0f2")}</option><option>{t("admin.quoteInvoice.ui.net_14_d4f0e706")}</option><option>{t("admin.quoteInvoice.ui.net_30_66a1e43c")}</option><option>{t("admin.quoteInvoice.ui.custom_081ae3fd")}</option></select></div><div className="flex flex-col sm:col-span-2"><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="customer-address">{t("admin.quoteInvoice.ui.shipping_address_dbd7c38d")}</label><textarea id="customer-address" rows={2} value={form.customer_address} onChange={(e) => setField("customer_address", e.target.value)} placeholder={t("admin.quoteInvoice.ui.enter_shipping_address_f16d3803")} className="invoice-po-input min-h-20 flex-1 resize-y py-2.5" /></div></div></div>
      </section>

      <section className={`${card} invoice-po-card flex h-full flex-col overflow-hidden bg-gradient-to-br from-white via-white to-slate-50/70`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]"><CalendarDays size={15} /></span><div><h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.2_invoice_details_cc68c2bb")}</h2><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.set_the_invoice_schedule_and_payment_conditions_98551869")}</p></div></div><span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">{t("admin.quoteInvoice.ui.required_eed6bfb4")} <b className="text-rose-500">*</b></span></div>
        <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5"><div className="grid gap-x-4 gap-y-3 sm:grid-cols-2"><div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="invoice-date">{t("admin.quoteInvoice.ui.invoice_date_844828da")} <span className="text-rose-500">*</span></label><input id="invoice-date" type="date" className="invoice-po-input" value={form.invoice_date} onChange={(e) => {const invoiceDate = e.target.value;setForm((current) => ({ ...current, invoice_date: invoiceDate, due_date: current.payment_terms === "Custom" ? current.due_date : calculateDueDate(invoiceDate, current.payment_terms) }));}} /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="due-date">{t("admin.quoteInvoice.ui.due_date_a1b308ec")} <span className="text-rose-500">*</span></label><input id="due-date" type="date" className="invoice-po-input" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} /></div></div><div className="flex min-h-24 flex-1 flex-col"><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="invoice-bank">{t("admin.quoteInvoice.ui.bank_details_7bc4a700")}</label><textarea id="invoice-bank" rows={2} value={form.bank_details} onChange={(e) => setField("bank_details", e.target.value)} placeholder={t("admin.quoteInvoice.ui.enter_bank_details_895cab1a")} className="invoice-po-input min-h-20 flex-1 resize-y py-2.5" /></div>
          <div className="flex min-h-28 flex-1 flex-col"><label className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]" htmlFor="invoice-terms">{t("admin.quoteInvoice.ui.terms_conditions_d35f2b98")}</label><textarea id="invoice-terms" rows={3} maxLength={5000} value={form.terms} onChange={(e) => setField("terms", e.target.value)} placeholder={t("admin.quoteInvoice.ui.add_payment_terms_delivery_details_or_other_conditions_ebc1dad7")} className="invoice-po-input min-h-24 flex-1 resize-y py-2.5" /><div className="mt-1 flex justify-between text-[9px] text-[var(--text-muted)]"></div></div></div>
      </section>
    </div>

    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
    <section className={`${card} min-w-0 overflow-visible`}>
      <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]"><Package size={17} /></span><h2 className="truncate text-sm font-extrabold tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.3_products_items_650fba2c")}</h2><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">{form.items.length} {t("admin.quoteInvoice.ui.in_invoice_be08c44d")}</span></div><button type="button" onClick={openProductPicker} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-500/15"><Plus size={14} /> {t("admin.quoteInvoice.ui.add_product_ee611e53")}</button></div>
      {form.items.length ? <><div className="overflow-x-auto px-3 pt-3"><table className="w-full min-w-[980px] border-separate border-spacing-0 text-left"><thead className="bg-[var(--bg-card-alt)] text-[9px] font-bold uppercase tracking-wide text-[var(--text-secondary)]"><tr><th className="w-8 rounded-l-xl px-2 py-3">#</th><th className="min-w-56 px-2 py-3">{t("admin.quoteInvoice.ui.product_variant_fa53c5ab")}</th><th className="w-20 px-2 py-3">{t("admin.quoteInvoice.ui.sku_d59192b9")}</th><th className="w-20 px-2 py-3">{t("admin.quoteInvoice.ui.quantity_44f6af69")}</th><th className="w-28 px-2 py-3">{t("admin.quoteInvoice.ui.unit_price_1eea68d0")}</th><th className="w-24 px-2 py-3">{t("admin.quoteInvoice.ui.discount_b524936d")}</th><th className="w-24 px-2 py-3">{t("admin.quoteInvoice.ui.tax_88066d9f")}</th><th className="w-24 px-2 py-3">{t("admin.quoteInvoice.ui.tax_amount_0f48af8f")}</th><th className="w-28 px-2 py-3">{t("admin.quoteInvoice.ui.total_b25928c6")}</th><th className="w-20 rounded-r-xl px-2 py-3 text-center">{t("admin.quoteInvoice.ui.actions_c3cd636a")}</th></tr></thead><tbody className="divide-y divide-[var(--border-color)]">{visibleInvoiceItems.map((item, index) => {const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);const discount = gross * Number(item.discount_rate || 0) / 100;const tax = (gross - discount) * Number(item.tax_rate || 0) / 100;const product = variants.find((variant) => variant.id === String(item.variant_id));return <tr key={item.row_id} className="group transition-colors hover:bg-[var(--bg-tertiary)]/45"><td className="border-b border-[var(--border-color)] px-2 py-3 text-[10px] font-medium text-[var(--text-muted)]">{index + 1}</td><td className="border-b border-[var(--border-color)] px-2 py-3"><div className="flex min-w-0 items-center gap-3">{item.image || product?.image ? <Image src={getImageUrl(item.image || product?.image)} alt="" width={48} height={48} unoptimized className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover shadow-sm" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Package size={19} /></span>}<span className="min-w-0"><span className="block truncate text-xs font-bold text-[var(--text-primary)]">{item.name.split(" / ")[0]}</span><span className="mt-1 block truncate text-[10px] text-[var(--text-muted)]">{item.variant_name || item.name.split(" / ").slice(1).join(" / ") || "Selected variant"}</span></span></div></td><td className="border-b border-[var(--border-color)] px-2 py-3 text-[9px] font-medium text-[var(--text-muted)]">{item.sku || "—"}</td><td className="border-b border-[var(--border-color)] px-2 py-3"><input type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateItem(item.row_id, "quantity", e.target.value)} className="h-9 w-[68px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" aria-label={`Quantity for item ${index + 1}`} /></td><td className="border-b border-[var(--border-color)] px-2 py-3"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(item.row_id, "unit_price", e.target.value)} className="h-9 w-24 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10" aria-label={`Unit price for item ${index + 1}`} /></td><td className="border-b border-[var(--border-color)] px-2 py-3"><div className="flex h-9 w-[88px] items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10"><input type="number" min="0" max="100" step="0.01" value={item.discount_rate} onChange={(e) => updateItem(item.row_id, "discount_rate", e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none" aria-label={`Discount for item ${index + 1}`} /><span className="ml-1 text-[10px] text-[var(--text-muted)]">%</span></div></td><td className="border-b border-[var(--border-color)] px-2 py-3"><div className="flex h-9 w-[88px] items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10"><input type="number" min="0" max="100" step="0.01" value={item.tax_rate} onChange={(e) => updateItem(item.row_id, "tax_rate", e.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none" aria-label={`Tax for item ${index + 1}`} /><span className="ml-1 text-[10px] text-[var(--text-muted)]">%</span></div></td><td className="whitespace-nowrap border-b border-[var(--border-color)] px-2 py-3 text-[10px] font-medium text-[var(--text-secondary)]">{money(tax)}</td><td className="whitespace-nowrap border-b border-[var(--border-color)] px-2 py-3 text-xs font-bold text-[var(--text-primary)]">{money(Math.max(0, gross - discount + tax))}</td><td className="border-b border-[var(--border-color)] px-2 py-3"><div className="flex justify-center"><button type="button" onClick={() => removeItem(item.row_id)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition hover:bg-rose-100" aria-label={`Remove item ${index + 1}`}><Trash2 size={13} /></button></div></td></tr>;})}</tbody></table></div>{form.items.length > 10 && <div className="flex justify-center border-t border-[var(--border-color)] px-3 py-3"><button type="button" onClick={() => setShowAllInvoiceItems((show) => !show)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-secondary)] shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">{showAllInvoiceItems ? "Show less" : `Show ${form.items.length - 10} more items`}<ChevronDown size={14} className={`transition-transform ${showAllInvoiceItems ? "rotate-180" : ""}`} /></button></div>}</> : <div className="m-3 flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-[var(--bg-tertiary)]/55 to-[var(--bg-card)] px-5 py-8 text-center sm:m-4 sm:min-h-[280px]"><span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-400 shadow-inner"><Package size={30} /></span><h3 className="text-sm font-bold text-[var(--text-primary)]">{productsLoading ? "Loading products..." : "No products added"}</h3><p className="mt-1.5 max-w-sm text-[11px] leading-5 text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.add_products_to_enter_unit_price_quantity_discount_and_t_7b5c8c07")}</p><button type="button" onClick={openProductPicker} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-xs font-bold text-white shadow-[0_5px_15px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5 hover:shadow-lg"><Search size={14} /> {t("admin.quoteInvoice.ui.browse_products_f55f1391")}</button></div>}
    </section>

    <aside className="space-y-3">
      <CalculationSummaryCard
          itemCount={form.items.length}
          documentLabel="invoice"
          totals={totals}
          discountType={form.overall_discount_type}
          discountValue={form.overall_discount_rate}
          onDiscountTypeChange={(value) => setField("overall_discount_type", value)}
          onDiscountValueChange={(value) => setField("overall_discount_rate", value)}
          taxRate={form.tax_rate}
          onTaxRateChange={(value) => setField("tax_rate", value)}
          money={money} />
            </aside>
    </div>

    {productPickerOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => {if (event.target === event.currentTarget) setProductPickerOpen(false);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="invoice-variant-picker-title" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
        <header className="shrink-0 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card-alt)] to-[var(--bg-tertiary)] px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md"><Package size={19} /></span><div><h2 id="invoice-variant-picker-title" className="text-base font-extrabold tracking-tight text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.add_variants_e6eac24a")}</h2><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.select_product_variants_to_add_to_this_invoice_c176fde3")}</p></div></div><button type="button" onClick={() => setProductPickerOpen(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]" aria-label={t("admin.quoteInvoice.ui.close_variant_picker_68daa0cb")}><X size={15} /></button></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
            <label className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input autoFocus value={productSearch} onChange={(event) => {setProductSearch(event.target.value);setProductPage(1);}} placeholder={t("admin.quoteInvoice.ui.search_variant_product_or_sku_2d76140d")} className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>
            <select value={productCategory} onChange={(event) => {setProductCategory(event.target.value);setProductPage(1);}} aria-label={t("admin.quoteInvoice.ui.filter_variants_by_category_24e24ad7")} className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="all">{t("admin.quoteInvoice.ui.category_all_fa64de7f")}</option>{productCategories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
            <select value={productBrand} onChange={(event) => {setProductBrand(event.target.value);setProductPage(1);}} aria-label={t("admin.quoteInvoice.ui.filter_variants_by_brand_a2a92101")} className="h-10 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"><option value="all">{t("admin.quoteInvoice.ui.brand_all_e9ed4ce7")}</option>{productBrands.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-secondary)]/35 px-3 py-2 sm:px-4">
          {productsLoading ? <div className="p-10 text-center text-xs font-medium text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.loading_variants_6cd37794")}</div> : visibleVariants.length ? <div className="space-y-1.5">{visibleVariants.map((variant) => {
              const alreadyAdded = form.items.some((item) => String(item.variant_id) === variant.id);
              const checked = pickedVariants.includes(variant.id);
              return <label key={variant.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition sm:px-4 ${alreadyAdded ? "cursor-not-allowed border-emerald-200 bg-emerald-50/60 opacity-75" : checked ? "border-blue-300 bg-blue-50/80 shadow-sm" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-blue-200 hover:bg-blue-50/40"}`}>
              <input type="checkbox" checked={alreadyAdded || checked} disabled={alreadyAdded} onChange={(event) => setPickedVariants((current) => event.target.checked ? [...current, variant.id] : current.filter((id) => id !== variant.id))} className="h-4 w-4 shrink-0 rounded border-[var(--border-color)] accent-blue-600" aria-label={`Select ${variant.productName} ${variant.variantName}`} />
              {variant.image ? <Image src={getImageUrl(variant.image)} alt="" width={44} height={44} unoptimized className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Package size={18} /></span>}
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[var(--text-primary)]">{variant.productName} <span className="font-medium text-[var(--text-secondary)]">/ {variant.variantName}</span></span><span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]">{[variant.sku && `SKU ${variant.sku}`, `Stock ${variant.stock}`, variant.categoryName, variant.brandName].filter(Boolean).join(" · ")}</span></span>
              <span className="hidden shrink-0 text-right sm:block"><span className="block text-xs font-bold text-[var(--text-primary)]">{money(variant.price)}</span><span className="text-[9px] text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.unit_price_3c6c777f")}</span></span>{alreadyAdded && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">{t("admin.quoteInvoice.ui.added_b68734c2")}</span>}
            </label>;
            })}</div> : <div className="p-10 text-center"><p className="text-sm font-bold text-[var(--text-primary)]">{t("admin.quoteInvoice.ui.no_variants_found_3f4b71fc")}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.try_a_different_search_or_filter_4e653834")}</p></div>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 sm:px-5"><div className="text-[10px] font-medium text-[var(--text-muted)]">{t("admin.quoteInvoice.ui.page_fb06270f")} {productPage} / {pickerPageCount} ({filteredVariants.length} {t("admin.quoteInvoice.ui.variants_029f924f")} {pickedVariants.length} {t("admin.quoteInvoice.ui.selected_835f3b50")}</div><div className="flex flex-wrap items-center gap-2"><button type="button" disabled={productPage <= 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40">{t("admin.quoteInvoice.ui.previous_50f94286")}</button><button type="button" disabled={productPage >= pickerPageCount} onClick={() => setProductPage((page) => Math.min(pickerPageCount, page + 1))} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:opacity-40">{t("admin.quoteInvoice.ui.next_bc981983")}</button><button type="button" disabled={!pickedVariants.length} onClick={addSelectedProducts} className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-45">{t("admin.quoteInvoice.ui.add_selected_763795a2")}{pickedVariants.length})</button><button type="button" onClick={() => setProductPickerOpen(false)} className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)]">{t("admin.quoteInvoice.ui.close_bbfa773e")}</button></div></footer>
      </section>
    </div>}    <style jsx global>{`
      .invoice-create-page { color: #172554; }
      .invoice-po-card { transition: box-shadow .2s ease,border-color .2s ease; }
      .invoice-po-card:hover { border-color: #bfdbfe!important; box-shadow: 0 12px 28px rgba(15,23,42,.07),0 3px 10px rgba(37,99,235,.05)!important; }
      .invoice-po-input:not(textarea) { display:block; width:100%; height:40px; border:1px solid #dbe3ef; border-radius:10px; background:#fff; padding:0 12px; color:#0f172a; font-size:12px; font-weight:500; outline:none; box-shadow:0 1px 2px rgba(15,23,42,.04); transition:border-color .18s ease,box-shadow .18s ease; }
      .invoice-po-input:not(textarea):hover { border-color:#bfdbfe; }
      .invoice-po-input:not(textarea):focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.10); }
      .invoice-po-input::placeholder { color:#94a3b8; }
      textarea.invoice-po-input { width:100%; border:1px solid #dbe3ef; border-radius:10px; background:#fff; padding:10px 12px; color:#0f172a; font-size:12px; font-weight:500; outline:none; box-shadow:0 1px 2px rgba(15,23,42,.04); transition:border-color .18s ease,box-shadow .18s ease; }
      textarea.invoice-po-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.10); }
      .invoice-card { border: 1px solid #dce7f5; border-radius: 16px; background: linear-gradient(135deg,#fff 0%,#fbfdff 100%); box-shadow: 0 5px 18px rgba(30,64,175,.045); transition: box-shadow .18s ease,border-color .18s ease,transform .18s ease; }
      .invoice-card:hover { border-color: #c8dcfb; box-shadow: 0 8px 24px rgba(37,99,235,.09); }
      .invoice-section-title { display:flex; align-items:center; gap:10px; color:#14264e; font-size:14px; font-weight:800; letter-spacing:-.01em; }
      .invoice-icon { display:inline-flex; width:32px; height:32px; flex:none; align-items:center; justify-content:center; border-radius:11px; color:#fff; background:linear-gradient(135deg,#2563eb,#1d4ed8); box-shadow:0 4px 10px rgba(37,99,235,.2); }
      .invoice-label { display:block; margin-bottom:6px; color:#52678e; font-size:11px; font-weight:600; }
      .invoice-label b { color:#ef4444; }
      .invoice-input { display:block; width:100%; height:40px; border:1px solid #d9e3f1; border-radius:10px; background:#fff; padding:0 12px; color:#15274d; font-size:12px; outline:none; transition:border-color .16s ease,box-shadow .16s ease,background .16s ease; }
      .invoice-input::placeholder { color:#91a2bd; }
      .invoice-input:hover { border-color:#a9c5f2; }
      .invoice-input:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
      .invoice-mini-input { height:32px; border:1px solid #dce5f2; border-radius:8px; background:#fff; padding:0 8px; color:#20345e; font-size:11px; outline:none; }
      .invoice-mini-input:focus { border-color:#60a5fa; box-shadow:0 0 0 2px rgba(59,130,246,.12); }
      .invoice-input-addon { display:flex; height:32px; align-items:center; border:1px solid #dce5f2; border-left:0; border-radius:0 8px 8px 0; background:#f8fafc; padding:0 8px; color:#64748b; font-size:11px; }
      .invoice-outline-btn,.invoice-primary-btn,.invoice-small-blue,.invoice-cancel-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; white-space:nowrap; border-radius:9px; font-size:11px; font-weight:700; transition:all .16s ease; }
      .invoice-outline-btn { height:38px; border:1px solid #b8cefa; background:#fff; padding:0 14px; color:#1260f8; }
      .invoice-outline-btn:hover { transform:translateY(-1px); background:#f3f7ff; box-shadow:0 3px 8px rgba(37,99,235,.12); }
      .invoice-primary-btn { height:38px; border:1px solid #1258ec; background:linear-gradient(110deg,#236aff,#0750e9); padding:0 14px; color:#fff; box-shadow:0 3px 7px rgba(37,99,235,.18); }
      .invoice-primary-btn:hover { transform:translateY(-1px); box-shadow:0 5px 12px rgba(37,99,235,.26); }
      .invoice-primary-btn:disabled,.invoice-outline-btn:disabled { cursor:not-allowed; opacity:.48; transform:none; box-shadow:none; }
      .invoice-small-blue { height:32px; border:1px solid #d3e2ff; background:#f7faff; padding:0 12px; color:#1260f8; font-size:10px; }
      .invoice-small-blue:hover { background:#edf4ff; border-color:#9ebfff; }
      .invoice-cancel-btn { height:36px; border:1px solid #e5ebf3; background:#f8fafc; color:#64748b; }
      .invoice-cancel-btn:hover { background:#f1f5f9; color:#334155; }
      .invoice-adjust-row { display:flex; align-items:center; gap:7px; min-width:0; color:#52678e; font-size:10px; }
      .invoice-adjust-row label { flex:1; min-width:72px; }
      .invoice-adjust-row b { margin-left:auto; color:#334155; white-space:nowrap; }
      .invoice-create-page [class~="text-[8px]"] { font-size:10px!important; }
      .invoice-create-page [class~="text-[9px]"] { font-size:11px!important; }
      .invoice-create-page table th { padding:12px 10px; font-size:10px; }
      .invoice-create-page table td { padding-top:12px; padding-bottom:12px; }
      .invoice-create-page textarea.invoice-input { min-height:88px; padding-top:10px; padding-bottom:10px; }
      .invoice-create-page > header h1 { line-height:1.2; }
      @media print { .invoice-create-page { padding:0!important; } .invoice-create-page button { display:none!important; } .invoice-card { break-inside:avoid; box-shadow:none!important; } }
    `}</style>
  </div>;
}
