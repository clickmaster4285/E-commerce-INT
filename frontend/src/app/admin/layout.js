import { cookies } from "next/headers";
import AdminLayoutClient from "./AdminLayoutClient";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { LANG_COOKIE, normalizeLocale } from "@/i18n/config";
import { loadLocale, getDictionary } from "@/i18n/translations";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LANG_COOKIE)?.value);
  // Load only the admin's chosen language on the server and hand it to the
  // client provider, so the admin panel renders translated on first paint.
  // English is already bundled, so nothing extra is sent for "en".
  await loadLocale(locale);
  const initialMessages = locale === "en" ? null : getDictionary(locale);
  return (
    <LanguageProvider initialLocale={locale} initialMessages={initialMessages} legacyCookieName="adminLang">
      <div className="contents">
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </div>
    </LanguageProvider>
  );
}
