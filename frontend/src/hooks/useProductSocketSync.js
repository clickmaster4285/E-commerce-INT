"use client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "./useSocket";

// ✅ "all" / "" / undefined — koi status filter nahi
const hasNoStatusFilter = (value) => !value || value === "all";

/**
 * ✅ Product ka status (activate/deactivate) React Query cache me hi patch karta hai.
 *
 * KYUN: Purana flow har status change par poori list + stats dobara GET karta tha
 * (invalidateQueries(["products"])), aur backend ka `productUpdated` socket event
 * KHUD usi browser me aakar wahi invalidation dobara trigger kar deta tha — matlab
 * ek click par 6+ heavy queries (list + stats + brands + detail). Isi wajah se
 * activate/deactivate "bohot slow" lagta tha.
 *
 * AB: Sirf wahi rows/records badalte hain jinka status badla — koi network call nahi.
 * Query keys (products/page.js):
 *   list   → ["products","paginated", page, search, category, brand, status, pageSize]  → status @ index 6
 *   stats  → ["products","stats", search, category, brand, status]  → status @ index 5
 *   detail → ["product", id]
 */
export function patchProductStatusInCaches(
  queryClient,
  { productId, status, previousStatus, updatedAt }
) {
  if (!queryClient || !productId || !status) return;
  const pid = String(productId);
  const nextStatus = status === "inactive" ? "inactive" : "active";
  // Flip deterministic hai — purana status na pata ho to naye se infer karo
  const prevStatus =
    previousStatus === "active" || previousStatus === "inactive"
      ? previousStatus
      : nextStatus === "active"
        ? "inactive"
        : "active";

  // ⚠️ NOTE: react-query v5 (5.10x) ke `setQueriesData` updater ko sirf `oldData`
  //    milta hai — `query` (queryKey) UNDEFINED hota hai. Is liye yahan `getQueriesData`
  //    se [queryKey, data] pairs le kar per-key `setQueryData` kiya gaya hai, warna
  //    status-filter wali list galat patch hoti (row delete hi nahi hota).
  // 1) Saari paginated list queries (har page/filter combination)
  //    key: ["products","paginated", page, search, category, brand, status] → status @ 6
  let listNeedsRefetch = false;
  const listEntries = queryClient.getQueriesData({ queryKey: ["products", "paginated"] }) || [];

  for (const [queryKey, old] of listEntries) {
    if (!old || !Array.isArray(old.products)) continue;
    const index = old.products.findIndex((p) => String(p?._id) === pid);
    const statusFilter = queryKey?.[6];

    if (index === -1) {
      // Ab match karne wala product list me nahi tha (filtered view) → reload chahiye
      if (!hasNoStatusFilter(statusFilter) && statusFilter === nextStatus) {
        listNeedsRefetch = true;
      }
      continue;
    }

    // Status filter active hai aur ab match nahi karta → row hatao
    if (!hasNoStatusFilter(statusFilter) && statusFilter !== nextStatus) {
      const total = Number(old.pagination?.total);
      queryClient.setQueryData(queryKey, {
        ...old,
        products: old.products.filter((_, i) => i !== index),
        pagination: Number.isFinite(total)
          ? { ...old.pagination, total: Math.max(0, total - 1) }
          : old.pagination,
      });
      continue;
    }

    queryClient.setQueryData(queryKey, {
      ...old,
      products: old.products.map((p, i) =>
        i === index ? { ...p, status: nextStatus } : p
      ),
    });
  }

  // 2) Summary cards (stats) ke counts adjust karo
  //    key: ["products","stats", search, category, brand, status] → status @ 5
  const statsEntries = queryClient.getQueriesData({ queryKey: ["products", "stats"] }) || [];

  for (const [queryKey, old] of statsEntries) {
    if (!old) continue;
    // Filtered stats me product ka hissa pata nahi → chhodo (next refetch fix karega)
    if (!hasNoStatusFilter(queryKey?.[5])) continue;
    if (prevStatus === nextStatus) continue;
    const delta = nextStatus === "active" ? 1 : -1;
    queryClient.setQueryData(queryKey, {
      ...old,
      activeProducts: Math.max(0, Number(old.activeProducts || 0) + delta),
      inactiveProducts: Math.max(0, Number(old.inactiveProducts || 0) - delta),
    });
  }

  // 3) Detail page ka cached product
  const detailEntries = queryClient.getQueriesData({ queryKey: ["product", pid] }) || [];

  for (const [queryKey, old] of detailEntries) {
    if (!old || String(old._id) !== pid) continue;
    queryClient.setQueryData(queryKey, {
      ...old,
      status: nextStatus,
      ...(updatedAt ? { updated_at: updatedAt } : {}),
    });
  }

  // Rare edge: filtered list me naya row chahiye — sirf tabhi (aur async) refetch
  if (listNeedsRefetch) {
    queryClient.invalidateQueries({ queryKey: ["products", "paginated"] });
  }
}


export function useProductSocketSync() {
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    // ✅ Helper: Invalidate all related queries at once
    function invalidateAll() {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      // ✅ Detail page queries ["product", id] — PREFIX invalidation se saari
      // ids match hoti hain, is liye detail page har socket update pe fresh
      // ho jata hai (socket _id vs URL id ke mismatch ka chance hi khatam).
      queryClient.invalidateQueries({ queryKey: ["product"] });
    }

    const handleCreated = (data) => {
      invalidateAll();
    };

    const handleUpdated = (data) => {
      // ✅ Activate/deactivate: status-only update → cache me targeted patch.
      //    Ye SAME browser me bhi aata hai (own action ka echo), is liye pehle
      //    har click par full refetch hota tha aur UI "slow" lagti thi.
      const productId = data?._id || data?.product?._id || data?.id;
      if (data?.statusOnly && productId) {
        patchProductStatusInCaches(queryClient, {
          productId,
          status: data.status,
          previousStatus: data.previousStatus,
          updatedAt: data.updated_at,
        });
        return;
      }

      invalidateAll();
      // Individual product query bhi invalidate karein
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["product", productId] });
      }
    };

    const handleDeleted = (data) => {
      invalidateAll();
      // Deleted product ki individual query remove karein
      const productId = typeof data === "string" ? data : (data?.id || data?._id);
      if (productId) {
        queryClient.removeQueries({ queryKey: ["product", productId] });
      }
    };

    socket.on("productCreated", handleCreated);
    socket.on("productUpdated", handleUpdated);
    socket.on("productDeleted", handleDeleted);


    return () => {
      socket.off("productCreated", handleCreated);
      socket.off("productUpdated", handleUpdated);
      socket.off("productDeleted", handleDeleted);
    };
  }, [socket, isConnected, queryClient]);

  return { isConnected };
}