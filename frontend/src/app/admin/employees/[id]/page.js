"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  Briefcase,
  Package,
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  User,
  Loader2,
  ChevronDown,
  Pencil,
  X,
  Eye,
  EyeOff,
  Trash2,
  Power,
  ShoppingCart,
  Star,
  TrendingUp,
  MapPin,
  IdCard,
  Tag,
  Store,
  FileText,
  Camera,
  ShoppingBag,
  CreditCard,
  LogIn,
  Settings,
  BarChart3,
  Layers,
  ShieldCheck,
  Percent,
} from "lucide-react";

import { employeeApi } from "@/apis/employeeApi";
import { useEmployeeSocketSync } from "@/hooks/useEmployeeSocket";

// ==========================================
// ✅ ALLOWED PERMISSIONS
// ==========================================
const ALLOWED_PERMISSIONS = {
  employees: { label: "Employees", default: true },
  products: { label: "Products", default: true },
  brands: { label: "Brands", default: true },
  categories: { label: "Categories", default: true },
  discounts: { label: "Discounts", default: true },
  deals: { label: "Deals", default: true },
  profile: { label: "Profile", default: true },
  store: { label: "Store", default: false },
};

// ==========================================
// HELPER COMPONENTS
// ==========================================
function StatusBadge({ status }) {
  const active = status === "active";

  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={
        active
          ? {
              backgroundColor: "rgba(16,185,129,0.1)",
              color: "#34d399",
              border: "1px solid rgba(16,185,129,0.3)",
            }
          : {
              backgroundColor: "rgba(239,68,68,0.1)",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
            }
      }
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

const PREDEFINED_DEPARTMENTS = [
  "HR",
  "Manager",
  "IT",
  "Finance",
  "Marketing",
  "Customer Service",
  "Operations",
  "Store Manager",
];

function DepartmentDropdown({ value, onChange, disabled }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(
    PREDEFINED_DEPARTMENTS
  );

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value || "");
    }
  }, [value]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(PREDEFINED_DEPARTMENTS);
    } else {
      setFilteredOptions(
        PREDEFINED_DEPARTMENTS.filter((d) =>
          d.toLowerCase().includes(inputValue.toLowerCase())
        )
      );
    }
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "6px",
    height: "32px",
    fontSize: "13px",
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Type or select..."
          disabled={disabled}
          className="w-full h-8 pl-3 pr-7 rounded-md text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
          style={inputStyle}
        />

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute z-10 w-full mb-1 rounded-md shadow-lg max-h-48 overflow-auto py-1"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
            bottom: "100%",
          }}
        >
          {filteredOptions.length === 0 ? (
            <div
              className="px-3 py-1.5 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              No matching departments
            </div>
          ) : (
            filteredOptions.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => {
                  setInputValue(dept);
                  onChange(dept);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-1.5 text-[13px] transition"
                style={{
                  color: "var(--text-primary)",
                  backgroundColor:
                    inputValue === dept
                      ? "rgba(16,185,129,0.1)"
                      : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (inputValue !== dept) {
                    e.currentTarget.style.backgroundColor =
                      "var(--bg-tertiary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (inputValue !== dept) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {dept}
              </button>
            ))
          )}

          {inputValue.trim() &&
            !PREDEFINED_DEPARTMENTS.includes(inputValue.trim()) && (
              <div
                className="px-3 py-1.5 text-[11px] border-t"
                style={{
                  borderColor: "var(--border-color)",
                  color: "var(--text-muted)",
                }}
              >
                Custom: &quot;{inputValue.trim()}&quot;
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// ACTIVITY STYLES
// ==========================================
const ACTIVITY_STYLES = {
  "Employee Management": {
    icon: Users,
    bg: "rgba(99, 102, 241, 0.1)",
    color: "#818cf8",
  },

  "Order Management": {
    icon: ShoppingCart,
    bg: "rgba(16, 185, 129, 0.1)",
    color: "#34d399",
  },

  "Product Management": {
    icon: Package,
    bg: "rgba(59, 130, 246, 0.1)",
    color: "#60a5fa",
  },

  "Customer Management": {
    icon: Users,
    bg: "rgba(251, 191, 36, 0.1)",
    color: "#fbbf24",
  },

  "Coupon Management": {
    icon: Star,
    bg: "rgba(168, 85, 247, 0.1)",
    color: "#c084fc",
  },

  Authentication: {
    icon: LogIn,
    bg: "rgba(34, 211, 238, 0.1)",
    color: "#22d3ee",
  },

  "Store Management": {
    icon: Store,
    bg: "rgba(244, 114, 182, 0.1)",
    color: "#f472b6",
  },

  "Discount Management": {
    icon: Percent,
    bg: "rgba(236, 72, 153, 0.1)",
    color: "#ec4899",
  },
};

const DEFAULT_ACTIVITY_STYLE = {
  icon: FileText,
  bg: "rgba(148, 163, 184, 0.1)",
  color: "#94a3b8",
};

function ActivityIcon({ category, size = "sm" }) {
  const style =
    ACTIVITY_STYLES[category] || DEFAULT_ACTIVITY_STYLE;

  const IconComponent = style.icon;

  const sizeClasses = {
    xs: "w-6 h-6",
    sm: "w-7 h-7",
    md: "w-8 h-8",
  };

  const iconSizes = {
    xs: "w-3 h-3",
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center shrink-0`}
      style={{ backgroundColor: style.bg }}
    >
      <IconComponent
        className={iconSizes[size]}
        style={{ color: style.color }}
        strokeWidth={1.75}
      />
    </div>
  );
}

function getActivityColor(category) {
  const style =
    ACTIVITY_STYLES[category] || DEFAULT_ACTIVITY_STYLE;

  return {
    bg: style.bg,
    color: style.color,
  };
}

function getFilteredActivities(activities, activeTab) {
  if (!activities || !Array.isArray(activities)) return [];

  if (activeTab === "all") return activities;

  if (activeTab === "employee") {
    return activities.filter(
      (act) =>
        act.category === "Employee Management" ||
        (act.action &&
          act.action.toLowerCase().includes("employee"))
    );
  }

  if (activeTab === "brand") {
    return activities.filter(
      (act) =>
        act.category === "Store Management" ||
        (act.action &&
          act.action.toLowerCase().includes("brand"))
    );
  }

  if (activeTab === "product") {
    return activities.filter(
      (act) =>
        act.category === "Product Management" ||
        (act.action &&
          act.action.toLowerCase().includes("product"))
    );
  }

  if (activeTab === "category") {
    return activities.filter(
      (act) =>
        act.action &&
        act.action.toLowerCase().includes("category")
    );
  }

  if (activeTab === "discount") {
    return activities.filter(
      (act) =>
        act.category === "Discount Management" ||
        (act.action &&
          act.action.toLowerCase().includes("discount"))
    );
  }

  return activities;
}

// ==========================================
// SCROLLABLE TABS
// ==========================================
function ScrollableTabs({
  tabs,
  activeTab,
  onTabChange,
}) {
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    if (!scrollRef.current) return;

    const activeBtn =
      scrollRef.current.querySelector(
        '[data-active="true"]'
      );

    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeTab]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current =
      e.pageX - scrollRef.current.offsetLeft;

    scrollLeft.current =
      scrollRef.current.scrollLeft;

    scrollRef.current.style.cursor = "grabbing";
    scrollRef.current.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;

    e.preventDefault();

    const x =
      e.pageX - scrollRef.current.offsetLeft;

    const walk =
      (x - startX.current) * 1.5;

    scrollRef.current.scrollLeft =
      scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    isDragging.current = false;

    if (scrollRef.current) {
      scrollRef.current.style.cursor = "grab";
      scrollRef.current.style.userSelect = "";
    }
  };

  return (
    <div className="relative">
      <div
        className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, var(--bg-secondary), transparent)",
        }}
      />

      <div
        className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
        style={{
          background:
            "linear-gradient(to left, var(--bg-secondary), transparent)",
        }}
      />

      <div
        ref={scrollRef}
        className="flex items-end gap-6 pb-0 overflow-x-auto cursor-grab active:cursor-grabbing no-scrollbar"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id;

          return (
            <button
              key={tab.id}
              data-active={
                isActive ? "true" : "false"
              }
              onClick={() =>
                onTabChange(tab.id)
              }
              className="relative text-[13px] font-medium px-1 py-3 transition-all duration-200 whitespace-nowrap flex items-center gap-2 shrink-0 group"
              style={{
                color: isActive
                  ? "var(--accent)"
                  : "var(--text-muted)",
                borderBottom: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              }}
            >
              <tab.icon
                className={`w-4 h-4 transition-colors ${
                  isActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
                }`}
              />

              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          backgroundColor:
            "var(--border-color)",
        }}
      />
    </div>
  );
}

// ==========================================
// MAIN EMPLOYEE DETAIL PAGE
// ==========================================
export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();

  const employeeId = params.id;

  const queryClient =
    useQueryClient();

  const { markSelfAction } =
    useEmployeeSocketSync(employeeId);

  const [activeTab, setActiveTab] =
    useState("all");

  const [showEditModal, setShowEditModal] =
    useState(false);

  const [
    showPermissionsModal,
    setShowPermissionsModal,
  ] = useState(false);

  const [formData, setFormData] =
    useState({
      name: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });

  // ==========================================
  // ✅ DEALS ADDED HERE
  // ==========================================
  const [
    permissionsData,
    setPermissionsData,
  ] = useState({
    employees: true,
    products: true,
    brands: true,
    categories: true,
    discounts: true,
    deals: true,
    profile: true,
    store: false,
  });

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [currentUser, setCurrentUser] =
    useState(null);

  // ==========================================
  // CURRENT USER
  // ==========================================
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUserId =
        localStorage.getItem(
          "current_staff_id"
        );

      if (storedUserId) {
        setCurrentUser({
          _id: storedUserId,
        });
      }
    }
  }, []);

  // ==========================================
  // GET EMPLOYEE
  // ==========================================
  const {
    data: employee,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      "employee",
      employeeId,
    ],

    queryFn: () => {
      if (!employeeId) {
        throw new Error(
          "No Employee ID provided"
        );
      }

      return employeeApi.getById(
        employeeId
      );
    },

    enabled: !!employeeId,
    retry: 1,
    staleTime: 0,
    refetchInterval: false,
  });

  // ==========================================
  // UPDATE EMPLOYEE
  // ==========================================
  const updateMutation =
    useMutation({
      mutationFn: (data) =>
        employeeApi.update(
          employeeId,
          data
        ),

      onSuccess: async (
        updatedEmployee
      ) => {
        markSelfAction();

        if (
          updatedEmployee &&
          updatedEmployee._id
        ) {
          queryClient.setQueryData(
            ["employee", employeeId],
            updatedEmployee
          );
        }

        await queryClient.invalidateQueries(
          {
            queryKey: ["employees"],
          }
        );

        toast.success(
          "Employee updated successfully"
        );

        closeEditModal();
      },

      onError: (err) =>
        toast.error(
          err.message ||
            "Update failed"
        ),
    });

  // ==========================================
  // UPDATE PERMISSIONS
  // ==========================================
  const updatePermissionsMutation =
    useMutation({
      mutationFn: async (
        newPermissions
      ) => {
        console.log(
          "🚀 Sending permissions to backend:",
          newPermissions
        );

        const currentStaffId =
          typeof window !== "undefined"
            ? localStorage.getItem(
                "current_staff_id"
              )
            : null;

        const isSelf =
          String(currentStaffId) ===
            String(employeeId) ||
          (employee?.userId?._id &&
            String(currentStaffId) ===
              String(
                employee.userId._id
              ));

        if (isSelf) {
          throw new Error(
            "Security Restriction: You cannot modify your own permissions."
          );
        }

        return employeeApi.update(
          employeeId,
          {
            permissions:
              newPermissions,
          }
        );
      },

      onSuccess: async (
        updatedEmployee,
        newPermissions
      ) => {
        console.log(
          "✅ Backend response received:",
          updatedEmployee
        );

        queryClient.setQueryData(
          ["employee", employeeId],
          (oldData) => {
            if (!oldData)
              return updatedEmployee;

            const oldUserId =
              typeof oldData.userId ===
              "object"
                ? oldData.userId
                : {
                    _id:
                      oldData.userId,
                  };

            return {
              ...oldData,

              userId: {
                ...oldUserId,

                permissions:
                  newPermissions,
              },
            };
          }
        );

        markSelfAction();

        await queryClient.invalidateQueries(
          {
            queryKey: ["employees"],
          }
        );

        toast.success(
          "Permissions updated successfully"
        );

        setShowPermissionsModal(
          false
        );
      },

      onError: (err) => {
        console.error(
          "❌ Permission Update Error:",
          err
        );

        toast.error(
          err?.message ||
            "Failed to update permissions"
        );
      },
    });

  // ==========================================
  // CLOSE EDIT MODAL
  // ==========================================
  const closeEditModal = () => {
    setShowEditModal(false);

    setFormData({
      name: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ==========================================
  // OPEN EDIT MODAL
  // ==========================================
  const openEditModal = (emp) => {
    const userData =
      emp.userId || {};

    setFormData({
      name:
        userData.name ||
        emp.name ||
        "",

      email:
        userData.email ||
        emp.email ||
        "",

      phone:
        userData.phone ||
        emp.phone ||
        "",

      department:
        emp.department ||
        "",

      status:
        userData.status ||
        emp.status ||
        "active",

      password: "",
      confirmPassword: "",
    });

    setShowEditModal(true);
  };

  // ==========================================
  // SUBMIT EMPLOYEE UPDATE
  // ==========================================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return toast.error(
        "Name is required"
      );
    }

    if (!formData.email.trim()) {
      return toast.error(
        "Email is required"
      );
    }

    if (!formData.department.trim()) {
      return toast.error(
        "Department is required"
      );
    }

    if (
      formData.password &&
      formData.password.length < 6
    ) {
      return toast.error(
        "Password must be at least 6 characters"
      );
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      return toast.error(
        "Passwords do not match"
      );
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone || "",
      department:
        formData.department.trim(),
      status: formData.status,
    };

    if (formData.password) {
      payload.password =
        formData.password;
    }

    updateMutation.mutate(
      payload
    );
  };

  // ==========================================
  // LOADING
  // ==========================================
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="h-8 w-8 animate-spin"
            style={{
              color: "var(--accent)",
            }}
          />

          <p
            className="text-[13px]"
            style={{
              color:
                "var(--text-muted)",
            }}
          >
            Loading employee details...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // ERROR
  // ==========================================
  if (isError || !employee) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-500 opacity-60" />

        <p
          className="text-[14px] text-center max-w-md"
          style={{
            color:
              "var(--text-muted)",
          }}
        >
          Failed to load employee
          details.
          <br />

          <span className="text-[12px] text-red-400 block mt-2 bg-red-500/10 p-2 rounded">
            {error?.message ||
              "Employee not found"}
          </span>
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-gray-600 hover:bg-gray-800"
            style={{
              color:
                "var(--text-primary)",
            }}
          >
            Try Again
          </button>

          <button
            onClick={() =>
              router.back()
            }
            className="h-9 px-4 rounded-lg text-[13px] font-semibold"
            style={{
              backgroundColor:
                "var(--accent)",
              color:
                "var(--accent-text)",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // EMPLOYEE DATA
  // ==========================================
  const userData =
    employee.userId || {};

  const extractedStatus =
    userData.status ||
    employee.status ||
    "active";

  const {
    name =
      userData.name ||
      "Unknown",

    email =
      userData.email ||
      "N/A",

    phone =
      userData.phone ||
      "N/A",

    role =
      userData.role ||
      "staff",

    status =
      extractedStatus,

    avatar =
      userData.avatar ||
      null,

    created_at =
      employee.created_at ||
      null,

    department =
      employee.department ||
      "Not assigned",

    dateOfBirth =
      employee.dateOfBirth ||
      "Not provided",

    address =
      employee.address ||
      "Not provided",

    employeeId: empId =
      employee.employeeCode ||
      "N/A",

    ordersHandled =
      employee.ordersHandled ||
      0,

    salesGenerated =
      employee.salesGenerated ||
      0,

    productsAdded =
      employee.productsAdded ||
      0,

    performanceRating =
      employee.performanceRating ||
      0,

    activities =
      employee.activities ||
      [],

    permissions =
      userData.permissions ||
      {},
  } = employee;

  const joinDate = created_at
    ? new Date(
        created_at
      ).toLocaleDateString(
        "en-GB",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      )
    : "N/A";

  const cardStyle = {
    backgroundColor:
      "var(--bg-card)",
    border:
      "1px solid var(--border-color)",
    borderRadius: "12px",
  };

  const inputStyle = {
    backgroundColor:
      "var(--bg-card)",
    border:
      "1px solid var(--border-color)",
    color:
      "var(--text-primary)",
    borderRadius: "8px",
  };

  const isSubmitting =
    updateMutation.isPending;

  const isSelfView =
    String(
      currentUser?._id
    ) === String(employeeId) ||
    (employee?.userId?._id &&
      String(
        currentUser?._id
      ) ===
        String(
          employee.userId._id
        ));

  const canEditPermissions =
    !isSelfView;

  // ==========================================
  // TABS
  // ==========================================
  const tabs = [
    {
      id: "all",
      label: "Activity Log",
      icon: Clock,
    },

    {
      id: "employee",
      label: "Employee Activity",
      icon: Users,
    },

    {
      id: "brand",
      label: "Brand Activity",
      icon: Store,
    },

    {
      id: "product",
      label: "Product Activity",
      icon: Package,
    },

    {
      id: "category",
      label: "Category Activity",
      icon: Tag,
    },

    {
      id: "discount",
      label: "Discount Activity",
      icon: Percent,
    },

    {
      id: "permissions",
      label: "Permissions",
      icon: ShieldCheck,
    },
  ];

  const filteredActivities =
    getFilteredActivities(
      activities,
      activeTab
    );

  // ==========================================
  // PERMISSIONS
  // ==========================================
  const filteredPermissions =
    Object.entries(
      ALLOWED_PERMISSIONS
    ).map(
      ([key, config]) => ({
        key,
        label: config.label,

        value:
          permissions?.[key] !==
          undefined
            ? permissions[key]
            : config.default,
      })
    );

  const enabledCount =
    filteredPermissions.filter(
      (p) => p.value
    ).length;

  const totalCount =
    filteredPermissions.length;

  return (
    <div
      className="w-full min-h-screen space-y-6"
      style={{
        color:
          "var(--text-primary)",
      }}
    >
      {/* ==========================================
          HEADER
      ========================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              router.back()
            }
            className="p-2 rounded-lg transition hover:bg-white/5"
            style={{
              border:
                "1px solid var(--border-color)",
            }}
          >
            <ArrowLeft
              className="w-5 h-5"
              style={{
                color:
                  "var(--text-secondary)",
              }}
            />
          </button>

          <div className="flex items-center gap-2 text-[13px]">
            <span
              className="cursor-pointer hover:underline"
              style={{
                color:
                  "var(--text-muted)",
              }}
              onClick={() =>
                router.push(
                  "/admin/employees"
                )
              }
            >
              Employees
            </span>

            <span
              style={{
                color:
                  "var(--text-muted)",
              }}
            >
              /
            </span>

            <span
              className="font-medium flex items-center gap-2"
              style={{
                color:
                  "var(--text-primary)",
              }}
            >
              Employee Details

              {isFetching && (
                <Loader2
                  className="w-3 h-3 animate-spin"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                />
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              openEditModal(
                employee
              )
            }
            className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90"
            style={{
              backgroundColor:
                "#7c3aed",
              color: "#fff",
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Employee
          </button>
        </div>
      </div>

      {/* ==========================================
          MAIN GRID
      ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==========================================
            LEFT COLUMN
        ========================================== */}
        <div className="lg:col-span-1 space-y-4">
          {/* PROFILE CARD */}
          <div
            className="rounded-xl p-5 text-center"
            style={cardStyle}
          >
            <div className="flex flex-col items-center">
              <div className="relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={name}
                    className="h-24 w-24 rounded-full object-cover border-4"
                    style={{
                      borderColor:
                        "rgba(124,58,237,0.3)",
                    }}
                  />
                ) : (
                  <div
                    className="h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold"
                    style={{
                      backgroundColor:
                        "rgba(124,58,237,0.15)",
                      color: "#c084fc",
                      border:
                        "4px solid rgba(124,58,237,0.3)",
                    }}
                  >
                    {name
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                {status === "active" && (
                  <div
                    className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor:
                        "#34d399",
                      borderColor:
                        "var(--bg-card)",
                    }}
                  />
                )}
              </div>

              <h2 className="text-lg font-bold mt-3">
                {name}
              </h2>

              <div className="flex items-center gap-2 mt-1.5">
                <StatusBadge
                  status={status}
                />
              </div>

              <p
                className="text-[12px] mt-1"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                {department ||
                  role}
              </p>

              <div
                className="w-full mt-4 pt-4 border-t space-y-2.5 text-left"
                style={{
                  borderColor:
                    "var(--border-color)",
                }}
              >
                <div
                  className="flex items-center gap-2.5 text-[12px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  <IdCard className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {empId ||
                      "EMP-00000"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2.5 text-[12px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {email}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2.5 text-[12px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {phone ||
                      "N/A"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2.5 text-[12px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {address ||
                      "Not provided"}
                  </span>
                </div>

                <div
                  className="flex items-center gap-2.5 text-[12px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Joined on{" "}
                    {joinDate}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* EMPLOYEE INFORMATION */}
          <div
            className="rounded-xl p-4"
            style={cardStyle}
          >
            <h3
              className="text-[13px] font-semibold flex items-center gap-2 mb-3"
              style={{
                color:
                  "var(--text-primary)",
              }}
            >
              <User
                className="w-3.5 h-3.5"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              />

              Employee Information
            </h3>

            <div className="space-y-2.5">
              {[
                {
                  label: "Full Name",
                  value: name,
                },

                {
                  label: "Username",
                  value:
                    email.split(
                      "@"
                    )[0],
                },

                {
                  label: "Phone",
                  value:
                    phone || "N/A",
                },

                {
                  label: "Role",
                  value: role,
                  capitalize:
                    true,
                },

                {
                  label:
                    "Department",
                  value:
                    department,
                },

                {
                  label:
                    "Date of Birth",
                  value:
                    dateOfBirth,
                },

                {
                  label:
                    "Address",
                  value:
                    address,
                },
              ].map(
                (item, i) => (
                  <div
                    key={i}
                    className={
                      i > 0
                        ? "border-t pt-2"
                        : ""
                    }
                    style={{
                      borderColor:
                        "var(--border-color)",
                    }}
                  >
                    <p
                      className="text-[10px] mb-0.5"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {item.label}
                    </p>

                    <p
                      className={`text-[12px] font-medium ${
                        item.capitalize
                          ? "capitalize"
                          : ""
                      }`}
                    >
                      {item.value}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ==========================================
            RIGHT COLUMN
        ========================================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* STATS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label:
                  "Total Orders",
                value:
                  ordersHandled,
                icon:
                  ShoppingCart,
                color:
                  "#c084fc",
                bg:
                  "rgba(124,58,237,0.1)",
                link:
                  "View all orders →",
              },

              {
                label:
                  "Total Sales",
                value: `$${salesGenerated.toLocaleString()}`,
                icon:
                  DollarSign,
                color:
                  "#60a5fa",
                bg:
                  "rgba(59,130,246,0.1)",
                link:
                  "View sales →",
              },

              {
                label:
                  "Products Added",
                value:
                  productsAdded,
                icon:
                  Package,
                color:
                  "#34d399",
                bg:
                  "rgba(16,185,129,0.1)",
                link:
                  "View products →",
              },

              {
                label:
                  "Performance",
                value: `${performanceRating} / 5`,
                icon:
                  Star,
                color:
                  "#fbbf24",
                bg:
                  "rgba(251,191,36,0.1)",
                link:
                  "View reviews →",
              },
            ].map(
              (stat, i) => (
                <div
                  key={i}
                  className="rounded-xl p-3"
                  style={
                    cardStyle
                  }
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="p-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          stat.bg,
                      }}
                    >
                      <stat.icon
                        className="w-4 h-4"
                        style={{
                          color:
                            stat.color,
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="text-[10px] leading-tight truncate"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        {stat.label}
                      </p>

                      <p className="text-base font-bold leading-tight">
                        {stat.value}
                      </p>
                    </div>
                  </div>

                  <button
                    className="text-[10px] mt-1.5 flex items-center gap-0.5 hover:underline leading-tight"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    {stat.link}
                  </button>
                </div>
              )
            )}
          </div>

          {/* TABS */}
          <ScrollableTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={
              setActiveTab
            }
          />

          {/* ==========================================
              PERMISSIONS TAB
          ========================================== */}
          {activeTab ===
          "permissions" ? (
            <div
              className="rounded-xl p-6 animate-in fade-in duration-300"
              style={cardStyle}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3
                    className="text-[15px] font-bold flex items-center gap-2"
                    style={{
                      color:
                        "var(--text-primary)",
                    }}
                  >
                    <ShieldCheck className="w-5 h-5 text-purple-400" />

                    Access Control
                  </h3>

                  <p
                    className="text-[12px] mt-1"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    Manage module-level
                    access for this
                    employee
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p
                      className="text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      Access Level
                    </p>

                    <p className="text-sm font-bold text-emerald-400">
                      {Math.round(
                        (enabledCount /
                          totalCount) *
                          100
                      )}
                      % Enabled
                    </p>
                  </div>

                  {canEditPermissions && (
                    <button
                      onClick={() => {
                        const initialData =
                          {};

                        Object.keys(
                          ALLOWED_PERMISSIONS
                        ).forEach(
                          (key) => {
                            initialData[
                              key
                            ] =
                              permissions?.[
                                key
                              ] !==
                              undefined
                                ? permissions[
                                    key
                                  ]
                                : ALLOWED_PERMISSIONS[
                                    key
                                  ]
                                    .default;
                          }
                        );

                        setPermissionsData(
                          initialData
                        );

                        setShowPermissionsModal(
                          true
                        );
                      }}
                      className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-lg shadow-purple-900/20"
                      style={{
                        backgroundColor:
                          "#7c3aed",
                        color: "#fff",
                      }}
                    >
                      <Settings className="w-3.5 h-3.5" />

                      Configure Access
                    </button>
                  )}
                </div>
              </div>

              {isSelfView && (
                <div
                  className="mb-5 p-3 rounded-lg text-[12px] flex items-start gap-2"
                  style={{
                    backgroundColor:
                      "rgba(251,191,36,0.08)",
                    color:
                      "#fbbf24",
                    border:
                      "1px solid rgba(251,191,36,0.2)",
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />

                  <span>
                    <strong>
                      Security
                      Restriction:
                    </strong>{" "}
                    You cannot
                    modify your own
                    permissions.
                    Only another
                    admin or staff
                    member can
                    change them.
                  </span>
                </div>
              )}

              {totalCount > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredPermissions.map(
                    ({
                      key,
                      label,
                      value,
                    }) => (
                      <div
                        key={key}
                        className="group relative p-4 rounded-xl border transition-all duration-200 flex items-center justify-between hover:border-opacity-50"
                        style={{
                          backgroundColor:
                            value
                              ? "rgba(16,185,129,0.02)"
                              : "var(--bg-tertiary)",

                          borderColor:
                            value
                              ? "rgba(16,185,129,0.2)"
                              : "var(--border-color)",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                            style={{
                              backgroundColor:
                                value
                                  ? "rgba(16,185,129,0.1)"
                                  : "rgba(148, 163, 184, 0.1)",

                              color:
                                value
                                  ? "#34d399"
                                  : "#94a3b8",
                            }}
                          >
                            <ShieldCheck className="w-5 h-5" />
                          </div>

                          <div>
                            <span
                              className="text-[13px] font-bold block"
                              style={{
                                color:
                                  "var(--text-primary)",
                              }}
                            >
                              {label}
                            </span>

                            <span
                              className="text-[10px] block mt-0.5"
                              style={{
                                color:
                                  "var(--text-muted)",
                              }}
                            >
                              {value
                                ? "Full access granted"
                                : "Access restricted"}
                            </span>
                          </div>
                        </div>

                        <span
                          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border"
                          style={{
                            backgroundColor:
                              value
                                ? "rgba(16,185,129,0.1)"
                                : "rgba(239,68,68,0.1)",

                            color:
                              value
                                ? "#34d399"
                                : "#f87171",

                            border:
                              `1px solid ${
                                value
                                  ? "rgba(16,185,129,0.2)"
                                  : "rgba(239,68,68,0.2)"
                              }`,
                          }}
                        >
                          {value
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="text-center py-10">
                  <ShieldCheck
                    className="w-8 h-8 mx-auto opacity-30 mb-2"
                    style={{
                      color:
                        "var(--text-muted)",
                    }}
                  />

                  <p className="text-[13px] font-medium">
                    No permissions
                    configured
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ==========================================
               ACTIVITY
            ========================================== */
            <div className="space-y-6">
              <div
                className="rounded-xl p-4"
                style={cardStyle}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3
                    className="text-[13px] font-semibold flex items-center gap-2"
                    style={{
                      color:
                        "var(--text-primary)",
                    }}
                  >
                    {tabs.find(
                      (t) =>
                        t.id ===
                        activeTab
                    )?.icon &&
                      React.createElement(
                        tabs.find(
                          (t) =>
                            t.id ===
                            activeTab
                        ).icon,
                        {
                          className:
                            "w-4 h-4",

                          style: {
                            color:
                              "var(--text-muted)",
                          },
                        }
                      )}

                    {
                      tabs.find(
                        (t) =>
                          t.id ===
                          activeTab
                      )?.label
                    }

                    <span
                      className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1"
                      style={{
                        backgroundColor:
                          "rgba(16,185,129,0.15)",
                        color:
                          "#34d399",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{
                          backgroundColor:
                            "#34d399",
                        }}
                      />

                      LIVE
                    </span>
                  </h3>

                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor:
                        "var(--bg-tertiary)",
                      color:
                        "var(--text-muted)",
                    }}
                  >
                    {
                      filteredActivities.length
                    }{" "}
                    records
                  </span>
                </div>

                <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredActivities.length >
                  0 ? (
                    filteredActivities
                      .slice(0, 20)
                      .map(
                        (
                          activity,
                          index
                        ) => {
                          const colors =
                            getActivityColor(
                              activity.category
                            );

                          const activityTime =
                            new Date(
                              activity.timestamp
                            );

                          const isRecent =
                            Date.now() -
                              activityTime.getTime() <
                            60000;

                          const isLast =
                            index ===
                            Math.min(
                              filteredActivities.length,
                              20
                            ) -
                              1;

                          return (
                            <div
                              key={
                                activity._id ||
                                index
                              }
                              className="relative"
                            >
                              {!isLast && (
                                <div
                                  className="absolute left-[14px] top-[28px] bottom-[-4px] w-px"
                                  style={{
                                    backgroundColor:
                                      "var(--border-color)",
                                  }}
                                />
                              )}

                              <div
                                className="flex items-start gap-3 p-2 rounded-lg transition-all duration-500"
                                style={{
                                  backgroundColor:
                                    isRecent
                                      ? "rgba(16,185,129,0.05)"
                                      : "transparent",

                                  borderLeft:
                                    isRecent
                                      ? "2px solid #34d399"
                                      : "2px solid transparent",
                                }}
                              >
                                <div className="relative z-10 mt-0.5">
                                  <ActivityIcon
                                    category={
                                      activity.category
                                    }
                                    size="sm"
                                  />
                                </div>

                                <div className="flex-1 min-w-0 pt-0.5">
                                  <p className="text-[12px] font-medium leading-snug">
                                    {
                                      activity.action
                                    }
                                  </p>

                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                      style={{
                                        backgroundColor:
                                          colors.bg,
                                        color:
                                          colors.color,
                                      }}
                                    >
                                      {
                                        activity.category
                                      }
                                    </span>

                                    {activity.performedByName && (
                                      <>
                                        <span
                                          style={{
                                            color:
                                              "var(--text-muted)",
                                          }}
                                        >
                                          •
                                        </span>

                                        <span
                                          className="text-[10px]"
                                          style={{
                                            color:
                                              "var(--text-muted)",
                                          }}
                                        >
                                          by{" "}
                                          <span className="font-medium">
                                            {
                                              activity.performedByName
                                            }
                                          </span>
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  {activity.details?.changes &&
                                    activity
                                      .details
                                      .changes
                                      .length >
                                      0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {activity.details.changes
                                          .slice(
                                            0,
                                            3
                                          )
                                          .map(
                                            (
                                              change,
                                              i
                                            ) => (
                                              <span
                                                key={
                                                  i
                                                }
                                                className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                                                style={{
                                                  backgroundColor:
                                                    "var(--bg-tertiary)",
                                                  color:
                                                    "var(--text-muted)",
                                                  border:
                                                    "1px solid var(--border-color)",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    color:
                                                      "#f87171",
                                                  }}
                                                >
                                                  {String(
                                                    change.oldValue
                                                  ).slice(
                                                    0,
                                                    10
                                                  )}
                                                </span>

                                                <span className="mx-0.5">
                                                  →
                                                </span>

                                                <span
                                                  style={{
                                                    color:
                                                      "#34d399",
                                                  }}
                                                >
                                                  {String(
                                                    change.newValue
                                                  ).slice(
                                                    0,
                                                    10
                                                  )}
                                                </span>
                                              </span>
                                            )
                                          )}

                                        {activity.details.changes.length >
                                          3 && (
                                          <span
                                            className="px-1.5 py-0.5 rounded text-[9px]"
                                            style={{
                                              color:
                                                "var(--text-muted)",
                                            }}
                                          >
                                            +
                                            {activity
                                              .details
                                              .changes
                                              .length -
                                              3}{" "}
                                            more
                                          </span>
                                        )}
                                      </div>
                                    )}
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end gap-0.5 pt-0.5">
                                  <span
                                    className="text-[10px] whitespace-nowrap font-medium"
                                    style={{
                                      color:
                                        "var(--text-secondary)",
                                    }}
                                  >
                                    {activityTime.toLocaleDateString(
                                      "en-GB",
                                      {
                                        day: "2-digit",
                                        month:
                                          "short",
                                      }
                                    )}
                                  </span>

                                  <span
                                    className="text-[9px] whitespace-nowrap"
                                    style={{
                                      color:
                                        "var(--text-muted)",
                                    }}
                                  >
                                    {activityTime.toLocaleTimeString(
                                      "en-US",
                                      {
                                        hour:
                                          "2-digit",
                                        minute:
                                          "2-digit",
                                        hour12:
                                          true,
                                      }
                                    )}
                                  </span>

                                  {isRecent && (
                                    <span
                                      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold"
                                      style={{
                                        backgroundColor:
                                          "rgba(16,185,129,0.15)",
                                        color:
                                          "#34d399",
                                      }}
                                    >
                                      <span
                                        className="w-1 h-1 rounded-full animate-pulse"
                                        style={{
                                          backgroundColor:
                                            "#34d399",
                                        }}
                                      />

                                      LIVE
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                      )
                  ) : (
                    <div className="text-center py-10">
                      <div
                        className="inline-flex p-3 rounded-full mb-3"
                        style={{
                          backgroundColor:
                            "var(--bg-tertiary)",
                        }}
                      >
                        {React.createElement(
                          tabs.find(
                            (t) =>
                              t.id ===
                              activeTab
                          )?.icon ||
                            Clock,
                          {
                            className:
                              "w-5 h-5 opacity-40",

                            style: {
                              color:
                                "var(--text-muted)",
                            },
                          }
                        )}
                      </div>

                      <p
                        className="text-[13px] font-medium"
                        style={{
                          color:
                            "var(--text-primary)",
                        }}
                      >
                        No activity
                        found
                      </p>

                      <p
                        className="text-[11px] mt-1"
                        style={{
                          color:
                            "var(--text-muted)",
                        }}
                      >
                        {activeTab ===
                        "all"
                          ? "Changes will appear here in real-time"
                          : `No recent activities related to ${tabs
                              .find(
                                (t) =>
                                  t.id ===
                                  activeTab
                              )
                              ?.label.toLowerCase()}`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              PERFORMANCE
          ========================================== */}
          <div
            className="rounded-xl p-4"
            style={cardStyle}
          >
            <div className="flex items-center justify-between mb-3">
              <h3
                className="text-[13px] font-semibold flex items-center gap-2"
                style={{
                  color:
                    "var(--text-primary)",
                }}
              >
                <TrendingUp
                  className="w-4 h-4"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                />

                Performance Summary
              </h3>

              <select
                className="h-7 px-2 rounded text-[11px] font-medium appearance-none pr-6 cursor-pointer"
                style={{
                  border:
                    "1px solid var(--border-color)",
                  color:
                    "var(--text-secondary)",
                  backgroundColor:
                    "var(--bg-card)",
                }}
              >
                <option>
                  This Month
                </option>
                <option>
                  Last 30 Days
                </option>
                <option>
                  Last 90 Days
                </option>
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label:
                    "Orders Handled",
                  value:
                    ordersHandled,
                  trend:
                    "12%",
                },

                {
                  label:
                    "Sales Generated",
                  value: `$${salesGenerated.toLocaleString()}`,
                  trend:
                    "15%",
                },

                {
                  label:
                    "Products Added",
                  value:
                    productsAdded,
                  trend:
                    "8%",
                },
              ].map(
                (item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg"
                    style={{
                      backgroundColor:
                        "var(--bg-tertiary)",
                    }}
                  >
                    <p
                      className="text-[10px]"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {item.label}
                    </p>

                    <p className="text-base font-bold mt-0.5">
                      {item.value}
                    </p>

                    <p
                      className="text-[9px] mt-0.5 flex items-center gap-1"
                      style={{
                        color:
                          "#34d399",
                      }}
                    >
                      <TrendingUp className="w-2.5 h-2.5" />

                      {item.trend}
                    </p>
                  </div>
                )
              )}

              <div
                className="p-2.5 rounded-lg"
                style={{
                  backgroundColor:
                    "var(--bg-tertiary)",
                }}
              >
                <p
                  className="text-[10px]"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Customer Rating
                </p>

                <p className="text-base font-bold mt-0.5 flex items-center gap-1.5">
                  {performanceRating}

                  <span className="text-xs font-normal flex gap-0.5">
                    {[...Array(5)].map(
                      (_, i) => (
                        <span
                          key={i}
                          style={{
                            color:
                              i <
                              Math.floor(
                                performanceRating
                              )
                                ? "#fbbf24"
                                : "var(--text-muted)",
                          }}
                        >
                          ★
                        </span>
                      )
                    )}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          EDIT EMPLOYEE MODAL
      ========================================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-xl shadow-xl max-h-[95vh] flex flex-col"
            style={cardStyle}
          >
            <div
              className="px-5 py-4 flex items-center justify-between rounded-t-xl shrink-0"
              style={{
                borderBottom:
                  "1px solid var(--border-color)",
                backgroundColor:
                  "var(--bg-card)",
              }}
            >
              <div>
                <h3 className="text-base font-semibold">
                  Edit Employee
                  Details
                </h3>

                <p
                  className="text-[11px] mt-0.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Update team member
                  information
                </p>
              </div>

              <button
                onClick={
                  closeEditModal
                }
                disabled={
                  isSubmitting
                }
                className="p-1 rounded transition disabled:opacity-50 hover:opacity-70"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="p-5 space-y-4 overflow-y-auto flex-1"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Full Name *
                  </label>

                  <input
                    type="text"
                    value={
                      formData.name
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target
                          .value,
                      })
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50 transition focus:ring-1 focus:ring-purple-500/40"
                    style={
                      inputStyle
                    }
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Email *
                  </label>

                  <input
                    type="email"
                    value={
                      formData.email
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        email: e.target
                          .value,
                      })
                    }
                    required
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50 transition focus:ring-1 focus:ring-purple-500/40"
                    style={
                      inputStyle
                    }
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{
                    color:
                      "var(--text-secondary)",
                  }}
                >
                  Phone
                  (optional)
                </label>

                <input
                  type="tel"
                  value={
                    formData.phone
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target
                        .value,
                    })
                  }
                  disabled={
                    isSubmitting
                  }
                  className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50 transition focus:ring-1 focus:ring-purple-500/40"
                  style={inputStyle}
                  placeholder="+92 300 1234567"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    New Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        formData.password
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          password:
                            e.target
                              .value,
                        })
                      }
                      disabled={
                        isSubmitting
                      }
                      className="w-full h-9 px-3 pr-9 rounded-md text-sm outline-none disabled:opacity-50 transition focus:ring-1 focus:ring-purple-500/40"
                      style={
                        inputStyle
                      }
                      placeholder="New password"
                      minLength={6}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Confirm
                    Password
                  </label>

                  <div className="relative">
                    <input
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      value={
                        formData.confirmPassword
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword:
                            e.target
                              .value,
                        })
                      }
                      disabled={
                        isSubmitting
                      }
                      className="w-full h-9 px-3 pr-9 rounded-md text-sm outline-none disabled:opacity-50 transition focus:ring-1 focus:ring-purple-500/40"
                      style={
                        inputStyle
                      }
                      placeholder="Confirm new password"
                      minLength={6}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword
                        )
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2"
                      style={{
                        color:
                          "var(--text-muted)",
                      }}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Status
                  </label>

                  <select
                    value={
                      formData.status
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status:
                          e.target
                            .value,
                      })
                    }
                    disabled={
                      isSubmitting
                    }
                    className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50 cursor-pointer"
                    style={
                      inputStyle
                    }
                  >
                    <option value="active">
                      Active
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{
                      color:
                        "var(--text-secondary)",
                    }}
                  >
                    Department *
                  </label>

                  <DepartmentDropdown
                    value={
                      formData.department
                    }
                    onChange={(val) =>
                      setFormData({
                        ...formData,
                        department:
                          val,
                      })
                    }
                    disabled={
                      isSubmitting
                    }
                  />
                </div>
              </div>

              <div
                className="flex gap-3 pt-4 mt-2"
                style={{
                  borderTop:
                    "1px solid var(--border-color)",
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeEditModal
                  }
                  disabled={
                    isSubmitting
                  }
                  className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{
                    backgroundColor:
                      "var(--bg-tertiary)",
                    border:
                      "1px solid var(--border-color)",
                    color:
                      "var(--text-primary)",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting
                  }
                  className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
                  style={{
                    backgroundColor:
                      "#7c3aed",
                    color: "#fff",
                  }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Update Employee"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          PERMISSIONS EDIT MODAL
      ========================================== */}
      {showPermissionsModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={cardStyle}
          >
            <div
              className="px-6 py-4 flex items-center justify-between border-b"
              style={{
                borderColor:
                  "var(--border-color)",
              }}
            >
              <div>
                <h3 className="text-base font-bold">
                  Configure Access
                </h3>

                <p
                  className="text-[11px] mt-0.5"
                  style={{
                    color:
                      "var(--text-muted)",
                  }}
                >
                  Editing permissions
                  for{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {name}
                  </span>
                </p>
              </div>

              <button
                onClick={() =>
                  setShowPermissionsModal(
                    false
                  )
                }
                className="p-2 rounded-lg hover:bg-white/10 transition"
                style={{
                  color:
                    "var(--text-muted)",
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {Object.entries(
                ALLOWED_PERMISSIONS
              ).map(
                ([key, config]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 group"
                    style={{
                      borderColor:
                        permissionsData[
                          key
                        ]
                          ? "rgba(16,185,129,0.3)"
                          : "var(--border-color)",

                      backgroundColor:
                        permissionsData[
                          key
                        ]
                          ? "rgba(16,185,129,0.03)"
                          : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          backgroundColor:
                            permissionsData[
                              key
                            ]
                              ? "rgba(16,185,129,0.15)"
                              : "var(--bg-tertiary)",

                          color:
                            permissionsData[
                              key
                            ]
                              ? "#34d399"
                              : "var(--text-muted)",
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </div>

                      <span
                        className="text-[13px] font-semibold"
                        style={{
                          color:
                            "var(--text-primary)",
                        }}
                      >
                        {config.label}
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          permissionsData[
                            key
                          ] ??
                          config.default
                        }
                        onChange={(e) =>
                          setPermissionsData(
                            {
                              ...permissionsData,

                              [key]:
                                e.target
                                  .checked,
                            }
                          )
                        }
                        className="sr-only peer"
                      />

                      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                )
              )}
            </div>

            <div
              className="px-6 py-4 flex gap-3 border-t"
              style={{
                borderColor:
                  "var(--border-color)",
              }}
            >
              <button
                onClick={() =>
                  setShowPermissionsModal(
                    false
                  )
                }
                className="flex-1 h-10 rounded-lg text-sm font-semibold transition hover:bg-white/5 border"
                style={{
                  borderColor:
                    "var(--border-color)",
                  color:
                    "var(--text-primary)",
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const finalPermissions =
                    {};

                  Object.keys(
                    ALLOWED_PERMISSIONS
                  ).forEach(
                    (k) => {
                      finalPermissions[
                        k
                      ] = Boolean(
                        permissionsData[
                          k
                        ]
                      );
                    }
                  );

                  updatePermissionsMutation.mutate(
                    finalPermissions
                  );
                }}
                disabled={
                  updatePermissionsMutation.isPending
                }
                className="flex-1 h-10 rounded-lg text-sm font-bold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center shadow-lg shadow-purple-900/20"
                style={{
                  backgroundColor:
                    "#7c3aed",
                  color: "#fff",
                }}
              >
                {updatePermissionsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save Permissions"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          GLOBAL STYLES
      ========================================== */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(
            156,
            163,
            175,
            0.2
          );
          border-radius: 20px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(
            156,
            163,
            175,
            0.4
          );
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}