const API_BASE_URL = process.env.NEXT_PUBLIC_SERVERURL || "http://localhost:5000/api";


// ================================
// TOKEN
// ================================
const getAuthHeaders = () => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};


// ================================
// RESPONSE HANDLER
// ================================
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};


// ================================
// REQUEST
// ================================
const request = async (endpoint, options = {}) => {
  const { body, ...restOptions } = options;

  const fetchOptions = {
    ...restOptions,
    headers: {
      ...getAuthHeaders(),
      ...(restOptions.headers || {}),
    },
  };

  // FormData hai (file upload) — Content-Type mat set karo
  if (body instanceof FormData) {
    fetchOptions.body = body;
  } else if (body) {
    // Plain object — JSON banao
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    fetchOptions
  );

  return handleResponse(response);
};


// ================================
// BRAND API
// ================================
export const brandApi = {

  // ✅ NEW: GET NEXT BRAND CODE (BRD-001, BRD-002, ...)
  getNextCode: async () => {
    const response = await request("/brands/next-code");
    return response.data?.nextCode || "BRD-001";
  },


  // GET ALL BRANDS
  getAll: async () => {
    const response = await request("/brands");

    if (response.data) {
      return response.data;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  },


  // GET SINGLE BRAND
  getById: async (id) => {
    const response = await request(`/brands/${id}`);
    return response.data || response;
  },


  // CREATE BRAND — FormData bhejna hai (file + text fields)
  create: async (formData) => {
    return await request("/brands", {
      method: "POST",
      body: formData,
    });
  },


  // UPDATE BRAND — FormData bhejna hai
  update: async (id, formData) => {
    return await request(`/brands/${id}`, {
      method: "PUT",
      body: formData,
    });
  },


  // DELETE BRAND
  delete: async (id) => {
    return await request(`/brands/${id}`, {
      method: "DELETE",
    });
  },

};