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
export function localizedField(source, translations, locale, { allowLatinInTargetScript = false } = {}) {
  if (locale === "en") return source;
  const translated = translations?.[locale];
  if (typeof translated !== "string" || !translated.trim()) return source;
  // Raw fields stay strict by default; content helpers can explicitly allow
  // source brand/model names and validate the remaining Latin words.
  if (!allowLatinInTargetScript && TARGET_SCRIPTS[locale]?.test(translated) && /[A-Za-z]/.test(translated)) return source;
  return translated;
}

export function localizedStrictField(source, translations, locale) {
  return localizedField(source, translations, locale);
}

function hasUntranslatedLatinWords(source, translation, preserveFirstWord = false, allowedLatinWords = []) {
  const sourceWords = String(source ?? "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const translatedWords = String(translation ?? "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const firstSourceWord = sourceWords[0]?.toLocaleLowerCase();
  const allowed = new Set(allowedLatinWords.map((word) => String(word).toLocaleLowerCase()));

  return translatedWords.some((word, index) => {
    if (/\d/.test(word) || /^[A-Z]{2,6}$/.test(word) || /[a-z][A-Z]/.test(word)) return false;
    if (allowed.has(word.toLocaleLowerCase())) return false;
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

function localizedContentField(source, translations, locale, { preserveFirstWord = false, allowedLatinWords = [], rejectAnyLatin = false } = {}) {
  const translated = localizedField(source, translations, locale, { allowLatinInTargetScript: true });
  const targetScript = TARGET_SCRIPTS[locale];
  if (
    translated !== source &&
    targetScript?.test(translated) &&
    (rejectAnyLatin
      ? /[A-Za-z]/.test(translated)
      : hasUntranslatedLatinWords(source, translated, preserveFirstWord, allowedLatinWords))
  ) {
    return source;
  }
  return translated;
}

function valueAtPath(value, path) {
  return path.split(".").reduce((current, part) => current?.[part], value);
}

function cleanRepeatedProductTitle(text, productName) {
  let output = String(text || "");
  const title = String(productName || "").trim();
  if (!output || !title) return output;
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brand = title.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/)?.[0];
  output = output.replace(new RegExp(escapedTitle, "gi"), " ");
  if (brand) {
    const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`(?:by|کی طرف سے|بذریعہ)\\s*${escapedBrand}\\.?`, "gi"), " ");
  }
  output = output.replace(/(?:^|\s)(?:by|کی طرف سے|بذریعہ)(?=\s|[.,،]|$)/gi, " ");
  return output.replace(/[.،,:;\s]+/g, " ").trim();
}

/** Product names fall back as a whole if any English letters remain mixed in. */
export function localizedProductNameOf(product, locale) {
  const sourceName = product?.name ?? product?.product_name ?? product?.product_id?.name;
  const nameTranslations = product?.translations?.name ?? product?.product_id?.translations?.name;
  return localizedContentField(
    sourceName,
    nameTranslations,
    locale,
    { rejectAnyLatin: true }
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
    const nameOf = (doc) => {
      const sourceName = String(doc?.name ?? "").trim();
      // Generated seed names such as "Brand 0937" are identifiers. Keep the
      // source label even if an older DB row contains a bad machine translation.
      if (doc?.brand_code && /^Brand\s+\d+$/i.test(sourceName)) return doc.name;
      const brandWords = doc?.brand_code ? sourceName.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [] : [];
      return localizedContentField(doc?.name, doc?.translations?.name, locale, {
        rejectAnyLatin: Boolean(TARGET_SCRIPTS[locale]) && !doc?.brand_code,
        allowedLatinWords: brandWords,
      });
    };

    /** Product name with stale mixed-language translations rejected. */
    const productNameOf = (product) => localizedProductNameOf(product, locale);

    /** Replace a repeated English product title with its localized name. */
    const productDescriptionOf = (product, field = "description") => {
      const source = valueAtPath(product, field);
      const fieldTranslations = valueAtPath(product?.translations, field);
      let translated = localizedField(source, fieldTranslations, locale, { allowLatinInTargetScript: true });
      const sourceName = String(product?.name || "").trim();
      const hasCurrentTranslation =
        locale !== "en" &&
        typeof fieldTranslations?.[locale] === "string" &&
        fieldTranslations[locale].trim();
      if (hasCurrentTranslation) translated = cleanRepeatedProductTitle(translated, sourceName);
      const brandToken = sourceName.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/)?.[0];
      return localizedContentField(
        source,
        locale === "en" ? fieldTranslations : { [locale]: translated },
        locale,
        { allowedLatinWords: brandToken ? [brandToken] : [] }
      );
    };

    /** Brand / Category / other descriptions. */
    const descriptionOf = (doc) => {
      if (doc?.brand_id && doc?.name) return productDescriptionOf(doc);
      // Brand naam aksar description ke start par English me hi rehta hai
      // ("Brand 0963 ..."). Is ek leading brand token ki wajah se Urdu
      // description ko poora English fallback na karo.
      const brandWords = doc?.brand_code
        ? String(doc?.name || "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
        : [];
      return localizedContentField(doc?.description, doc?.translations?.description, locale, {
        preserveFirstWord: Boolean(doc?.brand_code),
        allowedLatinWords: brandWords,
      });
    };

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
      localizedContentField(source, translations, locale, { rejectAnyLatin: Boolean(TARGET_SCRIPTS[locale]) });

    /** Localize any supported database field, including nested banner buttons. */
    const fieldOf = (doc, field) =>
      localizedContentField(
        valueAtPath(doc, field),
        valueAtPath(doc?.translations, field),
        locale
      );

    return {
      locale,
      text,
      fieldOf,
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

const EMPLOYEE_DEPARTMENT_KEYS = {
  hr: "hr",
  manager: "manager",
  it: "it",
  finance: "finance",
  marketing: "marketing",
  customerservice: "customerService",
  operations: "operations",
  storemanager: "storeManager",
};

const EMPLOYEE_ACTIVITY_KEYS = {
  "employee management": "employeeManagement",
  "order management": "orderManagement",
  "product management": "productManagement",
  "customer management": "customerManagement",
  "coupon management": "couponManagement",
  authentication: "authentication",
  "store management": "storeManagement",
  "discount management": "discountManagement",
  "brand management": "brandManagement",
  "category management": "categoryManagement",
  "deals management": "dealsManagement",
  system: "system",
};

export function employeeDepartmentLabel(value, t) {
  const normalized = String(value || "").replace(/[^a-z]/gi, "").toLowerCase();
  const key = EMPLOYEE_DEPARTMENT_KEYS[normalized];
  return key ? t(`admin.employees.department.${key}`) : value;
}

export function employeeActivityLabel(value, t) {
  const key = EMPLOYEE_ACTIVITY_KEYS[String(value || "").trim().toLowerCase()];
  return key ? t(`admin.employees.activity.${key}`) : value;
}

export function employeeLocaleTag(locale) {
  return ({ ur: "ur-PK", hi: "hi-IN", zh: "zh-CN" })[locale] || locale || "en";
}
