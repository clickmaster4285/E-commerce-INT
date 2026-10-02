import "./globals.css";
import "./user.css";
import Providers from "./providers";
import { Inter, Manrope } from "next/font/google";

// ✅ Self-hosted fonts (same families/weights as before, display:swap) —
// render-blocking Google <link> hata diya, look same.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-manrope",
});

export const metadata = {
  title: "Store",
  description: "Online Shopping Store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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