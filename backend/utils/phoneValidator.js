/**
 * Phone Number Validation & Sanitization Utility
 * 
 * Rules:
 * - Only numeric digits (0-9) allowed
 * - No alphabetic characters, special characters, spaces, or mixed text
 * - Minimum 7 digits, maximum 15 digits (international standard)
 * - Returns sanitized numeric string or null if invalid
 */

const PHONE_MIN_LENGTH = 7;
const PHONE_MAX_LENGTH = 15;

/**
 * Sanitize phone number - strips all non-numeric characters
 * @param {string} phone - Raw phone input
 * @returns {string|null} - Sanitized numeric string or null if empty
 */
const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== "string") return null;
  // Strip everything except digits
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Validate phone number
 * @param {string} phone - Raw phone input
 * @param {object} [options] - Optional overrides (e.g. { min: 6, max: 15 })
 * @returns {{ valid: boolean, sanitized: string|null, message: string }}
 */
const validatePhone = (phone, options = {}) => {
  const minDigits = Number.isInteger(options.min) ? options.min : PHONE_MIN_LENGTH;
  const maxDigits = Number.isInteger(options.max) ? options.max : PHONE_MAX_LENGTH;

  if (!phone || (typeof phone === "string" && phone.trim() === "")) {
    return { valid: true, sanitized: "", message: "" };
  }

  const sanitized = sanitizePhone(phone);
  if (!sanitized) {
    return { valid: false, sanitized: null, message: "Phone number cannot be empty" };
  }

  if (sanitized.length < minDigits) {
    return { valid: false, sanitized: null, message: `Phone number must be at least ${minDigits} digits` };
  }

  if (sanitized.length > maxDigits) {
    return { valid: false, sanitized: null, message: `Phone number must be at most ${maxDigits} digits` };
  }

  return { valid: true, sanitized, message: "" };
};

/**
 * Express-style middleware for validating phone in req.body
 * @param {string} fieldName - Field name in req.body (default: "phone")
 */
const validatePhoneField = (fieldName = "phone") => {
  return (req, res, next) => {
    const value = req.body[fieldName];
    if (value === undefined || value === null || value === "") {
      return next();
    }

    const result = validatePhone(value);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    req.body[fieldName] = result.sanitized;
    next();
  };
};

module.exports = {
  sanitizePhone,
  validatePhone,
  validatePhoneField,
  PHONE_MIN_LENGTH,
  PHONE_MAX_LENGTH,
};
