export const PHONE_MIN = 10;
export const PHONE_MAX = 16;

export const normalizePhone = (phone) => String(phone ?? "").replace(/\D/g, "").slice(0, PHONE_MAX);

export const isValidPhone = (phone) =>
  typeof phone === "string" &&
  phone.length >= PHONE_MIN &&
  phone.length <= PHONE_MAX &&
  /^\d{10,16}$/.test(phone);
