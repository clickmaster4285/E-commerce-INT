// ==========================================================
// validate({ body, query, params }) — zod schemas se request validate (§5.3)
// Pass hone par parsed (coerced/stripped) values req par wapas set hote hain.
// Fail par 400 { success:false, message, errors:[{ path, message }] }.
// ==========================================================
const validate = (schemas = {}) => (req, res, next) => {
  const errors = [];
  for (const part of ["params", "query", "body"]) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ path: [part, ...issue.path].join("."), message: issue.message });
      }
    } else if (part === "query") {
      // Express 5 me req.query getter-only hai — Object.defineProperty se override
      Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true, enumerable: true });
    } else {
      req[part] = result.data;
    }
  }
  if (errors.length) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
  }
  return next();
};

module.exports = { validate };
