"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

/* ==========================================================
   ADMIN SOCKET — poore admin panel ke liye.
   ------------------------------------------------------------
   Isme do cheezein merge hain jo pehle alag thin:
     1. Shared connection — dashboard / profile / store-info / products
        pehle `useSocket` (storefront wala) use kar rahe the
     2. Employee socket — sirf employee CRUD ke liye tha

   Storefront ke liye alag socket: `hooks/user/useUserSocket.js`.

   URL + options env se aati hain — koi host/IP/port hard-coded nahi.
   Ye wahi config hai jo `hooks/user/useUserSocket.js` me hai; dono files
   alag rakhne ka faisla aapka tha (extra config file nahi chahiye thi).
   Idle-connect yahan NAHI lagta — admin me realtime latency matter karti
   hai, is liye transport seedha khulta hai.
   ========================================================== */

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Backend ka origin — sirf env se, koi guess/fallback host nahi. */
const getSocketOrigin = () => {
  const explicit = (process.env.NEXT_PUBLIC_SOCKET_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const serverUrl = (process.env.NEXT_PUBLIC_SERVERURL || "").trim();
  if (serverUrl) return serverUrl.replace(/\/+$/, "").replace(/\/api\/?$/, "");

  return "";
};

/**
 * Client par socket URL.
 *
 * Auth cookie `httpOnly` + `sameSite=lax` hai — agar socket ka host page
 * ke host se alag ho to cookie nahi jaati, socket "guest" reh jata hai aur
 * role-gated events `Unauthorized` dete hain. Is liye env URL tabhi use
 * hoti hai jab uska hostname page ke hostname se match kare.
 */
const getSocketUrl = () => {
  const origin = getSocketOrigin();

  // SSR — sirf env, koi hard-coded fallback nahi
  if (typeof window === "undefined") return origin || null;

  if (origin) {
    try {
      if (new URL(origin).hostname === window.location.hostname) return origin;
    } catch {
      // env URL malformed → neeche dynamic path
    }
  }

  const port = process.env.NEXT_PUBLIC_SERVER_PORT;
  if (!port) return null;

  // Protocol page wala — hardcoded `http://` HTTPS par mixed-content block karta hai
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
};

const SOCKET_OPTIONS = {
  withCredentials: true,
  transports: (process.env.NEXT_PUBLIC_SOCKET_TRANSPORTS || "websocket,polling")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean),
  reconnection: true,
  reconnectionAttempts: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_ATTEMPTS, 5),
  reconnectionDelay: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_DELAY, 1500),
  reconnectionDelayMax: num(process.env.NEXT_PUBLIC_SOCKET_RECONNECT_DELAY_MAX, 4000),
  timeout: num(process.env.NEXT_PUBLIC_SOCKET_TIMEOUT, 15000),
};

/** emit→response calls ka default timeout */
const SOCKET_CALL_TIMEOUT = num(
  process.env.NEXT_PUBLIC_SOCKET_CALL_TIMEOUT,
  8000,
);

/* ==========================================================
   CONNECTION (singleton)
   ========================================================== */
let adminSocket = null;

/**
 * Socket ko poora phenk do. `removeAllListeners()` explicit hai — pehle
 * `off("connect")` / `off("disconnect")` se SAARE listeners hat jate the,
 * jinme components ke apne handlers bhi the.
 */
function disposeSocket() {
  if (!adminSocket) return;
  try {
    adminSocket.removeAllListeners();
  } catch {
    // ignore
  }
  try {
    adminSocket.disconnect();
  } catch {
    // ignore
  }
  adminSocket = null;
}

export function getAdminSocket() {
  // `.active` = connected YA connecting. Sirf `connected` check karne se
  // "connecting" window me socket beech me replace ho jata tha aur handlers
  // ud jate the.
  if (adminSocket && adminSocket.active) return adminSocket;

  const socketUrl = getSocketUrl();
  if (!socketUrl) return null;

  if (!adminSocket) {
    try {
      adminSocket = io(socketUrl, SOCKET_OPTIONS);
    } catch {
      return null;
    }

    adminSocket.on("connect", () => {});
    adminSocket.on("disconnect", () => {});
    adminSocket.on("connect_error", () => {
      // Silent — reconnection waise hi chalegi
    });
  }

  return adminSocket;
}

export function reconnectAdminSocket() {
  disposeSocket();
  return getAdminSocket();
}

export function useAdminSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const s = getAdminSocket();

    if (!s) {
      setConnected(false);
      return () => {};
    }

    socketRef.current = s;
    setConnected(s.connected);

    const onConnect = () => {
      if (isMounted.current) setConnected(true);
    };
    const onDisconnect = () => {
      if (isMounted.current) setConnected(false);
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    if (s.connected) setConnected(true);

    return () => {
      isMounted.current = false;
      try {
        s.off("connect", onConnect);
        s.off("disconnect", onDisconnect);
      } catch {
        // ignore
      }
    };
  }, []);

  return { socket: socketRef.current, isConnected: connected };
}

/* ==========================================================
   SOCKET CALL — emit + response/ack, timeout ke saath
   ========================================================== */
export function socketCall(
  emitEvent,
  responseEvent,
  data,
  timeoutMs = SOCKET_CALL_TIMEOUT,
) {
  return new Promise((resolve, reject) => {
    const socket = getAdminSocket();

    if (!socket) {
      reject(new Error("Admin socket is not available"));
      return;
    }

    let connectHandler = null;

    const cleanup = () => {
      clearTimeout(timer);
      socket.off(responseEvent, handler);
      socket.off("error", errorHandler);
      if (connectHandler) socket.off("connect", connectHandler);
    };

    const handler = (response) => {
      cleanup();
      if (response?.success) {
        resolve(response.data);
      } else {
        reject(new Error(response?.message || "Operation failed"));
      }
    };

    const errorHandler = (error) => {
      cleanup();
      reject(new Error(error?.message || "Socket error"));
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout: ${responseEvent}`));
    }, timeoutMs);

    socket.on(responseEvent, handler);
    socket.on("error", errorHandler);

    if (socket.connected) {
      socket.emit(emitEvent, data);
    } else {
      connectHandler = () => socket.emit(emitEvent, data);
      socket.once("connect", connectHandler);
    }
  });
}

/* ==========================================================
   EMPLOYEE SOCKET API
   ========================================================== */
export const employeeSocketApi = {
  getAll: () => socketCall("getEmployees", "employeesList"),
  getById: (id) => socketCall("getEmployeeById", "employeeDetails", { id }),
  create: (data) => socketCall("createEmployee", "employeeCreated", data),
  update: ({ id, data }) =>
    socketCall("updateEmployee", "employeeUpdated", { id, ...data }),
  delete: (id) => socketCall("deleteEmployee", "employeeDeleted", { id }),
  toggleStatus: (id) =>
    socketCall("toggleEmployeeStatus", "employeeStatusToggled", { id }),
};

/* ==========================================================
   UPDATE EMPLOYEE IN LIST (array | {employees:[]} | {data:[]})
   ========================================================== */
function updateEmployeeInList(oldData, updatedEmployee) {
  if (!oldData) return oldData;

  const employeeId = updatedEmployee?._id?.toString();
  if (!employeeId) return oldData;

  const replace = (employee) =>
    employee?._id?.toString() === employeeId ? updatedEmployee : employee;

  if (Array.isArray(oldData)) return oldData.map(replace);
  if (Array.isArray(oldData.employees)) {
    return { ...oldData, employees: oldData.employees.map(replace) };
  }
  if (Array.isArray(oldData.data)) {
    return { ...oldData, data: oldData.data.map(replace) };
  }

  return oldData;
}

/* ==========================================================
   EMPLOYEE SOCKET SYNC
   ========================================================== */
export function useEmployeeSocketSync(employeeId = null) {
  const queryClient = useQueryClient();
  const selfActionRef = useRef(null);

  const markSelfAction = (action) => {
    selfActionRef.current = action;
    // Apne aap clear — stale flag na rahe
    setTimeout(() => {
      selfActionRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    const socket = getAdminSocket();
    if (!socket) return;

    const normalizedEmployeeId = employeeId ? employeeId.toString() : null;

    // ---- JOIN EMPLOYEE ROOM ----
    const joinEmployeeRoom = () => {
      if (!normalizedEmployeeId) return;
      socket.emit("join:employee", normalizedEmployeeId);
    };

    if (normalizedEmployeeId) {
      if (socket.connected) {
        joinEmployeeRoom();
      } else {
        socket.once("connect", joinEmployeeRoom);
      }
    }

    // ---- CACHE HELPERS ----
    const invalidateEmployees = () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    };

    const handleEntityChange = (type) => {
      queryClient.invalidateQueries({ queryKey: [type] });
      if (normalizedEmployeeId) {
        queryClient.invalidateQueries({
          queryKey: ["employee", normalizedEmployeeId],
        });
      }
    };

    // ---- EMPLOYEE CREATED / DELETED ----
    const handleEmployeeCreated = () => invalidateEmployees();

    const handleEmployeeDeleted = () => {
      invalidateEmployees();
      if (normalizedEmployeeId) {
        queryClient.removeQueries({
          queryKey: ["employee", normalizedEmployeeId],
        });
      }
    };

    // ---- EMPLOYEE STATUS TOGGLED ----
    const handleEmployeeStatusToggled = (result) => {
      const data = result?.data || result;

      if (!data?._id) {
        invalidateEmployees();
        return;
      }

      const employeeKey = data._id.toString();

      queryClient.setQueryData(["employee", employeeKey], data);
      queryClient.setQueryData(["employees"], (oldData) =>
        updateEmployeeInList(oldData, data),
      );

      if (selfActionRef.current === "status") selfActionRef.current = null;
    };

    // ---- EMPLOYEE UPDATED ----
    const handleEmployeeUpdated = (result) => {
      const data = result?.data || result;

      if (!data?._id) {
        invalidateEmployees();
        return;
      }

      const employeeKey = data._id.toString();

      queryClient.setQueryData(["employee", employeeKey], data);
      queryClient.setQueryData(["employees"], (oldData) =>
        updateEmployeeInList(oldData, data),
      );

      if (selfActionRef.current === "update") selfActionRef.current = null;
    };

    // ---- NEW ACTIVITY ----
    const handleNewActivity = (result) => {
      const activity = result?.data || result;
      if (!activity) return;

      if (normalizedEmployeeId) {
        queryClient.setQueryData(
          ["employee", normalizedEmployeeId],
          (old) => {
            if (!old) return old;

            const existingActivities = Array.isArray(old.activities)
              ? old.activities
              : [];
            const activityId = activity?._id?.toString();

            // Duplicate mat push karo
            if (
              activityId &&
              existingActivities.some(
                (item) => item?._id?.toString() === activityId,
              )
            ) {
              return old;
            }

            return {
              ...old,
              activities: [activity, ...existingActivities].slice(0, 100),
            };
          },
        );
      }

      invalidateEmployees();
    };

    // ---- LISTENERS ----
    const listeners = {
      employeeCreated: handleEmployeeCreated,
      employeeDeleted: handleEmployeeDeleted,
      employeeStatusToggled: handleEmployeeStatusToggled,
      employeeUpdated: handleEmployeeUpdated,
      "activity:new": handleNewActivity,
      brandCreated: () => handleEntityChange("brands"),
      brandUpdated: () => handleEntityChange("brands"),
      categoryCreated: () => handleEntityChange("categories"),
      categoryUpdated: () => handleEntityChange("categories"),
      storeUpdated: () => handleEntityChange("storeInfo"),
      productCreated: () => handleEntityChange("products"),
      productUpdated: () => handleEntityChange("products"),
    };

    Object.entries(listeners).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // ---- CLEANUP ----
    return () => {
      Object.entries(listeners).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
      socket.off("connect", joinEmployeeRoom);

      if (normalizedEmployeeId && socket.connected) {
        socket.emit("leave:employee", normalizedEmployeeId);
      }
    };
  }, [employeeId, queryClient]);

  return { markSelfAction };
}
