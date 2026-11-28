"use client";

import { useCallback, useState } from "react";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

/**
 * Store ka admin panel naye tab me kholo — backend ek one-time sign-in link deta hai
 * (/admin-handoff#token=…), is liye login page nahi aata.
 * Tab click ke waqt hi khulta hai (popup blocker), link aane par usi tab ko bhej dete hain.
 */
export default function useOpenStoreAdmin({ onError } = {}) {
  const [openingId, setOpeningId] = useState(null);

  const openStoreAdmin = useCallback(async (storeId) => {
    if (!storeId) return;
    const tab = window.open("about:blank", "_blank");
    setOpeningId(String(storeId));
    try {
      const res = await superAdminApi.openStoreAdmin(storeId);
      const url = res?.data?.url;
      if (!url) throw new Error("No sign-in link returned.");
      if (tab) tab.location.href = url;
      else window.location.href = url; // popup blocked → same tab
    } catch (err) {
      tab?.close();
      onError?.(err?.response?.data?.message || err?.message || "Could not open the store admin panel.");
    } finally {
      setOpeningId(null);
    }
  }, [onError]);

  return { openStoreAdmin, openingId };
}
