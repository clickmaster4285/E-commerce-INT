import { userHttp } from "../axiosInstance";
// ==========================================
// ⭐ PRODUCT REVIEWS API
// ==========================================

export const reviewApi = {
  // 🌐 Public — reviews + summary + pagination (rating = 1-5 filter, optional)
  list: (productId, { page = 1, limit = 10, sort = "newest", rating = null } = {}) =>
    userHttp
      .get(`/reviews/product/${productId}`, {
        params: { page, limit, sort, rating: rating || undefined },
      })
      .then((res) => res.data),

  // 🔒 Current user ki apni reviews (product_id → rating map ke liye)
  mine: () =>
    userHttp.get("/reviews/my").then((res) => res.data?.reviews || []),

  // 🔒 Create — FormData (rating, title, comment, product_id, images[], videos[])
  create: (formData) =>
    userHttp
      .post("/reviews", formData)
      .then((res) => res.data),

  // 🔒 Edit own review (FormData — rating, title, comment, optional new images/videos)
  update: (id, data) => userHttp.put(`/reviews/${id}`, data).then((res) => res.data),

  // 🔒 Delete own review
  remove: (id) => userHttp.delete(`/reviews/${id}`).then((res) => res.data),

};

export const getReviewErrorMessage = (
  err,
  fallback = "Could not save the review. Please try again.",
) =>
  err?.response?.data?.message || err?.message || fallback;
