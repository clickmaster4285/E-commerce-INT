const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    brand_code: {
      type: String,
      required: true,
      unique: true,
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


    // Logo metadata
    logo: {
      img_url: {
        type: String,
        default: "",
      },

      img_size: {
        type: Number,
        default: 0,
      },

      mimeType: {
        type: String,
        default: "",
      },

      width: {
        type: Number,
        default: 0,
      },

      height: {
        type: Number,
        default: 0,
      },
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


    // Tracking users
    createdby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    deletedby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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


module.exports = mongoose.model(
  "Brand",
  brandSchema
);