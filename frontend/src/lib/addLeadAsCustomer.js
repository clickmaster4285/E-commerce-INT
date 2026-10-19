import { customerApi } from "@/apis/admin/customerApi";
import { leadApi } from "@/apis/admin/leadApi";

export async function addLeadAsCustomer(lead) {
  const customerName = lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name;
  const notes = [
    lead.lead_type === "Business" && lead.name !== customerName ? `Contact person: ${lead.name}` : "",
    lead.lead_type === "Business" && lead.business_type ? `Business type: ${lead.business_type}` : "",
    lead.city ? `City: ${lead.city}` : "",
    lead.source ? `Lead source: ${lead.source}` : "",
    lead.assigned_employee_id?.name ? `Assigned employee: ${lead.assigned_employee_id.name}` : "",
    lead.next_follow_up_date ? `Next follow-up: ${new Date(lead.next_follow_up_date).toLocaleDateString()}` : "",
    lead.notes ? `Lead notes: ${lead.notes}` : "",
    lead.custom_requirements ? `Requirements: ${lead.custom_requirements}` : "",
    `Converted from lead ${lead.lead_number}`,
  ].filter(Boolean).join("\n");
  const customerPayload = {
    name: customerName,
    phone: lead.phone || "",
    email: lead.email || "",
    address: lead.lead_type === "Business" ? lead.business_address || "" : "",
    notes,
  };

  const matches = await customerApi.search(lead.email || lead.phone);
  const existing = matches.find((customer) =>
    (lead.email && customer.email?.trim().toLowerCase() === lead.email.trim().toLowerCase()) ||
    (lead.phone && customer.phone?.trim() === lead.phone.trim() && customer.name?.trim().toLowerCase() === customerName.trim().toLowerCase())
  );

  let customer;
  let alreadyExists = false;
  if (existing) {
    const marker = `Converted from lead ${lead.lead_number}`;
    const response = await customerApi.update(existing._id, {
      ...customerPayload,
      name: existing.name || customerName,
      phone: lead.phone || existing.phone || "",
      email: lead.email || existing.email || "",
      address: customerPayload.address || existing.address || "",
      notes: existing.notes?.includes(marker) ? existing.notes : [existing.notes, notes].filter(Boolean).join("\n\n"),
    });
    customer = response?.data || response;
    alreadyExists = true;
  } else {
    const response = await customerApi.create(customerPayload);
    customer = response?.data || response;
  }

  await leadApi.updateStatus(lead._id, { status: "Converted", customer_added: true });
  return { customer, alreadyExists };
}
