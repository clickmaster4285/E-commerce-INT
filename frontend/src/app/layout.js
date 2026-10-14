import "./globals.css";
import "./user.css";
import Providers from "./providers";

// ✅ Self-hosted fonts (same families/weights as before, display:swap) —
// render-blocking Google <link> hata diya, look same.

export const metadata = {
  title: "Store",
  description: "Online Shopping Store",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

// ✅ Theme scripts — browser inhe HTML parse karte waqt (first paint se PEHLE)
// synchronous chalta hai, is liye koi white/dark flash nahi hota.
//
//  1) ADMIN  — cookie `theme`,        class `dark`       (default: light)
//  2) STOREFRONT — cookie `user-theme`, class `user-dark` (default: light)
const adminThemeScript = `(function(){try{if(!(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0))return;var m=document.cookie.match("(^|;)\\s*theme\\s*=\\s*([^;]+)");var t=m?decodeURIComponent(m[2]):"light";if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})()`;

const userThemeScript = `(function(){try{if(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0)return;var m=document.cookie.match("(^|;)\\s*user-theme\\s*=\\s*([^;]+)");var t=m?decodeURIComponent(m[2]):"light";if(t==="dark"){document.documentElement.classList.add("user-dark");}}catch(e){}})()`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminThemeScript }} />
        <script dangerouslySetInnerHTML={{ __html: userThemeScript }} />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
