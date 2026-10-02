import adminHttp from "../adminHttp";
export const tagApi = {
  getAll: () => 
    adminHttp.get("/tags").then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      return [];
    }),
  
  create: (data) => adminHttp.post("/tags", data).then((res) => res.data?.data || res.data),
  
  update: (id, data) => adminHttp.put(`/tags/${id}`, data).then((res) => res.data?.data || res.data),
  
  delete: (id) => adminHttp.delete(`/tags/${id}`).then((res) => res.data),
};