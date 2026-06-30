import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// CSRF token interceptor — attach csrf-token from cookie to mutating requests
api.interceptors.request.use((config) => {
  if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='));
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1];
      if (csrfToken && config.headers) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }
  }
  return config;
});

// CSRF token interceptor — attach csrf-token from cookie to mutating requests
api.interceptors.request.use((config) => {
  if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method)) {
    const csrfCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf-token='));
    if (csrfCookie) {
      const csrfToken = csrfCookie.split('=')[1];
      if (csrfToken && config.headers) {
        config.headers['x-csrf-token'] = csrfToken;
      }
    }
  }
  return config;
});
