const translationStatusEnum = ["pending", "done", "failed", "skipped"];

/**
 * translations / translation_source / translation_status triple (§3.10)
 * @param {import("mongoose").Schema} schema
 * @param {string[]} fields
 */
function translatablePlugin(schema, fields = []) {
  const list = Array.isArray(fields) ? fields.filter(Boolean) : [];
  if (!list.length) return;

  const translations = {};
  const translation_source = {};
  const translation_status = {};

  for (const field of list) {
    translations[field] = { type: Map, of: String, default: () => ({}) };
    translation_source[field] = { type: String, default: "" };
    translation_status[field] = {
      type: String,
      enum: translationStatusEnum,
      default: "pending",
    };
  }

  schema.add({
    translations,
    translation_source,
    translation_status,
  });
}

module.exports = translatablePlugin;