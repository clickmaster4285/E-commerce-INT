"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./CartContext";

import { Menu, Search, User, ShoppingCart, X } from "lucide-react";

export default function Header() {
  const [open, setOpen] = useState(false);
const { count, setIsCartOpen } = useCart();
  const menuItems = [
    {
      name: "Mobiles",
      link: "/category/mobiles",
    },

    {
      name: "Laptops",
      link: "/category/laptops",
    },

    {
      name: "Smart Watches",
      link: "/category/watches",
    },

    {
      name: "Accessories",
      link: "/category/accessories",
    },

    {
      name: "Cameras",
      link: "/category/cameras",
    },

    {
      name: "Deals",
      link: "/deals",
    },
  ];

  const brands = ["Apple", "Samsung", "Sony", "Xiaomi"];

  return (
    <>
      {/* OVERLAY */}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="
fixed
inset-0
bg-black/70
z-40
"
        />
      )}

      {/* HEADER */}

      <header
        className="
sticky
top-0
z-50
bg-[#04120c]
border-b
border-[#d4af37]/20
"
      >
        <div
          className="
max-w-[1400px]
mx-auto
px-5
"
        >
          <div
            className="
h-[60px]
flex
items-center
justify-between
gap-5
"
          >
            {/* LEFT */}

            <div
              className="
flex
items-center
gap-4
"
            >
              <button
                onClick={() => setOpen(true)}
                className="
p-2
rounded-lg
hover:bg-white/10
transition
"
              >
                <Menu size={22} className="text-[#d4af37]" />
              </button>

              <Link
                href="/"
                className="
font-black
text-xl
tracking-wide
text-white
"
              >
                <span className="text-[#d4af37]">C</span>
                LICKMASTERS
              </Link>
            </div>

            {/* NAVIGATION */}

            <nav
              className="
hidden
lg:flex
items-center
gap-6
"
            >
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.link}
                  className="
text-xs
text-gray-300
hover:text-[#d4af37]
transition
"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* SEARCH */}

            <div
              className="
hidden
md:block
relative
w-[260px]
"
            >
              <input
                placeholder="Search products..."
                className="
w-full
h-9
rounded-full
bg-[#10251a]
border
border-[#d4af37]/30
px-4
pr-10
text-sm
text-white
placeholder:text-gray-400
outline-none
focus:border-[#d4af37]
"
              />

              <Search
                size={16}
                className="
absolute
right-4
top-2.5
text-[#d4af37]
"
              />
            </div>

            {/* RIGHT */}

            <div
              className="
flex
items-center
gap-5
"
            >
              <Link
                href="/login"
                className="
flex
items-center
gap-1
text-sm
text-white
hover:text-[#d4af37]
transition
"
              >
                <User size={16} />
                Login
              </Link>

           <button
  onClick={() => setIsCartOpen(true)}
  className="relative text-[#d4af37] hover:scale-110 transition"
>
  <ShoppingCart size={20} />
  <span className="absolute -top-2 -right-2 bg-[#d4af37] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
    {count}
  </span>
</button>
            </div>
          </div>
        </div>
      </header>

      {/* SIDEBAR */}

      <div
        className={`
fixed
top-0
left-0
h-full
w-[320px]
bg-[#04120c]
z-50
shadow-2xl
transition-transform
duration-300

${open ? "translate-x-0" : "-translate-x-full"}

`}
      >
        <div
          className="
flex
items-center
justify-between
p-5
border-b
border-white/10
"
        >
          <h2
            className="
text-white
font-bold
"
          >
            MENU
          </h2>

          <button onClick={() => setOpen(false)}>
            <X size={22} className="text-[#d4af37]" />
          </button>
        </div>

        <div
          className="
p-5
overflow-y-auto
"
        >
          <h3
            className="
text-[#d4af37]
text-xs
uppercase
tracking-widest
mb-4
"
          >
            Categories
          </h3>

          <div
            className="
space-y-3
"
          >
            {menuItems.slice(0, 5).map((item) => (
              <Link
                key={item.name}
                href={item.link}
                onClick={() => setOpen(false)}
                className="
block
px-4
py-3
rounded-xl
bg-[#10251a]
text-gray-200
text-sm
hover:bg-[#d4af37]
hover:text-black
transition
"
              >
                {item.name}
              </Link>
            ))}
          </div>

          <h3
            className="
text-[#d4af37]
text-xs
uppercase
tracking-widest
mt-8
mb-4
"
          >
            Brands
          </h3>

          <div
            className="
space-y-3
"
          >
            {brands.map((brand) => (
              <div
                key={brand}
                className="
px-4
py-3
rounded-xl
bg-[#10251a]
text-gray-200
text-sm
hover:bg-[#d4af37]
hover:text-black
cursor-pointer
transition
"
              >
                {brand}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
