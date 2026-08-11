let io;
const path = require("path");
const fs = require("fs");

const { getStoreInfo, updateStoreInfo } = require("../controllers/storeController");
const { getProfileInfo, updateProfileInfo, changePasswordSocket } = require("../controllers/userController");

// =====================================================
// ✅ IMAGE COMPRESSION (sharp)
// =====================================================
const compressAndSaveLogo = async (base64Data, fileName) => {
  if (!base64Data || typeof base64Data !== "string") return null;

  const mimeMatch = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!mimeMatch) throw new Error("Invalid base64 image format");

  const mimeType = mimeMatch[1];
  const rawBuffer = Buffer.from(mimeMatch[2], "base64");

  console.log(`   📦 Raw buffer: ${(rawBuffer.length / 1024).toFixed(0)}KB | MIME: ${mimeType}`);

  if (rawBuffer.length > 8 * 1024 * 1024) {
    throw new Error("Image too large (max 8MB)");
  }

  const storeDir = path.join(__dirname, "../uploads/store");
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });

  const safeName = (fileName || "logo")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.\-]/g, "")
    .replace(/\.[^.]+$/, "");

  const isSvg = mimeType.includes("svg");

  if (isSvg) {
    const finalName = `store-logo-${Date.now()}-${safeName}.svg`;
    const filePath = path.join(storeDir, finalName);
    fs.writeFileSync(filePath, rawBuffer);
    console.log(`   ✅ SVG saved: ${finalName}`);
    return {
      path: filePath,
      filename: finalName,
      mimetype: mimeType,
      size: rawBuffer.length,
      relativePath: `uploads/store/${finalName}`,
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
    console.log(`   ✅ Compressed: ${(rawBuffer.length / 1024).toFixed(0)}KB → ${(savedSize / 1024).toFixed(0)}KB`);

    return {
      path: filePath,
      filename: finalName,
      mimetype: "image/jpeg",
      size: savedSize,
      relativePath: `uploads/store/${finalName}`,
    };
  } catch (err) {
    console.warn("   ⚠️ Sharp failed, saving original:", err.message);
    const fallbackName = `store-logo-${Date.now()}-${safeName}-raw.jpg`;
    const fallbackPath = path.join(storeDir, fallbackName);
    fs.writeFileSync(fallbackPath, rawBuffer);
    return {
      path: fallbackPath,
      filename: fallbackName,
      mimetype: mimeType,
      size: rawBuffer.length,
      relativePath: `uploads/store/${fallbackName}`,
    };
  }
};

// ✅ DELETE OLD LOGO — handles both relative and absolute paths
const deleteOldLogo = async () => {
  try {
    const Store = require("../models/Store");
    const existing = await Store.findOne();
    if (existing?.logo?.img_url) {
      const imgUrl = existing.logo.img_url;
      
      // Try multiple path resolutions
      const possiblePaths = [
        path.join(__dirname, "..", imgUrl),
        path.join(__dirname, "..", "uploads", imgUrl.replace(/^uploads\//, "")),
        imgUrl.startsWith("/") ? imgUrl : null,
      ].filter(Boolean);

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
          console.log("   🗑️ Old logo deleted:", imgUrl);
          break;
        }
      }
    }
  } catch (e) {
    console.log("   ⚠️ Old logo delete skip:", e.message);
  }
};

// =====================================================
// INIT SOCKET
// =====================================================
const initSocket = (server) => {
  const { Server } = require("socket.io");
  const jwt = require("jsonwebtoken");

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
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    maxHttpBufferSize: 15 * 1024 * 1024,
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ["polling", "websocket"],
  });

  console.log("🚀 Socket.IO ready | maxBuffer: 15MB | transports: polling → websocket");

  // ==========================================
  // AUTH MIDDLEWARE
  // ==========================================
  io.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie;
    if (!rawCookie) {
      socket.userId = "guest";
      socket.userRole = "admin";
      return next();
    }
    const cookies = Object.fromEntries(
      rawCookie.split("; ").map((c) => {
        const [key, ...val] = c.split("=");
        return [key.trim(), val.join("=")];
      })
    );
    const token = cookies.accessToken || cookies.auth_token || cookies.access_token;
    if (!token) {
      socket.userId = "guest";
      socket.userRole = "admin";
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId || decoded.id;
      socket.userRole = (decoded.role || "admin").toLowerCase();
      console.log(`🔑 Auth OK — User: ${socket.userId}, Role: ${socket.userRole}`);
      next();
    } catch (error) {
      socket.userId = "guest";
      socket.userRole = "admin";
      next();
    }
  });

  // ==========================================
  // HELPER
  // ==========================================
  function createSocketRes(socket, eventName, callback) {
    return {
      status: (code) => ({
        json: (data) => {
          if (typeof callback === "function") callback(data);
          else socket.emit(eventName, data);
        },
      }),
      json: (data) => {
        if (typeof callback === "function") callback(data);
        else socket.emit(eventName, data);
      },
    };
  }

  // ==========================================
  // CONNECTION HANDLER
  // ==========================================
  io.on("connection", (socket) => {
    console.log(`🟢 Connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

    // ========== STORE: GET ==========
    socket.on("getStoreInfo", async () => {
      try {
        const req = { user: { id: socket.userId, role: socket.userRole } };
        const res = createSocketRes(socket, "storeInfo");
        await getStoreInfo(req, res);
      } catch (error) {
        console.error("❌ getStoreInfo error:", error.message);
        socket.emit("storeInfo", { success: false, message: error.message });
      }
    });

    // ========== STORE: UPDATE (WITH LOGO + COMPRESSION) ==========
    socket.on("updateStoreInfo", async (payload, callback) => {
      try {
        console.log("📥 updateStoreInfo received");
        console.log("   Has logoBase64:", !!payload?.logoBase64);
        console.log("   logoBase64 length:", payload?.logoBase64?.length || 0);

        let logoFile = null;

        if (payload?.logoBase64 && typeof payload.logoBase64 === "string") {
          try {
            await deleteOldLogo();
            logoFile = await compressAndSaveLogo(payload.logoBase64, payload.logoFileName);
            console.log("   ✅ Logo ready:", logoFile?.relativePath);
          } catch (e) {
            console.error("   ❌ Logo processing error:", e.message);
            logoFile = null;
          }
        }

        const { logoBase64, logoFileName, logoMimeType, ...bodyData } = payload || {};

        const req = {
          user: { id: socket.userId, role: socket.userRole },
          body: bodyData,
          file: logoFile,
        };

        const res = {
          status: (code) => ({
            json: (data) => {
              console.log("   📤 Response:", data?.success, "| Logo:", data?.data?.logo?.img_url || "none");
              if (typeof callback === "function") callback(data);
              if (data?.success && data?.data) {
                io.emit("storeUpdated", data.data);
                io.emit("storeInfoChangedForProfile", data.data);
              }
            },
          }),
          json: (data) => {
            console.log("   📤 Response:", data?.success, "| Logo:", data?.data?.logo?.img_url || "none");
            if (typeof callback === "function") callback(data);
            if (data?.success && data?.data) {
              io.emit("storeUpdated", data.data);
              io.emit("storeInfoChangedForProfile", data.data);
            }
          },
        };

        await updateStoreInfo(req, res);
      } catch (error) {
        console.error("❌ updateStoreInfo error:", error.message);
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    });

    // ========== STORE: DELETE LOGO ==========
    socket.on("deleteStoreLogo", async (_, callback) => {
      try {
        console.log("🗑️ deleteStoreLogo requested");
        await deleteOldLogo();
        const Store = require("../models/Store");
        let store = await Store.findOne();
        if (store) {
          store.logo = { img_url: "", public_id: "" };
          await store.save();
          const plain = store.toObject();
          if (typeof callback === "function") callback({ success: true, data: plain });
          io.emit("storeUpdated", plain);
        } else {
          if (typeof callback === "function") callback({ success: false, message: "Store not found" });
        }
      } catch (error) {
        console.error("❌ deleteStoreLogo error:", error.message);
        if (typeof callback === "function") callback({ success: false, message: error.message });
      }
    });

    // ========== PROFILE: GET ==========
    socket.on("getProfile", async () => {
      try {
        const req = { user: { id: socket.userId, role: socket.userRole } };
        const res = createSocketRes(socket, "profileData");
        await getProfileInfo(req, res);
      } catch (error) {
        socket.emit("profileData", { success: false, message: error.message });
      }
    });

    // ========== PROFILE: UPDATE ==========
    socket.on("updateProfile", async (payload, callback) => {
      try {
        const req = { user: { id: socket.userId, role: socket.userRole }, body: payload };
        const res = {
          status: (code) => ({
            json: (data) => {
              if (typeof callback === "function") callback(data);
              if (data?.success) {
                io.emit("profileUpdated", data);
                if (data.store) io.emit("storeUpdated", data.store);
              }
            },
          }),
          json: (data) => {
            if (typeof callback === "function") callback(data);
            if (data?.success) {
              io.emit("profileUpdated", data);
              if (data.store) io.emit("storeUpdated", data.store);
            }
          },
        };
        await updateProfileInfo(req, res);
      } catch (error) {
        if (typeof callback === "function") callback({ success: false, message: error.message });
      }
    });

    // ========== PROFILE: CHANGE PASSWORD ==========
    socket.on("changePassword", async (payload, callback) => {
      try {
        const req = { user: { id: socket.userId, role: socket.userRole }, body: payload };
        const res = createSocketRes(socket, "passwordResult", callback);
        await changePasswordSocket(req, res);
      } catch (error) {
        if (typeof callback === "function") callback({ success: false, message: error.message });
      }
    });

    // ========== PRODUCT RELAY ==========
    socket.on("productCreated", (product) => {
      console.log("📦 Relay: productCreated →", product?.name || product?._id);
      socket.broadcast.emit("productCreated", product);
    });
    socket.on("productUpdated", (product) => {
      console.log("📦 Relay: productUpdated →", product?.name || product?._id);
      socket.broadcast.emit("productUpdated", product);
    });
    socket.on("productDeleted", (productId) => {
      console.log("📦 Relay: productDeleted →", productId);
      socket.broadcast.emit("productDeleted", productId);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

module.exports = { initSocket, getIO };