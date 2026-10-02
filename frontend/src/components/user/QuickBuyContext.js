"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const QuickBuyContext = createContext(null);

/* ============================================================
   QuickBuy — global "Choose Options" drawer state (CartDrawer jaisa:
   ek drawer layout me mounted, ProductCard sirf open karta hai).
   ============================================================ */
export function QuickBuyProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    product: null,
    dealInfo: null,
    seq: 0,
  });

  const openQuickBuy = useCallback((product, dealInfo = null) => {
    if (!product) return;
    setState((s) => ({ open: true, product, dealInfo, seq: s.seq + 1 }));
  }, []);

  const closeQuickBuy = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const value = useMemo(
    () => ({ ...state, openQuickBuy, closeQuickBuy }),
    [state, openQuickBuy, closeQuickBuy],
  );

  return (
    <QuickBuyContext.Provider value={value}>
      {children}
    </QuickBuyContext.Provider>
  );
}

export function useQuickBuy() {
  return useContext(QuickBuyContext);
}
