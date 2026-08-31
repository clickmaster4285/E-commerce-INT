"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { categoryApi } from "@/apis/admin/categoryApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import { useSocket } from "@/hooks/useSocket";
import { useAttributeSocketSync } from "@/hooks/useAttributeSocketSync";
import { toast } from "sonner";

/* =========================================================
   ICONS
========================================================= */

function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={sw}
        d={d}
      />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",

  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",

  trash:
    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",

  close: "M6 18L18 6M6 6l12 12",

  check: "M5 13l4 4L19 7",

  plus:
    "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",

  pencil:
    "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",

  warn:
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",

  layers:
    "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",

  chevron: "M9 5l7 7-7 7",

  tag:
    "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",

  user:
    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",

  activity:
    "M3 12h4l3-8 4 16 3-8h4",

  clock:
    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0",
};

/* =========================================================
   HELPERS
========================================================= */

function getId(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    if (value._id) return getId(value._id);

    if (value.$oid) return String(value.$oid);

    if (typeof value.toString === "function") {
      const result = value.toString();

      if (
        result &&
        result !== "[object Object]"
      ) {
        return result;
      }
    }
  }

  return "";
}

function ini(name) {
  if (!name) return "??";

  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatDateTime(date) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/*
  Different backend responses can use different names.
  This helper tries the common creator/updater fields.
*/
function getUserObject(category, type) {
  if (!category) return null;

  if (type === "created") {
    return (
      category.createdby ||
      category.createdBy ||
      category.created_by ||
      category.creator ||
      null
    );
  }

  return (
    category.updatedby ||
    category.updatedBy ||
    category.updated_by ||
    category.updater ||
    null
  );
}

function getUserName(user) {
  if (!user) return "";

  if (typeof user === "string") {
    return user;
  }

  return (
    user.name ||
    user.full_name ||
    user.username ||
    user.email ||
    ""
  );
}

function getUserEmail(user) {
  if (!user || typeof user === "string") {
    return "";
  }

  return user.email || "";
}

/* =========================================================
   UI COMPONENTS
========================================================= */

function StatusPill({ active = true }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{
        backgroundColor: active
          ? "rgba(34,197,94,.10)"
          : "rgba(239,68,68,.10)",

        color: active
          ? "var(--success)"
          : "var(--danger)",

        border: `1px solid ${active
            ? "rgba(34,197,94,.25)"
            : "rgba(239,68,68,.25)"
          }`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          backgroundColor: active
            ? "var(--success)"
            : "var(--danger)",
        }}
      />

      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({
  children,
  onClick,
  danger = false,
  primary = false,
  disabled = false,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-[42px] h-10 md:h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: primary
          ? "var(--accent)"
          : danger
            ? "rgba(239,68,68,.08)"
            : "var(--bg-tertiary)",

        color: primary
          ? "var(--accent-text)"
          : danger
            ? "var(--danger)"
            : "var(--text-primary)",

        border: primary
          ? "none"
          : danger
            ? "1px solid rgba(239,68,68,.25)"
            : "1px solid var(--border-color)",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  children,
  className = "",
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  icon,
  title,
  action,
}) {
  return (
    <div
      className="px-4 py-3 flex items-center justify-between"
      style={{
        borderBottom:
          "1px solid var(--border-color)",
      }}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span style={{ color: "var(--accent)" }}>
            {icon}
          </span>
        )}

        <h3
          className="text-[12px] font-semibold"
          style={{
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h3>
      </div>

      {action}
    </div>
  );
}

function InfoRow({
  label,
  value,
  green = false,
  mono = false,
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{
        borderBottom:
          "1px solid var(--border-color)",
      }}
    >
      <span
        className="text-[11px]"
        style={{
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>

      <span
        className={`text-[12px] text-right break-words max-w-[62%] ${mono ? "font-mono" : ""
          }`}
        style={{
          color: green
            ? "#34d399"
            : "var(--text-primary)",
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function Spin({
  className = "w-4 h-4",
}) {
  return (
    <svg
      className={`${className} animate-spin`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />

      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function CategoryDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const queryClient = useQueryClient();

  const categoryId = getId(params?.id);

  const {
    socket,
    isConnected,
  } = useSocket();

  const backPath =
    pathname.substring(
      0,
      pathname.lastIndexOf("/")
    ) || "/admin/categories";

  const [tab, setTab] = useState("info");

  const [showEdit, setShowEdit] =
    useState(false);

  const [showDelete, setShowDelete] =
    useState(false);

  const [form, setForm] = useState({
    category_code: "",
    name: "",
    description: "",
    parent_category_id: "",
    sort_order: 0,
  });

  useAttributeSocketSync();

  const [showAssignAttr, setShowAssignAttr] = useState(false);
  const [editingAttrConfig, setEditingAttrConfig] = useState(null);
  const [attrSearch, setAttrSearch] = useState("");
  const [attrForm, setAttrForm] = useState({
    attribute_id: "",
    is_required: false,
    is_visible: true,
    is_filterable: false,
    is_searchable: false,
    is_variant_option: false,
    sort_order: 0,
  });

  const [showCreateAttr, setShowCreateAttr] = useState(false);
  const [newAttrForm, setNewAttrForm] = useState({
    name: "",
    code: "",
    data_type: "text",
    unit: "",
    description: "",
    variant_allowed: false,
    filterable: false,
    searchable: false,
    visible: true,
    is_active: true,
  });
  const [newAttrPreset, setNewAttrPreset] = useState({
    is_required: false,
    is_visible: true,
    is_filterable: false,
    is_searchable: false,
    is_variant_option: false,
  });

  /* =========================================================
     ALL CATEGORIES
  ========================================================= */

  const {
    data: allCategories = [],
  } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  /* =========================================================
     CATEGORY DETAIL
  ========================================================= */

  const {
    data: category,
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () =>
      categoryApi.getById(categoryId),
    enabled: !!categoryId,
    retry: false,
  });

  /* =========================================================
     PERMISSION ERROR
  ========================================================= */

  useEffect(() => {
    if (!isError || !error) return;

    const message =
      error?.response?.data?.message ||
      error?.message ||
      "";

    if (
      message
        .toLowerCase()
        .includes("permission") ||
      message
        .toLowerCase()
        .includes("access denied")
    ) {
      toast.error(
        "You don't have permission to view this category.",
        {
          duration: 6000,
          description:
            "Contact an administrator to grant you access.",
        }
      );
    }
  }, [isError, error]);

  /* =========================================================
     REAL-TIME CATEGORY UPDATE
  ========================================================= */

  useEffect(() => {
    if (!socket || !categoryId) {
      return;
    }

    const refreshCategory = (payload) => {
      const payloadId = getId(
        payload?._id ||
        payload?.id ||
        payload?.category?._id ||
        payload?.category?.id
      );

      /*
        If backend sends an event without ID,
        simply refresh the current category.
      */
      if (
        payloadId &&
        String(payloadId) !== String(categoryId)
      ) {
        return;
      }

      queryClient.invalidateQueries({
        queryKey: ["category", categoryId],
      });

      queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin-categories"],
      });
    };

    const events = [
      "categoryCreated",
      "categoryUpdated",
      "categoryDeleted",
      "category:created",
      "category:updated",
      "category:deleted",
      "categoriesUpdated",
      "categories:update",
    ];

    events.forEach((event) => {
      socket.on(event, refreshCategory);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, refreshCategory);
      });
    };
  }, [
    socket,
    categoryId,
    queryClient,
  ]);

  /* =========================================================
     UPDATE MUTATION
  ========================================================= */

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) =>
      categoryApi.update(id, data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["category", categoryId],
      });

      queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      setShowEdit(false);

      toast.success(
        "Category updated successfully"
      );
    },

    onError: (err) => {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update category"
      );
    },
  });

  /* =========================================================
     DELETE MUTATION
  ========================================================= */

  const deleteMutation = useMutation({
    mutationFn: () =>
      categoryApi.delete(categoryId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["categories"],
      });

      queryClient.invalidateQueries({
        queryKey: ["admin-categories"],
      });

      queryClient.removeQueries({
        queryKey: ["category", categoryId],
      });

      toast.success(
        "Category deleted successfully"
      );

      router.push(backPath);
    },

    onError: (err) => {
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete category"
      );
    },
  });

  /* =========================================================
     CATEGORY ATTRIBUTES (with inheritance from parents)
  ========================================================= */

  const {
    data: categoryAttributes = [],
    isLoading: loadingCatAttrs,
  } = useQuery({
    queryKey: ["category-attributes", categoryId],
    queryFn: () =>
      categoryApi.getAttributes(categoryId),
    enabled: !!categoryId,
  });

  const { data: allAttributes = [] } = useQuery({
    queryKey: ["attributes"],
    queryFn: () => attributeApi.getAll(""),
  });

  const updateAttrsMutation = useMutation({
    mutationFn: (attributes) =>
      categoryApi.updateAttributes(
        categoryId,
        attributes
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["category", categoryId],
      });
      queryClient.invalidateQueries({
        queryKey: ["category-attributes", categoryId],
      });
      toast.success(
        "Category attributes updated"
      );
      setShowAssignAttr(false);
      setEditingAttrConfig(null);
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update attributes"
      ),
  });

  const createAndAssignAttrMutation = useMutation({
    mutationFn: async () => {
      const created = await attributeApi.create(newAttrForm);
      const createdId = String(created?._id || created?.id || "");
      if (!createdId) {
        throw new Error("Attribute was created without an id");
      }

      const directConfigs = categoryAttributes.map((a) => ({
        attribute_id: String(
          a.category_config?.attribute_id || a._id
        ),
        is_required: Boolean(a.category_config?.is_required),
        is_visible: a.category_config?.is_visible !== false,
        is_filterable: Boolean(a.category_config?.is_filterable),
        is_searchable: Boolean(a.category_config?.is_searchable),
        is_variant_option: Boolean(
          a.category_config?.is_variant_option
        ),
        sort_order: a.category_config?.sort_order ?? 0,
      }));

      directConfigs.push({
        attribute_id: createdId,
        is_required: Boolean(newAttrPreset.is_required),
        is_visible: newAttrPreset.is_visible !== false,
        is_filterable: Boolean(newAttrPreset.is_filterable),
        is_searchable: Boolean(newAttrPreset.is_searchable),
        is_variant_option: Boolean(newAttrPreset.is_variant_option),
        sort_order: directConfigs.length,
      });

      await categoryApi.updateAttributes(categoryId, directConfigs);
      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", categoryId] });
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      toast.success(`"${created?.name || "Attribute"}" created and assigned`);
      setShowCreateAttr(false);
      setNewAttrForm({
        name: "",
        code: "",
        data_type: "text",
        unit: "",
        description: "",
        variant_allowed: false,
        filterable: false,
        searchable: false,
        visible: true,
        is_active: true,
      });
      setNewAttrPreset({
        is_required: false,
        is_visible: true,
        is_filterable: false,
        is_searchable: false,
        is_variant_option: false,
      });
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create attribute"
      ),
  });

  const openAssignAttr = (existing) => {
    if (existing) {
      setEditingAttrConfig(existing);
      setAttrForm({
        attribute_id: String(
          existing.category_config?.attribute_id ||
            existing._id ||
            ""
        ),
        is_required: Boolean(
          existing.category_config?.is_required
        ),
        is_visible:
          existing.category_config?.is_visible !== false,
        is_filterable: Boolean(
          existing.category_config?.is_filterable
        ),
        is_searchable: Boolean(
          existing.category_config?.is_searchable
        ),
        is_variant_option: Boolean(
          existing.category_config?.is_variant_option
        ),
        sort_order:
          existing.category_config?.sort_order ?? 0,
      });
    } else {
      setEditingAttrConfig(null);
      setAttrForm({
        attribute_id: "",
        is_required: false,
        is_visible: true,
        is_filterable: false,
        is_searchable: false,
        is_variant_option: false,
        sort_order: 0,
      });
    }
    setAttrSearch("");
    setShowAssignAttr(true);
  };

  const closeAssignAttr = () => {
    setShowAssignAttr(false);
    setEditingAttrConfig(null);
    setAttrSearch("");
  };

  const submitAttr = (e) => {
    e.preventDefault();
    if (!attrForm.attribute_id) {
      toast.error("Please select an attribute");
      return;
    }

    const directConfigs = categoryAttributes
      .map((a) => ({
        attribute_id: String(
          a.category_config?.attribute_id || a._id
        ),
        is_required: Boolean(
          a.category_config?.is_required
        ),
        is_visible: a.category_config?.is_visible !== false,
        is_filterable: Boolean(
          a.category_config?.is_filterable
        ),
        is_searchable: Boolean(
          a.category_config?.is_searchable
        ),
        is_variant_option: Boolean(
          a.category_config?.is_variant_option
        ),
        sort_order: a.category_config?.sort_order ?? 0,
      }));

    const existingIdx = directConfigs.findIndex(
      (c) =>
        String(c.attribute_id) ===
        String(attrForm.attribute_id)
    );

    const newConfig = {
      attribute_id: String(attrForm.attribute_id),
      is_required: Boolean(attrForm.is_required),
      is_visible: attrForm.is_visible !== false,
      is_filterable: Boolean(attrForm.is_filterable),
      is_searchable: Boolean(attrForm.is_searchable),
      is_variant_option: Boolean(
        attrForm.is_variant_option
      ),
      sort_order: Number(attrForm.sort_order) || 0,
    };

    if (existingIdx >= 0) {
      directConfigs[existingIdx] = newConfig;
    } else {
      directConfigs.push(newConfig);
    }

    updateAttrsMutation.mutate(directConfigs);
  };

  const removeAttribute = (attr) => {
    const directConfigs = categoryAttributes
      .filter(
        (a) =>
          String(
            a.category_config?.attribute_id ||
              a._id
          ) !== String(
            attr.category_config?.attribute_id ||
              attr._id
          )
      )
      .map((a) => ({
        attribute_id: String(
          a.category_config?.attribute_id || a._id
        ),
        is_required: Boolean(
          a.category_config?.is_required
        ),
        is_visible: a.category_config?.is_visible !== false,
        is_filterable: Boolean(
          a.category_config?.is_filterable
        ),
        is_searchable: Boolean(
          a.category_config?.is_searchable
        ),
        is_variant_option: Boolean(
          a.category_config?.is_variant_option
        ),
        sort_order: a.category_config?.sort_order ?? 0,
      }));

    updateAttrsMutation.mutate(directConfigs);
  };

  const directAttributes = useMemo(
    () => categoryAttributes,
    [categoryAttributes]
  );

  const availableAttributes = useMemo(() => {
    const assigned = new Set(
      directAttributes.map((a) =>
        String(
          a.category_config?.attribute_id || a._id
        )
      )
    );
    return allAttributes.filter(
      (a) => !assigned.has(String(a._id))
    );
  }, [allAttributes, directAttributes]);

  const filteredAvailable = useMemo(() => {
    const term = attrSearch.trim().toLowerCase();
    if (!term) return availableAttributes;
    return availableAttributes.filter(
      (a) =>
        a.name?.toLowerCase().includes(term) ||
        a.code?.toLowerCase().includes(term)
    );
  }, [availableAttributes, attrSearch]);

  /* =========================================================
     OPEN EDIT
  ========================================================= */

  function openEdit() {
    if (!category) return;

    const parentId = getId(
      category.parent_category_id
    );

    setForm({
      category_code:
        category.category_code || "",

      name: category.name || "",

      description:
        category.description || "",

      parent_category_id: parentId,

      sort_order:
        category.sort_order ?? 0,
    });

    setShowEdit(true);
  }

  /* =========================================================
     SUBMIT EDIT
  ========================================================= */

  function submitEdit(e) {
    e.preventDefault();

    const payload = {
      category_code:
        form.category_code.trim(),

      name: form.name.trim(),

      description:
        form.description.trim(),

      parent_category_id:
        getId(form.parent_category_id) ||
        null,

      sort_order:
        Number(form.sort_order) || 0,
    };

    updateMutation.mutate({
      id: categoryId,
      data: payload,
    });
  }

  /* =========================================================
     DERIVED DATA
  ========================================================= */

  const createdBy = useMemo(
    () =>
      getUserObject(
        category,
        "created"
      ),
    [category]
  );

  const updatedBy = useMemo(
    () =>
      getUserObject(
        category,
        "updated"
      ),
    [category]
  );

  const createdByName =
    getUserName(createdBy);

  const updatedByName =
    getUserName(updatedBy);

  const createdByEmail =
    getUserEmail(createdBy);

  const updatedByEmail =
    getUserEmail(updatedBy);

  const hasUpdates = Boolean(
    category?.created_at &&
    category?.updated_at &&
    new Date(
      category.created_at
    ).getTime() !==
    new Date(
      category.updated_at
    ).getTime()
  );

  /* =========================================================
     PARENT CATEGORY
  ========================================================= */

  const parentCategory = useMemo(() => {
    if (!category) return null;

    const parentId = getId(
      category.parent_category_id
    );

    if (!parentId) return null;

    /*
      First check populated object.
    */
    if (
      category.parent_category_id &&
      typeof category.parent_category_id ===
      "object" &&
      category.parent_category_id.name
    ) {
      return {
        name:
          category.parent_category_id.name,

        code:
          category.parent_category_id
            .category_code || "",
      };
    }

    /*
      Otherwise find parent from all categories.
    */
    const found =
      allCategories.find(
        (item) =>
          String(item._id) ===
          String(parentId)
      );

    if (!found) return null;

    return {
      name: found.name || "",
      code:
        found.category_code || "",
    };
  }, [
    category,
    allCategories,
  ]);

  const parentName =
    parentCategory?.name || "None";

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />

          <span
            className="text-[13px]"
            style={{
              color: "var(--text-muted)",
            }}
          >
            Loading category details...
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     NOT FOUND
  ========================================================= */

  if (!category) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">
            Category Not Found
          </h2>

          <Button
            primary
            onClick={() =>
              router.push(backPath)
            }
          >
            Back to Categories
          </Button>
        </Card>
      </div>
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div
      className="w-full pb-8"
      style={{
        color: "var(--text-primary)",
      }}
    >
      <div className="space-y-6">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() =>
                router.push(backPath)
              }
              className="font-medium transition hover:text-[var(--accent)]"
              style={{
                color: "var(--text-muted)",
              }}
            >
              Categories
            </button>

            <Ico
              d={D.chevron}
              className="h-3 w-3"
              style={{
                color: "var(--text-muted)",
              }}
            />

            <span
              className="font-medium"
              style={{
                color: "var(--text-primary)",
              }}
            >
              Category Details
            </span>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor:
                "var(--bg-card)",
              border:
                "1px solid var(--border-color)",
            }}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex min-w-0 items-center gap-4">

                {/* Category Icon */}

                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{
                    backgroundColor:
                      "var(--bg-primary)",
                    border:
                      "1px solid var(--border-color)",
                  }}
                >
                  <Ico
                    d={D.layers}
                    className="h-7 w-7"
                    style={{
                      color:
                        "var(--accent)",
                    }}
                  />
                </div>

                <div className="min-w-0">

                  <div className="mb-1 flex flex-wrap items-center gap-2">

                    <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                      {category.name}
                    </h1>

                    <StatusPill active={true} />
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-2 text-[12px]"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    <span className="font-mono">
                      {category.category_code ||
                        "—"}
                    </span>

                    {parentName !==
                      "None" && (
                        <>
                          <span>•</span>

                          <span>
                            {parentName}
                          </span>
                        </>
                      )}
                  </div>
                </div>
              </div>

              {/* Actions */}

              <div className="flex flex-wrap items-center gap-2">

                <Button
                  onClick={() =>
                    router.push(
                      backPath
                    )
                  }
                >
                  <Ico
                    d={D.back}
                    className="w-3.5 h-3.5"
                  />

                  Back
                </Button>

                <Button
                  primary
                  onClick={openEdit}
                >
                  <Ico
                    d={D.edit}
                    className="w-3.5 h-3.5"
                  />

                  Edit Category
                </Button>

                <Button
                  danger
                  disabled={
                    deleteMutation.isPending
                  }
                  onClick={() =>
                    setShowDelete(true)
                  }
                >
                  <Ico
                    d={D.trash}
                    className="w-3.5 h-3.5"
                  />

                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            TABS
        ===================================================== */}

        <div
          className="flex items-center gap-6 overflow-x-auto border-b"
          style={{
            borderColor:
              "var(--border-color)",
          }}
        >
          {[
            {
              id: "info",
              label: "Overview",
            },
            {
              id: "attributes",
              label: "Attributes",
              badge: categoryAttributes.length || undefined,
            },
            {
              id: "activity",
              label: "Activity",
              badge: hasUpdates ? 2 : 1,
            },
          ].map((item) => {
            const active =
              tab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  setTab(item.id)
                }
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{
                  color: active
                    ? "var(--accent)"
                    : "var(--text-muted)",
                }}
              >
                {item.label}

                {item.badge !==
                  undefined && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px]"
                      style={{
                        backgroundColor:
                          active
                            ? "var(--accent-soft)"
                            : "var(--bg-tertiary)",

                        color: active
                          ? "var(--accent)"
                          : "var(--text-muted)",
                      }}
                    >
                      {item.badge}
                    </span>
                  )}

                {active && (
                  <span
                    className="absolute bottom-[-1px] left-0 right-0 h-[2px]"
                    style={{
                      backgroundColor:
                        "var(--accent)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* =====================================================
            OVERVIEW
        ===================================================== */}

        {tab === "info" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">

            {/* LEFT */}

            <div className="space-y-4 min-w-0">

              {/* Category Information */}

              <Card>
                <CardHeader
                  title="Category Information"
                  icon={
                    <Ico
                      d={D.tag}
                      className="w-4 h-4"
                    />
                  }
                />

                <div className="px-4">

                  <InfoRow
                    label="Category Name"
                    value={category.name}
                  />

                  <InfoRow
                    label="Category Code"
                    value={
                      category.category_code
                    }
                    mono
                  />

                  <InfoRow
                    label="Parent Category"
                    value={parentName}
                    green={
                      parentName !==
                      "None"
                    }
                  />

                  <InfoRow
                    label="Sort Order"
                    value={
                      category.sort_order ??
                      0
                    }
                  />

                  <InfoRow
                    label="Status"
                    value="Active"
                    green
                  />

                  {/* CREATED */}

                  <div
                    className="py-3"
                    style={{
                      borderBottom:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">

                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        Created By
                      </span>

                      <span className="text-[12px] font-medium text-left sm:text-right">
                        {createdByName ||
                          "Unknown"}
                      </span>
                    </div>

                    {createdByEmail && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-1">
                        <span
                          className="text-[10px]"
                          style={{
                            color:
                              "var(--text-muted)",
                          }}
                        >
                          Email
                        </span>

                        <span
                          className="text-[10px] text-left sm:text-right"
                          style={{
                            color:
                              "var(--text-secondary)",
                          }}
                        >
                          {
                            createdByEmail
                          }
                        </span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-2">
                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        Created At
                      </span>

                      <span className="text-[12px] text-left sm:text-right">
                        {formatDateTime(
                          category.created_at
                        )}
                      </span>
                    </div>
                  </div>

                  {/* UPDATED */}

                  <div className="py-3">

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">

                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        Last Updated By
                      </span>

                      <span className="text-[12px] font-medium text-left sm:text-right">
                        {hasUpdates
                          ? updatedByName ||
                          "Unknown User"
                          : "—"}
                      </span>
                    </div>

                    {hasUpdates &&
                      updatedByEmail && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-1">
                          <span
                            className="text-[10px]"
                            style={{
                              color:
                                "var(--text-muted)",
                            }}
                          >
                            Email
                          </span>

                          <span
                            className="text-[10px] text-left sm:text-right"
                            style={{
                              color:
                                "var(--text-secondary)",
                            }}
                          >
                            {
                              updatedByEmail
                            }
                          </span>
                        </div>
                      )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mt-2">

                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        Last Updated At
                      </span>

                      <span className="text-[12px] text-left sm:text-right">
                        {hasUpdates
                          ? formatDateTime(
                            category.updated_at
                          )
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* DESCRIPTION */}

              <Card>
                <CardHeader
                  title="Description"
                  icon={
                    <Ico
                      d={D.activity}
                      className="w-4 h-4"
                    />
                  }
                />

                <div className="p-5">
                  {category.description ? (
                    <p
                      className="text-[12px] leading-6 whitespace-pre-wrap break-words"
                      style={{
                        color:
                          "var(--text-secondary)",
                      }}
                    >
                      {
                        category.description
                      }
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-8">

                      <Ico
                        d={D.activity}
                        className="w-7 h-7 mb-3"
                        sw={1.4}
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      />

                      <p
                        className="text-[12px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        No description
                        provided.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* RIGHT */}

            <Card>
              <CardHeader
                title="Hierarchy & Meta"
                icon={
                  <Ico
                    d={D.layers}
                    className="w-4 h-4"
                  />
                }
              />

              <div className="p-4 space-y-4">

                {/* CURRENT */}

                <div>
                  <p
                    className="text-[10px] uppercase tracking-wide mb-2"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Current Level
                  </p>

                  <div className="flex items-center gap-2">

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor:
                          "var(--bg-tertiary)",
                        border:
                          "1px solid var(--border-color)",
                        color:
                          "var(--accent)",
                      }}
                    >
                      {ini(
                        category.name
                      )}
                    </div>

                    <div className="min-w-0">

                      <p className="text-[12px] font-medium truncate">
                        {category.name}
                      </p>

                      <p
                        className="text-[10px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        ID:{" "}
                        {String(
                          category._id
                        ).substring(
                          0,
                          8
                        )}
                        ...
                      </p>
                    </div>
                  </div>
                </div>

                {/* PARENT */}

                {parentCategory ? (
                  <div
                    className="pt-4"
                    style={{
                      borderTop:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wide mb-2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      Parent Category
                    </p>

                    <div className="flex items-center gap-2">

                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor:
                            "rgba(96,165,250,.10)",
                          border:
                            "1px solid var(--border-color)",
                          color: "#60a5fa",
                        }}
                      >
                        {ini(
                          parentCategory.name
                        )}
                      </div>

                      <div className="min-w-0">

                        <p className="text-[12px] font-medium truncate">
                          {
                            parentCategory.name
                          }
                        </p>

                        {parentCategory.code && (
                          <p
                            className="text-[10px] font-mono"
                            style={{
                              color:
                                "var(--text-muted)",
                            }}
                          >
                            {
                              parentCategory.code
                            }
                          </p>
                        )}

                        <p
                          className="text-[10px]"
                          style={{
                            color:
                              "var(--text-muted)",
                          }}
                        >
                          Direct Parent
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="pt-4"
                    style={{
                      borderTop:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      className="px-3 py-2.5 rounded-lg"
                      style={{
                        backgroundColor:
                          "var(--bg-tertiary)",
                        border:
                          "1px dashed var(--border-color)",
                      }}
                    >
                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        This is a root
                        category.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* =====================================================
            ATTRIBUTES TAB
        ===================================================== */}

        {tab === "attributes" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">

            <Card>
              <CardHeader
                title="Assigned Attributes"
                icon={
                  <Ico
                    d={D.tag}
                    className="w-4 h-4"
                  />
                }
                action={
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      onClick={() => {
                        setShowCreateAttr(true);
                        setNewAttrForm({
                          name: "",
                          code: "",
                          data_type: "text",
                          unit: "",
                          description: "",
                          variant_allowed: false,
                          filterable: false,
                          searchable: false,
                          visible: true,
                          is_active: true,
                        });
                        setNewAttrPreset({
                          is_required: false,
                          is_visible: true,
                          is_filterable: false,
                          is_searchable: false,
                          is_variant_option: false,
                        });
                      }}
                      disabled={
                        updateAttrsMutation.isPending ||
                        createAndAssignAttrMutation.isPending
                      }
                    >
                      <Ico
                        d={D.plus}
                        className="w-3.5 h-3.5"
                      />
                      Add New Attribute
                    </Button>
                    <Button
                      primary
                      onClick={() =>
                        openAssignAttr(null)
                      }
                      disabled={
                        updateAttrsMutation.isPending ||
                        createAndAssignAttrMutation.isPending
                      }
                    >
                      <Ico
                        d={D.plus}
                        className="w-3.5 h-3.5"
                      />
                      Assign Attribute
                    </Button>
                  </div>
                }
              />

              <div className="p-4 space-y-4">
                {loadingCatAttrs ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Spin className="w-4 h-4" />
                    <span
                      className="text-[12px]"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      Loading attributes...
                    </span>
                  </div>
                ) : categoryAttributes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-10">
                    <Ico
                      d={D.tag}
                      className="w-7 h-7 mb-3"
                      sw={1.4}
                      style={{
                        color: "var(--text-muted)",
                      }}
                    />
                    <p
                      className="text-[12px]"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      No attributes assigned yet.
                    </p>
                    <p
                      className="text-[10px] mt-1"
                      style={{
                        color: "var(--text-muted)",
                      }}
                    >
                      Assign attributes to use them for products in this category.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* DIRECT */}

                    <div>
                      <p
                        className="text-[10px] uppercase tracking-wide mb-2"
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        Assigned Attributes ({directAttributes.length})
                      </p>

                      {directAttributes.length === 0 ? (
                        <p
                          className="text-[11px] py-3"
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          No attributes yet. Use &ldquo;Add New Attribute&rdquo; to create one, or &ldquo;Assign Attribute&rdquo; to attach an existing one.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {directAttributes.map((attr) => (
                            <div
                              key={String(
                                attr.category_config?.attribute_id ||
                                  attr._id
                              )}
                              className="rounded-lg p-3"
                              style={{
                                backgroundColor:
                                  "var(--bg-tertiary)",
                                border:
                                  "1px solid var(--border-color)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[12px] font-semibold">
                                      {attr.name}
                                    </p>
                                    <span
                                      className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          "var(--bg-card)",
                                        color: "var(--text-muted)",
                                      }}
                                    >
                                      {attr.code}
                                    </span>
                                    <span
                                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                      style={{
                                        backgroundColor:
                                          "rgba(59,130,246,.10)",
                                        color: "#60a5fa",
                                        border:
                                          "1px solid rgba(59,130,246,.25)",
                                      }}
                                    >
                                      {attr.data_type}
                                    </span>
                                  </div>
                                  {attr.description && (
                                    <p
                                      className="text-[10px] mt-1"
                                      style={{
                                        color:
                                          "var(--text-muted)",
                                      }}
                                    >
                                      {attr.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {attr.category_config?.is_required && (
                                      <span
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            "rgba(239,68,68,.10)",
                                          color: "#f87171",
                                          border:
                                            "1px solid rgba(239,68,68,.25)",
                                        }}
                                      >
                                        Required
                                      </span>
                                    )}
                                    {attr.category_config?.is_filterable && (
                                      <span
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            "rgba(16,185,129,.10)",
                                          color: "#34d399",
                                          border:
                                            "1px solid rgba(16,185,129,.25)",
                                        }}
                                      >
                                        Filter
                                      </span>
                                    )}
                                    {attr.category_config?.is_searchable && (
                                      <span
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            "rgba(245,158,11,.10)",
                                          color: "#fbbf24",
                                          border:
                                            "1px solid rgba(245,158,11,.25)",
                                        }}
                                      >
                                        Search
                                      </span>
                                    )}
                                    {attr.category_config?.is_visible === false && (
                                      <span
                                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor:
                                            "rgba(148,163,184,.10)",
                                          color: "#cbd5e1",
                                          border:
                                            "1px solid rgba(148,163,184,.25)",
                                        }}
                                      >
                                        Hidden
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openAssignAttr(attr)
                                    }
                                    className="min-w-[36px] min-h-[36px] p-1.5 rounded-md transition hover:bg-white/5"
                                    style={{
                                      color: "var(--text-secondary)",
                                    }}
                                    title="Edit"
                                  >
                                    <Ico
                                      d={D.edit}
                                      className="w-3.5 h-3.5"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeAttribute(attr)
                                    }
                                    disabled={
                                      updateAttrsMutation.isPending
                                    }
                                    className="min-w-[36px] min-h-[36px] p-1.5 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-40"
                                    title="Remove"
                                  >
                                    <Ico
                                      d={D.trash}
                                      className="w-3.5 h-3.5"
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* RIGHT SIDE - INFO */}

            <Card>
              <CardHeader
                title="Attribute Info"
                icon={
                  <Ico
                    d={D.activity}
                    className="w-4 h-4"
                  />
                }
              />
              <div className="p-4 space-y-3">
                <div
                  className="px-3 py-2.5 rounded-lg"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Total Attributes
                  </p>
                  <p className="text-[18px] font-bold mt-0.5">
                    {categoryAttributes.length}
                  </p>
                </div>
                <div
                  className="px-3 py-2.5 rounded-lg"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px dashed var(--border-color)",
                  }}
                >
                  <p
                    className="text-[11px] leading-5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Attributes configured here will appear automatically on the Product form for this category.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* =====================================================
            ACTIVITY
        ===================================================== */}

        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

            <Card>
              <CardHeader
                title="Activity Timeline"
                icon={
                  <Ico
                    d={D.activity}
                    className="w-4 h-4"
                  />
                }
              />

              <div className="p-5 space-y-6">

                {/* CREATED */}

                <div className="flex gap-4">

                  <div className="flex flex-col items-center">

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor:
                          "rgba(16,185,129,.10)",
                        color:
                          "var(--accent)",
                      }}
                    >
                      <Ico
                        d={D.plus}
                        className="w-4 h-4"
                      />
                    </div>

                    {hasUpdates && (
                      <div
                        className="w-px flex-1 mt-1"
                        style={{
                          backgroundColor:
                            "var(--border-color)",
                        }}
                      />
                    )}
                  </div>

                  <div className="pb-2 min-w-0">

                    <p className="text-[13px] font-medium">
                      Category Created
                    </p>

                    <p
                      className="text-[11px] mt-1"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      Created by{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {createdByName ||
                          "Unknown User"}
                      </span>
                    </p>

                    {createdByEmail && (
                      <p
                        className="text-[10px] mt-0.5"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        {
                          createdByEmail
                        }
                      </p>
                    )}

                    <p
                      className="text-[10px] mt-2 font-mono"
                      style={{
                        color:
                          "var(--text-secondary)",
                      }}
                    >
                      {formatDateTime(
                        category.created_at
                      )}
                    </p>
                  </div>
                </div>

                {/* UPDATED */}

                {hasUpdates ? (
                  <div className="flex gap-4">

                    <div>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor:
                            "rgba(96,165,250,.10)",
                          color: "#60a5fa",
                        }}
                      >
                        <Ico
                          d={D.pencil}
                          className="w-4 h-4"
                        />
                      </div>
                    </div>

                    <div className="min-w-0">

                      <p className="text-[13px] font-medium">
                        Category Updated
                      </p>

                      <p
                        className="text-[11px] mt-1"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        Updated by{" "}
                        <span className="font-semibold text-[var(--text-primary)]">
                          {updatedByName ||
                            "Unknown User"}
                        </span>
                      </p>

                      {updatedByEmail && (
                        <p
                          className="text-[10px] mt-0.5"
                          style={{
                            color:
                              "var(--text-muted)",
                          }}
                        >
                          {
                            updatedByEmail
                          }
                        </p>
                      )}

                      <p
                        className="text-[10px] mt-2 font-mono"
                        style={{
                          color:
                            "var(--text-secondary)",
                        }}
                      >
                        {formatDateTime(
                          category.updated_at
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="ml-11 px-3 py-2.5 rounded-lg"
                    style={{
                      backgroundColor:
                        "var(--bg-tertiary)",
                      border:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <span
                      className="text-[11px]"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      No updates recorded
                      yet.
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* USER DETAILS */}

            <Card>
              <CardHeader
                title="User Details"
                icon={
                  <Ico
                    d={D.user}
                    className="w-4 h-4"
                  />
                }
              />

              <div className="p-4 space-y-4">

                {/* CREATOR */}

                <div>
                  <p
                    className="text-[10px] uppercase tracking-wide mb-2"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Creator
                  </p>

                  <div className="flex items-center gap-2">

                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor:
                          "var(--bg-tertiary)",
                        border:
                          "1px solid var(--border-color)",
                        color:
                          "var(--accent)",
                      }}
                    >
                      {ini(
                        createdByName
                      )}
                    </div>

                    <div className="min-w-0">

                      <p className="text-[12px] font-medium truncate">
                        {createdByName ||
                          "Unknown"}
                      </p>

                      <p
                        className="text-[10px] truncate"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        {createdByEmail ||
                          "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* EDITOR */}

                {hasUpdates && (
                  <div
                    className="pt-4"
                    style={{
                      borderTop:
                        "1px solid var(--border-color)",
                    }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wide mb-2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      Last Editor
                    </p>

                    <div className="flex items-center gap-2">

                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor:
                            "var(--bg-tertiary)",
                          border:
                            "1px solid var(--border-color)",
                          color:
                            "var(--accent)",
                        }}
                      >
                        {ini(
                          updatedByName
                        )}
                      </div>

                      <div className="min-w-0">

                        <p className="text-[12px] font-medium truncate">
                          {updatedByName ||
                            "Unknown User"}
                        </p>

                        <p
                          className="text-[10px] truncate"
                          style={{
                            color:
                              "var(--text-muted)",
                          }}
                        >
                          {updatedByEmail ||
                            "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* =====================================================
          EDIT MODAL
      ===================================================== */}

      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">

          <div
            className="w-full max-w-lg rounded-xl overflow-hidden"
            style={{
              backgroundColor:
                "var(--bg-card)",
              border:
                "1px solid var(--border-color)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,.4)",
            }}
          >

            {/* HEADER */}

            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{
                borderBottom:
                  "1px solid var(--border-color)",
              }}
            >
              <div>

                <h2 className="text-[14px] font-semibold">
                  Edit Category
                </h2>

                <p
                  className="text-[10px] mt-1"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Update category
                  information
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowEdit(false)
                }
                disabled={
                  updateMutation.isPending
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                style={{
                  backgroundColor:
                    "var(--bg-tertiary)",
                  color:
                    "var(--text-muted)",
                }}
              >
                <Ico
                  d={D.close}
                  className="w-4 h-4"
                />
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={submitEdit}
              className="p-5 space-y-4"
            >

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* CODE */}

                <div>
                  <label
                    className="block text-[11px] mb-1.5"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Category Code
                  </label>

                  <input
                    value={
                      form.category_code
                    }
                    disabled
                    readOnly
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none opacity-60"
                    style={{
                      backgroundColor:
                        "var(--bg-tertiary)",
                      border:
                        "1px solid var(--border-color)",
                      color:
                        "var(--text-primary)",
                    }}
                  />
                </div>

                {/* NAME */}

                <div>
                  <label
                    className="block text-[11px] mb-1.5"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Category Name *
                  </label>

                  <input
                    value={form.name}
                    required
                    disabled={
                      updateMutation.isPending
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name: e.target.value,
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                    style={{
                      backgroundColor:
                        "var(--bg-tertiary)",
                      border:
                        "1px solid var(--border-color)",
                      color:
                        "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              {/* PARENT */}

              <div>
                <label
                  className="block text-[11px] mb-1.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Parent Category
                </label>

                <select
                  value={
                    form.parent_category_id
                  }
                  disabled={
                    updateMutation.isPending
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parent_category_id:
                        e.target.value,
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",
                    border:
                      "1px solid var(--border-color)",
                    color:
                      "var(--text-primary)",
                  }}
                >
                  <option value="">
                    None (Root Category)
                  </option>

                  {allCategories
                    .filter(
                      (c) =>
                        String(
                          c._id
                        ) !==
                        String(
                          categoryId
                        )
                    )
                    .map((c) => (
                      <option
                        key={c._id}
                        value={c._id}
                      >
                        {c.name}
                        {c.category_code
                          ? ` (${c.category_code})`
                          : ""}
                      </option>
                    ))}
                </select>
              </div>

              {/* SORT ORDER */}

              <div>
                <label
                  className="block text-[11px] mb-1.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Sort Order
                </label>

                <input
                  type="number"
                  value={form.sort_order}
                  disabled={
                    updateMutation.isPending
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sort_order:
                        e.target.value,
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",
                    border:
                      "1px solid var(--border-color)",
                    color:
                      "var(--text-primary)",
                  }}
                />
              </div>

              {/* DESCRIPTION */}

              <div>
                <label
                  className="block text-[11px] mb-1.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Description
                </label>

                <textarea
                  rows={4}
                  value={form.description}
                  disabled={
                    updateMutation.isPending
                  }
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description:
                        e.target.value,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none resize-none disabled:opacity-50"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",
                    border:
                      "1px solid var(--border-color)",
                    color:
                      "var(--text-primary)",
                  }}
                />
              </div>

              {/* BUTTONS */}

              <div
                className="flex justify-end gap-2 pt-3"
                style={{
                  borderTop:
                    "1px solid var(--border-color)",
                }}
              >
                <Button
                  disabled={
                    updateMutation.isPending
                  }
                  onClick={() =>
                    setShowEdit(false)
                  }
                >
                  Cancel
                </Button>

                <Button
                  primary
                  type="submit"
                  disabled={
                    updateMutation.isPending
                  }
                >
                  {updateMutation.isPending ? (
                    <>
                      <Spin className="w-3.5 h-3.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Ico
                        d={D.check}
                        className="w-3.5 h-3.5"
                      />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          ASSIGN ATTRIBUTE MODAL
      ===================================================== */}

      {showAssignAttr && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{
                borderBottom:
                  "1px solid var(--border-color)",
              }}
            >
              <div>
                <h2 className="text-[14px] font-semibold">
                  {editingAttrConfig
                    ? "Edit Attribute Config"
                    : "Assign Attribute"}
                </h2>
                <p
                  className="text-[10px] mt-1"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  Configure this attribute for the category
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignAttr}
                disabled={updateAttrsMutation.isPending}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-muted)",
                }}
              >
                <Ico
                  d={D.close}
                  className="w-4 h-4"
                />
              </button>
            </div>

            <form
              onSubmit={submitAttr}
              className="p-5 space-y-4 overflow-y-auto"
            >
              {/* SELECT ATTRIBUTE (only when adding) */}

              {!editingAttrConfig && (
                <div>
                  <label
                    className="block text-[11px] mb-1.5"
                    style={{
                      color: "var(--text-muted)",
                    }}
                  >
                    Select Attribute *
                  </label>
                  <input
                    type="text"
                    value={attrSearch}
                    onChange={(e) =>
                      setAttrSearch(e.target.value)
                    }
                    placeholder="Search by name or code..."
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none mb-2"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{
                      border:
                        "1px solid var(--border-color)",
                      maxHeight: "180px",
                      overflowY: "auto",
                    }}
                  >
                    {filteredAvailable.length === 0 ? (
                      <div
                        className="p-3 text-[11px] text-center"
                        style={{
                          color: "var(--text-muted)",
                        }}
                      >
                        No available attributes
                      </div>
                    ) : (
                      filteredAvailable.map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() =>
                            setAttrForm({
                              ...attrForm,
                              attribute_id: String(
                                a._id
                              ),
                            })
                          }
                          className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 transition"
                          style={{
                            backgroundColor:
                              String(
                                attrForm.attribute_id
                              ) === String(a._id)
                                ? "var(--bg-tertiary)"
                                : "transparent",
                            borderBottom:
                              "1px solid var(--border-color)",
                            color:
                              String(
                                attrForm.attribute_id
                              ) === String(a._id)
                                ? "var(--accent)"
                                : "var(--text-primary)",
                          }}
                        >
                          <span className="font-medium truncate flex-1">
                            {a.name}
                          </span>
                          <span
                            className="font-mono text-[10px]"
                            style={{
                              color:
                                "var(--text-muted)",
                            }}
                          >
                            {a.code}
                          </span>
                          <span
                            className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor:
                                "rgba(59,130,246,.10)",
                              color: "#60a5fa",
                            }}
                          >
                            {a.data_type}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {editingAttrConfig && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                    Attribute
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-[13px] font-semibold">
                      {editingAttrConfig.name}
                    </p>
                    <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                      {editingAttrConfig.code}
                    </span>
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: "rgba(59,130,246,.10)",
                        color: "#60a5fa",
                      }}
                    >
                      {editingAttrConfig.data_type}
                    </span>
                  </div>
                </div>
              )}

              {/* SORT ORDER */}

              <div>
                <label
                  className="block text-[11px] mb-1.5"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  Sort Order
                </label>
                <input
                  type="number"
                  value={attrForm.sort_order}
                  disabled={updateAttrsMutation.isPending}
                  onChange={(e) =>
                    setAttrForm({
                      ...attrForm,
                      sort_order: e.target.value,
                    })
                  }
                  className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {/* FLAGS */}

              <div>
                <label
                  className="block text-[11px] mb-2"
                  style={{
                    color: "var(--text-muted)",
                  }}
                >
                  Configuration Flags
                </label>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg p-3"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {[
                    {
                      key: "is_required",
                      label: "Required",
                      desc: "Must be filled when adding product",
                    },
                    {
                      key: "is_visible",
                      label: "Visible",
                      desc: "Show on product page",
                    },
                    {
                      key: "is_filterable",
                      label: "Filterable",
                      desc: "Available as storefront filter",
                    },
                    {
                      key: "is_searchable",
                      label: "Searchable",
                      desc: "Include in search indexing",
                    },
                  ].map((f) => (
                    <label
                      key={f.key}
                      className="flex items-start gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(attrForm[f.key])}
                        disabled={
                          updateAttrsMutation.isPending
                        }
                        onChange={(e) =>
                          setAttrForm({
                            ...attrForm,
                            [f.key]: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5 mt-0.5"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <div>
                        <p className="text-[12px] font-medium">
                          {f.label}
                        </p>
                        <p
                          className="text-[10px]"
                          style={{
                            color: "var(--text-muted)",
                          }}
                        >
                          {f.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* BUTTONS */}

              <div
                className="flex justify-end gap-2 pt-3"
                style={{
                  borderTop: "1px solid var(--border-color)",
                }}
              >
                <Button
                  disabled={updateAttrsMutation.isPending}
                  onClick={closeAssignAttr}
                >
                  Cancel
                </Button>
                <Button
                  primary
                  type="submit"
                  disabled={updateAttrsMutation.isPending}
                >
                  {updateAttrsMutation.isPending ? (
                    <>
                      <Spin className="w-3.5 h-3.5" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Ico
                        d={D.check}
                        className="w-3.5 h-3.5"
                      />
                      {editingAttrConfig
                        ? "Update Attribute"
                        : "Assign Attribute"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          DELETE MODAL
      ===================================================== */}

      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">

          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{
              backgroundColor:
                "var(--bg-card)",
              border:
                "1px solid var(--border-color)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,.4)",
            }}
          >

            <div className="flex gap-3">

              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor:
                    "rgba(239,68,68,.10)",
                  color: "#f87171",
                }}
              >
                <Ico
                  d={D.warn}
                  className="w-4 h-4"
                />
              </div>

              <div className="min-w-0">

                <h3 className="text-[14px] font-semibold">
                  Delete Category?
                </h3>

                <p
                  className="text-[11px] mt-1 leading-5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Are you sure you want
                  to delete{" "}
                  <span
                    style={{
                      color:
                        "var(--text-primary)",
                    }}
                  >
                    {category.name}
                  </span>
                  ? This action cannot
                  be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">

              <Button
                disabled={
                  deleteMutation.isPending
                }
                onClick={() =>
                  setShowDelete(false)
                }
              >
                Cancel
              </Button>

              <Button
                danger
                disabled={
                  deleteMutation.isPending
                }
                onClick={() =>
                  deleteMutation.mutate()
                }
              >
                {deleteMutation.isPending ? (
                  <>
                    <Spin className="w-3.5 h-3.5" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Ico
                      d={D.trash}
                      className="w-3.5 h-3.5"
                    />
                    Delete Category
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE NEW ATTRIBUTE MODAL
          (used from inside Category → Attributes)
      ===================================================== */}

      {showCreateAttr && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl max-h-[90vh] rounded-xl overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between shrink-0"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
              <div>
                <h2 className="text-[14px] font-semibold">
                  Add New Attribute
                </h2>
                <p
                  className="text-[10px] mt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  Create a reusable attribute and assign it to this category
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAttr(false)}
                disabled={createAndAssignAttrMutation.isPending}
                className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-muted)",
                }}
              >
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newAttrForm.name.trim()) {
                  toast.error("Attribute name is required");
                  return;
                }
                if (!newAttrForm.code.trim()) {
                  toast.error("Attribute code is required");
                  return;
                }
                createAndAssignAttrMutation.mutate();
              }}
              className="p-5 space-y-4 overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Attribute Name *
                  </label>
                  <input
                    autoFocus
                    value={newAttrForm.name}
                    onChange={(e) =>
                      setNewAttrForm({
                        ...newAttrForm,
                        name: e.target.value,
                        code:
                          newAttrForm.code ||
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]+/g, "_")
                            .replace(/^_+|_+$/g, ""),
                      })
                    }
                    required
                    disabled={createAndAssignAttrMutation.isPending}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. Cooling Technology"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Code * <span style={{ color: "var(--text-muted)" }} className="font-normal">(unique, lowercase)</span>
                  </label>
                  <input
                    value={newAttrForm.code}
                    onChange={(e) =>
                      setNewAttrForm({
                        ...newAttrForm,
                        code: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]+/g, "_")
                          .replace(/^_+|_+$/g, ""),
                      })
                    }
                    required
                    disabled={createAndAssignAttrMutation.isPending}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none font-mono disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. cooling_technology"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Type *
                  </label>
                  <select
                    value={newAttrForm.data_type}
                    onChange={(e) =>
                      setNewAttrForm({
                        ...newAttrForm,
                        data_type: e.target.value,
                      })
                    }
                    disabled={createAndAssignAttrMutation.isPending}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none appearance-none disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="decimal">Decimal</option>
                    <option value="boolean">Boolean (Yes / No)</option>
                    <option value="date">Date</option>
                    <option value="datetime">Date & Time</option>
                    <option value="select">Select</option>
                    <option value="multi_select">Multi Select</option>
                    <option value="color">Color</option>
                    <option value="url">URL</option>
                    <option value="measurement">Measurement</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Unit <span style={{ color: "var(--text-muted)" }} className="font-normal">(optional)</span>
                  </label>
                  <input
                    value={newAttrForm.unit}
                    onChange={(e) =>
                      setNewAttrForm({
                        ...newAttrForm,
                        unit: e.target.value,
                      })
                    }
                    disabled={createAndAssignAttrMutation.isPending}
                    className="w-full h-9 px-3 rounded-lg text-[12px] outline-none disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    placeholder="e.g. GB, inch, kg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newAttrForm.description}
                  onChange={(e) =>
                    setNewAttrForm({
                      ...newAttrForm,
                      description: e.target.value,
                    })
                  }
                  disabled={createAndAssignAttrMutation.isPending}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none resize-none disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="block text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                  Global Attribute Configuration
                </label>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg p-3"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {[
                    { key: "filterable", label: "Filterable" },
                    { key: "searchable", label: "Searchable" },
                    { key: "visible", label: "Visible on Storefront" },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={Boolean(newAttrForm[f.key])}
                        disabled={createAndAssignAttrMutation.isPending}
                        onChange={(e) =>
                          setNewAttrForm({
                            ...newAttrForm,
                            [f.key]: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                  Category-Level Configuration (for this category only)
                </label>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg p-3"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {[
                    { key: "is_required", label: "Required" },
                    { key: "is_visible", label: "Visible" },
                    { key: "is_filterable", label: "Filterable" },
                    { key: "is_searchable", label: "Searchable" },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-[12px]">
                      <input
                        type="checkbox"
                        checked={Boolean(newAttrPreset[f.key])}
                        disabled={createAndAssignAttrMutation.isPending}
                        onChange={(e) =>
                          setNewAttrPreset({
                            ...newAttrPreset,
                            [f.key]: e.target.checked,
                          })
                        }
                        className="w-3.5 h-3.5"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>

              <div
                className="flex justify-end gap-2 pt-3"
                style={{ borderTop: "1px solid var(--border-color)" }}
              >
                <Button
                  disabled={createAndAssignAttrMutation.isPending}
                  onClick={() => setShowCreateAttr(false)}
                >
                  Cancel
                </Button>
                <Button
                  primary
                  type="submit"
                  disabled={createAndAssignAttrMutation.isPending}
                >
                  {createAndAssignAttrMutation.isPending ? (
                    <>
                      <Spin className="w-3.5 h-3.5" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Ico d={D.check} className="w-3.5 h-3.5" />
                      Create & Assign
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}