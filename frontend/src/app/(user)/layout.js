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

/* =========================================================
   COOKIE HELPERS
========================================================= */

// Theme cookie read karna
function getThemeFromCookie() {
  const cookies = document.cookie.split("; ");

  const themeCookie = cookies.find((cookie) =>
    cookie.startsWith("user-theme=")
  );

  if (!themeCookie) {
    return "dark";
  }

  return themeCookie.split("=")[1];
}

// Theme cookie save karna
export function setUserTheme(theme) {
  document.cookie = `user-theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;

  const element = document.getElementById("user-theme");

  if (element) {
    element.classList.toggle("light", theme === "light");
  }
}

/* =========================================================
   MOBILE BOTTOM NAVIGATION
========================================================= */

function MobileNav() {
  const pathname = usePathname();
  const { count, setIsCartOpen } = useCart();

  const isActive = (href) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  };

  return (
    <nav
      className="
        fixed
        bottom-0
        left-0
        right-0
        z-40
        md:hidden
        bg-[var(--user-bg-elevated)]
        border-t
        border-[var(--user-border)]
        backdrop-blur-md
      "
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="grid grid-cols-4 h-16">

        {/* HOME */}
        <Link href="/" className="h-full">
          <NavItem
            icon={<Home size={20} />}
            label="Home"
            active={isActive("/")}
          />
        </Link>

        {/* SHOP */}
        <Link href="/products" className="h-full">
          <NavItem
            icon={<Search size={20} />}
            label="Shop"
            active={isActive("/products")}
          />
        </Link>

        {/* CART */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="h-full w-full"
          type="button"
        >
          <NavItem
            icon={
              <span className="relative">
                <ShoppingCart size={20} />

                {count > 0 && (
                  <span
                    className="
                      absolute
                      -top-1.5
                      -right-2
                      bg-[var(--user-accent)]
                      text-[var(--user-accent-text)]
                      text-[9px]
                      font-bold
                      min-w-[14px]
                      h-3.5
                      px-0.5
                      rounded-full
                      flex
                      items-center
                      justify-center
                    "
                  >
                    {count}
                  </span>
                )}
              </span>
            }
            label="Cart"
            active={false}
          />
        </button>

        {/* ACCOUNT */}
        <Link href="/account" className="h-full">
          <NavItem
            icon={<User size={20} />}
            label="Account"
            active={isActive("/account")}
          />
        </Link>

      </div>
    </nav>
  );
}

/* =========================================================
   MOBILE NAV ITEM
========================================================= */

function NavItem({ icon, label, active }) {
  return (
    <span className="flex flex-col items-center justify-center gap-1 w-full h-full">

      {/* ICON */}
      <span
        className={
          active
            ? "text-[var(--user-accent)]"
            : "text-[var(--user-text-muted)]"
        }
      >
        {icon}
      </span>

      {/* LABEL */}
      <span
        className={`text-[9px] font-semibold ${
          active
            ? "text-[var(--user-accent)]"
            : "text-[var(--user-text-muted)]"
        }`}
      >
        {label}
      </span>

    </span>
  );
}

/* =========================================================
   USER LAYOUT
========================================================= */

export default function UserLayout({ children }) {

  /* =======================================================
     STORE INFO
  ======================================================= */

  const { data: store } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,

    // 5 minutes tak cached data use karega
    staleTime: 5 * 60 * 1000,
  });

  /* =======================================================
     APPLY SAVED THEME FROM COOKIE
  ======================================================= */

  useEffect(() => {
    const savedTheme = getThemeFromCookie();

    const element = document.getElementById("user-theme");

    if (element) {
      element.classList.toggle(
        "light",
        savedTheme === "light"
      );
    }
  }, []);

  /* =======================================================
     DYNAMIC PAGE TITLE
  ======================================================= */

  useEffect(() => {
    if (store?.store_name) {
      document.title = store.store_name;
    }
  }, [store]);

  /* =======================================================
     UI
  ======================================================= */

  return (
    <WishlistProvider>
    <CartProvider>

      <div
        id="user-theme"
        className="
          user-theme
          min-h-screen
          w-full
          min-w-0
          flex
          flex-col
          overflow-x-clip
          bg-[var(--user-bg)]
          text-[var(--user-text)]
        "
      >

        {/* HEADER */}
        <Header />

        {/* MAIN CONTENT */}
        <main className="flex-1 w-full min-w-0 pb-16 md:pb-0">
          {children}
        </main>

        {/* FOOTER */}
        <Footer />

        {/* CART DRAWER */}
        <CartDrawer />

        {/* MOBILE BOTTOM NAV */}
        <MobileNav />

      </div>

    </CartProvider>
    </WishlistProvider>
  );
}