const mongoose = require("mongoose");

const auditChangeSchema = new mongoose.Schema({ field: String, before: String, after: String }, { _id: false });
const activitySchema = new mongoose.Schema({ type: { type: String, required: true }, at: { type: Date, default: Date.now }, actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null }, actor_name: { type: String, default: "Administrator" }, changes: { type: [auditChangeSchema], default: [] } }, { _id: false });

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
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
    activity: { type: [activitySchema], default: [] },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

customerSchema.index({ name: 1, phone: 1 });
customerSchema.index({ phone: 1 });
customerSchema.index({ email: 1 });

module.exports = mongoose.model("Customer", customerSchema);
