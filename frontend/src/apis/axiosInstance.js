import axios from "axios";
import Cookies from "js-cookie";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVERURL,
  withCredentials: true,
});

// ==========================================
// 🔐 HELPER: Sirf Admin pages par redirect kare
// ==========================================
const redirectToLogin = () => {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;

  // ✅ Agar user already /login par hai, toh kuch mat karo (infinite loop se bachao)
  if (path === "/login" || path === "/register" || path === "/admin/login") {
  return;
}

  // ✅ Agar admin page par hai, toh login par bhejo
 // ✅ Agar admin page par hai, toh ADMIN login par bhejo
if (path.startsWith("/admin")) {
  localStorage.clear();
  window.location.href = "/admin/login";   // ❌ purana: "/login"
  return;
}

  // ❌ Agar user page par hai (/, /product, /category, /brand) toh REDIRECT MAT KARO
  // Sirf error silently reject hoga, user page waise hi kaam karega
};

// ==========================================
// 📤 Request Interceptor
// ==========================================
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// 📥 Response Interceptor (SMART - Admin + User Dono Ke Liye)
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Agar 401 Unauthorized hai aur humne abhi tak retry nahi kiya
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Refresh token call karte waqt khud ko call karne se roko
      if (originalRequest.url === "/users/refresh-token") {
        // Refresh token bhi fail ho gaya
        redirectToLogin(); // ✅ Smart redirect (sirf admin pages par)
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Chupke se backend ko bolo naya Access Token generate kare
        await axiosInstance.post("/users/refresh-token");
        
        // Refresh successful hone ke baad, original request dobara bhej do
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Agar Refresh Token bhi expire ho gaya
        redirectToLogin(); // ✅ Smart redirect (sirf admin pages par)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;