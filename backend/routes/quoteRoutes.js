const router = require("express").Router();
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission, staffPermissionCheck } = require("../middleware/checkPermission");
const { listQuotes, getQuote, createQuote, updateQuote, updateQuoteStatus, reserveQuoteNumber } = require("../controllers/quoteController");

router.use(authMiddleware, staffPermissionCheck, checkPermission("quotes"));
router.get("/", listQuotes);
router.post("/reserve-number", reserveQuoteNumber);
router.post("/", createQuote);
router.get("/:id", getQuote);
router.put("/:id", updateQuote);
router.patch("/:id/status", updateQuoteStatus);

module.exports = router;
