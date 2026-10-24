"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import adminHttp from "@/apis/axiosInstance";

export default function UnknownAdminRoute() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    adminHttp
      .get("/users/profile", { timeout: 10000 })
      .then((response) => {
        const user =
          response.data?.user ||
          response.data?.data?.user ||
          response.data?.data ||
          response.data;
        const permissions = user?.permissions;
        const isAdmin = user?.role?.toLowerCase() === "admin";
        const hasDashboardAccess =
          isAdmin ||
          (permissions &&
            typeof permissions === "object" &&
            Object.values(permissions).some((value) => value === true) &&
            permissions.dashboard !== false);

        if (active) {
          router.replace(hasDashboardAccess ? "/admin/dashboard" : "/admin/login");
        }
      })
      .catch(() => {
        if (active) router.replace("/admin/login");
      });

    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
