import "./globals.css";
import "./user.css";
import Providers from "./providers";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import Script from "next/script";

export const metadata = {
  title: "Store",
  description: "Online Shopping Store",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

// Theme scripts run synchronously before first paint to avoid dark-mode flash.
const adminThemeScript = `(function(){try{if(!(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0))return;var m=document.cookie.match("(^|;)\\s*theme\\s*=\\s*([^;]+)");var t=m?decodeURIComponent(m[2]):"light";if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})()`;

const userThemeScript = `(function(){try{if(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0)return;var m=document.cookie.match("(^|;)\\s*user-theme\\s*=\\s*([^;]+)");var t=m?decodeURIComponent(m[2]):"light";if(t==="dark"){document.documentElement.classList.add("user-dark");}}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Arabic -> Noto Naskh Arabic, Urdu -> Noto Nastaliq Urdu. Loaded on demand
            via the media trick so English (LTR) never blocks on them. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap"
        />
        <Script
          id="admin-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: adminThemeScript }}
        />
        <Script
          id="user-theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: userThemeScript }}
        />
      </head>
      <body>
        <Providers>
          <LanguageProvider>{children}</LanguageProvider>
        </Providers>
      </body>
    </html>
  );
}
