import "./globals.css";
import "./user.css";
import Providers from "./providers";

export const metadata = {
  title: "Store",
  description: "Online Shopping Store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout: yeh link sab pages par globally load hota hai (rule Pages Router ke liye hai) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
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