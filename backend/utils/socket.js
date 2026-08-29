const path = require("path");
const fs = require("fs");

// Lazy imports to avoid circular dependency warnings
let io = null;

const compressAndSaveLogo = async (base64Data, fileName) => {
  if (!base64Data || typeof base64Data !== "string") return null;
  const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!mimeMatch) throw new Error("Invalid base64 image format");
  
  const mimeType = mimeMatch[1];
  const rawBuffer = Buffer.from(mimeMatch[2], "base64");
  if (rawBuffer.length > 8 * 1024 * 1024) throw new Error("Image too large (max 8MB)");

  const storeDir = path.join(__dirname, "../uploads/store");
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  
  const safeName = (fileName || "logo")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-]/g, "")
    .replace(/\.[^.]+$/, "");

  if (mimeType.includes("svg")) {
    const finalName = `store-logo-${Date.now()}-${safeName}.svg`;
    const filePath = path.join(storeDir, finalName);
    fs.writeFileSync(filePath, rawBuffer);
    return { 
      path: filePath, 
      filename: finalName, 
      mimetype: mimeType, 
      size: rawBuffer.length, 
      relativePath: `uploads/store/${finalName}` 
    };
  }

  const finalName = `store-logo-${Date.now()}-${safeName}.jpg`;
  const filePath = path.join(storeDir, finalName);
  
  try {
    const sharp = require("sharp");
    await sharp(rawBuffer)
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .rotate()
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toFile(filePath);
    
    const savedSize = fs.statSync(filePath).size;
    return { 
      path: filePath, 
      filename: finalName, 
      mimetype: "image/jpeg", 
      size: savedSize, 
      relativePath: `uploads/store/${finalName}` 
    };
  } catch (err) {
    const fallbackName = `store-logo-${Date.now()}-${safeName}-raw.jpg`;
    const fallbackPath = path.join(storeDir, fallbackName);
    fs.writeFileSync(fallbackPath, rawBuffer);
    return { 
      path: fallbackPath, 
      filename: fallbackName, 
      mimetype: mimeType, 
      size: rawBuffer.length, 
      relativePath: `uploads/store/${fallbackName}` 
    };
  }
};

const deleteOldLogo = async () => {
  try {
    const Store = require("../models/Store");
    const existing = await Store.findOne();
    if (existing?.logo?.img_url) {
      const imgUrl = existing.logo.img_url;
      const possiblePaths = [
        path.join(__dirname, "..", imgUrl),
        path.join(__dirname, "..", "uploads", imgUrl.replace(/^uploads\//, "")),
        imgUrl.startsWith("/") ? imgUrl : null,
      ].filter(Boolean);
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) { 
          fs.unlinkSync(p); 
          break; 
        }
      }
    }
  } catch (e) {
    console.error("️ deleteOldLogo error:", e.message);
  }
};

// ✅ Permission helpers - FIXED: Added 'deals' and 'banners' permissions
const fixPermissions = (oldPerms) => ({
  employees: oldPerms?.employees ?? true,
  products: oldPerms?.products ?? true,
  brands: oldPerms?.brands ?? true,
  categories: oldPerms?.categories ?? true,
  profile: oldPerms?.profile ?? true,
  store: oldPerms?.store ?? false,
  discounts: oldPerms?.discounts ?? true,
  deals: oldPerms?.deals ?? true,
  banners: oldPerms?.banners ?? true,
});

const needsPermissionMigration = (perms) => {
  if (!perms) return true;
  if (["users", "orders", "settings", "dashboard"].some((k) => perms[k] !== undefined)) return true;
  const requiredKeys = ["employees", "products", "brands", "categories", "profile", "store", "discounts", "deals", "banners"];
  return requiredKeys.some((key) => typeof perms[key] !== "boolean");
};

// ✅ Socket initialization
const initSocket = (server) => {
  const { Server } = require("socket.io");
  const jwt = require("jsonwebtoken");

  // Ensure upload directories exist
  const uploadDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const storeUploadDir = path.join(uploadDir, "store");
  if (!fs.existsSync(storeUploadDir)) fs.mkdirSync(storeUploadDir, { recursive: true });

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          process.env.CLIENT_URL,
        ].filter(Boolean);
        
        if (allowed.includes(origin)) return callback(null, true);
        if (/^http:\/\/192\.168\.\d+\.\d+:3000$/.test(origin)) return callback(null, true);
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
        
        callback(new Error("CORS not allowed"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    },
    maxHttpBufferSize: 15 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["polling", "websocket"],
  });

  console.log(" Socket.IO ready | maxBuffer: 15MB | transports: polling → websocket");

  // ✅ Auth middleware for socket connections
  io.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie;
    
    if (!rawCookie) {
      socket.userId = "guest";
      socket.userRole = "admin";
      socket.userName = "Guest";
      socket.userPermissions = {};
      return next();
    }

    const cookies = Object.fromEntries(
      rawCookie.split("; ").map((c) => {
        const [k, ...v] = c.split("=");
        return [k.trim(), v.join("=")];
      })
    );
    
    const token = cookies.accessToken || cookies.auth_token || cookies.access_token;
    
    if (!token) {
      socket.userId = "guest";
      socket.userRole = "admin";
      socket.userName = "Guest";
      socket.userPermissions = {};
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id;
      socket.userRole = (decoded.role || "admin").toLowerCase();
      socket.storeId = decoded.storeId || null;
      socket.userName = decoded.name || "User";
      socket.userPermissions = decoded.permissions || {};
      next();
    } catch (error) {
      socket.userId = "guest";
      socket.userRole = "admin";
      socket.userName = "Guest";
      socket.storeId = null;
      socket.userPermissions = {};
      next();
    }
  });

  // ✅ Helper functions
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
      body,
      params,
      io,
      socket,
    };
  }

  function createRes(socket, eventName, callback) {
    return {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (typeof callback === "function") callback(data);
        else socket.emit(eventName, data);
      },
    };
  }

  // ✅ Connection handler
  io.on("connection", (socket) => {
    console.log(`🟢 Connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

    // Auto-join user's personal room
    if (socket.userId && socket.userId !== "guest") {
      socket.join(`employee:${socket.userId}`);
    }

    socket.on("join:employee", (employeeId) => {
      socket.join(`employee:${employeeId}`);
    });

    socket.on("leave:employee", (employeeId) => {
      socket.leave(`employee:${employeeId}`);
    });

        // ========== SHIPPING EVENTS ==========
    socket.on("getShippingConfig", async () => {
      try {
        const ShippingConfig = require("../models/ShippingConfig");
        const cfg = await ShippingConfig.getConfig();
        socket.emit("shippingConfigData", { success: true, data: cfg });
      } catch (e) { socket.emit("shippingConfigData", { success: false, message: e.message }); }
    });

    socket.on("updateShippingConfig", async (payload, callback) => {
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
      try {
        const { createShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "shippingRuleCreated", callback);
        await createShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("updateShippingRule", async (payload, callback) => {
      try {
        const { updateShippingRule } = require("../controllers/shippingController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "shippingRuleUpdated", callback);
        await updateShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("deleteShippingRule", async ({ id }, callback) => {
      try {
        const { deleteShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "shippingRuleDeleted", callback);
        await deleteShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });

    socket.on("toggleShippingRule", async ({ id }, callback) => {
      try {
        const { toggleShippingRule } = require("../controllers/shippingController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "shippingRuleToggled", callback);
        await toggleShippingRule(req, res);
      } catch (e) { if (callback) callback({ success: false, message: e.message }); }
    });
    // ========== STORE EVENTS ==========
    socket.on("getStoreInfo", async () => {
      try {
        const { getStoreInfo } = require("../controllers/storeController");
        const req = { user: { id: socket.userId, role: socket.userRole } };
        const res = { 
          status: () => ({ json: (d) => socket.emit("storeInfo", d) }), 
          json: (d) => socket.emit("storeInfo", d) 
        };
        await getStoreInfo(req, res);
      } catch (e) { 
        socket.emit("storeInfo", { success: false, message: e.message }); 
      }
    });

    socket.on("updateStoreInfo", async (payload, callback) => {
      try {
        const { updateStoreInfo } = require("../controllers/storeController");
        let logoFile = null;
        
        if (payload?.logoBase64) {
          try { 
            await deleteOldLogo(); 
            logoFile = await compressAndSaveLogo(payload.logoBase64, payload.logoFileName); 
          } catch (e) {
            console.error("️ Logo processing error:", e.message);
          }
        }
        
        const { logoBase64, logoFileName, logoMimeType, ...bodyData } = payload || {};
        const req = { 
          user: { 
            _id: socket.userId, 
            id: socket.userId, 
            role: socket.userRole, 
            name: socket.userName, 
            permissions: socket.userPermissions || {} 
          }, 
          body: bodyData, 
          file: logoFile, 
          io 
        };
        const res = {
          status: (c) => ({ 
            json: (d) => { 
              if (callback) callback(d); 
              if (d?.success) { 
                io.emit("storeUpdated", d.data); 
                io.emit("storeInfoChangedForProfile", d.data); 
              } 
            } 
          }),
          json: (d) => { 
            if (callback) callback(d); 
            if (d?.success) { 
              io.emit("storeUpdated", d.data); 
              io.emit("storeInfoChangedForProfile", d.data); 
            } 
          },
        };
        await updateStoreInfo(req, res);
      } catch (e) { 
        if (callback) callback({ success: false, message: e.message }); 
      }
    });

    socket.on("deleteStoreLogo", async (_, callback) => {
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
      } catch (e) { 
        if (callback) callback({ success: false, message: e.message }); 
      }
    });

    // ========== PROFILE EVENTS ==========
    socket.on("getProfile", async () => {
      try {
        const User = require("../models/User");
        const user = await User.findById(socket.userId).select("-password").populate("storeId");

        if (!user) {
          return socket.emit("profileData", { success: false, message: "User not found" });
        }

        let permissions = user.permissions || {};
        if (needsPermissionMigration(permissions)) {
          permissions = fixPermissions(permissions);
          await User.findByIdAndUpdate(socket.userId, { permissions });
          console.log(`✅ Auto-migrated permissions for: ${user.name}`);
        }

        const store = user.storeId || {};
        const profileData = {
          _id: user._id,
          name: user.name,
          username: user.username || "",
          email: user.email || store.email || "",
          phone: user.phone || store.phone || "",
          role: user.role,
          status: user.status || (user.is_deleted ? "Inactive" : "Active"),
          avatar: user.avatar || null,
          created_at: user.created_at || user.createdAt,
          address: user.address || store.address || "",
          twoFactorEnabled: user.twoFactorEnabled || false,
          permissions,
          preferences: user.preferences || {},
          store,
          store_name: store.store_name || "",
          primary_color: store.primary_color || "#10b981",
          stats: { logins: user.loginCount || 0, roles: 1, sessions: user.sessionCount || 0 },
        };

        socket.emit("profileData", { success: true, data: profileData, user: profileData });
      } catch (e) {
        console.error("❌ Socket getProfile error:", e.message);
        socket.emit("profileData", { success: false, message: e.message });
      }
    });

    socket.on("updateProfile", async (payload, callback) => {
      try {
        const { updateProfileInfo } = require("../controllers/userController");
        const req = { 
          user: { 
            _id: socket.userId, 
            id: socket.userId, 
            role: socket.userRole, 
            name: socket.userName, 
            permissions: socket.userPermissions || {} 
          }, 
          body: payload, 
          io 
        };
        const res = {
          status: (c) => ({ 
            json: (d) => { 
              if (callback) callback(d); 
              if (d?.success) { 
                io.emit("profileUpdated", d); 
                if (d.store) io.emit("storeUpdated", d.store); 
              } 
            } 
          }),
          json: (d) => { 
            if (callback) callback(d); 
            if (d?.success) { 
              io.emit("profileUpdated", d); 
              if (d.store) io.emit("storeUpdated", d.store); 
            } 
          },
        };
        await updateProfileInfo(req, res);
      } catch (e) { 
        if (callback) callback({ success: false, message: e.message }); 
      }
    });

    socket.on("changePassword", async (payload, callback) => {
      try {
        const { changePasswordSocket } = require("../controllers/userController");
        const req = { 
          user: { 
            _id: socket.userId, 
            id: socket.userId, 
            role: socket.userRole, 
            name: socket.userName, 
            permissions: socket.userPermissions || {} 
          }, 
          body: payload, 
          io 
        };
        const res = { 
          status: () => ({ json: (d) => { if (callback) callback(d); } }), 
          json: (d) => { if (callback) callback(d); } 
        };
        await changePasswordSocket(req, res);
      } catch (e) { 
        if (callback) callback({ success: false, message: e.message }); 
      }
    });

    // ========== EMPLOYEE EVENTS ==========
    socket.on("getEmployees", async () => {
      try {
        const { getAllEmployees } = require("../controllers/employeeController");
        const req = createReq(socket);
        const res = createRes(socket, "employeesList");
        await getAllEmployees(req, res);
      } catch (e) { 
        socket.emit("employeesList", { success: false, message: e.message }); 
      }
    });

    socket.on("getEmployeeById", async ({ id }, callback) => {
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
      try {
        const { createEmployee } = require("../controllers/employeeController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "employeeCreated", callback);
        await createEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeCreated", { success: false, message: e.message });
      }
    });

    // ✅ FIXED: Removed duplicate permission emission here. Controller handles it now.
    socket.on("updateEmployee", async (payload, callback) => {
      try {
        const { updateEmployee } = require("../controllers/employeeController");
        const { id, ...data } = payload || {};
        
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "employeeUpdated", callback);
        
        await updateEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteEmployee", async ({ id }, callback) => {
      try {
        const { deleteEmployee } = require("../controllers/employeeController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "employeeDeleted", callback);
        await deleteEmployee(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeDeleted", { success: false, message: e.message });
      }
    });

    socket.on("toggleEmployeeStatus", async ({ id }, callback) => {
      try {
        const { toggleStatus } = require("../controllers/employeeController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "employeeStatusToggled", callback);
        await toggleStatus(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("employeeStatusToggled", { success: false, message: e.message });
      }
    });

    // ========== PRODUCT EVENTS (FOR DISCOUNT DROPDOWN) ==========
    socket.on("getProducts", async () => {
      try {
        const Product = require("../models/Product");
        const products = await Product.find({ 
          is_deleted: false, 
          status: "active" 
        })
        .select("name variants")
        .lean();
        
        socket.emit("productsList", products);
      } catch (e) {
        console.error(" Socket getProducts error:", e.message);
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
      } catch (e) { 
        socket.emit("discountsList", { success: false, message: e.message }); 
      }
    });

    socket.on("createDiscount", async (payload, callback) => {
      try {
        const { createDiscount } = require("../controllers/discountController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "discountCreated", callback);
        await createDiscount(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountCreated", { success: false, message: e.message });
      }
    });

    socket.on("updateDiscount", async (payload, callback) => {
      try {
        const { updateDiscount } = require("../controllers/discountController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "discountUpdated", callback);
        await updateDiscount(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteDiscount", async ({ id }, callback) => {
      try {
        const { deleteDiscount } = require("../controllers/discountController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "discountDeleted", callback);
        await deleteDiscount(req, res);
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("discountDeleted", { success: false, message: e.message });
      }
    });

    // ==========================================
    // ✅ DEALS EVENTS (NEWLY ADDED)
    // ==========================================
    
    socket.on("getDeals", async () => {
      try {
        const { getAllDeals } = require("../controllers/dealController");
        const req = createReq(socket);
        const res = createRes(socket, "dealsList");
        await getAllDeals(req, res);
      } catch (e) { 
        socket.emit("dealsList", { success: false, message: e.message }); 
      }
    });

    socket.on("createDeal", async (payload, callback) => {
      try {
        const { createDeal } = require("../controllers/dealController");
        const req = createReq(socket, payload);
        const res = createRes(socket, "dealCreated", callback);
        await createDeal(req, res);
        
        // ✅ Broadcast to all clients to refresh their lists immediately
        io.emit("deal:created"); 
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealCreated", { success: false, message: e.message });
      }
    });

    socket.on("updateDeal", async (payload, callback) => {
      try {
        const { updateDeal } = require("../controllers/dealController");
        const { id, ...data } = payload || {};
        const req = createReq(socket, data, { id });
        const res = createRes(socket, "dealUpdated", callback);
        await updateDeal(req, res);

        // ✅ Broadcast update event so other browsers refresh cache
        io.emit("deal:updated", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealUpdated", { success: false, message: e.message });
      }
    });

    socket.on("deleteDeal", async ({ id }, callback) => {
      try {
        const { deleteDeal } = require("../controllers/dealController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "dealDeleted", callback);
        await deleteDeal(req, res);

        // ✅ Broadcast delete event
        io.emit("deal:deleted", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealDeleted", { success: false, message: e.message });
      }
    });

    socket.on("toggleDealStatus", async ({ id }, callback) => {
      try {
        const { toggleDealStatus } = require("../controllers/dealController");
        const req = createReq(socket, {}, { id });
        const res = createRes(socket, "dealStatusToggled", callback);
        await toggleDealStatus(req, res);
        
        // ✅ Broadcast status change
        io.emit("deal:updated", { id });
      } catch (e) {
        if (callback) callback({ success: false, message: e.message });
        else socket.emit("dealStatusToggled", { success: false, message: e.message });
      }
    });

    // ========== RELAY EVENTS ==========
    socket.on("productCreated", (p) => socket.broadcast.emit("productCreated", p));
    socket.on("productUpdated", (p) => socket.broadcast.emit("productUpdated", p));
    socket.on("productDeleted", (id) => socket.broadcast.emit("productDeleted", id));
    socket.on("employeeRelayCreated", (d) => socket.broadcast.emit("employeeCreated", { success: true, data: d }));
    socket.on("employeeRelayUpdated", (d) => socket.broadcast.emit("employeeUpdated", { success: true, data: d }));
    socket.on("employeeRelayDeleted", (id) => socket.broadcast.emit("employeeDeleted", { success: true, data: { id } }));
    socket.on("employeeRelayStatusToggled", (d) => socket.broadcast.emit("employeeStatusToggled", { success: true, data: d }));

    socket.on("disconnect", (reason) => {
      console.log(` Disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

// ✅ Safe getter with clear error message
const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized! Call initSocket(server) first.");
  }
  return io;
};

module.exports = { initSocket, getIO };