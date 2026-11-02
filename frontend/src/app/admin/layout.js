import { cookies } from "next/headers";
import AdminLayoutClient from "./AdminLayoutClient";
import { LanguageProvider } from "@/i18n/LanguageProvider";
import { LANG_COOKIE, normalizeLocale } from "@/i18n/config";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LANG_COOKIE)?.value);
  return (
    <LanguageProvider initialLocale={locale} legacyCookieName="adminLang">
      <div className="contents">
        <AdminLayoutClient>{children}</AdminLayoutClient>
      </div>
    </LanguageProvider>
  );
}
