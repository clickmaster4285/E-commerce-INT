"use client";

import Link from "next/link";

import { Mail, Phone, MapPin } from "lucide-react";

import { FaFacebookF, FaInstagram, FaTwitter, FaYoutube } from "react-icons/fa";

export default function Footer() {
  return (
    <footer
      className="
bg-[#020d08]
border-t
border-white/10
mt-16
"
    >
      <div
        className="
max-w-[1400px]
mx-auto
px-5
py-14
"
      >
        <div
          className="
grid
grid-cols-1
sm:grid-cols-2
lg:grid-cols-5
gap-10
"
        >
          {/* BRAND */}

          <div
            className="
lg:col-span-2
"
          >
            <h2
              className="
text-3xl
font-black
text-white
tracking-wide
"
            >
              <span className="text-[#d4af37]">C</span>
              LICKMASTERS
            </h2>

            <p
              className="
mt-4
text-gray-400
text-sm
leading-6
max-w-sm
"
            >
              Premium electronics marketplace bringing latest smartphones,
              laptops, accessories and gadgets at the best prices.
            </p>

            <div
              className="
mt-6
space-y-3
text-sm
text-gray-400
"
            >
              <p className="flex items-center gap-3">
                <Mail size={16} className="text-[#d4af37]" />
                support@clickmasters.com
              </p>

              <p className="flex items-center gap-3">
                <Phone size={16} className="text-[#d4af37]" />
                +92 300 0000000
              </p>

              <p className="flex items-center gap-3">
                <MapPin size={16} className="text-[#d4af37]" />
                Pakistan
              </p>
            </div>
          </div>

          {/* CATEGORIES */}

          <div>
            <h3
              className="
text-[#d4af37]
font-bold
mb-5
"
            >
              Categories
            </h3>

            <ul
              className="
space-y-3
text-sm
text-gray-400
"
            >
              <li>
                <Link href="/category/mobiles" className="hover:text-white">
                  Mobiles
                </Link>
              </li>

              <li>
                <Link href="/category/laptops" className="hover:text-white">
                  Laptops
                </Link>
              </li>

              <li>
                <Link href="/category/watches" className="hover:text-white">
                  Smart Watches
                </Link>
              </li>

              <li>
                <Link href="/category/accessories" className="hover:text-white">
                  Accessories
                </Link>
              </li>

              <li>
                <Link href="/category/cameras" className="hover:text-white">
                  Cameras
                </Link>
              </li>
            </ul>
          </div>

          {/* SUPPORT */}

          <div>
            <h3
              className="
text-[#d4af37]
font-bold
mb-5
"
            >
              Support
            </h3>

            <ul
              className="
space-y-3
text-sm
text-gray-400
"
            >
              <li>
                <Link href="#" className="hover:text-white">
                  Contact Us
                </Link>
              </li>

              <li>
                <Link href="#" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link href="#" className="hover:text-white">
                  Terms & Conditions
                </Link>
              </li>

              <li>
                <Link href="#" className="hover:text-white">
                  Returns
                </Link>
              </li>
            </ul>
          </div>

          {/* SOCIAL */}

          <div>
            <h3
              className="
text-[#d4af37]
font-bold
mb-5
"
            >
              Follow Us
            </h3>

            <div
              className="
flex
gap-3
"
            >
              {[FaFacebookF, FaInstagram, FaTwitter, FaYoutube].map(
                (Icon, index) => (
                  <button
                    key={index}
                    className="
w-10
h-10
rounded-full
bg-[#10251a]
border
border-white/10
flex
items-center
justify-center
text-gray-300
hover:bg-[#d4af37]
hover:text-black
transition
"
                  >
                    <Icon size={18} />
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM */}

      
      </div>
    </footer>
  );
}
