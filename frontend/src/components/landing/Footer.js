import {
  MousePointerClick,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { WHATSAPP_NUMBER } from "./data";

const SHOP_LINKS = [
  { label: "Mobiles & Gadgets", href: "/shop?category=mobiles" },
  { label: "Fashion", href: "/shop?category=fashion" },
  { label: "Home & Kitchen", href: "/shop?category=home-kitchen" },
  { label: "Beauty & Care", href: "/shop?category=beauty" },
  { label: "Flash Deals", href: "#deals" },
];

const SERVICE_LINKS = [
  { label: "Track Order", href: "/orders" },
  { label: "Returns & Exchange", href: "/account" },
  { label: "Shipping Policy", href: "/account" },
  { label: "FAQs", href: "/account" },
  { label: "Terms & Conditions", href: "/terms-conditions" },
];

const SOCIALS = [
  { icon: FaFacebookF, label: "Facebook", href: "https://www.facebook.com/clickmasterstore" },
  { icon: FaInstagram, label: "Instagram", href: "https://www.instagram.com/clickmasterstore" },
  { icon: FaXTwitter, label: "X (Twitter)", href: "https://www.x.com/clickmasterstore" },
  { icon: FaYoutube, label: "YouTube", href: "https://www.youtube.com/@clickmasterstore" },
];

const PAYMENTS = ["JazzCash", "Easypaisa", "Cash on Delivery", "Bank Transfer"];

export default function Footer() {
  return (
    <footer id="footer-contact" className="landing-footer scroll-mt-24" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Click Master Store footer
      </h2>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-3">
            <a href="/landing" className="flex min-h-[44px] items-center gap-2" aria-label="Click Master Store — home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)]">
                <MousePointerClick size={20} aria-hidden="true" />
              </span>
              <span className="font-heading leading-none">
                <span className="block text-lg font-extrabold text-white">Click Master</span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.22em] text-[#f57224]">Store</span>
              </span>
            </a>
            <p className="mt-3 max-w-[16rem] text-sm leading-6">
              Pakistan&apos;s trusted online store — original products, COD everywhere, 7-day easy returns.
            </p>
            <div className="mt-4 flex gap-2">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Click Master Store on ${label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#28313c] bg-[#151a21] text-[#d1d5db] transition-all hover:border-[#f57224] hover:text-[#f57224] focus-visible:outline-2 focus-visible:outline-[#f57224]"
                >
                  <Icon size={19} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Shop links */}
          <nav className="md:col-span-2" aria-label="Shop">
            <p className="text-xs font-extrabold uppercase tracking-widest text-white">Shop</p>
            <ul className="mt-3 space-y-2 text-sm">
              {SHOP_LINKS.map((l) => (
                <li key={l.label}><a href={l.href} className="inline-flex min-h-[32px] items-center">{l.label}</a></li>
              ))}
            </ul>
          </nav>

          {/* Customer service */}
          <nav className="md:col-span-2" aria-label="Customer service">
            <p className="text-xs font-extrabold uppercase tracking-widest text-white">Support</p>
            <ul className="mt-3 space-y-2 text-sm">
              {SERVICE_LINKS.map((l) => (
                <li key={l.label}><a href={l.href} className="inline-flex min-h-[32px] items-center">{l.label}</a></li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="md:col-span-5">
            <p className="text-xs font-extrabold uppercase tracking-widest text-white">Contact</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MapPin size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                Logistic Shuttle, Johar Town, Lahore, Pakistan
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                <a href="tel:+923001234567" className="inline-flex min-h-[32px] items-center">+92 300 1234567</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="shrink-0 text-[#f57224]" aria-hidden="true" />
                <a href="mailto:support@clickmasterstore.pk" className="inline-flex min-h-[32px] items-center">support@clickmasterstore.pk</a>
              </li>
            </ul>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Click Master Store! I need help with my order.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-emerald-500 px-5 font-extrabold text-[#06281c] transition-all hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-emerald-300"
            >
              <MessageCircle size={20} aria-hidden="true" />
              Chat on WhatsApp
            </a>

            {/* Payment methods */}
            <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-white">We Accept</p>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Accepted payment methods">
              {PAYMENTS.map((p) => (
                <li key={p} className="pay-badge">{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1c232c]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Click Master Store. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="/terms-conditions">Terms</a>
            <a href="/account">Privacy</a>
            <a href="#footer-contact">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
