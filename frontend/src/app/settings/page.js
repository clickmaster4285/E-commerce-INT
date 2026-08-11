// src/app/settings/page.jsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default async function SettingsPage() {
  const cookieStore = await cookies();
  // Backend ke cookie names - apne Express backend ke hisab se adjust karein
  const accessToken = cookieStore.get("accessToken")?.value 
                   || cookieStore.get("auth_token")?.value;

  if (!accessToken) redirect("/login");

  let user = null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
      headers: { Cookie: cookieStore.toString() }, // Forward all cookies
      cache: "no-store",
    });
    if (!res.ok) redirect("/login");
    const json = await res.json();
    user = json.user || json.data || json;
  } catch (err) {
    console.error("Failed to fetch user:", err.message);
    redirect("/login");
  }

  // Safe mapping - password hash kabhi client mat bhejo
  const safeData = {
    _id: user._id,
    name: user.name || "",
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    role: user.role || "Admin",
    status: user.status || "Active",
    avatar: user.avatar || user.avatarUrl || null,
    twoFactor: user.twoFactorEnabled || false,
    permissions: user.permissions || {
      products: true, brands: true, categories: true,
      users: false, orders: true, settings: true,
    },
    storeName: user.store?.name || "",
    storeEmail: user.store?.email || "",
    storePhone: user.store?.phone || "",
    website: user.store?.website || "",
    address: user.store?.address || "",
    darkMode: user.preferences?.darkMode ?? true,
    notifications: user.preferences?.notifications || { email: true, push: true, weekly: true },
    activityLog: user.activityLog || [],
  };

  return <ProfileClient initialData={safeData} />;
}