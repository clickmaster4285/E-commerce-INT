import "./landing.css";

import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import LandingProvider from "@/components/landing/LandingContext";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Marquee from "@/components/landing/Marquee";
import Categories from "@/components/landing/Categories";
import Deals from "@/components/landing/Deals";
import FeaturedProducts from "@/components/landing/FeaturedProducts";
import WhyChooseUs from "@/components/landing/WhyChooseUs";
import PromoBanner from "@/components/landing/PromoBanner";
import Testimonials from "@/components/landing/Testimonials";
import Stats from "@/components/landing/Stats";
import Newsletter from "@/components/landing/Newsletter";
import Footer from "@/components/landing/Footer";
import FloatingButtons from "@/components/landing/FloatingButtons";

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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Click Master Store — Click. Order. Delivered.",
  description:
    "Pakistan's trusted online store. 45,000+ original products, Flash Deals up to 70% off, Free Delivery, Cash on Delivery aur 7-day easy returns across 120+ cities.",
  keywords: [
    "online shopping Pakistan",
    "Click Master Store",
    "cash on delivery",
    "flash deals Pakistan",
    "ecommerce Lahore",
  ],
  alternates: { canonical: "/landing" },
  openGraph: {
    type: "website",
    siteName: "Click Master Store",
    title: "Click Master Store — Click. Order. Delivered.",
    description:
      "45,000+ products, Flash Deals, Free Delivery & Cash on Delivery — anywhere in Pakistan.",
    url: "/landing",
    locale: "en_PK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Click Master Store — Click. Order. Delivered.",
    description:
      "45,000+ products, Flash Deals, Free Delivery & Cash on Delivery — anywhere in Pakistan.",
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Click Master Store",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.ico`,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    areaServed: "PK",
    telephone: "+92-300-1234567",
    availableLanguage: ["English", "Urdu"],
  },
  sameAs: [
    "https://www.facebook.com/clickmasterstore",
    "https://www.instagram.com/clickmasterstore",
    "https://www.youtube.com/@clickmasterstore",
  ],
};

export default function LandingPage() {
  return (
    <main
      className={`${inter.variable} ${plusJakarta.variable} user-theme landing-page min-h-screen`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <LandingProvider>
        <Navbar />
        <Hero />
        <Marquee />
        <Categories />
        <Deals />
        <FeaturedProducts />
        <WhyChooseUs />
        <PromoBanner />
        <Testimonials />
        <Stats />
        <Newsletter />
        <Footer />
        <FloatingButtons />
      </LandingProvider>
    </main>
  );
}
