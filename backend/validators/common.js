const { z } = require("zod");

const objectId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid id");

const objectIdParam = z.object({
  id: objectId,
});

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().max(200).optional(),
  locale: z.string().max(8).optional(),
}).passthrough();

module.exports = { z, objectId, objectIdParam, paginationQuery };
