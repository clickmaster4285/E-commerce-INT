const Customer = require("../models/Customer");
const Lead = require("../models/Lead");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function syncLeadCustomer(lead, actorId = null) {
  const customerName = lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name;
  let customer = lead.customer_id
    ? await Customer.findOne({ _id: lead.customer_id, is_deleted: { $ne: true } })
    : null;

  // Older conversions could attach several leads to the same customer. Keep
  // the original record with the earliest lead and give each later lead its
  // own record when customer data is synchronized.
  let sharedCustomerLink = false;
  if (customer && lead.customer_id) {
    const firstLinkedLead = await Lead.findOne({
      customer_id: lead.customer_id,
      status: { $in: ["Customer", "Converted"] },
      is_deleted: { $ne: true },
    }).sort({ created_at: 1, _id: 1 }).select("_id").lean();
    sharedCustomerLink = firstLinkedLead && String(firstLinkedLead._id) !== String(lead._id);
    if (sharedCustomerLink) customer = null;
  }

  if (!customer && !sharedCustomerLink && lead.lead_number) {
    const marker = `Converted from lead ${lead.lead_number}`;
    customer = await Customer.findOne({
      notes: new RegExp(escapeRegex(marker), "i"),
      is_deleted: { $ne: true },
    });
  }

  const marker = `Converted from lead ${lead.lead_number}`;
  const linkedBefore = Boolean(lead.customer_added);
  const leadNotes = [
    lead.lead_type === "Business" && lead.name !== customerName ? `Contact person: ${lead.name}` : "",
    lead.lead_type === "Business" && lead.business_type ? `Business type: ${lead.business_type}` : "",
    lead.city ? `City: ${lead.city}` : "",
    lead.source ? `Lead source: ${lead.source}` : "",
    lead.next_follow_up_date ? `Next follow-up: ${new Date(lead.next_follow_up_date).toLocaleDateString()}` : "",
    lead.notes ? `Lead notes: ${lead.notes}` : "",
    lead.custom_requirements ? `Requirements: ${lead.custom_requirements}` : "",
    marker,
  ].filter(Boolean).join("\n");

  if (!customer) customer = new Customer({ createdby: actorId });
  let customerChanged = customer.isNew;
  const setCustomerField = (field, value) => {
    if (String(customer[field] || "") !== String(value || "")) {
      customer[field] = value;
      customerChanged = true;
    }
  };
  setCustomerField("name", customerName);
  setCustomerField("phone", lead.phone || "");
  setCustomerField("email", lead.email || "");
  setCustomerField("address", lead.lead_type === "Business" ? lead.business_address || "" : "");
  if (!customer.notes?.includes(marker)) {
    customer.notes = [customer.notes, leadNotes].filter(Boolean).join("\n\n");
    customerChanged = true;
  }
  if (actorId && String(customer.updatedby || "") !== String(actorId)) {
    customer.updatedby = actorId;
    customerChanged = true;
  }
  if (customerChanged) await customer.save();

  let leadChanged = false;
  if (String(lead.customer_id || "") !== String(customer._id)) {
    lead.customer_id = customer._id;
    leadChanged = true;
  }
  if (!lead.customer_added) {
    lead.customer_added = true;
    leadChanged = true;
  }
  if (lead.status === "Converted") {
    lead.status = "Customer";
    leadChanged = true;
  }
  if (!linkedBefore) {
    lead.history.push({
      action: "customer",
      summary: "Customer record added to Customers",
      employee_id: actorId,
      employee_name: "Admin",
      created_at: new Date(),
    });
    leadChanged = true;
  }
  if (leadChanged) await lead.save();
  return customer;
}

module.exports = syncLeadCustomer;
