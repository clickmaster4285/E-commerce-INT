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

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(!(location.pathname==="/admin"||location.pathname.indexOf("/admin/")===0))return;var m=document.cookie.match("(^|;)\\s*theme\\s*=\\s*([^;]+)");var t=m?decodeURIComponent(m[2]):"light";if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
