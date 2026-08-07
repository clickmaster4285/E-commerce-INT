"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { brandApi } from "../../../apis/brandApi";
import { Country } from "country-state-city";
import { toast } from "sonner";

/* ================= Icons ================= */
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ListIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const GridIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
  </svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const SortIndicator = ({ active, direction }) => (
  <svg
    className={`w-3 h-3 transition ${active ? "text-emerald-400" : "opacity-40"}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
  >
    {active && direction === "desc" ? <path d="M6 9l6 6 6-6" /> : <path d="M6 15l6-6 6 6" />}
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const UploadIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);
const ImageIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const GlobeIcon = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/* ================= Helpers ================= */
const getInitials = (name) => {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
};

const getLogoUrl = (brand) => {
  if (brand.logo?.img_url) {
    if (brand.logo.img_url.startsWith("http")) {
      return brand.logo.img_url;
    }
    return `http://localhost:5000/${brand.logo.img_url}`;
  }
  return "";
};

const Avatar = ({ brand, size = "w-8 h-8" }) => {
  const logoUrl = getLogoUrl(brand);
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={brand.name}
        className={`${size} rounded-full object-cover shrink-0`}
        style={{ border: "1px solid var(--border-color)" }}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`}
      style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}
    >
      {getInitials(brand.name)}
    </div>
  );
};

const StatusBadge = ({ active }) => (
  <span
    className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
    style={
      active
        ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }
        : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }
    }
  >
    {active ? "Active" : "Inactive"}
  </span>
);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";


/* ================================================================
   ✅ CUSTOM COUNTRY DROPDOWN COMPONENT  — OPENS UPWARD
   ================================================================ */
const CountryDropdown = ({ value, onChange, disabled = false, allCountries = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const getFlagEmoji = (isoCode) => {
    if (!isoCode || isoCode.length !== 2) return "🌍";
    return isoCode
      .toUpperCase()
      .split("")
      .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
      .join("");
  };

  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) return allCountries;
    const term = searchTerm.toLowerCase();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.isoCode.toLowerCase().includes(term)
    );
  }, [allCountries, searchTerm]);

  const selectedCountry = useMemo(() => {
    return allCountries.find((c) => c.name === value) || null;
  }, [allCountries, value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) setSearchTerm("");
  }, [isOpen]);

  const handleSelect = (countryName) => {
    onChange(countryName);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="h-9 w-full px-3 rounded-md text-sm flex items-center justify-between gap-2 outline-none transition disabled:opacity-50 cursor-pointer"
        style={{
          backgroundColor: "var(--bg-tertiary)",
          border: isOpen
            ? "1px solid rgba(16, 185, 129, 0.5)"
            : "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedCountry ? (
            <>
              <span className="text-base leading-none">{getFlagEmoji(selectedCountry.isoCode)}</span>
              <span className="truncate text-[13px]">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <GlobeIcon className="w-3.5 h-3.5" />
              <span className="text-[13px]">Select Country</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedCountry && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-white/10 transition"
              style={{ color: "var(--text-muted)" }}
            >
              <CloseIcon className="w-3 h-3" />
            </span>
          )}
          <ChevronDownIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute z-50 bottom-full mb-1 w-full rounded-lg overflow-hidden shadow-2xl"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="px-3 py-1.5 text-center"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {filteredCountries.length} of {allCountries.length} countries
            </p>
          </div>

          <div className="max-h-[200px] overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  No country found
                </p>
              </div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.name === value;
                return (
                  <button
                    key={country.isoCode}
                    type="button"
                    onClick={() => handleSelect(country.name)}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(16, 185, 129, 0.1)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">{getFlagEmoji(country.isoCode)}</span>
                      <span
                        className="truncate text-[13px]"
                        style={{
                          color: isSelected ? "#34d399" : "var(--text-primary)",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {country.name}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "#34d399" }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <SearchIcon className="w-3.5 h-3.5" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search country..."
                className="w-full h-8 pl-8 pr-3 rounded-md text-[12px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


/* ================= Main Component ================= */
export default function BrandsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [autoBrandCode, setAutoBrandCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);

  const allCountries = useMemo(() => {
    return Country.getAllCountries().map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
    }));
  }, []);

  const [formData, setFormData] = useState({
    brand_code: "",
    name: "",
    description: "",
    country: "",
    is_active: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);

  const resetForm = () => {
    setFormData({ brand_code: "", name: "", description: "", country: "", is_active: true });
    setLogoFile(null);
    setLogoPreview("");
    setRemoveLogo(false);
    setEditingBrand(null);
    setAutoBrandCode("");
  };

  const fetchNextBrandCode = async () => {
    try {
      setLoadingCode(true);
      const nextCode = await brandApi.getNextCode();
      setAutoBrandCode(nextCode);
      if (!editingBrand) {
        setFormData((prev) => ({ ...prev, brand_code: nextCode }));
      }
    } catch (err) {
      console.error("Failed to fetch next brand code:", err);
      const lastBrand = brands
        .filter((b) => b.brand_code && /^BRD-\d+$/.test(b.brand_code))
        .sort((a, b) => {
          const numA = parseInt(a.brand_code.split("-")[1], 10);
          const numB = parseInt(b.brand_code.split("-")[1], 10);
          return numB - numA;
        })[0];

      let nextNum = 1;
      if (lastBrand) {
        nextNum = parseInt(lastBrand.brand_code.split("-")[1], 10) + 1;
      }
      const fallbackCode = `BRD-${String(nextNum).padStart(3, "0")}`;
      setAutoBrandCode(fallbackCode);
      if (!editingBrand) {
        setFormData((prev) => ({ ...prev, brand_code: fallbackCode }));
      }
    } finally {
      setLoadingCode(false);
    }
  };

  const handleViewBrand = (id) => {
    router.push(`${pathname}/${id}`);
  };

  const {
    data: brands = [],
    isLoading: loading,
  } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });

  /* ==========================================
     ✅ CREATE / UPDATE — with TOAST
     ========================================== */
  const brandMutation = useMutation({
    mutationFn: ({ data, id }) => (id ? brandApi.update(id, data) : brandApi.create(data)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(
        variables.id
          ? "Brand updated successfully"
          : "Brand added successfully"
      );
      resetForm();
      setShowModal(false);
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Brand operation failed"
      );
    },
  });

  /* ==========================================
     ✅ DELETE — with TOAST
     ========================================== */
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => brandApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setSelectedIds([]);
      toast.success("Brand deleted successfully");
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Brand delete failed"
      );
    },
  });

  /* ---------- Derived data ---------- */
  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      const matchSearch =
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.brand_code?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && b.is_active) ||
        (filterStatus === "inactive" && !b.is_active);
      const matchCountry = filterCountry === "all" || b.country === filterCountry;
      return matchSearch && matchStatus && matchCountry;
    });
  }, [brands, search, filterStatus, filterCountry]);

  const sortedBrands = useMemo(() => {
    const arr = [...filteredBrands];
    if (!sortConfig.key) return arr;
    arr.sort((a, b) => {
      let va, vb;
      switch (sortConfig.key) {
        case "code": va = a.brand_code?.toLowerCase() || ""; vb = b.brand_code?.toLowerCase() || ""; break;
        case "name": va = a.name?.toLowerCase() || ""; vb = b.name?.toLowerCase() || ""; break;
        case "country": va = a.country?.toLowerCase() || ""; vb = b.country?.toLowerCase() || ""; break;
        case "status": va = a.is_active ? 1 : 0; vb = b.is_active ? 1 : 0; break;
        default: return 0;
      }
      if (va < vb) return sortConfig.direction === "asc" ? -1 : 1;
      if (va > vb) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filteredBrands, sortConfig]);

  const totalBrands = sortedBrands.length;
  const totalPages = Math.ceil(totalBrands / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBrands = sortedBrands.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, filterCountry]);

  const allBrands = brands.length;
  const activeBrands = brands.filter((b) => b.is_active).length;
  const inactiveBrands = allBrands - activeBrands;
  const countries = [...new Set(brands.map((b) => b.country).filter(Boolean))];
  const withLogo = brands.filter((b) => b.logo?.img_url).length;

  const allSelected = paginatedBrands.length > 0 && paginatedBrands.every((b) => selectedIds.includes(b._id));
  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? [] : paginatedBrands.map((b) => b._id));
  const toggleSelect = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const isSubmitting = brandMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  /* ---------- Handlers ---------- */

  const handleSubmit = (e) => {
    e.preventDefault();

    const fd = new FormData();
    fd.append("brand_code", formData.brand_code);
    fd.append("name", formData.name);
    fd.append("description", formData.description || "");
    fd.append("country", formData.country || "");
    fd.append("is_active", formData.is_active.toString());

    if (removeLogo && editingBrand) {
      fd.append("remove_logo", "true");
    }

    if (logoFile) {
      fd.append("logo", logoFile);
    }

    brandMutation.mutate({ data: fd, id: editingBrand?._id });
  };

  const handleEdit = (brand) => {
    setEditingBrand(brand);
    setFormData({
      brand_code: brand.brand_code || "",
      name: brand.name || "",
      description: brand.description || "",
      country: brand.country || "",
      is_active: brand.is_active !== undefined ? brand.is_active : true,
    });
    setLogoPreview(getLogoUrl(brand));
    setLogoFile(null);
    setRemoveLogo(false);
    setAutoBrandCode(brand.brand_code || "");
    setShowModal(true);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowModal(true);
    fetchNextBrandCode();
  };

  const handleDelete = (brand) => setDeleteTarget({ brands: [brand] });
  const handleBulkDelete = () =>
    setDeleteTarget({ brands: brands.filter((b) => selectedIds.includes(b._id)) });

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ids = deleteTarget.brands.map((b) => b._id);
    deleteMutation.mutate(ids, { onSettled: () => setDeleteTarget(null) });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        return;
      }
      setLogoFile(file);
      setRemoveLogo(false);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setRemoveLogo(true);
  };

  /* ---------- Reusable styles ---------- */
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const SortHeader = ({ label, sortKey }) => (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => handleSort(sortKey)}
        className="inline-flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider transition hover:opacity-80"
        style={{ color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {label}
        <SortIndicator active={sortConfig.key === sortKey} direction={sortConfig.direction} />
      </button>
    </th>
  );

  const SelectFilter = ({ value, onChange, children }) => (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40"
        style={inputStyle}
      >
        {children}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </span>
    </div>
  );

  const ActionButtons = ({ brand }) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={(e) => { e.stopPropagation(); handleViewBrand(brand._id); }}
        className="p-1.5 rounded-md transition hover:bg-emerald-500/10"
        style={{ color: "#34d399" }}
        title="View Details"
      >
        <EyeIcon className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleEdit(brand); }}
        className="p-1.5 rounded-md transition hover:bg-white/5"
        style={{ color: "var(--text-secondary)" }}
        title="Edit"
      >
        <EditIcon className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(brand); }}
        disabled={isDeleting}
        className="p-1.5 rounded-md transition text-red-500 hover:bg-red-500/10 disabled:opacity-50"
        title="Delete"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Brand Management
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Manage your brands, their details, and status
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="h-9 w-9 rounded-lg flex items-center justify-center transition"
                style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
                title="List view"
              >
                <ListIcon />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className="h-9 w-9 rounded-lg flex items-center justify-center transition"
                style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
                title="Grid view"
              >
                <GridIcon />
              </button>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              <PlusIcon />
              Add Brand
            </button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Brands</p>
            <p className="text-[20px] font-bold mt-1">{allBrands}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active</p>
            <p className="text-[20px] font-bold mt-1 text-emerald-500">{activeBrands}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Inactive</p>
            <p className="text-[20px] font-bold mt-1 text-amber-500">{inactiveBrands}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Countries</p>
            <p className="text-[20px] font-bold mt-1 text-blue-500">{countries.length}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>With Logo</p>
            <p className="text-[20px] font-bold mt-1 text-purple-500">{withLogo}</p>
          </div>
        </div>

        {/* ===== Search ===== */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
            style={inputStyle}
          />
        </div>

        {/* ===== Filters ===== */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectFilter>
          <SelectFilter value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)}>
            <option value="all">All Countries</option>
            {countries.map((c) => (<option key={c} value={c}>{c}</option>))}
          </SelectFilter>
        </div>

        {/* ===== Bulk selection bar ===== */}
        {selectedIds.length > 0 && (
          <div
            className="flex items-center justify-between rounded-lg px-4 h-11"
            style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                Clear
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--danger)" }}
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* ===== Loading / Empty / Table / Grid ===== */}
        {loading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}>
            <Spinner />
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading brands...</span>
          </div>
        ) : paginatedBrands.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {search || filterStatus !== "all" || filterCountry !== "all" ? "No brands match your filters" : "No brands yet"}
            </p>
            {!search && filterStatus === "all" && filterCountry === "all" && (
              <button
                onClick={handleOpenAddModal}
                className="h-9 px-4 rounded-lg text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
              >
                + Add your first brand
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
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
                    <SortHeader label="Brand Code" sortKey="code" />
                    <SortHeader label="Brand Name" sortKey="name" />
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                      Description
                    </th>
                    <SortHeader label="Country" sortKey="country" />
                    <SortHeader label="Status" sortKey="status" />
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBrands.map((brand, index) => {
                    const isSelected = selectedIds.includes(brand._id);
                    return (
                      <tr
                        key={brand._id}
                        onClick={() => handleViewBrand(brand._id)}
                        className="transition cursor-pointer"
                        style={{
                          borderBottom: index < paginatedBrands.length - 1 ? "1px solid var(--border-color)" : "none",
                          backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}
                      >
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(brand._id)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: "var(--accent)" }}
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[13px] font-mono truncate max-w-[100px] block" style={{ color: "var(--text-secondary)" }}>
                            {brand.brand_code || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar brand={brand} />
                            <span className="font-medium text-[13px] truncate max-w-[140px]">{brand.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden lg:table-cell max-w-[200px]">
                          <p className="truncate text-[13px]" style={{ color: "var(--text-muted)" }}>{brand.description || "—"}</p>
                        </td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>
                          {brand.country || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge active={brand.is_active} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ActionButtons brand={brand} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedBrands.map((brand) => (
              <div
                key={brand._id}
                onClick={() => handleViewBrand(brand._id)}
                className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer"
                style={cardStyle}
              >
                <div className="flex items-start justify-between">
                  <Avatar brand={brand} size="w-10 h-10" />
                  <StatusBadge active={brand.is_active} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] truncate">{brand.name}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{brand.brand_code || "—"}</p>
                </div>
                <div
                  className="flex items-center justify-between pt-3"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{brand.country || "—"}</span>
                  <ActionButtons brand={brand} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalBrands > 20 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Showing {startIndex + 1}-{Math.min(endIndex, totalBrands)} of {totalBrands} brands
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                title="Previous page"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? (
                      <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span>
                    ) : (
                      <button
                        onClick={() => goToPage(page)}
                        className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80"
                        style={{
                          backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)",
                          color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)",
                          border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}`,
                        }}
                      >
                        {page}
                      </button>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                title="Next page"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {paginatedBrands.length > 0 && totalBrands <= 20 && (
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Showing {paginatedBrands.length} of {allBrands} brands
          </p>
        )}
      </div>

      {/* ===== Add/Edit Modal ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-xl overflow-visible" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">{editingBrand ? "Edit Brand" : "Add New Brand"}</h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                disabled={isSubmitting}
                className="p-1 rounded transition disabled:opacity-50 hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto overflow-x-visible" style={{ overflowClipMargin: "200px" }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Code *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.brand_code}
                      onChange={(e) => setFormData({ ...formData, brand_code: e.target.value })}
                      required
                      disabled={isSubmitting || loadingCode}
                      className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                      placeholder={loadingCode ? "Generating..." : "BRD-001"}
                    />
                    {loadingCode && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Spinner className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  {!editingBrand && autoBrandCode && !loadingCode && (
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Auto-generated • You can change it
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={isSubmitting}
                    className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    placeholder="Nike"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="2"
                  disabled={isSubmitting}
                  className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                  placeholder="Brand details..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Brand Logo</label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="logo-upload"
                      className="cursor-pointer h-8 px-3 rounded-md text-xs font-medium flex items-center gap-2 transition hover:opacity-80 w-fit"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                    >
                      <UploadIcon className="w-3.5 h-3.5" />
                      {logoPreview ? "Change Image" : "Upload Image"}
                    </label>
                    <div className="flex items-center gap-3">
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>PNG, JPG, WEBP up to 10MB</p>
                      {logoPreview && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="text-[11px] text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Country</label>
                  <CountryDropdown
                    value={formData.country}
                    onChange={(val) => setFormData({ ...formData, country: val })}
                    disabled={isSubmitting}
                    allCountries={allCountries}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer h-9">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    disabled={isSubmitting}
                    className="w-4 h-4 rounded disabled:opacity-50"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
                </label>
              </div>

              <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={isSubmitting}
                  className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || loadingCode}
                  className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {isSubmitting ? "Saving..." : editingBrand ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <style>{`@keyframes modalScaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">
                  {deleteTarget.brands.length === 1 ? `Delete "${deleteTarget.brands[0].name}"?` : `Delete ${deleteTarget.brands.length} brands?`}
                </h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  This action cannot be undone. The brand(s) will be permanently removed.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 p-2.5 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <Avatar brand={deleteTarget.brands[0]} size="w-8 h-8" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{deleteTarget.brands[0].name}</p>
                <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {deleteTarget.brands.length === 1 ? deleteTarget.brands[0].brand_code || "—" : `+ ${deleteTarget.brands.length - 1} more`}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2"
                style={{ backgroundColor: "var(--danger)" }}
              >
                {isDeleting ? (<><Spinner className="w-3.5 h-3.5" />Deleting...</>) : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}