"use client";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quoteApi } from "@/apis/admin/quoteApi";
import { storeApi } from "@/apis/admin/storeApi";
import { customerApi } from "@/apis/admin/customerApi";
import { stockApi } from "@/apis/admin/stockApi";
import { variantApi } from "@/apis/admin/variantApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import QuoteTemplateDesigner, {
  getSavedQuotePdfDesign,
  QUOTE_TEMPLATE_STORAGE_KEY,
} from "@/components/admin/QuoteTemplateDesigner";
import { localizedField } from "@/i18n/localize";
import { toast } from "sonner";
import {
  Bolt,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
const localDateInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => localDateInput(new Date());
const defaultExpiry = () => {
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return localDateInput(value);
};
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const money = (value) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const card =
  "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]";
const input =
  "h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] hover:border-slate-300 focus:border-blue-500 focus:bg-[var(--bg-card)] focus:ring-4 focus:ring-blue-500/10";
const label =
  "mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]";
const unwrapList = (value) =>
  Array.isArray(value)
    ? value
    : value?.data || value?.items || value?.leads || [];
const rowId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => {
  if (!url || /^(https?:|blob:|data:)/i.test(url)) return url || "";
  return API_ORIGIN
    ? `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`
    : url;
};
const initialForm = (quote) =>
  quote
    ? {
        customer_type: quote.customer_type || "Customer",
        customer_key: quote.customer_id ? `customer:${quote.customer_id}` : "",
        customer_name: quote.customer_name || "",
        customer_email: quote.customer_email || "",
        customer_phone: quote.customer_phone || "",
        customer_address: quote.customer_address || "",
        quote_date: quote.quote_date?.slice(0, 10) || today(),
        expiry_date: quote.expiry_date?.slice(0, 10) || defaultExpiry(),
        terms: quote.terms || "",
        notes: quote.notes || "",
        tax_rate: String(quote.tax_rate || 0),
        overall_discount_rate: String(quote.overall_discount_rate || 0),
        overall_discount_type: "percent",
        items: (quote.items || []).map((item, index) => {
          const gross =
            Number(item.quantity || 0) * Number(item.unit_price || 0);
          return {
            ...item,
            row_id: item._id || `saved-${index}`,
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            discount_rate:
              item.discount_rate ??
              (gross ? round(((Number(item.discount) || 0) / gross) * 100) : 0),
            tax_rate: item.tax_rate || 0,
          };
        }),
      }
    : {
        customer_type: "Customer",
        customer_key: "",
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        customer_address: "",
        quote_date: today(),
        expiry_date: defaultExpiry(),
        terms: "",
        notes: "",
        tax_rate: "0",
        overall_discount_rate: "0",
        overall_discount_type: "percent",
        items: [],
      };
function QuotesNewContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quote");
  const customerId = searchParams.get("customer");
  const {
    data: quote,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["quote-admin", quoteId],
    queryFn: () => quoteApi.getById(quoteId),
    enabled: !!quoteId,
  });
  if (quoteId && isLoading)
    return (
      <div
        className={`${card} p-10 text-center text-sm text-[var(--text-muted)]`}
      >
        {t("admin.quoteInvoice.ui.loading_quote_674da72a")}
      </div>
    );
  if (quoteId && (isError || !["Pending", "Draft"].includes(quote?.status)))
    return (
      <div
        className={`${card} p-8 text-center text-sm text-[var(--text-secondary)]`}
      >
        {isError
          ? t("admin.quoteDesigner.loadQuoteFailed")
          : t("admin.quoteDesigner.pendingOnly")}
        <button
          type="button"
          onClick={() => router.push("/admin/quotes")}
          className="ml-2 font-semibold text-[var(--accent)]"
        >
          {t("admin.quoteInvoice.ui.back_to_quotes_433f26bf")}
        </button>
      </div>
    );
  return (
    <QuoteEditor
      key={`${quoteId || "new"}:${customerId || ""}`}
      quoteId={quoteId}
      quote={quote || null}
      customerId={customerId}
    />
  );
}
export default function NewQuotePage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-[var(--text-muted)]">
          {t("admin.quoteInvoice.ui.loading_quote_form_25988561")}
        </div>
      }
    >
      <QuotesNewContent />
    </Suspense>
  );
}
function QuoteEditor({ quoteId, quote, customerId }) {
  const { t, dir, locale } = useTranslation();
  const money = (value) =>
    new Intl.NumberFormat(locale || "en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(() => initialForm(quote));
  const [generatedQuoteNumber, setGeneratedQuoteNumber] = useState(
    quote?.quote_number || quote?.quoteNumber || quote?.quotation_number || "",
  );
  const [quoteNumberReservation, setQuoteNumberReservation] = useState("");
  const reservationRequestRef = useRef(null);
  const { data: companySettings } = useQuery({
    queryKey: ["admin-store-info"],
    queryFn: storeApi.get,
  });
  useEffect(() => {
    if (quoteId) return;
    let active = true;
    const storageKey = "admin-new-quote-number-reservation";
    let token = "";
    try {
      token = sessionStorage.getItem(storageKey) || "";
    } catch {}
    if (!reservationRequestRef.current)
      reservationRequestRef.current = quoteApi.reserveNumber(token);
    reservationRequestRef.current
      .then((reservation) => {
        if (!active) return;
        const nextToken = reservation?.reservation_token || "";
        setGeneratedQuoteNumber(reservation?.quote_number || "");
        setQuoteNumberReservation(nextToken);
        if (nextToken) {
          try {
            sessionStorage.setItem(storageKey, nextToken);
          } catch {}
        }
      })
      .catch((error) => {
        if (active)
          toast.error(
            error?.response?.data?.message ||
              t("admin.quoteInvoice.pdf.numberGenerationFailed"),
          );
      });
    return () => {
      active = false;
    };
  }, [quoteId]);
  useEffect(() => {
    const defaultTerms = companySettings?.quote_terms_conditions || "";
    if (!quoteId && defaultTerms)
      setForm((current) => ({ ...current, terms: defaultTerms }));
  }, [
    quoteId,
    locale,
    companySettings?.quote_terms_conditions,
    companySettings?.quote_terms_translations,
  ]);
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
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });
  const { data: customersRaw = [] } = useQuery({
    queryKey: ["quote-customers"],
    queryFn: () => customerApi.getAll({ limit: 500 }),
  });
  const { data: prefilledCustomer } = useQuery({
    queryKey: ["quote-customer-prefill", customerId],
    queryFn: () => customerApi.getById(customerId),
    enabled: Boolean(customerId && !quoteId),
  });
  const { data: stockRaw = [] } = useQuery({
    queryKey: ["quote-product-variants-stock"],
    queryFn: () => stockApi.getAll(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: variantsRaw = [], isLoading: productsLoading } = useQuery({
    queryKey: ["quote-all-variants"],
    queryFn: () => variantApi.getAll(),
    staleTime: 2 * 60 * 1000,
  });
  const customers = useMemo(
    () => unwrapList(customersRaw).filter((item) => !item.is_deleted),
    [customersRaw],
  );
  useEffect(() => {
    if (!customerId || quoteId) return;
    const customer = prefilledCustomer;
    if (!customer) return;
    setForm((current) => {
      const next = {
        customer_type: "Customer",
        customer_key: `customer:${customer._id}`,
        customer_name: customer.name || "",
        customer_email: customer.email || "",
        customer_phone: customer.phone || "",
        customer_address: customer.address || "",
      };
      if (
        current.customer_type === next.customer_type &&
        current.customer_key === next.customer_key &&
        current.customer_name === next.customer_name &&
        current.customer_email === next.customer_email &&
        current.customer_phone === next.customer_phone &&
        current.customer_address === next.customer_address
      )
        return current;
      return { ...current, ...next };
    });
  }, [customerId, prefilledCustomer, quoteId]);
  const customerOptions = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    return customers.filter(
      (customer) =>
        !query ||
        [customer.name, customer.email, customer.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  }, [customers, customerSearch]);
  const products = useMemo(() => {
    const stockByVariant = new Map();
    unwrapList(stockRaw).forEach((item) =>
      stockByVariant.set(
        String(item.variant_id?._id || item.variant_id || item._id || ""),
        item,
      ),
    );
    return unwrapList(variantsRaw)
      .filter((variant) => !variant.is_deleted)
      .map((variant) => {
        const id = String(variant._id || "");
        const stock = stockByVariant.get(id) || {};
        const product =
          variant.product_id && typeof variant.product_id === "object"
            ? variant.product_id
            : {};
        const sourceName = stock.product_name || product.name || "Product";
        const sourceVariant = variant.title || variant.sku || "Variant";
        return {
          id,
          product_id: product._id || variant.product_id || null,
          sourceName,
          sourceVariant,
          name: localizedField(
            sourceName,
            stock.product_translations?.name || product.translations?.name,
            locale,
          ),
          variant: localizedField(
            sourceVariant,
            variant.translations?.title || stock.translations?.title,
            locale,
          ),
          sku: variant.sku || "",
          price: Number(
            variant.selling_price ??
              stock.selling_price ??
              stock.sell_price ??
              0,
          ),
          image: variant.images?.[0]?.img_url || stock.image || "",
          stock: Number(variant.quantity ?? stock.quantity ?? stock.stock ?? 0),
          categoryId: String(stock.category_id?._id || stock.category_id || ""),
          categoryName: localizedField(
            stock.category_name || stock.category_id?.name || "",
            stock.category_translations?.name ||
              stock.category_id?.translations?.name,
            locale,
          ),
          brandId: String(stock.brand_id?._id || stock.brand_id || ""),
          brandName: localizedField(
            stock.brand_name || stock.brand_id?.name || "",
            stock.brand_translations?.name ||
              stock.brand_id?.translations?.name,
            locale,
          ),
        };
      })
      .filter((variant) => variant.id);
  }, [variantsRaw, stockRaw, locale]);
  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        `${product.name} ${product.variant} ${product.sourceName} ${product.sourceVariant} ${product.sku}`
          .toLowerCase()
          .includes(query);
      return (
        matchesQuery &&
        (productCategory === "all" || product.categoryId === productCategory) &&
        (productBrand === "all" || product.brandId === productBrand)
      );
    });
  }, [products, productSearch, productCategory, productBrand]);
  const productCategories = useMemo(
    () =>
      [
        ...new Map(
          products
            .filter((item) => item.categoryId && item.categoryName)
            .map((item) => [item.categoryId, item.categoryName]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [products],
  );
  const productBrands = useMemo(
    () =>
      [
        ...new Map(
          products
            .filter((item) => item.brandId && item.brandName)
            .map((item) => [item.brandId, item.brandName]),
        ).entries(),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [products],
  );
  const pickerPageSize = 8;
  const pickerPageCount = Math.max(
    1,
    Math.ceil(matchingProducts.length / pickerPageSize),
  );
  const visibleStart = matchingProducts.length
    ? (productPage - 1) * pickerPageSize + 1
    : 0;
  const visibleEnd = Math.min(
    productPage * pickerPageSize,
    matchingProducts.length,
  );
  const visibleVariants = matchingProducts.slice(
    (productPage - 1) * pickerPageSize,
    productPage * pickerPageSize,
  );
  const totals = useMemo(() => {
    const subtotal = round(
      form.items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      ),
    );
    const itemDiscount = round(
      form.items.reduce(
        (sum, item) =>
          sum +
          round(
            (Number(item.quantity || 0) *
              Number(item.unit_price || 0) *
              Number(item.discount_rate || 0)) /
              100,
          ),
        0,
      ),
    );
    const overallDiscountBase = Math.max(0, subtotal - itemDiscount);
    const overallDiscountInput = Math.max(
      0,
      Number(form.overall_discount_rate || 0),
    );
    const overallDiscount = round(
      form.overall_discount_type === "flat"
        ? Math.min(overallDiscountBase, overallDiscountInput)
        : (overallDiscountBase * Math.min(100, overallDiscountInput)) / 100,
    );
    const itemTax = round(
      form.items.reduce((sum, item) => {
        const base = Number(item.quantity || 0) * Number(item.unit_price || 0);
        return (
          sum +
          round(
            ((base - (base * Number(item.discount_rate || 0)) / 100) *
              Number(item.tax_rate || 0)) /
              100,
          )
        );
      }, 0),
    );
    const overallTax = round(
      (Math.max(0, subtotal - itemDiscount - overallDiscount) *
        Number(form.tax_rate || 0)) /
        100,
    );
    const tax = round(itemTax + overallTax);
    const discount = round(itemDiscount + overallDiscount);
    return {
      subtotal,
      itemDiscount,
      overallDiscount,
      discount,
      itemTax,
      overallTax,
      tax,
      total: round(subtotal - discount + tax),
    };
  }, [
    form.items,
    form.overall_discount_rate,
    form.overall_discount_type,
    form.tax_rate,
  ]);
  const saveMutation = useMutation({
    mutationFn: ({ status, payload }) =>
      quoteId
        ? quoteApi.update(quoteId, { ...payload, status })
        : quoteApi.create({
            ...payload,
            status,
            quote_number_reservation: quoteNumberReservation,
          }),
    onSuccess: (saved, variables) => {
      const message =
        variables.status === "Sent"
          ? `Quote ${saved.quote_number} marked as sent`
          : `Quote ${saved.quote_number} saved as pending`;
      toast.success(message);
      if (!quoteId) {
        try {
          sessionStorage.removeItem("admin-new-quote-number-reservation");
        } catch {}
      }
      qc.invalidateQueries({ queryKey: ["quotes-admin"] });
      qc.invalidateQueries({ queryKey: ["quote-admin", quoteId] });
      router.push(`/admin/quotes/${saved._id}`);
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Could not save quote"),
  });
  const createCustomerMutation = useMutation({
    mutationFn: () => customerApi.create(newCustomer),
    onSuccess: async (result) => {
      const created = result?.data || result?.customer || result;
      await qc.invalidateQueries({ queryKey: ["quote-customers"] });
      setForm((current) => ({
        ...current,
        customer_type: "Customer",
        customer_key: `customer:${created._id}`,
        customer_name: created.name,
        customer_email: created.email || "",
        customer_phone: created.phone || "",
        customer_address: created.address || "",
      }));
      setCustomerModalOpen(false);
      setNewCustomer({
        name: "",
        email: "",
        phone: "",
        address: "",
        notes: "",
      });
      toast.success("Customer added");
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Could not add customer"),
  });
  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selectCustomer = (person) => {
    setForm((current) => ({
      ...current,
      customer_type: "Customer",
      customer_key: `customer:${person._id}`,
      customer_name: person.name || "",
      customer_email: person.email || "",
      customer_phone: person.phone || "",
      customer_address: person.address || "",
    }));
    setCustomerPickerOpen(false);
    setCustomerSearch("");
  };
  const updateItem = (rowId, key, value) =>
    setForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.row_id === rowId ? { ...item, [key]: value } : item,
      ),
    }));
  const addItem = () =>
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          row_id: rowId(),
          product_id: null,
          variant_id: "",
          name: "",
          variant_name: "",
          sku: "",
          quantity: 1,
          unit_price: 0,
          discount_rate: 0,
          tax_rate: 0,
        },
      ],
    }));
  const removeItem = (rowId) =>
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.row_id !== rowId),
    }));
  const addSelectedProducts = () => {
    const selected = products.filter(
      (product) =>
        selectedVariantIds.includes(product.id) &&
        !form.items.some((item) => String(item.variant_id) === product.id),
    );
    if (!selected.length) {
      toast.error(
        "Select at least one variant that has not already been added",
      );
      return;
    }
    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        ...selected.map((product) => ({
          row_id: rowId(),
          product_id: product.product_id,
          variant_id: product.id,
          name: product.name,
          variant_name: product.variant,
          sku: product.sku,
          quantity: 1,
          unit_price: product.price,
          discount_rate: 0,
          tax_rate: 0,
        })),
      ],
    }));
    setProductPickerOpen(false);
    setSelectedVariantIds([]);
  };
  const openProductPicker = () => {
    setProductSearch("");
    setProductCategory("all");
    setProductBrand("all");
    setProductPage(1);
    setSelectedVariantIds([]);
    setProductPickerOpen(true);
  };
  const submitNewCustomer = () => {
    if (!newCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    createCustomerMutation.mutate();
  };
  useEffect(() => {
    const closePicker = (event) => {
      if (
        customerPickerRef.current &&
        !customerPickerRef.current.contains(event.target)
      )
        setCustomerPickerOpen(false);
    };
    document.addEventListener("mousedown", closePicker);
    return () => document.removeEventListener("mousedown", closePicker);
  }, []);
  const save = (status) => {
    if (!quoteId && !quoteNumberReservation) {
      toast.error(t("admin.quoteInvoice.pdf.waitForNumber"));
      return;
    }
    if (!form.customer_key || !form.customer_name.trim()) {
      toast.error("Select a customer or lead and enter their name");
      return;
    }
    if (!form.items.length || form.items.some((item) => !item.variant_id)) {
      toast.error("Add a product to each quote item");
      return;
    }
    if (
      !form.quote_date ||
      !form.expiry_date ||
      form.expiry_date < form.quote_date
    ) {
      toast.error("Expiry date must be on or after the quote date");
      return;
    }
    const [type, id] = form.customer_key.split(":");
    const payload = {
      customer_type: "Customer",
      customer_id: id,
      lead_id: null,
      customer_name: form.customer_name.trim(),
      customer_email: form.customer_email.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_address: form.customer_address.trim(),
      quote_date: form.quote_date,
      expiry_date: form.expiry_date,
      items: form.items
        .filter((item) => String(item.name || "").trim())
        .map(({ row_id, variant_name, ...item }) => ({
          ...item,
          name: variant_name ? `${item.name} / ${variant_name}` : item.name,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          unit_price: Math.max(0, Number(item.unit_price) || 0),
          discount_rate: Math.min(
            100,
            Math.max(0, Number(item.discount_rate) || 0),
          ),
          tax_rate: Math.min(100, Math.max(0, Number(item.tax_rate) || 0)),
        })),
      tax_rate: Math.min(100, Math.max(0, Number(form.tax_rate) || 0)),
      overall_discount_rate:
        form.overall_discount_type === "flat"
          ? totals.subtotal > totals.itemDiscount
            ? Math.min(
                100,
                (Math.max(0, Number(form.overall_discount_rate) || 0) /
                  (totals.subtotal - totals.itemDiscount)) *
                  100,
              )
            : 0
          : Math.min(100, Math.max(0, Number(form.overall_discount_rate) || 0)),
      terms: form.terms,
      notes: form.notes,
      pdf_design: getSavedQuotePdfDesign(QUOTE_TEMPLATE_STORAGE_KEY),
      status,
    };
    saveMutation.mutate({ status, payload });
  };
  return (
    <div
      id="quote-print-area"
      className="w-full space-y-2.5 pb-5 text-[var(--text-primary)]"
    >
      {" "}
      <header className="flex flex-wrap items-center justify-between gap-2">
        {" "}
        <div>
          <nav
            aria-label={t("admin.quoteInvoice.ui.breadcrumb_c766e665")}
            className="mb-1 flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-muted)]"
          >
            <button
              type="button"
              onClick={() => router.push("/admin/quotes")}
              className="hover:text-[var(--accent)]"
            >
              {t("admin.quoteInvoice.ui.quotes_7b0257ce")}
            </button>
            <ChevronRight size={11} />
            <span>{t("admin.quoteInvoice.ui.create_new_quote_5bcd4158")}</span>
          </nav>
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            {quoteId ? "Edit Quote" : "Create New Quote"}
          </h1>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)] sm:text-xs">
            {t(
              "admin.quoteInvoice.ui.fill_in_the_details_below_to_create_a_professional_quote_b3892e96",
            )}
          </p>
        </div>{" "}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => save("Pending")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3.5 text-[10px] font-bold text-white shadow-sm disabled:opacity-60"
          >
            <Save size={13} /> {t("admin.quoteInvoice.ui.save_quote_3b16dfe1")}
          </button>
        </div>{" "}
      </header>{" "}
      <div className="grid items-stretch gap-3 md:grid-cols-2">
        {" "}
        <section
          className={`${card} overflow-visible bg-gradient-to-br from-white via-white to-slate-50/70 dark:from-[var(--bg-card)] dark:via-[var(--bg-card)] dark:to-[var(--bg-card-alt)]`}
        >
          {" "}
          <div className="mb-4 flex items-center gap-2.5 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white dark:from-[var(--bg-card-alt)] dark:to-[var(--bg-card)] px-4 py-3.5 sm:px-5">
            {" "}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]">
              <UserRound size={15} />
            </span>{" "}
            <div>
              <h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
                {t("admin.quoteInvoice.ui.1_customer_information_c04df194")}
              </h2>
              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                {t(
                  "admin.quoteInvoice.ui.select_a_customer_to_fill_in_their_contact_details_a4379f43",
                )}
              </p>
            </div>{" "}
            {form.customer_key && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
                <CheckCircle2 size={11} />{" "}
                {t("admin.quoteInvoice.ui.selected_9a976fc2")}
              </span>
            )}{" "}
          </div>{" "}
          <div className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5">
            {" "}
            <div ref={customerPickerRef} className="relative">
              {" "}
              <label className={label} htmlFor="customer-select">
                {t("admin.quoteInvoice.ui.customer_0e85749a")} <Required />
              </label>{" "}
              <button
                id="customer-select"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={customerPickerOpen}
                onClick={() => {
                  setCustomerPickerOpen((open) => !open);
                  setCustomerSearch("");
                }}
                className={`${input} flex items-center justify-between gap-3 text-left`}
              >
                {" "}
                <span
                  className={`flex min-w-0 items-center gap-2.5 truncate ${form.customer_key ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}
                >
                  <UserRound size={15} className="shrink-0 text-blue-600" />
                  {form.customer_name || "Select a customer"}
                </span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-[var(--text-muted)] transition-transform ${customerPickerOpen ? "rotate-180" : ""}`}
                />{" "}
              </button>{" "}
              {customerPickerOpen && (
                <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
                  {" "}
                  <div className="border-b border-[var(--border-color)] p-3">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                      />
                      <input
                        autoFocus
                        value={customerSearch}
                        onChange={(event) =>
                          setCustomerSearch(event.target.value)
                        }
                        placeholder={t(
                          "admin.quoteInvoice.ui.search_by_customer_name_email_or_phone_b3268ad1",
                        )}
                        className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      />
                    </div>
                  </div>{" "}
                  <div
                    className="max-h-56 overflow-y-auto p-1.5"
                    role="listbox"
                  >
                    {customerOptions.length ? (
                      customerOptions.map((customer) => (
                        <button
                          key={customer._id}
                          type="button"
                          role="option"
                          aria-selected={
                            form.customer_key === `customer:${customer._id}`
                          }
                          onClick={() => selectCustomer(customer)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50 ${form.customer_key === `customer:${customer._id}` ? "bg-blue-50" : ""}`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">
                            {(customer.name || "C").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-[var(--text-primary)]">
                              {customer.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
                              {[customer.email, customer.phone]
                                .filter(Boolean)
                                .join(" | ") || "No contact details"}
                            </span>
                          </span>
                          {form.customer_key === `customer:${customer._id}` && (
                            <CheckCircle2
                              size={16}
                              className="shrink-0 text-emerald-600"
                            />
                          )}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">
                        {customers.length
                          ? "No customers match your search."
                          : "No customers found yet."}
                      </p>
                    )}
                  </div>{" "}
                  <div className="border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]/60 p-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerPickerOpen(false);
                        setNewCustomer({
                          name: "",
                          email: "",
                          phone: "",
                          address: "",
                          notes: "",
                        });
                        setCustomerModalOpen(true);
                      }}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                    >
                      <Plus size={14} />{" "}
                      {t("admin.quoteInvoice.ui.create_new_customer_d6bbb22b")}
                    </button>
                  </div>{" "}
                </div>
              )}{" "}
            </div>{" "}
            {form.customer_key ? (
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/50 p-3 shadow-inner dark:border-[var(--border-color)] dark:from-[var(--bg-card-alt)] dark:to-[var(--bg-card)]">
                {" "}
                <div className="mb-2 flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-wider text-blue-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Bolt size={11} />
                  </span>
                  {t("admin.quoteInvoice.ui.customer_details_23312fdb")}{" "}
                  <span className="font-medium normal-case tracking-normal text-slate-500 dark:text-[var(--text-muted)]">
                    {t(
                      "admin.quoteInvoice.ui.editable_for_this_quote_4bead005",
                    )}
                  </span>
                </div>{" "}
                <div className="grid gap-2 sm:grid-cols-2">
                  {" "}
                  <label className={label}>
                    {t("admin.quoteInvoice.ui.customer_name_75636316")}{" "}
                    <Required />
                    <input
                      value={form.customer_name}
                      onChange={(event) =>
                        setField("customer_name", event.target.value)
                      }
                      className={input}
                      placeholder={t(
                        "admin.quoteInvoice.ui.customer_name_309c693a",
                      )}
                    />
                  </label>{" "}
                  <label className={label}>
                    {t("admin.quoteInvoice.ui.email_84add5b2")}
                    <input
                      type="email"
                      value={form.customer_email}
                      onChange={(event) =>
                        setField("customer_email", event.target.value)
                      }
                      className={input}
                      placeholder={t(
                        "admin.quoteInvoice.ui.email_address_c94d3175",
                      )}
                    />
                  </label>{" "}
                  <label className={label}>
                    {t("admin.quoteInvoice.ui.phone_77064d52")}
                    <input
                      value={form.customer_phone}
                      onChange={(event) =>
                        setField("customer_phone", event.target.value)
                      }
                      className={input}
                      placeholder={t(
                        "admin.quoteInvoice.ui.phone_number_8961d3bf",
                      )}
                    />
                  </label>{" "}
                  <label className={label}>
                    {t("admin.quoteInvoice.ui.address_d70f93df")}
                    <input
                      value={form.customer_address}
                      onChange={(event) =>
                        setField("customer_address", event.target.value)
                      }
                      className={input}
                      placeholder={t("admin.quoteInvoice.ui.address_d70f93df")}
                    />
                  </label>{" "}
                </div>{" "}
              </div>
            ) : (
              <div className="flex min-h-[88px] items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-3 dark:border-[var(--border-color)] dark:bg-[var(--bg-card-alt)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm dark:bg-[var(--bg-tertiary)] dark:text-blue-300">
                  <UserRound size={16} />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">
                    {t(
                      "admin.quoteInvoice.ui.choose_a_customer_to_continue_898d7c4d",
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    {t(
                      "admin.quoteInvoice.ui.their_name_and_contact_details_will_fill_in_automaticall_244a772e",
                    )}
                  </p>
                </div>
              </div>
            )}{" "}
          </div>{" "}
        </section>{" "}
        <section
          className={`${card} overflow-hidden bg-gradient-to-br from-white via-white to-slate-50/70 dark:from-[var(--bg-card)] dark:via-[var(--bg-card)] dark:to-[var(--bg-card-alt)]`}
        >
          {" "}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] bg-gradient-to-r from-slate-50 to-white dark:from-[var(--bg-card-alt)] dark:to-[var(--bg-card)] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-[0_4px_10px_rgba(37,99,235,0.2)]">
                <CalendarDays size={15} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
                  {t("admin.quoteInvoice.ui.2_quote_details_2c6d4e50")}
                </h2>
                <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {t(
                    "admin.quoteInvoice.ui.set_the_schedule_and_customer_facing_conditions_921205d8",
                  )}
                </p>
              </div>
            </div>
            <span className="hidden rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700 sm:inline-flex">
              {t("admin.quoteInvoice.ui.required_eed6bfb4")}{" "}
              <span className="ml-1 text-rose-500">*</span>
            </span>
          </div>{" "}
          <div className="space-y-4 p-4 sm:p-5">
            {" "}
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {" "}
              <div>
                <label className={label} htmlFor="quote-date">
                  {t("admin.quoteInvoice.ui.quote_date_7b4c1f80")} <Required />
                </label>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600"
                  />
                  <input
                    id="quote-date"
                    type="date"
                    value={form.quote_date}
                    onChange={(event) =>
                      setField("quote_date", event.target.value)
                    }
                    className={`${input} pl-10`}
                  />
                </div>
                <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                  {t(
                    "admin.quoteInvoice.ui.date_this_quote_is_issued_f85fc764",
                  )}
                </p>
              </div>{" "}
              <div>
                <label className={label} htmlFor="expiry-date">
                  {t("admin.quoteInvoice.ui.expiry_date_8d007050")} <Required />
                </label>
                <div className="relative">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600"
                  />
                  <input
                    id="expiry-date"
                    type="date"
                    min={form.quote_date}
                    value={form.expiry_date}
                    onChange={(event) =>
                      setField("expiry_date", event.target.value)
                    }
                    className={`${input} pl-10`}
                  />
                </div>
                <p className="mt-1 text-[9px] text-[var(--text-muted)]">
                  {t(
                    "admin.quoteInvoice.ui.the_offer_expires_after_this_date_d415dbd1",
                  )}
                </p>
              </div>{" "}
            </div>{" "}
          </div>{" "}
        </section>{" "}
      </div>{" "}
      <QuoteTemplateDesigner
        documentType="quote"
        storageKey={QUOTE_TEMPLATE_STORAGE_KEY}
        form={form}
        totals={totals}
        quoteNumber={
          quote?.quote_number ||
          quote?.quoteNumber ||
          quote?.quotation_number ||
          generatedQuoteNumber ||
          t("admin.quoteInvoice.pdf.generatingNumber")
        }
        quoteStatus={quote?.status || "Draft"}
        money={money}
        onBrowseProducts={openProductPicker}
        onFieldChange={setField}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        discountType={form.overall_discount_type}
        discountValue={form.overall_discount_rate}
        onDiscountTypeChange={(value) =>
          setField("overall_discount_type", value)
        }
        onDiscountValueChange={(value) =>
          setField("overall_discount_rate", value)
        }
        taxRate={form.tax_rate}
        onTaxRateChange={(value) => setField("tax_rate", value)}
      />{" "}
      {productPickerOpen && (
        <div
          className="quote-no-print fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setProductPickerOpen(false);
          }}
        >
          {" "}
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-variant-picker-title"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_24px_80px_rgba(15,23,42,0.35)]"
          >
            {" "}
            <header className="shrink-0 border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card-alt)] to-[var(--bg-tertiary)] px-4 py-4 sm:px-6">
              {" "}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md">
                    <Package size={19} />
                  </span>
                  <div>
                    <h2
                      id="quote-variant-picker-title"
                      className="text-base font-extrabold tracking-tight text-[var(--text-primary)]"
                    >
                      {t("admin.quoteInvoice.ui.add_variants_e6eac24a")}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {t(
                        "admin.quoteInvoice.ui.select_product_variants_to_add_to_this_quote_11a3beff",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProductPickerOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                  aria-label={t(
                    "admin.quoteInvoice.ui.close_variant_picker_68daa0cb",
                  )}
                >
                  <X size={15} />
                </button>
              </div>{" "}
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)_minmax(0,160px)]">
                {" "}
                <label className="relative block min-w-0">
                  <Search
                    size={14}
                    className={`absolute ${dir === "rtl" ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-[var(--text-muted)]`}
                  />
                  <input
                    autoFocus
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setProductPage(1);
                    }}
                    placeholder={t(
                      "admin.quoteInvoice.ui.search_variant_product_or_sku_2d76140d",
                    )}
                    className={`h-10 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-xs outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${dir === "rtl" ? "pl-3 pr-9" : "pl-9 pr-3"}`}
                  />
                </label>{" "}
                <select
                  value={productCategory}
                  onChange={(event) => {
                    setProductCategory(event.target.value);
                    setProductPage(1);
                  }}
                  aria-label={t(
                    "admin.quoteInvoice.ui.filter_variants_by_category_24e24ad7",
                  )}
                  className="h-10 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">
                    {t("admin.quoteInvoice.ui.category_all_fa64de7f")}
                  </option>
                  {productCategories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>{" "}
                <select
                  value={productBrand}
                  onChange={(event) => {
                    setProductBrand(event.target.value);
                    setProductPage(1);
                  }}
                  aria-label={t(
                    "admin.quoteInvoice.ui.filter_variants_by_brand_a2a92101",
                  )}
                  className="h-10 w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                >
                  <option value="all">
                    {t("admin.quoteInvoice.ui.brand_all_e9ed4ce7")}
                  </option>
                  {productBrands.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>{" "}
              </div>{" "}
            </header>{" "}
            <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--bg-secondary)]/35 px-3 py-2 sm:px-4">
              {" "}
              {productsLoading ? (
                <div className="p-10 text-center text-xs font-medium text-[var(--text-muted)]">
                  {t("admin.quoteInvoice.ui.loading_variants_6cd37794")}
                </div>
              ) : visibleVariants.length ? (
                <div className="space-y-1.5">
                  {visibleVariants.map((variant) => {
                    const alreadyAdded = form.items.some(
                      (item) => String(item.variant_id) === variant.id,
                    );
                    const checked = selectedVariantIds.includes(variant.id);
                    return (
                      <label
                        key={variant.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition sm:px-4 ${alreadyAdded ? "cursor-not-allowed border-emerald-200 bg-emerald-50/60 opacity-75" : checked ? "border-blue-300 bg-blue-50/80 shadow-sm" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-blue-200 hover:bg-blue-50/40"}`}
                      >
                        {" "}
                        <input
                          type="checkbox"
                          checked={alreadyAdded || checked}
                          disabled={alreadyAdded}
                          onChange={(event) =>
                            setSelectedVariantIds((current) =>
                              event.target.checked
                                ? [...current, variant.id]
                                : current.filter((id) => id !== variant.id),
                            )
                          }
                          className="h-4 w-4 shrink-0 rounded border-[var(--border-color)] accent-blue-600"
                          aria-label={`Select ${variant.name} ${variant.variant}`}
                        />{" "}
                        {variant.image ? (
                          <Image
                            src={getImageUrl(variant.image)}
                            alt=""
                            width={44}
                            height={44}
                            unoptimized
                            className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                            <Package size={18} />
                          </span>
                        )}{" "}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-[var(--text-primary)]">
                            {variant.name}{" "}
                            <span className="font-medium text-[var(--text-secondary)]">
                              / {variant.variant}
                            </span>
                          </span>
                          <span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-muted)]">
                            {[
                              variant.sku && `SKU ${variant.sku}`,
                              variant.stock != null &&
                                `${t("admin.quoteDesigner.stock")} ${variant.stock}`,
                              variant.categoryName,
                              variant.brandName,
                            ]
                              .filter(Boolean)
                              .join(" Â· ")}
                          </span>
                        </span>{" "}
                        <span className="hidden shrink-0 text-right sm:block">
                          <span className="block text-xs font-bold text-[var(--text-primary)]">
                            {money(variant.price)}
                          </span>
                          <span className="text-[9px] text-[var(--text-muted)]">
                            {t("admin.quoteInvoice.ui.unit_price_3c6c777f")}
                          </span>
                        </span>{" "}
                        {alreadyAdded && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-700">
                            {t("admin.quoteInvoice.ui.added_b68734c2")}
                          </span>
                        )}{" "}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {t("admin.quoteInvoice.ui.no_variants_found_3f4b71fc")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {t(
                      "admin.quoteInvoice.ui.try_a_different_search_or_filter_4e653834",
                    )}
                  </p>
                </div>
              )}{" "}
            </div>{" "}
            <footer className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-[var(--text-muted)]">
                    <span className="rounded-lg bg-[var(--bg-tertiary)] px-2 py-1 font-semibold text-[var(--text-secondary)]">
                      {t("admin.quoteInvoice.ui.page_fb06270f")} {productPage} /{" "}
                      {pickerPageCount}
                    </span>
                    <span>
                      {visibleStart}-{visibleEnd} / {matchingProducts.length}
                    </span>
                    <span className="rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-700">
                      {selectedVariantIds.length}{" "}
                      {t("admin.quoteInvoice.ui.selected_835f3b50")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={productPage <= 1}
                    onClick={() =>
                      setProductPage((page) => Math.max(1, page - 1))
                    }
                    className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("admin.quoteInvoice.ui.previous_50f94286")}
                  </button>
                  {pickerPageCount <= 5 &&
                    Array.from(
                      { length: pickerPageCount },
                      (_, index) => index + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-current={productPage === page ? "page" : undefined}
                        onClick={() => setProductPage(page)}
                        className={
                          productPage === page
                            ? "h-9 min-w-9 rounded-xl border border-blue-600 bg-blue-600 px-2.5 text-xs font-semibold text-white shadow-sm"
                            : "h-9 min-w-9 rounded-xl border border-[var(--border-color)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        }
                      >
                        {page}
                      </button>
                    ))}
                  <button
                    type="button"
                    disabled={productPage >= pickerPageCount}
                    onClick={() =>
                      setProductPage((page) =>
                        Math.min(pickerPageCount, page + 1),
                      )
                    }
                    className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("admin.quoteInvoice.ui.next_bc981983")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductPickerOpen(false)}
                    className="h-9 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    {t("admin.quoteInvoice.ui.close_bbfa773e")}
                  </button>
                </div>
              </div>
              <div className="flex justify-center pt-3">
                <button
                  type="button"
                  disabled={!selectedVariantIds.length}
                  onClick={addSelectedProducts}
                  className="inline-flex h-10 min-w-52 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-6 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition hover:from-blue-700 hover:to-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t("admin.quoteInvoice.ui.add_selected_763795a2")} (
                  {selectedVariantIds.length})
                </button>
              </div>
            </footer>{" "}
          </section>{" "}
        </div>
      )}{" "}
      <CustomerFormModal
        open={customerModalOpen}
        form={newCustomer}
        setForm={setNewCustomer}
        isPending={createCustomerMutation.isPending}
        onSave={submitNewCustomer}
        onClose={() => {
          if (!createCustomerMutation.isPending) setCustomerModalOpen(false);
        }}
      />{" "}
    </div>
  );
}
function Required() {
  const { t } = useTranslation();
  return <span className="text-rose-500">*</span>;
}
function SectionTitle({ icon: Icon, title, trailing, className = "mb-3" }) {
  const { t } = useTranslation();
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
        <Icon size={15} />
      </span>
      <h2 className="text-sm font-extrabold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      {trailing && <div className="ml-auto">{trailing}</div>}
    </div>
  );
}
function PercentInput({ value, onChange, label: ariaLabel }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-9 w-[88px] items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 shadow-sm transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10">
      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none"
        aria-label={ariaLabel}
      />
      <span className="ml-1 text-[10px] font-medium text-[var(--text-muted)]">
        %
      </span>
    </div>
  );
}
function SummaryRow({ label: title, value }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[9px] text-[var(--text-secondary)]">{title}</span>
      <span className="text-[9px] font-semibold">{value}</span>
    </div>
  );
}
