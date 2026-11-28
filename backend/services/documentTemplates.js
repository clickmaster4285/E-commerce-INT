const DocumentTemplate = require("../models/DocumentTemplate");

/** Ensure a default template row exists for kind; return it. */
async function ensureDefaultTemplate(kind, seed = {}) {
  let row = await DocumentTemplate.findOne({ kind, is_default: true }).lean();
  if (row) return row;
  const [created] = await DocumentTemplate.create([{
    kind,
    name: seed.name || `Default ${kind}`,
    pdf_design: seed.pdf_design || {},
    terms: seed.terms || "",
    bank_details: seed.bank_details || "",
    version: 1,
    is_default: true,
  }]);
  return created.toObject ? created.toObject() : created;
}

async function getDefaultTemplate(kind) {
  return DocumentTemplate.findOne({ kind, is_default: true }).lean();
}

module.exports = { ensureDefaultTemplate, getDefaultTemplate };
