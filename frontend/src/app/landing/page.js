import "./landing.css";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import CursorGlow from "@/components/landing/CursorGlow";
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

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

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
    <main
      className={`${inter.variable} ${plusJakarta.variable} user-theme landing-page min-h-screen`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, faqJsonLd]) }}
      />

      <CursorGlow />
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
