import UserLayoutClient from "./UserLayoutClient";
import { StoreThemeProvider } from "@/storefront/ThemeProvider";
import { getPublishedThemeData, getPublicStore, PUBLIC_ASSET_ORIGIN } from "@/lib/serverStore";

const assetUrl = (url) => {
  if (!url) return null;
  if (/^https?:/i.test(url)) return url;
  return PUBLIC_ASSET_ORIGIN ? `${PUBLIC_ASSET_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}` : null;
};

// Store SEO (Store Info page ke meta fields) + store editor favicon.
// title.template → custom pages "<page> | <store>" dikhate hain.
export async function generateMetadata() {
  const [store, { theme }] = await Promise.all([getPublicStore(), getPublishedThemeData()]);
  const storeName = store?.store_name || "";
  const title = store?.meta_title || storeName || "Store";
  const favicon = assetUrl(theme?.settings?.branding?.favicon) || assetUrl(store?.logo?.img_url);

  return {
    title: { default: title, template: storeName ? `%s | ${storeName}` : "%s" },
    description: store?.meta_description || store?.tagline || undefined,
    keywords: store?.meta_keywords || undefined,
    icons: favicon ? { icon: favicon, apple: favicon } : undefined,
    robots: {
      index: false,
      follow: false,
    },
  };
}

// Store editor ka published theme server par hi — CSS variables SSR me
// lagte hain (color flash nahi). Fail → null → purana default layout.
export default async function Layout({ children }) {
  const [{ theme, translations }, store] = await Promise.all([
    getPublishedThemeData(),
    getPublicStore(),
  ]);
  return (
    <StoreThemeProvider initialTheme={theme} translations={translations}>
      <UserLayoutClient initialStore={store}>{children}</UserLayoutClient>
    </StoreThemeProvider>
  );
}
