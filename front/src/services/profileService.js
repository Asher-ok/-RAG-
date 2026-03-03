import api from './api';

// 更新用户信息
export const updateUserInfo = (data) => {
  return api.post('/profile/update_info', data);
};