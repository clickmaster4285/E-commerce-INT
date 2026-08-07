// utils/socket.js
let io;
const path = require("path");
const fs = require("fs");

const initSocket = (server) => {
  const { Server } = require("socket.io");
  const jwt = require("jsonwebtoken");
  const { getStoreInfo, updateStoreInfo } = require("../controllers/storeController");

  // Uploads folder setup
  const uploadDir = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Socket.io Initialization
  io = new Server(server, {
    cors: {
      // Hardcoded fallback removed - purely relying on .env
      origin: process.env.CLIENT_URL, 
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB limit for base64 images
  });

  // ==========================================
  // ✅ Socket Authentication Middleware
  // ==========================================
  io.use((socket, next) => {
    // ❌ Removed: console.log("Socket Auth:", socket.handshake.auth);
    // ❌ Removed: console.log("Socket Token:", token);
    
    const token = socket.handshake.auth?.token;

    if (!token) {
      // Only log errors or rejections if needed, but keep it clean
      // console.warn("❌ Socket connection rejected: Token required"); 
      return next(new Error("Token required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // ❌ Removed: console.log("Socket Token Decoded:", decoded);
      
      // Map user data to socket object
      socket.userId = decoded.id || decoded.userId; // Support both formats just in case
      socket.userRole = decoded.role;

      next();
    } catch (error) {
      // console.error("❌ Socket connection rejected: Invalid token");
      return next(new Error("Invalid token"));
    }
  });

  // ==========================================
  // 🟢 Connection Handler
  // ==========================================
  io.on("connection", (socket) => {
    // Keep this minimal log to know who is connected
    console.log(`🟢 Connected: ${socket.id} (User: ${socket.userId}, Role: ${socket.userRole})`);

    // =============================================
    // 1️⃣ GET STORE INFO
    // =============================================
    socket.on("getStoreInfo", async () => {
      try {
        const req = {
          user: {
            id: socket.userId,
            role: socket.userRole,
          },
        };

        const res = {
          status: (code) => ({
            json: (data) => {
              socket.emit("storeInfo", data);
            },
          }),
          json: (data) => {
            socket.emit("storeInfo", data);
          },
        };

        await getStoreInfo(req, res);
      } catch (error) {
        console.error("❌ getStoreInfo error:", error.message);
        socket.emit("storeInfo", { success: false, message: error.message });
      }
    });

    // =============================================
    // 2️⃣ UPDATE STORE INFO
    // =============================================
    socket.on("updateStoreInfo", async (payload, callback) => {
      try {
        let logoFile = null;

        // --- Logo Base64 → File Convert ---
        if (payload.logoBase64) {
          try {
            const base64Data = payload.logoBase64.replace(
              /^data:image\/\w+;base64,/,
              ""
            );
            const buffer = Buffer.from(base64Data, "base64");
            const fileName = `logo-${Date.now()}.png`;
            const filePath = path.join(uploadDir, fileName);

            fs.writeFileSync(filePath, buffer);

            logoFile = {
              path: filePath,
              filename: fileName,
            };

            // ❌ Removed: console.log("✅ Logo saved:", filePath);
          } catch (fileError) {
            console.error("❌ Logo save error:", fileError.message);
          }
        }

        // Remove logoBase64 from body before sending to controller
        const { logoBase64, ...bodyData } = payload;

        // Mock req object for Controller
        const req = {
          user: {
            id: socket.userId,
            role: socket.userRole,
          },
          body: bodyData,
          file: logoFile,
        };

        // Mock res object for Controller
        const res = {
          status: (code) => ({
            json: (data) => {
              if (typeof callback === "function") {
                callback(data);
              }
              if (data.success && data.data) {
                socket.broadcast.emit("storeUpdated", data.data);
              }
            },
          }),
          json: (data) => {
            if (typeof callback === "function") {
              callback(data);
            }
            if (data.success && data.data) {
              socket.broadcast.emit("storeUpdated", data.data);
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

    // =============================================
    // 🔴 DISCONNECT
    // =============================================
    socket.on("disconnect", () => {
      console.log(`🔴 Disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized! Call initSocket first.");
  }
  return io;
};

module.exports = { initSocket, getIO };