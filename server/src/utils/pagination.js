function normalizePagination(page = 1, limit = 10, maxLimit = 50) {
  const normalizedPage = Math.max(1, Number(page) || 1);
  const normalizedLimit = Math.min(maxLimit, Math.max(1, Number(limit) || 10));
  const skip = (normalizedPage - 1) * normalizedLimit;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip,
  };
}

function buildPageInfo(totalCount, page, limit) {
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return {
    page,
    limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

module.exports = {
  normalizePagination,
  buildPageInfo,
};
