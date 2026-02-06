import axios from 'axios';
import getApiUrl from '../apiConfig';

const http = axios.create({
  baseURL: getApiUrl(),
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export default http;


