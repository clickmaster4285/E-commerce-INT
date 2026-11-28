const mongoose = require("mongoose");

/**
 * createdby / updatedby / deletedby → Employee ref (§3.10 shared audit fields)
 * @param {import("mongoose").Schema} schema
 */
function auditRefsPlugin(schema) {
  const refs = {
    createdby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    updatedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    deletedby: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  };
  schema.add(refs);
}

module.exports = auditRefsPlugin;