"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useProductSocketSync } from "@/hooks/useProductSocketSync";
import { useSocket } from "@/hooks/useSocket";
import {
  Package, Layers3, Box, TrendingUp, Clock, Pencil, Check,
  ChevronDown, ChevronRight, Copy, Plus, Trash2, Upload, X,
  Sparkles, AlertTriangle, DollarSign, FolderOpen, Store, Hash, Tag as TagIcon,
  Edit3, Save, Calendar, User, Activity, Eye, ArrowLeft, Image as ImageIcon, FileText,
  Ban, ChevronLeft, ZoomIn // Added ZoomIn and ChevronLeft for gallery
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import { variantApi } from "@/apis/admin/variantApi";
import { tagApi } from "@/apis/admin/tagApi";
import { attributeApi } from "@/apis/admin/attributeApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

const createEmptyVariant = (sku = "") => ({
  _id: null, sku, title: "", description: "",
  cost_price: "", selling_price: "", quantity: "0",
  attributes: [{ name: "Color", value: "Black", isCustom: false }],
  images: [],
  tags: [],
});

function fd(d) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function tago(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy < 30 ? `${dy}d ago` : fd(d);
}

function ini(n) {
  return n ? n.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "??";
}

// ==================== MODERN COMPONENTS ====================

function StatusBadge({ active, size = "sm" }) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${sizeClasses}`}
      style={{
        backgroundColor: active ? "var(--success-soft)" : "var(--danger-soft)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--success) 28%, transparent)" : "color-mix(in srgb, var(--danger) 28%, transparent)"}`,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InfoCard({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, icon: Icon }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className={`text-[13px] font-semibold text-right truncate max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "var(--success)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Avatar({ user, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: "var(--success)" },
    blue: { bg: "var(--info-soft)", text: "var(--info)" },
    purple: { bg: "var(--purple-soft)", text: "var(--purple)" },
  };
  const c = colors[color] || colors.emerald;
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: c.bg, color: c.text }}>
      {ini(user?.name || user?.email || "?")}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
        <Icon className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-[12px] max-w-sm mb-5" style={{ color: "var(--text-muted)" }}>{description}</p>
      {action}
    </div>
  );
}

function AllAttributesModal({ attributes, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-attributes-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id="all-attributes-title" className="text-[15px] font-bold">All Attributes</h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Product attributes and specifications
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-2 transition hover:bg-red-500/10 hover:text-red-400" style={{ color: "var(--text-muted)" }} aria-label="Close attributes">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {attributes.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
              <p className="text-[12px]">No attributes are available for this product.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {attributes.map((attribute) => (
                <div key={attribute.name} className="min-w-0 rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <p className="break-words text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{attribute.name}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>{attribute.value || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end px-5 py-3" style={{ backgroundColor: "var(--bg-tertiary)", borderTop: "1px solid var(--border-color)" }}>
          <button type="button" onClick={onClose} className="h-9 rounded-md px-4 text-[12px] font-bold transition hover:brightness-110" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tag entries can be plain strings or legacy { name } objects
const tagNameOf = (t) => (typeof t === "object" && t !== null ? t.name : t);

// Attribute values can be plain strings/numbers or nested objects such as
// { Brand: "Dell" } / { label, value } coming from the attribute configuration.
// Always resolve a readable value so "[object Object]" is never rendered.
const attrValueOf = (raw) => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw).trim();
  }
  if (Array.isArray(raw)) return raw.map(attrValueOf).filter(Boolean).join(", ");
  if (typeof raw === "object") {
    const direct = raw.value ?? raw.label ?? raw.name ?? raw.display ?? raw.title ?? raw.text;
    if (direct !== undefined && direct !== null && direct !== raw) return attrValueOf(direct);
    return Object.values(raw).map(attrValueOf).filter(Boolean).join(", ");
  }
  return String(raw);
};

// ==================== COMPACT 3-DOT MENU ====================

function MoreMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 160; // approximate min height
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;
      let top = rect.bottom + 4;
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - 4;
      }
      let left = rect.right - 160;
      if (left < 8) left = 8;
      if (left + 160 > window.innerWidth) left = window.innerWidth - 168;
      setMenuPos({ top, left });
    }
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open]);

  return (
    <div className="relative z-10">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
        style={{ color: "var(--text-muted)", backgroundColor: "transparent" }}
      >
        <span className="flex flex-col items-center gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
        </span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[160px] rounded-lg border shadow-xl overflow-visible py-1 animate-in fade-in zoom-in-95 opacity-100 pointer-events-auto"
          style={{
            top: menuPos.top + "px",
            left: Math.max(8, menuPos.left) + "px",
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-color)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
          }}
        >
          {actions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick?.(); }}
              disabled={action.disabled}
              className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40 opacity-100 pointer-events-auto cursor-pointer"
              style={{ color: action.destructive ? "var(--danger)" : "var(--text-primary)" }}
            >
              {action.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ==================== IMAGE GALLERY MODAL ====================
function ImageGalleryModal({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  
  // Reset index when images change
  useEffect(() => {
    setCurrentIndex(initialIndex || 0);
  }, [initialIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!images || images.length === 0) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Image Container */}
      <div 
        className="relative w-full max-w-6xl h-[80vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image area
      >
        {/* Previous Button */}
        {images.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-all hover:scale-110 z-50"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Display */}
        <div className="relative w-full h-full flex items-center justify-center p-8">
           <img 
            src={getImageUrl(images[currentIndex].img_url)} 
            alt={`Product view ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
            draggable={false}
           />
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
             {currentIndex + 1} / {images.length}
           </div>
        </div>

        {/* Next Button */}
        {images.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-all hover:scale-110 z-50"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnails Strip */}
      {images.length > 1 && (
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                idx === currentIndex 
                  ? "ring-2 ring-emerald-500 scale-110 opacity-100" 
                  : "opacity-50 hover:opacity-80 grayscale hover:grayscale-0"
              }`}
            >
              <img 
                src={getImageUrl(img.img_url)} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ==================== MAIN COMPONENT ====================

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  useProductSocketSync();
  const { socket, isConnected } = useSocket();

  const id = params?.id;
  const [liveEvents, setLiveEvents] = useState([]);
  
  // Gallery State
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllAttributes, setShowAllAttributes] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["overview", "variants", "tags", "category", "brand", "activity"];
    return validTabs.includes(tabParam) ? tabParam : "overview";
  });

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["overview", "variants", "tags", "category", "brand", "activity"];
    if (validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState(null);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagModalValue, setNewTagModalValue] = useState("");
  const [editingVariantForTags, setEditingVariantForTags] = useState(null);
  const [showVariantTagsModal, setShowVariantTagsModal] = useState(false);
  const [variantTagInput, setVariantTagInput] = useState("");
  const [newGlobalTag, setNewGlobalTag] = useState("");
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [attributeTargetVariant, setAttributeTargetVariant] = useState(null);
  const [newAttributeData, setNewAttributeData] = useState({
    name: "", code: "", data_type: "text",
    values: [{ label: "", value: "" }], variant_allowed: true,
  });

  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [],
    variants: [createEmptyVariant()],
  });
  const [tagInput, setTagInput] = useState("");

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !id) return;
    const handleDeleted = (data) => {
      if (data?.id === id) { toast.info("This product was deleted from another session."); router.push("/admin/products"); }
    };
    const handleCreated = (data) => {
      if (String(data?._id) !== String(id)) return;
      setLiveEvents((prev) => [...prev, { key: `live-c-${Date.now()}`, type: "created", user: data?.createdby || null, date: data?.created_at || new Date().toISOString() }]);
    };
    const handleUpdated = (data) => {
      if (String(data?._id) !== String(id)) return;
      const date = data?.updated_at || new Date().toISOString();
      setLiveEvents((prev) => {
        // Ignore re-delivered socket events so an update is never listed twice.
        if (prev.some((e) => e.type === "updated" && e.date === date)) return prev;
        return [...prev, { key: `live-u-${Date.now()}`, type: "updated", user: data?.updatedby || null, date }];
      });
    };
    socket.on("productDeleted", handleDeleted);
    socket.on("productCreated", handleCreated);
    socket.on("productUpdated", handleUpdated);
    return () => { socket.off("productDeleted", handleDeleted); socket.off("productCreated", handleCreated); socket.off("productUpdated", handleUpdated); };
  }, [socket, isConnected, id, router]);

  const { data: product, isLoading, isError, refetch: refetchProduct } = useQuery({
    queryKey: ["product", id], queryFn: () => productApi.getById(id), enabled: !!id,
  });

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });
  const { data: rawAttributes = [] } = useQuery({ queryKey: ["attributes"], queryFn: () => attributeApi.getAll(), retry: false });

  const productCategoryId = product?.category_id?._id || product?.category_id;
  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", productCategoryId],
    queryFn: () => attributeApi.getByCategory(productCategoryId),
    enabled: !!productCategoryId, retry: false,
  });

  // Initialize live events from database state so pre-existing updates are shown
  useEffect(() => {
    if (!product) return;
    setLiveEvents((prev) => {
      // Only seed once: if prev already has events, keep them.
      if (prev.length > 0) return prev;
      const initial = [];
      if (product?.updatedby && product?.updated_at) {
        initial.push({
          key: `live-u-init-${product._id || id}`,
          type: "updated",
          user: product.updatedby || null,
          date: product.updated_at || new Date().toISOString(),
        });
      }
      return initial;
    });
  }, [product?._id, id]);

  const ATTRIBUTE_PRESETS = useMemo(() => {
    const source = (categoryAttributes && categoryAttributes.length) ? categoryAttributes : rawAttributes;
    if (!source.length) return [];
    return source
      .filter((a) => a.is_active && a.values?.length)
      .map((a) => ({
        name: a.name, code: a.code, data_type: a.data_type,
        values: (a.data_type === "multi_select" && Array.isArray(a.category_config?.value) && a.category_config.value.length)
          ? a.category_config.value : (a.values || []).map((v) => v.label || v.value),
      }));
  }, [rawAttributes, categoryAttributes]);

  const { data: globalTags = [], refetch: refetchTags } = useQuery({ queryKey: ["globalTags"], queryFn: tagApi.getAll });

  // Re-fetch tags once the product has loaded: the backend heals legacy
  // variant tags into Tag documents during the product fetch, and those
  // healed docs (with Created By) must appear in this page's tag lookups.
  useEffect(() => {
    if (product && refetchTags) refetchTags();
  }, [product?._id]);

  // Mutations
  const createTagMutation = useMutation({
    mutationFn: tagApi.create,
    onSuccess: () => { refetchTags(); setNewGlobalTag(""); setNewTagModalValue(""); toast.success("Tag created successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create tag"),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => tagApi.update(id, data),
    onSuccess: () => { refetchTags(); setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); toast.success("Tag updated successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: tagApi.delete,
    onSuccess: () => { refetchTags(); toast.success("Tag deleted successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete tag"),
  });

  // Shared mutation for add / rename / remove of tags assigned to THIS product
  // (uses the existing product update API; backend resolveTags preserves relationships)
  const updateProductTagsMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: async (_res, vars) => {
      toast.success(vars?.successMsg || "Tags updated successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      refetchTags();
    },
    onError: (error, vars) => { toast.error(error.response?.data?.message || vars?.errorMsg || "Failed to update tags"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: async () => {
      toast.success("Product updated successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      // Re-fetch global tags so newly created variant tag docs (with their
      // Created By) appear in the Tags tab without a page refresh.
      refetchTags();
      if (showVariantTagsModal && editingVariantForTags) {
        setTimeout(() => {
          const freshProduct = queryClient.getQueryData(["product", id]);
          if (freshProduct) {
            const updatedVariant = freshProduct.variants?.find(v => String(v._id) === String(editingVariantForTags._id));
            if (updatedVariant) setEditingVariantForTags({ ...updatedVariant, tags: updatedVariant.tags || [] });
          }
        }, 300);
      }
      if (showModal) closeProductModal();
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Product update failed"); },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId) => variantApi.delete(variantId),
    onSuccess: async () => {
      toast.success("Variant deleted successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Failed to delete variant"); },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); router.push("/admin/products"); },
    onError: (error) => { toast.error(error.response?.data?.message || "Product delete failed"); },
  });

  const createAttributeMutation = useMutation({
    mutationFn: ({ payload }) => attributeApi.create(payload),
    onSuccess: async (res, variables) => {
      const { tempKey, targetIndex, attributeName } = variables || {};
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      const created = res?.data || res;
      const createdId = created?._id || created?.id;
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, name: attributeName, _creating: false, _creatingId: createdId ? String(createdId) : undefined } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      await refetchProduct();
      toast.success("Attribute created successfully!");
      setShowAttributeModal(false);
      setAttributeTargetVariant(null);
      resetAttributeForm();
    },
    onError: (err, variables) => {
      const { tempKey, targetIndex } = variables || {};
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, _creating: false, _createError: true } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      refetchProduct();
      toast.error(err?.response?.data?.message || err?.message || "Failed to create attribute");
    },
  });

  // Handlers
  const handleDelete = () => setShowDeleteModal(true);
  const confirmDelete = () => { if (product) deleteMutation.mutate(product._id); };

  const prepareEditData = (prod) => {
    const variants = prod.variants?.length
      ? prod.variants.map((v) => ({
        _id: v._id, sku: v.sku || "", title: v.title || "", description: v.description || "",
        cost_price: String(v.cost_price ?? ""), selling_price: String(v.selling_price ?? ""),
        quantity: String(v.quantity ?? 0),
        attributes: Object.entries(v.attributes || {}).map(([name, value]) => {
          const strValue = attrValueOf(value);
          const preset = rawAttributes.find((a) => a.name === name);
          const isMulti = preset?.data_type === "multi_select";
          return { name, value: isMulti ? strValue.split(",").map((s) => s.trim()).filter(Boolean)[0] || "" : strValue, isCustom: false };
        }),
        images: (v.images || []).map((img) => ({ existing: true, metadata: img, preview: getImageUrl(img.img_url) })),
        tags: v.tags || [],
      }))
      : [createEmptyVariant()];

    const currentTagNames = (prod.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);

    return {
      category_id: prod.category_id?._id || prod.category_id || "",
      brand_id: prod.brand_id?._id || prod.brand_id || "",
      name: prod.name || "", description: prod.description || "",
      tax: String(prod.tax ?? 0), status: prod.status || "active",
      tag_names: currentTagNames, variants,
    };
  };

  const handleEdit = () => {
    if (!product) return;
    setFormData(prepareEditData(product));
    setEditingProduct(product);
    setCurrentStep(1);
    setExpandedVariant(0);
    setTagInput("");
    setShowModal(true);
  };

  const handleAddVariantFromTab = () => { if (!product) return; router.push(`/admin/products/${id}/add-variant?tab=${activeTab}`); };

  const closeProductModal = () => {
    formData.variants.forEach((v) => { v.images.forEach((img) => { if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); }); });
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0); setTagInput("");
  };

  const addVariant = async () => {
    try {
      const result = await variantApi.getNextSku();
      const newIndex = formData.variants.length;
      setFormData((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant(result.sku)] }));
      setExpandedVariant(newIndex);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const duplicateVariant = async (index) => {
    try {
      const result = await variantApi.getNextSku();
      const old = formData.variants[index];
      const copy = { ...old, _id: null, sku: result.sku, attributes: old.attributes.map(i => ({ ...i })), images: [], tags: [...old.tags] };
      setFormData((prev) => { const v = [...prev.variants]; v.splice(index + 1, 0, copy); return { ...prev, variants: v }; });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) { toast.error("At least one variant is required"); return; }
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = { ...v[index], [field]: value }; return { ...prev, variants: v }; });
  };

  const resetAttributeForm = () => {
    setNewAttributeData({ name: "", code: "", data_type: "text", values: [{ label: "", value: "" }], variant_allowed: true });
  };

  const handleOpenAttributeModal = (vi) => { setAttributeTargetVariant(vi); resetAttributeForm(); setShowAttributeModal(true); };
  const handleAddAttributeValue = () => setNewAttributeData((prev) => ({ ...prev, values: [...prev.values, { label: "", value: "" }] }));
  const handleRemoveAttributeValue = (index) => setNewAttributeData((prev) => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }));
  const handleAttributeValueChange = (index, field, val) => {
    setNewAttributeData((prev) => { const newValues = [...prev.values]; newValues[index] = { ...newValues[index], [field]: val }; return { ...prev, values: newValues }; });
  };

  const addAttribute = (vi) => handleOpenAttributeModal(vi);

  const handleAttributeSubmit = () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const finalCode = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const payload = {
      name: newAttributeData.name.trim(), code: finalCode, data_type: newAttributeData.data_type, variant_allowed: true,
      values: (newAttributeData.data_type === "select" || newAttributeData.data_type === "multi_select") ? newAttributeData.values.filter((v) => v.label.trim() && v.value.trim()) : [],
    };
    const tempKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAttrConfig = { _localKey: tempKey, name: newAttributeData.name, value: "", isCustom: false, _creating: true };
    const targetIndex = attributeTargetVariant ?? 0;
    setFormData((prev) => {
      const v = [...prev.variants];
      if (v[targetIndex]) v[targetIndex] = { ...v[targetIndex], attributes: [...(v[targetIndex]?.attributes || []), newAttrConfig] };
      return { ...prev, variants: v };
    });
    setShowAttributeModal(false);
    createAttributeMutation.mutate({ payload, tempKey, targetIndex, attributeName: newAttributeData.name });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; const a = [...v[vi].attributes]; a[ai] = { ...a[ai], [field]: value }; v[vi] = { ...v[vi], attributes: a }; return { ...prev, variants: v }; });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], attributes: v[vi].attributes.filter((_, i) => i !== ai) }; return { ...prev, variants: v }; });
  };

  const addVariantTag = (vi, e) => {
    e?.preventDefault();
    const val = formData.variants[vi].tagInput?.trim().toLowerCase();
    if (!val) return;
    if (formData.variants[vi].tags.includes(val)) { toast.info("Tag already added to this variant"); return; }
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: [...v[vi].tags, val], tagInput: "" }; return { ...prev, variants: v }; });
  };

  const removeVariantTag = (vi, tagName) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: v[vi].tags.filter(t => t !== tagName) }; return { ...prev, variants: v }; });
  };

  const updateVariantTagInput = (vi, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tagInput: value }; return { ...prev, variants: v }; });
  };

  const handleCreateGlobalTag = () => { if (!newGlobalTag.trim()) return; createTagMutation.mutate({ name: newGlobalTag.trim() }); };
  const handleCreateTagFromModal = () => {
    const tagName = newTagModalValue.trim();
    if (!tagName || !product?._id) return;
    // Create AND assign to this product in one step: backend resolveTags
    // creates the tag if missing and re-points product.tag_ids
    const data = new FormData();
    data.append("tag_names", JSON.stringify([...(displayTagNames || []), tagName]));
    updateProductTagsMutation.mutate(
      { id: product._id, data, successMsg: "Tag added successfully", errorMsg: "Failed to add tag" },
      { onSuccess: () => { setShowCreateTagModal(false); setNewTagModalValue(""); } }
    );
  };

  const startEditGlobalTag = (tag) => { setEditingTagId(tag._id); setEditingTagName(tag.name); setShowEditTagModal(true); };
  const saveEditGlobalTag = () => {
    const newName = editingTagName.trim();
    if (!newName || !editingTagId) return;
    const original = (allAssignedTags || []).find(t => String(t._id) === String(editingTagId));
    const oldName = original?.name;
    if (!oldName) return;
    if (oldName === newName) { cancelEditTag(); return; }
    const isRealTag = (globalTags || []).some(t => String(t._id) === String(editingTagId));
    if (isRealTag) {
      // Active global tag — rename the tag document (existing behaviour)
      updateTagMutation.mutate({ id: editingTagId, data: { name: newName } });
      return;
    }
    // Assigned tag without an active global tag doc — rename the assignment on
    // this product / variants (backend resolveTags creates/finds the active tag)
    const data = new FormData();
    data.append("tag_names", JSON.stringify((displayTagNames || []).map(n => (n === oldName ? newName : n))));
    const variantHasTag = (v) => (v.tags || []).map(tagNameOf).includes(oldName);
    if ((variants || []).some(variantHasTag)) {
      const updatedVariants = (variants || []).map(v => variantHasTag(v)
        ? { ...v, tags: (v.tags || []).map(tagNameOf).map(t => (t === oldName ? newName : t)) }
        : v);
      data.append("variants", JSON.stringify(updatedVariants));
    }
    updateProductTagsMutation.mutate(
      { id: product._id, data, successMsg: "Tag updated successfully", errorMsg: "Failed to update tag" },
      { onSuccess: () => { setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); } }
    );
  };
  const cancelEditTag = () => { setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); };
  const deleteGlobalTag = (tagId) => deleteTagMutation.mutate(tagId);

  const compressProductImage = (file) => new Promise((resolve) => {
    const image = new Image(); const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      const MAX = 1400; let w = image.width, h = image.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob((blob) => { URL.revokeObjectURL(imageUrl); if (!blob) { resolve(file); return; } resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp", lastModified: Date.now() })); }, "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
    image.src = imageUrl;
  });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (valid.length !== files.length) { toast.error("Only JPG, PNG and WebP images are allowed"); return; }
    try {
      const compressed = await Promise.all(valid.map(f => compressProductImage(f)));
      const imgs = compressed.map(f => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], images: [...v[vi].images, ...imgs] }; return { ...prev, variants: v }; });
      toast.success("Image optimized successfully");
    } catch { toast.error("Image processing failed"); }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => { const v = [...prev.variants]; const img = v[vi].images[ii]; if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); v[vi] = { ...v[vi], images: v[vi].images.filter((_, i) => i !== ii) }; return { ...prev, variants: v }; });
  };

  const handleNextStep = () => {
    if (!formData.category_id) { toast.error("Please select category"); return; }
    if (!formData.brand_id) { toast.error("Please select brand"); return; }
    if (!formData.name.trim()) { toast.error("Product name is required"); return; }
    setCurrentStep(2);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const skuSet = new Set();
    for (const v of formData.variants) {
      const sku = v.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku)) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku);
      if (!v.title.trim()) { toast.error("Variant title is required"); return; }
      if (v.cost_price === "" || v.selling_price === "") { toast.error("Cost price and selling price are required"); return; }
      if (Number(v.selling_price) <= Number(v.cost_price)) { toast.error(`Selling Price must be greater than Cost Price for "${v.title || v.sku}"`); return; }
    }

    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description);
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    data.append("tag_names", JSON.stringify(formData.tag_names || []));

    const imageVariantIndexes = [];
    const variants = formData.variants.map((v, idx) => {
      const attributes = {};
      v.attributes.forEach((a) => {
        const key = a.name.trim();
        if (!key) return;
        const preset = rawAttributes.find((p) => p.name === key);
        const isMulti = preset?.data_type === "multi_select";
        if (isMulti) { const singleVal = String(a.value || "").trim(); if (!singleVal) return; attributes[key] = singleVal; }
        else if (Array.isArray(a.value)) { if (a.value.length === 0) return; attributes[key] = a.value.join(","); }
        else { if (a.value === "" || a.value == null) return; attributes[key] = a.value; }
      });

      const existingImages = v.images.filter(i => i.existing).map(i => i.metadata);
      v.images.filter(i => !i.existing && i.file).forEach(i => { data.append("images", i.file); imageVariantIndexes.push(idx); });

      let finalSku = v.sku.trim();
      if (editingProduct) { const orig = editingProduct.variants?.find(ov => ov._id && String(ov._id) === String(v._id)); if (orig) finalSku = orig.sku; }

      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description,
        cost_price: Number(v.cost_price || 0), selling_price: Number(v.selling_price || 0),
        quantity: Number(v.quantity || 0),
        attributes, existing_images: existingImages, tags: v.tags || [],
      };
    });

    data.append("variants", JSON.stringify(variants));
    data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));

    if (editingProduct) updateMutation.mutate({ id: editingProduct._id, data });
  };

  const addTag = (e) => {
    e?.preventDefault();
    const val = tagInput.trim().toLowerCase();
    if (!val) return;
    if (formData.tag_names.includes(val)) { toast.info("Tag already added"); setTagInput(""); return; }
    setFormData(prev => ({ ...prev, tag_names: [...prev.tag_names, val] }));
    setTagInput("");
  };

  const removeTag = (tagName) => setFormData(prev => ({ ...prev, tag_names: prev.tag_names.filter(t => t !== tagName) }));

  const handleAddVariantTag = () => {
    const val = variantTagInput.trim().toLowerCase();
    if (!val) return;
    const currentTags = editingVariantForTags?.tags || [];
    if (currentTags.includes(val)) { toast.info("Tag already added"); setVariantTagInput(""); return; }
    const newTags = [...currentTags, val];
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
    setVariantTagInput("");
  };

  const handleRemoveVariantTag = (tagToRemove) => {
    const newTags = (editingVariantForTags?.tags || []).filter(t => t !== tagToRemove);
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
  };

  // Loading/Error states
  if (isLoading) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading product details...</p>
      </div>
    </div>
  );

  if (isError || !product) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
          <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Product Not Found</h2>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This product does not exist or has been removed.</p>
        <button onClick={() => router.push("/admin/products")} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </button>
      </div>
    </div>
  );

  const variants = product.variants || [];
  const totalStock = variants.reduce((t, v) => t + Number(v.quantity || 0), 0);
  const totalVariants = variants.length;
  const totalValue = variants.reduce((t, v) => t + (Number(v.selling_price || 0) * Number(v.quantity || 0)), 0);
  const lowestPrice = variants.length > 0 ? Math.min(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const highestPrice = variants.length > 0 ? Math.max(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const priceRange = lowestPrice === highestPrice ? `Rs. ${lowestPrice.toLocaleString()}` : `Rs. ${lowestPrice.toLocaleString()} - Rs. ${highestPrice.toLocaleString()}`;
  const liveUpdatedEvents = liveEvents.filter((e) => e.type === "updated");
  const latestLiveUpdate = liveUpdatedEvents[liveUpdatedEvents.length - 1] || null;
  const displayTagNames = (product.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
  const assignedTagNames = new Set(displayTagNames.map(n => String(n).trim()).filter(Boolean));
  (variants || []).forEach(v => { (v.tags || []).forEach(tag => { const n = tagNameOf(tag); if (n) assignedTagNames.add(String(n).trim()); }); });
  // Case-insensitive matching: Tag docs store lowercased names while variant
  // tag strings keep the original case, so compare on lowercase everywhere.
  const lowerAssignedNames = new Set([...assignedTagNames].map(n => n.toLowerCase()));
  const globalTagNames = new Set((globalTags || []).map(t => String(t.name || t).trim().toLowerCase()));
  const assignedTags = (globalTags || []).filter(tag => lowerAssignedNames.has(String(tag.name || tag).trim().toLowerCase()));
  const missingTagNames = [];
  assignedTagNames.forEach(name => {
    if (!globalTagNames.has(name.toLowerCase())) {
      missingTagNames.push(name);
    }
  });
  const syntheticTags = missingTagNames.map(name => ({ name, _id: name }));
  const allAssignedTags = [...assignedTags, ...syntheticTags];

  // Build lookup from existing global tag records (with resolved createdby) by lowercase name and by id
  const tagRecordLookup = {};
  (globalTags || []).forEach((gt) => {
    if (gt && (gt.name || gt._id)) {
      tagRecordLookup[String(gt.name || gt).trim().toLowerCase()] = gt;
      if (gt._id) tagRecordLookup[String(gt._id).trim().toLowerCase()] = gt;
      if (gt.name) tagRecordLookup[String(gt.name || gt).trim()] = gt;
    }
  });

  // Source / Variant mapping for tag display (keys lowercased for case-insensitive lookup)
  const tagSourceInfo = {};
  (product.tag_ids || []).forEach(tagId => {
    const tagName = typeof tagId === 'object' ? tagId.name : tagId;
    if (tagName) tagSourceInfo[String(tagName).trim().toLowerCase()] = { source: "Product", variant: "—" };
  });
  (variants || []).forEach(v => {
    (v.tags || []).forEach(tagEntry => {
      const name = String(tagNameOf(tagEntry) || "").trim().toLowerCase();
      if (name) tagSourceInfo[name] = { source: "Variant", variant: v.sku || v.title || String(v._id) };
    });
  });
  const firstVariant = variants[0];
  const productImage = firstVariant?.images?.[0] ? getImageUrl(firstVariant.images[0].img_url) : null;

  // Hero side panel: attribute summary (derived from existing variant attributes)
  const attributeSummary = (() => {
    const map = {};
    (variants || []).forEach((v) => {
      Object.entries(v.attributes || {}).forEach(([name, value]) => {
        const n = String(name || "").trim();
        if (!n) return;
        const val = attrValueOf(value);
        if (!map[n]) map[n] = new Set();
        if (val) map[n].add(val);
      });
    });
    return Object.entries(map).map(([name, vals]) => ({ name, display: vals.size > 1 ? "Multiple" : [...vals][0] || "—" }));
  })();
  const allAttributeDetails = (() => {
    const valuesByName = new Map();
    (variants || []).forEach((variant) => {
      Object.entries(variant.attributes || {}).forEach(([name, value]) => {
        const cleanName = String(name || "").trim();
        const cleanValue = attrValueOf(value);
        if (!cleanName || !cleanValue) return;
        if (!valuesByName.has(cleanName)) valuesByName.set(cleanName, new Set());
        valuesByName.get(cleanName).add(cleanValue);
      });
    });
    return [...valuesByName.entries()].map(([name, values]) => ({ name, value: [...values].join(", ") }));
  })();
  const attributeCount = attributeSummary.length;
  const tagCount = allAssignedTags.length;

  // Helper to open gallery
  const openGallery = (index) => {
    setCurrentImageIndex(index);
    setShowImageGallery(true);
  };

  // ==================== VARIANTS SECTION (shared: Overview + Variants tabs) ====================
  const variantsSection = (
  <div className="space-y-5">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Variants</h2>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{totalVariants} {totalVariants === 1 ? "variant" : "variants"} · {totalStock} units total</p>
      </div>
      <button onClick={handleAddVariantFromTab} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
        <Plus className="w-4 h-4" /> Add Variant
      </button>
    </div>

    {variants.length === 0 ? (
      <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
          <Layers3 className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">No variants yet</p>
        <p className="text-[12px] text-[var(--text-muted)]">This product doesn't have any variants yet.</p>
        <button onClick={handleAddVariantFromTab} className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <Plus className="w-4 h-4" /> Create First Variant
        </button>
      </div>
    ) : (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <table className="w-full text-[12px]">
          <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Image</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">SKU</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Variant / Color</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Price</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Stock</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Status</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const isLowStock = Number(variant.quantity) <= 5;
              const isActive = variant.status === "active" || !variant.status;
              return (
                <tr key={variant._id || index} style={{ borderBottom: index < variants.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                  <td className="px-4 py-4">
                    {variant.images?.length > 0 ? (
                      <button onClick={() => openGallery(0)} className="block w-10 h-10 rounded-md overflow-hidden border border-[var(--border-color)] hover:ring-2 hover:ring-[var(--accent)] transition-all">
                        <img src={getImageUrl(variant.images[0].img_url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[140px]">{variant.sku}</td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate max-w-[180px]">{variant.title || `Variant ${index + 1}`}</p>
                    {variant.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variant.tags.slice(0, 2).map((tag, idx) => (
                          <span key={`${tag}-${idx}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]">{tag}</span>
                        ))}
                        {variant.tags.length > 2 && (
                          <span className="text-[9px] text-[var(--text-muted)]">+{variant.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-semibold text-[13px]" style={{ color: "var(--success)" }}>Rs. {Number(variant.selling_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-4 font-semibold text-[13px]" style={{ color: isLowStock ? "var(--danger)" : "var(--text-primary)" }}>{variant.quantity || 0}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: isActive ? "var(--success-soft)" : "var(--danger-soft)",
                        color: isActive ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${isActive ? "color-mix(in srgb, var(--success) 28%, transparent)" : "color-mix(in srgb, var(--danger) 28%, transparent)"}`,
                      }}>
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: isActive ? "var(--success)" : "var(--danger)" }} />
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right relative z-10">
                    <MoreMenu actions={[
                      { 
                        label: "Edit Variant", 
                        icon: <Edit3 className="w-3.5 h-3.5" />, 
                        onClick: () => router.push(`/admin/products/${id}/add-variant?edit=${variant._id}&tab=${activeTab}`) 
                      },
                      { 
                        label: "Add Tag", 
                        icon: <TagIcon className="w-3.5 h-3.5" />, 
                        onClick: () => { 
                          setEditingVariantForTags({ ...variant, tags: variant.tags || [] }); 
                          setShowVariantTagsModal(true); 
                          setVariantTagInput(""); 
                        } 
                      },
                      { 
                        label: isActive ? "Disable" : "Enable", 
                        icon: isActive ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />, 
                        onClick: () => {
                          const updatedVariants = product.variants.map(v => 
                            String(v._id) === String(variant._id) 
                              ? { ...v, status: isActive ? "inactive" : "active" } 
                              : v
                          );
                          const data = new FormData();
                          data.append("variants", JSON.stringify(updatedVariants));
                          updateMutation.mutate({ id: product._id, data });
                        }
                      },
                      { 
                        label: "Delete", 
                        icon: <Trash2 className="w-3.5 h-3.5" />, 
                        destructive: true, 
                        onClick: () => {
                          setDeleteVariantTarget(variant);
                        } 
                      },
                    ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
  );

  return (
    <div className="w-full space-y-5 pb-10">
      
      {/* IMAGE GALLERY MODAL */}
      {showImageGallery && firstVariant?.images && (
        <ImageGalleryModal 
          images={firstVariant.images} 
          initialIndex={currentImageIndex} 
          onClose={() => setShowImageGallery(false)} 
        />
      )}

      {showAllAttributes && (
        <AllAttributesModal
          attributes={allAttributeDetails}
          onClose={() => setShowAllAttributes(false)}
        />
      )}

      {/* HEADER: Breadcrumb + Actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <nav className="flex items-center flex-wrap gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <button onClick={() => router.push("/admin/products")} className="hover:text-[var(--text-primary)] transition-colors font-medium">Products</button>
            <ChevronRight className="w-3 h-3 shrink-0" />
            {product.category_id?.name && (
              <>
                <span className="max-w-[160px] truncate">{product.category_id.name}</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            {product.brand_id?.name && (
              <>
                <span className="max-w-[160px] truncate">{product.brand_id.name}</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            <span className="max-w-[240px] truncate font-semibold" style={{ color: "var(--text-primary)" }}>{product.name}</span>
          </nav>
          <h1 className="mt-2 text-[22px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{product.name}</h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>View product information, variants, status and related details.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDelete}
            className="h-8 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90"
            style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      </div>

      {/* PRODUCT HERO: Gallery + Info + Meta panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <div className="xl:col-span-8 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-0">
          {/* Image Area - NOW CLICKABLE */}
          <div className="relative bg-[var(--bg-tertiary)] p-5 md:p-6 flex items-center justify-center min-h-[280px] md:min-h-[340px] group">
            {firstVariant?.images?.length > 0 ? (
              <div className="flex w-full max-w-md items-start gap-3">
                {/* Main Clickable Image */}
                <button 
                  onClick={() => openGallery(0)}
                  className="block w-full relative overflow-hidden rounded-xl shadow-lg group-hover:shadow-2xl transition-all duration-300"
                >
                  <img
                    src={getImageUrl(firstVariant.images[0].img_url)}
                    alt={product.name}
                    className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                    style={{ maxHeight: 300 }}
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      <span className="text-xs font-medium">View Full Size</span>
                    </div>
                  </div>
                </button>

                {/* Clickable Thumbnails */}
                {firstVariant.images.length > 1 && (
                  <div className="flex max-h-[300px] w-14 shrink-0 flex-col gap-2 overflow-y-auto pb-1 scrollbar-hide">
                    {firstVariant.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => openGallery(i)}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all duration-200 ${
                          i === 0 
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 scale-105" 
                            : "border-[var(--border-color)] hover:border-[var(--text-muted)] opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={getImageUrl(img.img_url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl flex flex-col items-center justify-center bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)]">
                <ImageIcon className="w-12 h-12 mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>No product images available</p>
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="p-5 md:p-6 flex flex-col gap-4">
            <h2 className="text-[20px] md:text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{product.name}</h2>
            
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {product.description ? product.description.slice(0, 160) + (product.description.length > 160 ? "..." : "") : "No description provided."}
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                Rs. {Number(firstVariant?.selling_price || product.variants?.[0]?.selling_price || 0).toLocaleString()}
              </span>
              {lowestPrice !== highestPrice ? (
                <span className="text-base line-through" style={{ color: "var(--text-muted)" }}>{priceRange}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: product.status === "active" ? "var(--success)" : "var(--danger)" }} />
              <span className="text-[12px] font-bold" style={{ color: product.status === "active" ? "var(--success)" : "var(--danger)" }}>
                {product.status === "active" ? "In Stock" : "Inactive"}
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                (Total: {totalStock} units)
              </span>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers3 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Variants</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalVariants}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Stock</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalStock}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Attributes</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{attributeCount}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <TagIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Tags</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{tagCount}</p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* SIDE PANEL: Brand / Category / Key Attributes */}
        <div className="xl:col-span-4 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-5 flex flex-col gap-4">
            {/* Brand */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Brand</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                    {ini(product.brand_id?.name)}
                  </div>
                  <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.brand_id?.name || "—"}
                  </span>
                </div>
                {product.brand_id?._id && (
                  <button type="button" onClick={() => router.push(`/admin/brands/${product.brand_id._id}`)} className="flex items-center gap-0.5 text-[11px] font-medium hover:underline shrink-0" style={{ color: "var(--accent)" }}>
                    View brand <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Category</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                    <Box className="w-4 h-4" />
                  </div>
                  <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.category_id?.name || "—"}
                  </span>
                </div>
                {product.category_id?._id && (
                  <button type="button" onClick={() => router.push(`/admin/categories/${product.category_id._id}`)} className="flex items-center gap-0.5 text-[11px] font-medium hover:underline shrink-0" style={{ color: "var(--accent)" }}>
                    View category <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Key Attributes */}
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Key Attributes</p>
              {attributeSummary.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {attributeSummary.slice(0, 4).map((attr) => (
                      <div key={attr.name} className="rounded-lg p-2" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <p className="truncate text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{attr.name}</p>
                        <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{attr.display}</p>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowAllAttributes(true)} className="mt-2.5 flex items-center gap-0.5 text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                    View all attributes <ChevronRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No attributes set on variants.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {/* MAIN CONTENT - FULL WIDTH NOW */}
        <div className="space-y-5">
          {/* TABS */}
          <div className="flex items-center gap-6 border-b" style={{ borderColor: "var(--border-color)" }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "variants", label: "Variants", count: totalVariants > 0 ? totalVariants : null },
              { id: "tags", label: "Tags", count: displayTagNames.length > 0 ? displayTagNames.length : null },
              { id: "category", label: "Category" },
              { id: "brand", label: "Brand" },
              { id: "activity", label: "History" },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className="relative py-3 text-[13px] font-medium transition-colors outline-none whitespace-nowrap"
                  style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
                >
                  {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className="ml-1.5 text-[11px] font-medium" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                      ({t.count})
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT */}
          <div className="space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-5">
                {/* Product Details + Description + Variants | Side cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 flex flex-col gap-5 self-start">
                    {/* Product Details */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Product Details</h3>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">Basic information</span>
                      </div>
                      <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">SKU</p>
                            <p className="text-[14px] font-mono font-medium text-[var(--text-secondary)]">{firstVariant?.sku || variants?.[0]?.sku || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Product Name</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Brand</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.brand_id?.name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Category</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.category_id?.name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Tax Rate</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.tax || 0}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.status === "active" ? "Active" : "Inactive"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Price Range</p>
                            <p className="text-[14px] font-semibold text-[var(--accent)]">{priceRange}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Stock</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{totalStock} units</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Created at</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{fd(product.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Updated at</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.updated_at ? fd(product.updated_at) : "Never"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Description + Tags */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Description</h3>
                      </div>
                      <div className="p-5 space-y-5">
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                          {product.description || "No description provided for this product."}
                        </p>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tags</p>
                            {displayTagNames.length > 0 && (
                              <button type="button" onClick={() => setActiveTab("tags")} className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                                Manage
                              </button>
                            )}
                          </div>
                          {displayTagNames.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(displayTagNames || []).map((tag) => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]">{tag}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[12px] text-[var(--text-muted)]">No tags assigned to this product yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {variantsSection}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Product Images */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Product Images</h3>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">{firstVariant?.images?.length || 0} {firstVariant?.images?.length === 1 ? "image" : "images"}</span>
                      </div>
                      <div className="p-3">
                        {firstVariant?.images?.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openGallery(0)}
                              className="group/img relative block w-full overflow-hidden rounded-lg border border-[var(--border-color)]"
                            >
                              <img src={getImageUrl(firstVariant.images[0].img_url)} alt={product.name} className="w-full h-36 object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/20">
                                <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/img:opacity-100">
                                  <ZoomIn className="w-3 h-3" /> View
                                </span>
                              </span>
                            </button>
                            {firstVariant.images.length > 1 && (
                              <div className="mt-2 grid grid-cols-4 gap-2">
                                {firstVariant.images.slice(1, 4).map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => openGallery(i + 1)}
                                    className="h-14 w-full overflow-hidden rounded-md border border-[var(--border-color)] transition-all hover:ring-2 hover:ring-[var(--accent)]"
                                  >
                                    <img src={getImageUrl(img.img_url)} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                                {firstVariant.images.length > 4 && (
                                  <button
                                    type="button"
                                    onClick={() => openGallery(4)}
                                    className="flex h-14 w-full items-center justify-center rounded-md text-[11px] font-bold"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                                  >
                                    +{firstVariant.images.length - 4}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                            <ImageIcon className="mb-1 h-6 w-6" style={{ color: "var(--text-muted)" }} />
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No images available</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Info */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Quick Info</h3>
                      </div>
                      <div className="px-3 pb-3 pt-1">
                        <DataRow label="Total Stock" value={`${totalStock} units`} highlight />
                        <DataRow label="Total Variants" value={totalVariants} />
                        <DataRow label="Stock Value" value={`Rs. ${totalValue.toLocaleString()}`} />
                        <DataRow label="Price Range" value={priceRange} highlight mono />
                        <DataRow label="Tax Rate" value={`${product.tax || 0}%`} />
                      </div>
                    </div>

                    {/* Created By */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Created By</h3>
                      </div>
                      <div className="p-3">
                        {product.createdby ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <Avatar user={product.createdby} size="md" color="emerald" />
                              <div>
                                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{product.createdby.name || product.createdby.email}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{product.createdby.email || "—"}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">—</p>
                            <p className="text-[11px] text-[var(--text-muted)]">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                          </div>
                        )}
                      </div>
                    </div>

                    {latestLiveUpdate && (
                      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">Updated By</h3>
                        </div>
                        <div className="p-3">
                          {latestLiveUpdate.user ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <Avatar user={latestLiveUpdate.user} size="md" color="blue" />
                                <div>
                                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{latestLiveUpdate.user.name || latestLiveUpdate.user.email}</p>
                                  <p className="text-[11px] text-[var(--text-muted)]">{latestLiveUpdate.user.email || "—"}</p>
                                </div>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] mt-1">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(latestLiveUpdate.date)}</span></p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">—</p>
                              <p className="text-[11px] text-[var(--text-muted)]">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(latestLiveUpdate.date)}</span></p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* VARIANTS TAB */}
            {activeTab === "variants" && variantsSection}

            {/* TAGS TAB */}
            {activeTab === "tags" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Tags</h2>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{allAssignedTags.length} {allAssignedTags.length === 1 ? "tag" : "tags"} assigned</p>
                  </div>
                  <button
                    onClick={() => setShowCreateTagModal(true)}
                    className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    <Plus className="w-4 h-4" /> Add Tag
                  </button>
                </div>

                {allAssignedTags.length === 0 ? (
                  <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <TagIcon className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                    <p className="text-[13px] font-medium text-[var(--text-secondary)]">No assigned tags</p>
                    <p className="text-[12px] text-[var(--text-muted)]">Tags assigned to this product or its variants will appear here.</p>
                    <button
                      onClick={() => setShowCreateTagModal(true)}
                      className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                    >
                      <Plus className="w-4 h-4" /> Create First Tag
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <table className="w-full text-[12px]">
                      <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                         <tr>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Tag Name</th>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Source</th>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Created By</th>
                           <th className="text-right px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
                         </tr>
                      </thead>
                      <tbody>
                        {allAssignedTags.map((tag, index) => (
                          <tr key={tag._id || tag.name || index} style={{ borderBottom: index < allAssignedTags.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                             <td className="px-5 py-3.5">
                               <span className="font-semibold text-[13px] capitalize" style={{ color: "var(--text-primary)" }}>{tag.name}</span>
                             </td>
                             <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)] capitalize">
                               {tagSourceInfo[String(tag.name || tag || "").trim().toLowerCase()]?.source || "—"}
                             </td>
                              <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)]">
                                {(() => {
                                  const lookupKey = String(tag.name || tag || "").trim().toLowerCase();
                                  const lookupIdKey = tag._id ? String(tag._id).trim().toLowerCase() : null;
                                  const resolvedTag = tagRecordLookup[lookupKey] || (lookupIdKey ? tagRecordLookup[lookupIdKey] : null) || tag;
                                  const cb = resolvedTag?.createdby;
                                  if (!cb) return "—";
                                  if (typeof cb === 'object') {
                                    const name = cb.name || cb.email || "";
                                    return name ? String(name).trim() : "—";
                                  }
                                  const str = String(cb || "").trim();
                                  return str && str !== "null" && str !== "undefined" ? str : "—";
                                })()}
                              </td>
                             <td className="px-5 py-3.5 text-right relative z-10">
                                <MoreMenu actions={[
                                 { label: "Edit", icon: <Edit3 className="w-3.5 h-3.5" />, onClick: () => startEditGlobalTag(tag) },
                                 { label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, destructive: true, onClick: () => setDeleteTagTarget(tag), disabled: deleteTagMutation.isPending },
                              ]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY TAB */}
            {activeTab === "category" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {product.category_id ? (
                  <>
                    <InfoCard icon={FolderOpen} title="Category Details">
                      <div className="space-y-1">
                        <DataRow icon={Hash} label="Name" value={product.category_id.name} />
                        <DataRow icon={Hash} label="Code" value={product.category_id.category_code || "—"} mono />
                        <DataRow icon={Activity} label="Status" value="Active" highlight />
                        <DataRow icon={Package} label="Assigned Product" value={product.name} />
                      </div>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Description">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        {product.category_id.description || "No description available for this category."}
                      </p>
                    </InfoCard>
                  </>
                ) : (
                  <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <EmptyState icon={FolderOpen} title="No Category Assigned" description="This product is not assigned to any category yet." />
                  </div>
                )}
              </div>
            )}

            {/* BRAND TAB */}
            {activeTab === "brand" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {product.brand_id ? (
                  <>
                    <InfoCard icon={Store} title="Brand Details">
                      <div className="space-y-1">
                        <DataRow icon={Hash} label="Name" value={product.brand_id.name} />
                        <DataRow icon={Hash} label="Code" value={product.brand_id.brand_code || "—"} mono />
                        <DataRow icon={FolderOpen} label="Country" value={product.brand_id.country || "—"} />
                        <DataRow icon={Activity} label="Status" value={product.brand_id.is_active ? "Active" : "Inactive"} highlight={product.brand_id.is_active} />
                      </div>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Description">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        {product.brand_id.description || "No description available for this brand."}
                      </p>
                    </InfoCard>
                  </>
                ) : (
                  <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <EmptyState icon={Store} title="No Brand Assigned" description="This product is not assigned to any brand yet." />
                  </div>
                )}
              </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === "activity" && (
              <InfoCard icon={Activity} title="Activity Timeline" action={
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: isConnected ? "var(--success-soft)" : "var(--bg-tertiary)", color: isConnected ? "var(--success)" : "var(--text-muted)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? "var(--success)" : "var(--text-muted)" }} />
                  {isConnected ? "Live" : "Offline"}
                </span>
              }>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)" }}>
                        <Plus className="w-5 h-5" style={{ color: "var(--success)" }} />
                      </div>
                      {latestLiveUpdate && (
                        <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>Product Created</h4>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            Created by <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{product.createdby?.name || "—"}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{fd(product.created_at)}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tago(product.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {liveEvents.map((ev, i) => (
                    <div key={ev.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: ev.type === "created" ? "var(--success-soft)" : "var(--info-soft)" }}>
                          {ev.type === "created" ? <Plus className="w-5 h-5" style={{ color: "var(--success)" }} /> : <Pencil className="w-5 h-5" style={{ color: "var(--info)" }} />}
                        </div>
                        {i < liveEvents.length - 1 && <div className="w-px flex-1 my-2" style={{ backgroundColor: "var(--border-color)" }} />}
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                              {ev.type === "created" ? "Product Created" : "Product Updated"} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>LIVE</span>
                            </h4>
                            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                              {ev.type === "created" ? "Added to the system" : "Details were modified"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{fd(ev.date)}</p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tago(ev.date)}</p>
                          </div>
                        </div>
                        {ev.user && (
                          <div className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                            <Avatar user={ev.user} size="sm" color={ev.type === "created" ? "emerald" : "blue"} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{ev.user.name || ev.user.email}</p>
                              <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{ev.user.email}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {liveEvents.length === 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                      <Clock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>No updates yet. Product has not been modified since creation.</span>
                    </div>
                  )}
                </div>
              </InfoCard>
            )}
            
            {/* ATTRIBUTES TAB COMPLETELY REMOVED */}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[92vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Product</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update product and variant information</p>
              </div>
              <button onClick={closeProductModal} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep > 1 ? "var(--success)" : "var(--bg-card)", color: currentStep > 1 ? "#fff" : "var(--text-muted)" }}>
                  {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                </div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 1 ? "var(--text-primary)" : "var(--text-muted)" }}>Product Info</span>
              </div>
              <div className="h-px w-8" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep === 2 ? "var(--success)" : "var(--bg-card)", color: currentStep === 2 ? "#fff" : "var(--text-muted)" }}>2</div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 2 ? "var(--text-primary)" : "var(--text-muted)" }}>Variants</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <form id="product-edit-form" onSubmit={handleSubmit} className="p-4">
                {currentStep === 1 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Category *</label>
                        <select required value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <option value="">Select category</option>
                          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Brand *</label>
                        <select required value={formData.brand_id} onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <option value="">Select brand</option>
                          {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Product Name *</label>
                      <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tags</label>
                      <div className="flex gap-2">
                        <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          placeholder="Type tag name & press Enter" className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={addTag} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {formData.tag_names.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {formData.tag_names.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                              {tag}
                              <button type="button" onClick={() => removeTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Description</label>
                      <textarea rows={3} placeholder="Enter product description..." value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tax (%)</label>
                        <input type="number" min="0" placeholder="e.g. 18" value={formData.tax}
                          onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Status</label>
                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <option value="active">Active</option><option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button type="button" onClick={handleNextStep} className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                        Next: Variants <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="flex items-center gap-2 text-base font-bold">
                          <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
                          Variants ({formData.variants.length})
                        </h4>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                      </div>
                      <button type="button" onClick={addVariant} className="h-9 px-4 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                        <Plus className="w-3.5 h-3.5" /> Add Variant
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formData.variants.map((variant, index) => (
                        <div key={variant._id || index} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-color)" }}>
                          <div className="flex cursor-pointer items-center justify-between px-4 py-3"
                            style={{ backgroundColor: "var(--bg-tertiary)" }}
                            onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                            <div>
                              <p className="text-[13px] font-bold">{variant.sku || `Variant ${index + 1}`}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index + 1}`}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}
                                className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
                                <Copy className="w-4 h-4" />
                              </button>
                              <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}
                                className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "var(--danger)" }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <ChevronDown className={`w-5 h-5 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                            </div>
                          </div>

                          {expandedVariant === index && (
                            <div className="space-y-3 p-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Identification</p>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                  <div>
                                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>SKU *</label>
                                    <input required type="text" placeholder="e.g. sku_4" value={variant.sku}
                                      readOnly={!!editingProduct && !!variant._id}
                                      onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                      className={`h-9 px-3 rounded-lg text-[12px] w-full outline-none ${editingProduct && variant._id ? "opacity-60 cursor-not-allowed" : ""}`}
                                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Title *</label>
                                    <input required type="text" placeholder="e.g. Black - Large" value={variant.title}
                                      onChange={(e) => updateVariant(index, "title", e.target.value)}
                                      className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Description</label>
                                  <textarea rows={2} placeholder="Enter variant description..." value={variant.description}
                                    onChange={(e) => updateVariant(index, "description", e.target.value)}
                                    className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Pricing & Stock</p>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                  {[{ l: "Cost Price *", f: "cost_price", p: "1000" }, { l: "Selling Price *", f: "selling_price", p: "1500" },
                                  { l: "Quantity", f: "quantity", p: "50" }
                                  ].map(({ l, f, p }) => (
                                    <div key={f}>
                                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>{l}</label>
                                      <input type="number" min="0" placeholder={p} value={variant[f]}
                                        onChange={(e) => updateVariant(index, f, e.target.value)}
                                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                    </div>
                                  ))}
                                </div>
                                {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                                  <div className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)", backgroundColor: "var(--danger-soft)" }}>
                                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--danger)" }} />
                                    <p className="text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Selling Price must be greater than Cost Price</p>
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Variant Tags</p>
                                <div className="flex gap-2 mb-3">
                                  <input type="text" value={variant.tagInput || ""} onChange={(e) => updateVariantTagInput(index, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addVariantTag(index, e)} placeholder="Add specific tag for this variant..."
                                    className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  <button type="button" onClick={(e) => addVariantTag(index, e)} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                {variant.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {variant.tags.map(tag => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                        {tag}
                                        <button type="button" onClick={() => removeVariantTag(index, tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
                                <div className="space-y-2">
                                  {variant.attributes.map((attr, ai) => {
                                    const preset = ATTRIBUTE_PRESETS.find(p => p.name === attr.name);
                                    const isMulti = preset?.data_type === "multi_select";
                                    const isNumber = preset?.data_type === "number";
                                    const selectedSingle = typeof attr.value === "string" ? attr.value : "";
                                    const setSingleValue = (val) => {
                                      const v = [...formData.variants];
                                      const a = [...v[index].attributes];
                                      a[ai] = { ...a[ai], value: val, isCustom: false };
                                      v[index] = { ...v[index], attributes: a };
                                      setFormData({ ...formData, variants: v });
                                    };

                                    return (
                                      <div key={ai} className="flex flex-wrap items-center gap-2">
                                        <div className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 flex items-center gap-2 font-semibold truncate"
                                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                          <span className="truncate">{attr.name || "—"}</span>
                                          {attr._creating && <span className="text-[10px] font-normal italic" style={{ color: "var(--text-muted)" }}>creating…</span>}
                                          {attr._createError && <span className="text-[10px] font-normal italic" style={{ color: "var(--danger)" }}>failed</span>}
                                        </div>
                                        {preset ? (
                                          isMulti ? (
                                            <div className="flex-1 min-w-[180px] flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg min-h-[42px]"
                                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                              {!selectedSingle && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Select an option...</span>}
                                              {selectedSingle && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                                  style={{ backgroundColor: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                                                  {selectedSingle}
                                                  <button type="button" onClick={() => setSingleValue("")} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10">
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </span>
                                              )}
                                              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                                                {preset.values.filter((val) => val !== selectedSingle).map((val) => (
                                                  <button key={val} type="button" onClick={() => setSingleValue(val)}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                                                    style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                                    {val}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            <input type={isNumber ? "number" : "text"} value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                              placeholder={`Enter ${preset.name.toLowerCase()} value...`}
                                              className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 outline-none"
                                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                          )
                                        ) : (
                                          <input type="text" placeholder="Value e.g. Black" value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                            className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                        )}
                                        <button type="button" onClick={() => removeAttribute(index, ai)} className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "var(--danger)" }}>
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                  <button type="button" onClick={() => addAttribute(index)} className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                                    <Plus className="w-4 h-4" /> Add Attribute
                                  </button>
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Product Images</p>
                                <label className="block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition hover:border-[var(--accent)]" style={{ borderColor: "var(--border-color)" }}>
                                  <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index, e)} />
                                  <Upload className="mx-auto mb-2 w-6 h-6" style={{ color: "var(--text-muted)" }} />
                                  <p className="text-[12px] font-semibold">Click to select images</p>
                                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto-optimized</p>
                                </label>
                                {variant.images.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {variant.images.map((img, ii) => (
                                      <div key={ii} className="relative group">
                                        <img src={img.preview} alt="" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
                                        <button type="button" onClick={() => removeImage(index, ii)}
                                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              {currentStep === 2 ? (
                <>
                  <button type="button" onClick={() => setCurrentStep(1)} className="h-9 px-5 rounded-lg text-[12px] font-semibold"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>← Back</button>
                  <button type="submit" form="product-edit-form" disabled={updateMutation.isPending}
                    className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    {updateMutation.isPending ? "Saving..." : "Update Product"} <Check className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div />
                  <button type="submit" form="product-edit-form" disabled={updateMutation.isPending}
                    className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    {updateMutation.isPending ? "Saving..." : "Next →"} <Check className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Tag</h3>
              <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={newTagModalValue} onChange={(e) => setNewTagModalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTagFromModal()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={handleCreateTagFromModal} disabled={updateProductTagsMutation.isPending || !newTagModalValue.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> {updateProductTagsMutation.isPending ? "Adding..." : "Create Tag"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Tag</h3>
              <button onClick={cancelEditTag} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={editingTagName} onChange={(e) => setEditingTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditGlobalTag()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={cancelEditTag} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={saveEditGlobalTag} disabled={updateTagMutation.isPending || updateProductTagsMutation.isPending || !editingTagName.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Save className="w-4 h-4" /> {(updateTagMutation.isPending || updateProductTagsMutation.isPending) ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Tags Modal */}
      {showVariantTagsModal && editingVariantForTags && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Manage Variant Tags</h3>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{editingVariantForTags.title || editingVariantForTags.sku}</p>
              </div>
              <button onClick={() => { setShowVariantTagsModal(false); setEditingVariantForTags(null); setVariantTagInput(""); }}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={variantTagInput} onChange={(e) => setVariantTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariantTag(); } }}
                  placeholder="Type tag & press Enter..." autoFocus className="h-10 px-3 rounded-lg text-[12px] flex-1 outline-none"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                <button onClick={handleAddVariantTag} disabled={!variantTagInput.trim()}
                  className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Current Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {(editingVariantForTags.tags || []).length > 0 ? (
                    (editingVariantForTags.tags || []).map((tag, idx) => (
                      <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                        <TagIcon className="w-3 h-3" />
                        {tag}
                        <button onClick={() => handleRemoveVariantTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/20">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && product && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete "{product.name}"?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The product and all its variants will be permanently removed.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button disabled={deleteMutation.isPending} onClick={confirmDelete}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* VARIANT DELETE CONFIRMATION */}
      {deleteVariantTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete Variant?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>Are you sure you want to delete variant &quot;{deleteVariantTarget.sku}&quot;? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteVariantTarget(null)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => {
                deleteVariantMutation.mutate(deleteVariantTarget._id);
                setDeleteVariantTarget(null);
              }} disabled={deleteVariantMutation.isPending} className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}>{deleteVariantMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* TAG DELETE CONFIRMATION */}
      {deleteTagTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete Tag?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>Are you sure you want to delete tag &quot;{deleteTagTarget.name}&quot;? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTagTarget(null)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => {
                const tagName = deleteTagTarget.name;
                // Remove the tag assignment from this product / variants
                // (other products' relationships remain unaffected)
                const data = new FormData();
                data.append("tag_names", JSON.stringify((displayTagNames || []).filter(n => n !== tagName)));
                if ((variants || []).some(v => (v.tags || []).map(tagNameOf).includes(tagName))) {
                  const updatedVariants = (variants || []).map(v => ({ ...v, tags: (v.tags || []).map(tagNameOf).filter(t => t !== tagName) }));
                  data.append("variants", JSON.stringify(updatedVariants));
                }
                updateProductTagsMutation.mutate({ id: product._id, data, successMsg: "Tag deleted successfully", errorMsg: "Failed to delete tag" });
                setDeleteTagTarget(null);
              }} disabled={updateProductTagsMutation.isPending} className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}>{updateProductTagsMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ATTRIBUTE MODAL */}
      {showAttributeModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-visible rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between rounded-t-2xl px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Attribute</h3>
              <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                className="rounded-lg p-2 transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Name *</label>
                  <input type="text" value={newAttributeData.name} onChange={e => setNewAttributeData(p => ({ ...p, name: e.target.value }))} required disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. Color, RAM, Size" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Code</label>
                  <input type="text" value={newAttributeData.code} onChange={e => setNewAttributeData(p => ({ ...p, code: e.target.value.toLowerCase() }))} disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. color, ram_size" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Data Type *</label>
                <select value={newAttributeData.data_type} onChange={e => setNewAttributeData(p => ({ ...p, data_type: e.target.value }))} disabled={createAttributeMutation.isPending}
                  className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="decimal">Decimal</option>
                </select>
              </div>
              {newAttributeData.data_type === "select" && (
                <div className="space-y-3 rounded-xl p-4" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Allowed Values</label>
                    <button type="button" onClick={handleAddAttributeValue} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      <Plus className="w-3.5 h-3.5" /> Add Value
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newAttributeData.values.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="text" placeholder="Label (e.g. Red)" value={val.label} onChange={e => handleAttributeValueChange(idx, "label", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <input type="text" placeholder="Value (e.g. #FF0000)" value={val.value} onChange={e => handleAttributeValueChange(idx, "value", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={() => handleRemoveAttributeValue(idx)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="button" onClick={handleAttributeSubmit} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {createAttributeMutation.isPending ? "Creating..." : "Create Attribute"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}