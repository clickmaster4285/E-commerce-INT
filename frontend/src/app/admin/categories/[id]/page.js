"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { categoryApi } from "@/apis/admin/categoryApi"; // Adjust path as needed
import { useSocket } from "@/hooks/useSocket";
import { toast } from "sonner";

/* =========================================================
ICON COMPONENTS (Matching Brand Page)
========================================================= */
function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  check: "M5 13l4 4L19 7",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  chevron: "M9 5l7 7-7 7",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
};

/* =========================================================
HELPERS
========================================================= */
function ini(name) {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

/* =========================================================
UI COMPONENTS (Reused from Brand Page)
========================================================= */
function StatusPill({ active }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{
        backgroundColor: active ? "rgba(16,185,129,.10)" : "rgba(239,68,68,.10)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
      }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Button({ children, onClick, danger = false, primary = false, disabled = false, type = "button" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="h-9 px-3.5 rounded-lg text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: primary ? "var(--accent)" : danger ? "rgba(239,68,68,.06)" : "var(--bg-tertiary)",
        color: primary ? "var(--accent-text)" : danger ? "var(--danger)" : "var(--text-primary)",
        border: primary ? "none" : danger ? "1px solid rgba(239,68,68,.25)" : "1px solid var(--border-color)",
      }}>
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl ${className}`} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, action }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ label, value, green = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className={`text-[12px] text-right truncate max-w-[62%] ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "#34d399" : "var(--text-primary)" }}>
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

/* =========================================================
MAIN PAGE
========================================================= */
export default function CategoryDetailPage() {
  const { socket, isConnected } = useSocket();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const categoryId = params.id;
  const queryClient = useQueryClient();
  
  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/categories";

  const [tab, setTab] = useState("info");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  
  // Form State
  const [form, setForm] = useState({
    category_code: "", name: "", description: "", parent_category_id: "", sort_order: 0,
  });

  // Fetch All Categories for Parent Dropdown
  const { data: allCategories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoryApi.getAll(),
  });

  // Fetch Specific Category Details
  const { data: category, isLoading: loading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => categoryApi.getById(categoryId),
    enabled: !!categoryId,
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => categoryApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["category", categoryId]);
      queryClient.invalidateQueries(["categories"]);
      setShowEdit(false);
      toast.success("Category updated successfully");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to update category");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => categoryApi.delete(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries(["categories"]);
      toast.success("Category deleted successfully");
      router.push(backPath);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to delete category");
    }
  });

  // Handlers
  function openEdit() {
    if (!category) return;
    setForm({
      category_code: category.category_code || "",
      name: category.name || "",
      description: category.description || "",
      parent_category_id: category.parent_category_id?._id || category.parent_category_id || "",
      sort_order: category.sort_order || 0,
    });
    setShowEdit(true);
  }

  function submitEdit(e) {
    e.preventDefault();
    const payload = {
      category_code: form.category_code,
      name: form.name,
      description: form.description,
      parent_category_id: form.parent_category_id || null,
      sort_order: Number(form.sort_order),
    };
    updateMutation.mutate({ id: categoryId, data: payload });
  }

  // Derived Data
  const hasUpdates = Boolean(category?.created_at && category?.updated_at && category.created_at !== category.updated_at);
  
  // Find Parent Name for Display
  const parentName = useMemo(() => {
    if (!category) return "";
    const parentId = category.parent_category_id?._id || category.parent_category_id;
    if (!parentId) return "None";
    const found = allCategories.find(c => c._id === parentId);
    return found ? found.name : "Unknown Parent";
  }, [category, allCategories]);

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Spin className="w-5 h-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>Loading category details...</span>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center">
        <Card className="p-8 text-center max-w-sm">
          <h2 className="text-lg font-semibold mb-2">Category Not Found</h2>
          <Button primary onClick={() => router.push(backPath)}>Back to Categories</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full pb-8" style={{ color: "var(--text-primary)" }}>
      <div className="space-y-6">
        
        {/* HEADER */}
        <div>
          <div className="mb-4 flex items-center gap-2 text-[12px]">
            <button onClick={() => router.push(backPath)} className="font-medium transition hover:text-[var(--accent)]" style={{ color: "var(--text-muted)" }}>Categories</button>
            <Ico d={D.chevron} className="h-3 w-3" style={{ color: "var(--text-muted)" }} />
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>Category Details</span>
          </div>

          <div className="rounded-2xl p-5 sm:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {/* Icon Placeholder since categories don't always have logos */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)", boxShadow: "0 0 0 4px var(--accent-soft)" }}>
                <Ico d={D.layers} className="h-7 w-7" style={{ color: "var(--accent)" }} />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{category.name}</h1>
                  <StatusPill active={true} /> 
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  <span className="font-mono">{category.category_code || "—"}</span>
                  {parentName !== "None" && <><span>•</span><span>{parentName}</span></>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => router.push(backPath)}><Ico d={D.back} className="w-3.5 h-3.5" /> Back</Button>
              <Button primary onClick={openEdit}><Ico d={D.edit} className="w-3.5 h-3.5" /> Edit Category</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => setShowDelete(true)}><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete</Button>
            </div>
          </div>
          </div>
        </div>

        {/* SUMMARY STRIP */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.check} className="h-3.5 w-3.5" /> Status</div>
              <StatusPill active={true} />
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.box} className="h-3.5 w-3.5" /> Sort Order</div>
              <p className="text-2xl font-bold tracking-tight">{category.sort_order || 0}</p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Display position</p>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.clock} className="h-3.5 w-3.5" /> Created</div>
              <p className="text-sm font-semibold">{formatDate(category.created_at)}</p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>Original record</p>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-muted)" }}><Ico d={D.pencil} className="h-3.5 w-3.5" /> Last update</div>
              <p className="truncate text-sm font-semibold">{hasUpdates ? formatDate(category.updated_at) : "Never"}</p>
              <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>{hasUpdates ? "Recently edited" : "No changes yet"}</p>
            </Card>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 overflow-x-auto border-b" style={{ borderColor: "var(--border-color)" }}>
          {[
            { id: "info", label: "Overview" },
            { id: "activity", label: "Activity", badge: hasUpdates ? 2 : 1 },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button key={item.id} type="button" onClick={() => setTab(item.id)}
                className="relative flex items-center gap-2 py-3 text-[12px] font-medium whitespace-nowrap"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                {item.label}
                {item.badge !== undefined && (
                  <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ backgroundColor: active ? "var(--accent-soft)" : "var(--bg-tertiary)", color: active ? "var(--accent)" : "var(--text-muted)" }}>
                    {item.badge}
                  </span>
                )}
                {active && <span className="absolute bottom-[-1px] left-0 right-0 h-[2px]" style={{ backgroundColor: "var(--accent)" }} />}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "info" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Category Information */}
              <Card>
                <CardHeader title="Category Information" icon={<Ico d={D.tag} className="w-4 h-4" />} />
                <div className="px-4">
                  <InfoRow label="Category Name" value={category.name} />
                  <InfoRow label="Category Code" value={category.category_code} mono />
                  <InfoRow label="Parent Category" value={parentName} green={parentName !== "None"} />
                  <InfoRow label="Sort Order" value={category.sort_order || 0} />
                  
                  {/* Detailed Creation Info */}
                  <div className="py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created By</span>
                      <span className="text-[12px] font-medium">{category.createdby?.name || "System"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Created At</span>
                      <span className="text-[12px]">{formatDateTime(category.created_at)}</span>
                    </div>
                  </div>

                  {/* Detailed Update Info */}
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated By</span>
                      <span className="text-[12px] font-medium">{category.updatedby?.name || (hasUpdates ? "Unknown" : "—")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Last Updated At</span>
                      <span className="text-[12px]">{hasUpdates ? formatDateTime(category.updated_at) : "Never"}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Description */}
              <Card>
                <CardHeader title="Description" icon={<Ico d={D.activity} className="w-4 h-4" />} />
                <div className="p-5 min-h-[250px] flex flex-col">
                  {category.description ? (
                    <p className="text-[12px] leading-6 whitespace-pre-wrap break-words" style={{ color: "var(--text-secondary)" }}>{category.description}</p>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                      <Ico d={D.activity} className="w-7 h-7 mb-3" sw={1.4} />
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>No description provided.</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Metadata / Hierarchy Info */}
              <Card>
                <CardHeader title="Hierarchy & Meta" icon={<Ico d={D.layers} className="w-4 h-4" />} />
                <div className="p-4 space-y-4">
                   <div>
                      <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Current Level</p>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                          {ini(category.name)}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium">{category.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>ID: {category._id.substring(0,8)}...</p>
                        </div>
                      </div>
                   </div>
                   
                   {parentName !== "None" && (
                     <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                        <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Parent Category</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center text-xs font-bold">
                            {ini(parentName)}
                          </div>
                          <div>
                            <p className="text-[12px] font-medium">{parentName}</p>
                            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Direct Parent</p>
                          </div>
                        </div>
                     </div>
                   )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB */}
        {tab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <Card>
              <CardHeader title="Activity Timeline" icon={<Ico d={D.activity} className="w-4 h-4" />} />
              <div className="p-5 space-y-6">
                
                {/* Created Event */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,.10)", color: "var(--accent)" }}>
                      <Ico d={D.plus} className="w-4 h-4" />
                    </div>
                    {hasUpdates && <div className="w-px flex-1 mt-1" style={{ backgroundColor: "var(--border-color)" }} />}
                  </div>
                  <div className="pb-2">
                    <p className="text-[13px] font-medium">Category Created</p>
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      Created by <span className="font-semibold text-[var(--text-primary)]">{category.createdby?.name || "System"}</span> 
                      {category.createdby?.email && <span className="block text-[10px] opacity-70">{category.createdby.email}</span>}
                    </p>
                    <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(category.created_at)}
                    </p>
                  </div>
                </div>

                {/* Updated Event */}
                {hasUpdates ? (
                  <div className="flex gap-4">
                    <div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,.10)", color: "#60a5fa" }}>
                        <Ico d={D.pencil} className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium">Category Updated</p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                        Updated by <span className="font-semibold text-[var(--text-primary)]">{category.updatedby?.name || "Unknown User"}</span>
                        {category.updatedby?.email && <span className="block text-[10px] opacity-70">{category.updatedby.email}</span>}
                      </p>
                      <p className="text-[10px] mt-2 font-mono" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(category.updated_at)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="ml-11 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>No updates recorded yet.</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Activity Info Side Panel */}
            <Card>
              <CardHeader title="User Details" icon={<Ico d={D.user} className="w-4 h-4" />} />
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Creator</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                      {ini(category.createdby?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{category.createdby?.name || "Unknown"}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{category.createdby?.email || "—"}</p>
                    </div>
                  </div>
                </div>
                
                {hasUpdates && (
                  <div className="pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Last Editor</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center text-xs font-bold">
                        {ini(category.updatedby?.name)}
                      </div>
                      <div>
                        <p className="text-[12px] font-medium">{category.updatedby?.name || "Unknown"}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{category.updatedby?.email || "—"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* EDIT MODAL */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl overflow-visible" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-[14px] font-semibold">Edit Category</h2>
                <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>Update category information</p>
              </div>
              <button type="button" onClick={() => setShowEdit(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                <Ico d={D.close} className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Category Code</label>
                  <input value={form.category_code} disabled readOnly className="w-full h-9 px-3 rounded-lg text-[12px] outline-none opacity-60" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Category Name *</label>
                  <input value={form.name} required disabled={updateMutation.isPending} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-lg text-[12px] outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Parent Category</label>
                <select 
                  value={form.parent_category_id} 
                  disabled={updateMutation.isPending} 
                  onChange={(e) => setForm({ ...form, parent_category_id: e.target.value })} 
                  className="w-full h-9 px-3 rounded-lg text-[12px] outline-none" 
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                >
                  <option value="">None (Root Category)</option>
                  {allCategories.filter(c => c._id !== categoryId).map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                 <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Sort Order</label>
                 <input type="number" value={form.sort_order} disabled={updateMutation.isPending} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="w-full h-9 px-3 rounded-lg text-[12px] outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>

              <div>
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>Description</label>
                <textarea rows={4} value={form.description} disabled={updateMutation.isPending} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2.5 rounded-lg text-[12px] outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <Button disabled={updateMutation.isPending} onClick={() => setShowEdit(false)}>Cancel</Button>
                <Button primary type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Saving...</> : <><Ico d={D.check} className="w-3.5 h-3.5" /> Save Changes</>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 20px 60px rgba(0,0,0,.4)" }}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,.10)", color: "#f87171" }}>
                <Ico d={D.warn} className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Delete Category?</h3>
                <p className="text-[11px] mt-1 leading-5" style={{ color: "var(--text-muted)" }}>
                  Are you sure you want to delete <span style={{ color: "var(--text-primary)" }}>{category.name}</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button danger disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> Deleting...</> : <><Ico d={D.trash} className="w-3.5 h-3.5" /> Delete Category</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}