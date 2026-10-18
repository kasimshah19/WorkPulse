import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to unwrap envelope { success, data, error }
api.interceptors.response.use(
  (response) => {
    // If the server returns standard envelope, return response.data.data directly
    if (response.data && response.data.success !== undefined) {
      return response.data;
    }
    return response;
  },
  (error) => {
    // Format error payload
    const errData = error.response?.data?.error;
    const message = errData?.message || error.message || 'Network error occurred';
    const code = errData?.code || 'ERROR';

    const enhancedError = new Error(message);
    enhancedError.code = code;
    enhancedError.status = error.response?.status;
    enhancedError.details = errData?.details;

    return Promise.reject(enhancedError);
  }
);

export default api;
