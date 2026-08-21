"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { discountApi } from "../../../../apis/discountApi";
import { useSocket } from "@/hooks/useSocket";

/* =========================================================
   ICON
========================================================= */

function Ico({ d, className = "w-4 h-4", sw = 2 }) {
  return React.createElement(
    "svg",
    {
      className,
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
    },
    React.createElement("path", {
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: sw,
      d,
    })
  );
}

/* =========================================================
   ICONS
========================================================= */

const D = {
  chevron: "M9 5l7 7-7 7",

  percent:
    "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",

  plus:
    "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",

  edit:
    "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
};

/* =========================================================
   LOADER
========================================================= */

function Spin({ className = "w-4 h-4" }) {
  return React.createElement(
    "svg",
    {
      className: className + " animate-spin",
      fill: "none",
      viewBox: "0 0 24 24",
    },
    React.createElement("circle", {
      className: "opacity-25",
      cx: 12,
      cy: 12,
      r: 10,
      stroke: "currentColor",
      strokeWidth: 4,
    }),
    React.createElement("path", {
      className: "opacity-75",
      fill: "currentColor",
      d: "M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z",
    })
  );
}

/* =========================================================
   HELPERS
========================================================= */

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTarget(value) {
  if (!value) return "—";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
}

/* =========================================================
   STATUS
========================================================= */

function StatusPill({ active }) {
  const color = active ? "#34d399" : "#f87171";

  return React.createElement(
    "span",
    {
      className:
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium",
      style: {
        backgroundColor: active
          ? "rgba(16,185,129,0.08)"
          : "rgba(239,68,68,0.08)",
        color,
      },
    },

    React.createElement("span", {
      className: "w-1.5 h-1.5 rounded-full",
      style: {
        backgroundColor: color,
      },
    }),

    active ? "Active" : "Inactive"
  );
}

/* =========================================================
   INFO ROW
========================================================= */

function InfoRow({
  label,
  value,
  green = false,
  mono = false,
}) {
  return React.createElement(
    "div",
    {
      className:
        "flex items-center justify-between gap-4 py-3",
      style: {
        borderBottom:
          "1px solid var(--border-color)",
      },
    },

    React.createElement(
      "span",
      {
        className: "text-[12px]",
        style: {
          color: "var(--text-muted)",
        },
      },
      label
    ),

    React.createElement(
      "span",
      {
        className:
          "text-[12px] text-right break-words " +
          (mono ? "font-mono" : "font-medium"),
        style: {
          color: green
            ? "#34d399"
            : "var(--text-primary)",
        },
      },
      value || "—"
    )
  );
}

/* =========================================================
   CARD
========================================================= */

function Card({ children, className = "" }) {
  return React.createElement(
    "div",
    {
      className:
        "rounded-xl p-4 sm:p-5 " +
        className,
      style: {
        backgroundColor: "var(--bg-card)",
        border:
          "1px solid var(--border-color)",
        borderRadius: "12px",
      },
    },
    children
  );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SecTitle({ children }) {
  return React.createElement(
    "div",
    {
      className:
        "text-[11px] font-semibold uppercase tracking-wide mb-3 pb-2.5",
      style: {
        color: "var(--text-muted)",
        borderBottom:
          "1px solid var(--border-color)",
      },
    },
    children
  );
}

/* =========================================================
   ACTIVITY ICON
========================================================= */

function ActivityIcon({ type }) {
  return React.createElement(
    "div",
    {
      className:
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
      style: {
        backgroundColor:
          "var(--bg-tertiary)",
        border:
          "1px solid var(--border-color)",
        color:
          "var(--text-secondary)",
      },
    },

    React.createElement(Ico, {
      d:
        type === "created"
          ? D.plus
          : D.edit,

      className: "w-4 h-4",
      sw: 1.7,
    })
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function DiscountDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();

  const discountId = params?.id;

  const backPath =
    pathname.substring(
      0,
      pathname.lastIndexOf("/")
    ) || "/admin/discounts";

  const [tab, setTab] = useState("info");

  const [activities, setActivities] =
    useState([]);

  const {
    socket,
    isConnected,
  } = useSocket();

  /* =======================================================
     DISCOUNT QUERY
  ======================================================= */

  const discountQuery = useQuery({
    queryKey: ["discounts"],
    queryFn: discountApi.getAll,
    staleTime: 0,
  });

  const discounts =
    discountQuery.data || [];

  const discount =
    discounts.find(function (item) {
      return (
        String(item?._id || item?.id) ===
        String(discountId)
      );
    });

  /* =======================================================
     INITIAL CREATE / UPDATE ACTIVITY
  ======================================================= */

  useEffect(
    function () {
      if (!discount) return;

      const list = [];

      /*
       * CREATED
       */

      if (discount.created_at) {
        list.push({
          id:
            "created-" +
            String(
              discount._id ||
                discount.id
            ),

          type: "created",

          title: "Discount Created",

          date: discount.created_at,

          realtime: false,
        });
      }

      /*
       * UPDATED
       */

      if (
        discount.updated_at &&
        discount.created_at &&
        new Date(
          discount.updated_at
        ).getTime() >
          new Date(
            discount.created_at
          ).getTime()
      ) {
        list.push({
          id:
            "updated-" +
            String(
              discount._id ||
                discount.id
            ),

          type: "updated",

          title: "Discount Updated",

          date: discount.updated_at,

          realtime: false,
        });
      }

      /*
       * Latest activity first
       */

      list.sort(function (a, b) {
        return (
          new Date(b.date).getTime() -
          new Date(a.date).getTime()
        );
      });

      setActivities(list);
    },
    [discount]
  );

  /* =======================================================
     REAL-TIME SOCKET
     
     ONLY:
     discountCreated
     discountUpdated
  ======================================================= */

  useEffect(
    function () {
      if (
        !socket ||
        !isConnected ||
        !discountId
      ) {
        return;
      }

      /* -----------------------------------------------
         GET ID FROM SOCKET DATA
      ------------------------------------------------ */

      function getId(data) {
        if (!data) return null;

        if (data.discount) {
          return (
            data.discount._id ||
            data.discount.id
          );
        }

        if (data.data) {
          return (
            data.data._id ||
            data.data.id
          );
        }

        return (
          data._id ||
          data.id ||
          data.discountId ||
          data.discount_id
        );
      }

      /* -----------------------------------------------
         CREATED
      ------------------------------------------------ */

      function handleCreated(data) {
        const eventId = getId(data);

        if (
          eventId &&
          String(eventId) !==
            String(discountId)
        ) {
          return;
        }

        const now =
          new Date().toISOString();

        setActivities(function (
          previous
        ) {
          return [
            {
              id:
                "socket-created-" +
                Date.now(),

              type: "created",

              title:
                "Discount Created",

              date: now,

              realtime: true,
            },
          ].concat(previous);
        });

        queryClient.invalidateQueries({
          queryKey: ["discounts"],
        });
      }

      /* -----------------------------------------------
         UPDATED
      ------------------------------------------------ */

      function handleUpdated(data) {
        const eventId = getId(data);

        if (
          eventId &&
          String(eventId) !==
            String(discountId)
        ) {
          return;
        }

        const now =
          new Date().toISOString();

        setActivities(function (
          previous
        ) {
          return [
            {
              id:
                "socket-updated-" +
                Date.now(),

              type: "updated",

              title:
                "Discount Updated",

              date: now,

              realtime: true,
            },
          ].concat(previous);
        });

        queryClient.invalidateQueries({
          queryKey: ["discounts"],
        });
      }

      /* -----------------------------------------------
         SOCKET EVENTS
      ------------------------------------------------ */

      socket.on(
        "discountCreated",
        handleCreated
      );

      socket.on(
        "discountUpdated",
        handleUpdated
      );

      /* -----------------------------------------------
         CLEANUP
      ------------------------------------------------ */

      return function () {
        socket.off(
          "discountCreated",
          handleCreated
        );

        socket.off(
          "discountUpdated",
          handleUpdated
        );
      };
    },
    [
      socket,
      isConnected,
      discountId,
      queryClient,
    ]
  );

  /* =======================================================
     LOADING
  ======================================================= */

  if (discountQuery.isLoading) {
    return React.createElement(
      "div",
      {
        className:
          "w-full flex items-center justify-center py-24",
      },

      React.createElement(
        "div",
        {
          className:
            "rounded-xl py-14 px-20 flex items-center gap-2",
          style: {
            backgroundColor:
              "var(--bg-card)",
            border:
              "1px solid var(--border-color)",
            color:
              "var(--text-primary)",
          },
        },

        React.createElement(Spin, {
          className: "w-4 h-4",
        }),

        React.createElement(
          "span",
          {
            className: "text-[13px]",
            style: {
              color:
                "var(--text-muted)",
            },
          },
          "Loading..."
        )
      )
    );
  }

  /* =======================================================
     NOT FOUND
  ======================================================= */

  if (!discount) {
    return React.createElement(
      "div",
      {
        className:
          "w-full flex items-center justify-center py-24",
      },

      React.createElement(
        "div",
        {
          className:
            "rounded-xl py-14 px-8 flex flex-col items-center gap-3 text-center",
          style: {
            backgroundColor:
              "var(--bg-card)",
            border:
              "1px solid var(--border-color)",
          },
        },

        React.createElement(
          "p",
          {
            className:
              "text-base font-semibold",
          },
          "Discount Not Found"
        ),

        React.createElement(
          "p",
          {
            className: "text-[12px]",
            style: {
              color:
                "var(--text-muted)",
            },
          },
          "This discount does not exist."
        ),

        React.createElement(
          "button",
          {
            type: "button",

            onClick: function () {
              router.push(backPath);
            },

            className:
              "h-8 px-3 rounded-md text-[12px] font-medium",

            style: {
              backgroundColor:
                "var(--accent)",
              color:
                "var(--accent-text)",
            },
          },
          "Back to Discounts"
        )
      )
    );
  }

  /* =======================================================
     STATUS
  ======================================================= */

  const isActive =
    discount.status === "active" ||
    discount.isActive === true;

  /* =======================================================
     PAGE
  ======================================================= */

  return React.createElement(
    "div",
    {
      className: "w-full",
      style: {
        color:
          "var(--text-primary)",
      },
    },

    React.createElement(
      "div",
      {
        className:
          "w-full max-w-6xl mx-auto space-y-4",
      },

      /* ===================================================
         HEADER
      =================================================== */

      React.createElement(
        "div",
        {
          className: "px-1",
        },

        React.createElement(
          "div",
          {
            className:
              "flex items-center gap-1.5 mb-3",
          },

          React.createElement(
            "button",
            {
              type: "button",

              onClick: function () {
                router.push(
                  backPath
                );
              },

              className:
                "text-[12px] font-medium transition hover:opacity-70",

              style: {
                color:
                  "var(--text-muted)",
                background:
                  "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              },
            },
            "Discounts"
          ),

          React.createElement(Ico, {
            d: D.chevron,
            className:
              "w-3 h-3",
            sw: 1.5,
          }),

          React.createElement(
            "span",
            {
              className:
                "text-[12px] font-medium truncate",
              style: {
                color:
                  "var(--text-primary)",
              },
            },
            discount.name
          )
        ),

        React.createElement(
          "div",
          {
            className:
              "flex items-start gap-3",
          },

          React.createElement(
            "div",
            {
              className:
                "w-11 h-11 rounded-lg flex items-center justify-center shrink-0",

              style: {
                backgroundColor:
                  "var(--bg-card)",

                border:
                  "1px solid var(--border-color)",
              },
            },

            React.createElement(Ico, {
              d: D.percent,
              className:
                "w-5 h-5",
              sw: 1.5,
            })
          ),

          React.createElement(
            "div",
            {
              className:
                "flex-1 min-w-0",
            },

            React.createElement(
              "h1",
              {
                className:
                  "text-[17px] font-semibold truncate",
              },
              discount.name
            ),

            React.createElement(
              "div",
              {
                className:
                  "flex flex-wrap items-center gap-2 mt-1",

                style: {
                  color:
                    "var(--text-muted)",
                },
              },

              React.createElement(
                "span",
                {
                  className:
                    "text-[11px] font-mono",
                },
                discount.code ||
                  "No Code"
              ),

              React.createElement(
                "span",
                {
                  className:
                    "text-[11px]",
                },
                "·"
              ),

              React.createElement(
                "span",
                {
                  className:
                    "text-[11px]",
                },
                discount.type ===
                "percentage"
                  ? String(
                      discount.value
                    ) + "%"
                  : "PKR " +
                    String(
                      discount.value
                    )
              )
            )
          ),

          React.createElement(
            "div",
            {
              className:
                "pt-1",
            },
            React.createElement(
              StatusPill,
              {
                active:
                  isActive,
              }
            )
          )
        )
      ),

      /* ===================================================
         CONTENT CARD
      =================================================== */

      React.createElement(
        "div",
        {
          className:
            "rounded-xl overflow-hidden",

          style: {
            backgroundColor:
              "var(--bg-card)",

            border:
              "1px solid var(--border-color)",
          },
        },

        /* =================================================
           TABS
        ================================================= */

        React.createElement(
          "div",
          {
            className:
              "px-4 sm:px-5 flex items-center gap-5",

            style: {
              borderBottom:
                "1px solid var(--border-color)",
            },
          },

          /* DISCOUNT INFORMATION */

          React.createElement(
            "button",
            {
              type: "button",

              onClick:
                function () {
                  setTab(
                    "info"
                  );
                },

              className:
                "text-[12px] font-medium py-3 border-b-2",

              style: {
                background:
                  "none",

                borderLeft:
                  "none",

                borderRight:
                  "none",

                borderTop:
                  "none",

                cursor:
                  "pointer",

                color:
                  tab === "info"
                    ? "#34d399"
                    : "var(--text-muted)",

                borderBottomColor:
                  tab === "info"
                    ? "#34d399"
                    : "transparent",
              },
            },
            "Discount Information"
          ),

          /* ACTIVITY */

          React.createElement(
            "button",
            {
              type: "button",

              onClick:
                function () {
                  setTab(
                    "activity"
                  );
                },

              className:
                "text-[12px] font-medium py-3 border-b-2",

              style: {
                background:
                  "none",

                borderLeft:
                  "none",

                borderRight:
                  "none",

                borderTop:
                  "none",

                cursor:
                  "pointer",

                color:
                  tab === "activity"
                    ? "#34d399"
                    : "var(--text-muted)",

                borderBottomColor:
                  tab === "activity"
                    ? "#34d399"
                    : "transparent",
              },
            },
            "Activity"
          )
        ),

        /* =================================================
           CONTENT
        ================================================= */

        React.createElement(
          "div",
          {
            className:
              "p-4 sm:p-5",
          },

          /* =================================================
             DISCOUNT INFORMATION
          ================================================= */

          tab === "info"
            ? React.createElement(
                "div",
                {
                  className:
                    "grid grid-cols-1 md:grid-cols-2 gap-4",
                },

                /* DETAILS */

                React.createElement(
                  Card,
                  null,

                  React.createElement(
                    SecTitle,
                    null,
                    "Discount Information"
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label: "Name",
                      value:
                        discount.name,
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label: "Code",
                      value:
                        discount.code,
                      mono: true,
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label: "Type",
                      value:
                        discount.type ===
                        "percentage"
                          ? "Percentage"
                          : "Fixed Amount",
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label: "Value",
                      value:
                        discount.type ===
                        "percentage"
                          ? String(
                              discount.value
                            ) + "%"
                          : "PKR " +
                            String(
                              discount.value
                            ),
                      green: true,
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label:
                        "Apply To",
                      value:
                        formatTarget(
                          discount.applyTo ||
                            discount.target_type
                        ),
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label:
                        "Status",
                      value:
                        isActive
                          ? "Active"
                          : "Inactive",
                      green:
                        isActive,
                    }
                  )
                ),

                /* DESCRIPTION */

                React.createElement(
                  Card,
                  null,

                  React.createElement(
                    SecTitle,
                    null,
                    "Description"
                  ),

                  React.createElement(
                    "p",
                    {
                      className:
                        "text-[12px] leading-6",

                      style: {
                        color:
                          "var(--text-secondary)",
                      },
                    },

                    discount.description ||
                      "No description available."
                  )
                ),

                /* DATES */

                React.createElement(
                  Card,
                  {
                    className:
                      "md:col-span-2",
                  },

                  React.createElement(
                    SecTitle,
                    null,
                    "Dates"
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label:
                        "Start Date",
                      value:
                        formatDateTime(
                          discount.startDate ||
                            discount.start_date
                        ),
                    }
                  ),

                  React.createElement(
                    InfoRow,
                    {
                      label:
                        "End Date",
                      value:
                        formatDateTime(
                          discount.endDate ||
                            discount.end_date
                        ),
                    }
                  )
                )
              )
            : null,

          /* =================================================
             ACTIVITY
          ================================================= */

          tab === "activity"
            ? React.createElement(
                Card,
                null,

                React.createElement(
                  SecTitle,
                  null,
                  "Activity"
                ),

                activities.length ===
                0
                  ? React.createElement(
                      "div",
                      {
                        className:
                          "py-10 text-center",
                      },

                      React.createElement(
                        "p",
                        {
                          className:
                            "text-[12px]",
                          style: {
                            color:
                              "var(--text-muted)",
                          },
                        },
                        "No activity found."
                      )
                    )
                  : React.createElement(
                      "div",
                      {
                        className:
                          "space-y-0",
                      },

                      activities.map(
                        function (
                          activity,
                          index
                        ) {
                          return React.createElement(
                            "div",
                            {
                              key:
                                activity.id,

                              className:
                                "flex gap-3 py-4",

                              style: {
                                borderBottom:
                                  index <
                                  activities.length -
                                    1
                                    ? "1px solid var(--border-color)"
                                    : "none",
                              },
                            },

                            /* ICON */

                            React.createElement(
                              ActivityIcon,
                              {
                                type:
                                  activity.type,
                              }
                            ),

                            /* TEXT */

                            React.createElement(
                              "div",
                              {
                                className:
                                  "flex-1 min-w-0",
                              },

                              React.createElement(
                                "p",
                                {
                                  className:
                                    "text-[12px] font-medium",
                                },
                                activity.title
                              ),

                              React.createElement(
                                "p",
                                {
                                  className:
                                    "text-[11px] mt-1",
                                  style: {
                                    color:
                                      "var(--text-muted)",
                                  },
                                },
                                formatDateTime(
                                  activity.date
                                )
                              )
                            )
                          );
                        }
                      )
                    )
              )
            : null
        )
      )
    )
  );
}