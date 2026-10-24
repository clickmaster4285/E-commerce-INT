"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Save } from "lucide-react";
import { toast } from "sonner";
import { storeApi } from "@/apis/admin/storeApi";

const TABS = [
  { key: "quote_terms_conditions", label: "Quote" },
  { key: "invoice_terms_conditions", label: "Invoice" },
];

export default function TermsConditionsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [values, setValues] = useState({ quote_terms_conditions: "", invoice_terms_conditions: "" });
  const { data: store, isLoading, isError } = useQuery({
    queryKey: ["admin-store-info"],
    queryFn: storeApi.get,
  });

  useEffect(() => {
    if (!store) return;
    setValues({
      quote_terms_conditions: store.quote_terms_conditions || "",
      invoice_terms_conditions: store.invoice_terms_conditions || "",
    });
  }, [store]);

  const saveMutation = useMutation({
    mutationFn: () => storeApi.update({ [activeTab]: values[activeTab] }),
    onSuccess: (updatedStore) => {
      queryClient.setQueryData(["admin-store-info"], updatedStore);
      queryClient.invalidateQueries({ queryKey: ["admin-store-info"] });
      toast.success(`${activeTab === TABS[0].key ? "Quote" : "Invoice"} terms saved`);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not save terms and conditions"),
  });

  const activeLabel = TABS.find((tab) => tab.key === activeTab)?.label;
  const hasChanges = values[activeTab] !== (store?.[activeTab] || "");

  return (
    <main className="w-full space-y-4 pb-6 text-[var(--text-primary)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Terms &amp; Conditions</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Set the default terms shown on new quotes and invoices.
          </p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${hasChanges ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <Check size={13} /> {isLoading ? "Loading saved terms" : hasChanges ? "Unsaved changes" : "All changes saved"}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Default document terms</h2>
            <p className="mt-1 text-xs text-slate-500">Choose a document type, then write the terms to include by default.</p>
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Document type">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeTab === tab.key ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label htmlFor="document-terms" className="block text-xs font-semibold text-slate-700">
            {activeLabel} terms and conditions
          </label>
          <textarea
            id="document-terms"
            value={values[activeTab]}
            onChange={(event) => setValues((current) => ({ ...current, [activeTab]: event.target.value }))}
            rows={12}
            maxLength={5000}
            placeholder={`Add the standard terms that should appear on new ${activeLabel?.toLowerCase()}s…`}
            disabled={isLoading || isError}
            className="min-h-64 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {isLoading ? "Loading saved terms…" : isError ? "Could not load company settings." : "Leave blank if you do not want default terms on this document type."}
            </p>
            <span className="text-[11px] tabular-nums text-slate-500">{values[activeTab].length} / 5000</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Defaults are used for new documents. Existing documents stay unchanged.</p>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={isLoading || isError || saveMutation.isPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} /> {saveMutation.isPending ? "Saving…" : "Save terms"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
