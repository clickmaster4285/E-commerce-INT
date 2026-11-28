/**
 * Phone Number Validation & Sanitization Utility
 * 
 * Rules:
 * - Only numeric digits (0-9) allowed
 * - No alphabetic characters, special characters, spaces, or mixed text
 * - Minimum 10 digits, maximum 16 digits
 * - Returns sanitized numeric string or null if invalid
 */

const PHONE_MIN_LENGTH = 10;
const PHONE_MAX_LENGTH = 16;

const normalizePhone = (phone) => String(phone ?? "").replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH);

const isValidPhone = (phone) =>
  typeof phone === "string" &&
  phone.length >= PHONE_MIN_LENGTH &&
  phone.length <= PHONE_MAX_LENGTH &&
  /^\d{10,16}$/.test(phone);

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

module.exports = {
  sanitizePhone,
  normalizePhone,
  isValidPhone,
  validatePhone,
  PHONE_MIN_LENGTH,
  PHONE_MAX_LENGTH,
};
