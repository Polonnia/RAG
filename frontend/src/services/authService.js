import http from '../api/http';

export async function login(username, password) {
  const res = await http.post('/login', { username, password });
  console.log('[authService.login] 服务器响应:', res.data);
  const { token, user } = res.data;
  console.log('[authService.login] token:', token);
  console.log('[authService.login] user:', user);
  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    console.log('[authService.login] 已保存到 localStorage');
    console.log('[authService.login] 验证保存的 user:', localStorage.getItem('user'));
  }
  return res.data;
}

export async function register({ username, password, role }) {
  const res = await http.post('/register', { username, password, role });
  return res.data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}


