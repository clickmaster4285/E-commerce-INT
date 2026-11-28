import { cookies } from "next/headers";
import AdminLayoutClient from "./AdminLayoutClient";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { LANG_COOKIE, normalizeLocale } from "@/i18n/config";
import { loadLocale, loadAdminLocale, getDictionary } from "@/i18n/translations";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LANG_COOKIE)?.value);
  // Storefront dict + admin chunk (admin.* never ships on shopper routes).
  await loadLocale(locale);
  await loadAdminLocale(locale);
  const initialMessages = getDictionary(locale);
  return (
    <LanguageProvider initialLocale={locale} initialMessages={initialMessages} legacyCookieName="adminLang">
      <div className="contents">
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </div>
    </LanguageProvider>
  );
}
