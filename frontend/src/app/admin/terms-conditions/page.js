"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Save } from "lucide-react";
import { toast } from "sonner";
import { storeApi } from "@/apis/admin/storeApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import RichTextEditor from "@/components/admin/RichTextEditor";

const DOCUMENTS = [
  { key: "quote", base: "quote_terms_conditions" },
  { key: "invoice", base: "invoice_terms_conditions" },
];

const LABELS = {
  en: { title: "Terms & Conditions", subtitle: "Set default terms for new quotes and invoices.", defaults: "Default document terms", choose: "Choose a document, then edit its default terms.", quote: "Quote", invoice: "Invoice", saved: "All changes saved", unsaved: "Unsaved changes", loading: "Loading saved terms", terms: "terms and conditions", save: "Save terms", savingTerms: "Saving…" },
};

export default function TermsConditionsPage() {
  const queryClient = useQueryClient();
  const { locale: appLocale, dir } = useTranslation();
  const localeCopy = LABELS.en;
  const [activeDocument, setActiveDocument] = useState("quote");
  const [draftValues, setDraftValues] = useState(null);
  const { data: store, isLoading, isError } = useQuery({ queryKey: ["admin-store-info"], queryFn: storeApi.get });

  const storedValues = {
    quote: store?.quote_terms_conditions || "",
    invoice: store?.invoice_terms_conditions || "",
  };
  const values = draftValues || storedValues;
  const activeValue = values[activeDocument] ?? "";

  const doc = DOCUMENTS.find((item) => item.key === activeDocument);
  const savedValue = store?.[doc.base] || "";
  const hasChanges = activeValue !== savedValue;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { [doc.base]: activeValue };
      return storeApi.update(payload);
    },
    onSuccess: (updatedStore) => {
      queryClient.setQueryData(["admin-store-info"], updatedStore);
      queryClient.invalidateQueries({ queryKey: ["admin-store-info"] });
      setDraftValues(null);
      toast.success(localeCopy.saved);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not save terms and conditions"),
  });

  return (
    <main dir={dir} className="w-full space-y-4 pb-6 text-[var(--text-primary)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{localeCopy.title}</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">{localeCopy.subtitle}</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ${hasChanges ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <Check size={13} /> {isLoading ? localeCopy.loading : hasChanges ? localeCopy.unsaved : localeCopy.saved}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">{localeCopy.defaults}</h2>
          <p className="mt-1 text-xs text-slate-500">{localeCopy.choose}</p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Document type">
              {DOCUMENTS.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={activeDocument === item.key} onClick={() => setActiveDocument(item.key)}
                  className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${activeDocument === item.key ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"}`}>
                  {localeCopy[item.key]}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-700">{localeCopy[activeDocument]} {localeCopy.terms}</label>

          <RichTextEditor
            value={activeValue}
            onChange={(html) => setDraftValues((current) => {
              const next = current || storedValues;
              return { ...next, [activeDocument]: html };
            })}
            placeholder="Add the standard terms to include by default…"
            minHeight={320}
          />

          <div className="flex justify-end border-t border-slate-200 pt-4">
            <button type="button" onClick={() => saveMutation.mutate()} disabled={isLoading || isError || saveMutation.isPending || !hasChanges}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
              <Save size={15} /> {saveMutation.isPending ? localeCopy.savingTerms : localeCopy.save}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}


