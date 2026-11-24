"use client";

/* ==========================================================
   FLOATING WHATSAPP — store editor Theme → Conversion boosters
   settings.conversion = { whatsappFloat, whatsappNumber, whatsappMessage }
   Bottom-START corner (support chat widget bottom-end par hai).
   Checkout / cart par nahi (purchase flow me distraction nahi).
   ========================================================== */

import { usePathname } from "next/navigation";
import { useStoreTheme } from "./ThemeProvider";
import { useTranslation } from "@/i18n/LanguageProvider";

const HIDDEN_ON = ["/checkout", "/cart"];

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.94.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.53 0 4.9.99 6.69 2.78a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.45 9.45m8.05-17.5A11.3 11.3 0 0 0 12.04.66C5.77.66.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.02-1.58a11.3 11.3 0 0 0 5.44 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.05" />
    </svg>
  );
}

export default function FloatingWhatsApp() {
  const { theme } = useStoreTheme();
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const cfg = theme?.settings?.conversion || {};
  const phone = String(cfg.whatsappNumber || "").replace(/\D/g, "");

  if (!cfg.whatsappFloat || !phone) return null;
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const href = `https://wa.me/${phone}${cfg.whatsappMessage ? `?text=${encodeURIComponent(cfg.whatsappMessage)}` : ""}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("storefront.whatsapp.chat")}
      title={t("storefront.whatsapp.chat")}
      className="fixed bottom-20 start-3 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg transition hover:scale-105 hover:shadow-xl sm:bottom-6 sm:start-6"
      style={{ width: "3.25rem", height: "3.25rem" }}
    >
      <WhatsAppGlyph />
    </a>
  );
}
