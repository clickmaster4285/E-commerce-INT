import "./globals.css";
import "./user.css";
import Providers from "./providers";

export const metadata = {
  title: "Inventory App",
  description: "Inventory Management System",
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