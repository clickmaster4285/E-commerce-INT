"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Users,
  Loader2,
  Power,
  SortAsc,
  SortDesc,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

// ✅ Real-time socket hooks aur API import
import { employeeSocketApi, useEmployeeSocketSync } from "@/hooks/useEmployeeSocket";

const ITEMS_PER_PAGE = 20;

// ✅ Sirf wahi departments jo aapke data mein valid hain
const PREDEFINED_DEPARTMENTS = [
  "HR",
  "Manager",
  "IT",
  "Finance",
  "Marketing",
  "Customer Service",
];

// ==========================================
// DEPARTMENT DROPDOWN COMPONENT
// ==========================================
function DepartmentDropdown({ value, onChange, disabled }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(PREDEFINED_DEPARTMENTS);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value !== undefined) setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredOptions(PREDEFINED_DEPARTMENTS);
    } else {
      const lower = inputValue.toLowerCase();
      setFilteredOptions(
        PREDEFINED_DEPARTMENTS.filter((d) => d.toLowerCase().includes(lower))
      );
    }
  }, [inputValue]);

  // Bahar click karne par dropdown band karne ka logic
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelectOption = (option) => {
    setInputValue(option);
    onChange(option);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue.trim()) setIsOpen(false);
    if (e.key === "Escape") setIsOpen(false);
    if (e.key === "ArrowDown") { e.preventDefault(); setIsOpen(true); }
  };

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
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
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
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          className="absolute z-10 w-full mb-1 rounded-md shadow-lg max-h-48 overflow-auto py-1"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.3)",
            bottom: "100%", // Dropdown upar ki taraf khulega
          }}
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
              No matching departments
            </div>
          ) : (
            filteredOptions.map((dept) => (
              <button
                key={dept}
                type="button"
                onClick={() => handleSelectOption(dept)}
                className="w-full text-left px-3 py-1.5 text-[13px] transition"
                style={{
                  color: "var(--text-primary)",
                  backgroundColor: inputValue === dept ? "rgba(16,185,129,0.1)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (inputValue !== dept) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  if (inputValue !== dept) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {dept}
              </button>
            ))
          )}
          {/* Agar user custom department likhe jo list mein nahi hai */}
          {inputValue.trim() && !PREDEFINED_DEPARTMENTS.includes(inputValue.trim()) && (
            <div
              className="px-3 py-1.5 text-[11px] border-t"
              style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}
            >
              Custom: "{inputValue.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN EMPLOYEE PAGE COMPONENT
// ==========================================
export default function EmployeesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // ✅ Real-time sync hook: Jab dusra user change kare to list auto update ho
  const { markSelfAction } = useEmployeeSocketSync();

  // Local State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals State
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Password Visibility State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    status: "active",
    password: "",
    confirmPassword: "",
  });

  // Search Debounce Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ✅ Data Fetching via Socket/API (Real-time capable)
  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["employees"],
    queryFn: employeeSocketApi.getAll,
    staleTime: 30000, 
    retry: 2,
  });

  // Sirf Staff members ko filter karna (Admins ko yahan nahi dikhana)
  const staffEmployees = useMemo(
    () => employees.filter((emp) => emp.role === "staff"),
    [employees]
  );

  // --- MUTATIONS (Create, Update, Delete) ---

  const createMutation = useMutation({
    mutationFn: employeeSocketApi.create,
    onSuccess: () => {
      markSelfAction(); // Khud ki action ko sync ignore karne ke liye mark karein
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee created successfully");
      closeModal();
    },
    onError: (err) => toast.error(err.message || "Creation failed"),
  });

  const updateMutation = useMutation({
    mutationFn: employeeSocketApi.update,
    onSuccess: () => {
      markSelfAction();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee updated successfully");
      closeModal();
    },
    onError: (err) => toast.error(err.message || "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: employeeSocketApi.delete,
    onSuccess: () => {
      markSelfAction();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employee deleted");
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
      setSelectedIds([]);
    },
    onError: (err) => toast.error(err.message || "Delete failed"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => employeeSocketApi.delete(id))),
    onSuccess: () => {
      markSelfAction();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(`${selectedIds.length} employees deleted`);
      setSelectedIds([]);
      setShowBulkDeleteModal(false);
    },
    onError: (err) => toast.error(err.message || "Bulk delete failed"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: employeeSocketApi.toggleStatus,
    onSuccess: () => {
      markSelfAction();
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message || "Status update failed"),
  });

  // --- HELPER FUNCTIONS ---

  const closeModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
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

  const openAddModal = () => {
    setEditingEmployee(null);
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
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      phone: emp.phone || "",
      department: emp.department || "",
      status: emp.status,
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!formData.department.trim()) return toast.error("Department is required");

    // Validation sirf naye employee ke liye
    if (!editingEmployee) {
      if (!formData.password) return toast.error("Password is required");
      if (formData.password.length < 6) return toast.error("Password must be at least 6 characters");
      if (formData.password !== formData.confirmPassword) {
        return toast.error("Passwords do not match");
      }
    }

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone || "",
      department: formData.department.trim(),
      status: formData.status,
      role: "staff",
      password: formData.password,
    };
    
    // Edit karte waqt agar password khali hai to usay payload se nikaal dein
    if (!payload.password) delete payload.password;

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleToggleStatus = (employee) => {
    toggleStatusMutation.mutate(employee._id);
  };

  const handleBulkDelete = () => {
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

  // Filtering, Sorting aur Pagination Logic
  const filteredEmployees = useMemo(() => {
    let result = staffEmployees.filter((emp) => {
      const matchSearch =
        emp.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        emp.email?.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchStatus = filterStatus === "all" || emp.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (sortConfig.key) {
      result.sort((a, b) => {
        let va = a[sortConfig.key] || "";
        let vb = b[sortConfig.key] || "";
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
        if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [staffEmployees, debouncedSearch, filterStatus, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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

  // Common Styles
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

  // --- LOADING STATE ---
  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Loading employees...
          </p>
        </div>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (isError) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-500 opacity-60" />
        <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>
          Failed to load employees.
          <br />
          <span className="text-[12px]">{error?.message}</span>
        </p>
        <button
          onClick={() => refetch()}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen space-y-6" style={{ color: "var(--text-primary)" }}>
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Employee Management</h1>
          <p className="text-[14px] mt-1" style={{ color: "var(--text-muted)" }}>
            Manage your team members and their departments
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="h-10 px-5 rounded-lg text-[14px] font-semibold flex items-center gap-2 transition hover:opacity-90 shadow-sm"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl px-3 py-2" style={cardStyle}>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Total
          </p>
          <p className="text-[20px] font-bold mt-0.5">{staffEmployees.length}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={cardStyle}>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Active
          </p>
          <p className="text-[20px] font-bold mt-0.5" style={{ color: "#34d399" }}>
            {staffEmployees.filter((e) => e.status === "active").length}
          </p>
        </div>
        <div className="rounded-xl px-3 py-2" style={cardStyle}>
          <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Inactive
          </p>
          <p className="text-[20px] font-bold mt-0.5" style={{ color: "#f87171" }}>
            {staffEmployees.filter((e) => e.status === "inactive").length}
          </p>
        </div>
      </div>

      {/* Bulk Action Bar (Sirf tab dikhega jab selection ho) */}
      {selectedIds.length > 0 && (
        <div
          className="flex items-center justify-between rounded-xl px-4 h-11"
          style={{
            backgroundColor: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.3)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#34d399" }}>
            {selectedIds.length} selected
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium transition hover:opacity-70"
              style={{ color: "var(--text-muted)" }}
            >
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--danger)" }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          >
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
            style={inputStyle}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="appearance-none h-9 w-full sm:w-[150px] px-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer"
          style={inputStyle}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Main Data Table */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
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
                <th
                  className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => handleSort("name")}
                >
                  Employee {getSortIcon("name")}
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => handleSort("email")}
                >
                  Email {getSortIcon("email")}
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => handleSort("department")}
                >
                  Department {getSortIcon("department")}
                </th>
                <th
                  className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => handleSort("status")}
                >
                  Status {getSortIcon("status")}
                </th>
                <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                    <Users className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    No employees found
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => {
                  const isSelected = selectedIds.includes(emp._id);
                  return (
                    <tr
                      key={emp._id}
                      className="transition cursor-pointer"
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                      }}
                      onClick={(e) => {
                        // Checkbox ya button par click par row navigate na ho
                        if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                        router.push(`/admin/employees/${emp._id}`);
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isSelected
                          ? "var(--bg-tertiary)"
                          : "var(--bg-card)";
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
                          {emp.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={emp.name}
                              className="h-8 w-8 rounded-full object-cover shrink-0 border"
                              style={{ borderColor: "var(--border-color)" }}
                            />
                          ) : (
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                              style={{
                                backgroundColor: "rgba(16,185,129,0.12)",
                                color: "#34d399",
                              }}
                            >
                              {emp.name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-[13px] truncate max-w-[140px]">
                            {emp.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                        {emp.email}
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
                          {emp.department || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                         <span
                          className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                          style={
                            emp.status === "active"
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
                          {emp.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            disabled={toggleStatusMutation.isPending}
                            className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center disabled:opacity-50"
                            style={{
                              color: emp.status === "active" ? "#f87171" : "#34d399",
                            }}
                            title={emp.status === "active" ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation(); 
                              router.push(`/admin/employees/${emp._id}`);
                            }}
                            className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
                            style={{ color: "#34d399" }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEditModal(emp)}
                            className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
                            style={{ color: "var(--text-secondary)" }}
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEmployeeToDelete(emp);
                              setShowDeleteModal(true);
                            }}
                            disabled={deleteMutation.isPending}
                            className="min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50 flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredEmployees.length > ITEMS_PER_PAGE && (
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl p-4"
          style={cardStyle}
        >
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)} of {filteredEmployees.length}{" "}
            employees
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg rounded-xl shadow-xl max-h-[95vh] flex flex-col"
            style={cardStyle}
          >
            <div
              className="px-5 py-4 flex items-center justify-between rounded-t-xl shrink-0"
              style={{
                borderBottom: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <div>
                <h3 className="text-base font-semibold">
                  {editingEmployee ? "Edit Employee" : "Add New Employee"}
                </h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {editingEmployee ? "Update employee details" : "Create a new team member"}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={isSubmitting}
                className="p-1 rounded transition disabled:opacity-50 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isSubmitting}
                    className="w-full h-8 px-3 rounded-md text-sm outline-none disabled:opacity-50"
                    style={inputStyle}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isSubmitting}
                    className="w-full h-8 px-3 rounded-md text-sm outline-none disabled:opacity-50"
                    style={inputStyle}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={isSubmitting}
                  className="w-full h-8 px-3 rounded-md text-sm outline-none disabled:opacity-50"
                  style={inputStyle}
                  placeholder="+92 300 1234567"
                />
              </div>

              {/* Password Fields (Sirf Add karte waqt zaroori hain) */}
              {!editingEmployee && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        disabled={isSubmitting}
                        className="w-full h-8 px-3 pr-9 rounded-md text-sm outline-none disabled:opacity-50"
                        style={inputStyle}
                        placeholder="Min 6 chars"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                        disabled={isSubmitting}
                        className="w-full h-8 px-3 pr-9 rounded-md text-sm outline-none disabled:opacity-50"
                        style={inputStyle}
                        placeholder="Confirm"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    disabled={isSubmitting}
                    className="w-full h-8 px-3 rounded-md text-sm outline-none disabled:opacity-50"
                    style={inputStyle}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                    Department *
                  </label>
                  <DepartmentDropdown
                    value={formData.department}
                    onChange={(val) => setFormData({ ...formData, department: val })}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 h-8 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-8 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : editingEmployee ? (
                    "Update Employee"
                  ) : (
                    "Create Employee"
                  )}
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
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">
                  Delete "{employeeToDelete.name}"?
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  This action cannot be undone. All employee data will be permanently removed.
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
                className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(employeeToDelete._id)}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Delete"
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
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">
                  Delete {selectedIds.length} employees?
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  This action cannot be undone. All selected employees will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={bulkDeleteMutation.isPending}
                className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                Cancel
              </button>
              <button
                disabled={bulkDeleteMutation.isPending}
                onClick={confirmBulkDelete}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}
              >
                {bulkDeleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Delete ${selectedIds.length}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}