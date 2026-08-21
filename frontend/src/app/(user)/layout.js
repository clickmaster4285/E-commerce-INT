"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Header from "../../components/user/Header";
import Footer from "../../components/user/Footer";
import CartDrawer from "../../components/user/CartDrawer";
import { CartProvider, useCart } from "../../components/user/CartContext";
import { storeApi } from "@/apis/storeApi";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { WishlistProvider } from "@/components/user/WishlistContext";

// ✅ MOBILE BOTTOM NAVIGATION
function MobileNav() {
  const pathname = usePathname();
  const { count, setIsCartOpen } = useCart();

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)] border-t border-[var(--user-border)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">
        <Link href="/" className="h-full">
          <NavItem icon={<Home size={20} />} label="Home" active={isActive("/")} />
        </Link>
        <Link href="/products" className="h-full">
          <NavItem icon={<Search size={20} />} label="Shop" active={isActive("/products")} />
        </Link>
        <button onClick={() => setIsCartOpen(true)} className="h-full w-full">
          <NavItem
            icon={
              <span className="relative">
                <ShoppingCart size={20} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[9px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </span>
            }
            label="Cart"
            active={false}
          />
        </button>
        <Link href="/account" className="h-full">
          <NavItem icon={<User size={20} />} label="Account" active={isActive("/account")} />
        </Link>
      </div>
    </nav>
  );
}

function NavItem({ icon, label, active }) {
  return (
    <span className="flex flex-col items-center justify-center gap-1 w-full h-full">
      <span className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"}>
        {icon}
      </span>
      <span
        className={`text-[9px] font-semibold ${
          active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"
        }`}
      >
        {label}
      </span>
    </span>
  );
}

export default function UserLayout({ children }) {
  // ✅ Store info — layout level par fetch karein (faster initial load)
  const { data: store } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Saved theme apply karein (reload par bhi)
  useEffect(() => {
    const saved = localStorage.getItem("user-theme") || "dark";
    const el = document.getElementById("user-theme");
    if (el) el.classList.toggle("light", saved === "light");
  }, []);

  // ✅ Dynamic page title
  useEffect(() => {
    if (store?.store_name) {
      document.title = store.store_name;
    }
  }, [store]);

  return (
    <WishlistProvider>
    <CartProvider>
      {/* ✅ SIRF YE LINE CHANGE KI — baqi sab same */}
      <div
        id="user-theme"
        className="user-theme min-h-screen w-full min-w-0 flex flex-col overflow-x-clip bg-[var(--user-bg)] text-[var(--user-text)]"
      >
        <Header />
        <main className="flex-1 w-full min-w-0 pb-16 md:pb-0">{children}</main>
        <Footer />
        <CartDrawer />
        <MobileNav />
      </div>
    </CartProvider>
    </WishlistProvider>
  );
}