"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/apis/axiosInstance";
import {
  User,
  Package,
  Clock,
  CheckCircle,
  Truck,
  PackageCheck,
  XCircle,
  ShoppingBag,
} from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const STATUS_CONFIG = {
  pending:   { label: "Pending",   icon: Clock,        colorVar: "--user-warning",  bgVar: "--user-warning" },
  confirmed: { label: "Confirmed", icon: CheckCircle,  colorVar: "--user-accent",   bgVar: "--user-accent" },
  shipped:   { label: "Shipped",   icon: Truck,        colorVar: "--user-info",     bgVar: "--user-info" },
  delivered: { label: "Delivered", icon: PackageCheck, colorVar: "--user-success",  bgVar: "--user-success" },
  cancelled: { label: "Cancelled", icon: XCircle,      colorVar: "--user-danger",   bgVar: "--user-danger" },
};

export default function AccountPage() {
  const [filter, setFilter] = useState("all");

  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await axiosInstance.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["myOrders"],
    queryFn: async () => {
      const res = await axiosInstance.get("/orders/my-orders");
      return res.data?.data || [];
    },
    enabled: !!user,
    retry: false,
  });

  const getImgUrl = (img) => {
    const raw = typeof img === "string" ? img : img?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  // ✅ Not logged in
  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-20 lg:py-28 text-center">
        <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5 lg:mb-6">
          <User size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
        </div>
        <h1 className="text-xl lg:text-2xl font-bold text-[var(--user-text)] mb-2">
          Login Required
        </h1>
        <p className="text-[var(--user-text-muted)] text-sm mb-6 lg:mb-8 max-w-sm mx-auto">
          Please login to view your account and orders.
        </p>
        <Link
          href="/login"
          className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 lg:px-8 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
        >
          Login to Your Account
        </Link>
      </div>
    );
  }

  const avatarLetter = (user.name || user.email || "U").charAt(0).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : "";

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
      {/* ✅ MEMBER CARD */}
      <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-5 sm:p-6 lg:p-8 mb-6 lg:mb-8">
        {/* Decorative background icon */}
        <div className="absolute -right-6 -bottom-10 lg:-right-10 lg:-bottom-16 opacity-[0.04] pointer-events-none">
          <ShoppingBag size={180} className="lg:w-[220px] lg:h-[220px] text-[var(--user-accent)]" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
          {/* Avatar */}
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full border-2 lg:border-4 border-[var(--user-accent)] object-cover"
            />
          ) : (
            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-2xl lg:text-3xl font-black flex items-center justify-center">
              {avatarLetter}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--user-text)] capitalize truncate">
              {user.name || user.username}
            </h1>
            <p className="text-[var(--user-text-muted)] text-xs lg:text-sm mt-1 truncate">
              {user.email}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] lg:text-[10px] font-bold px-2.5 lg:px-3 py-1 rounded-full uppercase tracking-wider">
                ClickMasters Member
              </span>
              {memberSince && (
                <span className="text-[10px] lg:text-[11px] text-[var(--user-text-subtle)]">
                  Member since {memberSince}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex sm:flex-col gap-3 text-center shrink-0">
            <div className="flex-1 sm:flex-none rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-4 lg:px-5 py-2.5 lg:py-3">
              <p className="text-lg lg:text-xl font-black text-[var(--user-accent)]">
                {orders.length}
              </p>
              <p className="text-[9px] lg:text-[10px] text-[var(--user-text-subtle)] uppercase tracking-wider">
                Total Orders
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MY ORDERS — Status filters */}
      <div className="mb-5 lg:mb-6">
        <h2 className="text-base lg:text-lg font-bold text-[var(--user-text)] mb-3 lg:mb-4">
          My Orders
        </h2>

        <div className="flex flex-wrap gap-1.5 lg:gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[11px] lg:text-xs font-semibold border transition ${
              filter === "all"
                ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]"
                : "bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] border-[var(--user-border)] hover:border-[var(--user-accent)]/50"
            }`}
          >
            All ({orders.length})
          </button>

          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const isActive = filter === key;
            const color = `var(${cfg.colorVar})`;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`flex items-center gap-1.5 px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[11px] lg:text-xs font-semibold border transition ${
                  isActive
                    ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)]"
                    : "bg-[var(--user-bg-card)] border-[var(--user-border)] hover:bg-[var(--user-bg-hover)]"
                }`}
                style={!isActive ? { color } : {}}
              >
                <Icon size={12} className="lg:w-[13px] lg:h-[13px]" />
                {cfg.label} ({counts[key] || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* ✅ ORDERS LIST */}
      {filtered.length === 0 ? (
        <div className="py-12 lg:py-20 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
          <div className="w-14 h-14 lg:w-16 lg:h-16 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4 lg:mb-5">
            <Package size={24} className="text-[var(--user-accent)] lg:w-7 lg:h-7 opacity-60" />
          </div>
          <p className="text-[var(--user-text)] font-semibold mb-1 text-base lg:text-lg">
            No orders found
          </p>
          <p className="text-[var(--user-text-muted)] text-sm mb-5 lg:mb-6 max-w-sm mx-auto">
            {filter === "all"
              ? "You haven't placed any orders yet."
              : "No orders with this status."}
          </p>
          <Link
            href="/"
            className="inline-block bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {filtered.map((order) => {
            const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = cfg.icon;
            const statusColor = `var(${cfg.colorVar})`;
            return (
              <div
                key={order._id}
                className="rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-4 lg:p-5 hover:border-[var(--user-accent)]/40 transition"
              >
                {/* Order header */}
                <div className="flex items-center justify-between mb-3 lg:mb-4 pb-3 lg:pb-4 border-b border-[var(--user-border)]">
                  <div className="min-w-0">
                    <p className="text-xs lg:text-sm font-bold text-[var(--user-text)]">
                      Order #{String(order._id).slice(-6).toUpperCase()}
                    </p>
                    <p className="text-[10px] lg:text-[11px] text-[var(--user-text-muted)] mt-0.5">
                      {new Date(order.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items.length} {order.items.length === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <span
                    className="flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-full border shrink-0 ml-2"
                    style={{
                      color: statusColor,
                      backgroundColor: `color-mix(in srgb, ${statusColor} 10%, transparent)`,
                      borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`,
                    }}
                  >
                    <StatusIcon size={11} className="lg:w-3 lg:h-3" />
                    {cfg.label}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2.5 lg:space-y-3">
                  {order.items.map((item, i) => {
                    const imgUrl = getImgUrl(item.image);
                    return (
                      <div key={i} className="flex items-center gap-2.5 lg:gap-3">
                        <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] overflow-hidden flex items-center justify-center shrink-0">
                          {imgUrl ? (
                            <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={14} className="text-[var(--user-text-subtle)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs lg:text-sm text-[var(--user-text)] font-medium truncate">
                            {item.name}
                          </p>
                          <p className="text-[10px] lg:text-[11px] text-[var(--user-text-muted)] truncate">
                            {item.variant_title} · Qty: {item.qty}
                          </p>
                        </div>
                        <p className="text-xs lg:text-sm text-[var(--user-text-secondary)] font-semibold shrink-0">
                          Rs. {(item.price * item.qty).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-[var(--user-border)]">
                  <p className="text-[10px] lg:text-[11px] text-[var(--user-text-muted)] truncate pr-2">
                    {order.shipping_address?.city && `Deliver to: ${order.shipping_address.city}`}
                  </p>
                  <p className="text-xs lg:text-sm text-[var(--user-text-muted)] shrink-0">
                    Total:{" "}
                    <span className="text-[var(--user-accent)] font-black text-sm lg:text-base">
                      Rs. {order.total.toLocaleString()}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}