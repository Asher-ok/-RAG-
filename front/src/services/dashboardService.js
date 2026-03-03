import api from './api';

// 获取工作台统计数据
export const getDashboardStatistics = () => {
  return api.get('/dashboard/statistics');
};