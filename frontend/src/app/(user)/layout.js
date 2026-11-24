import UserLayoutClient from "./UserLayoutClient";
import { StoreThemeProvider } from "@/storefront/ThemeProvider";
import { getPublishedTheme } from "@/lib/serverStore";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Store editor ka published theme server par hi — CSS variables SSR me
// lagte hain (color flash nahi). Fail → null → purana default layout.
export default async function Layout({ children }) {
  const theme = await getPublishedTheme();
  return (
    <StoreThemeProvider initialTheme={theme}>
      <UserLayoutClient>{children}</UserLayoutClient>
    </StoreThemeProvider>
  );
}
