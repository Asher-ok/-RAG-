/**
 * 全局配置文件
 * 统一管理所有环境的配置
 */

// 服务器后端地址（所有环境统一使用）
export const API_BASE_URL = 'http://localhost:8000/api/v1';

// 其他配置
export const config = {
  // API配置
  api: {
    baseURL: API_BASE_URL,
    timeout: 10000,
  },
  
  // 应用配置
  app: {
    name: '抖店商家助手',
    version: '1.0.0',
  },
};

export default config;
