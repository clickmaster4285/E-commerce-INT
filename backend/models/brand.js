  const mongoose = require("mongoose");

  const brandSchema = new mongoose.Schema(
    {
      brand_code: {
        type: String,
        required: true,
        trim: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        trim: true,
        default: "",
      },

      // ==========================================
      // 🌍 AUTOMATIC TRANSLATIONS (LibreTranslate)
      // ------------------------------------------
      // English `name`/`description` upar hi source of truth hain — inme kabhi
      // koi write nahi hota. Translation alag `translations` map me jaata hai,
      // is liye original English kabhi overwrite/delete nahi hota.
      //
      //   translations.name.ur      → translated text
      //   translation_source.name   → us English text ka hash (staleness)
      //   translation_status.name   → pending | done | failed | skipped
      //
      // `name` bhi translate hota hai kyun ke ye user-facing display naam hai,
      // aur `description` bhi translate hota hai. English source text hamesha
      // original field me rehta hai, Urdu/Arabic translations alag map me.
      translations: {
        name: { type: Map, of: String, default: () => ({}) },
        description: { type: Map, of: String, default: () => ({}) },
      },
      translation_source: {
        name: { type: String, default: "" },
        description: { type: String, default: "" },
      },
      translation_status: {
        name: {
          type: String,
          enum: ["pending", "done", "failed", "skipped"],
          default: "skipped",
        },
        description: {
          type: String,
          enum: ["pending", "done", "failed", "skipped"],
          default: "pending",
        },
      },

      logo: {
        img_url: { type: String, default: "" },
        img_size: { type: Number, default: 0 },
        mimeType: { type: String, default: "" },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
      },

      country: {
        type: String,
        trim: true,
        default: "",
      },

      is_active: {
        type: Boolean,
        default: true,
      },

      // ✅ Soft Delete Fields
      is_deleted: {
        type: Boolean,
        default: false,
        index: true,
      },

      deleted_at: {
        type: Date,
        default: null,
      },

      // Tracking users
      createdby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },

      updatedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },

      deletedby: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employee",
        default: null,
      },
    },
    {
      timestamps: {
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    }
  );

  // ✅ Compound Unique Index: brand_code + is_deleted
  // Is se same brand_code wala naya brand ban sakta hai agar purana soft deleted ho
  brandSchema.index({ brand_code: 1, is_deleted: 1 }, { unique: true });

  // ✅ Static: Sirf active (non-deleted) brands fetch karein
  brandSchema.statics.findActive = function (filter = {}) {
    return this.find({ ...filter, is_deleted: false });
  };

  // ✅ Instance: Soft delete karein
  brandSchema.methods.softDelete = async function (userId) {
    this.is_deleted = true;
    this.deleted_at = new Date();
    this.deletedby = userId || null;
    return this.save();
  };

  // ✅ Instance: Restore karein
  brandSchema.methods.restore = async function () {
    this.is_deleted = false;
    this.deleted_at = null;
    this.deletedby = null;
    return this.save();
  };

  module.exports = mongoose.model("Brand", brandSchema);