import axios from "axios";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVERURL,
  withCredentials: true, // 🔥 Cookies bhejne ke liye zaroori
});

// ==========================================
// 🔐 HELPER: Sirf Admin pages par redirect kare
// ==========================================
const redirectToLogin = () => {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;

  // ✅ Agar user already /login par hai, toh kuch mat karo (infinite loop se bachao)
  if (path === "/login" || path === "/register") {
    return;
  }

  // ✅ Agar admin page par hai, toh login par bhejo
  if (path.startsWith("/admin")) {
    localStorage.clear();
    window.location.href = "/login";
    return;
  }
  
  // ✅ Staff dashboard ya other protected routes ke liye bhi redirect
  if (path.startsWith("/dashboard")) {
     window.location.href = "/login";
     return;
  }
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
// 📥 Response Interceptor (SMART - Fixed for Login)
// ==========================================
axiosInstance.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // 🛑 FIX: Agar request LOGIN endpoint ki hai, toh Refresh Token logic SKIP karo.
    // Kyunke login ke waqt token hota hi nahi hai, refresh try karna error deta hai.
    const isLoginRequest = originalRequest.url?.includes("/users/login");
    
    if (isLoginRequest) {
      return Promise.reject(error); // Seedha error frontend ko bhej do (e.g., Wrong Password)
    }

    // Agar 401 Unauthorized hai aur humne abhi tak retry nahi kiya
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Refresh token call karte waqt khud ko call karne se roko
      if (originalRequest.url === "/users/refresh-token") {
        redirectToLogin(); 
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
        redirectToLogin(); 
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;