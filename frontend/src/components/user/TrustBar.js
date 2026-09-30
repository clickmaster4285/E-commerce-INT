"use client";

/* ==========================================================
   TRUST BAR — footer ke upar wali 4-item trust strip
   Values REAL data se:
     - Shipping fees / delivery days → /shipping/config (public)
     - Support phone / email         → /store/public
   Fallback sirf tab use hota hai jab store ne shipping config
   set na ki ho (store owner ke portal se kabhi bhi badal sakte hain).
   ========================================================== */

import { useQuery } from "@tanstack/react-query";
import { Headphones, RotateCcw, ShieldCheck, Truck, Zap } from "lucide-react";
import { shippingApi } from "@/apis/user/shippingApi";
import { storeApi } from "@/apis/user/storeApi";
import { formatPrice } from "@/utils/homeCatalog";

export default function TrustBar() {
  const { data: config = null } = useQuery({
    queryKey: ["shippingConfig"],
    queryFn: shippingApi.getConfig,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  const standard = config?.standard || null;
  const express = config?.express || null;
  const freeOver = Number(config?.free_shipping_over || 0);
  const support = store?.support_phone || store?.support_email || store?.phone || "";

  const days = (range) =>
    range && (range.min_days || range.max_days)
      ? `${range.min_days || 1}-${range.max_days || range.min_days || 1} days`
      : null;

  const items = [
    freeOver > 0
      ? {
          key: "free",
          icon: Truck,
          title: "Free Shipping",
          subtitle: `On orders over ${formatPrice(freeOver)}`,
        }
      : express
        ? {
            key: "express",
            icon: Zap,
            title: "Express Delivery",
            subtitle: [formatPrice(express.fee), days(express)].filter(Boolean).join(" · "),
          }
        : { key: "ship", icon: Truck, title: "Free Shipping", subtitle: "On qualifying orders" },
    standard
      ? {
          key: "standard",
          icon: Truck,
          title: "Standard Delivery",
          subtitle: [formatPrice(standard.fee), days(standard)].filter(Boolean).join(" · "),
        }
      : { key: "returns", icon: RotateCcw, title: "Easy Returns", subtitle: "Hassle-free returns" },
    {
      key: "secure",
      icon: ShieldCheck,
      title: "Secure Payments",
      subtitle: "100% secure checkout",
    },
    {
      key: "support",
      icon: Headphones,
      title: "24/7 Support",
      subtitle: support || "We're here to help you",
    },
  ];

  return (
    <section className="mt-8 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4 lg:divide-x lg:divide-[var(--user-border)]">
      {items.map(({ key, icon: Icon, title, subtitle }) => (
        <div key={key} className="flex items-center gap-3 lg:px-5 lg:first:pl-0 lg:last:pr-0">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
            <Icon size={20} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-bold text-[var(--user-text)]">{title}</p>
            <p className="truncate text-[0.6875rem] text-[var(--user-text-subtle)]">{subtitle}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
