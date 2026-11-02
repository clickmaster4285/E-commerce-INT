const Invoice = require("../models/Invoice");
const PosSale = require("../models/PosSale");
const Order = require("../models/Order");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const positiveAmount = (value) => Math.max(0, Number(value) || 0);
const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const paymentDateTime = (dateValue, timeValue) => {
  const date = toDate(dateValue);
  if (!date) return null;
  const match = String(timeValue || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (match) date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
};
const methodName = (value) => String(value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const cleanTransactionNote = (value) => String(value || "").replace(/\brefund\s+for\s+return\s+\S+/i, "refund").trim();

function getDateRange(period, startDateValue, endDateValue) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  if (period === "today") start.setHours(0, 0, 0, 0);
  else if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === "7d") start.setDate(start.getDate() - 6);
  else if (period === "30d") start.setDate(start.getDate() - 29);
  else if (period === "month") start.setDate(1);
  else if (period === "lastMonth") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (period === "year") start.setMonth(0, 1);
  else if (period === "custom") {
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(startDateValue || "")) ? new Date(`${startDateValue}T00:00:00`) : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(endDateValue || "")) ? new Date(`${endDateValue}T23:59:59.999`) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
    return { start: from, end: to };
  }
  else return null;
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function makeEvent(type, title, at, actor = "Not recorded", description = "") {
  return { type, title, at, actor: String(actor || "Not recorded"), description: String(description || "") };
}

function inRange(date, range) {
  if (!range) return true;
  const parsed = toDate(date);
  return parsed && parsed >= range.start && parsed <= range.end;
}

function transaction({ id, kind, category, reference, title, counterparty, amount, date, method, status, description, items, history, source }) {
  return {
    id: String(id), kind, category, reference: String(reference || "—"), title,
    counterparty: String(counterparty || "Not recorded"), amount: roundMoney(amount),
    date: toDate(date), method: methodName(method), status: String(status || "Recorded"),
    description: String(description || ""), items: Array.isArray(items) ? items : [],
    history: Array.isArray(history) ? history.filter((event) => event?.at).sort((a, b) => new Date(b.at) - new Date(a.at)) : [],
    source: source || {},
  };
}

exports.getFinanceOverview = async (req, res) => {
  try {
    const period = ["today", "yesterday", "7d", "30d", "month", "lastMonth", "year", "all", "custom"].includes(req.query.period) ? req.query.period : "today";
    const range = getDateRange(period, req.query.startDate, req.query.endDate);
    if (period === "custom" && !range) return res.status(400).json({ success: false, message: "Choose a valid start and end date." });
    const [invoices, sales, orders, purchaseOrders, purchasePayments] = await Promise.all([
      Invoice.find({ is_deleted: { $ne: true } }).select("invoice_number customer_name customer_email customer_phone customer_address invoice_date due_date items subtotal discount tax total amount_paid remaining_balance paid_at payments returns activity status createdby updatedby created_at updated_at").lean(),
      PosSale.find({}).select("sale_number customer_snapshot cashier_name created_by_name items subtotal discount_amount tax_amount total payment status edit_history returns created_at updated_at").lean(),
      Order.find({}).select("order_number address_snapshot items payment subtotal shipping tax total status created_at updated_at").lean(),
      PurchaseOrder.find({ is_deleted: { $ne: true } }).select("po_number vendor_snapshot items subtotal tax shipping discount total status payment_status paid_amount due_amount notes receivings activity created_at updated_at").lean(),
      PurchasePayment.find({}).populate("createdby", "name username").lean(),
    ]);

    const transactions = [];
    const purchasePaymentsByOrder = new Map();

    for (const invoice of invoices) {
      const invoicePayments = Array.isArray(invoice.payments) ? invoice.payments : [];
      const invoiceReturns = Array.isArray(invoice.returns) ? invoice.returns : [];
      const baseHistory = (invoice.activity || []).map((event) => makeEvent(
        event.type || "updated",
        event.type === "created" ? "Invoice created" : event.type === "payment" ? "Payment recorded" : event.type === "return" ? "Return processed" : event.type === "sent" ? "Invoice sent" : "Invoice updated",
        event.at,
        event.actor_name,
        (event.changes || []).filter((change) => event.type !== "created" || change.action === "added").map((change) => `${change.field || change.action || "Updated"}${change.before !== undefined || change.after !== undefined ? `: ${change.before || "—"} → ${change.after || "—"}` : change.from_quantity !== undefined ? `: ${change.from_quantity} → ${change.to_quantity}` : ""}`).filter(Boolean).join(" · "),
      ));

      for (const payment of invoicePayments) {
        const signedAmount = Number(payment.amount) || 0;
        if (!signedAmount) continue;
        const paymentNote = String(payment.note || "");
        const linkedReturn = signedAmount < 0 && invoiceReturns.some((refund) => refund.return_id && paymentNote.toLowerCase().includes(String(refund.return_id).toLowerCase()));
        // Cash refunds are represented by their invoice return below. Skip the
        // matching negative ledger entry so the same refund is not counted twice.
        if (linkedReturn) continue;
        const paymentDate = paymentDateTime(payment.payment_date, payment.payment_time) || invoice.updated_at || invoice.created_at;
        const amountToken = String(Math.abs(signedAmount));
        const matching = baseHistory.filter((event) => event.type === "payment" && event.description.toLowerCase().includes(amountToken));
        const paymentHistory = matching.length ? matching : [makeEvent(signedAmount < 0 ? "return" : "payment", signedAmount < 0 ? "Invoice refund recorded" : "Invoice payment recorded", paymentDate, "Not recorded", `${methodName(payment.payment_method)} · ${cleanTransactionNote(paymentNote)}`)];
        transactions.push(transaction({
          id: `invoice-payment-${invoice._id}-${payment._id}`, kind: signedAmount < 0 ? "expense" : "income", category: signedAmount < 0 ? "Invoice refund" : "Invoice payment",
          reference: invoice.invoice_number, title: signedAmount < 0 ? "Invoice refund" : "Invoice payment received", counterparty: invoice.customer_name,
          amount: signedAmount, date: paymentDate, method: payment.payment_method,
          status: invoice.status, description: cleanTransactionNote(paymentNote), items: invoice.items,
          history: paymentHistory, source: { sourceType: "invoice", sourceId: String(invoice._id), customerEmail: invoice.customer_email, customerPhone: invoice.customer_phone, invoiceDate: invoice.invoice_date, dueDate: invoice.due_date, amountPaid: invoice.amount_paid, balance: invoice.remaining_balance },
        }));
      }

      // Older invoices may store a paid balance without individual payment entries.
      if (!invoicePayments.length && positiveAmount(invoice.amount_paid) > 0) {
        const cashRefunds = invoiceReturns.reduce((total, refund) => total + positiveAmount(refund.amount_to_refund), 0);
        const paymentDate = invoice.paid_at || invoice.updated_at || invoice.created_at;
        transactions.push(transaction({
          id: `invoice-legacy-payment-${invoice._id}`, kind: "income", category: "Invoice payment",
          reference: invoice.invoice_number, title: "Recorded invoice payment", counterparty: invoice.customer_name,
          amount: positiveAmount(invoice.amount_paid) + cashRefunds, date: paymentDate, method: "Not recorded", status: invoice.status,
          description: "This older invoice has a paid balance but no itemized payment record.", items: invoice.items,
          history: [makeEvent("payment", "Payment total recorded", paymentDate, "Not recorded", "Historical payment method and exact time were not saved.")],
          source: { sourceType: "invoice", sourceId: String(invoice._id), customerEmail: invoice.customer_email, customerPhone: invoice.customer_phone, invoiceDate: invoice.invoice_date, dueDate: invoice.due_date, amountPaid: invoice.amount_paid, balance: invoice.remaining_balance, historicalRecord: true },
        }));
      }

      for (const refund of invoiceReturns) {
        const cashRefund = positiveAmount(refund.amount_to_refund);
        if (refund.refund_method !== "Cash Refund" || cashRefund <= 0) continue;
        const returnId = String(refund.return_id || "").toLowerCase();
        const refundPayment = returnId ? invoicePayments.find((payment) => Number(payment.amount) < 0 && String(payment.note || "").toLowerCase().includes(returnId)) : null;
        const refundDetails = String(refund.reason || refund.notes || "").trim();
        transactions.push(transaction({
          id: `invoice-refund-${invoice._id}-${refund._id || refund.return_id}`, kind: "expense", category: "Invoice refund",
          reference: invoice.invoice_number, title: "Customer refund", counterparty: invoice.customer_name,
          amount: -cashRefund, date: refund.date, method: refundPayment?.payment_method || "Not recorded",
          status: refund.status, description: refundDetails, items: refund.items_returned,
          history: [makeEvent("return", "Cash refund processed", refund.date, "Not recorded", [refundDetails, `Refund amount: ${cashRefund.toLocaleString("en-PK")} PKR`].filter(Boolean).join(" · "))],
          source: { sourceType: "invoice", sourceId: String(invoice._id), customerEmail: invoice.customer_email, customerPhone: invoice.customer_phone, invoiceReturn: refund },
        }));
      }
    }

    for (const sale of sales) {
      const saleDate = sale.created_at || sale.updated_at;
      const saleHistory = [makeEvent("created", "POS sale completed", saleDate, sale.created_by_name || sale.cashier_name, `${(sale.items || []).length} product lines · ${sale.status || "completed"}`)];
      for (const edit of sale.edit_history || []) saleHistory.push(makeEvent("updated", "POS sale edited", edit.edited_at, edit.edited_by_name, (edit.changes || []).map((change) => `${change.action}${change.product_name ? ` · ${change.product_name}` : ""}${change.from_value || change.to_value ? `: ${change.from_value || "—"} → ${change.to_value || "—"}` : change.from_quantity !== undefined ? `: ${change.from_quantity} → ${change.to_quantity}` : ""}`).join(" · ")));
      const amountReceived = Number(sale.payment?.amount_received);
      const changeDue = positiveAmount(sale.payment?.change_due);
      const collected = Math.max(0, (Number.isFinite(amountReceived) ? amountReceived : positiveAmount(sale.total)) - changeDue);
      if (sale.status !== "cancelled" && collected > 0) transactions.push(transaction({
        id: `pos-sale-${sale._id}`, kind: "income", category: "POS sale", reference: sale.sale_number,
        title: "Point of sale receipt", counterparty: sale.customer_snapshot?.name || "Walk-in customer",
        amount: collected, date: saleDate, method: sale.payment?.method, status: sale.status,
        description: sale.payment?.reference ? `Payment reference: ${sale.payment.reference}` : "",
        items: sale.items, history: saleHistory,
        source: { sourceType: "pos", sourceId: String(sale._id), cashier: sale.cashier_name || sale.created_by_name, subtotal: sale.subtotal, discount: sale.discount_amount, tax: sale.tax_amount, total: sale.total, payment: sale.payment },
      }));
      for (const refund of sale.returns || []) transactions.push(transaction({
        id: `pos-refund-${sale._id}-${refund._id || refund.returned_at}`, kind: "expense", category: "POS refund",
        reference: sale.sale_number, title: "POS customer refund", counterparty: sale.customer_snapshot?.name || "Walk-in customer",
        amount: -positiveAmount(refund.refund_total), date: refund.returned_at, method: refund.refund_method,
        status: "Refunded", description: refund.reason, items: refund.items,
        history: [makeEvent("return", "POS refund processed", refund.returned_at, refund.returned_by_name, refund.reason)],
        source: { sourceType: "pos", sourceId: String(sale._id), returnedBy: refund.returned_by_name },
      }));
    }

    for (const order of orders) {
      if (order.payment?.status !== "paid" || positiveAmount(order.total) <= 0) continue;
      const orderDate = order.updated_at || order.created_at;
      transactions.push(transaction({
        id: `order-payment-${order._id}`, kind: "income", category: "Online order payment",
        reference: order.order_number, title: "Online order payment received",
        counterparty: order.address_snapshot?.full_name || "Online customer", amount: order.total,
        date: orderDate, method: order.payment?.method, status: order.status,
        description: order.status === "cancelled" ? "Order is cancelled; this system does not record online-order refunds." : "",
        items: order.items, history: [makeEvent("payment", "Online payment marked paid", orderDate, "System / gateway", `Order status: ${order.status || "pending"}`)],
        source: { sourceType: "order", sourceId: String(order._id), paymentStatus: order.payment.status, subtotal: order.subtotal, shipping: order.shipping, tax: order.tax, total: order.total, address: order.address_snapshot },
      }));
    }

    for (const payment of purchasePayments) {
      const poId = String(payment.po_id);
      purchasePaymentsByOrder.set(poId, (purchasePaymentsByOrder.get(poId) || 0) + positiveAmount(payment.amount));
      const order = purchaseOrders.find((entry) => String(entry._id) === poId);
      const vendor = order?.vendor_snapshot?.company_name || order?.vendor_snapshot?.name || "Vendor";
      const paidAt = payment.paid_at || payment.created_at;
      const actorName = payment.createdby?.name || payment.createdby?.username || "Not recorded";
      const orderHistory = (order?.activity || []).map((event) => makeEvent(
        event.type || "updated",
        event.type === "created" ? "Purchase order created" : event.type === "payment" ? "Vendor payment recorded" : event.type === "receiving" ? "Items received" : "Purchase order updated",
        event.at,
        event.actor_name,
        (event.changes || []).map((change) => `${change.field || change.action || "Updated"}${change.product_name ? ` · ${change.product_name}` : ""}${change.before !== undefined || change.after !== undefined ? `: ${change.before || "—"} → ${change.after || "—"}` : change.from_quantity !== undefined ? `: ${change.from_quantity} → ${change.to_quantity}` : ""}`).filter(Boolean).join(" · "),
      ));
      for (const receiving of order?.receivings || []) {
        const receivedItems = (receiving.items || []).map((item) => `${item.qty} item${item.qty === 1 ? "" : "s"}`).join(", ");
        orderHistory.push(makeEvent("receiving", "Purchase order items received", receiving.received_at, receiving.received_by_name, [receiving.invoice_no && `Vendor invoice ${receiving.invoice_no}`, receiving.explanation, receivedItems].filter(Boolean).join(" · ")));
      }
      orderHistory.push(makeEvent("payment", "Vendor payment recorded", paidAt, actorName, `${methodName(payment.method)} · ${roundMoney(payment.amount).toLocaleString("en-PK")} PKR`));
      transactions.push(transaction({
        id: `purchase-payment-${payment._id}`, kind: "expense", category: "Vendor payment",
        reference: order?.po_number || `PO ${String(payment.po_id).slice(-6)}`, title: "Purchase order payment",
        counterparty: vendor, amount: -positiveAmount(payment.amount), date: paidAt,
        method: payment.method, status: order?.payment_status || "Recorded",
        description: order?.po_number ? `Payment for ${order.po_number}` : "Vendor payment",
        items: order?.items, history: orderHistory,
        source: { sourceType: "purchase-order", sourceId: poId, paymentId: String(payment._id), vendor: order?.vendor_snapshot, paidAmount: order?.paid_amount, dueAmount: order?.due_amount },
      }));
    }

    // Preserve old purchase-order balances where the detailed payment ledger predates the current payment model.
    for (const order of purchaseOrders) {
      const legacyPaid = roundMoney(Math.max(0, positiveAmount(order.paid_amount) - (purchasePaymentsByOrder.get(String(order._id)) || 0)));
      if (legacyPaid <= 0) continue;
      const estimatedDate = order.updated_at || order.created_at;
      transactions.push(transaction({
        id: `purchase-legacy-payment-${order._id}`, kind: "expense", category: "Vendor payment",
        reference: order.po_number, title: "Recorded purchase payment", counterparty: order.vendor_snapshot?.company_name || order.vendor_snapshot?.name || "Vendor",
        amount: -legacyPaid, date: estimatedDate, method: "Not recorded", status: order.payment_status,
        description: "This older purchase order has a paid balance without an itemized payment entry; its historical date is approximate.",
        items: order.items, history: [makeEvent("payment", "Recorded purchase payment", estimatedDate, "Not recorded", "Payment method and exact transaction time were not saved.")],
        source: { sourceType: "purchase-order", sourceId: String(order._id), vendor: order.vendor_snapshot, paidAmount: order.paid_amount, dueAmount: order.due_amount, historicalRecord: true },
      }));
    }

    const filtered = transactions.filter((entry) => inRange(entry.date, range)).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const search = String(req.query.search || "").trim().toLowerCase();
    const searched = search ? filtered.filter((entry) => `${entry.reference} ${entry.title} ${entry.category} ${entry.counterparty} ${entry.method}`.toLowerCase().includes(search)) : filtered;
    const kind = ["income", "expense"].includes(req.query.kind) ? req.query.kind : "all";
    const matched = kind === "all" ? searched : searched.filter((entry) => entry.kind === kind);
    const pageSize = 20;
    const pageCount = Math.max(1, Math.ceil(matched.length / pageSize));
    const page = Math.min(pageCount, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const income = roundMoney(filtered.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0));
    const expenses = roundMoney(filtered.reduce((sum, entry) => sum + Math.max(0, -entry.amount), 0));
    const receivable = roundMoney(invoices.reduce((sum, invoice) => sum + positiveAmount(invoice.remaining_balance ?? (Number(invoice.total || 0) - Number(invoice.amount_paid || 0))), 0));
    const payable = roundMoney(purchaseOrders.reduce((sum, order) => sum + positiveAmount(order.due_amount), 0));

    return res.status(200).json({
      success: true,
      data: {
        period,
        summary: { income, expenses, net: roundMoney(income - expenses), receivable, payable, transactionCount: filtered.length },
        transactions: matched.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, total: matched.length, pages: pageCount },
        notes: ["Outflows include recorded vendor payments and customer refunds; the app has no general operating-expense ledger. Invoice refunds do not store whether Cash or Bank was used.", "Online order payments are counted when their payment status is paid. The app does not store online-order refund transactions."],
      },
    });
  } catch (error) {
    console.error("Finance overview error:", error);
    return res.status(500).json({ success: false, message: "Unable to load finance overview" });
  }
};
