const API_BASE_URL = process.env.NEXT_PUBLIC_SERVERURL;

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
};

const request = async (endpoint, options = {}) => {
  const { body, ...restOptions } = options;
  const fetchOptions = {
    ...restOptions,
    credentials: "include",
    headers: { ...(restOptions.headers || {}) },
  };
  if (body instanceof FormData) {
    fetchOptions.body = body;
  } else if (body !== undefined && body !== null) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }
  return handleResponse(await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions));
};

export const discountApi = {
  // ✅ FIXED: Sahi admin endpoint hit karega jo backend par define hai
  getAll: async () => {
    const response = await request("/discounts/admin/all");
    return response; // Backend seedha array bhej raha hai is liye direct return
  },
  
  getById: async (id) => {
    const response = await request(`/discounts/${id}`);
    return response;
  },
  
  create: async (formData) => request("/discounts", { method: "POST", body: formData }),
  update: async (id, formData) => request(`/discounts/${id}`, { method: "PUT", body: formData }),
  delete: async (id) => request(`/discounts/${id}`, { method: "DELETE" }),
};