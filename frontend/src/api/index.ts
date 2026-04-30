import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('ct_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('ct_token')
      localStorage.removeItem('ct_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (d: any) => api.post('/auth/register', d),
  me: () => api.get('/auth/me'),
}

// ── Shipments ─────────────────────────────────────────────────────────────
export const shipmentsApi = {
  list: (params?: any) => api.get('/shipments', { params }),
  get: (id: string) => api.get(`/shipments/${id}`),
  create: (d: any) => api.post('/shipments', d),
  update: (id: string, d: any) => api.put(`/shipments/${id}`, d),
  delete: (id: string) => api.delete(`/shipments/${id}`),
}

// ── Handoffs ──────────────────────────────────────────────────────────────
export const handoffsApi = {
  create: (d: any) => api.post('/handoffs', d),
  list: (shipmentId: string) => api.get(`/handoffs/${shipmentId}`),
}

// ── Documents ─────────────────────────────────────────────────────────────
export const documentsApi = {
  upload: (form: FormData) => api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list: (shipmentId: string) => api.get(`/documents/shipment/${shipmentId}`),
  verify: (id: string, form: FormData) => api.post(`/documents/verify/${id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

// ── Sensors ───────────────────────────────────────────────────────────────
export const sensorsApi = {
  push: (d: any) => api.post('/sensor/push', d),
  list: (shipmentId: string, limit?: number) => api.get(`/sensor/${shipmentId}`, { params: { limit } }),
}

// ── AI ────────────────────────────────────────────────────────────────────
export const aiApi = {
  predict: (shipmentId: string) => api.get(`/ai/predict/${shipmentId}`),
  anomalies: (params?: any) => api.get('/ai/anomalies', { params }),
  resolve: (id: string) => api.post(`/ai/anomalies/${id}/resolve`),
  history: (shipmentId: string) => api.get(`/ai/history/${shipmentId}`),
}

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
  anomaliesTrend: (days?: number) => api.get('/analytics/anomalies-trend', { params: { days } }),
  byCategory: () => api.get('/analytics/shipments-by-category'),
  monthlyStats: () => api.get('/analytics/monthly-stats'),
  tempExcursions: (days?: number) => api.get('/analytics/temperature-excursions', { params: { days } }),
  esgSummary: () => api.get('/analytics/esg/summary'),
  esg: (shipmentId: string) => api.get(`/analytics/esg/${shipmentId}`),
}

// ── Verify ────────────────────────────────────────────────────────────────
export const verifyApi = {
  get: (id: string) => api.get(`/verify/${id}`),
  search: (q: string) => api.get(`/verify/search`, { params: { q } }),
}

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  users: () => api.get('/admin/users'),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  toggleUser: (id: string) => api.patch(`/admin/users/${id}/toggle-active`),
  stats: () => api.get('/admin/system-stats'),
}

// ── Claims ────────────────────────────────────────────────────────────────
export const claimsApi = {
  list: (params?: any) => api.get('/claims', { params }),
  get: (id: string) => api.get(`/claims/${id}`),
  create: (d: any) => api.post('/claims', d),
  update: (id: string, d: any) => api.patch(`/claims/${id}`, d),
  stats: () => api.get('/claims/stats/summary'),
}

// ── Vehicles ──────────────────────────────────────────────────────────────
export const vehiclesApi = {
  list: () => api.get('/vehicles'),
  get: (vehicleNumber: string) => api.get(`/vehicles/${vehicleNumber}`),
}

export default api

