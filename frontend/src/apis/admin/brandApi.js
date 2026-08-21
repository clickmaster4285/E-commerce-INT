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

export const adminBrandApi = {
  getAll: async () => {
    const response = await request("/brands/admin/all");
    return response.data || [];
  },
  getById: async (id) => {
    const response = await request(`/brands/${id}`);
    return response.data || response;
  },
  getNextCode: async () => {
    const response = await request("/brands/next-code");
    return response.data?.nextCode;
  },
  create: async (formData) => request("/brands", { method: "POST", body: formData }),
  update: async (id, formData) => request(`/brands/${id}`, { method: "PUT", body: formData }),
  delete: async (id) => request(`/brands/${id}`, { method: "DELETE" }),
};