const { z, objectIdParam } = require("./common");

const brandBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    brand_code: z.string().max(40).optional(),
    website: z.string().max(300).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    logo: z.any().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Body cannot be empty" });

module.exports = {
  createBrand: { body: brandBody },
  updateBrand: { params: objectIdParam, body: brandBody },
  brandId: { params: objectIdParam },
};
