import axiosInstance from "../axiosInstance";

const normalizeList = (res, fallbackLimit) => {
  const d = res?.data;
  return {
    reviews: Array.isArray(d?.reviews) ? d.reviews : [],
    stats: d?.stats || {
      total: 0,
      visible: 0,
      hidden: 0,
      five: 0,
      avg: 0,
    },
    pagination: d?.pagination || {
      total: 0,
      page: 1,
      limit: fallbackLimit,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };
};

export const adminReviewApi = {
  // Admin review list and filters
  list: ({ page = 1, limit = 20, search = "", rating = "all", status = "all", sort = "newest" } = {}) => {
    const params = { page, limit, sort };
    if (search) params.search = search;
    if (rating && rating !== "all") params.rating = rating;
    if (status && status !== "all") params.status = status;
    return axiosInstance.get("/reviews/admin/all", { params }).then((res) => normalizeList(res, limit));
  },

  get: (id) => axiosInstance.get(`/reviews/admin/${id}`).then((res) => res.data?.review || null),

  // 🛡️ Admin — hide / unhide
  setStatus: (id, status) =>
    axiosInstance.patch(`/reviews/${id}/status`, { status }).then((res) => res.data),

  setResponse: (id, message) =>
    axiosInstance.patch(`/reviews/${id}/response`, { message }).then((res) => res.data?.review || null),

  deleteResponse: (id) =>
    axiosInstance.delete(`/reviews/${id}/response`).then((res) => res.data),
};

export default adminReviewApi;
