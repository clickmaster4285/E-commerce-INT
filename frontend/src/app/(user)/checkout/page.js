"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Country, State, City } from "country-state-city";
import axiosInstance from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import { orderApi } from "@/apis/user/orderApi";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, isDealActive, hasFreeShippingDeal, isFreeShippingApplicable, getDefaultShippingMethod, matchShippingRule } from "@/utils/dealCalculator";
import { shippingApi } from "@/apis/user/shippingApi";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import {
  ArrowLeft, ArrowRight, Check, Lock, MapPin, Phone, CreditCard,
  Banknote, Landmark, Package, PackageCheck, Plus, Minus, ShieldCheck,
  Truck, Loader2, ChevronDown, Zap, ShoppingBag, X, Pencil, Trash2, Tag,
  TrendingUp, Gift, BadgePercent,
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const DEFAULT_SHIP_CONFIG = {
  standard: { fee: 200, min_days: 2, max_days: 4 },
  express: { fee: 500, min_days: 1, max_days: 2 },
  free_shipping_over: 0,
};

const emptyAddress = (phone = "") => ({
  country: "", full_name: "", street_address1: "", street_address2: "",
  city: "", state: "", zip_code: "", phone, is_default: true, delivery_instructions: "",
});

const ItemThumb = ({ item, size = "w-14 h-14" }) =>
  getImgUrl(item.image) ? (
    <div className={`${size} rounded-xl overflow-hidden border-2 border-[var(--user-border)] shrink-0 shadow-sm bg-[var(--user-bg-hover)]`}>
      <img src={getImgUrl(item.image)} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div className={`${size} rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] flex items-center justify-center shrink-0`}>
      <Package size={18} className="text-[var(--user-accent)]" />
    </div>
  );

// 💳 Card Preview — intentionally dark (credit-card look), white text OK
const CardPreview = ({ number, name, expiry }) => (
  <div className="relative w-full max-w-[360px] h-[200px] rounded-3xl mx-auto mb-6 overflow-hidden shadow-2xl"
    style={{ background: "linear-gradient(135deg, #0b1220 0%, #16213e 55%, #065f46 130%)" }}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
    <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
    <div className="relative p-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg" />
        <span className="text-white/90 text-sm font-black italic tracking-wider">
          {number.replace(/\s/g, "").endsWith("4") ? "VISA" : "MasterCard"}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-white/60 text-[10px] uppercase tracking-widest font-semibold">Card Number</p>
        <p className="text-white font-mono text-lg tracking-[0.18em] font-bold">{number || "•••• •••• •••• ••••"}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/60 font-semibold">Card Holder</p>
          <p className="text-white text-sm font-bold uppercase tracking-wider">{name || "YOUR NAME"}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-white/60 font-semibold">Expires</p>
          <p className="text-white text-sm font-bold">{expiry || "MM/YY"}</p>
        </div>
      </div>
    </div>
  </div>
);

function CheckoutContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const urlDraftId = searchParams.get("draftId");
  const [currentDraftId, setCurrentDraftId] = useState(null);

  const { cart, removeItems, updateQty, restoreItems, selectedItems } = useCart();
  const { calculateProductDiscount, deals: dealsList = [] } = useDiscounts();

  const [step, setStep] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [mobileAddressSheet, setMobileAddressSheet] = useState(false);
  const [mobileAddressForm, setMobileAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState(emptyAddress());
  const [savingAddress, setSavingAddress] = useState(false);
  const [shippingMethod, setShippingMethod] = useState(() => getDefaultShippingMethod(null));
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [placing, setPlacing] = useState(false);
  const [orderReviewOpen, setOrderReviewOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState("");

  const draftRestored = useRef(false);
  const saveTimer = useRef(null);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (!userLoading && !user) router.replace("/login?redirect=/checkout");
  }, [user, userLoading, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (urlDraftId) {
        try {
          const res = await axiosInstance.get(`/users/checkout-drafts/${urlDraftId}`);
          const d = res.data?.draft;
          if (cancelled || !d) {
            setSelectedKeys(cart.map((i) => i.key));
            if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
            return;
          }
          setCurrentDraftId(urlDraftId);
          if (typeof d.step === "number" && d.step >= 1 && d.step <= 3) setStep(d.step);
          if (Array.isArray(d.items) && d.items.length) setDraftItems(d.items);
          if (Array.isArray(d.selectedKeys) && d.selectedKeys.length > 0) setSelectedKeys(d.selectedKeys);
          else setSelectedKeys(cart.map((i) => i.key));
          if (d.selectedAddressId) setSelectedAddressId(d.selectedAddressId);
          if (d.shippingMethod) setShippingMethod(d.shippingMethod);
          if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
        } catch {
          setSelectedKeys(cart.map((i) => i.key));
        }
        if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
        return;
      }
      setSelectedKeys(cart.map((i) => i.key));
      if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
    })();
    return () => { cancelled = true; };
  }, [cart, urlDraftId]);

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.getAll,
    enabled: !!user,
  });

  useEffect(() => {
    if (!draftReady) return;
    if (!selectedAddressId && addresses.length) {
      const def = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(def._id);
    }
  }, [addresses, selectedAddressId, draftReady]);

  useEffect(() => {
    if (!user || !draftRestored.current || !currentDraftId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      axiosInstance.put(`/users/checkout-drafts/${currentDraftId}`, {
        step, selectedKeys: selectedKeys || [], selectedAddressId: selectedAddressId || null,
        shippingMethod, paymentMethod, saved: false, items: draftItems,
      }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedKeys, selectedAddressId, shippingMethod, paymentMethod, user, step, draftItems, currentDraftId]);

  const goToStep = async (n) => {
    if (currentDraftId) {
      try {
        await axiosInstance.put(`/users/checkout-drafts/${currentDraftId}`, {
          step: n, selectedKeys: selectedKeys || [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, saved: false, items: draftItems,
        });
      } catch {}
    }
    setStep(n);
  };

  const proceedToStep2 = async () => {
    if (!selectedCartItems.length) return toast.error("Please select at least one item");
    const snap = selectedCartItems.map((i) => ({ ...i }));
    setDraftItems(snap);
    removeItems(snap.map((i) => i.key));
    setSelectedKeys([]);
    try {
      let draftId = currentDraftId;
      if (!draftId) {
        const createRes = await axiosInstance.post("/users/checkout-drafts", {
          step: 2, selectedKeys: [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, items: snap,
        });
        draftId = createRes.data?.draft?._id;
        setCurrentDraftId(draftId);
        if (draftId) router.replace(`/checkout?draftId=${draftId}`, { scroll: false });
      } else {
        await axiosInstance.put(`/users/checkout-drafts/${draftId}`, {
          step: 2, selectedKeys: [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, items: snap,
        });
      }
    } catch (e) { console.error("proceedToStep2 error:", e); }
    setStep(2);
  };

  const backToStep1 = async () => {
    if (draftItems.length) restoreItems(draftItems);
    setDraftItems([]);
    if (currentDraftId) {
      try { await axiosInstance.delete(`/users/checkout-drafts/${currentDraftId}`); } catch {}
      setCurrentDraftId(null);
      router.replace("/checkout", { scroll: false });
    }
    setStep(1);
  };

  useEffect(() => { if (user?.phone) setPhone((p) => p || user.phone); }, [user]);
  useEffect(() => {
    fetch("https://ipapi.co/country_name/").then((r) => r.text()).then((name) => name && setDetectedCountry(name.trim())).catch(() => {});
  }, []);
  useEffect(() => {
    if (showAddressModal && !editingAddressId && detectedCountry && !addressForm.country) {
      setAddressForm((f) => ({ ...f, country: detectedCountry }));
    }
  }, [showAddressModal, editingAddressId, detectedCountry, addressForm.country]);

  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const allStates = useMemo(() => {
    const c = allCountries.find((x) => x.name === addressForm.country);
    return c ? State.getStatesOfCountry(c.isoCode) : [];
  }, [allCountries, addressForm.country]);
  const allCities = useMemo(() => {
    const c = allCountries.find((x) => x.name === addressForm.country);
    const s = allStates.find((x) => x.name === addressForm.state);
    return c && s ? City.getCitiesOfState(c.isoCode, s.isoCode) : [];
  }, [allCountries, allStates, addressForm.country, addressForm.state]);

useEffect(() => { setAddressForm((f) => ({ ...f, state: "", city: "" })); }, [addressForm.country]);
  useEffect(() => { setAddressForm((f) => ({ ...f, city: "" })); }, [addressForm.state]);

  // ✅ If the user arrives at /checkout with 0 selected items (and cart has items),
  //    send them back to /cart so they can pick what to buy.
  useEffect(() => {
    if (!draftReady || placing) return;
    if (cart.length > 0 && selectedItems.length === 0) {
      router.replace("/cart");
    }
  }, [cart.length, selectedItems.length, draftReady, placing, router]);

  // ✅ Items to checkout = CartContext selection (persists in localStorage).
  //    On draft restore, the local `selectedKeys` seed is used only as a one-shot
  //    import into CartContext (handled in the draft-restore effect above).
  const selectedCartItems = useMemo(() => selectedItems, [selectedItems]);
  const activeItems = step === 1 ? selectedCartItems : draftItems;
  // ✅ Shared helper — single source of truth for free-shipping qualification.
  const freeShippingByActiveItems = hasFreeShippingDeal(activeItems);
  // ✅ Identify the active free-shipping deal (first match) so we can derive
  //    the default shipping method (e.g. express-only => pre-select express).
  //    Memoized so the useEffect below doesn't re-fire on every render and
  //    accidentally clobber a user's manual method selection.
  const activeFreeShippingDeal = useMemo(
    () => (freeShippingByActiveItems ? dealsList.find((d) => d.type === "free_shipping") : null),
    [freeShippingByActiveItems, dealsList]
  );

  // ✅ Sync `shippingMethod` to the deal-derived default when the active deal
  //    changes. This pre-selects express for express-only deals on entry, and
  //    falls back to standard when no deal or no covered method exists.
  //    The user can still manually switch methods — subsequent useEffect runs
  //    only re-sync when the active deal itself changes.
  useEffect(() => {
    const next = getDefaultShippingMethod(activeFreeShippingDeal);
    setShippingMethod((prev) => (prev !== next ? next : prev));
  }, [activeFreeShippingDeal]);

  const itemsWithDiscounts = activeItems.map((i) => {
    const qty = Number(i.qty) || 1;
    let price = Number(i.price) || 0;
    const regularPrice = Number(i.regularPrice ?? i.price ?? 0);
    const dealActive = isDealActive({ ...i, qty });
    let regularDiscountSavings = 0;

    // ✅ Apply admin-applied regular discount on non-deal lines
    if (!dealActive) {
      const fakeProduct = {
        _id: i.productId || i.id,
        category_id: i.categoryId || null,
        brand_id: i.brandId || null,
        discount: i.productDiscountPct || 0,
      };
      // ✅ Regular checkout line: includeDeals=false so any active deal
      // is IGNORED and ONLY the regular admin discount is applied.
      const disc = calculateProductDiscount(fakeProduct, regularPrice, false);
      if (disc && disc.hasDiscount && disc.discountedPrice < regularPrice) {
        price = Number(disc.discountedPrice) || price;
        regularDiscountSavings = Math.max(0, regularPrice - price);
      }
    }

    let freeItems = 0, payableItems = qty, dealSavings = 0;
    let effectiveDealSavings = 0;
    if (dealActive && i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity) {
      freeItems = calculateFreeItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      payableItems = calculatePayableItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      dealSavings = calculateBuyXGetYSavings(qty, price, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      effectiveDealSavings = dealSavings;
    } else if (dealActive && (i.dealType === "percentage" || i.dealType === "fixed_amount")) {
      effectiveDealSavings = Math.max(0, (regularPrice - price) * qty);
    }
    const lineTotal = (i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity)
      ? Number(payableItems * price) || 0
      : qty * price;
    return {
      ...i, qty, displayPrice: price, originalPrice: regularPrice,
      hasDiscount: (regularPrice > price),
      savings: regularDiscountSavings, dealSavings: effectiveDealSavings,
      freeItems: dealActive ? freeItems : 0,
      payableItems: dealActive ? payableItems : qty,
      lineTotal, dealActive,
    };
  });

  const subtotal = itemsWithDiscounts.reduce((s, i) => s + i.lineTotal, 0);
  // ✅ No double counting:
  // - Deal lines contribute `dealSavings` (deal section price drop + free items)
  // - Regular lines contribute `savings * qty` (regular-discount drop only)
  const totalSavings = itemsWithDiscounts.reduce((s, i) => s + (i.dealActive ? i.dealSavings : i.savings * i.qty), 0);

  const { data: shipConfig } = useQuery({ queryKey: ["shippingConfig"], queryFn: shippingApi.getConfig, staleTime: 60 * 1000 });
  const cfg = shipConfig || DEFAULT_SHIP_CONFIG;

  // ✅ Active shipping rules (brand/category/product/all — free or fixed).
  const { data: shippingRules = [] } = useQuery({
    queryKey: ["shippingRules"],
    queryFn: shippingApi.getRules,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: shipQuote } = useQuery({
    queryKey: ["shippingQuote", shippingMethod, Math.round(subtotal), activeItems.map((i) => i.productId || i.id).join(",")],
    queryFn: () => shippingApi.quote({
      items: activeItems.map((i) => ({ productId: i.productId || i.id, brandId: i.brandId, categoryId: i.categoryId })),
      method: shippingMethod, subtotal,
    }),
    enabled: activeItems.length > 0,
  });

  // ✅ Per-method gating using the single helper (no duplicated logic).
  // A free-shipping deal must apply to the SELECTED method to zero it out.
  const freeShippingDealsForMethod = (method) =>
    dealsList.some((d) => d.type === "free_shipping" && isFreeShippingApplicable(d, method));
  const isFreeForCurrentMethod = freeShippingByActiveItems && freeShippingDealsForMethod(shippingMethod);

  // ✅ Match admin shipping rules against the checkout items (single source of truth).
  const matchedRule = matchShippingRule(
    activeItems.map((i) => ({
      productId: i.productId || i.product_id || i.id,
      categoryId: i.categoryId || i.category_id,
      brandId: i.brandId || i.brand_id,
    })),
    shippingRules
  );
  const ruleFree = matchedRule?.shipping_type === "free";
  const ruleFixedFee = matchedRule?.shipping_type === "fixed" ? Number(matchedRule.fee) || 0 : null;

  // ✅ Combine: deal (method-gated) | rule | threshold.
  //    Fixed rule overrides the method fee.
  let shipping;
  if (isFreeForCurrentMethod || ruleFree) {
    shipping = 0;
  } else if (ruleFixedFee != null) {
    shipping = ruleFixedFee;
  } else {
    shipping = shipQuote?.fee ?? (shippingMethod === "express" ? cfg.express.fee : cfg.standard.fee);
  }
  const shippingReason = isFreeForCurrentMethod
    ? "Free shipping via active deal"
    : ruleFree
    ? `Free shipping (${matchedRule.rule_type} rule)`
    : (shipQuote?.reason || "");

  const tax = Math.round(itemsWithDiscounts.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.tax || 0) / 100), 0));
  const grandTotal = Math.round(subtotal + shipping + tax);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId);
  const needsPhone = !!user && !user.phone;

  const savePhone = async () => {
    if (!/^[0-9+\-\s]{7,20}$/.test(phone)) return toast.error("Please enter a valid phone number");
    setSavingPhone(true);
    try {
      await axiosInstance.put("/users/phone", { phone });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success("Phone number saved!");
    } catch (e) { toast.error(e.response?.data?.message || "Phone save failed"); }
    finally { setSavingPhone(false); }
  };

  const openAddressModal = () => {
    setAddressForm({ ...emptyAddress(user?.phone || ""), full_name: user?.name || "", phone: user?.phone || "" });
    setEditingAddressId(null);
    setShowAddressModal(true);
  };

  const openEditModal = (a) => {
    setAddressForm({
      country: a.country || "", full_name: a.full_name || "", street_address1: a.street_address1 || "",
      street_address2: a.street_address2 || "", city: a.city || "", state: a.state || "",
      zip_code: a.zip_code || "", phone: a.phone || "", is_default: !!a.is_default,
      delivery_instructions: a.delivery_instructions || "",
    });
    setEditingAddressId(a._id);
    setShowAddressModal(true);
  };

  const deleteAddress = async (id) => {
    try {
      await addressApi.remove(id);
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      if (selectedAddressId === id) setSelectedAddressId(null);
      toast.success("Address deleted!");
    } catch (e) { toast.error(e.response?.data?.message || "Address delete failed"); }
  };

  const saveAddress = async () => {
    const f = addressForm;
    if (!f.country || !f.full_name.trim() || !f.street_address1.trim() || !f.state.trim() || !f.city.trim() || !f.phone.trim()) {
      return toast.error("Please fill in all required fields");
    }
    setSavingAddress(true);
    try {
      if (editingAddressId) { await addressApi.update(editingAddressId, f); toast.success("Address updated!"); }
      else { const created = await addressApi.create(f); setSelectedAddressId(created._id); toast.success("Address saved!"); }
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setShowAddressModal(false);
      setEditingAddressId(null);
    } catch (e) { toast.error(e.response?.data?.message || "Address save failed"); }
    finally { setSavingAddress(false); }
  };

  const placeOrder = async () => {
    if (!activeItems.length) return toast.error("No items selected");
    if (!selectedAddressId) return toast.error("Please select a delivery address");
    if (paymentMethod === "card") {
      if (cardForm.number.replace(/\s/g, "").length !== 16) return toast.error("Card number must be 16 digits");
      if (!cardForm.name.trim()) return toast.error("Card holder name is required");
      if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) return toast.error("Expiry must be in MM/YY format");
      if (cardForm.cvv.length < 3) return toast.error("Please enter a valid CVV");
    }
    setPlacing(true);
    try {
      await orderApi.place({ items: itemsWithDiscounts, address_id: selectedAddressId, payment_method: paymentMethod, shipping_method: shippingMethod, shipping });
            queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      // ✅ Remove ONLY the selected lines from the cart; the save() helper in
//    CartContext auto-prunes the selection for the removed keys. Leave any
//    unselected lines and their (still-selected or unselected) state untouched.
      const orderedKeys = itemsWithDiscounts.map((i) => i.key);
      removeItems(orderedKeys);
      setDraftItems([]);
      if (currentDraftId) { await axiosInstance.delete(`/users/checkout-drafts/${currentDraftId}`).catch(() => {}); setCurrentDraftId(null); }
      router.push("/orders");
    } catch (e) { toast.error(e.response?.data?.message || "Order place failed"); setPlacing(false); }
  };

  if (userLoading || !draftReady || (!user && !needsPhone)) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
      </div>
    );
  }
  if (!user) return null;

  if (step === 1 && cart.length === 0 && !placing) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border-2 border-[var(--user-border)] flex items-center justify-center mb-5">
          <Package size={34} className="text-[var(--user-accent)]" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-[var(--user-text)] mb-2">Your cart is empty</h1>
        <p className="text-xs sm:text-sm text-[var(--user-text-muted)] mb-7 max-w-md mx-auto">Looks like you haven't added anything yet. Start shopping to fill it up!</p>
        <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-7 py-3 rounded-xl text-sm font-black hover:opacity-90 active:scale-[0.98] transition">
          <ShoppingBag size={17} /> Start Shopping
        </button>
      </div>
    );
  }

  // ✅ THEME-SAFE classes — no hardcoded white/black on accent
  const inputCls = "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] hover:border-[var(--user-accent)]/40";
  const labelCls = "block text-xs font-bold text-[var(--user-text-secondary)] mb-2 uppercase tracking-wider";
  const cardCls = "rounded-2xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm";
  const textareaCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] resize-none hover:border-[var(--user-accent)]/40";
  const accentBtn = "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90 active:scale-[0.98] transition";
  const ghostBtn = "border-2 border-[var(--user-border)] text-[var(--user-text-secondary)] hover:text-[var(--user-text)] hover:border-[var(--user-accent)]/40 transition";

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8 sm:mb-10">
      {["Items", "Delivery", "Payment"].map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center">
            <button onClick={() => done && goToStep(n)} className={`flex items-center gap-2.5 sm:gap-3 ${done ? "cursor-pointer" : "cursor-default"}`}>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-300 ${
                done ? "bg-[var(--user-success)] border-[var(--user-success)] text-white shadow-lg"
                : active ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-[var(--user-accent-text)] shadow-lg shadow-[var(--user-accent)]/30"
                : "border-[var(--user-border)] text-[var(--user-text-muted)] bg-[var(--user-bg-card)]"}`}>
                {done ? <Check size={17} /> : n}
              </div>
              <div className="text-left hidden sm:block">
                <p className={`text-[9px] font-bold uppercase tracking-widest ${active || done ? "text-[var(--user-accent)]" : "text-[var(--user-text-subtle)]"}`}>Step {n}</p>
                <p className={`text-sm font-bold ${active || done ? "text-[var(--user-text)]" : "text-[var(--user-text-muted)]"}`}>{label}</p>
              </div>
            </button>
            {n < 3 && (
              <div className={`w-6 sm:w-14 lg:w-20 h-0.5 mx-2 sm:mx-3 rounded-full ${done ? "bg-[var(--user-success)]" : "bg-[var(--user-border)]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const SummaryPanel = ({ footer }) => (
    <div className={`${cardCls} p-5 sm:p-6 lg:sticky lg:top-24`}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
          <PackageCheck size={18} className="text-[var(--user-accent-text)]" />
        </div>
        <div>
          <h2 className="text-base font-black text-[var(--user-text)]">Order Summary</h2>
          <p className="text-xs text-[var(--user-text-muted)]">{itemsWithDiscounts.length} items</p>
        </div>
      </div>

      <div className="space-y-3 my-4 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-2 mb-5 custom-scrollbar">
        {itemsWithDiscounts.map((i) => (
          <div key={i.key} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--user-bg-hover)]/50 border border-[var(--user-border)]">
            <ItemThumb item={i} size="w-14 h-14" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-bold text-[var(--user-text)] truncate">{i.name}</p>
              {i.dealActive && i.dealId && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 px-2 py-0.5 rounded-full">
                    <Gift size={9} />
                    {i.dealType === 'buy_x_get_y' ? `B${i.dealBuyQuantity || 2}G${i.dealGetQuantity || 1}` : 'Deal'}
                  </span>
                  {i.freeItems > 0 && (
                    <span className="text-[9px] font-black text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 px-2 py-0.5 rounded-full">+{i.freeItems} FREE</span>
                  )}
                </div>
              )}
              <p className="text-[10px] text-[var(--user-text-muted)]">Qty: {i.qty} {i.freeItems > 0 && `(${i.payableItems} paid)`}</p>
            </div>
            <div className="text-right space-y-1">
              {i.hasDiscount && i.originalPrice * i.qty > i.lineTotal && (
                <p className="text-[9px] text-[var(--user-text-subtle)] line-through">Rs. {(i.originalPrice * i.qty).toLocaleString()}</p>
              )}
              <p className="text-sm font-black text-[var(--user-text)]">Rs. {i.lineTotal.toLocaleString()}</p>
              {((i.savings * i.qty) + i.dealSavings) > 0 && (
                <p className="text-[9px] font-black text-[var(--user-success)] flex items-center gap-0.5 justify-end">
                  <TrendingUp size={9} /> -Rs. {((i.savings * i.qty) + i.dealSavings).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-4 border-t-2 border-[var(--user-border)]">
        <div className="flex justify-between text-sm">
          <span className="text-[var(--user-text-muted)] font-semibold">Subtotal</span>
          <span className="text-[var(--user-text)] font-bold">Rs. {subtotal.toLocaleString()}</span>
        </div>
        {totalSavings > 0 && (
          <div className="flex justify-between text-sm bg-[var(--user-success)]/10 -mx-5 px-5 py-2 rounded-xl border border-[var(--user-success)]/20">
            <span className="text-[var(--user-success)] flex items-center gap-2 font-bold"><BadgePercent size={14} /> You Save</span>
            <span className="text-[var(--user-success)] font-black">-Rs. {totalSavings.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-[var(--user-text-muted)] flex items-center gap-2 font-semibold">
            <Truck size={14} /> Shipping
            {shipping === 0 && <span className="text-[9px] font-black text-[var(--user-success)] bg-[var(--user-success)]/20 px-2 py-0.5 rounded-full">FREE</span>}
          </span>
          <span className="text-[var(--user-text)] font-bold">{shipping === 0 ? "Rs. 0" : `Rs. ${shipping}`}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--user-text-muted)] font-semibold">Tax</span>
            <span className="text-[var(--user-text)] font-bold">Rs. {tax.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between pt-4 border-t-2 border-[var(--user-border)]">
          <span className="font-black text-[var(--user-text)]">Total</span>
          <div className="text-right">
            <p className="text-2xl font-black text-[var(--user-accent)]">Rs. {grandTotal.toLocaleString()}</p>
            <p className="text-[10px] text-[var(--user-text-muted)]">Including all taxes</p>
          </div>
        </div>
      </div>
      <div className="mt-5">{footer}</div>
    </div>
  );

  const shippingMethods = [
    { id: "standard", title: "Standard Delivery", time: `${cfg.standard.min_days}–${cfg.standard.max_days} days`, icon: Truck, badge: "Popular" },
    { id: "express", title: "Express Delivery", time: `${cfg.express.min_days}–${cfg.express.max_days} days`, icon: Zap, badge: "Fast" },
  ];

  return (
    <>
    {/* ============= DESKTOP — UNCHANGED ============= */}
    <div className="hidden lg:block">
    <main className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8 lg:py-12 pb-24 sm:pb-28 md:pb-10">
      <style>{`
        @keyframes modalUp { from { opacity: 0; transform: translateY(30px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--user-bg-hover); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--user-accent); border-radius: 10px; }
      `}</style>

      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-xs sm:text-sm text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-semibold">Continue Shopping</span>
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20">
          <ShieldCheck size={16} className="text-[var(--user-accent)]" />
          <span className="text-xs font-black text-[var(--user-accent)]">Secure Checkout</span>
        </div>
      </div>

      {needsPhone ? (
        <div className="max-w-[500px] mx-auto mt-8 sm:mt-12">
          <div className={`${cardCls} p-6 sm:p-8`}>
            <div className="w-14 h-14 rounded-2xl bg-[var(--user-accent)] flex items-center justify-center mb-5">
              <Phone size={24} className="text-[var(--user-accent-text)]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--user-text)] mb-2">Phone Number Required</h2>
            <p className="text-sm text-[var(--user-text-muted)] mb-6">We need your phone number for delivery updates and order confirmation.</p>
            <label className={labelCls}>Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" className={inputCls} />
            <button onClick={savePhone} disabled={savingPhone} className={`mt-6 w-full h-12 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 ${accentBtn}`}>
              {savingPhone ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              Save & Continue
            </button>
          </div>
        </div>
      ) : (
        <>
          <StepIndicator />

                   {/* ============ STEP 1 — Cart (right card tak height, phir scroll) ============ */}
          {step === 1 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-4 sm:gap-6">
              {/* LEFT: Your Cart */}
              <div className="relative">
                <div className={`${cardCls} overflow-hidden flex flex-col lg:absolute lg:inset-0`}>
                  <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-hover)]/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                        <ShoppingBag size={18} className="text-[var(--user-accent-text)]" />
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-[var(--user-text)] uppercase tracking-wider">Your Cart</h2>
                        <p className="text-xs text-[var(--user-text-muted)]">{selectedCartItems.length} of {cart.length} items selected</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => router.push("/cart")} className="text-xs font-bold text-[var(--user-accent)] hover:opacity-80 transition">Edit selection</button>
                  </div>

                  {/* ✅ LIST — shows ONLY selected items (selection managed on /cart page) */}
                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 overflow-y-auto max-h-[420px] sm:max-h-[520px] lg:max-h-none lg:flex-1 lg:min-h-0 custom-scrollbar">
                    {itemsWithDiscounts.map((item) => {
                      return (
                        <div key={item.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 border-[var(--user-accent)] bg-[var(--user-accent)]/5`}>
                          <ItemThumb item={item} size="w-16 h-16" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs sm:text-sm font-bold text-[var(--user-text)] line-clamp-2">{item.name}</p>
                            {item.variantTitle && <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)]">{item.variantTitle}</p>}
                            {item.dealId && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 px-2 py-1 rounded-full">
                                  <Gift size={9} />
                                  {item.dealType === 'buy_x_get_y' ? `Buy ${item.dealBuyQuantity} Get ${item.dealGetQuantity} Free` : (item.dealName || 'Active Deal')}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <p className="text-xs sm:text-sm font-black text-[var(--user-text)]">Rs. {item.displayPrice.toLocaleString()}</p>
                              {item.hasDiscount && item.originalPrice * item.qty > item.lineTotal && (
                                <p className="text-[10px] text-[var(--user-text-subtle)] line-through">Rs. {(item.originalPrice * item.qty).toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex flex-col items-end gap-2">
                            <div className="flex items-center rounded-lg border-2 border-[var(--user-border)] bg-[var(--user-bg-card)]">
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (item.qty > 1) updateQty(item.key, item.qty - 1); }} className="p-2 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition">
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-black text-[var(--user-text)] w-8 text-center">{item.qty}</span>
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQty(item.key, item.qty + 1); }} className="p-2 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition">
                                <Plus size={12} />
                              </button>
                            </div>
                            <p className="text-sm font-black text-[var(--user-accent)]">Rs. {item.lineTotal.toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Slim footer */}
                  <div className="px-5 py-3.5 border-t-2 border-[var(--user-border)] bg-[var(--user-bg-hover)]/40 flex items-center justify-between">
                    <p className="text-xs text-[var(--user-text-muted)] font-semibold">
                      Selected: <span className="font-black text-[var(--user-text)]">{selectedCartItems.length}</span> / {cart.length}
                    </p>
                    <p className="text-lg font-black text-[var(--user-accent)]">Rs. {subtotal.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* RIGHT: Summary with Proceed button */}
              <SummaryPanel footer={
                <div className="space-y-3">
                  <button onClick={proceedToStep2} disabled={!selectedCartItems.length} className={`w-full h-12 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${accentBtn}`}>
                    Proceed to Delivery <ArrowRight size={16} />
                  </button>
                  <div className="flex items-center justify-center gap-2 text-xs text-[var(--user-text-muted)]">
                    <ShieldCheck size={14} className="text-[var(--user-success)]" />
                    <span className="font-semibold">Secure checkout · SSL encrypted</span>
                  </div>
                </div>
              } />
            </div>
          )}
          {/* Mobile sticky Proceed bar (step 1) */}
          {step === 1 && (
            <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t-2 border-[var(--user-border)] px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[var(--user-text-muted)] font-semibold">{selectedCartItems.length} selected</p>
                  <p className="text-base font-black text-[var(--user-accent)]">Rs. {subtotal.toLocaleString()}</p>
                </div>
                <button onClick={proceedToStep2} disabled={!selectedCartItems.length} className={`h-11 px-5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 ${accentBtn}`}>
                  Proceed <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 2 ============ */}
          {step === 2 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 items-start">
              <div className="space-y-4 sm:space-y-5">
                <div className={`${cardCls} p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                      <MapPin size={18} className="text-[var(--user-accent-text)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[var(--user-text)]">Delivery Address</h2>
                      <p className="text-xs text-[var(--user-text-muted)]">Where should we deliver your order?</p>
                    </div>
                  </div>
                  {addresses.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-3 mb-4">
                      {addresses.map((a) => (
                        <div key={a._id} onClick={() => setSelectedAddressId(a._id)} className={`text-left rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer ${selectedAddressId === a._id ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-[var(--user-text)] truncate">{a.full_name}</p>
                            {a.is_default && <span className="text-[8px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded">DEFAULT</span>}
                          </div>
                          <p className="text-xs text-[var(--user-text-muted)] leading-relaxed line-clamp-2 mb-1">
                            {a.street_address1}{a.street_address2 ? `, ${a.street_address2}` : ""}, {a.city}, {a.state}
                          </p>
                          <p className="text-xs text-[var(--user-text-secondary)] font-semibold flex items-center gap-1"><Phone size={10} /> {a.phone}</p>
                          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-[var(--user-border)]">
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(a); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition text-xs font-semibold">
                              <Pencil size={11} /> Edit
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteAddress(a._id); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition text-xs font-semibold">
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 mb-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-3">
                        <MapPin size={28} className="text-[var(--user-text-subtle)]" />
                      </div>
                      <p className="text-sm text-[var(--user-text-muted)]">No saved addresses yet</p>
                    </div>
                  )}
                  <button onClick={openAddressModal} className="w-full h-12 rounded-xl border-2 border-dashed border-[var(--user-border)] text-sm font-bold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/60 hover:bg-[var(--user-accent)]/5 transition flex items-center justify-center gap-2">
                    <Plus size={16} /> Add New Address
                  </button>
                </div>

                <div className={`${cardCls} p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                      <Truck size={18} className="text-[var(--user-accent-text)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[var(--user-text)]">Shipping Method</h2>
                      <p className="text-xs text-[var(--user-text-muted)]">Choose your preferred delivery option</p>
                    </div>
                  </div>
                  {cfg.free_shipping_over > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-[var(--user-success)]/10 border border-[var(--user-success)]/20">
                      <p className="text-xs text-[var(--user-success)] font-bold flex items-center gap-2"><Gift size={14} /> Free shipping on orders over Rs. {cfg.free_shipping_over.toLocaleString()}</p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {shippingMethods.map((m) => {
                      const active = shippingMethod === m.id;
                      const IconComp = m.icon;
                      const baseFee = m.id === "express" ? cfg.express.fee : cfg.standard.fee;
                      // ✅ FREE only if active free-shipping deal covers THIS method
                      const isFreeForThisMethod = freeShippingByActiveItems && freeShippingDealsForMethod(m.id);
                      // ✅ For the SELECTED method, also reflect the server-side quote
                      //    (e.g. subtotal freeOver promotion or method quote). For
                      //    non-selected methods, show their normal base fee.
                      const displayFee = active ? shipping : baseFee;
                      const isFree = active ? (isFreeForCurrentMethod || shipping === 0) : isFreeForThisMethod;
                      // ✅ Show hint on any method NOT covered by the deal (only when a deal exists).
                      const showNotApplicableHint = freeShippingByActiveItems && !isFreeForThisMethod;
                      return (
                        <button key={m.id} onClick={() => setShippingMethod(m.id)} className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-200 ${active ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                          {m.badge && (
                            <span className={`absolute top-2 right-2 text-[8px] font-black px-2 py-0.5 rounded-full ${m.id === "express" ? "bg-[var(--user-accent)] text-[var(--user-accent-text)]" : "bg-[var(--user-border)] text-[var(--user-text-muted)]"}`}>{m.badge}</span>
                          )}
                          <IconComp size={20} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                          <div className="flex-1 w-full">
                            <p className="text-sm font-bold text-[var(--user-text)]">{m.title}</p>
                            <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{m.time}</p>
                            {active && shippingReason && <p className="text-[10px] text-[var(--user-success)] mt-1 font-semibold">{shippingReason}</p>}
                            {/* ✅ Non-covered method hint (only when a deal exists AND it's not covering this method) */}
                            {showNotApplicableHint && (
                              <p className="text-[10px] text-[var(--user-text-muted)] mt-1 font-semibold italic">
                                Free shipping not applicable
                              </p>
                            )}
                          </div>
                          <span className={`text-sm font-black ${isFree ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>{isFree ? "FREE" : `Rs. ${displayFee.toLocaleString()}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${cardCls} p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                      <CreditCard size={18} className="text-[var(--user-accent-text)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[var(--user-text)]">Payment Method</h2>
                      <p className="text-xs text-[var(--user-text-muted)]">Select how you'd like to pay</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { id: "cod", icon: Banknote, title: "Cash on Delivery", sub: "Pay when your order arrives", badge: "Most Popular" },
                      { id: "bank", icon: Landmark, title: "Bank Transfer", sub: "Transfer to our account", badge: null },
                      { id: "card", icon: CreditCard, title: "Debit / Credit Card", sub: "Visa, Mastercard accepted", badge: null },
                    ].map((m) => (
                      <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all duration-200 ${paymentMethod === m.id ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paymentMethod === m.id ? "bg-[var(--user-accent)]" : "bg-[var(--user-bg-hover)]"}`}>
                          <m.icon size={18} className={paymentMethod === m.id ? "text-[var(--user-accent-text)]" : "text-[var(--user-text-muted)]"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[var(--user-text)]">{m.title}</p>
                            {m.badge && <span className="text-[8px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 px-2 py-0.5 rounded-full">{m.badge}</span>}
                          </div>
                          <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{m.sub}</p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${paymentMethod === m.id ? "border-[var(--user-accent)] bg-[var(--user-accent)]" : "border-[var(--user-border)]"}`}>
                          {paymentMethod === m.id && <Check size={12} className="text-[var(--user-accent-text)]" />}
                        </div>
                      </button>
                    ))}
                  </div>
                  {paymentMethod === "bank" && (
                    <div className="mt-4 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] p-4">
                      <p className="text-xs font-bold text-[var(--user-text)] mb-2">Bank Transfer Details</p>
                      <div className="space-y-1 text-xs text-[var(--user-text-muted)]">
                        <p>Account: <span className="font-bold text-[var(--user-text)]">ClickMasters Store</span></p>
                        <p>Bank: <span className="font-bold text-[var(--user-text)]">Meezan Bank</span></p>
                        <p>IBAN: <span className="font-mono font-bold text-[var(--user-text)]">PK00 MEZN 0000 1234 5678 9012</span></p>
                      </div>
                    </div>
                  )}
                  {paymentMethod === "card" && (
                    <div className="mt-5">
                      <CardPreview number={cardForm.number} name={cardForm.name} expiry={cardForm.expiry} />
                      <div className="space-y-3 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] p-4">
                        <div><label className={labelCls}>Card Number</label>
                          <input value={cardForm.number} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 16); setCardForm({ ...cardForm, number: v.replace(/(\d{4})(?=\d)/g, "$1 ") }); }} placeholder="1234 5678 9012 3456" className={inputCls} /></div>
                        <div><label className={labelCls}>Card Holder Name</label>
                          <input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="John Doe" className={inputCls} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className={labelCls}>Expiry</label>
                            <input value={cardForm.expiry} onChange={(e) => { let v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2); setCardForm({ ...cardForm, expiry: v }); }} placeholder="MM/YY" className={inputCls} /></div>
                          <div><label className={labelCls}>CVV</label>
                            <input type="password" value={cardForm.cvv} onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" className={inputCls} /></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <SummaryPanel footer={
                <div className="space-y-3">
                  <button onClick={() => selectedAddressId ? goToStep(3) : toast.error("Please select or add a delivery address first")} className={`w-full h-12 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 ${accentBtn}`}>
                    Review Order <ArrowRight size={16} />
                  </button>
                  <button onClick={backToStep1} className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${ghostBtn}`}>
                    <ArrowLeft size={14} /> Back to Cart
                  </button>
                </div>
              } />
            </div>
          )}

          {/* ============ STEP 3 ============ */}
          {step === 3 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 items-start">
              <div className="space-y-4 sm:space-y-5">
                <div className={`${cardCls} p-5 sm:p-6`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                      <ShieldCheck size={18} className="text-[var(--user-accent-text)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[var(--user-text)]">Review Your Order</h2>
                      <p className="text-xs text-[var(--user-text-muted)]">Please verify all details before placing your order</p>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4 mb-5">
                    <div className="rounded-xl border-2 border-[var(--user-border)] p-4 bg-[var(--user-bg-hover)]/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-[var(--user-text)] uppercase tracking-wider">Delivery Address</p>
                        <button onClick={() => goToStep(2)} className="text-xs font-bold text-[var(--user-accent)] hover:opacity-80">Change</button>
                      </div>
                      {selectedAddress && (
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-[var(--user-text)]">{selectedAddress.full_name}</p>
                          <p className="text-xs text-[var(--user-text-muted)] leading-relaxed">
                            {selectedAddress.street_address1}{selectedAddress.street_address2 ? `, ${selectedAddress.street_address2}` : ""}<br />
                            {selectedAddress.city}, {selectedAddress.state}, {selectedAddress.country}
                          </p>
                          <p className="text-xs text-[var(--user-text-secondary)] font-semibold mt-2 flex items-center gap-1"><Phone size={10} /> {selectedAddress.phone}</p>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border-2 border-[var(--user-border)] p-4 bg-[var(--user-bg-hover)]/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-black text-[var(--user-text)] uppercase tracking-wider">Shipping & Payment</p>
                        <button onClick={() => goToStep(2)} className="text-xs font-bold text-[var(--user-accent)] hover:opacity-80">Change</button>
                      </div>
                      <div className="space-y-2 text-xs text-[var(--user-text-muted)]">
                        <div className="flex items-center gap-2">
                          <Truck size={12} className="text-[var(--user-accent)]" />
                          <span className="font-semibold text-[var(--user-text)]">{shippingMethods.find((m) => m.id === shippingMethod)?.title}</span>
                        </div>
                        <p className="text-[10px]">{shippingMethods.find((m) => m.id === shippingMethod)?.time}</p>
                        {shippingReason && <p className="text-[var(--user-success)] font-semibold">{shippingReason}</p>}
                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--user-border)]">
                          {paymentMethod === "cod" ? <Banknote size={12} className="text-[var(--user-accent)]" /> : paymentMethod === "bank" ? <Landmark size={12} className="text-[var(--user-accent)]" /> : <CreditCard size={12} className="text-[var(--user-accent)]" />}
                          <span className="font-semibold text-[var(--user-text)]">
                            {paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod === "bank" ? "Bank Transfer" : "Debit / Credit Card"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-[var(--user-border)] p-4">
                    <p className="text-xs font-black text-[var(--user-text)] uppercase tracking-wider mb-3">Order Items ({itemsWithDiscounts.length})</p>
                    <div className="divide-y-2 divide-[var(--user-border)] space-y-3">
                      {itemsWithDiscounts.map((i) => (
                        <div key={i.key} className="flex items-start gap-3 pt-3 first:pt-0">
                          <ItemThumb item={i} size="w-14 h-14" />
                          <div className="flex-1 min-w-0 space-y-1">
                            <p className="text-xs sm:text-sm font-bold text-[var(--user-text)] line-clamp-2">{i.name}</p>
{i.dealActive && i.dealId && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 px-2 py-1 rounded-full">
                                  <Gift size={9} />
                                  {i.dealType === 'buy_x_get_y' ? `Buy ${i.dealBuyQuantity} Get ${i.dealGetQuantity} Free` : (i.dealName || 'Active Deal')}
                                </span>
                              </div>
                            )}
                            <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)]">Qty: {i.qty} {i.freeItems > 0 && `(${i.payableItems} paid + ${i.freeItems} FREE)`}</p>
                          </div>
                          <p className="text-xs sm:text-sm font-black text-[var(--user-text)]">Rs. {Number(i.lineTotal || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <SummaryPanel footer={
                <div className="space-y-3">
                  <button onClick={placeOrder} disabled={placing} className={`w-full h-12 rounded-xl text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 ${accentBtn}`}>
                    {placing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    {placing ? "Placing Order..." : "Place Order"}
                  </button>
                  <button onClick={() => goToStep(2)} className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${ghostBtn}`}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <div className="flex items-center justify-center gap-2 pt-3 border-t border-[var(--user-border)]">
                    <ShieldCheck size={14} className="text-[var(--user-success)]" />
                    <span className="text-xs text-[var(--user-text-muted)] font-semibold">Your payment is secure and encrypted</span>
                  </div>
                </div>
              } />
            </div>
          )}
        </>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4" onClick={() => setShowAddressModal(false)} style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--user-bg-elevated)] border-t-2 sm:border-2 border-[var(--user-border)] shadow-2xl" style={{ animation: "modalUp .3s ease-out" }} onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-elevated)]/95 backdrop-blur-sm">
              <h3 className="text-sm font-black text-[var(--user-text)]">{editingAddressId ? "Edit Address" : "Add New Address"}</h3>
              <button onClick={() => { setShowAddressModal(false); setEditingAddressId(null); }} className="p-2 rounded-xl border-2 border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Full Name</label>
                  <input value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} placeholder="Ahsan Khan" className={inputCls} /></div>
                <div><label className={labelCls}>Phone Number</label>
                  <input type="tel" value={addressForm.phone} maxLength={14} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 14); setAddressForm({ ...addressForm, phone: val }); }} placeholder="03001234567" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Country / Region</label>
                <div className="relative">
                  <select value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} className={inputCls + " appearance-none pr-10 cursor-pointer"}>
                    <option value="">Select country</option>
                    {allCountries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                </div></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className={labelCls}>State</label>
                  <div className="relative">
                    <select value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} disabled={!addressForm.country} className={inputCls + " appearance-none pr-10 cursor-pointer disabled:opacity-50"}>
                      <option value="">Select</option>
                      {allStates.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                  </div></div>
                <div><label className={labelCls}>City</label>
                  <div className="relative">
                    <select value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} disabled={!addressForm.state} className={inputCls + " appearance-none pr-10 cursor-pointer disabled:opacity-50"}>
                      <option value="">Select</option>
                      {allCities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                  </div></div>
                <div><label className={labelCls}>ZIP Code</label>
                  <input value={addressForm.zip_code} onChange={(e) => setAddressForm({ ...addressForm, zip_code: e.target.value })} placeholder="54000" className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Street Address</label>
                <textarea value={addressForm.street_address1} onChange={(e) => setAddressForm({ ...addressForm, street_address1: e.target.value })} rows="2" placeholder="Street address or P.O. Box" className={textareaCls} /></div>
              <div><label className={labelCls}>Delivery Instructions (Optional)</label>
                <textarea value={addressForm.delivery_instructions} onChange={(e) => setAddressForm({ ...addressForm, delivery_instructions: e.target.value })} rows="2" placeholder="Add preferences, notes, access codes" className={textareaCls} /></div>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] cursor-pointer hover:border-[var(--user-accent)]/40 transition">
                <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: "var(--user-accent)" }} />
                <span className="text-sm font-semibold text-[var(--user-text)]">Make this my default address</span>
              </label>
              <div className="pt-4 flex items-center justify-between gap-3 border-t-2 border-[var(--user-border)]">
                <button onClick={() => { setShowAddressModal(false); setEditingAddressId(null); }} className={`h-12 px-6 rounded-xl text-sm font-bold ${ghostBtn}`}>Cancel</button>
                <button onClick={saveAddress} disabled={savingAddress} className={`h-12 px-8 rounded-xl text-sm font-black flex items-center gap-2 disabled:opacity-50 ${accentBtn}`}>
                  {savingAddress ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>

    {/* ============= MOBILE (Daraz-style single-scroll) — lg:hidden ============= */}
    {(() => {
      // Early-out: loading / empty / needs-phone states render their compact mobile equivalents.
      if (userLoading || !draftReady || (!user && !needsPhone)) {
        return (
          <div className="lg:hidden min-h-[60vh] flex items-center justify-center bg-[var(--user-bg)]">
            <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
          </div>
        );
      }
      if (!user) return null;

      // Empty cart on step 1 (mobile)
      if (step === 1 && cart.length === 0 && !placing) {
        return (
          <div className="lg:hidden bg-[var(--user-bg)] min-h-[60vh]">
            <div
              className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center gap-2 px-3 h-12">
                <button type="button" onClick={() => router.push("/")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                  <ArrowLeft size={20} />
                </button>
                <p className="text-[15px] font-black text-[var(--user-text)]">Checkout</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center pt-16 pb-8 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-[var(--user-bg-card)] border-2 border-[var(--user-border)] flex items-center justify-center mb-5">
                <Package size={36} className="text-[var(--user-accent)]" />
              </div>
              <h2 className="text-lg font-black text-[var(--user-text)] mb-1.5">Your cart is empty</h2>
              <p className="text-xs text-[var(--user-text-muted)] mb-6 max-w-[280px]">Looks like you haven&apos;t added anything yet.</p>
              <button onClick={() => router.push("/")} className="w-full max-w-xs h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition">
                <ShoppingBag size={16} /> Start Shopping
              </button>
            </div>
          </div>
        );
      }

      // needsPhone state — use the same compact card style
      if (needsPhone) {
        return (
          <div className="lg:hidden bg-[var(--user-bg)] min-h-[60vh]">
            <div
              className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center gap-2 px-3 h-12">
                <button type="button" onClick={() => router.push("/")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                  <ArrowLeft size={20} />
                </button>
                <p className="text-[15px] font-black text-[var(--user-text)]">Checkout</p>
              </div>
            </div>
            <div className="px-4 pt-6 pb-8 max-w-[480px] mx-auto">
              <div className="bg-[var(--user-bg-card)] rounded-2xl border-2 border-[var(--user-border)] p-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--user-accent)] flex items-center justify-center mb-4">
                  <Phone size={22} className="text-[var(--user-accent-text)]" />
                </div>
                <h2 className="text-lg font-black text-[var(--user-text)] mb-1.5">Phone Number Required</h2>
                <p className="text-xs text-[var(--user-text-muted)] mb-5">We need your phone number for delivery updates and order confirmation.</p>
                <label className="block text-xs font-bold text-[var(--user-text-secondary)] mb-2 uppercase tracking-wider">Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" className="w-full h-12 px-4 rounded-xl text-sm outline-none border-2 border-[var(--user-border)] bg-[var(--user-bg-input)] text-[var(--user-text)] focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)]" />
                <button onClick={savePhone} disabled={savingPhone} className="mt-5 w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingPhone ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Save & Continue
                </button>
              </div>
            </div>
          </div>
        );
      }

      // ✅ Main mobile checkout: single-scroll, all cards visible at once.
      const shippingMethodsMob = [
        { id: "standard", title: "Standard Delivery", time: `${cfg.standard.min_days}–${cfg.standard.max_days} days`, icon: Truck },
        { id: "express", title: "Express Delivery", time: `${cfg.express.min_days}–${cfg.express.max_days} days`, icon: Zap },
      ];

      return (
        <div className="lg:hidden bg-[var(--user-bg)]">
          {/* Sticky top app bar */}
          <div
            className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center gap-2 px-3 h-12">
              <button type="button" onClick={() => router.push("/cart")} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                <ArrowLeft size={20} />
              </button>
              <p className="text-[15px] font-black text-[var(--user-text)]">Checkout</p>
            </div>
          </div>

          <div className="px-3 pt-3 pb-28 space-y-2">
            {/* Card 1: Shipping Address — standalone card with header (tappable) */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] overflow-hidden">
              <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <MapPin size={13} /> Shipping Address
              </p>
              <button
                type="button"
                onClick={() => { setMobileAddressForm(false); setEditingAddressId(null); setMobileAddressSheet(true); }}
                aria-label="Change delivery address"
                className="w-full text-left px-3 pb-3 pt-1 flex items-center gap-3 active:scale-[0.99] transition"
              >
                <div className="w-9 h-9 rounded-lg bg-[var(--user-accent)]/10 flex items-center justify-center shrink-0">
                  <MapPin size={18} className="text-[var(--user-accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  {selectedAddress ? (
                    <>
                      <p className="text-[13px] font-black text-[var(--user-text)] truncate">
                        {selectedAddress.full_name} <span className="text-[var(--user-text-muted)] font-semibold">· {selectedAddress.phone}</span>
                      </p>
                      <p className="text-[11px] text-[var(--user-text-muted)] line-clamp-2 mt-0.5">
                        {selectedAddress.street_address1}{selectedAddress.street_address2 ? `, ${selectedAddress.street_address2}` : ""}, {selectedAddress.city}, {selectedAddress.state}
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-[var(--user-text-muted)]">Tap to select a delivery address</p>
                  )}
                </div>
                <span className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--user-text-muted)] shrink-0">
                  <ChevronDown size={18} />
                </span>
              </button>
            </div>

            {/* Card 2: Items (only) */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <Package size={13} /> Items
              </p>

              {/* Compact item rows */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                {itemsWithDiscounts.map((i) => (
                  <div key={i.key} className="flex items-center gap-2.5">
                    <ItemThumb item={i} size="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[var(--user-text)] line-clamp-1">{i.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {i.variantTitle && <p className="text-[10px] text-[var(--user-text-muted)] truncate">{i.variantTitle}</p>}
                        <p className="text-[10px] text-[var(--user-text-muted)]">×{i.qty}{i.freeItems > 0 ? ` (${i.payableItems} paid)` : ""}</p>
                      </div>
                    </div>
                    <p className="text-[12px] font-black text-[var(--user-text)] shrink-0">Rs. {i.lineTotal.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Free shipping threshold banner (matches desktop) */}
              {cfg.free_shipping_over > 0 && (
                <p className="text-[10px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <Gift size={11} /> Free shipping on orders over Rs. {cfg.free_shipping_over.toLocaleString()}
                </p>
              )}
            </div>

            {/* Card 3: Delivery Method (standalone) */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <Truck size={13} /> Delivery Method
              </p>
              <div className="space-y-1.5">
                {shippingMethodsMob.map((m) => {
                  const active = shippingMethod === m.id;
                  const IconComp = m.icon;
                  const baseFee = m.id === "express" ? cfg.express.fee : cfg.standard.fee;
                  const isFreeForThisMethod = freeShippingByActiveItems && freeShippingDealsForMethod(m.id);
                  const isFree = active ? (isFreeForCurrentMethod || shipping === 0) : isFreeForThisMethod;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 rounded-lg border-2 p-2.5 cursor-pointer transition ${active ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}
                    >
                      <input
                        type="radio"
                        name="shipping-method-mobile"
                        checked={active}
                        onChange={() => setShippingMethod(m.id)}
                        className="w-4 h-4 shrink-0"
                        style={{ accentColor: "var(--user-accent)" }}
                      />
                      <IconComp size={18} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[var(--user-text)]">{m.title}</p>
                        <p className="text-[10px] text-[var(--user-text-muted)]">{m.time}</p>
                      </div>
                      <span className={`text-[12px] font-black shrink-0 ${isFree ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                        {isFree ? "FREE" : `Rs. ${baseFee.toLocaleString()}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Card 4: Payment (compact icon chips — equal-width grid) */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <CreditCard size={13} /> Payment
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "cod", icon: Truck, label: "COD" },
                  { id: "bank", icon: Landmark, label: "Bank" },
                  { id: "card", icon: CreditCard, label: "Card" },
                ].map((m) => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      aria-pressed={active}
                      className={`w-full flex flex-col items-center justify-center px-2 py-2 rounded-xl border-2 transition active:scale-95 ${
                        active
                          ? "border-[var(--user-accent)] bg-[var(--user-accent)]/10 text-[var(--user-accent)]"
                          : "border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/40"
                      }`}
                    >
                      <m.icon size={18} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                      <span className="text-[10px] font-black uppercase tracking-wider mt-1">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 4: Order summary */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <PackageCheck size={13} /> Order Summary
              </p>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>Items Total ({itemsWithDiscounts.length})</span>
                  <span className="font-bold text-[var(--user-text)]">Rs. {subtotal.toLocaleString()}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-[var(--user-success)]">
                    <span className="font-bold">You Save</span>
                    <span className="font-black">-Rs. {totalSavings.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>Shipping Fee</span>
                  <span className={`font-bold ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                    {shipping === 0 ? "FREE" : `Rs. ${shipping.toLocaleString()}`}
                  </span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-[var(--user-text-muted)]">
                    <span>Tax</span>
                    <span className="font-bold text-[var(--user-text)]">Rs. {tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--user-border)]">
                  <span className="text-[13px] font-black text-[var(--user-text)]">Total</span>
                  <span className="text-lg font-black text-[var(--user-accent)]">Rs. {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky bottom bar — direct child of lg:hidden page root, fixed bottom-0 z-50 */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)]"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[var(--user-text-muted)] font-bold uppercase tracking-wider">
                  Total
                  <span className={`ml-1 ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text-muted)]"}`}>
                    {shipping === 0 ? "FREE shipping" : "incl. shipping"}
                  </span>
                </p>
                <p className="text-base font-black text-[var(--user-accent)] leading-none mt-0.5">Rs. {grandTotal.toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setOrderReviewOpen(true)}
                disabled={placing}
                className="h-11 px-6 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black uppercase tracking-wider flex items-center gap-2 active:scale-95 disabled:opacity-60 transition shadow-lg shadow-[var(--user-accent)]/20"
              >
                {placing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                {placing ? "Placing..." : "Place Order"}
              </button>
            </div>
          </div>

          {/* Mobile Address Selector Sheet (Daraz-style) */}
          {mobileAddressSheet && (
            <div
              className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm"
              onClick={() => { setMobileAddressSheet(false); setMobileAddressForm(false); setEditingAddressId(null); }}
              style={{ animation: "fadeIn 0.2s ease-out" }}
            >
              <div
                className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--user-bg-card)] border-t-2 border-[var(--user-border)] shadow-2xl"
                style={{ animation: "modalUp .3s ease-out", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sheet header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
                  <h3 className="text-[15px] font-black text-[var(--user-text)]">
                    {mobileAddressForm ? (editingAddressId ? "Edit Address" : "Add New Address") : "Delivery Address"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setMobileAddressSheet(false); setMobileAddressForm(false); setEditingAddressId(null); }}
                    aria-label="Close"
                    className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* List of addresses */}
                {!mobileAddressForm && (
                  <div className="p-3 space-y-2">
                    {addresses.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-3">
                          <MapPin size={24} className="text-[var(--user-text-muted)]" />
                        </div>
                        <p className="text-sm text-[var(--user-text-muted)]">No saved addresses yet</p>
                      </div>
                    )}
                    {addresses.map((a) => {
                      const isSel = selectedAddressId === a._id;
                      return (
                        <div
                          key={a._id}
                          className={`w-full text-left rounded-xl border-2 p-3 transition ${isSel ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)]"}`}
                        >
                          <button
                            type="button"
                            onClick={() => { setSelectedAddressId(a._id); setMobileAddressSheet(false); setEditingAddressId(null); }}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13px] font-black text-[var(--user-text)] truncate">{a.full_name}</p>
                              <span className="text-[11px] text-[var(--user-text-muted)] font-semibold">· {a.phone}</span>
                              {a.is_default && <span className="text-[8px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded shrink-0">DEFAULT</span>}
                              {isSel && <Check size={14} className="text-[var(--user-accent)] ml-auto shrink-0" />}
                            </div>
                            <p className="text-[11px] text-[var(--user-text-muted)] line-clamp-2 leading-snug">
                              {a.street_address1}{a.street_address2 ? `, ${a.street_address2}` : ""}, {a.city}, {a.state}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-[var(--user-border)]">
                            <button
                              type="button"
                              onClick={() => { openEditModal(a); setMobileAddressForm(true); }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition text-[11px] font-semibold"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm("Delete this address?")) deleteAddress(a._id); }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition text-[11px] font-semibold"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => { openAddressModal(); setMobileAddressForm(true); }}
                      className="w-full h-11 rounded-xl border-2 border-dashed border-[var(--user-border)] text-[12px] font-bold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/60 hover:bg-[var(--user-accent)]/5 transition flex items-center justify-center gap-2 mt-2"
                    >
                      <Plus size={14} /> Add New Address
                    </button>
                  </div>
                )}

                {/* Inline address form (add/edit) — reuses desktop state, mutations, query keys */}
                {mobileAddressForm && (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">Full Name</label>
                        <input value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} placeholder="Ahsan Khan" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">Phone Number</label>
                        <input type="tel" value={addressForm.phone} maxLength={14} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 14); setAddressForm({ ...addressForm, phone: val }); }} placeholder="03001234567" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">Country / Region</label>
                        <div className="relative">
                          <select value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} className={inputCls + " appearance-none pr-10 cursor-pointer"}>
                            <option value="">Select country</option>
                            {allCountries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                          </select>
                          <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">State</label>
                          <div className="relative">
                            <select value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} disabled={!addressForm.country} className={inputCls + " appearance-none pr-10 cursor-pointer disabled:opacity-50"}>
                              <option value="">Select</option>
                              {allStates.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">City</label>
                          <div className="relative">
                            <select value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} disabled={!addressForm.state} className={inputCls + " appearance-none pr-10 cursor-pointer disabled:opacity-50"}>
                              <option value="">Select</option>
                              {allCities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">ZIP Code</label>
                        <input value={addressForm.zip_code} onChange={(e) => setAddressForm({ ...addressForm, zip_code: e.target.value })} placeholder="54000" className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">Street Address</label>
                        <textarea value={addressForm.street_address1} onChange={(e) => setAddressForm({ ...addressForm, street_address1: e.target.value })} rows="2" placeholder="Street address or P.O. Box" className={textareaCls} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--user-text-secondary)] mb-1.5 uppercase tracking-wider">Delivery Instructions (Optional)</label>
                        <textarea value={addressForm.delivery_instructions} onChange={(e) => setAddressForm({ ...addressForm, delivery_instructions: e.target.value })} rows="2" placeholder="Add preferences, notes, access codes" className={textareaCls} />
                      </div>
                      <label className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] cursor-pointer">
                        <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: "var(--user-accent)" }} />
                        <span className="text-[12px] font-semibold text-[var(--user-text)]">Make this my default address</span>
                      </label>
                    </div>
                    <div className="pt-3 flex items-center justify-between gap-2 border-t border-[var(--user-border)]">
                      <button onClick={() => { setMobileAddressForm(false); setEditingAddressId(null); setShowAddressModal(false); }} className={`h-11 px-5 rounded-xl text-[12px] font-bold ${ghostBtn}`}>Cancel</button>
                      <button onClick={async () => { await saveAddress(); setMobileAddressForm(false); }} disabled={savingAddress} className={`h-11 px-6 rounded-xl text-[12px] font-black flex items-center gap-2 disabled:opacity-50 ${accentBtn}`}>
                        {savingAddress ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {editingAddressId ? "Update" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Mobile Order Review Sheet (Daraz-style) */}
          {orderReviewOpen && (
            <div
              className="fixed inset-0 z-[70] flex items-end bg-black/50 backdrop-blur-sm"
              onClick={() => { if (!placing) setOrderReviewOpen(false); }}
              style={{ animation: "fadeIn 0.2s ease-out" }}
            >
              <div
                className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--user-bg-card)] border-t-2 border-[var(--user-border)] shadow-2xl"
                style={{ animation: "modalUp .3s ease-out", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
                  <h3 className="text-[15px] font-black text-[var(--user-text)]">Order Review</h3>
                  <button
                    type="button"
                    onClick={() => { if (!placing) setOrderReviewOpen(false); }}
                    aria-label="Close"
                    className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Items */}
                <div className="px-4 pt-4 pb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--user-text-muted)] mb-2">Items ({itemsWithDiscounts.length})</p>
                  <div className="space-y-2.5">
                    {itemsWithDiscounts.map((i) => (
                      <div key={i.key} className="flex items-center gap-3">
                        <ItemThumb item={i} size="w-14 h-14" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-[var(--user-text)] line-clamp-2 leading-tight">{i.name}</p>
                          {i.variantTitle && <p className="text-[10px] text-[var(--user-text-muted)] truncate mt-0.5">{i.variantTitle}</p>}
                          <p className="text-[10px] text-[var(--user-text-muted)] mt-0.5">×{i.qty}{i.freeItems > 0 ? ` (${i.payableItems} paid)` : ""}</p>
                        </div>
                        <p className="text-[12px] font-black text-[var(--user-text)] shrink-0">Rs. {Number(i.lineTotal || 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Address */}
                <div className="px-4 py-3 border-t border-[var(--user-border)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--user-text-muted)] mb-1.5 flex items-center gap-1.5">
                    <MapPin size={11} /> Deliver to
                  </p>
                  {selectedAddress ? (
                    <>
                      <p className="text-[12px] font-bold text-[var(--user-text)] truncate">
                        {selectedAddress.full_name} <span className="text-[var(--user-text-muted)] font-semibold">· {selectedAddress.phone}</span>
                      </p>
                      <p className="text-[11px] text-[var(--user-text-muted)] truncate mt-0.5">
                        {selectedAddress.street_address1}{selectedAddress.street_address2 ? `, ${selectedAddress.street_address2}` : ""}, {selectedAddress.city}, {selectedAddress.state}
                      </p>
                    </>
                  ) : (
                    <p className="text-[12px] text-[var(--user-danger)] font-semibold">No address selected</p>
                  )}
                </div>

                {/* Payment */}
                <div className="px-4 py-3 border-t border-[var(--user-border)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[var(--user-text-muted)] mb-1.5 flex items-center gap-1.5">
                    <CreditCard size={11} /> Payment
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--user-bg-hover)] flex items-center justify-center shrink-0">
                      {paymentMethod === "cod" ? <Truck size={16} className="text-[var(--user-text-muted)]" /> : paymentMethod === "bank" ? <Landmark size={16} className="text-[var(--user-text-muted)]" /> : <CreditCard size={16} className="text-[var(--user-text-muted)]" />}
                    </div>
                    <p className="text-[12px] font-bold text-[var(--user-text)]">
                      {paymentMethod === "cod" ? "Cash on Delivery" : paymentMethod === "bank" ? "Bank Transfer" : "Debit / Credit Card"}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="px-4 py-3 border-t border-[var(--user-border)] space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--user-text-muted)]">Items Total ({itemsWithDiscounts.length})</span>
                    <span className="font-bold text-[var(--user-text)]">Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex justify-between">
                      <span className="font-bold text-[var(--user-success)]">You Save</span>
                      <span className="font-black text-[var(--user-success)]">-Rs. {totalSavings.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[var(--user-text-muted)]">Shipping Fee</span>
                    <span className={`font-bold ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                      {shipping === 0 ? "FREE" : `Rs. ${shipping.toLocaleString()}`}
                    </span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--user-text-muted)]">Tax</span>
                      <span className="font-bold text-[var(--user-text)]">Rs. {tax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--user-border)]">
                    <span className="text-[13px] font-black text-[var(--user-text)]">Total</span>
                    <span className="text-lg font-black text-[var(--user-text)]">Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Confirm button — calls EXISTING submit handler */}
                <div className="px-4 pt-2 pb-1">
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    className="w-full h-12 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition shadow-lg shadow-[var(--user-accent)]/20"
                  >
                    {placing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    {placing ? "Placing..." : "Confirm & Place Order"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      );
    })()}
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><div className="w-16 h-16 rounded-full border-4 border-[var(--user-border)] border-t-[var(--user-accent)] animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
