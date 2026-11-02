"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isAdminPath = pathname === "/admin" || pathname?.startsWith("/admin/");
    router.replace(isAdminPath ? "/admin/dashboard" : "/");
  }, [pathname, router]);

  return null;
}
