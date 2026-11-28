const { z, objectIdParam } = require("./common");

const dealBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    dealType: z.string().trim().min(1).max(80).optional(),
    isActive: z.coerce.boolean().optional(),
    startDate: z.union([z.string(), z.coerce.date()]).optional(),
    endDate: z.union([z.string(), z.coerce.date()]).optional(),
    priority: z.coerce.number().int().optional(),
    code: z.string().max(80).optional(),
    usageLimit: z.coerce.number().int().min(0).nullable().optional(),
    perUserLimit: z.coerce.number().int().min(0).nullable().optional(),
    productIds: z.array(z.string()).optional(),
    categoryIds: z.array(z.string()).optional(),
    brandIds: z.array(z.string()).optional(),
    buyQuantity: z.coerce.number().optional(),
    getQuantity: z.coerce.number().optional(),
    discountValue: z.coerce.number().optional(),
    discountType: z.string().optional(),
    image: z.any().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Body cannot be empty" });

// Mass-assignment protected fields deliberately omitted (usedCount, createdBy, storeId, …)
module.exports = {
  createDeal: { body: dealBody },
  updateDeal: { params: objectIdParam, body: dealBody },
  dealId: { params: objectIdParam },
};
