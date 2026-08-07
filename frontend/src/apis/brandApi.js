const API_BASE_URL = process.env.NEXT_PUBLIC_SERVERURL 

// ================================
// TOKEN (Ab cookies use ho rahi hain)
// ================================
const getAuthHeaders = () => {
  // Headers mein token nahi bhejna, cookies automatically bheji jayengi
  return {};
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
// REQUEST (✅ credentials: 'include' add kiya)
// ================================
const request = async (endpoint, options = {}) => {
  const { body, ...restOptions } = options;

  const fetchOptions = {
    ...restOptions,
    headers: {
      ...getAuthHeaders(),
      ...(restOptions.headers || {}),
    },
    credentials: 'include', // ✅ Ye LINE BOHAT ZAROORI HAI - Cookies bhejne ke liye
  };

  if (body instanceof FormData) {
    fetchOptions.body = body;
  } else if (body) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  return handleResponse(response);
};

// ================================
// BRAND API
// ================================
export const brandApi = {
  // GET NEXT BRAND CODE
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

  // GET BRAND WITH PRODUCTS
  getWithProducts: async (id) => {
    const response = await request(`/brands/${id}/details`);
    return response.data || response;
  },

  // CREATE BRAND
  create: async (formData) => {
    return await request("/brands", {
      method: "POST",
      body: formData,
    });
  },

  // UPDATE BRAND
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