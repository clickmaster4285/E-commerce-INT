const { z, objectIdParam } = require("./common");

const bannerBody = z
  .object({
    heading: z.string().max(300).optional(),
    eyebrow: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    altText: z.string().max(300).optional(),
    backgroundColor: z.string().max(40).optional(),
    position: z.coerce.number().int().min(0).optional(),
    status: z.enum(["draft", "active", "scheduled", "expired", "inactive"]).optional(),
    startDate: z.union([z.string(), z.coerce.date(), z.null()]).optional(),
    endDate: z.union([z.string(), z.coerce.date(), z.null()]).optional(),
    primaryButton: z.any().optional(),
    secondaryButton: z.any().optional(),
    displayRules: z.any().optional(),
    desktopImage: z.any().optional(),
    tabletImage: z.any().optional(),
    mobileImage: z.any().optional(),
  })
  .passthrough(); // multipart fields vary; strip handled by sanitizeBody

module.exports = {
  createBanner: { body: bannerBody },
  updateBanner: { params: objectIdParam, body: bannerBody },
  bannerId: { params: objectIdParam },
};
