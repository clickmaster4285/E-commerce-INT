"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Header from "../../components/user/Header";
import Footer from "../../components/user/Footer";
import CartDrawer from "../../components/user/CartDrawer";
import { CartProvider, useCart } from "../../components/user/CartContext";
import { storeApi } from "@/apis/user/storeApi";
import { Home, ShoppingCart, User, Heart } from "lucide-react";
import { WishlistProvider, useWishlist } from "@/components/user/WishlistContext";

function getThemeFromCookie() {
  const cookies = document.cookie.split("; ");
  const themeCookie = cookies.find((cookie) => cookie.startsWith("user-theme="));
  if (!themeCookie) return "dark";
  return themeCookie.split("=")[1];
}

export function setUserTheme(theme) {
  document.cookie = `user-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  const element = document.getElementById("user-theme");
  if (element) element.classList.toggle("light", theme === "light");
}

function MobileNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { count: wishlistCount } = useWishlist();

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)] border-t border-[var(--user-border)] backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-4 h-16">

        {/* HOME */}
        <Link href="/" className="h-full">
          <NavItem icon={<Home size={20} />} label="Home" active={isActive("/")} />
        </Link>

        {/* WISHLIST */}
        <Link href="/wishlist" className="h-full">
          <NavItem
            icon={
              <span className="relative">
                <Heart size={20} className={isActive("/wishlist") ? "fill-current" : ""} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[var(--user-danger)] text-white text-[9px] font-bold min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </span>
            }
            label="Wishlist"
            active={isActive("/wishlist")}
          />
        </Link>

        {/* ✅ CART — mobile pe /cart PAGE khulta hai */}
        <Link href="/cart" className="h-full">
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
            active={isActive("/cart")}
          />
        </Link>

        {/* ACCOUNT */}
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
      <span className={`text-[9px] font-semibold ${active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"}`}>
        {label}
      </span>
    </span>
  );
}

export default function UserLayout({ children }) {
  const { data: store } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const savedTheme = getThemeFromCookie();
    const element = document.getElementById("user-theme");
    if (element) element.classList.toggle("light", savedTheme === "light");
  }, []);

  useEffect(() => {
    if (store?.store_name) document.title = store.store_name;
  }, [store]);

  return (
    <WishlistProvider>
      <CartProvider>
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