const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const chat = require("../controllers/chatController");
const { limiters } = require("../middleware/rateLimit");
const router = express.Router();
const auth = authMiddleware;
const staff = [auth, chat.canUseInbox, checkPermission("order")];
const customer = [auth, chat.canUseCustomerChat];
// Guest chat creation has a legacy IP throttle to reduce anonymous conversation
// spam. Authenticated chat opening is idempotent and message sends have their own
// per-customer limiter in sendMessage, so opening a chat must not trigger a shared
// multi-minute IP cooldown for a customer.
router.post("/guest/start", limiters.chat, chat.startGuest);
router.get("/guest/mine", chat.getGuestMine);
router.get("/guest/:id", chat.requireGuestChat, chat.getConversation);
router.patch("/guest/:id/context", chat.requireGuestChat, chat.updateInquiryContext);
router.get("/guest/:id/messages", chat.requireGuestChat, chat.getMessages);
router.post("/guest/:id/messages", chat.requireGuestChat, chat.sendMessage);
router.patch("/guest/:id/read", chat.requireGuestChat, chat.markRead);
router.post("/general", ...customer, chat.openGeneral);
router.post("/order/:orderId", ...customer, chat.openForOrder);
router.get("/mine", ...customer, chat.listMine);
router.get("/admin/unread-count", ...staff, chat.unreadCount);
router.get("/admin/conversations", ...staff, chat.listAdmin);
router.patch("/admin/:id/status", ...staff, chat.updateStatus);
router.patch("/:id/context", auth, chat.updateInquiryContext);
router.get("/:id", auth, chat.getConversation);
router.get("/:id/messages", auth, chat.getMessages);
router.post("/:id/messages", auth, chat.sendMessage);
router.patch("/:id/read", auth, chat.markRead);
module.exports = router;
