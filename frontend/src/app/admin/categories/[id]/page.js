"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { categoryApi } from "@/apis/categoryApi";
import { toast } from "sonner";
import { useSocket } from "@/hooks/useSocket";

import {
  ArrowLeft,
  FolderOpen,
  Hash,
  FileText,
  Activity,
  CalendarDays,
  User,
  Clock,
  Package,
  Database,
  Layers3,
  Pencil,
  X,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";

/* ================= Helpers ================= */
function fd(d) { 
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"; 
}

function fdt(d) { 
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"; 
}

function tago(d) { 
  if (!d) return ""; 
  var m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); 
  if (m < 1) return "now"; 
  if (m < 60) return m + "m ago"; 
  var h = Math.floor(m / 60); 
  if (h < 24) return h + "h ago"; 
  var dy = Math.floor(h / 24); 
  return dy < 30 ? dy + "d ago" : fd(d); 
}

function ini(n) { 
  return n ? n.split(" ").map(function(w) { return w[0] }).join("").substring(0, 2).toUpperCase() : "??"; 
}

/* ================= Components ================= */
function InfoRow({ label, value, mono, green }) {
  return (
    <div className="flex justify-between items-center py-2.5">
      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span 
        className={`text-[12px] text-right truncate max-w-[55%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function SecTitle({ children }) {
  return (
    <div 
      className="text-[11px] font-semibold uppercase tracking-wide mb-3 pb-2.5"
      style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}
    >
      {children}
    </div>
  );
}

function InnerCard({ children }) {
  return (
    <div 
      className="rounded-xl p-4"
      style={{
        backgroundColor: "transparent",
        border: "1px solid var(--border-color)",
        borderRadius: "12px"
      }}
    >
      {children}
    </div>
  );
}

function SBtn({ onClick, disabled, danger, primary, children, type = "button" }) {
  const [hov, setHov] = useState(false);
  let bg, cl;
  
  if (danger) {
    bg = hov ? "rgba(239,68,68,0.1)" : "transparent";
    cl = "#f87171";
  } else if (primary) {
    bg = "var(--accent)";
    cl = "var(--accent-text)";
  } else {
    bg = hov ? "rgba(255,255,255,0.06)" : "transparent";
    cl = "var(--text-secondary)";
  }
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="h-7 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1 transition-all duration-150 disabled:opacity-40 cursor-pointer"
      style={{ backgroundColor: bg, color: cl, border: "none" }}
    >
      {children}
    </button>
  );
}

function Person({ user, label, date, color = "#34d399", fallback = "Unknown" }) {
  const bg = color === "#60a5fa" ? "rgba(96,165,250,0.1)" : "rgba(52,211,153,0.1)";
  
  if (!user) {
    return (
      <div className="py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color }}>{label}</p>
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fallback}</p>
      </div>
    );
  }
  
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color }}>{label}</p>
        {date && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            {fd(date)} · {tago(date)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        <div 
          className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
          style={{ backgroundColor: bg, color }}
        >
          {ini(user.name)}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
            {user.name || "Unknown"}
          </p>
          {user.email && (
            <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
              {user.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TItem({ icon, title, sub, user, date, color = "#34d399", last }) {
  const bg = color === "#60a5fa" ? "rgba(96,165,250,0.1)" : "rgba(52,211,153,0.1)";
  
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: bg, color }}
        >
          {icon}
        </div>
        {!last && (
          <div className="w-px flex-1 my-1" style={{ backgroundColor: "var(--border-color)" }} />
        )}
      </div>
      <div className={`flex-1 min-w-0 ${last ? "" : "pb-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{title}</p>
            {sub && <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{fd(date)}</p>
            <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{tago(date)}</p>
          </div>
        </div>
        {user && (
          <div 
            className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-lg"
            style={{ border: "1px solid var(--border-color)", borderRadius: "8px" }}
          >
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0"
              style={{ backgroundColor: bg, color }}
            >
              {ini(user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {user.name || "?"}
              </p>
              {user.email && (
                <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>
                  {user.email}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryDetailPage({ params }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState("overview");
  const { socket, isConnected } = useSocket();

  const [showModal, setShowModal] = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [formData, setFormData] = useState({
    category_code: "",
    name: "",
    description: "",
  });

  const {
    data: category,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["category", id],
    queryFn: () => categoryApi.getById(id),
    enabled: !!id,
  });

  // ✅ SOCKET: Real-time Sync for Current Category
  useEffect(() => {
    if (!socket || !isConnected || !id) return;

    const handleCategoryUpdated = (updatedCategory) => {
      if (updatedCategory._id === id) {
        queryClient.setQueryData(["category", id], updatedCategory);
        toast.info("Category updated in real-time");
      }
    };

    const handleCategoryDeleted = (data) => {
      if (data.id === id) {
        toast.warning("This category was deleted by another user");
        router.push("/admin/categories");
      }
    };

    socket.on("categoryUpdated", handleCategoryUpdated);
    socket.on("categoryDeleted", handleCategoryDeleted);

    return () => {
      socket.off("categoryUpdated", handleCategoryUpdated);
      socket.off("categoryDeleted", handleCategoryDeleted);
    };
  }, [socket, isConnected, id, queryClient, router]);

  const categoryMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category", id] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated successfully");
      setShowModal(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Category update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted successfully");
      router.push("/admin/categories");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Category deletion failed");
    },
  });

  const handleEdit = () => {
    if (!category) return;
    setFormData({
      category_code: category.category_code || "",
      name: category.name || "",
      description: category.description || "",
    });
    setShowModal(true);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    categoryMutation.mutate({
      id: category._id,
      data: {
        category_code: formData.category_code,
        name: formData.name.trim(),
        description: formData.description.trim(),
      },
    });
  };

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center py-24" style={{ color: "var(--text-primary)" }}>
        <div 
          className="rounded-xl py-14 px-20 flex items-center gap-2"
          style={{ backgroundColor: "var(--bg-card)", borderRadius: "12px" }}
        >
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading...</span>
        </div>
      </div>
    );
  }

  if (isError || !category) {
    return (
      <div className="w-full flex items-center justify-center py-24" style={{ color: "var(--text-primary)" }}>
        <div 
          className="rounded-xl py-14 px-8 flex flex-col items-center gap-3 text-center"
          style={{ backgroundColor: "var(--bg-card)", borderRadius: "12px" }}
        >
          <AlertCircle className="w-8 h-8 opacity-60" style={{ color: "var(--text-muted)" }} />
          <p className="text-base font-semibold">Category Not Found</p>
          <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>This category does not exist.</p>
          <SBtn primary onClick={() => router.push("/admin/categories")}>Back to Categories</SBtn>
        </div>
      </div>
    );
  }

  const wasUp = !!(category.created_at && category.updated_at && category.created_at !== category.updated_at);
  const cs = { backgroundColor: "var(--bg-card)", borderRadius: "12px" };
  const is_ = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: "8px" };

  const tabList = [
    { id: "overview", label: "Overview" },
    { id: "activity", label: "Activity", badge: wasUp ? "2" : "1" }
  ];

  return (
    <div className="w-full" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4">
        
        {/* HEADER - Breadcrumb Style like Brand Page */}
        <div className="px-1">
          <div className="flex items-center gap-1.5 mb-3">
            <button
              onClick={() => router.push("/admin/categories")}
              className="text-[12px] font-medium transition hover:opacity-70"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Categories
            </button>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-[12px] font-medium" style={{ color: "var(--text-primary)" }}>{category.name}</span>
          </div>

          <div className="flex items-start gap-4">
            <div 
              className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
            >
              <FolderOpen className="w-7 h-7" style={{ color: "#34d399" }} />
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-[18px] font-semibold truncate leading-tight">{category.name}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                  style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
                >
                  {category.category_code || "—"}
                </span>
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Created {fd(category.created_at)}
                </span>
                {wasUp && (
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    · Updated {tago(category.updated_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 pt-1">
              <SBtn onClick={handleEdit}>
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </SBtn>
              <SBtn danger onClick={() => setShowDel(true)} disabled={deleteMutation.isPending}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </SBtn>
            </div>
          </div>
        </div>

        {/* TABS + CONTENT - Same Style as Brand Page */}
        <div className="rounded-xl overflow-hidden" style={cs}>
          <div 
            className="px-5 flex items-center gap-5"
            style={{ borderBottom: "1px solid var(--border-color)" }}
          >
            {tabList.map((tb) => {
              const active = activeTab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setActiveTab(tb.id)}
                  className="flex items-center gap-1.5 text-[12px] font-medium transition-colors duration-150"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "10px 0 9px 0",
                    color: active ? "#34d399" : "var(--text-muted)",
                    borderBottom: active ? "2px solid #34d399" : "2px solid transparent",
                    marginBottom: "-1px"
                  }}
                >
                  {tb.label}
                  {tb.badge && (
                    <span 
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none"
                      style={{ 
                        backgroundColor: active ? "rgba(16,185,129,0.15)" : "var(--bg-tertiary)", 
                        color: active ? "#34d399" : "var(--text-muted)" 
                      }}
                    >
                      {tb.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5">
            
            {/* TAB 1: OVERVIEW - 3 Column Layout like Brand Page */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <InnerCard>
                  <SecTitle>Details</SecTitle>
                  <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    <InfoRow label="Code" value={category.category_code} mono />
                    <InfoRow label="Name" value={category.name} />
                    <InfoRow label="Sort Order" value={category.sort_order || 0} />
                    <InfoRow label="Status" value="Active" green />
                    <InfoRow label="Created" value={fdt(category.created_at)} />
                    <InfoRow label="Updated" value={wasUp ? fdt(category.updated_at) : "Never"} />
                  </div>
                </InnerCard>

                <InnerCard>
                  <SecTitle>Description</SecTitle>
                  <p 
                    className="text-[12px] leading-relaxed whitespace-pre-wrap break-words"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {category.description || "No description provided."}
                  </p>
                </InnerCard>

                <InnerCard>
                  <SecTitle>Metadata</SecTitle>
                  <div className="space-y-3">
                    <Person 
                      user={category.createdby} 
                      label="Created By" 
                      date={category.created_at} 
                      color="#34d399" 
                      fallback="Unknown user" 
                    />
                    {wasUp && category.updatedby ? (
                      <Person 
                        user={category.updatedby} 
                        label="Updated By" 
                        date={category.updated_at} 
                        color="#60a5fa" 
                      />
                    ) : (
                      <Person 
                        user={null} 
                        label="Updated By" 
                        color="#60a5fa" 
                        fallback="No updates yet" 
                      />
                    )}
                  </div>
                </InnerCard>
              </div>
            )}

            {/* TAB 2: ACTIVITY - Timeline Style like Brand Page */}
            {activeTab === "activity" && (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
                <InnerCard>
                  <SecTitle>Timeline</SecTitle>
                  <TItem
                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    title="Category Created"
                    sub="Added to the system"
                    user={category.createdby}
                    date={category.created_at}
                    color="#34d399"
                    last={!wasUp}
                  />
                  {wasUp && (
                    <TItem
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      title="Category Updated"
                      sub="Details were modified"
                      user={category.updatedby}
                      date={category.updated_at}
                      color="#60a5fa"
                      last={true}
                    />
                  )}
                  {!wasUp && (
                    <div 
                      className="mt-3 px-3 py-2.5 rounded-lg flex items-center gap-2"
                      style={{ border: "1px dashed var(--border-color)", borderRadius: "8px" }}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        No updates yet. Changes will appear here.
                      </span>
                    </div>
                  )}
                </InnerCard>

                <InnerCard>
                  <SecTitle>People</SecTitle>
                  <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                    <Person 
                      user={category.createdby} 
                      label="Created By" 
                      date={category.created_at} 
                      color="#34d399" 
                      fallback="Unknown user" 
                    />
                    {wasUp && category.updatedby ? (
                      <Person 
                        user={category.updatedby} 
                        label="Updated By" 
                        date={category.updated_at} 
                        color="#60a5fa" 
                      />
                    ) : (
                      <Person 
                        user={null} 
                        label="Updated By" 
                        color="#60a5fa" 
                        fallback="No updates yet" 
                      />
                    )}
                  </div>
                </InnerCard>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT MODAL - Compact like Brand Page */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="w-full max-w-md rounded-xl overflow-hidden"
            style={{ ...cs, border: "1px solid var(--border-color)" }}
          >
            <div 
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border-color)" }}
            >
              <span className="text-[13px] font-medium">Edit Category</span>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-0.5 rounded hover:opacity-70"
                style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Code (Locked)</label>
                  <input
                    type="text"
                    value={formData.category_code}
                    readOnly
                    disabled
                    className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none opacity-60 cursor-not-allowed"
                    style={{ ...is_, backgroundColor: "rgba(0,0,0,0.2)" }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={categoryMutation.isPending}
                    className="h-8 px-2.5 rounded-lg text-[12px] w-full outline-none disabled:opacity-40"
                    style={is_}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  disabled={categoryMutation.isPending}
                  className="px-2.5 py-2 rounded-lg text-[12px] w-full outline-none disabled:opacity-40 resize-none"
                  style={is_}
                />
              </div>

              <div className="flex gap-2 pt-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <SBtn onClick={() => setShowModal(false)} disabled={categoryMutation.isPending}>Cancel</SBtn>
                <button
                  type="submit"
                  disabled={categoryMutation.isPending}
                  className="flex-1 h-8 rounded-lg text-[12px] font-medium transition disabled:opacity-40 hover:opacity-85"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)", border: "none", cursor: "pointer", borderRadius: "8px" }}
                >
                  {categoryMutation.isPending ? "Saving..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL - Compact like Brand Page */}
      {showDel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <style>{`@keyframes mi{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
          <div 
            className="w-full max-w-xs rounded-xl p-4"
            style={{ ...cs, border: "1px solid var(--border-color)", animation: "mi .15s ease-out" }}
          >
            <div className="flex items-start gap-2.5">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(239,68,68,0.08)" }}
              >
                <AlertCircle className="w-4 h-4" style={{ color: "#f87171" }} />
              </div>
              <div>
                <p className="text-[13px] font-medium">Delete {category.name}?</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3.5">
              <SBtn onClick={() => setShowDel(false)} disabled={deleteMutation.isPending}>Cancel</SBtn>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 h-8 rounded-lg text-[12px] font-medium text-white transition disabled:opacity-40 hover:opacity-85 flex items-center justify-center gap-1"
                style={{ backgroundColor: "var(--danger)", border: "none", cursor: "pointer", borderRadius: "8px" }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}