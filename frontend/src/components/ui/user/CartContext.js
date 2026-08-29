"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cartApi } from "@/apis/user/cartApi";
import axiosInstance from "@/apis/axiosInstance";

const CartContext = createContext(null);

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
  const prevLoggedIn = useRef(null);
  const queryClient = useQueryClient();

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

  const { data: serverCart = [], isFetched: serverCartFetched } = useQuery({
    queryKey: ["cart"],
    queryFn: cartApi.get,
    enabled: loggedIn,
    retry: false,
  });

  const persistServerMutation = useMutation({
    mutationFn: (items) => cartApi.set(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    if (!loggedIn || syncedRef.current) return;
    if (!serverCartFetched) return;
    syncedRef.current = true;

    const merged = mergeCarts(serverCart, cartRef.current);
    cartRef.current = merged;
    setCart(merged);
    if (merged.length) {
      persistServerMutation.mutate(merged);
    }
    // persistServerMutation is intentionally omitted:
    // useMutation returns a stable reference, and we don't want
    // the sync effect to re-run when its identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, serverCartFetched, serverCart]);

  useEffect(() => {
    if (prevLoggedIn.current === true && !loggedIn) {
      cartRef.current = [];
      setCart([]);
      syncedRef.current = false;
      queryClient.removeQueries({ queryKey: ["cart"] });
    }
    prevLoggedIn.current = loggedIn;
  }, [loggedIn, queryClient]);

  const save = (next) => {
    cartRef.current = next;
    setCart(next);
    if (loggedIn) {
      persistServerMutation.mutate(next);
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
