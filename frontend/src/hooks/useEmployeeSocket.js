"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";

let employeeSocket = null;

// =====================================================
// GET EMPLOYEE SOCKET
// =====================================================

export function getEmployeeSocket() {
  if (
    employeeSocket &&
    employeeSocket.connected
  ) {
    return employeeSocket;
  }

  const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL;

  if (!SOCKET_URL) {
    console.error(
      "❌ NEXT_PUBLIC_SOCKET_URL is not defined"
    );

    return null;
  }

  if (!employeeSocket) {
    employeeSocket = io(SOCKET_URL, {
      withCredentials: true,

      transports: [
        "websocket",
        "polling",
      ],

      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
    });

    employeeSocket.on(
      "connect",
      () => {
      }
    );

    employeeSocket.on(
      "disconnect",
      (reason) => {
      }
    );

    employeeSocket.on(
      "connect_error",
      (error) => {
        console.error(
          "⚠️ Employee Socket Error:",
          error.message
        );
      }
    );
  }

  return employeeSocket;
}

// =====================================================
// SOCKET CALL
// =====================================================

function socketCall(
  emitEvent,
  responseEvent,
  data,
  timeoutMs = 8000
) {
  return new Promise(
    (resolve, reject) => {
      const socket =
        getEmployeeSocket();

      if (!socket) {
        reject(
          new Error(
            "Employee socket is not available"
          )
        );

        return;
      }

      let connectHandler = null;

      const handler = (response) => {
        cleanup();

        if (response?.success) {
          resolve(
            response.data
          );
        } else {
          reject(
            new Error(
              response?.message ||
                "Operation failed"
            )
          );
        }
      };

      const errorHandler = (error) => {
        cleanup();

        reject(
          new Error(
            error?.message ||
              "Socket error"
          )
        );
      };

      const cleanup = () => {
        clearTimeout(timer);

        socket.off(
          responseEvent,
          handler
        );

        socket.off(
          "error",
          errorHandler
        );

        if (connectHandler) {
          socket.off(
            "connect",
            connectHandler
          );
        }
      };

      const timer = setTimeout(() => {
        cleanup();

        reject(
          new Error(
            `Timeout: ${responseEvent}`
          )
        );
      }, timeoutMs);

      socket.on(
        responseEvent,
        handler
      );

      socket.on(
        "error",
        errorHandler
      );

      // -----------------------------------------------
      // ALREADY CONNECTED
      // -----------------------------------------------

      if (socket.connected) {
        socket.emit(
          emitEvent,
          data
        );
      }

      // -----------------------------------------------
      // WAIT FOR CONNECTION
      // -----------------------------------------------

      else {
        connectHandler = () => {
          socket.emit(
            emitEvent,
            data
          );
        };

        socket.once(
          "connect",
          connectHandler
        );
      }
    }
  );
}

// =====================================================
// EMPLOYEE SOCKET API
// =====================================================

export const employeeSocketApi = {
  // GET ALL
  getAll: () =>
    socketCall(
      "getEmployees",
      "employeesList"
    ),

  // GET BY ID
  getById: (id) =>
    socketCall(
      "getEmployeeById",
      "employeeDetails",
      {
        id,
      }
    ),

  // CREATE
  create: (data) =>
    socketCall(
      "createEmployee",
      "employeeCreated",
      data
    ),

  // UPDATE
  update: ({
    id,
    data,
  }) =>
    socketCall(
      "updateEmployee",
      "employeeUpdated",
      {
        id,
        ...data,
      }
    ),

  // DELETE
  delete: (id) =>
    socketCall(
      "deleteEmployee",
      "employeeDeleted",
      {
        id,
      }
    ),

  // TOGGLE STATUS
  toggleStatus: (id) =>
    socketCall(
      "toggleEmployeeStatus",
      "employeeStatusToggled",
      {
        id,
      }
    ),
};

// =====================================================
// UPDATE EMPLOYEE IN LIST
// =====================================================

function updateEmployeeInList(
  oldData,
  updatedEmployee
) {
  if (!oldData) {
    return oldData;
  }

  const employeeId =
    updatedEmployee?._id?.toString();

  if (!employeeId) {
    return oldData;
  }

  // ARRAY
  if (Array.isArray(oldData)) {
    return oldData.map(
      (employee) => {
        if (
          employee?._id?.toString() ===
          employeeId
        ) {
          return updatedEmployee;
        }

        return employee;
      }
    );
  }

  // { employees: [] }
  if (
    Array.isArray(
      oldData.employees
    )
  ) {
    return {
      ...oldData,

      employees:
        oldData.employees.map(
          (employee) => {
            if (
              employee?._id?.toString() ===
              employeeId
            ) {
              return updatedEmployee;
            }

            return employee;
          }
        ),
    };
  }

  // { data: [] }
  if (
    Array.isArray(
      oldData.data
    )
  ) {
    return {
      ...oldData,

      data:
        oldData.data.map(
          (employee) => {
            if (
              employee?._id?.toString() ===
              employeeId
            ) {
              return updatedEmployee;
            }

            return employee;
          }
        ),
    };
  }

  return oldData;
}

// =====================================================
// EMPLOYEE SOCKET SYNC
// =====================================================

export function useEmployeeSocketSync(
  employeeId = null
) {
  const queryClient =
    useQueryClient();

  // -----------------------------------------------
  // SELF ACTION REF
  // -----------------------------------------------

  const selfActionRef =
    useRef(null);

  // =================================================
  // MARK SELF ACTION
  // =================================================

  const markSelfAction = (
    action
  ) => {
    selfActionRef.current = action;


    // Automatically clear after 3 seconds
    setTimeout(() => {
      selfActionRef.current = null;
    }, 3000);
  };

  // =================================================
  // SOCKET EFFECT
  // =================================================

  useEffect(() => {
    const socket =
      getEmployeeSocket();

    if (!socket) {
      return;
    }

    const normalizedEmployeeId =
      employeeId
        ? employeeId.toString()
        : null;

    // =================================================
    // JOIN EMPLOYEE ROOM
    // =================================================

    const joinEmployeeRoom = () => {
      if (!normalizedEmployeeId) {
        return;
      }


      socket.emit(
        "join:employee",
        normalizedEmployeeId
      );
    };

    if (normalizedEmployeeId) {
      if (socket.connected) {
        joinEmployeeRoom();
      } else {
        socket.once(
          "connect",
          joinEmployeeRoom
        );
      }
    }

    // =================================================
    // INVALIDATE EMPLOYEES
    // =================================================

    const invalidateEmployees =
      () => {
        queryClient.invalidateQueries({
          queryKey: [
            "employees",
          ],
        });
      };

    // =================================================
    // EMPLOYEE CREATED
    // =================================================

    const handleEmployeeCreated =
      (result) => {

        invalidateEmployees();
      };

    // =================================================
    // EMPLOYEE DELETED
    // =================================================

    const handleEmployeeDeleted =
      (result) => {

        invalidateEmployees();

        if (
          normalizedEmployeeId
        ) {
          queryClient.removeQueries({
            queryKey: [
              "employee",
              normalizedEmployeeId,
            ],
          });
        }
      };

    // =================================================
    // EMPLOYEE STATUS TOGGLED
    // =================================================

    const handleEmployeeStatusToggled =
      (result) => {
        const data =
          result?.data ||
          result;


        if (!data?._id) {
          console.warn(
            "⚠️ Invalid employee status data"
          );

          invalidateEmployees();

          return;
        }

        const employeeKey =
          data._id.toString();

        // ---------------------------------------------
        // SINGLE EMPLOYEE CACHE
        // ---------------------------------------------

        queryClient.setQueryData(
          [
            "employee",
            employeeKey,
          ],
          data
        );

        // ---------------------------------------------
        // EMPLOYEE LIST CACHE
        // ---------------------------------------------

        queryClient.setQueryData(
          ["employees"],
          (oldData) =>
            updateEmployeeInList(
              oldData,
              data
            )
        );

        // ---------------------------------------------
        // CLEAR SELF ACTION
        // ---------------------------------------------

        if (
          selfActionRef.current ===
          "status"
        ) {

          selfActionRef.current =
            null;
        }
      };

    // =================================================
    // EMPLOYEE UPDATED
    // =================================================

    const handleEmployeeUpdated =
      (result) => {
        const data =
          result?.data ||
          result;


        if (!data?._id) {
          console.warn(
            "⚠️ Invalid employee update data"
          );

          invalidateEmployees();

          return;
        }

        const employeeKey =
          data._id.toString();

        // ---------------------------------------------
        // SINGLE EMPLOYEE
        // ---------------------------------------------

        queryClient.setQueryData(
          [
            "employee",
            employeeKey,
          ],
          data
        );

        // ---------------------------------------------
        // EMPLOYEE LIST
        // ---------------------------------------------

        queryClient.setQueryData(
          ["employees"],
          (oldData) =>
            updateEmployeeInList(
              oldData,
              data
            )
        );

        // ---------------------------------------------
        // CLEAR SELF ACTION
        // ---------------------------------------------

        if (
          selfActionRef.current ===
          "update"
        ) {

          selfActionRef.current =
            null;
        }
      };

    // =================================================
    // NEW ACTIVITY
    // =================================================

    const handleNewActivity =
      (result) => {
        const activity =
          result?.data ||
          result;

        if (!activity) {
          return;
        }


        if (
          normalizedEmployeeId
        ) {
          queryClient.setQueryData(
            [
              "employee",
              normalizedEmployeeId,
            ],
            (old) => {
              if (!old) {
                return old;
              }

              const existingActivities =
                Array.isArray(
                  old.activities
                )
                  ? old.activities
                  : [];

              const activityId =
                activity?._id?.toString();

              // Prevent duplicate
              if (
                activityId &&
                existingActivities.some(
                  (item) =>
                    item?._id?.toString() ===
                    activityId
                )
              ) {
                return old;
              }

              return {
                ...old,

                activities: [
                  activity,
                  ...existingActivities,
                ].slice(0, 100),
              };
            }
          );
        }

        invalidateEmployees();
      };

    // =================================================
    // OTHER ENTITY CHANGE
    // =================================================

    const handleEntityChange =
      (type) => {
        queryClient.invalidateQueries({
          queryKey: [type],
        });

        if (
          normalizedEmployeeId
        ) {
          queryClient.invalidateQueries({
            queryKey: [
              "employee",
              normalizedEmployeeId,
            ],
          });
        }
      };

    // =================================================
    // BRAND HANDLERS
    // =================================================

    const handleBrandCreated =
      () => {
        handleEntityChange(
          "brands"
        );
      };

    const handleBrandUpdated =
      () => {
        handleEntityChange(
          "brands"
        );
      };

    // =================================================
    // CATEGORY HANDLERS
    // =================================================

    const handleCategoryCreated =
      () => {
        handleEntityChange(
          "categories"
        );
      };

    const handleCategoryUpdated =
      () => {
        handleEntityChange(
          "categories"
        );
      };

    // =================================================
    // STORE HANDLER
    // =================================================

    const handleStoreUpdated =
      () => {
        handleEntityChange(
          "storeInfo"
        );
      };

    // =================================================
    // PRODUCT HANDLERS
    // =================================================

    const handleProductCreated =
      () => {
        handleEntityChange(
          "products"
        );
      };

    const handleProductUpdated =
      () => {
        handleEntityChange(
          "products"
        );
      };

    // =================================================
    // SOCKET LISTENERS
    // =================================================

    socket.on(
      "employeeCreated",
      handleEmployeeCreated
    );

    socket.on(
      "employeeDeleted",
      handleEmployeeDeleted
    );

    socket.on(
      "employeeStatusToggled",
      handleEmployeeStatusToggled
    );

    socket.on(
      "employeeUpdated",
      handleEmployeeUpdated
    );

    socket.on(
      "activity:new",
      handleNewActivity
    );

    // BRANDS
    socket.on(
      "brandCreated",
      handleBrandCreated
    );

    socket.on(
      "brandUpdated",
      handleBrandUpdated
    );

    // CATEGORIES
    socket.on(
      "categoryCreated",
      handleCategoryCreated
    );

    socket.on(
      "categoryUpdated",
      handleCategoryUpdated
    );

    // STORE
    socket.on(
      "storeUpdated",
      handleStoreUpdated
    );

    // PRODUCTS
    socket.on(
      "productCreated",
      handleProductCreated
    );

    socket.on(
      "productUpdated",
      handleProductUpdated
    );

    // =================================================
    // CLEANUP
    // =================================================

    return () => {
      socket.off(
        "employeeCreated",
        handleEmployeeCreated
      );

      socket.off(
        "employeeDeleted",
        handleEmployeeDeleted
      );

      socket.off(
        "employeeStatusToggled",
        handleEmployeeStatusToggled
      );

      socket.off(
        "employeeUpdated",
        handleEmployeeUpdated
      );

      socket.off(
        "activity:new",
        handleNewActivity
      );

      socket.off(
        "brandCreated",
        handleBrandCreated
      );

      socket.off(
        "brandUpdated",
        handleBrandUpdated
      );

      socket.off(
        "categoryCreated",
        handleCategoryCreated
      );

      socket.off(
        "categoryUpdated",
        handleCategoryUpdated
      );

      socket.off(
        "storeUpdated",
        handleStoreUpdated
      );

      socket.off(
        "productCreated",
        handleProductCreated
      );

      socket.off(
        "productUpdated",
        handleProductUpdated
      );

      socket.off(
        "connect",
        joinEmployeeRoom
      );

      // ---------------------------------------------
      // LEAVE ROOM
      // ---------------------------------------------

      if (
        normalizedEmployeeId &&
        socket.connected
      ) {

        socket.emit(
          "leave:employee",
          normalizedEmployeeId
        );
      }
    };
  }, [
    employeeId,
    queryClient,
  ]);

  // =================================================
  // RETURN
  // =================================================

  return {
    markSelfAction,
  };
}