"use client";

import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "./CartContext";

export default function CartDrawer() {
  const { cart, isCartOpen, setIsCartOpen, updateQty, removeFromCart, total, count } = useCart();

  return (
    <>
      {/* OVERLAY */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-black/70 z-50" onClick={() => setIsCartOpen(false)} />
      )}

      {/* DRAWER */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[400px] bg-[#04120c] z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-white font-bold flex items-center gap-2">
            <ShoppingBag size={20} className="text-[#d4af37]" />
            My Cart ({count})
          </h2>
          <button onClick={() => setIsCartOpen(false)}>
            <X size={22} className="text-[#d4af37]" />
          </button>
        </div>

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag size={48} className="mx-auto text-[#d4af37] mb-4" />
              <p className="text-white font-semibold mb-1">Cart is empty</p>
              <p className="text-gray-400 text-sm">Add some products to get started!</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="flex gap-3 bg-[#071b12] border border-white/10 rounded-xl p-3">
                {/* Image/Emoji */}
                <div className="w-16 h-16 rounded-lg bg-[#10251a] flex items-center justify-center text-3xl shrink-0">
                  {item.emoji}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{item.name}</p>
                  {item.variantTitle && (
                    <p className="text-gray-400 text-xs mt-0.5">{item.variantTitle}</p>
                  )}
                  <p className="text-[#d4af37] text-sm font-bold mt-1">
                    Rs. {item.price.toLocaleString()}
                  </p>

                  {/* Qty Controls */}
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => updateQty(item.key, item.qty - 1)}
                      className="p-1 rounded bg-[#10251a] text-gray-300 hover:text-[#d4af37]"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-white text-sm font-bold w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.key, item.qty + 1)}
                      className="p-1 rounded bg-[#10251a] text-gray-300 hover:text-[#d4af37]"
                    >
                      <Plus size={14} />
                    </button>

                    <button
                      onClick={() => removeFromCart(item.key)}
                      className="ml-auto p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">Total</span>
              <span className="text-white text-xl font-black">Rs. {total.toLocaleString()}</span>
            </div>
            <button className="w-full bg-[#d4af37] text-black py-3 rounded-xl font-bold hover:bg-yellow-300 transition">
              Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}