"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Country, State, City } from "country-state-city";
import axiosInstance from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import { orderApi } from "@/apis/user/orderApi";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings } from "@/utils/dealCalculator";
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

  const { cart, removeItems, updateQty, restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();

  const [step, setStep] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const [draftItems, setDraftItems] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState(emptyAddress());
  const [savingAddress, setSavingAddress] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [placing, setPlacing] = useState(false);
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

  useEffect(() => {
    if (!draftRestored.current) return;
    setSelectedKeys((prev) => {
      const keys = cart.map((i) => i.key);
      if (prev === null) return keys;
      const kept = prev.filter((k) => keys.includes(k));
      const added = keys.filter((k) => !prev.includes(k));
      return [...kept, ...added];
    });
  }, [cart]);

  const selectedCartItems = useMemo(() => cart.filter((i) => (selectedKeys || []).includes(i.key)), [cart, selectedKeys]);
  const activeItems = step === 1 ? selectedCartItems : draftItems;

  const toggleKey = (key) => setSelectedKeys((prev) => {
    const list = prev ?? cart.map((i) => i.key);
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  });

  const allSelected = cart.length > 0 && (selectedKeys || []).length === cart.length;
  const toggleAll = () => setSelectedKeys(allSelected ? [] : cart.map((i) => i.key));

  const itemsWithDiscounts = activeItems.map((i) => {
    const qty = Number(i.qty) || 1;
    const price = Number(i.price) || 0;
    const fakeProduct = {
      _id: i.productId || i.id,
      category_id: i.categoryId || null,
      brand_id: i.brandId || null,
      discount: i.productDiscountPct || 0,
    };
    const disc = calculateProductDiscount(fakeProduct, price);
    const discountedPrice = Number(disc.discountedPrice) || price;
    const originalPrice = Number(disc.originalPrice) || price;
    let freeItems = 0, payableItems = qty, dealSavings = 0;
    if (i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity) {
      freeItems = calculateFreeItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      payableItems = calculatePayableItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      dealSavings = calculateBuyXGetYSavings(qty, discountedPrice, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
    }
    const lineTotal = Number(payableItems * discountedPrice) || 0;
    return {
      ...i, qty, displayPrice: discountedPrice, originalPrice,
      hasDiscount: disc.hasDiscount || i.dealType === "buy_x_get_y",
      savings: disc.savings || 0, dealSavings, freeItems, payableItems, lineTotal,
    };
  });

  const subtotal = itemsWithDiscounts.reduce((s, i) => s + i.lineTotal, 0);
  const totalSavings = itemsWithDiscounts.reduce((s, i) => s + (i.savings * i.qty) + i.dealSavings, 0);

  const { data: shipConfig } = useQuery({ queryKey: ["shippingConfig"], queryFn: shippingApi.getConfig, staleTime: 60 * 1000 });
  const cfg = shipConfig || DEFAULT_SHIP_CONFIG;

  const { data: shipQuote } = useQuery({
    queryKey: ["shippingQuote", shippingMethod, Math.round(subtotal), activeItems.map((i) => i.productId || i.id).join(",")],
    queryFn: () => shippingApi.quote({
      items: activeItems.map((i) => ({ productId: i.productId || i.id, brandId: i.brandId, categoryId: i.categoryId })),
      method: shippingMethod, subtotal,
    }),
    enabled: activeItems.length > 0,
  });

  const shipping = shipQuote?.fee ?? (shippingMethod === "express" ? cfg.express.fee : cfg.standard.fee);
  const shippingReason = shipQuote?.reason || "";

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
      await orderApi.place({ items: itemsWithDiscounts, address_id: selectedAddressId, payment_method: paymentMethod, shipping_method: shippingMethod });
            queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
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
              {i.dealId && (
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
              {i.hasDiscount && i.originalPrice > i.displayPrice && (
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
                        <p className="text-xs text-[var(--user-text-muted)]">{cart.length} items available</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded" style={{ accentColor: "var(--user-accent)" }} />
                      <span className="text-xs font-bold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition">Select All</span>
                    </label>
                  </div>

                  {/* ✅ LIST — right card tak phailti hai, phir scroll */}
                  <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 overflow-y-auto max-h-[420px] sm:max-h-[520px] lg:max-h-none lg:flex-1 lg:min-h-0 custom-scrollbar">
                    {itemsWithDiscounts.map((item) => {
                      const checked = (selectedKeys || []).includes(item.key);
                      return (
                        <label key={item.key} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          checked ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"
                        }`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleKey(item.key)} className="w-4 h-4 rounded mt-1 shrink-0" style={{ accentColor: "var(--user-accent)" }} />
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
                              {item.hasDiscount && item.originalPrice > item.displayPrice && (
                                <p className="text-[10px] text-[var(--user-text-subtle)] line-through">Rs. {item.originalPrice.toLocaleString()}</p>
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
                        </label>
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
                      const displayFee = active ? shipping : baseFee;
                      const isFree = displayFee === 0;
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
                            {i.dealId && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 px-2 py-0.5 rounded-full">
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
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><div className="w-16 h-16 rounded-full border-4 border-[var(--user-border)] border-t-[var(--user-accent)] animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}