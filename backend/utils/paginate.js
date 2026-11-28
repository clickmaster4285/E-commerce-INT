function parsePagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limitRaw = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function paginationMeta(page, limit, total) {
  const pages = Math.max(1, Math.ceil(total / limit) || 1);
  return { page, limit, total, pages, hasMore: page < pages };
}

module.exports = { parsePagination, paginationMeta };