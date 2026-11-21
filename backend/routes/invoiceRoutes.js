const router = require("express").Router();
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission, staffPermissionCheck } = require("../middleware/checkPermission");
const { listInvoices, getNextInvoiceNumber, getInvoice, createInvoice, updateInvoice, recordPayment, recordReturn, sendInvoice } = require("../controllers/invoiceController");

router.use(authMiddleware, staffPermissionCheck, checkPermission("invoices"));
router.get("/", listInvoices);
router.get("/next-number", getNextInvoiceNumber);
router.post("/", createInvoice);
router.put("/:id", updateInvoice);
router.get("/:id", getInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/payments", recordPayment);
router.post("/:id/returns", recordReturn);

module.exports = router;
