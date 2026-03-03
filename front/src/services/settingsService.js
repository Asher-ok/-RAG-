import api from './api';

// 获取系统配置
export const getSystemConfig = () => {
  return api.get('/settings/system_config');
};

// 更新系统配置
export const updateSystemConfig = (data) => {
  return api.post('/settings/system_config', data);
};

// 重置系统配置
export const resetSystemConfig = () => {
  return api.post('/settings/reset_config');
};

// 测试抖音API连接
export const testDouyinAPI = (data) => {
  return api.post('/settings/test_douyin_api', data);
};