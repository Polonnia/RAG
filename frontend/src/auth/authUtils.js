export function getToken() {
  return localStorage.getItem('token') || '';
}

export function getUser() {
  try {
    const s = localStorage.getItem('user');
    const user = s ? JSON.parse(s) : null;
    console.log('[authUtils.getUser] 原始数据:', s);
    console.log('[authUtils.getUser] 解析后用户:', user);
    return user;
  } catch (e) {
    console.error('[authUtils.getUser] 解析失败:', e);
    return null;
  }
}

export function hasRole(...roles) {
  const user = getUser();
  if (!user) return false;
  return roles.includes(user.role);
}


