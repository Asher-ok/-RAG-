import axios from 'axios';
import { API_BASE_URL } from '../config';

// 根据环境设置 API 地址
const getBaseURL = () => {
  // 检查是否在 Electron 环境
  const isElectron = window.electronAPI !== undefined;
  
  // Electron 环境：直接使用服务器地址
  if (isElectron) {
    console.log('[API Config] Electron环境，使用服务器地址:', API_BASE_URL);
    return API_BASE_URL;
  }
  
  // Web 开发环境：使用代理（相对路径）
  if (import.meta.env.DEV) {
    console.log('[API Config] Web开发环境，使用Vite代理');
    return '/api/v1';  // 使用相对路径，由Vite代理转发
  }
  
  // Web 生产环境：使用服务器地址
  console.log('[API Config] Web生产环境，使用服务器地址:', API_BASE_URL);
  return API_BASE_URL;
};

// 创建axios实例
const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 300000,  // 5分钟超时（300秒），适配商品同步等长时间操作
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    // 如果是blob类型的响应（文件下载），直接返回完整response
    if (response.config.responseType === 'blob') {
      return response;
    }
    return response.data;
  },
  (error) => {
    console.error('[API Error]', error);
    
    if (error.response) {
      console.error('[API Error Response]', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
      });
      
      // 处理401未授权
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        window.location.href = '/login';
      }
      
      // 422 参数验证错误，返回详细信息
      if (error.response.status === 422) {
        const detail = error.response.data?.detail;
        if (detail) {
          console.error('[API 422 详细错误]', detail);
          // 格式化验证错误信息
          if (Array.isArray(detail)) {
            const errorMsg = detail.map(err => `${err.loc?.join('.')} : ${err.msg}`).join('; ');
            return Promise.reject({ 
              code: 422, 
              msg: `参数验证失败: ${errorMsg}`,
              detail: detail 
            });
          }
        }
      }
      
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
