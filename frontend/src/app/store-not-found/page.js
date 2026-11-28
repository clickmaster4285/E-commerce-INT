// ==========================================================
// STORE NOT FOUND / PAGE NOT AVAILABLE
// ----------------------------------------------------------
// src/proxy.js yahan rewrite karta hai jab:
//   • subdomain ka koi store DB me nahi        → "Store not found"
//   • store host par platform-only page khola  → ?reason=page (super-admin, landing ...)
// ==========================================================
import { platformUrl } from "@/lib/tenantHost";

export const metadata = { title: "Not found" };

export default async function StoreNotFoundPage({ searchParams }) {
  const params = (await searchParams) || {};
  const isPage = params.reason === "page";

  const title = isPage ? "This page isn't available here" : "Store not found";
  const action = isPage ? { href: "/", label: "Go to store home" } : { href: platformUrl("/", "http:"), label: "Go to main site" };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-16 text-center">
      <div className="w-full max-w-md">
        <p className="text-[64px] font-extrabold leading-none text-[#f57224]">404</p>
        <h1 className="mt-4 text-[22px] font-extrabold text-white">{title}</h1>
        <a
          href={action.href}
          className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-[#f57224] px-6 text-[13px] font-bold text-white transition hover:brightness-110"
        >
          {action.label}
        </a>
      </div>
    </main>
  );
}
