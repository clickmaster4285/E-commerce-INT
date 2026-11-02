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

  // A lead represents its own customer record. Email and phone are contact
  // details and may be shared, so they must not be used to merge customers.
  const response = await customerApi.create(customerPayload);
  const customer = response?.data || response;

  await leadApi.updateStatus(lead._id, { status: "Customer", customer_added: true, customer_id: customer._id });
  return { customer, alreadyExists: false };
}
