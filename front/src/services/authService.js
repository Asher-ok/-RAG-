import api from './api';

// 用户注册
export const register = (data) => {
  return api.post('/auth/register', data);
};

// 用户登录
export const login = (data) => {
  return api.post('/auth/login', data);
};

// 用户登出
export const logout = () => {
  return api.post('/auth/logout');
};

// 获取当前用户信息
export const getCurrentUser = () => {
  return api.get('/auth/current_user');
};

// 修改密码
export const changePassword = (data) => {
  return api.post('/auth/change_password', data);
};
