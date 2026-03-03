import api from './api';

// 上传图片到抖音图床
export const uploadImage = (shopId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(`/product/upload_image?shop_id=${shopId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// 批量创建商品
export const batchCreateProducts = (data) => {
  return api.post('/product/batch_create', data);
};

// 查询上架任务进度
export const getTaskStatus = (taskId) => {
  return api.get('/product/task_status', {
    params: { task_id: taskId }
  });
};

// 取消上架任务
export const cancelTask = (taskId) => {
  return api.post('/product/cancel_task', { task_id: taskId });
};

// 同步商品状态
export const syncProductStatus = (data) => {
  return api.post('/product/sync_status', data);
};

// 商品列表
export const getProductList = (params) => {
  console.log('[ProductService] 调用 getProductList API，参数:', params);
  console.log('[ProductService] 请求URL: /product/list');
  
  return api.get('/product/list', { params })
    .then(response => {
      console.log('[ProductService] API响应成功:', {
        code: response.code,
        success: response.data?.success,
        message: response.data?.message || response.msg,
        listLength: response.data?.list?.length
      });
      return response;
    })
    .catch(error => {
      console.error('[ProductService] API请求失败:', {
        status: error.response?.status,
        message: error.response?.data?.msg || error.message,
        url: error.config?.url
      });
      throw error;
    });
};

// 任务列表
export const getTaskList = (params) => {
  return api.get('/product/task_list', { params });
};

// 导入Excel/CSV文件
export const importExcel = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post('/product/import_excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// 下载导入模板
export const downloadTemplate = () => {
  return api.get('/product/download_template', {
    responseType: 'blob'
  });
};
