const path = require("path");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("./roles");
const fs = require("fs");
const crypto = require("crypto");
const log = require("./logger");
const { isPlatformFamilyHost } = require("./tenantHost");
// Lazy: middleware/resolveStore → models/Store; circular require se bachne ke liye function ke andar
const resolveStoreByHost = (host) => require("../middleware/resolveStore").resolveStoreByHost(host);

const { runWithStore, getStoreId } = require("./tenantContext");

let io = null;

// ==========================================
// TENANT-AWARE IO (multi-tenant broadcasts)
// ------------------------------------------
// Store context (HTTP request / socket event jo kisi store host par ho) me:
//   io.emit(ev)          → sirf usi store ke sockets  (room "store:<id>")
//   io.to("chat:admins") → sirf usi store ke admins   (room "chat:admins:<id>")
// Baaki rooms (employee:<id>, chat:conversation:<id> ...) pehle se unique IDs hain.
// Platform context (super admin) me sab kuch pehle jaisa global.
// ==========================================
const storeRoom = (storeId) => `store:${storeId}`;
const SHARED_ROOMS = new Set(["chat:admins"]);
const mapRoom = (room, storeId) =>
  typeof room === "string" && SHARED_ROOMS.has(room) ? `${room}:${storeId}` : room;

function createTenantIO(server) {
  return new Proxy(server, {
    get(target, prop) {
      const storeId = getStoreId();
      if (storeId) {
        if (prop === "emit") return (...args) => target.to(storeRoom(storeId)).emit(...args);
        if (prop === "to" || prop === "in") {
          return (room) => target.to(Array.isArray(room) ? room.map((r) => mapRoom(r, storeId)) : mapRoom(room, storeId));
        }
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// ==========================================
// HELPER: COMPRESS & SAVE LOGO
// ==========================================
const compressAndSaveLogo = async (base64Data, fileName) => {
  if (!base64Data || typeof base64Data !== "string") return null;

  const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!mimeMatch) throw new Error("Invalid base64 image format");

  const mimeType = mimeMatch[1];
  const rawBuffer = Buffer.from(mimeMatch[2], "base64");

  const configuredMaxSize = Number.parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10;
  const maxSize = configuredMaxSize * 1024 * 1024;
  if (rawBuffer.length > maxSize) throw new Error(`Image too large (max ${configuredMaxSize}MB)`);

  // Store ka apna folder: uploads/stores/<storeId>/store (socket event runWithStore me chalta hai)
  const { uploadDirFor, uploadUrlFor } = require("./uploadPaths");
  const storeDir = uploadDirFor(null, process.env.STORE_UPLOAD_SUBDIR || "store");
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  const relativeFor = (filePath) => uploadUrlFor(filePath).slice(1);

  const safeName = (fileName || "logo")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-]/g, "")
    .replace(/\.[^.]+$/, "");

  const verifyFile = (filePath, label) => {
    if (!fs.existsSync(filePath)) throw new Error(`${label} file write failed — file not found: ${filePath}`);
    const stat = fs.statSync(filePath);
    if (stat.size === 0) throw new Error(`${label} file write failed — file is empty: ${filePath}`);
    return stat.size;
  };

  if (mimeType.includes("svg")) {
    const finalName = `store-logo-${Date.now()}-${safeName}.svg`;
    const filePath = path.join(storeDir, finalName);
    fs.writeFileSync(filePath, rawBuffer);
    verifyFile(filePath, "SVG");
    return { path: filePath, filename: finalName, mimetype: mimeType, size: rawBuffer.length, relativePath: relativeFor(filePath) };
  }

  // ⚠️ WEBP (alpha support) — JPEG me alpha channel nahi hota, is liye transparent
  // PNG / WEBP logos save hote waqt BLACK background par flatten ho jate the.
  const finalName = `store-logo-${Date.now()}-${safeName}.webp`;
  const filePath = path.join(storeDir, finalName);

  try {
    const sharp = require("sharp");
    await sharp(rawBuffer)
      .rotate() // EXIF orientation pehle
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100, effort: 4 })
      .toFile(filePath);
    const savedSize = verifyFile(filePath, "WebP");
    return { path: filePath, filename: finalName, mimetype: "image/webp", size: savedSize, relativePath: relativeFor(filePath) };
  } catch (err) {
    log.warn("⚠️ Sharp compression failed, saving raw:", err.message);
    const fallbackExt = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const fallbackName = `store-logo-${Date.now()}-${safeName}-raw.${fallbackExt}`;
    const fallbackPath = path.join(storeDir, fallbackName);
    fs.writeFileSync(fallbackPath, rawBuffer);
    const savedSize = verifyFile(fallbackPath, "Raw fallback");
    return { path: fallbackPath, filename: fallbackName, mimetype: mimeType, size: savedSize, relativePath: relativeFor(fallbackPath) };
  }
};

// ==========================================
// HELPER: PROCESS EMPLOYEE AVATAR
// (base64 -> 320x320 webp data URL, DB me store hota hai)
// ==========================================
const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif", "image/gif"];

const processEmployeeAvatar = async (base64Data) => {
  if (!base64Data || typeof base64Data !== "string") return null;

  const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!mimeMatch) throw new Error("invalid image format");

  const mimeType = mimeMatch[1].toLowerCase();
  if (!AVATAR_MIME_TYPES.includes(mimeType)) {
    throw new Error("unsupported type (use PNG, JPG or WEBP)");
  }

  const rawBuffer = Buffer.from(mimeMatch[2], "base64");
  if (!rawBuffer.length) throw new Error("empty image data");

  const maxSize = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) * 1024 * 1024;
  if (rawBuffer.length > maxSize) throw new Error(`too large (max ${process.env.MAX_UPLOAD_SIZE_MB}MB)`);

  const sharp = require("sharp");
  const optimized = await sharp(rawBuffer)
    .rotate()
    .resize(320, 320, { fit: "cover", position: "centre" })
    .webp({ quality: 82, alphaQuality: 100, effort: 4 })
    .toBuffer();

  const MAX_STORED = 600 * 1024;
  if (optimized.length > MAX_STORED) throw new Error("image is too detailed, please pick a smaller photo");

  return `data:image/webp;base64,${optimized.toString("base64")}`;
};

const deleteOldLogo = async (logoUrlOverride) => {
  try {
    const Store = require("../models/Store");
    const existing = await Store.findOne();
    if (existing?.logo?.img_url) {
      const imgUrl = logoUrlOverride ?? existing.logo.img_url;
      if (!imgUrl) return;
      // Sirf isi store ki (ya purani shared uploads/store) file — pehle absolute
      // path bhi maana jata tha (img_url se koi bhi server file mit sakti thi)
      const filePath = require("./uploadPaths").localPathForUrl(null, imgUrl);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (e) { log.error("❌ deleteOldLogo error:", e.message); }
};

const getDefaultPermissions = () => {
  try {
    const User = require("../models/User");
    const schema = User.schema.path("permissions");
    if (schema && schema.defaultValue) {
      return typeof schema.defaultValue === "function" ? schema.defaultValue() : { ...schema.defaultValue };
    }
  } catch (e) {}
  return {
    employees: true, products: true, featuredProducts: true, reviews: true, brands: true, categories: true,
    profile: true, store: true, discounts: true, deals: true, bundles: true, banners: true,
    manageStock: true, shipping: true, order: true, attribute: true, vendors: true, purchaseOrders: true, quotes: true,
    customers: true, pos: true, invoices: true, finance: false
  };
};

const fixPermissions = (oldPerms) => {
  const defaults = getDefaultPermissions();
  return {
    employees: oldPerms?.employees ?? defaults.employees,
    products: oldPerms?.products ?? defaults.products,
    featuredProducts: oldPerms?.featuredProducts ?? oldPerms?.products ?? defaults.featuredProducts,
    reviews: oldPerms?.reviews ?? oldPerms?.products ?? defaults.reviews,
    brands: oldPerms?.brands ?? defaults.brands,
    categories: oldPerms?.categories ?? defaults.categories,
    profile: oldPerms?.profile ?? defaults.profile,
    store: oldPerms?.store ?? defaults.store,
    discounts: oldPerms?.discounts ?? defaults.discounts,
    deals: oldPerms?.deals ?? defaults.deals,
    bundles: oldPerms?.bundles ?? defaults.bundles,
    banners: oldPerms?.banners ?? defaults.banners,
    manageStock: oldPerms?.manageStock ?? defaults.manageStock,
    shipping: oldPerms?.shipping ?? defaults.shipping,
    order: oldPerms?.order ?? defaults.order,
    attribute: oldPerms?.attribute ?? defaults.attribute,
    vendors: oldPerms?.vendors ?? defaults.vendors,
    purchaseOrders: oldPerms?.purchaseOrders ?? defaults.purchaseOrders,
    customers: oldPerms?.customers ?? defaults.customers,
    quotes: oldPerms?.quotes ?? defaults.quotes,
    invoices: oldPerms?.invoices ?? defaults.invoices,
    finance: oldPerms?.finance ?? defaults.finance,
    pos: oldPerms?.pos ?? defaults.pos,
  };
};

const needsPermissionMigration = (perms) => {
  if (!perms) return true;
  const deprecatedKeys = ["users", "orders", "settings", "dashboard"];
  if (deprecatedKeys.some((k) => perms[k] !== undefined)) return true;
  const requiredKeys = Object.keys(getDefaultPermissions());
  return requiredKeys.some((key) => typeof perms[key] !== "boolean");
};

// ==========================================
// SOCKET INITIALIZATION
// ==========================================
const initSocket = (server) => {
  const { Server } = require("socket.io");

  const uploadDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storeUploadDir = path.join(uploadDir, "store");
  if (!fs.existsSync(storeUploadDir)) fs.mkdirSync(storeUploadDir, { recursive: true });

  const allowedOriginsEnv = [process.env.ALLOWED_ORIGINS, process.env.CLIENT_URL]
    .filter(Boolean)
    .join(",");
  const allowedOrigins = allowedOriginsEnv.split(",").map(u => u.trim()).filter(Boolean);

  io = createTenantIO(new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(origin)) {
          return callback(null, true);
        }
        // Multi-tenant: *.<ROOT_DOMAIN> store subdomains + registered custom domains
        let originHost;
        try { originHost = new URL(origin).hostname; } catch { return callback(new Error("CORS not allowed")); }
        if (isPlatformFamilyHost(originHost)) return callback(null, true);
        resolveStoreByHost(originHost)
          .then(({ store }) => (store ? callback(null, true) : callback(new Error("CORS not allowed"))))
          .catch(() => callback(new Error("CORS not allowed")));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    },
    maxHttpBufferSize: parseInt(process.env.SOCKET_MAX_BUFFER_MB, 10) * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["polling", "websocket"],
  }));

  // ==========================================
  // TENANT RESOLUTION — handshake Host se store
  // (socket bhi page ke hostname par connect hota hai: alistore.<root>:5000)
  // ==========================================
  io.use(async (socket, next) => {
    try {
      const { tenant, store } = await resolveStoreByHost(socket.handshake.headers.host);
      if (tenant.type !== "platform" && !store) return next(new Error("Store not found"));
      socket.tenantStoreId = store ? String(store._id) : null;
      return next();
    } catch (error) {
      return next(error);
    }
  });

  // ==========================================
  // ✅ GUEST-FRIENDLY AUTH MIDDLEWARE (store-bound)
  // Connection pe sab ko allow, token optional. Identity DB se isi store ke
  // context me load hoti hai (utils/socketAuth.js) — dusre store ka token,
  // deleted/blocked account ya platform host → guest.
  // ==========================================
  const { resolveSocketIdentity } = require("./socketAuth");
  io.use(async (socket, next) => {
    try {
      const identity = await resolveSocketIdentity({
        cookieHeader: socket.handshake.headers.cookie,
        tenantStoreId: socket.tenantStoreId,
        // Client batata hai kaun sa session: admin panel "admin", storefront "user"
        aud: socket.handshake.auth?.aud,
      });
      Object.assign(socket, identity);
    } catch (error) {
      Object.assign(socket, {
        userId: null, userType: "guest", userRole: "guest", userName: "Guest",
        userPermissions: {}, storeId: null, sellerPending: false, sessionId: null, needsRefresh: null,
      });
    }
    return next();
  });

  // ==========================================
  // ✅ ROLE GUARD HELPER — har event mein use hoga
  // ==========================================
  const requireAuth = (socket, callback) => {
    if (socket.userRole === "guest") {
      const err = { success: false, message: "Please login first" };
      if (typeof callback === "function") callback(err);
      return false;
    }
    return true;
  };

  const SELLER_PENDING_ERR = {
    success: false,
    code: "SELLER_PENDING",
    message: "Your seller application is pending Super Admin approval. Changes are locked until it is approved.",
  };

  const requireRole = (socket, allowedRoles, callback) => {
    if (socket.sellerPending) {
      if (typeof callback === "function") callback(SELLER_PENDING_ERR);
      return false;
    }
    // "admin" = koi bhi full-access role (owner "storehandler" + admin — utils/roles.js)
    const allowed =
      allowedRoles.includes(socket.userRole) || (allowedRoles.includes("admin") && isAdminRole(socket.userRole));
    if (!allowed) {
      const err = { success: false, message: "Unauthorized — admin/employee access only" };
      if (typeof callback === "function") callback(err);
      return false;
    }
    return true;
  };

  // ==========================================
  // ✅ PERMISSION GUARD (fresh DB permissions)
  // JWT me permissions stale/missing ho sakte hain — is liye
  // DB se fresh permissions load karke check karo.
  // - admin: hamesha allow
  // - staff/manager: permission key par allow
  // - strict (store jaisi sensitive cheez): sirf === true par allow
  // - non-strict (REST checkPermission jaisa): sirf === false par deny
  // - NOTE: khud ki permission change karna updateEmployee me alag se blocked hai
  // ==========================================

  const requireSocketPermission = async (socket, permissionKey, callback, opts = {}) => {
    const role = String(socket.userRole || "guest").toLowerCase();
    if (!STAFF_ROLES.includes(role)) {
      const err = { success: false, message: "Unauthorized — admin/employee access only" };
      if (typeof callback === "function") callback(err);
      return { allowed: false };
    }
    if (socket.sellerPending) {
      if (typeof callback === "function") callback(SELLER_PENDING_ERR);
      return { allowed: false };
    }
    try {
      // Har event par DB se fresh (isi store ke context me — tenantScope).
      // Admin bhi: connect ke baad demote / deactivate ho to foran asar.
      const Model = socket.userType === "employee"
        ? require("../models/Employee")
        : require("../models/User");
      const doc = await Model.findById(socket.userId).select("name role permissions status is_deleted").lean();
      if (!doc || doc.is_deleted || doc.status === "inactive" || doc.status === "blocked") {
        const err = { success: false, message: "User not found" };
        if (typeof callback === "function") callback(err);
        return { allowed: false };
      }
      const freshRole = String(doc.role || "").toLowerCase();
      if (!STAFF_ROLES.includes(freshRole)) {
        const err = { success: false, message: "Unauthorized — admin/employee access only" };
        if (typeof callback === "function") callback(err);
        return { allowed: false };
      }
      if (isAdminRole(freshRole)) {
        return { allowed: true, permissions: doc.permissions || {}, name: doc.name || socket.userName };
      }
      const perms = doc.permissions || {};
      const ok = opts.strict
        ? perms[permissionKey] === true
        : perms[permissionKey] !== false;
      if (!ok) {
        const err = {
          success: false,
          message: `Access denied. You don't have '${permissionKey}' permission. Please contact an administrator or another staff member to grant you access.`,
        };
        if (typeof callback === "function") callback(err);
        return { allowed: false };
      }
      return { allowed: true, permissions: perms, name: doc.name || socket.userName };
    } catch (e) {
      const err = { success: false, message: "Permission check failed" };
      if (typeof callback === "function") callback(err);
      return { allowed: false };
    }
  };

  // Fresh-permission wala req (controllers dobara check karte hain)
  function createPermittedReq(socket, gate, body = {}, params = {}) {
    return {
      user: {
        _id: socket.userId,
        id: socket.userId,
        role: socket.userRole,
        name: gate.name || socket.userName,
        permissions: gate.permissions || {},
      },
      storeId: socket.storeId,
      body, params, io, socket,
    };
  }

  function createReq(socket, body = {}, params = {}) {
    return {
      user: {
        _id: socket.userId,
        id: socket.userId,
        role: socket.userRole,
        name: socket.userName,
        permissions: socket.userPermissions || {},
      },
      storeId: socket.storeId,
      body, params, io, socket,
    };
  }

  function createRes(socket, eventName, callback) {
    return {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(data) {
        if (typeof callback === "function") callback(data);
        else socket.emit(eventName, data);
      },
    };
  }

  // Aakhri middleware: connection handler isi store ke context me chale
  io.use((socket, next) => runWithStore(socket.tenantStoreId, next));

  // ==========================================
  // CONNECTION HANDLER
  // ==========================================
  io.on("connection", (socket) => {
    // Har event handler bhi isi store ke context me (tenantScope plugin queries scope karta hai)
    socket.use((packet, next) => runWithStore(socket.tenantStoreId, next));
    if (socket.tenantStoreId) socket.join(storeRoom(socket.tenantStoreId));
    // Access token expire tha (session marker maujood) → client refresh + reconnect kare
    if (socket.needsRefresh) socket.emit("auth:refresh-needed", { aud: socket.needsRefresh });

    if (socket.userId) socket.join(`employee:${socket.userId}`);
    if (socket.userId && socket.userType === "user" && String(socket.userRole || "").toLowerCase() === "user") {
      socket.join(`chat:customer:${socket.userId}`);
    }

    // Chat rooms are always joined through authenticated, server-side authorization.
    socket.on("chat:inbox:join", async (callback) => {
      if (socket.userType !== "employee" || !STAFF_ROLES.includes(String(socket.userRole || "").toLowerCase())) {
        if (typeof callback === "function") callback({ success: false, message: "Support access required" });
        return;
      }
      const gate = await requireSocketPermission(socket, "order", callback);
      if (!gate.allowed) return;
      socket.join(socket.tenantStoreId ? `chat:admins:${socket.tenantStoreId}` : "chat:admins");
      try {
        const ChatConversation = require("../models/ChatConversation");
        const [row] = await ChatConversation.aggregate([{ $group: { _id: null, total: { $sum: "$unread_admin_count" } } }]);
        if (typeof callback === "function") callback({ success: true, data: { count: Number(row?.total) || 0 } });
      } catch (error) {
        if (typeof callback === "function") callback({ success: false, message: "Could not load unread count" });
      }
    });

    socket.on("chat:conversation:join", async (payload, callback) => {
      const id = typeof payload === "string" ? payload : payload?.conversationId;
      const mongoose = require("mongoose");
      if (!socket.userId || !mongoose.isValidObjectId(id)) {
        if (typeof callback === "function") callback({ success: false, message: "Invalid conversation" });
        return;
      }
      try {
        const ChatConversation = require("../models/ChatConversation");
        const conversation = await ChatConversation.findById(id).select("customer_id").lean();
        if (!conversation) {
          if (typeof callback === "function") callback({ success: false, message: "Conversation not found" });
          return;
        }
        let allowed = socket.userType === "user" && String(conversation.customer_id) === String(socket.userId);
        if (socket.userType === "employee" && STAFF_ROLES.includes(String(socket.userRole || "").toLowerCase())) {
          const gate = await requireSocketPermission(socket, "order", callback);
          allowed = gate.allowed;
        }
        if (!allowed) {
          if (typeof callback === "function") callback({ success: false, message: "You are not allowed to access this conversation" });
          return;
        }
        socket.join(`chat:conversation:${id}`);
        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        if (typeof callback === "function") callback({ success: false, message: "Could not join conversation" });
      }
    });

    socket.on("chat:guest:join", async (payload, callback) => {
      const id = payload?.conversationId;
      const token = typeof payload?.guestToken === "string" ? payload.guestToken.trim() : "";
      const mongoose = require("mongoose");
      if (!token || !mongoose.isValidObjectId(id)) {
        if (typeof callback === "function") callback({ success: false, message: "Guest chat authorization required" });
        return;
      }
      try {
        const ChatConversation = require("../models/ChatConversation");
        const conversation = await ChatConversation.findById(id).select("+guest_token_hash").lean();
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        if (!conversation?.guest_token_hash || conversation.guest_token_hash !== tokenHash) {
          if (typeof callback === "function") callback({ success: false, message: "Guest chat access denied" });
          return;
        }
        socket.join(`chat:conversation:${id}`);
        socket.join(`chat:guest:${tokenHash}`);
        if (typeof callback === "function") callback({ success: true });
      } catch (error) {
        if (typeof callback === "function") callback({ success: false, message: "Could not join guest conversation" });
      }
    });

    socket.on("chat:conversation:leave", async (payload) => {
      const id = typeof payload === "string" ? payload : payload?.conversationId;
      if (typeof id === "string" && socket.rooms.has(`chat:conversation:${id}`)) socket.leave(`chat:conversation:${id}`);
    });

    socket.on("chat:typing", (payload) => {
      const id = typeof payload?.conversationId === "string" ? payload.conversationId : "";
      const room = `chat:conversation:${id}`;
      if (!id || !socket.rooms.has(room) || typeof payload?.isTyping !== "boolean") return;
      const senderType = socket.userType === "employee" ? "admin" : "customer";
      socket.to(room).emit("chat:typing", { conversation_id: id, sender_type: senderType, isTyping: payload.isTyping });
    });

    // Employee room me private events (permissionsUpdated waghera) jaate hain →
    // sirf apna room, ya admin isi store ke kisi employee ka (scoped lookup).
    socket.on("join:employee", async (employeeId) => {
      try {
        const id = String(employeeId || "");
        if (!id || socket.userType !== "employee") return;
        if (id === String(socket.userId)) return socket.join(`employee:${id}`);
        if (!isAdminRole(socket.userRole) || !require("mongoose").isValidObjectId(id)) return;
        const exists = await require("../models/Employee").exists({ _id: id });
        if (exists) socket.join(`employee:${id}`);
      } catch (e) { /* ignore */ }
    });
    socket.on("leave:employee", (employeeId) => socket.leave(`employee:${employeeId}`));

    // ========== SHIPPING EVENTS (Admin-only for write, public for read) ==========
    socket.on("getShippingConfig", async () => {
      try {
        const ShippingConfig = require("../models/ShippingConfig");
        const cfg = await ShippingConfig.getConfig();
        socket.emit("shippingConfigData", { success: true, data: cfg });
      } catch (e) { socket.emit("shippingConfigData", { success: false, message: e.message }); }
    });

    socket.on("updateShippingConfig", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { updateShippingConfig } = require("../controllers/shippingController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "shippingConfigUpdated", callback);
        await updateShippingConfig(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("getShippingRules", async () => {
      try {
        const { getShippingRules } = require("../controllers/shippingController");
        const req = createReq(socket);
        const res = createRes(socket, "shippingRulesList");
        await getShippingRules(req, res);
      } catch (e) { socket.emit("shippingRulesList", { success: false, message: e.message }); }
    });

    socket.on("createShippingRule", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { createShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "shippingRuleCreated", callback);
        await createShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("updateShippingRule", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { updateShippingRule } = require("../controllers/shippingController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "shippingRuleUpdated", callback);
        await updateShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("deleteShippingRule", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { deleteShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "shippingRuleDeleted", callback);
        await deleteShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("toggleShippingRule", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { toggleShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "shippingRuleToggled", callback);
        await toggleShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    // ========== STORE EVENTS ==========
    socket.on("getStoreInfo", async () => {
      // ✅ PUBLIC — sab ko allow (guest + logged-in)
      try {
        const { getStoreInfo } = require("../controllers/storeController");
        const req = { user: { id: socket.userId, role: socket.userRole } };
        const res = {
          status: () => ({ json: (d) => socket.emit("storeInfo", d) }),
          json: (d) => socket.emit("storeInfo", d)
        };
        await getStoreInfo(req, res);
      } catch (e) { socket.emit("storeInfo", { success: false, message: e.message }); }
    });

    socket.on("updateStoreInfo", async (payload, callback) => {
      // ✅ Jis staff ko 'store' permission hai woh update kar sakta hai (sirf admin nahi)
      const gate = await requireSocketPermission(socket, "store", callback, { strict: true });
      if (!gate.allowed) return;
      try {
        const { updateStoreInfo } = require("../controllers/storeController");
        const Store = require("../models/Store");
        const existingStore = await Store.findOne().select("logo.img_url").lean();
        const previousLogoUrl = existingStore?.logo?.img_url || "";
        let logoFile = null;
        if (payload?.logoBase64) {
          try {
            logoFile = await compressAndSaveLogo(payload.logoBase64, payload.logoFileName);
            if (!logoFile) throw new Error("Logo processing returned no file");
          } catch (e) {
            log.error("❌ Logo processing error:", e.message);
            if (callback) callback({ success: false, message: `Logo upload failed: ${e.message}` });
            return;
          }
        }
        const { logoBase64, logoFileName, logoMimeType, ...bodyData } = payload || {};
        const req = {
          user: { _id: socket.userId, id: socket.userId, role: socket.userRole, name: gate.name || socket.userName, permissions: gate.permissions || {} },
          body: bodyData, file: logoFile, io
        };
        let updateResponse = null;
        const respond = (data) => {
          updateResponse = data;
          if (callback) callback(data);
          if (data?.success) { io.emit("storeUpdated", data.data); io.emit("storeInfoChangedForProfile", data.data); }
        };
        const res = {
          status: () => ({ json: respond }),
          json: respond,
        };
        await updateStoreInfo(req, res);
        if (updateResponse?.success && logoFile && previousLogoUrl && previousLogoUrl !== logoFile.relativePath) {
          await deleteOldLogo(previousLogoUrl);
        }
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("deleteStoreLogo", async (_, callback) => {
      // ✅ 'store' permission wala staff bhi logo hata sakta hai
      const gate = await requireSocketPermission(socket, "store", callback, { strict: true });
      if (!gate.allowed) return;
      try {
        await deleteOldLogo();
        const Store = require("../models/Store");
        let store = await Store.findOne();
        if (store) {
          store.logo = { img_url: "", public_id: "" };
          await store.save();
          const plain = store.toObject();
          if (callback) callback({ success: true, data: plain });
          io.emit("storeUpdated", plain);
        }
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    // ========== PROFILE EVENTS (Auth required) ==========
    socket.on("getProfile", async () => {
      if (!requireAuth(socket)) return socket.emit("profileData", { success: false, message: "Please login" });
      try {
        const Model = socket.userType === 'employee' ? require("../models/Employee") : require("../models/User");
        const user = await Model.findById(socket.userId).select("-password").populate("storeId");
        if (!user) return socket.emit("profileData", { success: false, message: "User not found" });

        let permissions = user.permissions || {};
        if (needsPermissionMigration(permissions)) {
          permissions = fixPermissions(permissions);
          await Model.findByIdAndUpdate(socket.userId, { permissions });
        }
        // ✅ Employee ka storeId null ho to default store fallback lo
        // taake profile me store name / address kabhi blank na ho
        let store = user.storeId && user.storeId.store_name ? user.storeId : null;
        if (!store) {
          try {
            const Store = require("../models/Store");
            store = (user.storeId && user.storeId._id)
              ? await Store.findById(user.storeId._id || user.storeId).lean()
              : await Store.findOne().lean();
          } catch (e) { store = user.storeId || {}; }
          if (!store) store = {};
        }
        const profileData = {
          _id: user._id, name: user.name, username: user.username || "",
          email: user.email || store.email || "", phone: user.phone || store.phone || "",
          role: user.role, status: user.status || (user.is_deleted ? "Inactive" : "Active"),
          avatar: user.avatar || null, created_at: user.created_at || user.createdAt,
          address: user.address || store.address || "",
          permissions, preferences: user.preferences || {}, store,
          store_name: store.store_name || "",
          stats: { logins: user.loginCount || 0, roles: 1, sessions: user.sessionCount || 0 },
        };
        socket.emit("profileData", { success: true, data: profileData, user: profileData });
      } catch (e) {
        log.error("❌ Socket getProfile error:", e.message);
        socket.emit("profileData", { success: false, message: e.message });
      }
    });

    socket.on("updateProfile", async (payload, callback) => {
      if (!requireAuth(socket, callback)) return;
      // REST jaisa: pending seller sirf dekh sakta hai, badal nahi sakta
      if (socket.sellerPending) { if (typeof callback === "function") callback(SELLER_PENDING_ERR); return; }
      try {
        const { updateProfileInfo } = require("../controllers/userController");
        const req = {
          user: { _id: socket.userId, id: socket.userId, role: socket.userRole, name: socket.userName, permissions: socket.userPermissions || {} },
          userType: socket.userType || 'user',
          body: payload, io
        };
        const res = {
          status: (c) => ({ json: (d) => { if (callback) callback(d); if (d?.success) { io.emit("profileUpdated", d); if (d.store) io.emit("storeUpdated", d.store); } } }),
          json: (d) => { if (callback) callback(d); if (d?.success) { io.emit("profileUpdated", d); if (d.store) io.emit("storeUpdated", d.store); } },
        };
        await updateProfileInfo(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("changePassword", async (payload, callback) => {
      if (!requireAuth(socket, callback)) return;
      // REST jaisa: pending seller sirf dekh sakta hai, badal nahi sakta
      if (socket.sellerPending) { if (typeof callback === "function") callback(SELLER_PENDING_ERR); return; }
      try {
        const { changePasswordSocket } = require("../controllers/userController");
        const req = {
          user: { _id: socket.userId, id: socket.userId, role: socket.userRole, name: socket.userName, permissions: socket.userPermissions || {} },
          userType: socket.userType || 'user',
          // Password badalne par baaki sessions revoke — ye wala (current) bacha rahe
          sessionId: socket.sessionId || null,
          body: payload, io
        };
        const res = { status: () => ({ json: (d) => { if (callback) callback(d); } }), json: (d) => { if (callback) callback(d); } };
        await changePasswordSocket(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    // ========== EMPLOYEE EVENTS (Admin-only) ==========
    socket.on("getEmployees", async () => {
      if (!requireRole(socket, ["admin", "employee"])) {
        return socket.emit("employeesList", { success: false, message: "Unauthorized" });
      }
      try {
        const { getAllEmployees } = require("../controllers/employeeController");
        const req = createReq(socket);
        const res = createRes(socket, "employeesList");
        await getAllEmployees(req, res);
      } catch (e) { socket.emit("employeesList", { success: false, message: e.message }); }
    });

    socket.on("getEmployeeById", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { getEmployeeById } = require("../controllers/employeeController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "employeeDetails", callback);
        await getEmployeeById(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeDetails", { success: false, message: e.message });
      }
    });

    socket.on("createEmployee", async (payload, callback) => {
      // ✅ Jis staff ko 'employees' permission hai woh add kar sakta hai (sirf admin nahi)
      const gate = await requireSocketPermission(socket, "employees", callback);
      if (!gate.allowed) return;
      try {
        const { createEmployee } = require("../controllers/employeeController");
        const { avatarBase64, avatarFileName, ...data } = payload || {};
        // Avatar drag & drop se aayi base64 image ko optimize kar ke store karo
        if (avatarBase64) {
          try {
            data.avatar = await processEmployeeAvatar(avatarBase64);
          } catch (e) {
            if (callback) callback({ success: false, message: `Profile picture: ${e.message}` });
            return;
          }
        }
        const req = createPermittedReq(socket, gate, data);
        const res = createRes(socket, "employeeCreated", callback);
        await createEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeCreated", { success: false, message: e.message });
      }
    });

    socket.on("updateEmployee", async (payload, callback) => {
      // ✅ 'employees' permission wala staff update kar sakta hai;
      // khud ki permission change karna controller me blocked hai
      const gate = await requireSocketPermission(socket, "employees", callback);
      if (!gate.allowed) return;
      try {
        const { updateEmployee } = require("../controllers/employeeController");
        const { id, avatarBase64, avatarFileName, ...data } = payload || {};
        if (avatarBase64) {
          try {
            data.avatar = await processEmployeeAvatar(avatarBase64);
          } catch (e) {
            if (callback) callback({ success: false, message: `Profile picture: ${e.message}` });
            return;
          }
        }
        const req = createPermittedReq(socket, gate, data, { id });
        const res = createRes(socket, "employeeUpdated", callback);
        await updateEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteEmployee", async ({ id }, callback) => {
      // ✅ 'employees' permission wala staff delete kar sakta hai
      const gate = await requireSocketPermission(socket, "employees", callback);
      if (!gate.allowed) return;
      try {
        const { deleteEmployee } = require("../controllers/employeeController");
        const req = createPermittedReq(socket, gate, {}, { id });
        const res = createRes(socket, "employeeDeleted", callback);
        await deleteEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeDeleted", { success: false, message: e.message });
      }
    });

    socket.on("toggleEmployeeStatus", async ({ id }, callback) => {
      // ✅ 'employees' permission wala staff status toggle kar sakta hai
      const gate = await requireSocketPermission(socket, "employees", callback);
      if (!gate.allowed) return;
      try {
        const { toggleStatus } = require("../controllers/employeeController");
        const req = createPermittedReq(socket, gate, {}, { id });
        const res = createRes(socket, "employeeStatusToggled", callback);
        await toggleStatus(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeStatusToggled", { success: false, message: e.message });
      }
    });

    // ========== PRODUCT EVENTS (PUBLIC read) ==========
    socket.on("getProducts", async () => {
      try {
        const Product = require("../models/Product");
        const products = await Product.find({ is_deleted: false, status: "active" })
          .select("name variants").lean();
        socket.emit("productsList", products);
      } catch (e) {
        log.error("❌ Socket getProducts error:", e.message);
        socket.emit("productsList", []);
      }
    });

    // ========== DISCOUNT EVENTS ==========
    socket.on("getDiscounts", async () => {
      try {
        const { getAllDiscounts } = require("../controllers/discountController");
        const req = createReq(socket);
        const res = createRes(socket, "discountsList");
        await getAllDiscounts(req, res);
      } catch (e) { socket.emit("discountsList", { success: false, message: e.message }); }
    });

    socket.on("createDiscount", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { createDiscount } = require("../controllers/discountController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "discountCreated", callback);
        await createDiscount(req, res);
        io.emit("discount:activity", {
          action: "created", discountId: req.body?.id || null,
          user: { _id: socket.userId, name: socket.userName, role: socket.userRole },
          timestamp: new Date(),
        });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountCreated", { success: false, message: e.message });
      }
    });

    socket.on("updateDiscount", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { updateDiscount } = require("../controllers/discountController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "discountUpdated", callback);
        await updateDiscount(req, res);
        io.emit("discount:activity", {
          action: "updated", discountId: id,
          user: { _id: socket.userId, name: socket.userName, role: socket.userRole },
          timestamp: new Date(),
        });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteDiscount", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { deleteDiscount } = require("../controllers/discountController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "discountDeleted", callback);
        await deleteDiscount(req, res);
        io.emit("discount:activity", {
          action: "deleted", discountId: id,
          user: { _id: socket.userId, name: socket.userName, role: socket.userRole },
          timestamp: new Date(),
        });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountDeleted", { success: false, message: e.message });
      }
    });

    // ========== DEALS EVENTS ==========
    socket.on("getDeals", async () => {
      try {
        const { getAllDeals } = require("../controllers/dealController");
        const req = createReq(socket);
        const res = createRes(socket, "dealsList");
        await getAllDeals(req, res);
      } catch (e) { socket.emit("dealsList", { success: false, message: e.message }); }
    });

    socket.on("createDeal", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { createDeal } = require("../controllers/dealController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "dealCreated", callback);
        await createDeal(req, res);
        io.emit("deal:created");
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealCreated", { success: false, message: e.message });
      }
    });

    socket.on("updateDeal", async (payload, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { updateDeal } = require("../controllers/dealController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "dealUpdated", callback);
        await updateDeal(req, res);
        io.emit("deal:updated", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteDeal", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { deleteDeal } = require("../controllers/dealController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "dealDeleted", callback);
        await deleteDeal(req, res);
        io.emit("deal:deleted", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealDeleted", { success: false, message: e.message });
      }
    });

    socket.on("toggleDealStatus", async ({ id }, callback) => {
      if (!requireRole(socket, ["admin", "employee"], callback)) return;
      try {
        const { toggleDealStatus } = require("../controllers/dealController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "dealStatusToggled", callback);
        await toggleDealStatus(req, res);
        io.emit("deal:updated", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealStatusToggled", { success: false, message: e.message });
      }
    });

    // ========== RELAY EVENTS ==========
    socket.on("productCreated", (p) => relayToStore(socket).emit("productCreated", p));
    socket.on("productUpdated", (p) => relayToStore(socket).emit("productUpdated", p));
    socket.on("productDeleted", (id) => relayToStore(socket).emit("productDeleted", id));
    socket.on("employeeRelayCreated", (d) => relayToStore(socket).emit("employeeCreated", { success: true, data: d }));
    socket.on("employeeRelayUpdated", (d) => relayToStore(socket).emit("employeeUpdated", { success: true, data: d }));
    socket.on("employeeRelayDeleted", (id) => relayToStore(socket).emit("employeeDeleted", { success: true, data: { id } }));
    socket.on("employeeRelayStatusToggled", (d) => relayToStore(socket).emit("employeeStatusToggled", { success: true, data: d }));

    socket.on("disconnect", (reason) => {});
  });

  return io;
};

/** socket.broadcast ka store-safe version: sirf usi store ke baaki sockets */
function relayToStore(socket) {
  return socket.tenantStoreId ? socket.to(storeRoom(socket.tenantStoreId)) : socket.broadcast;
}

const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized! Call initSocket(server) first.");
  return io;
};

module.exports = { initSocket, getIO, compressAndSaveLogo, processEmployeeAvatar };
