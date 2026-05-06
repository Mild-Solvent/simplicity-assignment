import axios from 'axios';

const BASE_URL = 'http://localhost:3001/api';

const api = axios.create({ baseURL: BASE_URL });

export const getAnnouncements = (params) =>
  api.get('/announcements', { params }).then((r) => r.data);

export const getAnnouncement = (id) =>
  api.get(`/announcements/${id}`).then((r) => r.data);

export const createAnnouncement = (data) =>
  api.post('/announcements', data).then((r) => r.data);

export const updateAnnouncement = (id, data) =>
  api.put(`/announcements/${id}`, data).then((r) => r.data);

export const deleteAnnouncement = (id) =>
  api.delete(`/announcements/${id}`);
