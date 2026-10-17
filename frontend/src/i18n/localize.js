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
// Product ke descriptive names translate ho sakte hain; model/code names
// backend par `skipped` rehte hain. `nameOf()` har case me source ko safe rakhta hai.

import { useMemo } from "react";
import { useTranslation } from "./LanguageProvider";

/** Ek raw field + uska translation map → current locale ka text. */
export function localizedField(source, translations, locale) {
  if (locale === "en") return source;
  const translated = translations?.[locale];
  return (typeof translated === "string" && translated.trim()) || source;
}

function hasUntranslatedLatinWords(source, translation, preserveFirstWord = false) {
  const sourceWords = String(source ?? "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const translatedWords = String(translation ?? "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const firstSourceWord = sourceWords[0]?.toLocaleLowerCase();

  return translatedWords.some((word, index) => {
    if (/\d/.test(word) || /^[A-Z]{2,6}$/.test(word) || /[a-z][A-Z]/.test(word)) return false;
    if (preserveFirstWord && index === 0 && word.toLocaleLowerCase() === firstSourceWord) return false;
    return true;
  });
}

const TARGET_SCRIPTS = {
  ar: /\p{Script=Arabic}/u,
  ur: /\p{Script=Arabic}/u,
  hi: /\p{Script=Devanagari}/u,
  zh: /\p{Script=Han}/u,
};

function localizedContentField(source, translations, locale, { preserveFirstWord = false } = {}) {
  const translated = localizedField(source, translations, locale);
  const targetScript = TARGET_SCRIPTS[locale];
  if (
    translated !== source &&
    targetScript?.test(translated) &&
    hasUntranslatedLatinWords(source, translated, preserveFirstWord)
  ) {
    return source;
  }
  return translated;
}

/** Product names may retain the first brand token and technical identifiers. */
export function localizedProductNameOf(product, locale) {
  return localizedContentField(
    product?.name,
    product?.translations?.name,
    locale,
    { preserveFirstWord: true }
  );
}

/**
 * Hook form — pages me zyada use hota hai.
 *
 *   const { text, nameOf, descriptionOf, attributeNameOf, optionLabelOf } =
 *     useLocalized();
 *
 *   {nameOf(brand)}              // Brand: localized display name
 *   {descriptionOf(brand)}       // Urdu translate hui (agar generated ho)
 */
export function useLocalized() {
  const { locale } = useTranslation();

  return useMemo(() => {
    /** Brand / Category / Product doc se localized name. */
    const nameOf = (doc) =>
      localizedContentField(doc?.name, doc?.translations?.name, locale);

    /** Product name with stale mixed-language translations rejected. */
    const productNameOf = (product) => localizedProductNameOf(product, locale);

    /** Product descriptions with mixed target-script translations rejected. */
    const productDescriptionOf = (product) =>
      localizedContentField(
        product?.description,
        product?.translations?.description,
        locale
      );

    /** Brand / Category / other descriptions. */
    const descriptionOf = (doc) =>
      localizedContentField(doc?.description, doc?.translations?.description, locale);

    /** Cached review translations; originals remain the editable source text. */
    const reviewTextOf = (review, field) => {
      const parts = field.split(".");
      const source = parts.reduce((value, part) => value?.[part], review);
      const translations = parts.reduce(
        (value, part) => value?.[part],
        review?.translations
      );
      return localizedContentField(source, translations, locale);
    };

    /**
     * Attribute se localized name + uske option labels.
     * Attribute ka `name` translate hota hai; har option ka `value` raw rehta
     * hai (variant matching usi par chalti hai) — sirf `label` translate hota.
     */
    const attributeOf = (attr) => ({
      ...attr,
      name: localizedField(attr?.name, attr?.translations?.name, locale),
      description: localizedField(
        attr?.description,
        attr?.translations?.description,
        locale
      ),
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
    const text = (source, translations) =>
      localizedContentField(source, translations, locale);

    return {
      locale,
      text,
      nameOf,
      productNameOf,
      productDescriptionOf,
      descriptionOf,
      contentOf: text,
      reviewTextOf,
      attributeOf,
      optionLabelOf,
    };
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
