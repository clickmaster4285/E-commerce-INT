const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission, staffPermissionCheck } = require("../middleware/checkPermission");
const { listQuotes, getQuote, createQuote, updateQuote, updateQuoteStatus } = require("../controllers/quoteController");

router.use(authMiddleware, staffPermissionCheck, checkPermission("quotes"));
router.get("/", listQuotes);
router.post("/", createQuote);
router.get("/:id", getQuote);
router.put("/:id", updateQuote);
router.patch("/:id/status", updateQuoteStatus);

module.exports = router;
