const API_BASE_URL = process.env.NEXT_PUBLIC_SERVERURL;

// ⚠️ SAFETY CHECK - Hardcoded values nahi chahiye
if (!API_BASE_URL) {
  console.error("❌ NEXT_PUBLIC_SERVERURL is missing in .env.local");
}

// ================================
// RESPONSE HANDLER
// ================================
const handleResponse = async (response) => {
  const data = await response.json();

  if (!response.ok) {
    // 401 par frontend ko pata chale ke session expire ho gaya
    if (response.status === 401) {
      console.warn("⚠️ Unauthorized - Session expired or invalid cookie");
    }
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

// ================================
// REQUEST (✅ Fully Cookie-Based)
// ================================
const request = async (endpoint, options = {}) => {
  const { body, ...restOptions } = options;

  const fetchOptions = {
    ...restOptions,
    credentials: "include", // ⭐ YEH ZAROORI HAI: HttpOnly cookies automatically bhejta hai
    headers: {
      ...(restOptions.headers || {}),
    },
  };

  if (body instanceof FormData) {
    // FormData ke liye Content-Type mat set karo
    // Browser khud multipart/form-data boundary lagata hai
    fetchOptions.body = body;
  } else if (body !== undefined && body !== null) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, fetchOptions);

  return handleResponse(response);
};

// ================================
// BRAND API
// ================================
export const brandApi = {
  getNextCode: async () => {
    const response = await request("/brands/next-code");
    return response.data?.nextCode;
  },

  getAll: async () => {
    const response = await request("/brands");
    if (response.data) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  },

  getById: async (id) => {
    const response = await request(`/brands/${id}`);
    return response.data || response;
  },

  getWithProducts: async (id) => {
    const response = await request(`/brands/${id}/details`);
    return response.data || response;
  },

  create: async (formData) => {
    return await request("/brands", {
      method: "POST",
      body: formData,
    });
  },

  update: async (id, formData) => {
    return await request(`/brands/${id}`, {
      method: "PUT",
      body: formData,
    });
  },

  delete: async (id) => {
    return await request(`/brands/${id}`, {
      method: "DELETE",
    });
  },
};