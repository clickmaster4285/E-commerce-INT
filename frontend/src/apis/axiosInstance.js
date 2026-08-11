import axios from "axios";
import Cookies from "js-cookie";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_SERVERURL,
  withCredentials: true,
});

// Request Interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error)
);

// ✅ Response Interceptor (FIXED - Infinite Loop Se Bachao)
axiosInstance.interceptors.response.use(
  (response) => response,
  
  async (error) => {
    const originalRequest = error.config;

    // Agar 401 Unauthorized hai aur humne abhi tak retry nahi kiya
    if (error.response?.status === 401 && !originalRequest._retry) {
      
      // Refresh token call karte waqt khud ko call karne se roko
      if (originalRequest.url === "/users/refresh-token") {
        // Refresh token bhi fail ho gaya, toh seedha login par jao
        if (typeof window !== "undefined") {
          // ✅ FIXED: localStorage.clear() → Cookies remove
          Cookies.remove("theme", { path: "/" });
          Cookies.remove("storeData", { path: "/" });
          Cookies.remove("storeName", { path: "/" });
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Chupke se backend ko bolo naya Access Token generate kare
        await axiosInstance.post("/users/refresh-token");
        
        // Refresh successful hone ke baad, original request dobara bhej do
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Agar Refresh Token bhi expire ho gaya, toh user ko login par bhej do
        if (typeof window !== "undefined") {
          // ✅ FIXED: localStorage.clear() → Cookies remove
          Cookies.remove("theme", { path: "/" });
          Cookies.remove("storeData", { path: "/" });
          Cookies.remove("storeName", { path: "/" });
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;