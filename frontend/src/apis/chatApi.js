import adminHttp, { userHttp } from "@/apis/axiosInstance";

const unwrap = (response) => response.data?.data ?? response.data;

export const customerChatApi = {
  openGeneral: async () => unwrap(await userHttp.post("/chats/general")),
  openForOrder: async (orderId) => unwrap(await userHttp.post(`/chats/order/${orderId}`)),
  listMine: async () => unwrap(await userHttp.get("/chats/mine")),
  details: async (id) => unwrap(await userHttp.get(`/chats/${id}`)),
  setInquiryContext: async (id, context) => unwrap(await userHttp.patch(`/chats/${id}/context`, context)),
  messages: async (id, before) => unwrap(await userHttp.get(`/chats/${id}/messages`, { params: { limit: 100, ...(before ? { before } : {}) } })),
  send: async (id, text, context) => unwrap(await userHttp.post(`/chats/${id}/messages`, { text, ...(context ? { context } : {}) })),
  markRead: async (id) => unwrap(await userHttp.patch(`/chats/${id}/read`)),
};

const guestConfig = (token) => ({ headers: { "X-Chat-Guest-Token": token } });
export const guestChatApi = {
  start: async (name, email, token = "") => unwrap(await userHttp.post("/chats/guest/start", { name, email }, token ? guestConfig(token) : undefined)),
  mine: async (token) => unwrap(await userHttp.get("/chats/guest/mine", guestConfig(token))),
  details: async (id, token) => unwrap(await userHttp.get(`/chats/guest/${id}`, guestConfig(token))),
  setInquiryContext: async (id, context, token) => unwrap(await userHttp.patch(`/chats/guest/${id}/context`, context, guestConfig(token))),
  messages: async (id, before, token) => unwrap(await userHttp.get(`/chats/guest/${id}/messages`, { ...guestConfig(token), params: { limit: 100, ...(before ? { before } : {}) } })),
  send: async (id, text, token, context) => unwrap(await userHttp.post(`/chats/guest/${id}/messages`, { text, ...(context ? { context } : {}) }, guestConfig(token))),
  markRead: async (id, token) => unwrap(await userHttp.patch(`/chats/guest/${id}/read`, {}, guestConfig(token))),
};

export const adminChatApi = {
  list: async (params) => {
    const response = await adminHttp.get("/chats/admin/conversations", { params });
    return { ...response.data, data: response.data?.data ?? [] };
  },
  unreadCount: async () => unwrap(await adminHttp.get("/chats/admin/unread-count")),
  details: async (id) => unwrap(await adminHttp.get(`/chats/${id}`)),
  messages: async (id, before) => unwrap(await adminHttp.get(`/chats/${id}/messages`, { params: { limit: 100, ...(before ? { before } : {}) } })),
  send: async (id, text, context) => unwrap(await adminHttp.post(`/chats/${id}/messages`, { text, ...(context ? { context } : {}) })),
  markRead: async (id) => unwrap(await adminHttp.patch(`/chats/${id}/read`)),
  setStatus: async (id, status) => unwrap(await adminHttp.patch(`/chats/admin/${id}/status`, { status })),
};
