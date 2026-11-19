const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // bcrypt hash — never plain text
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["superadmin", "staff"], default: "superadmin" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "superadmins",
  }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
