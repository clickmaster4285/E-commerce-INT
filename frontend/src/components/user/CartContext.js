"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/apis/axiosInstance";

const CartContext = createContext(null);

const CART_KEY = "cm_cart";

// ✅ localStorage se cart parho
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

const mergeCarts = (server, current) => {
  const map = new Map();
  [...server, ...current].forEach((item) => {
    const existing = map.get(item.key);
    if (existing) {
      // ✅ Fields preserve karo (id wali item jeete), qty sum karo
      const merged = {
        ...existing,
        ...item,
        qty: (Number(existing.qty) || 0) + (Number(item.qty) || 0),
      };
      if (!merged.id && existing.id) merged.id = existing.id;
      if (!merged.productId && existing.productId) merged.productId = existing.productId;
      map.set(item.key, merged);
    } else {
      map.set(item.key, { ...item });
    }
  });
  return [...map.values()];
};

export function CartProvider({ children }) {
  // ✅ Hydration-safe: pehla render hamesha EMPTY (server se match)
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef([]);
  const syncedRef = useRef(false);
  const prevLoggedIn = useRef(null);

  // ✅ Current user
  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const loggedIn = !!user;

  // ✅ MOUNT ke baad localStorage se load (hydration ke baad — koi error nahi)
  useEffect(() => {
    const stored = readLocalCart();
    if (stored.length) {
      cartRef.current = stored;
      setCart(stored);
    }
  }, []);

  // ✅ Login hote hi: server cart (account) + local cart merge
  useEffect(() => {
    if (!loggedIn || syncedRef.current) return;
    syncedRef.current = true;

    (async () => {
      try {
        const res = await axiosInstance.get("/cart");
        const serverItems = res.data?.data || [];
        const merged = mergeCarts(serverItems, cartRef.current);

        cartRef.current = merged;
        setCart(merged);
        writeLocalCart(merged);
        await axiosInstance.put("/cart", { items: merged });
      } catch {
        // server fail ho to local cart hi rehne do
      }
    })();
  }, [loggedIn]);

  // ✅ Sirf LOGOUT par clear (login→logout transition) — guest refresh par kabhi nahi
  useEffect(() => {
    if (prevLoggedIn.current === true && !loggedIn) {
      cartRef.current = [];
      setCart([]);
      syncedRef.current = false;
      writeLocalCart([]);
    }
    prevLoggedIn.current = loggedIn;
  }, [loggedIn]);

  // ✅ Save — localStorage (sab) + server (account wale)
  const save = (next) => {
    cartRef.current = next;
    setCart(next);
    writeLocalCart(next);
    if (loggedIn) {
      axiosInstance.put("/cart", { items: next }).catch(() => {});
    }
  };

  const addToCart = (product, variant = null, qty = 1) => {
    const id = product._id || product.id;
    const key = `${id}__${variant?._id || variant?.title || "default"}`;
    const price = Number(variant?.selling_price || product.price || 0);

    const existing = cartRef.current.find((i) => i.key === key);

    if (existing) {
      save(
        cartRef.current.map((i) =>
          i.key === key ? { ...i, qty: i.qty + qty } : i
        )
      );
    } else {


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
          qty,
          tax: Number(product.tax || 0),
          // ✅ Discount calculation ke liye IDs
          productId: String(id),
          categoryId: String(
            product.category_id?._id || product.category_id || "",
          ),
          brandId: String(product.brand_id?._id || product.brand_id || ""),
          productDiscountPct: Number(product.discount || 0),
        },
      ]);


    }
  };

  const updateQty = (key, qty) => {
    if (qty <= 0) return save(cartRef.current.filter((i) => i.key !== key));
    save(cartRef.current.map((i) => (i.key === key ? { ...i, qty } : i)));
  };

  const removeFromCart = (key) =>
    save(cartRef.current.filter((i) => i.key !== key));
  const removeItems = (keys) =>
    save(cartRef.current.filter((i) => !keys.includes(i.key)));
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
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

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
        total,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}