import "./globals.css";
import "./user.css";
import Providers from "./providers";

export const metadata = {
  title: "Store",
  description: "Online Shopping Store",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}