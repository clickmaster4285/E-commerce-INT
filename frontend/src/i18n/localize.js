"use client";

// ==========================================
// DATABASE CONTENT LOCALIZATION
// ==========================================
// Brand/category/product/attribute ka content database se aata hai — is liye
// `translations.js` ke static keys usse cover nahi kar sakte. Supported locale
// translations backend par LibreTranslate se generate hoke MongoDB me persist
// rehti hain, to frontend ko sirf sahi field choose karna hai:
//
//   locale === "en"  → original English field (HAMESHA)
//   locale !== "en"   → translations.<field>.<locale>, warna English fallback
//
// English kabhi overwrite nahi hota — wo backend me source of truth hai, aur
// frontend bhi `en` par wahi original field padhta hai.
//
// Product ka `name` (model number) translate
// nahi hote — backend unhe `skipped` mark karta hai aur unka translation map
// khali rehta hai, is liye `nameOf()` unke liye automatically English wapas
// de deta hai. Category aur Attribute ke descriptive names translate hote hain.

import { useMemo } from "react";
import { useTranslation } from "./LanguageProvider";

/** Ek raw field + uska translation map → current locale ka text. */
export function localizedField(source, translations, locale) {
  if (locale === "en") return source;
  const translated = translations?.[locale];
  return (typeof translated === "string" && translated.trim()) || source;
}

/**
 * Hook form — pages me zyada use hota hai.
 *
 *   const { text, nameOf, descriptionOf, attributeNameOf, optionLabelOf } =
 *     useLocalized();
 *
 *   {nameOf(brand)}              // Brand: trademark → English
 *   {descriptionOf(brand)}       // Urdu translate hui (agar generated ho)
 */
export function useLocalized() {
  const { locale } = useTranslation();

  return useMemo(() => {
    /** Brand / Category / Product doc se localized name. */
    const nameOf = (doc) => localizedField(doc?.name, doc?.translations?.name, locale);

    /** Brand / Category / Product doc se localized description. */
    const descriptionOf = (doc) =>
      localizedField(doc?.description, doc?.translations?.description, locale);

    /**
     * Attribute se localized name + uske option labels.
     * Attribute ka `name` translate hota hai; har option ka `value` raw rehta
     * hai (variant matching usi par chalti hai) — sirf `label` translate hota.
     */
    const attributeOf = (attr) => ({
      ...attr,
      name: localizedField(attr?.name, attr?.translations?.name, locale),
      values: Array.isArray(attr?.values)
        ? attr.values.map((value) => ({
            ...value,
            label: localizedField(value?.label, value?.label_translations, locale),
          }))
        : attr?.values,
    });

    /** Single attribute-option object → localized label. */
    const optionLabelOf = (value) =>
      localizedField(value?.label, value?.label_translations, locale);

    /** Generic raw text helper (already-extracted strings ke liye). */
    const text = (source, translations) => localizedField(source, translations, locale);

    return { locale, text, nameOf, descriptionOf, attributeOf, optionLabelOf };
  }, [locale]);
}

/**
 * Non-hook variant — sirf `locale` chahiye to isko directly call karo.
 * @param {string} locale
 * @param {object} doc
 * @param {"name"|"description"} field
 */
export function localizedNameOf(doc, locale) {
  return localizedField(doc?.name, doc?.translations?.name, locale);
}

export function localizedDescriptionOf(doc, locale) {
  return localizedField(doc?.description, doc?.translations?.description, locale);
}
