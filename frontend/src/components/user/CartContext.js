"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, maxPayableQty } from "@/utils/dealCalculator";
const CartContext = createContext(null);

const CART_KEY = "cm_cart";

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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef([]);
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
  }, []);

  useEffect(() => {
    const prev = prevUserIdRef.current;
    if (prev === userId) return;
    prevUserIdRef.current = userId;

    if (!userId) {
      cartRef.current = [];
      setCart([]);
      writeLocalCart([]);
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
      } catch {}
    })();
  }, [userId]);

  const save = (next) => {
    cartRef.current = next;
    setCart(next);
    if (userId) {
      axiosInstance.put("/cart", { items: next }).catch(() => {});
    } else {
      writeLocalCart(next);
    }
  };

  // ✅ ADD TO CART — with STOCK CHECK
  const addToCart = (product, variant = null, qty = 1, dealInfo = null) => {
    const id = product._id || product.id;
    const key = `${id}__${variant?._id || variant?.title || "default"}`;
    const price = Number(variant?.selling_price || product.price || 0);
    const stock = getStock(product, variant);

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
          price,
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

  const count = cart.reduce((s, i) => s + i.qty, 0);

  const total = cart.reduce((s, i) => {
    if (i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity) {
      const payableQty = calculatePayableItems(i.qty, i.dealBuyQuantity, i.dealGetQuantity);
      return s + (payableQty * i.price);
    }
    return s + (i.qty * i.price);
  }, 0);

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
        removeItems,
        restoreItems,
        clearCart,
        count,
        total,
        isCartOpen,
        setIsCartOpen,
        getDealInfoForItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
