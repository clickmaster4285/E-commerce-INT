const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const idString = (value) => String(value?._id || value || "");

function priorReturnForItem(itemId, originalItem, returns = []) {
  let quantity = 0;
  let value = 0;
  const originalQuantity = Math.max(0, Number(originalItem.quantity) || 0);
  const originalValue = Number.isFinite(Number(originalItem.total))
    ? Number(originalItem.total)
    : originalQuantity * (Number(originalItem.unit_price) || 0);

  for (const record of returns) {
    for (const returned of record.items_returned || []) {
      if (idString(returned.item_id) !== itemId) continue;
      const returnedQty = Math.max(0, Number(returned.qty) || 0);
      quantity += returnedQty;
      if (Number.isFinite(Number(returned.return_value)) && Number(returned.return_value) > 0) {
        value += Number(returned.return_value);
      } else if (Number.isFinite(Number(returned.unit_price))) {
        // Legacy records stored the actual per-unit refund in unit_price.
        value += Number(returned.unit_price) * returnedQty;
      } else if (originalQuantity > 0) {
        value += originalValue * returnedQty / originalQuantity;
      }
    }
  }
  return { quantity, value: roundMoney(value) };
}

function calculateReturnLine(item, qty, returns = []) {
  const itemId = idString(item._id);
  const originalQuantity = Math.max(0, Number(item.quantity) || 0);
  const prior = priorReturnForItem(itemId, item, returns);
  const availableQuantity = Math.max(0, originalQuantity - prior.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > availableQuantity) {
    throw new Error("Return quantity exceeds the unreturned quantity");
  }

  const originalValue = Number.isFinite(Number(item.total))
    ? Number(item.total)
    : originalQuantity * (Number(item.unit_price) || 0);
  const remainingValue = roundMoney(Math.max(0, originalValue - prior.value));
  const returnValue = qty === availableQuantity
    ? remainingValue
    : roundMoney(remainingValue * qty / availableQuantity);

  return {
    return_value: returnValue,
    unit_price: roundMoney(returnValue / qty),
    available_quantity: availableQuantity,
  };
}

function capReturnLines(lines, maximum) {
  const rawTotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.return_value || 0), 0));
  const cap = roundMoney(Math.max(0, Number(maximum) || 0));
  if (rawTotal <= cap || rawTotal <= 0) {
    return { lines, raw_total: rawTotal, total: rawTotal, capped: false };
  }

  let allocated = 0;
  const cappedLines = lines.map((line, index) => {
    const value = index === lines.length - 1
      ? roundMoney(cap - allocated)
      : roundMoney(cap * Number(line.return_value || 0) / rawTotal);
    allocated = roundMoney(allocated + value);
    return { ...line, return_value: value, unit_price: roundMoney(value / line.qty) };
  });
  return { lines: cappedLines, raw_total: rawTotal, total: cap, capped: true };
}

function calculateReturnSettlement(invoiceTotal, amountPaid, returnDeduction) {
  const total = roundMoney(Math.max(0, Number(invoiceTotal) || 0));
  const paid = roundMoney(Math.max(0, Number(amountPaid) || 0));
  const deduction = roundMoney(Math.min(total, Math.max(0, Number(returnDeduction) || 0)));
  const adjustedTotal = roundMoney(Math.max(0, total - deduction));
  const cashRefund = roundMoney(Math.min(paid, Math.max(0, paid - adjustedTotal)));
  const paidAfterRefund = roundMoney(paid - cashRefund);
  const remainingBalance = roundMoney(Math.max(0, adjustedTotal - paidAfterRefund));
  return { adjusted_total: adjustedTotal, amount_paid: paidAfterRefund, remaining_balance: remainingBalance, cash_refund: cashRefund };
}

module.exports = { roundMoney, calculateReturnLine, capReturnLines, calculateReturnSettlement };
