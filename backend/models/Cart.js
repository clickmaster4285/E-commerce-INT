const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: true,
    },
    // ✅ Mixed = poora item object as-is save hoga (deal fields bhi)
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("Cart", cartSchema);
