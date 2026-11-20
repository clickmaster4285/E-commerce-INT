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
    // superadmin = full control incl. Team management; staff = sab sections, Team nahi
    role: { type: String, enum: ["superadmin", "staff"], default: "superadmin" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    phone: { type: String, default: "", trim: true },
    // Kis super admin ne add kiya (seeded account ke liye null)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "SuperAdmin", default: null },
    lastLoginAt: { type: Date, default: null },
    // Har request par (max 1/min) update — "Online now" / "Last seen" ke liye
    lastActiveAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    // Super Admin panel accounts.
    collection: "superadmin_users",
  }
);

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
