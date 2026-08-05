// ==========================================
// BRANDS API
// Is file mein sirf brands se related APIs hain
// ==========================================


const API_BASE_URL = process.env.SERVERURL || "http://localhost:5000/api"; // Backend ka base URL
// Token ke sath headers
const getAuthHeaders = () => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Response + error handling
const handleResponse = async (res) => {
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Token required - please login again");
    }
    let errorMessage = "Request failed";
    try {
      const errorData = await res.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // JSON parse na ho to default message
    }
    throw new Error(errorMessage);
  }
  return res.json();
};

// ✅ Brands API functions
export const brandApi = {
  // Sari brands lana
  getAll: async () => {
    const data = await fetch(`${API_BASE_URL}/brands`, {
      headers: getAuthHeaders(),
    }).then(handleResponse);
    return Array.isArray(data) ? data : [];
  },

  // Ek brand lana
  getById: (id) =>
    fetch(`${API_BASE_URL}/brands/${id}`, {
      headers: getAuthHeaders(),
    }).then(handleResponse),

  // Nayi brand create karna
  create: (data) =>
    fetch(`${API_BASE_URL}/brands`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Brand update karna
  update: (id, data) =>
    fetch(`${API_BASE_URL}/brands/${id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse),

  // Brand delete karna
  delete: (id) =>
    fetch(`${API_BASE_URL}/brands/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    }).then(handleResponse),
};