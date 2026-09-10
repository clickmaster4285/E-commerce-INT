const API_BASE = process.env.NEXT_PUBLIC_SERVERURL;

if (!API_BASE) {
  console.warn(
    "⚠️ NEXT_PUBLIC_SERVERURL is not set in .env.local. Using default localhost."
  );
}

export async function apiFetch(endpoint, options = {}) {
  const baseUrl = API_BASE;

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}