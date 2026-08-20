// src/services/api.js
// TODO: Configure axios instance with:
// - baseURL from import.meta.env.VITE_API_BASE_URL
// - Request interceptor: attach Bearer token from localStorage
// - Response interceptor: handle 401 (redirect to login), 403 (show error)

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
});

// TODO: Add request interceptor for JWT token
// api.interceptors.request.use(...)

// TODO: Add response interceptor for error handling
// api.interceptors.response.use(...)

export default api;
