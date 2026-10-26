"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Languages, Save } from "lucide-react";
import { toast } from "sonner";
import { storeApi } from "@/apis/admin/storeApi";
import { translateTerms } from "@/apis/admin/translationApi";
import { LOCALES } from "@/i18n/config";
import { useTranslation } from "@/i18n/LanguageProvider";

const DOCUMENTS = [
  { key: "quote", base: "quote_terms_conditions", translations: "quote_terms_translations" },
  { key: "invoice", base: "invoice_terms_conditions", translations: "invoice_terms_translations" },
];

const LABELS = {
  en: { title: "Terms & Conditions", subtitle: "Set default terms for new quotes and invoices.", defaults: "Default document terms", choose: "Choose a document and language, then edit its default terms.", quote: "Quote", invoice: "Invoice", language: "Language", translate: "Translate from English", saving: "Translating…", saved: "All changes saved", unsaved: "Unsaved changes", loading: "Loading saved terms", terms: "terms and conditions", placeholder: "Add the standard terms to include by default…", fallback: "No translation saved for this language yet. English is shown as a starting point.", save: "Save terms", savingTerms: "Saving…" },
  ur: { title: "شرائط و ضوابط", subtitle: "نئے کوٹیشن اور انوائس کے لیے پہلے سے طے شدہ شرائط مقرر کریں۔", defaults: "دستاویز کی طے شدہ شرائط", choose: "دستاویز اور زبان منتخب کریں، پھر شرائط میں ترمیم کریں۔", quote: "کوٹیشن", invoice: "انوائس", language: "زبان", translate: "انگریزی سے ترجمہ کریں", saving: "ترجمہ ہو رہا ہے…", saved: "تمام تبدیلیاں محفوظ ہیں", unsaved: "تبدیلیاں محفوظ نہیں", loading: "محفوظ شرائط لوڈ ہو رہی ہیں", terms: "شرائط و ضوابط", placeholder: "پہلے سے شامل کرنے کے لیے معیاری شرائط لکھیں…", fallback: "اس زبان کے لیے ترجمہ محفوظ نہیں۔ آغاز کے لیے انگریزی متن دکھایا جا رہا ہے۔", save: "شرائط محفوظ کریں", savingTerms: "محفوظ ہو رہا ہے…" },
  ar: { title: "الشروط والأحكام", subtitle: "حدد الشروط الافتراضية لعروض الأسعار والفواتير الجديدة.", defaults: "شروط المستند الافتراضية", choose: "اختر نوع المستند واللغة، ثم حرر الشروط الافتراضية.", quote: "عرض سعر", invoice: "فاتورة", language: "اللغة", translate: "ترجمة من الإنجليزية", saving: "جارٍ الترجمة…", saved: "تم حفظ جميع التغييرات", unsaved: "تغييرات غير محفوظة", loading: "جارٍ تحميل الشروط المحفوظة", terms: "الشروط والأحكام", placeholder: "أضف الشروط القياسية التي تريد تضمينها افتراضيًا…", fallback: "لا توجد ترجمة محفوظة لهذه اللغة. يظهر النص الإنجليزي للبدء.", save: "حفظ الشروط", savingTerms: "جارٍ الحفظ…" },
  es: { title: "Términos y condiciones", subtitle: "Define los términos predeterminados para presupuestos y facturas nuevos.", defaults: "Términos predeterminados del documento", choose: "Elige un documento y un idioma, y edita sus términos predeterminados.", quote: "Presupuesto", invoice: "Factura", language: "Idioma", translate: "Traducir del inglés", saving: "Traduciendo…", saved: "Todos los cambios guardados", unsaved: "Cambios sin guardar", loading: "Cargando términos guardados", terms: "términos y condiciones", placeholder: "Añade los términos estándar que quieras incluir…", fallback: "Aún no hay traducción guardada para este idioma. Se muestra el inglés como base.", save: "Guardar términos", savingTerms: "Guardando…" },
  fr: { title: "Conditions générales", subtitle: "Définissez les conditions par défaut des nouveaux devis et factures.", defaults: "Conditions par défaut du document", choose: "Choisissez un document et une langue, puis modifiez les conditions.", quote: "Devis", invoice: "Facture", language: "Langue", translate: "Traduire depuis l’anglais", saving: "Traduction…", saved: "Toutes les modifications sont enregistrées", unsaved: "Modifications non enregistrées", loading: "Chargement des conditions", terms: "conditions générales", placeholder: "Ajoutez les conditions standard à inclure par défaut…", fallback: "Aucune traduction enregistrée pour cette langue. Le texte anglais sert de base.", save: "Enregistrer", savingTerms: "Enregistrement…" },
  de: { title: "Allgemeine Geschäftsbedingungen", subtitle: "Legen Sie Standardbedingungen für neue Angebote und Rechnungen fest.", defaults: "Standardbedingungen für Dokumente", choose: "Wählen Sie Dokument und Sprache und bearbeiten Sie die Standardbedingungen.", quote: "Angebot", invoice: "Rechnung", language: "Sprache", translate: "Aus dem Englischen übersetzen", saving: "Übersetzung läuft…", saved: "Alle Änderungen gespeichert", unsaved: "Ungespeicherte Änderungen", loading: "Gespeicherte Bedingungen werden geladen", terms: "Bedingungen", placeholder: "Fügen Sie die standardmäßig geltenden Bedingungen hinzu…", fallback: "Für diese Sprache ist noch keine Übersetzung gespeichert. Englisch wird als Ausgangstext angezeigt.", save: "Bedingungen speichern", savingTerms: "Speichern…" },
  hi: { title: "नियम और शर्तें", subtitle: "नए कोटेशन और इनवॉइस के लिए डिफ़ॉल्ट शर्तें सेट करें।", defaults: "डिफ़ॉल्ट दस्तावेज़ शर्तें", choose: "दस्तावेज़ और भाषा चुनें, फिर डिफ़ॉल्ट शर्तें संपादित करें।", quote: "कोटेशन", invoice: "इनवॉइस", language: "भाषा", translate: "अंग्रेज़ी से अनुवाद करें", saving: "अनुवाद हो रहा है…", saved: "सभी बदलाव सेव हैं", unsaved: "बिना सेव किए बदलाव", loading: "सेव की गई शर्तें लोड हो रही हैं", terms: "नियम और शर्तें", placeholder: "डिफ़ॉल्ट रूप से शामिल करने के लिए मानक शर्तें जोड़ें…", fallback: "इस भाषा के लिए अनुवाद सेव नहीं है। शुरुआत के लिए अंग्रेज़ी दिखाई गई है।", save: "शर्तें सेव करें", savingTerms: "सेव हो रहा है…" },
  zh: { title: "条款和条件", subtitle: "设置新报价和发票的默认条款。", defaults: "默认单据条款", choose: "选择单据和语言，然后编辑默认条款。", quote: "报价", invoice: "发票", language: "语言", translate: "从英语翻译", saving: "正在翻译…", saved: "更改已全部保存", unsaved: "有未保存的更改", loading: "正在加载已保存条款", terms: "条款和条件", placeholder: "添加默认包含的标准条款…", fallback: "此语言尚无已保存的翻译。当前显示英语原文。", save: "保存条款", savingTerms: "正在保存…" },
  pt: { title: "Termos e condições", subtitle: "Defina os termos padrão para novos orçamentos e faturas.", defaults: "Termos padrão do documento", choose: "Escolha um documento e idioma e edite os termos padrão.", quote: "Orçamento", invoice: "Fatura", language: "Idioma", translate: "Traduzir do inglês", saving: "Traduzindo…", saved: "Todas as alterações foram salvas", unsaved: "Alterações não salvas", loading: "Carregando termos salvos", terms: "termos e condições", placeholder: "Adicione os termos padrão que devem ser incluídos…", fallback: "Ainda não há tradução salva para este idioma. O inglês aparece como base.", save: "Salvar termos", savingTerms: "Salvando…" },
  tr: { title: "Şartlar ve Koşullar", subtitle: "Yeni teklifler ve faturalar için varsayılan şartları belirleyin.", defaults: "Varsayılan belge şartları", choose: "Bir belge ve dil seçin, ardından varsayılan şartları düzenleyin.", quote: "Teklif", invoice: "Fatura", language: "Dil", translate: "İngilizceden çevir", saving: "Çevriliyor…", saved: "Tüm değişiklikler kaydedildi", unsaved: "Kaydedilmemiş değişiklikler", loading: "Kaydedilen şartlar yükleniyor", terms: "şartlar ve koşullar", placeholder: "Varsayılan olarak eklenecek standart şartları yazın…", fallback: "Bu dil için henüz çeviri kaydedilmedi. Başlangıç olarak İngilizce gösteriliyor.", save: "Şartları kaydet", savingTerms: "Kaydediliyor…" },
};

export default function TermsConditionsPage() {
  const queryClient = useQueryClient();
  const { locale: appLocale, dir } = useTranslation();
  const localeCopy = LABELS[appLocale] || LABELS.en;
  const [activeDocument, setActiveDocument] = useState("quote");
  const [activeLocale, setActiveLocale] = useState(appLocale || "en");
  const [values, setValues] = useState({ quote: {}, invoice: {} });
  const { data: store, isLoading, isError } = useQuery({ queryKey: ["admin-store-info"], queryFn: storeApi.get });

  useEffect(() => setActiveLocale(appLocale || "en"), [appLocale]);
  useEffect(() => {
    if (!store) return;
    setValues({
      quote: { en: store.quote_terms_conditions || "", ...(store.quote_terms_translations || {}) },
      invoice: { en: store.invoice_terms_conditions || "", ...(store.invoice_terms_translations || {}) },
    });
  }, [store]);

  const doc = DOCUMENTS.find((item) => item.key === activeDocument);
  const activeValue = values[activeDocument]?.[activeLocale] ?? "";
  const originalEnglish = values[activeDocument]?.en ?? "";
  const savedValue = activeLocale === "en"
    ? store?.[doc.base] || ""
    : store?.[doc.translations]?.[activeLocale] || "";
  const hasChanges = activeValue !== savedValue;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const nextTranslations = { ...(store?.[doc.translations] || {}), [activeLocale]: activeValue };
      const payload = { [doc.translations]: nextTranslations };
      if (activeLocale === "en") payload[doc.base] = activeValue;
      return storeApi.update(payload);
    },
    onSuccess: (updatedStore) => {
      queryClient.setQueryData(["admin-store-info"], updatedStore);
      queryClient.invalidateQueries({ queryKey: ["admin-store-info"] });
      toast.success(localeCopy.saved);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not save terms and conditions"),
  });

  const translateMutation = useMutation({
    mutationFn: () => translateTerms({ text: originalEnglish, locale: activeLocale }),
    onSuccess: (result) => {
      setValues((current) => ({ ...current, [activeDocument]: { ...current[activeDocument], [activeLocale]: result.text || "" } }));
      toast.success("Translation ready. Review it, then save.");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Could not translate terms. Check the translation service."),
  });

  const activeLabel = localeCopy[activeDocument];
  const needsFallback = activeLocale !== "en" && !values[activeDocument]?.[activeLocale] && Boolean(originalEnglish);
  const localeOptions = useMemo(() => LOCALES, []);

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
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>{localeCopy.language}</span>
              <select value={activeLocale} onChange={(event) => setActiveLocale(event.target.value)} className="h-10 min-w-40 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
                {localeOptions.map((item) => <option key={item.code} value={item.code}>{item.nativeLabel || item.label}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="document-terms" className="block text-xs font-semibold text-slate-700">{activeLabel} {localeCopy.terms}</label>
            {activeLocale !== "en" && <button type="button" onClick={() => translateMutation.mutate()} disabled={!originalEnglish || translateMutation.isPending || isLoading}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
              <Languages size={14} /> {translateMutation.isPending ? localeCopy.saving : localeCopy.translate}
            </button>}
          </div>
          {needsFallback && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{localeCopy.fallback}</p>}
          <textarea id="document-terms" dir={activeLocale === "ur" || activeLocale === "ar" ? "rtl" : "ltr"} value={activeValue}
            onChange={(event) => setValues((current) => ({ ...current, [activeDocument]: { ...current[activeDocument], [activeLocale]: event.target.value } }))}
            rows={12} maxLength={5000} placeholder={localeCopy.placeholder} disabled={isLoading || isError}
            className="min-h-64 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60" />
          <div className="flex justify-end text-[11px] tabular-nums text-slate-500">{activeValue.length} / 5000</div>

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
