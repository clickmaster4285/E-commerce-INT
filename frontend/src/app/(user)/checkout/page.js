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

const ItemThumb = ({ item, size = "w-12 h-12" }) =>
  getImgUrl(item.image) ? (
    <img src={getImgUrl(item.image)} alt="" className={`${size} rounded-lg object-cover border border-[var(--user-border)] shrink-0`} />
  ) : (
    <div className={`${size} rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center shrink-0`}>
      <Package size={15} className="text-[var(--user-text-subtle)]" />
    </div>
  );

const CardPreview = ({ number, name, expiry }) => (
  <div className="relative w-full max-w-[340px] h-[180px] rounded-2xl mx-auto mb-5 overflow-hidden shadow-2xl"
    style={{ background: "linear-gradient(135deg, #0b1220 0%, #16213e 55%, #065f46 130%)" }}>
    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
    <div className="absolute -bottom-14 -left-8 w-44 h-44 rounded-full bg-white/5" />
    <div className="relative p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-300 to-amber-500" />
        <span className="text-white/80 text-sm font-black italic tracking-wider">
          {number.replace(/\s/g, "").endsWith("4") ? "VISA" : "MasterCard"}
        </span>
      </div>
      <p className="text-white font-mono text-[15px] tracking-[0.14em]">{number || "•••• •••• •••• ••••"}</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[8px] uppercase tracking-widest text-white/50">Card Holder</p>
          <p className="text-white text-xs font-bold uppercase tracking-wider">{name || "YOUR NAME"}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase tracking-widest text-white/50">Expires</p>
          <p className="text-white text-xs font-bold">{expiry || "MM/YY"}</p>
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
          if (Array.isArray(d.selectedKeys) && d.selectedKeys.length > 0) {
            setSelectedKeys(d.selectedKeys);
          } else {
            setSelectedKeys(cart.map((i) => i.key));
          }
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
    
    let freeItems = 0;
    let payableItems = qty;
    let dealSavings = 0;
    
    if (i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity) {
      freeItems = calculateFreeItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      payableItems = calculatePayableItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      dealSavings = calculateBuyXGetYSavings(qty, discountedPrice, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
    }
    
    const lineTotal = Number(payableItems * discountedPrice) || 0;

    return {
      ...i,
      qty,
      displayPrice: discountedPrice,
      originalPrice: originalPrice,
      hasDiscount: disc.hasDiscount || i.dealType === "buy_x_get_y",
      savings: disc.savings || 0,
      dealSavings,
      freeItems,
      payableItems,
      lineTotal,
    };
  });

  const subtotal = itemsWithDiscounts.reduce((s, i) => s + i.lineTotal, 0);
  const totalSavings = itemsWithDiscounts.reduce((s, i) => s + (i.savings * i.qty) + i.dealSavings, 0);

  // ✅ CHANGE 1: Live shipping config + quote
  const { data: shipConfig } = useQuery({
    queryKey: ["shippingConfig"],
    queryFn: shippingApi.getConfig,
    staleTime: 60 * 1000,
  });
  const cfg = shipConfig || DEFAULT_SHIP_CONFIG;

  const { data: shipQuote } = useQuery({
    queryKey: [
      "shippingQuote",
      shippingMethod,
      Math.round(subtotal),
      activeItems.map((i) => i.productId || i.id).join(","),
    ],
    queryFn: () =>
      shippingApi.quote({
        items: activeItems.map((i) => ({
          productId: i.productId || i.id,
          brandId: i.brandId,
          categoryId: i.categoryId,
        })),
        method: shippingMethod,
        subtotal,
      }),
    enabled: activeItems.length > 0,
  });

  const shipping = shipQuote?.fee ?? (shippingMethod === "express" ? cfg.express.fee : cfg.standard.fee);
  const shippingReason = shipQuote?.reason || "";

  const tax = Math.round(
    itemsWithDiscounts.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.tax || 0) / 100), 0)
  );
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
      if (editingAddressId) {
        await addressApi.update(editingAddressId, f);
        toast.success("Address updated!");
      } else {
        const created = await addressApi.create(f);
        setSelectedAddressId(created._id);
        toast.success("Address saved!");
      }
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
      await orderApi.place({
        items: activeItems, address_id: selectedAddressId,
        payment_method: paymentMethod, shipping_method: shippingMethod,
      });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      setDraftItems([]);
      if (currentDraftId) {
        await axiosInstance.delete(`/users/checkout-drafts/${currentDraftId}`).catch(() => {});
        setCurrentDraftId(null);
      }
      router.push("/orders");
    } catch (e) {
      toast.error(e.response?.data?.message || "Order place failed");
      setPlacing(false);
    }
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
      <div className="max-w-[600px] mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-4 sm:mb-5">
          <Package size={28} className="text-[var(--user-accent)] sm:w-8 sm:h-8" />
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-[var(--user-text)] mb-2">Your cart is empty</h1>
        <p className="text-xs sm:text-sm text-[var(--user-text-muted)] mb-6 sm:mb-7">Add some products to your cart before checking out.</p>
        <button onClick={() => router.push("/")} className="bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">
          Continue Shopping
        </button>
      </div>
    );
  }

  const inputCls = "w-full h-11 sm:h-10 px-3 rounded-lg text-sm outline-none transition focus:ring-1 focus:ring-[var(--user-accent)]/50 bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text)]";
  const labelCls = "block text-xs font-bold text-[var(--user-text-secondary)] mb-1.5";
  const cardCls = "rounded-xl sm:rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]";
  const textareaCls = "w-full px-3 py-2 rounded-lg text-sm outline-none transition focus:ring-1 focus:ring-[var(--user-accent)]/50 bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text)] resize-none";

  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-5 sm:mb-8">
      {["Items", "Delivery", "Review"].map((label, i) => {
        const n = i + 1;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center">
            <button onClick={() => done && goToStep(n)} className={`flex items-center gap-1.5 sm:gap-2.5 ${done ? "cursor-pointer" : "cursor-default"}`}>
              <span className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border-2 transition ${
                done ? "bg-[var(--user-success)] border-[var(--user-success)] text-white"
                : active ? "bg-[var(--user-accent)] border-[var(--user-accent)] text-[var(--user-accent-text)] shadow-lg shadow-[var(--user-accent)]/30"
                : "border-[var(--user-border)] text-[var(--user-text-muted)]"}`}>
                {done ? <Check size={13} className="sm:w-4 sm:h-4" /> : n}
              </span>
              <span className="text-left">
                <span className="hidden sm:block text-[9px] font-bold uppercase tracking-widest text-[var(--user-text-subtle)]">Step {n}</span>
                <span className={`block text-[10px] sm:text-xs font-bold ${active || done ? "text-[var(--user-text)]" : "text-[var(--user-text-muted)]"}`}>{label}</span>
              </span>
            </button>
            {n < 3 && <div className={`w-4 sm:w-8 lg:w-20 h-0.5 mx-1 sm:mx-2 lg:mx-4 rounded-full ${done ? "bg-[var(--user-success)]" : "bg-[var(--user-border)]"}`} />}
          </div>
        );
      })}
    </div>
  );

  const SummaryPanel = ({ footer }) => (
    <div className={`${cardCls} p-4 sm:p-5 lg:sticky lg:top-24`}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)] mb-3 sm:mb-4">
        <PackageCheck size={16} className="text-[var(--user-accent)]" /> Order Summary
      </h2>
      <div className="space-y-2.5 my-3 sm:space-y-3 max-h-[250px] sm:max-h-[300px] overflow-y-auto pr-1 mb-3 sm:mb-4">
        {itemsWithDiscounts.map((i) => (
          <div key={i.key} className="flex items-center gap-2.5 sm:gap-3">
            <ItemThumb item={i} size="w-10 h-10 sm:w-12 sm:h-12" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] sm:text-xs font-semibold text-[var(--user-text)] truncate">{i.name}</p>
              
              {i.dealId && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                    <Tag size={9} /> 
                    {i.dealType === 'buy_x_get_y' 
                      ? `Buy ${i.dealBuyQuantity || 2} Get ${i.dealGetQuantity || 1} Free` 
                      : (i.dealName || 'Active Deal')}
                  </span>
                  {i.freeItems > 0 && (
                    <span className="text-[9px] sm:text-[10px] font-bold text-green-600 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                      {i.freeItems} FREE
                    </span>
                  )}
                </div>
              )}

              <p className="text-[9px] sm:text-[10px] text-[var(--user-text-muted)] mt-1">
Qty: {i.qty} {i.freeItems > 0 && `(${i.payableItems} paid + ${i.freeItems} FREE = ${i.payableItems + i.freeItems} items)`}
              </p>
            </div>
            <div className="text-right">
              {i.hasDiscount && i.originalPrice > i.displayPrice && (
                <p className="text-[9px] text-[var(--user-text-subtle)] line-through">
                  Rs. {(i.originalPrice * i.qty).toLocaleString()}
                </p>
              )}
              <p className="text-[11px] sm:text-xs font-bold text-[var(--user-text)]">
                Rs. {i.lineTotal.toLocaleString()}
              </p>
              {((i.savings * i.qty) + i.dealSavings) > 0 && (
                <p className="text-[9px] font-bold text-[var(--user-success)] mt-0.5">
                  Save Rs. {((i.savings * i.qty) + i.dealSavings).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-3 border-t border-[var(--user-border)] text-sm">
        <div className="flex justify-between text-[var(--user-text-muted)] text-xs sm:text-sm">
          <span>Subtotal</span>
          <span className="text-[var(--user-text)] font-semibold">Rs. {subtotal.toLocaleString()}</span>
        </div>
        {totalSavings > 0 && (
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-[var(--user-success)] flex items-center gap-1">
              <Tag size={12} /> Total Savings
            </span>
            <span className="text-[var(--user-success)] font-semibold">-Rs. {totalSavings.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between text-[var(--user-text-muted)] text-xs sm:text-sm">
          <span className="flex items-center gap-1">
            Shipping
            {shipping === 0 && <span className="text-[9px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/30 px-1.5 py-0.5 rounded">FREE</span>}
          </span>
          <span className="text-[var(--user-text)] font-semibold">{shipping === 0 ? "Rs. 0" : `Rs. ${shipping}`}</span>
        </div>
        {tax > 0 && <div className="flex justify-between text-[var(--user-text-muted)] text-xs sm:text-sm"><span>Tax</span><span className="text-[var(--user-text)] font-semibold">Rs. {tax.toLocaleString()}</span></div>}
        <div className="flex justify-between pt-2 border-t border-[var(--user-border)]">
          <span className="font-bold text-[var(--user-text)] text-xs sm:text-sm">Total</span>
          <span className="text-base sm:text-lg font-black text-[var(--user-accent)]">Rs. {grandTotal.toLocaleString()}</span>
        </div>
      </div>
      <div className="mt-4">{footer}</div>
    </div>
  );

  // ✅ CHANGE 3: Dynamic shipping methods from config
  const shippingMethods = [
    {
      id: "standard",
      title: "Standard Delivery",
      time: `${cfg.standard.min_days}–${cfg.standard.max_days} working days`,
      icon: Truck,
    },
    {
      id: "express",
      title: "Express Delivery",
      time: `${cfg.express.min_days}–${cfg.express.max_days} working days`,
      icon: Zap,
    },
  ];

  return (
    <main className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-10 pb-20 sm:pb-24 md:pb-10">
      <style>{`@keyframes modalUp { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>

      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <button onClick={() => router.push("/")} className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition">
          <ArrowLeft size={14} /> <span className="hidden sm:inline">Continue Shopping</span><span className="sm:hidden">Back</span>
        </button>
        <h1 className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base lg:text-lg font-bold text-[var(--user-text)]">
          <Lock size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Secure Checkout</span><span className="sm:hidden">Checkout</span>
        </h1>
      </div>

      {needsPhone ? (
        <div className="max-w-[480px] mx-auto mt-6 sm:mt-10">
          <div className={`${cardCls} p-5 sm:p-6`}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--user-accent)]/10 flex items-center justify-center mb-3 sm:mb-4">
              <Phone size={18} className="text-[var(--user-accent)] sm:w-5 sm:h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[var(--user-text)] mb-1">Phone Number Required</h2>
            <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)] mb-4 sm:mb-5">Your phone number is required for delivery.</p>
            <label className={labelCls}>Phone Number *</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" className={inputCls} />
            <button onClick={savePhone} disabled={savingPhone} className="mt-4 w-full h-11 sm:h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50">
              {savingPhone ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Save & Continue
            </button>
          </div>
        </div>
      ) : (
        <>
          <StepIndicator />

          {step === 1 && (
            <div className="grid lg:grid-cols-[2fr_3fr] gap-3 sm:gap-4 lg:gap-6 items-start">
              <div className={`${cardCls} lg:sticky lg:top-24 flex flex-col`}>
                <div className="flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 border-b border-[var(--user-border)] shrink-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <ShoppingBag size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" />
                    <h2 className="text-[10px] sm:text-xs font-bold text-[var(--user-text)] uppercase tracking-wider">All Cart Products</h2>
                    <span className="text-[9px] sm:text-[10px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded-full">{cart.length}</span>
                  </div>
                  <label className="flex items-center gap-1 sm:gap-1.5 cursor-pointer text-[9px] sm:text-[10px] font-bold text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded" style={{ accentColor: "var(--user-accent)" }} />
                    <span className="hidden sm:inline">Select All</span><span className="sm:hidden">All</span>
                  </label>
                </div>

                <div className="p-2 sm:p-3 space-y-1.5 sm:space-y-2 overflow-y-auto max-h-[320px] sm:max-h-[380px] lg:max-h-[calc(100vh-240px)]">
                  {itemsWithDiscounts.map((item) => {
                    const checked = (selectedKeys || []).includes(item.key);
                    return (
                      <label key={item.key} className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg sm:rounded-xl border cursor-pointer transition ${
                        checked ? "border-[var(--user-accent)]/60 bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/30 opacity-70 hover:opacity-100"
                      }`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleKey(item.key)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded shrink-0" style={{ accentColor: "var(--user-accent)" }} />
                        <ItemThumb item={item} size="w-10 h-10 sm:w-11 sm:h-11" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] sm:text-xs font-semibold text-[var(--user-text)] truncate">{item.name}</p>
                          {item.variantTitle && <p className="text-[9px] sm:text-[10px] text-[var(--user-text-muted)] truncate">{item.variantTitle}</p>}
                          
                          {item.dealId && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                <Tag size={9} /> 
                                {item.dealType === 'buy_x_get_y' 
                                  ? `Buy ${item.dealBuyQuantity || 2} Get ${item.dealGetQuantity || 1} Free` 
                                  : (item.dealName || 'Active Deal')}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-[9px] sm:text-[10px] font-bold text-[var(--user-text)]">Rs. {item.displayPrice.toLocaleString()}</p>
                            {item.hasDiscount && item.originalPrice > item.displayPrice && (
                              <p className="text-[9px] text-[var(--user-text-subtle)] line-through">Rs. {item.originalPrice.toLocaleString()}</p>
                            )}
                          </div>
                          {((item.savings * item.qty) + item.dealSavings) > 0 && (
                            <p className="text-[9px] font-bold text-[var(--user-success)] flex items-center gap-0.5 mt-0.5">
                              <Tag size={8} /> Save Rs. {((item.savings * item.qty) + item.dealSavings).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <div className="flex items-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]">
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (item.qty > 1) updateQty(item.key, item.qty - 1); }} className="p-1 sm:p-1.5 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition">
                              <Minus size={11} className="sm:w-3 sm:h-3" />
                            </button>
                            <span className="text-[9px] sm:text-[10px] font-black text-[var(--user-text)] w-5 sm:w-6 text-center">{item.qty}</span>
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQty(item.key, item.qty + 1); }} className="p-1 sm:p-1.5 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition">
  <Plus size={11} className="sm:w-3 sm:h-3" />
</button>
                          </div>
                          <p className="text-[9px] sm:text-[10px] font-bold text-[var(--user-accent)]">Rs. {item.lineTotal.toLocaleString()}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className={`${cardCls} lg:sticky lg:top-24 flex flex-col`}>
                <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--user-border)] shrink-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <PackageCheck size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" />
                    <h2 className="text-[10px] sm:text-xs font-bold text-[var(--user-text)] uppercase tracking-wider">Selected Only</h2>
                    <span className="text-[9px] sm:text-[10px] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1.5 py-0.5 rounded-full">{selectedCartItems.length}</span>
                  </div>
                </div>
                <div className="p-3 sm:p-5 overflow-y-auto max-h-[280px] sm:max-h-[340px] lg:max-h-[calc(100vh-340px)]">
                  {selectedCartItems.length === 0 ? (
                    <div className="py-10 sm:py-14 text-center">
                      <Package size={26} className="mx-auto mb-2 sm:mb-3 text-[var(--user-text-subtle)] sm:w-8 sm:h-8" />
                      <p className="text-xs sm:text-sm font-semibold text-[var(--user-text)] mb-1">No items selected</p>
                      <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)]">Select items from the list on the left.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--user-border)]">
                      {itemsWithDiscounts.filter((i) => (selectedKeys || []).includes(i.key)).map((item) => (
                        <div key={item.key} className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3 first:pt-0 last:pb-0">
                          <ItemThumb item={item} size="w-12 h-12 sm:w-14 sm:h-14" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-[var(--user-text)] truncate">{item.name}</p>
                            {item.variantTitle && <p className="text-[10px] sm:text-[11px] text-[var(--user-text-muted)] truncate">{item.variantTitle}</p>}
                            
                            {item.dealId && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                  <Tag size={9} /> 
                                  {item.dealType === 'buy_x_get_y' 
                                    ? `Buy ${item.dealBuyQuantity || 2} Get ${item.dealGetQuantity || 1} Free` 
                                    : (item.dealName || 'Active Deal')}
                                </span>
                              </div>
                            )}
                            
                            <p className="text-[10px] sm:text-[11px] text-[var(--user-text-subtle)] mt-1">
                              Qty: {item.qty} {item.freeItems > 0 && `(${item.payableItems} paid + ${item.freeItems} FREE)`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs sm:text-sm font-black text-[var(--user-accent)]">Rs. {item.lineTotal.toLocaleString()}</p>
                            <button onClick={() => toggleKey(item.key)} className="mt-1 inline-flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-bold text-[var(--user-text-subtle)] hover:text-[var(--user-danger)] transition">
                              <X size={9} className="sm:w-2.5 sm:h-2.5" /> Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="px-3 sm:px-5 py-3 sm:py-4 border-t border-[var(--user-border)] bg-[var(--user-bg-hover)]/40 rounded-b-xl sm:rounded-b-2xl shrink-0">
                  <div className="flex items-center justify-between mb-2 sm:mb-3">
                    <div>
                      <p className="text-[10px] sm:text-[11px] text-[var(--user-text-muted)]">Selected: <span className="font-bold text-[var(--user-text)]">{selectedCartItems.length}</span></p>
                      <p className="text-lg sm:text-xl font-black text-[var(--user-accent)]">Rs. {subtotal.toLocaleString()}</p>
                    </div>
                  </div>
                  <button onClick={proceedToStep2} disabled={!selectedCartItems.length} className="w-full h-11 sm:h-12 rounded-lg sm:rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed">
                    Next: Delivery & Payment <ArrowRight size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid lg:grid-cols-[1fr_380px] gap-3 sm:gap-4 lg:gap-6 items-start">
              <div className="space-y-3 sm:space-y-4">
                <div className={`${cardCls} p-4 sm:p-5 lg:p-6`}>
                  <h2 className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--user-text)] mb-3 sm:mb-4">
                    <MapPin size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" /> Delivery Address
                  </h2>
                  {addresses.length > 0 ? (
                    <div className="grid my-3 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
                      {addresses.map((a) => (
                        <div key={a._id} onClick={() => setSelectedAddressId(a._id)} className={`text-left rounded-lg sm:rounded-xl border p-3 sm:p-4 transition cursor-pointer ${selectedAddressId === a._id ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                          <div className="flex items-center justify-between mb-1 gap-1 sm:gap-2">
                            <p className="text-xs sm:text-sm font-bold text-[var(--user-text)] truncate">{a.full_name}</p>
                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                              {a.is_default && <span className="text-[8px] sm:text-[9px] font-bold text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/30 px-1 sm:px-1.5 py-0.5 rounded">DEFAULT</span>}
                              <button onClick={(e) => { e.stopPropagation(); openEditModal(a); }} className="p-1 sm:p-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition" title="Edit">
                                <Pencil size={11} className="sm:w-3 sm:h-3" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); deleteAddress(a._id); }} className="p-1 sm:p-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition" title="Delete">
                                <Trash2 size={11} className="sm:w-3 sm:h-3" />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)] leading-relaxed line-clamp-2">{a.street_address1}{a.street_address2 ? `, ${a.street_address2}` : ""}, {a.city}, {a.state}</p>
                          <p className="text-[10px] sm:text-xs text-[var(--user-text-secondary)] mt-1">📞 {a.phone}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)] mb-3 sm:mb-4">No saved addresses yet — add a new address using the button below.</p>
                  )}
                  <button onClick={openAddressModal} className="w-full h-10 sm:h-11 rounded-lg sm:rounded-xl border-2 border-dashed border-[var(--user-border)] text-[10px] sm:text-xs font-bold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/60 transition flex items-center justify-center gap-1.5 sm:gap-2">
                    <Plus size={13} className="sm:w-3.5 sm:h-3.5" /> Add an address
                  </button>
                </div>

                <div className={`${cardCls} p-4 sm:p-5 lg:p-6`}>
                  <h2 className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--user-text)] mb-3 sm:mb-4">
                    <Truck size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" /> Shipping Method
                  </h2>
                  {cfg.free_shipping_over > 0 && (
                    <p className="text-[10px] sm:text-[11px] text-[var(--user-success)] font-semibold mb-2 flex items-center gap-1">
                      <Tag size={10} /> Free shipping on orders over Rs. {cfg.free_shipping_over.toLocaleString()}
                    </p>
                  )}
                  {/* ✅ CHANGE 2: Dynamic shipping methods from admin config */}
                  <div className="grid my-3 sm:grid-cols-2 gap-2 sm:gap-3">
                    {shippingMethods.map((m) => {
                      const active = shippingMethod === m.id;
                      const IconComp = m.icon;
                      const baseFee = m.id === "express" ? cfg.express.fee : cfg.standard.fee;
                      const displayFee = active ? shipping : baseFee;
                      const isFree = displayFee === 0;
                      return (
                        <button key={m.id} onClick={() => setShippingMethod(m.id)} className={`flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border p-3 sm:p-4 text-left transition ${active ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                          <IconComp size={16} className={`sm:w-5 sm:h-5 ${active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-[var(--user-text)]">{m.title}</p>
                            <p className="text-[10px] sm:text-[11px] text-[var(--user-text-muted)]">{m.time}</p>
                            {active && shippingReason && (
                              <p className="text-[9px] text-[var(--user-success)] mt-0.5 truncate">{shippingReason}</p>
                            )}
                          </div>
                          <span className={`text-[10px] sm:text-xs font-black ${isFree ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                            {isFree ? "FREE" : `Rs. ${displayFee.toLocaleString()}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${cardCls} p-4 sm:p-5 lg:p-6`}>
                  <h2 className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--user-text)] mb-3 sm:mb-4">
                    <CreditCard size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" /> Payment Method
                  </h2>
                  <div className="space-y-2 my-3 sm:space-y-3">
                    {[
                      { id: "cod", icon: Banknote, title: "Cash on Delivery", sub: "Pay in cash when your order arrives" },
                      { id: "bank", icon: Landmark, title: "Bank Transfer", sub: "Transfer directly to our bank account" },
                      { id: "card", icon: CreditCard, title: "Debit / Credit Card", sub: "Visa, Mastercard" },
                    ].map((m) => (
                      <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`w-full flex items-center gap-2 sm:gap-3 rounded-lg sm:rounded-xl border p-3 sm:p-4 text-left transition ${paymentMethod === m.id ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/40"}`}>
                        <m.icon size={16} className={`sm:w-5 sm:h-5 ${paymentMethod === m.id ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[var(--user-text)]">{m.title}</p>
                          <p className="text-[10px] sm:text-[11px] text-[var(--user-text-muted)] truncate">{m.sub}</p>
                        </div>
                        <span className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 transition ${paymentMethod === m.id ? "border-[var(--user-accent)] bg-[var(--user-accent)]" : "border-[var(--user-border)]"}`} />
                      </button>
                    ))}
                  </div>
                  {paymentMethod === "bank" && (
                    <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] p-3 sm:p-4">
                      <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)] leading-relaxed">
                        Account: <span className="font-semibold text-[var(--user-text)]">ClickMasters Store</span> · Bank: <span className="font-semibold text-[var(--user-text)]">Meezan Bank</span> · IBAN: <span className="font-mono font-semibold text-[var(--user-text)]">PK00 MEZN 0000 1234 5678 9012</span>
                      </p>
                    </div>
                  )}
                  {paymentMethod === "card" && (
                    <div className="mt-4 sm:mt-5">
                      <CardPreview number={cardForm.number} name={cardForm.name} expiry={cardForm.expiry} />
                      <div className="space-y-2 sm:space-y-3 rounded-lg sm:rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] p-3 sm:p-4">
                        <input value={cardForm.number} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 16); setCardForm({ ...cardForm, number: v.replace(/(\d{4})(?=\d)/g, "$1 ") }); }} placeholder="Card Number" className={inputCls} />
                        <input value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} placeholder="Card Holder Name" className={inputCls} />
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          <input value={cardForm.expiry} onChange={(e) => { let v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2); setCardForm({ ...cardForm, expiry: v }); }} placeholder="MM/YY" className={inputCls} />
                          <input type="password" value={cardForm.cvv} onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="CVV" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <SummaryPanel footer={
                <div className="space-y-2">
                  <button onClick={() => selectedAddressId ? goToStep(3) : toast.error("Please select or add a delivery address first")} className="w-full h-11 sm:h-12 rounded-lg sm:rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition">
                    Review Order <ArrowRight size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <button onClick={backToStep1} className="w-full h-9 sm:h-10 rounded-lg sm:rounded-xl border border-[var(--user-border)] text-[10px] sm:text-xs font-semibold text-[var(--user-text-secondary)] hover:text-[var(--user-text)] transition flex items-center justify-center gap-2">
                    <ArrowLeft size={12} className="sm:w-3 sm:h-3" /> Back to Items
                  </button>
                </div>
              } />
            </div>
          )}

          {step === 3 && (
            <div className="grid lg:grid-cols-[1fr_380px] gap-3 sm:gap-4 lg:gap-6 items-start">
              <div className="space-y-3 sm:space-y-4">
                <div className={`${cardCls} p-4 sm:p-5 lg:p-6`}>
                  <h2 className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[var(--user-text)] mb-3 sm:mb-4">
                    <ShieldCheck size={14} className="text-[var(--user-accent)] sm:w-4 sm:h-4" /> Review (Read-Only)
                  </h2>
                  <div className="grid sm:grid-cols-2 my-3 gap-3 sm:gap-4">
                    <div className="rounded-lg sm:rounded-xl border border-[var(--user-border)] p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] sm:text-xs font-bold text-[var(--user-text)] uppercase tracking-wider">Deliver To</p>
                        <button onClick={() => goToStep(2)} className="text-[10px] sm:text-[11px] font-bold text-[var(--user-accent)] hover:opacity-80">Change</button>
                      </div>
                      {selectedAddress && (
                        <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)] leading-relaxed">
                          <span className="font-semibold text-[var(--user-text)]">{selectedAddress.full_name}</span> · {selectedAddress.phone}<br />
                          {selectedAddress.street_address1}{selectedAddress.street_address2 ? `, ${selectedAddress.street_address2}` : ""}, {selectedAddress.city}, {selectedAddress.state}, {selectedAddress.country}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg sm:rounded-xl border border-[var(--user-border)] p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] sm:text-xs font-bold text-[var(--user-text)] uppercase tracking-wider">Shipping + Payment</p>
                        <button onClick={() => goToStep(2)} className="text-[10px] sm:text-[11px] font-bold text-[var(--user-accent)] hover:opacity-80">Change</button>
                      </div>
                      <p className="text-[10px] sm:text-xs text-[var(--user-text-muted)] leading-relaxed">
                        🚚 {shippingMethods.find((m) => m.id === shippingMethod)?.title} · {shippingMethods.find((m) => m.id === shippingMethod)?.time}<br />
                        {shippingReason && <span className="text-[var(--user-success)]">{shippingReason}<br /></span>}
                        {paymentMethod === "cod" ? "💵 Cash on Delivery" : paymentMethod === "bank" ? "🏦 Bank Transfer" : "💳 Debit / Credit Card"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-xl border border-[var(--user-border)] p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <p className="text-[10px] sm:text-xs font-bold text-[var(--user-text)] uppercase tracking-wider">Items ({itemsWithDiscounts.length})</p>
                    <div className="divide-y my-2 divide-[var(--user-border)]">
                      {itemsWithDiscounts.map((i) => (
                        <div key={i.key} className="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 first:pt-0 last:pb-0">
                          <ItemThumb item={i} size="w-9 h-9 sm:w-10 sm:h-10" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] sm:text-xs font-semibold text-[var(--user-text)] truncate">{i.name}</p>
                            
                            {i.dealId && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                  <Tag size={9} /> 
                                  {i.dealType === 'buy_x_get_y' 
                                    ? `Buy ${i.dealBuyQuantity || 2} Get ${i.dealGetQuantity || 1} Free` 
                                    : (i.dealName || 'Active Deal')}
                                </span>
                              </div>
                            )}
                            
                            <p className="text-[9px] sm:text-[10px] text-[var(--user-text-muted)] mt-1">
                           Qty: {i.qty} {i.freeItems > 0 && `(${i.payableItems} paid + ${i.freeItems} FREE = ${i.payableItems + i.freeItems} items)`}
                            </p>
                          </div>
                          <p className="text-[11px] sm:text-xs font-bold text-[var(--user-text)]">
                            Rs. {Number(i.lineTotal || 0).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <SummaryPanel footer={
                <div className="space-y-2">
                  <button onClick={placeOrder} disabled={placing} className="w-full h-11 sm:h-12 rounded-lg sm:rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs sm:text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60">
                    {placing ? <Loader2 size={14} className="animate-spin sm:w-4 sm:h-4" /> : <Lock size={13} className="sm:w-4 sm:h-4" />}
                    {placing ? "Placing Order..." : "Continue"}
                  </button>
                  <button onClick={() => goToStep(2)} className="w-full h-9 sm:h-10 rounded-lg sm:rounded-xl border border-[var(--user-border)] text-[10px] sm:text-xs font-semibold text-[var(--user-text-secondary)] hover:text-[var(--user-text)] transition flex items-center justify-center gap-2">
                    <ArrowLeft size={12} className="sm:w-3 sm:h-3" /> Back
                  </button>
                </div>
              } />
            </div>
          )}
        </>
      )}

      {showAddressModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowAddressModal(false)}>
          <div className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[var(--user-bg-elevated)] border-t sm:border border-[var(--user-border)] shadow-2xl" style={{ animation: "modalUp .25s ease-out" }} onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)]">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--user-text)]">{editingAddressId ? "Edit address" : "Add an address"}</h3>
              <button onClick={() => { setShowAddressModal(false); setEditingAddressId(null); }} className="p-1.5 sm:p-2 rounded-lg border border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">
                <X size={14} className="sm:w-4 sm:h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <h4 className="text-base sm:text-lg font-black text-[var(--user-text)]">{editingAddressId ? "Edit your shipping address" : "Enter a new shipping address"}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full name *</label>
                  <input value={addressForm.full_name} onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })} placeholder="Ahsan Khan" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone number *</label>
                  <input type="tel" value={addressForm.phone} maxLength={14} onChange={(e) => { const val = e.target.value.replace(/\D/g, "").slice(0, 14); setAddressForm({ ...addressForm, phone: val }); }} placeholder="03001234567" className={inputCls} />
                </div>
              </div>
              <p className="text-[9px] sm:text-[10px] text-[var(--user-text-subtle)] -mt-2">May be used to assist delivery</p>
              <div>
                <label className={labelCls}>Country / Region *</label>
                <div className="relative">
                  <select value={addressForm.country} onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })} className={inputCls + " appearance-none pr-9 cursor-pointer"}>
                    <option value="">Select country</option>
                    {allCountries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>State *</label>
                  <div className="relative">
                    <select value={addressForm.state} onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })} disabled={!addressForm.country} className={inputCls + " appearance-none pr-9 cursor-pointer disabled:opacity-50"}>
                      <option value="">Select</option>
                      {allStates.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>City *</label>
                  <div className="relative">
                    <select value={addressForm.city} onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })} disabled={!addressForm.state} className={inputCls + " appearance-none pr-9 cursor-pointer disabled:opacity-50"}>
                      <option value="">Select</option>
                      {allCities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>ZIP Code</label>
                  <input value={addressForm.zip_code} onChange={(e) => setAddressForm({ ...addressForm, zip_code: e.target.value })} placeholder="54000" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Street address *</label>
                <textarea value={addressForm.street_address1} onChange={(e) => setAddressForm({ ...addressForm, street_address1: e.target.value })} rows="2" placeholder="Street address or P.O. Box" className={textareaCls} />
              </div>
              <div>
                <label className={labelCls}>Delivery Instructions (Optional)</label>
                <textarea value={addressForm.delivery_instructions} onChange={(e) => setAddressForm({ ...addressForm, delivery_instructions: e.target.value })} rows="2" placeholder="Add preferences, notes, access codes and more" className={textareaCls} />
              </div>
              <label className="flex items-center gap-2 text-[11px] sm:text-xs text-[var(--user-text-secondary)] cursor-pointer">
                <input type="checkbox" checked={addressForm.is_default} onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded" style={{ accentColor: "var(--user-accent)" }} />
                Make this my default address
              </label>
              <div className="pt-2 flex items-center justify-between gap-2 sm:gap-3">
                <button onClick={() => { setShowAddressModal(false); setEditingAddressId(null); }} className="h-10 sm:h-11 px-4 sm:px-6 rounded-full border border-[var(--user-border)] text-xs sm:text-sm font-bold text-[var(--user-text-secondary)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition">Cancel</button>
                <button onClick={saveAddress} disabled={savingAddress} className="h-10 sm:h-11 px-5 sm:px-7 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs sm:text-sm font-black flex items-center gap-2 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50">
                  {savingAddress ? <Loader2 size={13} className="animate-spin sm:w-4 sm:h-4" /> : <Check size={13} className="sm:w-4 sm:h-4" />}
                  {editingAddressId ? "Save changes" : "Use this address"}
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
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-[var(--user-accent)]" size={28} /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}