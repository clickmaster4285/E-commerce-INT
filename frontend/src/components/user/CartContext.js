"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, maxPayableQty } from "@/utils/dealCalculator";
const CartContext = createContext(null);

const CART_KEY = "cm_cart";
const SELECTED_KEY = "cart_selected_keys";

const readLocalCart = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalCart = (items) => {
  try {
    if (items.length) localStorage.setItem(CART_KEY, JSON.stringify(items));
    else localStorage.removeItem(CART_KEY);
  } catch {}
};

const readLocalSelection = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
};

const writeLocalSelection = (keys) => {
  try {
    if (keys.length) localStorage.setItem(SELECTED_KEY, JSON.stringify(keys));
    else localStorage.removeItem(SELECTED_KEY);
  } catch {}
};

const mergeCarts = (server, guest) => {
  const map = new Map();
  (server || []).forEach((i) => map.set(i.key, { ...i }));
  (guest || []).forEach((i) => {
    const ex = map.get(i.key);
    if (ex) {
      map.set(i.key, {
        ...ex,
        ...i,
        qty: (Number(ex.qty) || 0) + (Number(i.qty) || 0),
        id: ex.id || i.id,
        productId: ex.productId || i.productId,
      });
    } else {
      map.set(i.key, { ...i });
    }
  });
  return [...map.values()];
};

// ✅ Stock nikalo variant/product se (null = unknown/unlimited)
const getStock = (product, variant) => {
  const raw = variant?.quantity ?? variant?.stock ?? product?.quantity ?? product?.stock;
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== null ? n : null;
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef([]);
  const selectedRef = useRef([]);
  const prevUserIdRef = useRef(null);

  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const userId = user?._id || user?.id || null;

  useEffect(() => {
    const stored = readLocalCart();
    cartRef.current = stored;
    setCart(stored);
    const storedSel = readLocalSelection();
    selectedRef.current = storedSel;
    setSelectedKeys(storedSel);
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    if (prev === userId) return;
    prevUserIdRef.current = userId;

    if (!userId) {
      cartRef.current = [];
      setCart([]);
      writeLocalCart([]);
      // Clear selection when logged out
      selectedRef.current = [];
      setSelectedKeys([]);
      writeLocalSelection([]);
      return;
    }

    (async () => {
      try {
        const res = await axiosInstance.get("/cart");
        let items = res.data?.data || [];
        const guest = readLocalCart();
        if (guest.length) {
          items = mergeCarts(items, guest);
          await axiosInstance.put("/cart", { items }).catch(() => {});
          writeLocalCart([]);
        }
        cartRef.current = items;
        setCart(items);
        // After server merge, prune selection to existing keys; auto-select any new merged keys
        const validKeys = new Set(items.map((i) => i.key));
        const persistedSel = readLocalSelection();
        const persistedSet = new Set(persistedSel.filter((k) => validKeys.has(k)));
        for (const k of validKeys) persistedSet.add(k);
        const nextSel = [...persistedSet];
        selectedRef.current = nextSel;
        setSelectedKeys(nextSel);
        writeLocalSelection(nextSel);
      } catch {}
    })();
  }, [userId]);

  const save = (next) => {
    cartRef.current = next;
    setCart(next);
    // Prune selection to existing keys, auto-select any new keys
    const validKeys = new Set(next.map((i) => i.key));
    const selSet = new Set(selectedRef.current.filter((k) => validKeys.has(k)));
    for (const k of validKeys) selSet.add(k);
    const nextSel = [...selSet];
    if (nextSel.length !== selectedRef.current.length || nextSel.some((k, i) => k !== selectedRef.current[i])) {
      selectedRef.current = nextSel;
      setSelectedKeys(nextSel);
      writeLocalSelection(nextSel);
    }
    if (userId) {
      axiosInstance.put("/cart", { items: next }).catch(() => {});
    } else {
      writeLocalCart(next);
    }
  };

  // ✅ ADD TO CART — with STOCK CHECK
  const addToCart = (product, variant = null, qty = 1, dealInfo = null) => {
    const id = product._id || product.id;
    const variantKey = variant?._id
      ? `id:${variant._id}`
      : variant?.title
        ? `title:${variant.title}`
        : "no-variant";
    const dealKeyPart = dealInfo?.dealId ? `__deal_${dealInfo.dealId}` : "";
    const key = `${id}__${variantKey}${dealKeyPart}`;
    const regularPrice = Number(variant?.selling_price || product.price || 0);
    const stock = getStock(product, variant);

    // ✅ For percentage/fixed_amount deals, store the discounted price on the cart line
    // so the CartContext `total` reflects the deal consistently across drawer/cart/checkout.
    // For buy_x_get_y the price stays the regular unit price; free items are handled by qty math.
    let linePrice = regularPrice;
    if (dealInfo?.dealType === "percentage" && Number(dealInfo.dealDiscountValue) > 0) {
      linePrice = Math.round(regularPrice * (1 - Number(dealInfo.dealDiscountValue) / 100));
    } else if (dealInfo?.dealType === "fixed_amount" && Number(dealInfo.dealDiscountValue) > 0) {
      linePrice = Math.max(0, regularPrice - Number(dealInfo.dealDiscountValue));
    }

    const existing = cartRef.current.find((i) => i.key === key);
    const currentQty = existing?.qty || 0;

    // ✅ STOCK ENFORCEMENT (Buy X Get Y: paid + free dono stock se kat-te hain)
    const bxgBuy = existing?.dealBuyQuantity || dealInfo?.buyQuantity || 0;
    const bxgGet = existing?.dealGetQuantity || dealInfo?.getQuantity || 0;
    const isBxG = (existing?.dealType || dealInfo?.dealType) === "buy_x_get_y" && bxgBuy > 0 && bxgGet > 0;
    const limit = stock !== null
      ? (isBxG ? maxPayableQty(stock, bxgBuy, bxgGet) : stock)
      : null;

    if (limit !== null) {
      if (limit <= 0) {
        toast.error(`"${product.name}" is out of stock`);
        return;
      }
      if (currentQty >= limit) {
        toast.error(`Only ${limit} available in stock for "${product.name}"`);
        return;
      }
    }

    const addQty = limit !== null ? Math.min(qty, limit - currentQty) : qty;
    if (addQty < qty) {
      toast.info(`Only ${stock} available in stock — adding ${addQty}`);
    }

    if (existing) {
      save(
        cartRef.current.map((i) =>
          i.key === key ? { ...i, qty: i.qty + addQty, stock: stock ?? i.stock } : i
        )
      );
    } else {
      const dealData = dealInfo
        ? {
            dealId: dealInfo.dealId || null,
            dealType: dealInfo.dealType || null,
            dealName: dealInfo.dealName || null,
            dealBadge: dealInfo.dealBadge || null,
            dealSavings: Number(dealInfo.savings) || 0,
            dealOriginalPrice: Number(dealInfo.originalPrice) || 0,
            dealDiscountValue: Number(dealInfo.dealDiscountValue) || 0,
            dealRegularPrice: regularPrice,
            ...(dealInfo.dealType === "buy_x_get_y"
              ? {
                  dealBuyQuantity: dealInfo.buyQuantity || 0,
                  dealGetQuantity: dealInfo.getQuantity || 0,
                }
              : {}),
          }
        : {};

      save([
        ...cartRef.current,
        {
          key,
          id,
          variant_id: variant?._id || null,
          name: product.name,
          brand: product.brand_id?.name || product.brand || "",
          price: linePrice,
          regularPrice,
          image: variant?.images?.[0]?.img_url || "",
          variantTitle: variant?.title || "",
          qty: addQty,
          stock: stock, // ✅ Stock saved for UI limits
          tax: Number(product.tax || 0),
          productId: String(id),
          categoryId: String(product.category_id?._id || product.category_id || ""),
          brandId: String(product.brand_id?._id || product.brand_id || ""),
          productDiscountPct: Number(product.discount || 0),
          ...dealData,
        },
      ]);
    }
  };

  // ✅ UPDATE QTY — with STOCK CHECK
    const updateQty = (key, qty) => {
    if (qty <= 0) return save(cartRef.current.filter((i) => i.key !== key));

    const item = cartRef.current.find((i) => i.key === key);
    let max = item?.stock != null ? Number(item.stock) : null;
    if (max !== null && item?.dealType === "buy_x_get_y" && item.dealBuyQuantity && item.dealGetQuantity) {
      max = maxPayableQty(max, item.dealBuyQuantity, item.dealGetQuantity);
    }

    if (max !== null && qty > max) {
      toast.error(`Only ${max} available in stock for "${item?.name || "this item"}"`);
      qty = max;
      if (qty <= 0) return;
    }

    save(cartRef.current.map((i) => (i.key === key ? { ...i, qty } : i)));
  };

  const removeFromCart = (key) => save(cartRef.current.filter((i) => i.key !== key));

  const removeItems = (keys) => save(cartRef.current.filter((i) => !keys.includes(i.key)));

  const restoreItems = (items) => {
    const map = new Map(cartRef.current.map((i) => [i.key, i]));
    items.forEach((it) => {
      const ex = map.get(it.key);
      if (ex) ex.qty += it.qty;
      else map.set(it.key, { ...it });
    });
    save([...map.values()]);
  };

  const clearCart = () => save([]);

  // ✅ SELECTION HELPERS
  const isLineSelected = useCallback(
    (key) => selectedRef.current.includes(key),
    []
  );

  const toggleLineSelected = useCallback((key) => {
    const cur = selectedRef.current;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    selectedRef.current = next;
    setSelectedKeys(next);
    writeLocalSelection(next);
  }, []);

  const setAllSelected = useCallback((flag) => {
    const next = flag ? cartRef.current.map((i) => i.key) : [];
    selectedRef.current = next;
    setSelectedKeys(next);
    writeLocalSelection(next);
  }, []);

  const setSelection = useCallback((keys) => {
    const validKeys = new Set(cartRef.current.map((i) => i.key));
    const next = [...new Set(keys.filter((k) => validKeys.has(k)))];
    selectedRef.current = next;
    setSelectedKeys(next);
    writeLocalSelection(next);
  }, []);

  const clearSelection = useCallback(() => {
    selectedRef.current = [];
    setSelectedKeys([]);
    writeLocalSelection([]);
  }, []);

  // ✅ Derived: only items whose keys are selected
  const selectedItems = useMemo(() => {
    const selSet = new Set(selectedKeys);
    return cart.filter((i) => selSet.has(i.key));
  }, [cart, selectedKeys]);

  const count = cart.reduce((s, i) => s + i.qty, 0);
  const selectedCount = selectedItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);

  const getDealInfoForItem = (item) => {
    if (!item.dealId || item.dealType !== "buy_x_get_y") return null;
    return {
      buyQty: item.dealBuyQuantity || 2,
      getQty: item.dealGetQuantity || 1,
      freeItems: calculateFreeItems(item.qty, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
      payableItems: calculatePayableItems(item.qty, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
      savings: calculateBuyXGetYSavings(item.qty, item.price, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
    };
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQty,
        removeFromCart,
        removeItems,
        restoreItems,
        clearCart,
        count,
        isCartOpen,
        setIsCartOpen,
        getDealInfoForItem,
        // Selection
        selectedKeys,
        selectedItems,
        selectedCount,
        isLineSelected,
        toggleLineSelected,
        setAllSelected,
        setSelection,
        clearSelection,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
