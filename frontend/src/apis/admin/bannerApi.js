import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5000/api' });

export const bannerAPI = {
  list:   (params) => api.get('/banners', { params }),
  active: (page)   => api.get('/banners/active', { params: { page } }),
  get:    (id)     => api.get(`/banners/${id}`),
  create: (data)   => api.post('/banners', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => api.put(`/banners/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggle: (id)     => api.patch(`/banners/${id}/toggle`),
  duplicate: (id)  => api.post(`/banners/${id}/duplicate`),
  delete: (id)     => api.delete(`/banners/${id}`),
};