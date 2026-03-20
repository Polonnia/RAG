import axios from 'axios';
import getApiUrl from '../apiConfig';

const http = axios.create({
  baseURL: getApiUrl(),
  timeout: 60000, // 增加超时时间到60秒，因为生成习题可能需要时间
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('[HTTP] 请求:', config.method?.toUpperCase(), config.url, config.data);
  return config;
});

http.interceptors.response.use(
  (response) => {
    console.log('[HTTP] 响应成功:', response.status, response.data);
    return response;
  },
  (error) => {
    console.error('[HTTP] 响应错误:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

export default http;


