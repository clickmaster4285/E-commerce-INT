import adminHttp from "../axiosInstance";

export const translatePage = ({ model, ids, locale }) =>
  adminHttp.post("/translations/page", { model, ids, locale }).then((res) => res.data);

export const translateTerms = ({ text, locale }) =>
  adminHttp.post("/translations/terms", { text, locale }).then((res) => res.data?.data || res.data);
