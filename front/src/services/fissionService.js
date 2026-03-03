import api from './api';

// 创建裂变任务（只创建记录，不执行）
export const createFission = (data) => {
  return api.post('/fission/create', data);
};

// 更新裂变任务进度（前端上报）
export const updateFissionProgress = (data) => {
  return api.post('/fission/update_progress', data);
};

// 完成裂变任务（前端上报最终结果）
export const completeFissionTask = (data) => {
  return api.post('/fission/complete_task', data);
};

// 查询裂变任务进度
export const getTaskStatus = (params) => {
  return api.get('/fission/task_status', { params });
};

// 查询店铺下的裂变任务列表
export const getTaskList = (params) => {
  return api.get('/fission/task_list', { params });
};

// 裂变记录
export const getFissionRecords = (params) => {
  return api.get('/fission/records', { params });
};

// 取消裂变任务
export const cancelTask = (data) => {
  return api.post('/fission/cancel_task', data);
};

// 计算素材组合数
export const calculateCombinations = (data) => {
  return api.post('/fission/calculate_combinations', data);
};

// 重试失败的裂变项
export const retryFailedFission = (data) => {
  return api.post('/fission/retry_failed', data);
};
