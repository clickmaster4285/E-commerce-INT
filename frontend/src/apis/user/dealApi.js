import axiosInstance from "../axiosInstance";

export const dealApi = {
  getActive: () =>
    axiosInstance.get("/deals/active").then((res) => res.data?.data || []),
    
  getById: (id, page = 1, limit = 20) =>
    axiosInstance.get(`/deals/active/${id}?page=${page}&limit=${limit}`).then((res) => res.data?.data),
};