// ==========================================================
// SOFT DELETE PLUGIN — default queries se deleted rows hide
// ----------------------------------------------------------
// `withDeleted: true` option par purana behavior (deleted bhi dikhein).
// Explicit `is_deleted` filter query me ho to override mat karo.
// Mongoose 9 query middleware: async function, no `next` callback.
// ==========================================================

const DEFAULT_FILTER = { is_deleted: { $ne: true } };

function softDeletePlugin(schema) {
  const applySoftDeleteFilter = function applySoftDeleteFilter() {
    if (this.getOptions().withDeleted === true) return;
    const filter = this.getFilter();
    if (Object.prototype.hasOwnProperty.call(filter, "is_deleted")) return;
    this.where(DEFAULT_FILTER);
  };

  schema.pre("find", applySoftDeleteFilter);
  schema.pre("findOne", applySoftDeleteFilter);
  schema.pre("countDocuments", applySoftDeleteFilter);
  schema.pre("findOneAndUpdate", applySoftDeleteFilter);
  schema.pre("updateOne", applySoftDeleteFilter);
  schema.pre("updateMany", applySoftDeleteFilter);
}

module.exports = softDeletePlugin;
