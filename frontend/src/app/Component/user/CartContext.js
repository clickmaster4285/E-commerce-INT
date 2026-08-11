"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cm_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);

  const save = (next) => {
    setCart(next);
    localStorage.setItem("cm_cart", JSON.stringify(next));
  };

  const addToCart = (product, variant = null, qty = 1) => {
    const id = product._id || product.id;
    const key = `${id}__${variant?._id || variant?.title || "default"}`;
    const price = Number(variant?.selling_price || product.price || 0);

    const existing = cart.find((i) => i.key === key);

    if (existing) {
      save(cart.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i)));
    } else {
      save([
        ...cart,
        {
          key,
          id,
          name: product.name,
          brand: product.brand_id?.name || product.brand || "",
          price,
          emoji: product.emoji || "📦",
          image: variant?.images?.[0]?.img_url || "",
          variantTitle: variant?.title || "",
          qty,
        },
      ]);
    }
  };

  const updateQty = (key, qty) => {
    if (qty <= 0) return save(cart.filter((i) => i.key !== key));
    save(cart.map((i) => (i.key === key ? { ...i, qty } : i)));
  };

  const removeFromCart = (key) => save(cart.filter((i) => i.key !== key));
  const clearCart = () => save([]);

  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, updateQty, removeFromCart, clearCart, count, total, isCartOpen, setIsCartOpen }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}