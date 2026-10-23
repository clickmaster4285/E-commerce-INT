const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission, staffPermissionCheck } = require("../middleware/checkPermission");
const { listInvoices, getInvoice, createInvoice, recordPayment, recordReturn, sendInvoice } = require("../controllers/invoiceController");

router.use(authMiddleware, staffPermissionCheck, checkPermission("invoices"));
router.get("/", listInvoices);
router.post("/", createInvoice);
router.get("/:id", getInvoice);
router.post("/:id/send", sendInvoice);
router.post("/:id/payments", recordPayment);
router.post("/:id/returns", recordReturn);

module.exports = router;
