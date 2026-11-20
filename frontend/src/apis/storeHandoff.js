// ==========================================================
// STORE HANDOFF — platform par login ke baad seller ko uske store
// subdomain ke admin panel me bhejo (cookies host-only hain, is liye
// backend ek one-time sign-in link deta hai: /admin-handoff#token=...)
// ==========================================================
import axiosInstance from "@/apis/axiosInstance";
import { getCurrentTenant } from "@/lib/tenantHost";

/** Platform host par hain? (store subdomain par handoff ki zaroorat nahi) */
export const isPlatformHost = () => getCurrentTenant().type === "platform";

/**
 * Logged-in employee ke store admin ka one-time sign-in URL.
 * @returns {Promise<string|null>} URL, ya null agar store/subdomain nahi mila
 */
export async function getStoreAdminUrl() {
  try {
    const { data } = await axiosInstance.post("/users/admin/handoff");
    return data?.data?.url || null;
  } catch {
    return null;
  }
}
