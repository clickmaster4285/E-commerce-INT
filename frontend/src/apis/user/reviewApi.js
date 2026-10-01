import axiosInstance from "../axiosInstance";

// ==========================================
// ⭐ PRODUCT REVIEWS API
// ==========================================

export const reviewApi = {
  // 🌐 Public — reviews + summary + pagination (rating = 1-5 filter, optional)
  list: (productId, { page = 1, limit = 10, sort = "newest", rating = null } = {}) =>
    axiosInstance
      .get(`/reviews/product/${productId}`, {
        params: { page, limit, sort, rating: rating || undefined },
      })
      .then((res) => res.data),

  // 🔒 Create — FormData (rating, title, comment, product_id, images[], videos[])
  create: (formData) =>
    axiosInstance
      .post("/reviews", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((res) => res.data),

  // 🔒 Edit own review (text fields)
  update: (id, data) =>
    axiosInstance.put(`/reviews/${id}`, data).then((res) => res.data),

  // 🔒 Delete own review
  remove: (id) => axiosInstance.delete(`/reviews/${id}`).then((res) => res.data),

  // 🔒 Helpful vote toggle
  helpful: (id) => axiosInstance.post(`/reviews/${id}/helpful`).then((res) => res.data),
};

export const getReviewErrorMessage = (
  err,
  fallback = "Could not save the review. Please try again.",
) =>
  err?.response?.data?.message || err?.message || fallback;
