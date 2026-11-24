import "./landing.css";

import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustStrip from "@/components/landing/TrustStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import PlatformFeatures from "@/components/landing/PlatformFeatures";
import Stats from "@/components/landing/Stats";
import Testimonials from "@/components/landing/Testimonials";
import Faq from "@/components/landing/Faq";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";
import FloatingButtons from "@/components/landing/FloatingButtons";
import { FAQS, SITE } from "@/components/landing/content";

// ⚠️ Fonts next/font/google se NAHI — woh `next build` ke waqt Google se download
// karta hai, aur internet/firewall na ho to poora build fail ho jata tha.
// Ab browser runtime par Google Fonts stylesheet load karta hai (display=swap);
// na mile to system font fallback. Variables wahi: --font-body / --font-heading.
const LANDING_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";

const fontVars = {
  "--font-body": '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--font-heading": '"Plus Jakarta Sans", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: "Click Master Store — Orders, Invoices, Shipping & Inventory in One Dashboard",
  description:
    "The complete commerce operating system for Pakistan: ORD- orders, QT- quotes, INV- tax-ready invoices, shipping rules, real-time inventory, POS, CRM, finance reports and full Urdu support — in one MERN platform.",
  keywords: [
    "commerce platform Pakistan",
    "inventory management software",
    "invoice software Urdu",
    "POS Pakistan",
    "COD ecommerce Pakistan",
  ],
  alternates: { canonical: "/landing" },
  openGraph: {
    type: "website",
    siteName: "Click Master Store",
    title: "Click Master Store — The Commerce Operating System for Pakistan",
    description:
      "Orders, quotations, invoices, shipping rules, inventory, POS, CRM and finance — one dashboard. COD-friendly, full Urdu support.",
    url: "/landing",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Click Master Store — The Commerce Operating System for Pakistan",
    description:
      "Orders, quotations, invoices, shipping rules, inventory, POS, CRM and finance — one dashboard.",
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Click Master Store",
  url: SITE.url,
  logo: `${SITE.url}/favicon.ico`,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    areaServed: "PK",
    availableLanguage: ["English", "Urdu"],
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function LandingPage() {
  return (
    <main style={fontVars} className="user-theme landing-page min-h-screen">
      {/* React 19 isay <head> me hoist karta hai */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={LANDING_FONTS_HREF} precedence="default" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, faqJsonLd]) }}
      />

      <Navbar />
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <PlatformFeatures />
      <Stats />
      <Testimonials />
      <Faq />
      <FinalCta />
      <Footer />
      <FloatingButtons />
    </main>
  );
}
