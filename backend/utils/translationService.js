// ==========================================
// TRANSLATION SERVICE
// ==========================================
// English content → auto-translate → MongoDB me persist.
//
// DESIGN DECISIONS (why it works like this):
//
// 1. ENGLISH HAMESHA SOURCE OF TRUTH REHTA HAI
//    `name` / `description` par koi write nahi hota. Translation ek alag
//    `translations.<field>.<locale>` map me chala jaata hai. Is liye English
//    kabhi overwrite/delete nahi hota — locale English par frontend wahi
//    original field padhta hai.
//
// 2. STALENESS HASH SE PATA CHALTA HAI
//    Har translated field ke saath `translation_source.<field>` me us English
//    text ka chhota md5 hash store hota hai. English field edit hua → hash
//    badla → translation stale → dobara generate. Isse "same unchanged text
//    dobara translate mat karo" bhi automatic ho jata hai: hash match = skip.
//
// 3. SERVICE DOWN → ENGLISH FALLBACK, RETRY BAAD ME
//    LibreTranslate fail ho to `translations` me purani value (ya khaali)
//    rehti hai aur `translation_status` `pending` rehta hai. Backfill script
//    dobara chalane par sirf wahi fields process hote hain.
//
// 4. KIS FIELDS TRANSLATE HOTE HAIN / NAHI
//    Brand/category and descriptive product content, plus attribute names,
//    translate hote hain. Standalone codes/model numbers raw rehte hain.
//    Attribute options me sirf display `label` translate hota hai.
//    Attribute option ka `value` machine code hai (variant matching ke liye)
//    — sirf display wala `label` translate hota hai.
//
// 5. CONTROLLERS KA RESPONSE KABHI BLOCK NAHI HOTA
//    `queueTranslationSync()` fire-and-forget hai (project ke existing
//    `setImmediate` background-work pattern ke same tarike se).

const crypto = require("crypto");
const log = require("./logger");
const { TARGET_LOCALES, isEnabled, translateBatch } = require("./libreTranslate");

// ==========================================
// WHICH FIELDS GET TRANSLATED (per model)
// ==========================================
const TRANSLATABLE_FIELDS = {
  Brand: ["name", "description"],
  Category: ["name", "description"],
  Product: ["name", "description"],
  Attribute: ["name"], // + values[].label (values[].value raw rehta hai)
  Review: ["title", "comment", "storeResponse.message"],
  Discount: ["name", "description"],
  Deal: ["name", "description"],
  Banner: ["title", "eyebrow", "heading", "description", "altText", "primaryButton.text", "secondaryButton.text"],
  Variant: ["title"],
  StockHistory: ["product_name", "variant_title", "reason", "explanation"],
  Order: ["notes", "cancel_reason"],
  PurchaseOrder: ["notes", "cancel_reason"],
  Vendor: ["name", "company_name", "address", "city", "state", "country"],
  ShippingMethod: ["name"],
};

// Ye sab translatable *content* fields hain. Jo is list me hain par
// TRANSLATABLE_FIELDS me nahi — unka status hamesha `skipped` set hota hai,
// taake admin UI / debugging me pata chale ke wo jaan-boojh kar chhore gaye
// (trademark, model number) — silently missing nahi.
const CONTENT_FIELDS = {
  Brand: ["name", "description"],
  Category: ["name", "description"],
  Product: ["name", "description"],
  Attribute: ["name"],
  Review: ["title", "comment", "storeResponse.message"],
  Discount: ["name", "description"],
  Deal: ["name", "description"],
  Banner: ["title", "eyebrow", "heading", "description", "altText", "primaryButton.text", "secondaryButton.text"],
  Variant: ["title"],
  StockHistory: ["product_name", "variant_title", "reason", "explanation"],
  Order: ["notes", "cancel_reason"],
  PurchaseOrder: ["notes", "cancel_reason"],
  Vendor: ["name", "company_name", "address", "city", "state", "country"],
  ShippingMethod: ["name"],
};

// Translation writes update Mongo directly (outside the normal CRUD routes),
// so invalidate public API memoized responses as soon as translated data lands.
const PUBLIC_CACHE_NAMESPACES = {
  Brand: ["brands", "products"],
  Category: ["categories", "products"],
  Product: ["products"],
  Discount: ["discounts"],
  Deal: ["deals"],
  Banner: ["banners"],
  Variant: ["products"],
};

/** Chhota, stable hash — staleness detect karne ke liye. */
function hashText(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return crypto.createHash("md5").update(text).digest("hex").slice(0, 12);
}

/**
 * Kya ye text "worth translating" hai? 1-2 char tokens ("5", "PC", "TV")
 * translate karne se sirf nuqsan hota hai — wahi as-is rehte hain.
 */
function isTranslatableText(value) {
  const text = String(value ?? "").trim();
  return text.length >= 3;
}

function isProductNameIdentifier(value) {
  const text = String(value ?? "").trim();
  // Preserve standalone codes/model numbers, but allow descriptive names that
  // contain a size or model token to be translated.
  return (
    (/\d/.test(text) && /^[A-Za-z0-9]+(?:[._/-][A-Za-z0-9]+)*$/.test(text)) ||
    /^[A-Z0-9]+(?:[-_][A-Z0-9]+)+$/.test(text)
  );
}

function isGeneratedBrandName(value) {
  return /^Brand\s+\d+$/i.test(String(value ?? "").trim());
}

function isGeneratedBannerTitle(value) {
  return /^(?:Promo\s+)?Banner\s+\d+$/i.test(String(value ?? "").trim());
}

function containsUntranslatedLatinWords(source, translation, { preserveFirstWord = false, allowedLatinWords = [] } = {}) {
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

function containsLatinLetters(value) {
  return /[A-Za-z]/.test(String(value ?? ""));
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
  return output.replace(/[.،,:;\s]+/g, " ").trim();
}

function cleanCategoryDescription(text, sourceDescription, translatedName, locale) {
  const template = String(sourceDescription || "").trim().match(/^Shop\s+(.+?)\s+products$/i);
  const localizedName = String(translatedName || "").trim();
  if (!template || !localizedName) return text;

  let output = String(text || "");
  const sourceCategoryWords = template[1].match(/[A-Za-z]+/g) || [];
  const hasUntranslatedCategoryWord = sourceCategoryWords.some((word) =>
    new RegExp("\\b" + word + "\\b", "i").test(output)
  );
  if (!hasUntranslatedCategoryWord) return output;

  for (const word of [...sourceCategoryWords, "shop", "products"]) {
    output = output.replace(new RegExp("\\b" + word + "\\b", "gi"), " ");
  }
  output = output.replace(/[&.,]+/g, " ").replace(/\s+/g, " ").trim();
  const categoryDescriptions = {
    ur: (name) => name + " کی مصنوعات",
    ar: (name) => "منتجات " + name,
    es: (name) => "Productos de " + name,
    fr: (name) => "Produits " + name,
    de: (name) => "Produkte aus " + name,
    hi: (name) => name + " के उत्पाद",
    pt: (name) => "Produtos de " + name,
    tr: (name) => name + " ürünleri",
    zh: (name) => name + "商品",
  };
  return categoryDescriptions[locale]?.(localizedName) || (localizedName + (output ? " " + output : ""));
}

function isUsableTranslation(source, translation, locale, options = {}) {
  const original = String(source ?? "").trim();
  const translated = String(translation ?? "").trim();
  if (!translated) return false;
  if (/wikipedia|wikipédia|ویکیپیڈیا|维基百科|विकिपीडिया/i.test(translated)) return false;

  if (
    /\p{L}/u.test(original) &&
    !/^[\p{Lu}\p{N}\s.,:/_-]+$/u.test(original) &&
    translated.toLocaleLowerCase() === original.toLocaleLowerCase()
  ) {
    return false;
  }

  const targetScript = {
    ar: /\p{Script=Arabic}/u,
    ur: /\p{Script=Arabic}/u,
    hi: /\p{Script=Devanagari}/u,
    zh: /\p{Script=Han}/u,
  }[locale];
  if (targetScript && /[a-z]/i.test(original) && !targetScript.test(translated)) {
    return false;
  }

  if (targetScript && Number.isFinite(options.maxLatinWordRatio)) {
    const latinWordCount = (translated.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []).length;
    const translatedWordCount = (translated.match(/[\p{L}\p{N}]+/gu) || []).length;
    if (translatedWordCount && latinWordCount / translatedWordCount > options.maxLatinWordRatio) {
      return false;
    }
  }

  if (
    targetScript &&
    options.rejectAnyLatin &&
    containsLatinLetters(translated)
  ) {
    return false;
  }

  if (
    targetScript &&
    (options.rejectSourceWords || options.productName) &&
    containsUntranslatedLatinWords(original, translated, {
      preserveFirstWord: options.preserveFirstWord === true,
      allowedLatinWords: options.allowedLatinWords || [],
    })
  ) {
    return false;
  }

  const words = translated.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  return words.length < 2 || !words.every((word) => word === words[0]);
}

/** Mongoose Map bhi object ho sakta hai — dono ko plain object bana do. */
function toPlain(mapOrObject) {
  if (mapOrObject == null) return {};
  const plain = typeof mapOrObject.toObject === "function" ? mapOrObject.toObject() : mapOrObject;
  if (Array.isArray(plain)) return plain.map(toPlain);
  if (typeof plain !== "object") return plain;
  if (plain instanceof Date || plain?._bsontype || Buffer.isBuffer(plain)) return plain;
  return Object.fromEntries(Object.entries(plain).map(([key, value]) => [key, toPlain(value)]));
}

function getPathValue(value, path) {
  return path.split(".").reduce((current, part) => current?.[part], value);
}

function setPathValue(target, path, value) {
  const parts = path.split(".");
  const leaf = parts.pop();
  const parent = parts.reduce((current, part) => {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    return current[part];
  }, target);
  parent[leaf] = value;
}

function deletePathValue(target, path) {
  const parts = path.split(".");
  const leaf = parts.pop();
  const parent = parts.reduce((current, part) => current?.[part], target);
  if (parent) delete parent[leaf];
}

/** Attribute ke option labels (index + value + label). */
function collectAttributeLabels(values) {
  const list = Array.isArray(values) ? values : [];
  return list
    .map((v, index) => ({ index, value: v?.value, label: v?.label }))
    .filter((v) => v.value && isTranslatableText(v.label));
}

/**
 * Ek document ke translations synchronize karo aur Mongo me persist karo.
 *
 * @param {import('mongoose').Model} Model
 * @param {object|string} docOrId  Mongoose/lean doc, ya `_id`
 * @param {{force?:boolean}} [opts]  `force: true` hash match hone par bhi
 *                                   dobara translate karta hai (model upgrade
 *                                   ke baad puri refresh ke liye)
 * @returns {Promise<{translated:number, failed:boolean}>}
 */
async function syncDocumentTranslations(Model, docOrId, opts = {}) {
  if (!isEnabled()) return { translated: 0, failed: false };

  const force = opts.force === true;
  const requestedLocales = Array.isArray(opts.locales)
    ? [...new Set(opts.locales.filter((locale) => TARGET_LOCALES.includes(locale)))]
    : TARGET_LOCALES;
  const modelName = Model.modelName;

  // Doc-like (has `_id`) → use as-is; warna id se load karo.
  const doc =
    docOrId && typeof docOrId === "object" && docOrId._id
      ? docOrId
      : await Model.findById(docOrId).lean();

  if (!doc || !doc._id) return { translated: 0, failed: false };
  if (doc.is_deleted === true) return { translated: 0, failed: false };

  const fieldNames = CONTENT_FIELDS[modelName] || [];
  const labelEntries = modelName === "Attribute" ? collectAttributeLabels(doc.values) : [];

  if (!fieldNames.length && !labelEntries.length) {
    return { translated: 0, failed: false };
  }

  // ---- STALE DETECTION ----------------------------------------
  const nextTranslations = toPlain(doc.translations);
  const nextSource = toPlain(doc.translation_source);
  const nextStatus = toPlain(doc.translation_status);

  /** @type {{field:string, text:string}[]} */
  const stale = [];

  for (const field of fieldNames) {
    if (!(TRANSLATABLE_FIELDS[modelName] || []).includes(field)) {
      nextStatus[field] = "skipped";
      continue;
    }

    const text = String(getPathValue(doc, field) ?? "").trim();
    // Seed/demo labels are identifiers, not natural-language brand names.
    // Translation engines often hallucinate unrelated phrases for these.
    if (modelName === "Brand" && field === "name" && isGeneratedBrandName(text)) {
      setPathValue(nextStatus, field, "skipped");
      deletePathValue(nextTranslations, field);
      deletePathValue(nextSource, field);
      continue;
    }
    if (modelName === "Banner" && field === "title" && isGeneratedBannerTitle(text)) {
      setPathValue(nextStatus, field, "skipped");
      deletePathValue(nextTranslations, field);
      deletePathValue(nextSource, field);
      continue;
    }
    if (modelName === "Product" && field === "name" && isProductNameIdentifier(text)) {
      setPathValue(nextStatus, field, "skipped");
      deletePathValue(nextTranslations, field);
      deletePathValue(nextSource, field);
      continue;
    }

    if (
      modelName === "Review" &&
      /[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Han}]/u.test(text)
    ) {
      setPathValue(nextStatus, field, "skipped");
      deletePathValue(nextTranslations, field);
      deletePathValue(nextSource, field);
      continue;
    }

    if (!isTranslatableText(text)) {
      // Khaali ya 1-2 char → translate karne ka koi matlab nahi.
      setPathValue(nextStatus, field, "skipped");
      continue;
    }

    const currentHash = hashText(text);
    const storedHash = getPathValue(nextSource, field) || "";
    const translationText = text;
    const validationOptions = {
      productName: modelName === "Product" && field === "name",
      rejectAnyLatin:
        ["Discount", "Deal", "Banner", "Variant", "StockHistory", "Order", "PurchaseOrder", "Vendor", "ShippingMethod"].includes(modelName),
      // Brand/product tokens (LuxeCarry, FitPro, ...) must survive translation,
      // same as Product names do via preserveFirstWord. Applies to names of
      // Discount/Deal/Banner too, which frequently embed brand names.
      preserveFirstWord:
        (modelName === "Product" && field === "name") ||
        (modelName === "Brand" && (field === "name" || field === "description")) ||
        (modelName === "StockHistory" && field === "product_name") ||
        (["Discount", "Deal", "Banner"].includes(modelName) && field === "name"),
      rejectSourceWords:
        ["Variant", "StockHistory", "Order", "PurchaseOrder"].includes(modelName) ||
        (modelName === "Brand" && field === "name") ||
        modelName === "Category" ||
        modelName === "Attribute" ||
        ["Review", "Discount", "Deal", "Banner"].includes(modelName),
      allowedLatinWords:
        modelName === "Product" && field === "description"
          ? [String(getPathValue(doc, "name") || "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/)?.[0] || ""]
          : modelName === "Brand" && field === "description"
          ? String(getPathValue(doc, "name") || "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
          : [],
      maxLatinWordRatio:
        (modelName === "Product" && field === "description") ||
        (modelName === "Brand" && field === "description")
          ? 0.2
          : undefined,
    };
    const haveTranslation = requestedLocales.every(
      (locale) =>
        isUsableTranslation(
          text,
          getPathValue(nextTranslations, field)?.[locale],
          locale,
          validationOptions
        )
    );

    // Hash same + translation maujood → fresh, kuch nahi karna.
    if (!force && storedHash === currentHash && haveTranslation) {
      setPathValue(nextStatus, field, "done");
      continue;
    }

    // English source badla ho to purani translations ab stale hain; clear
    // unhein warna doosri language purana text dikha sakti hai.
    if (storedHash && storedHash !== currentHash) setPathValue(nextTranslations, field, {});
    setPathValue(nextSource, field, currentHash);
    setPathValue(nextStatus, field, "pending");
    stale.push({
      field,
      text,
      translationText,
      validationOptions,
      preserveValidTranslations: !force && storedHash === currentHash,
    });
  }

  // ---- TRANSLATE ------------------------------------------------
  // Document ke andar same text ek hi baar translate hoga.
  const uniqueTexts = [...new Set(stale.map((item) => item.translationText || item.text))];
  /** @type {Map<string, Map<string,string>>} english -> (locale -> urdu) */
  const results = new Map();
  let failed = false;
  let invalidTranslation = false;

  if (uniqueTexts.length) {
    for (const locale of requestedLocales) {
      // Keep already valid locale values and avoid translating them again.
      // Backfills often need to repair only one missing locale; repeating all
      // nine model calls for every retry made that path unnecessarily slow.
      const textsForLocale = uniqueTexts.filter((translationText) =>
        stale.some((item) => {
          if ((item.translationText || item.text) !== translationText) return false;
          if (!item.preserveValidTranslations) return true;
          const current = getPathValue(nextTranslations, item.field)?.[locale];
          return !isUsableTranslation(item.text, current, locale, item.validationOptions);
        })
      );
      if (!textsForLocale.length) continue;

      const translated = await translateBatch(textsForLocale, locale);
      if (translated === null) {
        failed = true;
        break;
      }
      const bySource = new Map();
      textsForLocale.forEach((text, i) => bySource.set(text, String(translated[i] ?? "").trim()));
      results.set(locale, bySource);
    }
  }

  if (!failed) {
    for (const { field, text, translationText, validationOptions, preserveValidTranslations } of stale) {
      const perLocale = toPlain(getPathValue(nextTranslations, field));
      for (const locale of requestedLocales) {
        if (
          preserveValidTranslations &&
          isUsableTranslation(text, perLocale[locale], locale, validationOptions)
        ) {
          continue;
        }

        let out = results.get(locale)?.get(translationText || text);
        // Product title alag column me dikh raha hai; description ke andar
        // repeat hua title aur "by Brand" boilerplate hata do.
        if (modelName === "Product" && field === "description" && out) {
          out = cleanRepeatedProductTitle(out, getPathValue(doc, "name"));
        }
        if (modelName === "Category" && field === "description" && out) {
          out = cleanCategoryDescription(
            out,
            text,
            getPathValue(nextTranslations, "name")?.[locale],
            locale
          );
        }
        if (
          isUsableTranslation(text, out, locale, validationOptions)
        ) {
          perLocale[locale] = out;
        } else {
          delete perLocale[locale];
          invalidTranslation = true;
        }
      }

      setPathValue(nextTranslations, field, perLocale);
      setPathValue(
        nextStatus,
        field,
        TARGET_LOCALES.every((locale) => Boolean(perLocale[locale])) ? "done" : "pending"
      );
    }
  } else {
    for (const { field } of stale) setPathValue(nextStatus, field, "pending");
  }

  // ---- BUILD THE `$set` -----------------------------------------
  // Poore sub-document set karte hain (Mongoose Maps par dotted update
  // unreliable hota hai), merge read-modify-write kar ke.
  const $set = {
    translations: nextTranslations,
    translation_source: nextSource,
    translation_status: nextStatus,
  };

  // ---- ATTRIBUTE OPTION LABELS ---------------------------------
  // `values[].value` raw rehta hai (variant matching usi par chalti hai);
  // sirf `values[].label` ka display text translate hota hai.
  let labelCount = 0;

  if (modelName === "Attribute" && labelEntries.length) {
    // `_id` samet har field copy karte hain, taake `$set` se purana array
    // replace karne par option ids na badlein.
    const nextValues = (doc.values || []).map((v) => ({ ...toPlain(v) }));

    // Stale tabhi jab label badla ho YA koi CONFIGURED locale missing ho.
    // Sirf pehle locale check karne se `ur` ban jane ke baad `ar` kabhi
    // generate hi nahi hota (isiliye yahan poori list check hoti hai).
    const staleLabels = labelEntries.filter((entry) => {
      const v = nextValues[entry.index];
      if (force) return true;
      if ((v?.label_source || "") !== hashText(entry.label)) return true;
      const have = toPlain(v?.label_translations);
      return requestedLocales.some(
        (locale) => !isUsableTranslation(entry.label, have[locale], locale)
      );
    });

    if (staleLabels.length) {
      const uniqueLabels = [...new Set(staleLabels.map((l) => l.label))];

      // Har configured locale ke liye translate — pehle yahan `TARGET_LOCALES[0]`
      // hardcode tha, jis se sirf Urdu banta tha aur Arabic chhoot jata tha.
      /** @type {Map<string, Map<string,string>>} english -> (locale -> text) */
      const labelResults = new Map();
      for (const locale of requestedLocales) {
        const translated = await translateBatch(uniqueLabels, locale);
        if (translated === null) {
          // Engine down → labels raw (English) rehengi, retry backfill me.
          failed = true;
          break;
        }
        const perLocale = new Map();
        uniqueLabels.forEach((label, i) => {
          const value = String(translated[i] ?? "").trim();
          perLocale.set(
            label,
            isUsableTranslation(label, value, locale) ? value : ""
          );
        });
        labelResults.set(locale, perLocale);
      }

      if (!failed) {
        for (const entry of staleLabels) {
          const v = nextValues[entry.index];
          if (!v) continue;

          const existing = toPlain(v.label_translations);
          let added = 0;
          for (const [locale, perLocale] of labelResults) {
            const out = perLocale.get(entry.label);
            if (out) {
              existing[locale] = out;
              added++;
            } else {
              delete existing[locale];
              invalidTranslation = true;
            }
          }
          labelCount += added;

          v.label_translations = existing;
          v.label_source = hashText(entry.label);
        }
      }
    }

    if (nextValues.length) $set.values = nextValues;
  }

  // ---- PERSIST --------------------------------------------------
  await Model.updateOne({ _id: doc._id }, { $set });

  // Public responses may have been cached before these translations were
  // saved. Drop affected namespaces so refetches after a locale switch receive
  // the newly persisted translation maps instead of stale English data.
  const cacheNamespaces = PUBLIC_CACHE_NAMESPACES[modelName];
  if (cacheNamespaces?.length) {
    try {
      require("./publicCache").invalidate(cacheNamespaces);
    } catch (error) {
      log.warn(`[translation] Could not invalidate public ${modelName} cache:`, error?.message || error);
    }
  }

  return {
    translated: stale.length + labelCount,
    failed: failed || invalidTranslation,
    serviceUnavailable: failed,
  };
}

/**
 * Fire-and-forget wrapper jo controllers me use hota hai.
 * Request ka wait nahi karta — user ko turant response milta hai,
 * translation peeche generate hota hai.
 */
function queueTranslationSync(Model, docId) {
  if (!isEnabled()) return;
  setImmediate(async () => {
    try {
      await syncDocumentTranslations(Model, docId);
    } catch (error) {
      // Translation failure kabhi original save ko fail nahi karta.
      log.error(`[translation] ${Model.modelName} sync failed:`, error?.message || error);
    }
  });
}

/**
 * Backfill — poori database ke liye, batches me (cursor-based, memory-safe).
 * Script `scripts/backfillTranslations.js` isko call karta hai. Sirf stale /
 * pending fields hi translate hote hain — already-translated skip ho jaate
 * hain, is liye ye script baar baar chalana safe hai.
 *
 * @param {import('mongoose').Model[]} models
 * @param {{batchSize?:number, limit?:number, force?:boolean, onProgress?:Function}} opts
 */
async function backfillTranslations(models, opts = {}) {
  const batchSize = opts.batchSize || 25;
  const limit = opts.limit || 0;
  const force = opts.force === true;
  const onProgress = opts.onProgress || (() => {});

  const summary = {};

  for (const Model of models) {
    const modelName = Model.modelName;

    // Cursor → poori dataset ek saath memory me nahi aati.
    const cursor = Model.find({ is_deleted: { $ne: true } })
      .select(
        "_id name description title comment storeResponse.message values translations translation_source translation_status is_deleted eyebrow heading altText primaryButton.text secondaryButton.text"
      )
      .lean()
      .cursor();

    let processed = 0;
    let translated = 0;
    let failedCount = 0;

    while (true) {
      if (limit && processed >= limit) break;

      const size = limit ? Math.min(batchSize, limit - processed) : batchSize;
      const batch = [];
      // ⚠️ Mongoose 9 ke `QueryCursor` par `hasNext()` exist hi nahi karta
      // (sirf `next()` / `eachAsync()`). `next()` khatam hone par `null`
      // deta hai — isi loop-break ko use karte hain.
      while (batch.length < size) {
        const doc = await cursor.next();
        if (!doc) break;
        batch.push(doc);
      }
      if (!batch.length) break;

      for (const doc of batch) {
        const result = await syncDocumentTranslations(Model, doc, { force });
        processed++;
        if (result.failed) failedCount++;
        if (result.translated > 0) translated++;
      }

      onProgress({ modelName, processed, translated, failedCount });
    }

    await cursor.close();
    summary[modelName] = { processed, translated, failedCount };
  }

  return summary;
}

module.exports = {
  TRANSLATABLE_FIELDS,
  hashText,
  isTranslatableText,
  isProductNameIdentifier,
  cleanRepeatedProductTitle,
  cleanCategoryDescription,
  syncDocumentTranslations,
  queueTranslationSync,
  backfillTranslations,
};
