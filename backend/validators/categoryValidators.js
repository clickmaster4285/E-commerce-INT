const { z, objectIdParam } = require("./common");

const categoryBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    parent_category_id: z.union([z.string(), z.null()]).optional(),
    category_code: z.string().max(40).optional(),
    category_type: z.string().max(40).optional(),
    image_url: z.string().max(500).optional(),
    sort_order: z.coerce.number().int().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    attributes: z.array(z.any()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Body cannot be empty" });

module.exports = {
  createCategory: { body: categoryBody },
  updateCategory: { params: objectIdParam, body: categoryBody },
  categoryId: { params: objectIdParam },
};