import adminHttp from "../axiosInstance";

export const translatePage = ({ model, ids, locale }) =>
  adminHttp.post("/translations/page", { model, ids, locale }).then((res) => res.data);
