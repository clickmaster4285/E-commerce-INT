"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus, Search, ChevronLeft, ChevronRight, Pencil, Trash2, AlertTriangle, X,
  Users, Loader2, SortAsc, SortDesc, Eye, EyeOff, ChevronDown, MoreVertical, Info,
  UploadCloud, ImagePlus
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { employeeDepartmentLabel, employeeLocaleTag } from "@/i18n/localize";

import { employeeApi } from "@/apis/admin/employeeApi";
import adminHttp from "@/apis/axiosInstance";
import { employeeSocketApi, useEmployeeSocketSync } from "@/hooks/admin/useAdminSocket";

const ITEMS_PER_PAGE = 20;
const PREDEFINED_DEPARTMENTS = ["HR", "Manager", "IT", "Finance", "Marketing", "Customer Service"];

// ==========================================
// AVATAR HELPERS
// ==========================================
const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp";
const AVATAR_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

// Server par relative path ho to absolute URL bana do
// (data URL / http URL / Google picture as-is chalti hai)
const resolveAvatarUrl = (value) => {
  if (!value || typeof value !== "string") return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  // Sirf `NEXT_PUBLIC_SERVERURL` — `NEXT_PUBLIC_API_URL` kabhi define nahi hua,
  // to woh `||` fallback hamesha `undefined` hi deta tha (dead code).
  const serverUrl = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
  return `${serverUrl}/${value.replace(/^\//, "")}`;
};

const avatarInitial = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.employees)) return response.employees;
  return [];
};

// ==========================================
// DEPARTMENT DROPDOWN COMPONENT (UPDATED)
// ==========================================
function DepartmentDropdown({ value, onChange, disabled }) {
  const { t, locale } = useTranslation();
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Sync external value changes
  useEffect(() => { if (value !== undefined) setInputValue(value || ""); }, [value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val); // Update parent state immediately
    setIsOpen(true);
  };

  const handleSelectOption = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    setIsInputFocused(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
        // If user hits enter, we accept current input (even if custom)
        setIsOpen(false);
    }
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "ArrowDown") { e.preventDefault(); setIsOpen(true); }
  };

  // Check if current input matches any existing department
  const exactMatch = PREDEFINED_DEPARTMENTS.some((d) =>
    d.toLowerCase() === inputValue.trim().toLowerCase() ||
    employeeDepartmentLabel(d, t).toLowerCase() === inputValue.trim().toLowerCase()
  );
  const hasInput = inputValue.trim().length > 0;

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
          value={!isInputFocused && PREDEFINED_DEPARTMENTS.includes(inputValue) ? employeeDepartmentLabel(inputValue, t) : inputValue}
          onChange={handleInputChange}
          onFocus={() => { setIsInputFocused(true); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={t("admin.employees.form.departmentPlaceholder")}
          disabled={disabled}
          className="w-full h-8 pl-3 pr-7 rounded-md text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:opacity-50"
          style={inputStyle}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5"
          style={{ color: "var(--text-muted)" }}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mb-1 rounded-md shadow-lg overflow-hidden py-1"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
            bottom: "100%",
          }}
        >
          {/* LOGIC: Show "No matching" ONLY if user typed something AND it's not an exact match */}
          {hasInput && !exactMatch && (
            <div className="px-3 py-2 text-xs font-medium flex items-center gap-2 opacity-60 cursor-default select-none border-b border-dashed" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
              <Info className="w-3 h-3" /> {t("admin.employees.form.noDepartments")}
            </div>
          )}

          {/* Filtered List of Existing Departments */}
          {PREDEFINED_DEPARTMENTS.filter((d) =>
            d.toLowerCase().includes(inputValue.toLowerCase()) ||
            employeeDepartmentLabel(d, t).toLowerCase().includes(inputValue.toLowerCase())
          ).map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => handleSelectOption(dept)}
              className="w-full text-left px-3 py-2 text-[13px] transition hover:bg-white/5"
              style={{
                color: "var(--text-primary)",
                backgroundColor: inputValue === dept ? "var(--success-soft)" : "transparent",
              }}
            >
              {employeeDepartmentLabel(dept, t)}
            </button>
          ))}

          {/* Custom Create Option */}
          {hasInput && !exactMatch && (
            <div
              className="px-3 py-2 text-[12px] font-medium border-t mt-1 flex items-center gap-2"
              style={{ borderColor: "var(--border-color)", color: "var(--success-text)" }}
            >
              <Plus className="w-3 h-3" /> {t("admin.employees.form.creatingNew", { name: inputValue.trim() })}
            </div>
          )}
          
          {/* Empty State if no filter matches and no custom input */}
          {!hasInput && PREDEFINED_DEPARTMENTS.length === 0 && (
             <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>{t("admin.employees.form.noDepartmentsAvailable")}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== DROPDOWN MENU ITEM ==================== */
const MenuItem = ({ icon, label, onClick, danger }) => (
  <button
    role="menuitem"
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-white/5 ${danger ? "text-red-400 hover:bg-red-500/10" : ""}`}
    style={{ color: danger ? undefined : "var(--text-primary)" }}
  >
    {icon} {label}
  </button>
);

// ==========================================
// MAIN EMPLOYEE PAGE COMPONENT
// ==========================================
export default function EmployeesPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  useEmployeeSocketSync();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionMenu, setActionMenu] = useState(null); 

  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ Current user (role + permissions) — actions isi par gate honge
  const { data: currentUserProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await adminHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isCurrentAdmin = String(currentUserProfile?.role || "").toLowerCase() === "admin";
  // ✅ Jis ko 'employees' permission hai wahi add/edit/delete kar sakta hai
  const canManageEmployees = isCurrentAdmin || currentUserProfile?.permissions?.employees !== false;
  const denyEmployeesAccess = () =>
    toast.error(t("admin.employees.toast.accessDenied"), {
      duration: 5000,
      description: t("admin.employees.toast.accessDeniedBody"),
    });

  // Phone validation state for tooltip
  const [phoneError, setPhoneError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    status: "active",
    password: "",
    confirmPassword: "",
  });

  // ===== AVATAR / PROFILE PICTURE (drag & drop) =====
  const avatarInputRef = useRef(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [isAvatarDragOver, setIsAvatarDragOver] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const resetAvatarState = (preview = "") => {
    setAvatarFile(null);
    setAvatarPreview(preview);
    setAvatarRemoved(false);
    setAvatarError("");
    setIsAvatarDragOver(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ✅ Server-side pagination for employees
  const { data: paginatedEmployeesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["employees", "paginated", currentPage, debouncedSearch, filterStatus],
    queryFn: () => employeeApi.getAllPaginated({ page: currentPage, limit: ITEMS_PER_PAGE, search: debouncedSearch, status: filterStatus === "all" ? "" : filterStatus, department: "" }),
    staleTime: 60 * 1000,
    retry: 2,
  });
  const employees = paginatedEmployeesData?.items || paginatedEmployeesData || normalizeArrayResponse(paginatedEmployeesData);
  const pagination = paginatedEmployeesData?.pagination || { total: employees.length, page: currentPage, limit: ITEMS_PER_PAGE, pages: 1, hasNext: false, hasPrev: false };

  const staffEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const role = emp.userId?.role || emp.role;
      return role === "staff" || !emp.userId;
    });
  }, [employees]);

  const createMutation = useMutation({
    mutationFn: employeeSocketApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("admin.employees.toast.created"));
      closeModal();
    },
    onError: () => toast.error(t("admin.employees.toast.createFailed")),
  });

  const updateMutation = useMutation({
    mutationFn: employeeSocketApi.update,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("admin.employees.toast.updated"));
      closeModal();
    },
    onError: () => toast.error(t("admin.employees.toast.updateFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: employeeSocketApi.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("admin.employees.toast.deleted"));
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      setSelectedIds([]);
    },
    onError: () => toast.error(t("admin.employees.toast.deleteFailed")),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => employeeSocketApi.delete(id))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("admin.employees.toast.bulkDeleted", { count: new Intl.NumberFormat(employeeLocaleTag(locale)).format(selectedIds.length) }));
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
    },
    onError: () => toast.error(t("admin.employees.toast.bulkDeleteFailed")),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: employeeSocketApi.toggleStatus,
    onSuccess: async (updatedEmployee) => {
      queryClient.setQueryData(["employees"], (oldData) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.map((emp) => emp._id === updatedEmployee._id ? updatedEmployee : emp);
      });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(t("admin.employees.toast.statusUpdated"));
    },
    onError: (err) => {
      console.error("❌ Toggle Status Error:", err);
      toast.error(t("admin.employees.toast.statusUpdateFailed"));
    },
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData({
      name: "",
      username: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhoneError("");
    resetAvatarState();
  };

  const openAddModal = () => {
    if (!canManageEmployees) return denyEmployeesAccess();
    setEditingEmployee(null);
    setFormData({
      name: "",
      username: "",
      email: "",
      phone: "",
      department: "",
      status: "active",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhoneError("");
    resetAvatarState();
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    if (!canManageEmployees) return denyEmployeesAccess();
    setEditingEmployee(emp);
    setFormData({
      name: emp.userId?.name || emp.name || "",
      username: emp.username || "",
      email: emp.userId?.email || emp.email || "",
      phone: emp.userId?.phone || emp.phone || "",
      department: emp.department || "",
      status: emp.userId?.status || emp.status || "active",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPhoneError("");
    resetAvatarState(resolveAvatarUrl(emp.userId?.avatar || emp.avatar));
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error(t("admin.employees.toast.nameRequired"));
    if (!formData.username.trim()) return toast.error(t("admin.employees.toast.usernameRequired"));
    const username = formData.username.trim().toLowerCase();
    if (username.length < 3) return toast.error(t("admin.employees.toast.usernameMinLength"));
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return toast.error(t("admin.employees.toast.usernameFormat"));
    if (!formData.email.trim()) return toast.error(t("admin.employees.toast.emailRequired"));
    if (!formData.department.trim()) return toast.error(t("admin.employees.toast.departmentRequired"));

    const phoneDigits = formData.phone.replace(/\D/g, "");
    if (phoneDigits && phoneDigits.length < 6) return toast.error(t("admin.employees.toast.phoneMinLength"));
    if (phoneDigits.length > 15) return toast.error(t("admin.employees.toast.phoneMaxLength"));

    if (!editingEmployee) {
      if (!formData.password) return toast.error(t("admin.employees.toast.passwordRequired"));
      if (formData.password.length < 6) return toast.error(t("admin.employees.toast.passwordMinLength"));
      if (formData.password !== formData.confirmPassword) {
        return toast.error(t("admin.employees.toast.passwordMismatch"));
      }
    } else if (formData.password || formData.confirmPassword) {
      if (!formData.password) return toast.error(t("admin.employees.toast.passwordRequired"));
      if (!formData.confirmPassword) return toast.error(t("admin.employees.toast.confirmPasswordRequired"));
      if (formData.password.length < 6) return toast.error(t("admin.employees.toast.passwordMinLength"));
      if (formData.password !== formData.confirmPassword) {
        return toast.error(t("admin.employees.toast.passwordMismatch"));
      }
    }

    const payload = {
      name: formData.name.trim(),
      username,
      email: formData.email.trim(),
      phone: formData.phone || "",
      department: formData.department.trim(),
      status: formData.status,
      role: "staff",
    };

    if (formData.password) {
      payload.password = formData.password;
    }

    // Avatar: nayi picture drag/drop hui hai → base64 bhejo, warna purani waise hi rahegi
    if (avatarFile) {
      payload.avatarBase64 = avatarPreview;
      payload.avatarFileName = avatarFile.name;
    } else if (avatarRemoved) {
      payload.avatar = "";
    }

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleStatus = (employee) => {
    if (!canManageEmployees) return denyEmployeesAccess();
    toggleStatusMutation.mutate(employee._id);
  };

  const handleBulkDelete = () => {
    if (!canManageEmployees) return denyEmployeesAccess();
    if (selectedIds.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedIds);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <SortAsc className="w-3 h-3 inline ml-1" />
    ) : (
      <SortDesc className="w-3 h-3 inline ml-1" />
    );
  };

  const paginatedEmployees = employees; 
  const totalPages = pagination.pages || 1;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenu]);

  const allSelected =
    paginatedEmployees.length > 0 &&
    paginatedEmployees.every((emp) => selectedIds.includes(emp._id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !paginatedEmployees.some((e) => e._id === id)));
    } else {
      const newIds = paginatedEmployees.map((e) => e._id);
      setSelectedIds([...new Set([...selectedIds, ...newIds])]);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: "12px",
  };
  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
    borderRadius: "8px",
  };
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // ==========================================
  // AVATAR HANDLERS (drag & drop / browse)
  // ==========================================
  const pickAvatarFile = (file) => {
    if (!file) return;

    const type = String(file.type || "").toLowerCase();
    if (!AVATAR_ALLOWED_TYPES.includes(type)) {
      setAvatarError("Only PNG, JPG or WEBP images are allowed");
      toast.error(t("admin.employees.toast.imageType"));
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("Image is too large — max 2 MB allowed");
      toast.error(t("admin.employees.toast.imageTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarFile(file);
      setAvatarPreview(typeof reader.result === "string" ? reader.result : "");
      setAvatarRemoved(false);
      setAvatarError("");
    };
    reader.onerror = () => {
      setAvatarError("Could not read that image, please try another one");
      toast.error(t("admin.employees.toast.imageReadError"));
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarInputChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // same file dobara select kar sakein
    pickAvatarFile(file);
  };

  const handleAvatarDragOver = (e) => {
    e.preventDefault();
    if (!isSubmitting) setIsAvatarDragOver(true);
  };

  const handleAvatarDragLeave = (e) => {
    e.preventDefault();
    setIsAvatarDragOver(false);
  };

  const handleAvatarDrop = (e) => {
    e.preventDefault();
    setIsAvatarDragOver(false);
    if (isSubmitting) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) {
      setAvatarError("No image detected in the dropped item");
      return;
    }
    pickAvatarFile(file);
  };

  const handleAvatarRemove = () => {
    if (isSubmitting) return;
    setAvatarFile(null);
    setAvatarPreview("");
    setAvatarRemoved(true);
    setAvatarError("");
    toast.info(t("admin.employees.toast.pictureWillBeRemoved"));
  };

  /* ===== PROFESSIONAL ACTION BUTTONS WITH 3-DOT MENU ===== */
  const ActionButtons = ({ employee }) => {
    const id = employee._id;
    const open = actionMenu?.id === id;

    const toggleMenu = (e) => {
      e.stopPropagation();
      if (open) { setActionMenu(null); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 160; 
      const menuWidth = 176;
      const top = rect.bottom + 6 + menuHeight > window.innerHeight
        ? rect.top - 6 - menuHeight
        : rect.bottom + 6;
      const left = Math.max(8, rect.right - menuWidth);
      setActionMenu({ id, top, left });
    };

    return (
      <div className="flex items-center justify-end">
        <button
          onClick={toggleMenu}
          aria-label={t("admin.employees.form.actionsFor", { name: employee.userId?.name || employee.name })}
          aria-haspopup="menu"
          aria-expanded={open}
          className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
          style={{ color: "var(--text-secondary)" }}
          title={t("admin.employees.page.actions")}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActionMenu(null); }} />
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 w-44 rounded-lg shadow-xl border py-1"
              style={{
                top: actionMenu.top,
                left: actionMenu.left,
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-color)",
              }}
            >
              <MenuItem
                icon={<Eye className="w-4 h-4" />}
                label={t("admin.employees.page.viewDetails")}
                onClick={() => { setActionMenu(null); router.push(`/admin/employees/${id}`); }}
              />
              <MenuItem
                icon={<Pencil className="w-4 h-4" />}
                label={t("admin.employees.page.editEmployee")}
                onClick={() => { setActionMenu(null); if (!canManageEmployees) return denyEmployeesAccess(); openEditModal(employee); }}
              />
              <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
              <MenuItem
                icon={<Trash2 className="w-4 h-4" />}
                label={t("admin.employees.page.delete")}
                danger
                onClick={() => { setActionMenu(null); if (!canManageEmployees) return denyEmployeesAccess(); setEmployeeToDelete(employee); setShowDeleteModal(true); }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {t("admin.employees.page.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500 opacity-60" />
        <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>
          {t("admin.employees.page.loadFailed")}
          <br />
          <span className="text-[12px]">{error?.message}</span>
        </p>
        <button
          onClick={() => refetch()}
          className="h-10 px-4 min-w-[44px] min-h-[44px] rounded-lg text-[13px] font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
        >
          {t("admin.employees.page.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen space-y-5" style={{ color: "var(--text-primary)" }}>
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{t("admin.employees.page.title")}</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
            {t("admin.employees.page.subtitle")}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="h-9 px-4 min-w-[44px] min-h-[44px] rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
        >
          <Plus className="w-4 h-4" /> {t("admin.employees.page.addEmployee")}
        </button>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: t("admin.employees.page.total"), value: staffEmployees.length, color: "var(--text-primary)" },
          { label: t("admin.employees.page.active"), value: staffEmployees.filter((e) => (e.userId?.status || e.status) === "active").length, color: "var(--success-text)" },
          { label: t("admin.employees.page.inactive"), value: staffEmployees.filter((e) => (e.userId?.status || e.status) === "inactive").length, color: "var(--danger-text)" },
        ].map((stat, idx) => (
          <div key={idx} className="rounded-lg px-4 py-3" style={cardStyle}>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {stat.label}
            </p>
            <p className="text-[20px] font-bold mt-0.5" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative w-full md:w-[400px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder={t("admin.employees.page.searchPlaceholder")}
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
            style={inputStyle} 
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="appearance-none h-9 w-full sm:w-[160px] px-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer"
            style={inputStyle}
          >
            <option value="all">{t("admin.employees.page.allStatus")}</option>
            <option value="active">{t("admin.employees.page.active")}</option>
            <option value="inactive">{t("admin.employees.page.inactive")}</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div
          className="flex items-center justify-between rounded-lg px-4 h-10"
          style={{
            backgroundColor: "var(--success-soft)",
            border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--success-text)" }}>
            {t("admin.employees.page.selected", { count: new Intl.NumberFormat(employeeLocaleTag(locale)).format(selectedIds.length) })}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium transition hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              {t("admin.employees.page.clear")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="h-9 min-w-[44px] min-h-[44px] px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--danger)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("admin.employees.page.deleteSelected")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[600px]">
            <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("name")}>
                  {t("admin.employees.page.employee")} {getSortIcon("name")}
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("email")}>
                  {t("admin.employees.page.email")} {getSortIcon("email")}
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("department")}>
                  {t("admin.employees.page.department")} {getSortIcon("department")}
                </th>
                <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80" style={{ color: "var(--text-muted)" }} onClick={() => handleSort("status")}>
                  {t("admin.employees.page.status")} {getSortIcon("status")}
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  {t("admin.employees.page.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                    <Users className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    {t("admin.employees.page.noEmployees")}
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => {
                  const isSelected = selectedIds.includes(emp._id);
                  const empName = emp.userId?.name || emp.name || "Unknown";
                  const empEmail = emp.userId?.email || emp.email || "N/A";
                  const empStatus = emp.userId?.status || emp.status || "active";
                  const empAvatar = resolveAvatarUrl(emp.userId?.avatar || emp.avatar);

                  return (
                    <tr
                      key={emp._id}
                      className="transition cursor-pointer"
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                      }}
                      onClick={(e) => {
                        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                        router.push(`/admin/employees/${emp._id}`);
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)";
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(emp._id)}
                          className="w-4 h-4 rounded cursor-pointer"
                          style={{ accentColor: "var(--accent)" }}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {empAvatar ? (
                            <img
                              src={empAvatar}
                              alt={empName}
                              className="h-8 w-8 rounded-full object-cover shrink-0 border"
                              style={{ borderColor: "var(--border-color)" }}
                            />
                          ) : (
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                              style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}
                            >
                              {empName?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[13px] truncate max-w-[140px]">
                            {empName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        {empEmail}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          {employeeDepartmentLabel(emp.department, t) || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                         <span
                          className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                          style={
                            empStatus === "active"
                              ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }
                              : { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }
                          }
                        >
                          {empStatus === "active" ? t("admin.employees.page.active") : t("admin.employees.page.inactive")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap w-1">
                        <ActionButtons employee={emp} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.total > ITEMS_PER_PAGE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            {t("admin.employees.page.showingRange", {
              from: new Intl.NumberFormat(employeeLocaleTag(locale)).format((currentPage - 1) * ITEMS_PER_PAGE + 1),
              to: new Intl.NumberFormat(employeeLocaleTag(locale)).format(Math.min(currentPage * ITEMS_PER_PAGE, pagination.total || employees.length)),
              total: new Intl.NumberFormat(employeeLocaleTag(locale)).format(pagination.total || employees.length),
            })}
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="hidden sm:inline-flex px-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              {t("admin.employees.page.pageOf", {
                page: new Intl.NumberFormat(employeeLocaleTag(locale)).format(currentPage),
                total: new Intl.NumberFormat(employeeLocaleTag(locale)).format(totalPages),
              })}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 min-w-[44px] min-h-[44px] rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <div>
                <h3 className="text-base font-semibold">{editingEmployee ? t("admin.employees.form.editTitle") : t("admin.employees.form.addTitle")}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {editingEmployee ? t("admin.employees.form.editSubtitle") : t("admin.employees.form.addSubtitle")}
                </p>
              </div>
              <button onClick={closeModal} disabled={isSubmitting} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto flex-1">
              {/* ── PROFILE PICTURE (drag & drop) ── */}
              <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <ImagePlus className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.profilePicture")}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                    >
                      {t("admin.employees.form.optional")}
                    </span>
                  </div>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleAvatarRemove}
                      disabled={isSubmitting}
                      className="text-[11px] font-medium transition disabled:opacity-50 hover:opacity-80"
                      style={{ color: "var(--danger-text)" }}
                    >
                      {t("admin.employees.form.remove")}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  {/* Live preview */}
                  <div className="relative shrink-0">
                    <div
                      className="h-[72px] w-[72px] rounded-full overflow-hidden flex items-center justify-center"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        border: isAvatarDragOver
                          ? "2px dashed var(--accent)"
                          : avatarPreview
                            ? "2px solid var(--accent)"
                            : "2px dashed var(--border-color)",
                      }}
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt={t("admin.employees.form.profilePicturePreview")}
                          className="h-full w-full object-cover"
                          onError={() => {
                            setAvatarPreview("");
                            setAvatarFile(null);
                            setAvatarError("That image could not be previewed, please try another one");
                          }}
                        />
                      ) : (
                        <span className="text-[24px] font-bold" style={{ color: "var(--text-muted)" }}>
                          {avatarInitial(formData.name)}
                        </span>
                      )}
                    </div>
                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleAvatarRemove}
                        disabled={isSubmitting}
                        title={t("admin.employees.form.removePicture")}
                        aria-label={t("admin.employees.form.removeProfilePicture")}
                        className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full flex items-center justify-center shadow-md transition disabled:opacity-50 hover:opacity-90"
                        style={{ backgroundColor: "var(--danger)", color: "#fff", border: "2px solid var(--bg-tertiary)" }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Dropzone */}
                  <div className="flex-1 min-w-0">
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={t("admin.employees.form.uploadProfilePicture")}
                      onClick={() => { if (!isSubmitting) avatarInputRef.current?.click(); }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !isSubmitting) {
                          e.preventDefault();
                          avatarInputRef.current?.click();
                        }
                      }}
                      onDragEnter={handleAvatarDragOver}
                      onDragOver={handleAvatarDragOver}
                      onDragLeave={handleAvatarDragLeave}
                      onDrop={handleAvatarDrop}
                      className={`rounded-lg border-2 border-dashed px-3 py-3 text-center transition-all duration-200 ${isSubmitting ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                      style={{
                        borderColor: isAvatarDragOver ? "var(--accent)" : "var(--border-color)",
                        backgroundColor: isAvatarDragOver ? "var(--accent-soft)" : "var(--bg-card)",
                      }}
                    >
                      <UploadCloud
                        className={`mx-auto h-4 w-4 mb-1 transition-transform duration-200 ${isAvatarDragOver ? "scale-110" : ""}`}
                        style={{ color: isAvatarDragOver ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <p className="text-[11.5px] leading-4" style={{ color: "var(--text-secondary)" }}>
                        <span className="font-semibold" style={{ color: "var(--accent)" }}>{t("admin.employees.form.dragDrop")}</span> {t("admin.employees.form.photoHereOr")}{" "}
                        <span className="font-semibold underline" style={{ color: "var(--text-primary)" }}>{t("admin.employees.form.browse")}</span>
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {t("admin.employees.form.dropzoneHint")}
                      </p>
                    </div>
                    {avatarError && (
                      <p className="text-[10.5px] mt-1.5 flex items-center gap-1" style={{ color: "var(--danger-text)" }}>
                        <AlertTriangle className="h-3 w-3 shrink-0" /> {avatarError}
                      </p>
                    )}
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept={AVATAR_ACCEPT}
                      onChange={handleAvatarInputChange}
                      disabled={isSubmitting}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.fullName")}</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={t("admin.employees.form.fullNamePlaceholder")} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.username")}</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={t("admin.employees.form.usernamePlaceholder")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.email")}</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={t("admin.employees.form.emailPlaceholder")} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.phone")}</label>
                  <input type="tel" inputMode="numeric" maxLength={15} value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "").slice(0, 15) })} disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={t("admin.employees.form.phonePlaceholder")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.password")}{editingEmployee ? "" : " *"}</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingEmployee} disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 pr-9 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={editingEmployee ? t("admin.employees.form.passwordPlaceholder") : t("admin.employees.form.confirmPasswordPlaceholder")} minLength={6} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.form.confirmPassword")}{editingEmployee ? "" : " *"}</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required={!editingEmployee} disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 pr-9 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle} placeholder={editingEmployee ? t("admin.employees.form.confirmNewPasswordPlaceholder") : t("admin.employees.form.confirmPlaceholder")} minLength={6} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                      {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.page.status")}</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={isSubmitting} className="w-full h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] outline-none disabled:opacity-50" style={inputStyle}>
                    <option value="active">{t("admin.employees.page.active")}</option>
                    <option value="inactive">{t("admin.employees.page.inactive")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{t("admin.employees.page.department")} *</label>
                  <DepartmentDropdown value={formData.department} onChange={(val) => setFormData({ ...formData, department: val })} disabled={isSubmitting} />
                </div>
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={closeModal} disabled={isSubmitting} className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.employees.page.cancel")}</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : editingEmployee ? t("admin.employees.toast.updated") : t("admin.employees.page.addEmployee")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== SINGLE DELETE CONFIRMATION MODAL ===== */}
      {showDeleteModal && employeeToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}
          >
            <style>
              {`@keyframes modalScaleIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}`}
            </style>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">
                  {t("admin.employees.modal.deleteOneTitle", { name: employeeToDelete.userId?.name || employeeToDelete.name })}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {t("admin.employees.modal.deleteOneBody")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setEmployeeToDelete(null);
                }}
                disabled={deleteMutation.isPending}
                className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {t("admin.employees.page.cancel")}
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(employeeToDelete._id)}
                className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("admin.employees.page.delete")
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK DELETE CONFIRMATION MODAL ===== */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-sm rounded-xl p-5"
            style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">
                  {t("admin.employees.modal.deleteManyTitle", { count: new Intl.NumberFormat(employeeLocaleTag(locale)).format(selectedIds.length) })}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {t("admin.employees.modal.deleteManyBody")}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                {t("admin.employees.page.cancel")}
              </button>
              <button
                disabled={bulkDeleteMutation.isPending}
                onClick={confirmBulkDelete}
                className="flex-1 h-10 min-w-[44px] min-h-[44px] rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("admin.employees.modal.confirmDeleteMany", { count: new Intl.NumberFormat(employeeLocaleTag(locale)).format(selectedIds.length) })
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
