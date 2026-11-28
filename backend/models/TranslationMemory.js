const mongoose = require("mongoose");

// Platform-wide — LibreTranslate se pehle cache (§3.10)
const translationMemorySchema = new mongoose.Schema(
  {
    source_hash: { type: String, required: true, trim: true, index: true },
    source_lang: { type: String, required: true, trim: true, lowercase: true },
    target_lang: { type: String, required: true, trim: true, lowercase: true },
    text: { type: String, required: true },
    engine: { type: String, trim: true, default: "libretranslate" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

translationMemorySchema.index({ source_hash: 1, target_lang: 1 }, { unique: true });

module.exports = mongoose.model("TranslationMemory", translationMemorySchema);