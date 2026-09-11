"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { shippingApi } from "@/apis/admin/shippingApi";
import { useShippingSocketSync } from "@/hooks/useShippingSocketSync.js";

/* ================= ICONS ================= */
const TruckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a2 2 0 11-1-1h-1m4 0a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);
const ZapIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

/* ================= EDIT MODAL ================= */
function EditShippingModal({ open, type, config, onClose, onSave, saving }) {
  const [form, setForm] = useState({ fee: 0, min_days: 0, max_days: 0 });

  useEffect(() => {
    if (open && config) {
      if (type === "standard") {
        setForm({
          fee: Number(config?.standard?.fee ?? 200),
          min_days: Number(config?.standard?.min_days ?? 2),
          max_days: Number(config?.standard?.max_days ?? 4),
        });
      } else if (type === "express") {
        setForm({
          fee: Number(config?.express?.fee ?? 500),
          min_days: Number(config?.express?.min_days ?? 1),
          max_days: Number(config?.express?.max_days ?? 2),
        });
      }
    }
  }, [open, config, type]);

  if (!open) return null;

  const isStandard = type === "standard";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={cardStyle}
      >
        {/* Modal Header */}
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border-color)" }}
        >
          <div>
            <h3
              className="text-[15px] font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Edit {isStandard ? "Standard" : "Express"} Delivery
            </h3>
            <p
              className="text-[12px] mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Update shipping rates and delivery time
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded-md transition disabled:opacity-50 hover:opacity-70"
            style={{
              color: "var(--text-muted)",
              backgroundColor: "var(--bg-tertiary)",
            }}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
          className="p-4 sm:p-6 space-y-4"
        >
          <div>
            <label
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Shipping Fee (Rs)
            </label>
            <input
              type="number"
              min="0"
              value={form.fee}
              onChange={(e) =>
                setForm({ ...form, fee: Number(e.target.value) })
              }
              disabled={saving}
              className="h-10 px-3 rounded-lg text-[13px] w-full outline-none disabled:opacity-50"
              style={inputStyle}
              placeholder="e.g. 200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Min Days
              </label>
              <input
                type="number"
                min="0"
                value={form.min_days}
                onChange={(e) =>
                  setForm({ ...form, min_days: Number(e.target.value) })
                }
                disabled={saving}
                className="h-10 px-3 rounded-lg text-[13px] w-full outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                className="block text-[12px] font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Max Days
              </label>
              <input
                type="number"
                min="0"
                value={form.max_days}
                onChange={(e) =>
                  setForm({ ...form, max_days: Number(e.target.value) })
                }
                disabled={saving}
                className="h-10 px-3 rounded-lg text-[13px] w-full outline-none disabled:opacity-50"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="flex flex-col sm:flex-row gap-3 pt-4"
            style={{ borderTop: "1px solid var(--border-color)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-medium transition hover:opacity-80 disabled:opacity-50"
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
              disabled={saving}
              className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--accent-text)",
              }}
            >
              {saving ? (
                <>
                  <Spinner className="w-4 h-4" /> Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= MAIN PAGE ================= */
export default function ShippingManagementPage() {
  useShippingSocketSync();
  const queryClient = useQueryClient();

  const [editType, setEditType] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["adminShippingConfig"],
    queryFn: shippingApi.getConfig,
    retry: false,
  });

  const configMutation = useMutation({
    mutationFn: (data) => shippingApi.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingConfig"] });
      toast.success("Shipping settings updated");
      setShowEditModal(false);
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.message || e?.message || "Update failed"
      ),
  });

  const handleEdit = (type) => {
    setEditType(type);
    setShowEditModal(true);
  };

  const handleSave = (formData) => {
    if (!config) return;

    const updatedConfig = {
      standard: editType === "standard" ? formData : config.standard,
      express: editType === "express" ? formData : config.express,
      free_shipping_over: config.free_shipping_over || 0,
    };

    configMutation.mutate(updatedConfig);
  };

  if (isLoading) {
    return (
      <div
        className="w-full min-h-screen flex items-center justify-center"
        style={{ color: "var(--text-primary)" }}
      >
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen"
      style={{ color: "var(--text-primary)" }}
    >
      <div className="w-full space-y-5">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Shipping Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Manage delivery methods and rates</p>
          </div>
        </div>

        {/* ===== Stat Cards — Standard & Express ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
          {/* Standard Details Card */}
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Standard</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Details</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("standard")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                <EditIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Shipping Fee</span>
                <span className="text-[18px] sm:text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>Rs. {config?.standard?.fee ?? 200}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Delivery Time</span>
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {config?.standard?.min_days ?? 2}-{config?.standard?.max_days ?? 4} days
                </span>
              </div>
            </div>
          </div>

          {/* Express Details Card */}
          <div className="rounded-lg p-3 sm:p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                  <ZapIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Express</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Details</p>
                </div>
              </div>
              <button
                onClick={() => handleEdit("express")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                <EditIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Shipping Fee</span>
                <span className="text-[18px] sm:text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>Rs. {config?.express?.fee ?? 500}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] sm:text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Delivery Time</span>
                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {config?.express?.min_days ?? 1}-{config?.express?.max_days ?? 2} days
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Shipping Methods — Desktop Table ===== */}
        <div className="hidden md:block rounded-lg overflow-hidden" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Method</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Shipping Fee</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Min Days</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>Max Days</th>
                  <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Delivery Window</th>
                  <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Standard Row */}
                <tr className="transition" style={{ borderBottom: "1px solid var(--border-color)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                        <TruckIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-[13px]">Standard Delivery</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Rs. {config?.standard?.fee ?? 200}</td>
                  <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{config?.standard?.min_days ?? 2}</td>
                  <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{config?.standard?.max_days ?? 4}</td>
                  <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{config?.standard?.min_days ?? 2}-{config?.standard?.max_days ?? 4} days</td>
                  <td className="px-4 py-2.5 whitespace-nowrap w-1">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleEdit("standard")}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Express Row */}
                <tr className="transition"
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                        <ZapIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-[13px]">Express Delivery</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Rs. {config?.express?.fee ?? 500}</td>
                  <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{config?.express?.min_days ?? 1}</td>
                  <td className="px-4 py-2.5 text-[13px] hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>{config?.express?.max_days ?? 2}</td>
                  <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{config?.express?.min_days ?? 1}-{config?.express?.max_days ?? 2} days</td>
                  <td className="px-4 py-2.5 whitespace-nowrap w-1">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleEdit("express")}
                        className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== Shipping Methods — Mobile Card List ===== */}
        <div className="md:hidden space-y-2.5">
          {/* Standard Mobile Card */}
          <div className="rounded-lg p-3 space-y-2.5 transition" style={cardStyle}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                <TruckIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate leading-tight">Standard Delivery</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{config?.standard?.min_days ?? 2}-{config?.standard?.max_days ?? 4} days</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>Rs. {config?.standard?.fee ?? 200}</span>
            </div>
            <div className="flex items-center justify-end pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button
                onClick={() => handleEdit("standard")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                <EditIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Express Mobile Card */}
          <div className="rounded-lg p-3 space-y-2.5 transition" style={cardStyle}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                <ZapIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate leading-tight">Express Delivery</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{config?.express?.min_days ?? 1}-{config?.express?.max_days ?? 2} days</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>Rs. {config?.express?.fee ?? 500}</span>
            </div>
            <div className="flex items-center justify-end pt-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button
                onClick={() => handleEdit("express")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
              >
                <EditIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Edit Modal ===== */}
      <EditShippingModal
        open={showEditModal}
        type={editType}
        config={config}
        onClose={() => {
          setShowEditModal(false);
          setEditType(null);
        }}
        onSave={handleSave}
        saving={configMutation.isPending}
      />
    </div>
  );
}
