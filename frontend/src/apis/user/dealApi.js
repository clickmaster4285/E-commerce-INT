import { userHttp } from "../axiosInstance";
export const dealApi = {
  // ✅ slim=1: home storefront wale fields hi (615KB → chhota). Shape same (array).
  getActive: () =>
    userHttp
      .get("/deals/active", { params: { slim: 1 } })
      .then((res) => res.data?.data || []),

  getById: (id, page = 1, limit = 20) =>
    userHttp.get(`/deals/active/${id}?page=${page}&limit=${limit}`).then((res) => res.data?.data),
};
