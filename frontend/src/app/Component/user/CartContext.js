"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/apis/axiosInstance";

const CartContext = createContext(null);

// Server + current cart merge (same item ki qty add hoti hai)
const mergeCarts = (server, current) => {
  const map = new Map();
  [...server, ...current].forEach((item) => {
    const existing = map.get(item.key);
    if (existing) existing.qty += item.qty;
    else map.set(item.key, { ...item });
  });
  return [...map.values()];
};

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const cartRef = useRef([]);
  const syncedRef = useRef(false);

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

  // ✅ Login hote hi: server cart lao + session cart merge karo
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
        await axiosInstance.put("/cart", { items: merged });
      } catch {
        // server fail ho to session cart hi rehne do
      }
    })();
  }, [loggedIn]);

  // ✅ Logout par fresh start (Header full reload karta hai)
  useEffect(() => {
    if (!loggedIn) {
      cartRef.current = [];
      setCart([]);
      syncedRef.current = false;
    }
  }, [loggedIn]);

  // ✅ Save — sirf server (logged in) ya sirf memory (guest)
  const save = (next) => {
    cartRef.current = next;
    setCart(next);
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