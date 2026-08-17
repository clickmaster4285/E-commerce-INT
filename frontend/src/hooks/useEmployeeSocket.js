"use client";
import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";


let employeeSocket = null;

export function getEmployeeSocket() {
  if (employeeSocket && employeeSocket.connected) return employeeSocket;
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://192.168.88.64:5000";
  if (!employeeSocket) {
    employeeSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });
    employeeSocket.on("connect", () => console.log("🟢 Employee Socket Connected:", employeeSocket.id));
    employeeSocket.on("disconnect", () => console.log("🔴 Employee Socket Disconnected"));
    employeeSocket.on("connect_error", (err) => console.error("⚠️ Socket Error:", err.message));
  }
  return employeeSocket;
}

function socketCall(emitEvent, responseEvent, data, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = getEmployeeSocket();
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timeout: ${responseEvent}`)); }, timeoutMs);
    const handler = (response) => {
      cleanup();
      if (response?.success) resolve(response.data);
      else reject(new Error(response?.message || "Operation failed"));
    };
    const errorHandler = (err) => { cleanup(); reject(new Error(err?.message || "Socket error")); };
    const cleanup = () => {
      clearTimeout(timer);
      socket.off(responseEvent, handler);
      socket.off("error", errorHandler);
    };
    socket.on(responseEvent, handler);
    socket.on("error", errorHandler);
    if (socket.connected) socket.emit(emitEvent, data);
    else socket.once("connect", () => socket.emit(emitEvent, data));
  });
}

export const employeeSocketApi = {
  getAll: () => socketCall("getEmployees", "employeesList"),
  getById: (id) => socketCall("getEmployeeById", "employeeDetails", { id }),
  create: (data) => socketCall("createEmployee", "employeeCreated", data),
  update: ({ id, data }) => socketCall("updateEmployee", "employeeUpdated", { id, ...data }),
  delete: (id) => socketCall("deleteEmployee", "employeeDeleted", { id }),
  toggleStatus: (id) => socketCall("toggleEmployeeStatus", "employeeStatusToggled", { id }),
};

// ✅ GLOBAL: Track if any mutation is currently in progress
let isMutationInProgress = false;

export function startMutation() {
  isMutationInProgress = true;
  console.log("🔒 [Socket] Mutation started — ignoring socket updates");
}

export function endMutation() {
  // Delay ending slightly to ensure socket events from this mutation are ignored
  setTimeout(() => {
    isMutationInProgress = false;
    console.log("🔓 [Socket] Mutation ended — resuming socket updates");
  }, 1000);
}

export function useEmployeeSocketSync(employeeId = null) {
  const queryClient = useQueryClient();
  const isSelfAction = useRef(false);

  useEffect(() => {
    const socket = getEmployeeSocket();

    if (employeeId) {
      socket.emit("join:employee", employeeId);
    }

    const invalidate = () => {
      if (isSelfAction.current) return;
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    };

    socket.on("employeeCreated", () => invalidate());
    socket.on("employeeDeleted", () => invalidate());
    socket.on("employeeStatusToggled", () => invalidate());

    // ✅ FIX: Socket se aane wala update bhi cache mein set karo
const handleEmployeeUpdated = (result) => {
  const data = result?.data || result;

  if (!data?._id) return;

  // Ignore socket update for the employee currently being edited
  // while our own mutation is being processed.
  if (isMutationInProgress && employeeId === data._id.toString()) {
    console.log("⏭️ Ignoring own employee socket update during mutation");
    return;
  }

  // Update the exact employee cache.
  queryClient.setQueryData(["employee", data._id.toString()], data);

  // Update employees list as well.
  queryClient.invalidateQueries({
    queryKey: ["employees"],
  });
};
    socket.on("employeeUpdated", handleEmployeeUpdated);

    // ✅ Global Activities
    const handleNewActivity = (activity) => {
      if (!activity) return;
      console.log("📝 New Global Activity Received:", activity.action);

      if (employeeId) {
        queryClient.setQueryData(["employee", employeeId], (old) => {
          if (!old) return old;
          const existingActivities = Array.isArray(old.activities) ? old.activities : [];
          if (existingActivities.some((a) => a._id === activity._id)) return old;
          return {
            ...old,
            activities: [activity, ...existingActivities].slice(0, 100),
          };
        });
      }

      queryClient.invalidateQueries({ queryKey: ["employee"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    };

    socket.on("activity:new", handleNewActivity);

    const handleEntityChange = (type) => {
      queryClient.invalidateQueries({ queryKey: [type] });
      if (employeeId) {
        queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      }
    };

    socket.on("brandCreated", () => handleEntityChange("brands"));
    socket.on("brandUpdated", () => handleEntityChange("brands"));
    socket.on("categoryCreated", () => handleEntityChange("categories"));
    socket.on("categoryUpdated", () => handleEntityChange("categories"));
    socket.on("storeUpdated", () => handleEntityChange("storeInfo"));
    socket.on("productCreated", () => handleEntityChange("products"));
    socket.on("productUpdated", () => handleEntityChange("products"));

    return () => {
      socket.off("employeeCreated");
      socket.off("employeeUpdated", handleEmployeeUpdated);
      socket.off("employeeDeleted");
      socket.off("employeeStatusToggled");
      socket.off("activity:new", handleNewActivity);
      socket.off("brandCreated");
      socket.off("brandUpdated");
      socket.off("categoryCreated");
      socket.off("categoryUpdated");
      socket.off("storeUpdated");
      socket.off("productCreated");
      socket.off("productUpdated");
      if (employeeId) socket.emit("leave:employee", employeeId);
    };
  }, [employeeId, queryClient]);

 const markSelfAction = useCallback(() => {
  isSelfAction.current = true;
  startMutation();

  setTimeout(() => {
    isSelfAction.current = false;
    endMutation();
  }, 3000);
}, []);

  return { markSelfAction };
}