import api from './api';

// 获取授权链接或Playwright登录指引
const getAuthUrl = () => {
  return api.get('/auth/get_auth_url');
};

// 授权回调处理
const authCallback = (data) => {
  return api.post('/auth/callback', data);
};

// Playwright手动登录
const playwrightLogin = (data) => {
  return api.post('/playwright/manual-login', data);
};

// 验证Playwright登录状态
const verifyPlaywrightLogin = (accountId) => {
  return api.post('/playwright/verify-login', { account_id: accountId });
};

// 获取Playwright账号列表
const getPlaywrightAccounts = () => {
  return api.get('/playwright/accounts');
};

// 店铺列表
const getShopList = (params) => {
  return api.get('/auth/shop_list', { params });
};

// 禁用/启用店铺
const updateShopStatus = (shopId, status) => {
  return api.patch(`/auth/shop/${shopId}/status`, { status });
};

// 默认导出（对象形式）
export const shopService = {
  getAuthUrl,
  authCallback,
  playwrightLogin,
  verifyPlaywrightLogin,
  getPlaywrightAccounts,
  getShopList,
  updateShopStatus
};

// 命名导出（兼容旧代码）
export { 
  getAuthUrl, 
  authCallback, 
  playwrightLogin,
  verifyPlaywrightLogin,
  getPlaywrightAccounts,
  getShopList, 
  updateShopStatus 
};

// 默认导出（兼容 import shopService from ...）
export default shopService;
