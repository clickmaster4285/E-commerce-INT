"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import axiosInstance from "@/apis/axiosInstance";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, maxPayableQty } from "@/utils/dealCalculator";
import {
  bundleOriginalTotal,
  round2,
  round6,
  normalizeBundleRule,
  bundleMultiplierFromLines,
  computeBundlePricing,
  repriceBundleGroup,
  bundleRuleLabel,
} from "@/utils/bundleCalculator";
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

/* ============================================================
   BUNDLE GROUP PRICING (offer condition + free gift)
   ============================================================
   Cart lines of a bundle each hold the regular price and the single offer
   rule. Pricing steps:
     1) count how many bundle items are in the cart
     2) check the condition (all products / limited quantity)
     3) condition met  → apply the reward, re-split the discounted total
        condition not met → lines keep their regular price (deal not applied)
     4) free-product rule → keep a price 0 gift line in sync
   ============================================================ */
const priceBundleGroup = (allLines, bundleId) => {
  const lines = Array.isArray(allLines) ? allLines : [];
  const id = String(bundleId || "");
  if (!id) return { lines, pricing: null };

  const group = lines.filter((i) => String(i.bundleId) === id && !i.isBundleGift);
  if (!group.length) {
    // Whole group removed → drop its gift line as well
    return { lines: lines.filter((i) => String(i.bundleId) !== id), pricing: null };
  }

  const others = lines.filter((i) => String(i.bundleId) !== id);
  const existingGift = lines.find((i) => String(i.bundleId) === id && i.isBundleGift) || null;

  const rule = normalizeBundleRule(group[0].bundleRule);
  const productCount = group.length;
  const groupUnits = group.reduce((s, l) => s + Math.max(0, Number(l.qty) || 0), 0);
  const groupSubtotal = round2(
    group.reduce(
      (s, l) => s + (Number(l.regularPrice) || 0) * Math.max(0, Number(l.qty) || 0),
      0
    )
  );

  const pricing = computeBundlePricing({
    rule,
    groupUnits,
    groupSubtotal,
    productCount,
    legacyBundlePrice: Number(group[0].bundlePrice) || 0,
    multiplier: bundleMultiplierFromLines(group),
  });

  // ---- Re-price the lines with the (possibly discounted) group total ----
  const repriced = new Map(
    repriceBundleGroup(group, pricing.effectiveTotal).map((p) => [p.key, p])
  );

  const appliedLabel = pricing.appliedLabel || "";

  const pricedGroup = group.map((line) => {
    const hit = repriced.get(line.key);
    const unit = hit ? Number(hit.price) : Number(line.price) || 0;
    const qty = Math.max(0, Number(line.qty) || 0);

    return {
      ...line,
      price: round6(unit),
      bundleRule: rule,
      bundleUnits: groupUnits,
      bundleProductCount: productCount,
      bundleAppliedRule: appliedLabel,
      bundleProgress: pricing.progress || "",
      bundleDiscount: pricing.discountAmount,
      bundleSavings: round2(((Number(line.regularPrice) || 0) - unit) * qty),
    };
  });

  // ---- Keep the free gift line in sync ----
  let gift = null;
  if (pricing.giftRule && pricing.giftQty > 0) {
    gift = {
      key: `gift_${pricing.giftRule.freeProductId}__bundle_${id}`,
      id: pricing.giftRule.freeProductId,
      productId: String(pricing.giftRule.freeProductId),
      variant_id: existingGift?.variant_id || pricing.giftRule.freeProductVariantId || null,
      name: pricing.giftRule.freeProductName || "Free Gift",
      brand: "FREE GIFT",
      price: 0,
      regularPrice: Number(pricing.giftRule.freeProductPrice) || 0,
      image: pricing.giftRule.freeProductImage || "",
      variantTitle: "",
      qty: pricing.giftQty,
      stock: existingGift?.stock ?? null,
      tax: 0,
      categoryId: existingGift?.categoryId || "",
      brandId: existingGift?.brandId || "",
      bundleId: id,
      bundleName: group[0].bundleName || "Bundle",
      bundleQuantity: pricing.giftQty,
      bundlePrice: 0,
      bundleSavings: round2((Number(pricing.giftRule.freeProductPrice) || 0) * pricing.giftQty),
      isBundleGift: true,
      bundleGiftFrom: bundleRuleLabel(pricing.giftRule, productCount),
    };
  }

  return { lines: [...others, ...pricedGroup, ...(gift ? [gift] : [])], pricing };
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
            dealMinQuantity: Number(dealInfo.minQuantity) || 1,
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

  // ✅ ADD BUNDLE TO CART
  //    Saare individual products ADD hote hain (har ek apni line me), lekin un sab ka
  //    total EXACTLY bundlePrice hota hai — is liye bundle price ko products par
  //    proportionally split kar ke har line ki `price` set karte hain (same % discount).
  //    Har line par bundleId/bundlePrice tags lagte hain taake cart, checkout aur
  //    order sab bundle ko pehchan sakein. Stock har individual product par deduct hota hai.
  const addBundleToCart = (bundle, resolvedItems = []) => {
    if (!bundle) return;

    const bundleId = String(bundle._id || bundle.id || "");
    const entries = (resolvedItems || []).filter((e) => e?.product);

    if (!bundleId || entries.length < 2) {
      toast.error("Bundle products are not available right now");
      return;
    }

    // ---------- STOCK CHECK (all-or-nothing) ----------
    const prepared = [];
    for (const entry of entries) {
      const product = entry.product;
      const variant = entry.variant || null;
      const quantity = Math.max(1, Number(entry.quantity) || 1);

      const productId = product._id || product.id;
      const variantKey = variant?._id
        ? `id:${variant._id}`
        : variant?.title
          ? `title:${variant.title}`
          : "no-variant";
      const key = `${productId}__${variantKey}__bundle_${bundleId}`;

      const stock = getStock(product, variant);
      const existingQty = cartRef.current.find((i) => i.key === key)?.qty || 0;

      if (stock !== null && existingQty + quantity > stock) {
        toast.error(
          `Only ${stock} in stock for "${product.name}" — bundle could not be added`
        );
        return;
      }

      prepared.push({
        product,
        variant,
        quantity,
        stock,
        key,
        productId,
        regularPrice: Number(variant?.selling_price || product.price || 0),
      });
    }

    // ---------- BASE LINES (the offer rule decides the final price) ----------
    const originalTotal = bundleOriginalTotal(
      prepared.map((p) => ({ regularPrice: p.regularPrice, quantity: p.quantity }))
    );

    // ✅ Single offer condition: buy all products / limited quantity → reward
    const bundleRule = normalizeBundleRule(bundle.bundleRule);

    const lines = prepared.map((p) => {
      const regularPrice = Number(p.regularPrice) || 0;

      return {
        key: p.key,
        id: p.productId,
        variant_id: p.variant?._id || null,
        name: p.product.name,
        brand: p.product.brand_id?.name || p.product.brand || "",
        price: regularPrice, // deal applies only when the condition is met
        regularPrice,
        image: p.variant?.images?.[0]?.img_url || "",
        variantTitle: p.variant?.title || "",
        qty: p.quantity,
        stock: p.stock,
        tax: Number(p.product.tax || 0),
        productId: String(p.productId),
        categoryId: String(p.product.category_id?._id || p.product.category_id || ""),
        brandId: String(p.product.brand_id?._id || p.product.brand_id || ""),
        productDiscountPct: Number(p.product.discount || 0),
        // ✅ Bundle tracking (cart + checkout + order)
        bundleId,
        bundleName: bundle.name || "Bundle",
        bundleImage: bundle.imageUrl || bundle.image || "",
        bundlePrice: Number(bundle.bundlePrice) || 0, // legacy combo price (optional)
        bundleOriginalPrice: originalTotal,
        bundleQuantity: p.quantity,
        bundleItemCount: prepared.length,
        bundleSavings: 0,
        bundleRule,
      };
    });

    // ---------- MERGE ----------
    const existingGroup = cartRef.current.filter(
      (i) => String(i.bundleId) === bundleId
    );
    const existingProductLines = existingGroup.filter((i) => !i.isBundleGift);
    const others = cartRef.current.filter((i) => String(i.bundleId) !== bundleId);

    if (existingProductLines.length === lines.length) {
      // Already in cart → add one more set (increase the quantities)
      const bumped = lines.map((line) => {
        const ex = existingProductLines.find((i) => i.key === line.key);
        return ex
          ? {
              ...ex,
              qty: (Number(ex.qty) || 0) + line.bundleQuantity,
              stock: line.stock ?? ex.stock,
            }
          : line;
      });

      const { lines: pricedGroup, pricing } = priceBundleGroup([...others, ...bumped], bundleId);
      save(pricedGroup);

      const note = pricing?.appliedLabel
        ? ` — ${pricing.appliedLabel} applied`
        : pricing?.progress
        ? ` — ${pricing.progress}`
        : "";
      toast.success(`"${lines[0].bundleName}" quantity updated${note}`);
      return;
    }

    const { lines: pricedGroup, pricing } = priceBundleGroup([...others, ...lines], bundleId);
    save(pricedGroup);

    const message = `"${lines[0].bundleName}" added — ${lines.length} products in your cart`;
    const savings = pricing ? pricing.totalSavings : 0;

    if (savings > 0) {
      toast.success(message, {
        description: `You save Rs. ${savings.toLocaleString()}`,
      });
    } else if (pricing?.progress) {
      toast.info(message, { description: pricing.progress });
    } else {
      toast.success(message);
    }
  };

  // ✅ UPDATE QTY — with STOCK CHECK + MIN QUANTITY CHECK
    const updateQty = (key, qty) => {
    const lineItem = cartRef.current.find((i) => i.key === key);

    // ✅ BUNDLE LINE → quantity applies to the whole bundle group
    //    (otherwise a partial discounted price would stay on some lines)
    if (lineItem?.bundleId) {
      const bundleId = String(lineItem.bundleId);

      if (qty <= 0) {
        save(cartRef.current.filter((i) => String(i.bundleId) !== bundleId));
        return;
      }

      const group = cartRef.current.filter(
        (i) => String(i.bundleId) === bundleId && !i.isBundleGift
      );

      // Pressing ± on the gift line should still use a real bundle line
      const anchor = lineItem.isBundleGift ? group[0] : lineItem;
      const perBundle = Math.max(1, Number(anchor?.bundleQuantity) || 1);
      let multiplier = Math.max(1, Math.round(qty / perBundle));

      // Lowest stock across the group decides the limit
      let maxMultiplier = Infinity;
      group.forEach((line) => {
        const stock = line.stock != null ? Number(line.stock) : null;
        const per = Math.max(1, Number(line.bundleQuantity) || 1);
        if (stock !== null) maxMultiplier = Math.min(maxMultiplier, Math.floor(stock / per));
      });

      if (Number.isFinite(maxMultiplier) && multiplier > maxMultiplier) {
        multiplier = Math.max(1, maxMultiplier);
        toast.error(
          `Only ${multiplier} bundle${multiplier > 1 ? "s" : ""} available in stock`
        );
      }

      // ✅ Re-apply the offer condition after the quantity change
      const bumped = cartRef.current.map((i) =>
        String(i.bundleId) === bundleId && !i.isBundleGift
          ? { ...i, qty: Math.max(1, Number(i.bundleQuantity) || 1) * multiplier }
          : i
      );

      const { lines: pricedGroup, pricing } = priceBundleGroup(bumped, bundleId);
      save(pricedGroup);

      if (pricing?.appliedLabel) {
        toast.success(`Offer applied — ${pricing.appliedLabel}`);
      } else if (pricing?.progress) {
        toast.info(pricing.progress);
      }

      if (pricing?.giftRule && pricing?.giftQty > 0) {
        toast.success(
          `Free gift added — ${pricing.giftRule.freeProductName || "Gift"} (${pricing.giftQty})`
        );
      }
      return;
    }

    if (qty <= 0) return save(cartRef.current.filter((i) => i.key !== key));

    const item = lineItem;
    let max = item?.stock != null ? Number(item.stock) : null;
    if (max !== null && item?.dealType === "buy_x_get_y" && item.dealBuyQuantity && item.dealGetQuantity) {
      max = maxPayableQty(max, item.dealBuyQuantity, item.dealGetQuantity);
    }

    if (max !== null && qty > max) {
      toast.error(`Only ${max} available in stock for "${item?.name || "this item"}"`);
      qty = max;
      if (qty <= 0) return;
    }

    // ✅ MIN QUANTITY CHECK — if qty falls below deal's minQuantity, remove deal
    if (item?.dealId && item?.dealMinQuantity) {
      const minQty = Number(item.dealMinQuantity) || 1;
      if (qty < minQty) {
        // Revert to regular price, remove deal info
        save(cartRef.current.map((i) => {
          if (i.key !== key) return i;
          return {
            ...i,
            dealId: null,
            dealType: null,
            dealName: null,
            dealBadge: null,
            dealSavings: 0,
            dealOriginalPrice: 0,
            dealDiscountValue: 0,
            dealMinQuantity: 0,
            dealBuyQuantity: 0,
            dealGetQuantity: 0,
            price: i.dealRegularPrice || i.price,
          };
        }));
        toast.info(`Minimum ${minQty} items required for deal — deal removed`);
        return;
      }
    }

    save(cartRef.current.map((i) => (i.key === key ? { ...i, qty } : i)));
  };

  const removeFromCart = (key) => {
    const item = cartRef.current.find((i) => i.key === key);

    // ✅ Bundle: ek line hataane par poora bundle hatega
    if (item?.bundleId) {
      const bundleId = String(item.bundleId);
      const removed = cartRef.current.filter((i) => String(i.bundleId) === bundleId);
      save(cartRef.current.filter((i) => String(i.bundleId) !== bundleId));
      return removed;
    }

    const removed = cartRef.current.filter((i) => i.key === key);
    save(cartRef.current.filter((i) => i.key !== key));
    return removed;
  };

  // ✅ Kisi bhi cart line ke saath uska poora bundle group lo
  const getBundleGroup = (key) => {
    const item = cartRef.current.find((i) => i.key === key);
    if (!item) return [];
    if (!item.bundleId) return [item];
    return cartRef.current.filter(
      (i) => String(i.bundleId) === String(item.bundleId)
    );
  };

  // ✅ Live pricing info of a bundle group (cart / drawer / checkout UI)
  const getBundleGroupInfo = (bundleId) => {
    const id = String(bundleId || "");
    if (!id) return null;

    const group = cartRef.current.filter(
      (i) => String(i.bundleId) === id && !i.isBundleGift
    );
    if (!group.length) return null;

    const rule = normalizeBundleRule(group[0].bundleRule);
    const productCount = group.length;
    const groupUnits = group.reduce((s, l) => s + Math.max(0, Number(l.qty) || 0), 0);
    const groupSubtotal = round2(
      group.reduce(
        (s, l) => s + (Number(l.regularPrice) || 0) * Math.max(0, Number(l.qty) || 0),
        0
      )
    );

    const pricing = computeBundlePricing({
      rule,
      groupUnits,
      groupSubtotal,
      productCount,
      legacyBundlePrice: Number(group[0].bundlePrice) || 0,
      multiplier: bundleMultiplierFromLines(group),
    });

    return {
      ...pricing,
      bundleId: id,
      bundleName: group[0].bundleName || "Bundle",
      productCount,
      ruleLabel: rule ? bundleRuleLabel(rule, productCount) : "",
      giftLines: cartRef.current.filter(
        (i) => String(i.bundleId) === id && i.isBundleGift
      ),
    };
  };

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

  // ✅ APPLY DEAL TO CART ITEM — deal select/remove from dropdown + AUTO FILL min qty
  const applyDealToItem = (key, deal) => {
    const item = cartRef.current.find((i) => i.key === key);
    if (!item) return;

    const regularPrice = Number(item.dealRegularPrice || item.regularPrice || item.price || 0);

    if (!deal) {
      // ✅ Remove deal — revert to regular price, keep qty same
      save(cartRef.current.map((i) => {
        if (i.key !== key) return i;
        return {
          ...i,
          dealId: null,
          dealType: null,
          dealName: null,
          dealBadge: null,
          dealSavings: 0,
          dealOriginalPrice: 0,
          dealDiscountValue: 0,
          dealMinQuantity: 0,
          dealBuyQuantity: 0,
          dealGetQuantity: 0,
          price: regularPrice,
        };
      }));
      toast.info("Deal removed");
      return;
    }

    // ✅ Calculate required minimum quantity
    const minQty = Number(deal.minQuantity) || 1;
    const buyQty = deal.type === "buy_x_get_y" ? (Number(deal.buyQuantity) || 0) : 0;
    const requiredQty = Math.max(minQty, buyQty);

    // ✅ Auto-fill: if current qty < required, increase to required
    let newQty = item.qty;
    if (item.qty < requiredQty) {
      // Check stock limit
      const stock = item.stock != null ? Number(item.stock) : null;
      if (stock !== null && requiredQty > stock) {
        newQty = stock;
        toast.warning(`Only ${stock} in stock — setting to max`);
      } else {
        newQty = requiredQty;
      }
    }

    // ✅ Calculate deal price
    let linePrice = regularPrice;
    if (deal.type === "percentage" && Number(deal.discountValue) > 0) {
      linePrice = Math.round(regularPrice * (1 - Number(deal.discountValue) / 100));
    } else if (deal.type === "fixed_amount" && Number(deal.discountValue) > 0) {
      linePrice = Math.max(0, regularPrice - Number(deal.discountValue));
    }

    save(cartRef.current.map((i) => {
      if (i.key !== key) return i;
      return {
        ...i,
        qty: newQty,
        dealId: deal._id,
        dealType: deal.type,
        dealName: deal.name,
        dealBadge: null,
        dealSavings: 0,
        dealOriginalPrice: regularPrice,
        dealDiscountValue: Number(deal.discountValue) || 0,
        dealMinQuantity: minQty,
        dealRegularPrice: regularPrice,
        price: linePrice,
        ...(deal.type === "buy_x_get_y"
          ? { dealBuyQuantity: deal.buyQuantity || 0, dealGetQuantity: deal.getQuantity || 0 }
          : { dealBuyQuantity: 0, dealGetQuantity: 0 }),
      };
    }));

    if (newQty > item.qty) {
      toast.success(`"${deal.name}" applied — qty auto-set to ${newQty}`);
    } else {
      toast.success(`"${deal.name}" deal applied!`);
    }
  };

  const getDealInfoForItem = (item) => {
    if (!item.dealId || item.dealType !== "buy_x_get_y") return null;
    const basePrice = Number(item.dealRegularPrice || item.regularPrice || item.price || 0);
    return {
      buyQty: item.dealBuyQuantity || 2,
      getQty: item.dealGetQuantity || 1,
      freeItems: calculateFreeItems(item.qty, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
      payableItems: calculatePayableItems(item.qty, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
      savings: calculateBuyXGetYSavings(item.qty, basePrice, item.dealBuyQuantity || 2, item.dealGetQuantity || 1),
    };
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        addBundleToCart,
        updateQty,
        removeFromCart,
        getBundleGroup,
        getBundleGroupInfo,
        removeItems,
        restoreItems,
        clearCart,
        count,
        isCartOpen,
        setIsCartOpen,
        getDealInfoForItem,
        applyDealToItem,
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
