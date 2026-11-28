const { z, objectIdParam } = require("./common");

const vendorBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    company_name: z.string().max(200).optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().max(40).optional(),
    city: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    vendor_code: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
    bank_details: z
      .object({
        bank_name: z.string().max(120).optional(),
        account_title: z.string().max(120).optional(),
        account_no: z.string().max(80).optional(),
        iban: z.string().max(80).optional(),
      })
      .partial()
      .optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Body cannot be empty" });

module.exports = {
  createVendor: { body: vendorBody },
  updateVendor: { params: objectIdParam, body: vendorBody },
  vendorId: { params: objectIdParam },
};
