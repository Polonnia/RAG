import http from './http';

export const login = (username, password) =>
  http.post('/auth/login', { username, password }).then(r => r.data);

export const logout = () => http.post('/auth/logout').then(r => r.data);

export const getProfile = () => http.get('/auth/me').then(r => r.data);

export default { login, logout, getProfile };


