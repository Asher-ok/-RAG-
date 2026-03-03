import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { 
  getProductList, 
  batchCreateProducts, 
  getTaskStatus, 
  cancelTask, 
  syncProductStatus,
  importExcel,
  uploadImage
} from '../../services/productService';

// 异步获取商品列表
export const fetchProductList = createAsyncThunk(
  'product/fetchProductList',
  async (params, { rejectWithValue }) => {
    try {
      console.log('[Redux] 开始获取商品列表，参数:', JSON.stringify(params, null, 2));
      
      const response = await getProductList(params);
      
      console.log('[Redux] API响应:', {
        code: response.code,
        success: response.data?.success,
        message: response.data?.message || response.msg,
        listLength: response.data?.list?.length,
        total: response.data?.total
      });
      
      if (response.code === 200 && response.data.success) {
        console.log('[Redux] 获取商品列表成功，商品数量:', response.data.list?.length || 0);
        return {
          list: response.data.list || [],
          total: response.data.total || 0,
          total_pages: response.data.total_pages || 0,
          params
        };
      } else {
        const errorMsg = response.msg || response.data?.message || '获取商品列表失败';
        console.error('[Redux] 获取商品列表失败:', errorMsg);
        console.error('[Redux] 完整响应:', JSON.stringify(response, null, 2));
        return rejectWithValue(errorMsg);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.msg || error.message || '获取商品列表失败';
      console.error('[Redux] 请求异常:', errorMsg);
      console.error('[Redux] 错误详情:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      return rejectWithValue(errorMsg);
    }
  }
);

// 异步批量创建商品
export const createProductsBatch = createAsyncThunk(
  'product/createProductsBatch',
  async (data, { rejectWithValue }) => {
    try {
      const response = await batchCreateProducts(data);
      if (response.code === 200) {
        return {
          task_id: response.data.task_id,
          invalid_product_list: response.data.invalid_product_list || []
        };
      } else {
        return rejectWithValue(response.msg || '批量创建失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '批量创建失败');
    }
  }
);

// 异步获取任务状态
export const fetchTaskStatus = createAsyncThunk(
  'product/fetchTaskStatus',
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await getTaskStatus(taskId);
      if (response.code === 200) {
        return {
          task_id: taskId,
          ...response.data
        };
      } else {
        return rejectWithValue(response.msg || '获取任务状态失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '获取任务状态失败');
    }
  }
);

// 异步取消任务
export const cancelProductTask = createAsyncThunk(
  'product/cancelTask',
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await cancelTask(taskId);
      if (response.code === 200) {
        return taskId;
      } else {
        return rejectWithValue(response.msg || '取消任务失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '取消任务失败');
    }
  }
);

// 异步同步商品状态
export const syncProducts = createAsyncThunk(
  'product/syncProducts',
  async ({ shop_id, product_ids }, { rejectWithValue }) => {
    try {
      const response = await syncProductStatus({ shop_id, product_ids });
      if (response.code === 200) {
        return {
          sync_count: response.data.sync_count,
          product_ids
        };
      } else {
        return rejectWithValue(response.msg || '同步失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '同步失败');
    }
  }
);

// 异步导入Excel
export const importProductExcel = createAsyncThunk(
  'product/importExcel',
  async (file, { rejectWithValue }) => {
    try {
      const response = await importExcel(file);
      if (response.code === 200) {
        return {
          products: response.data.products || [],
          total_count: response.data.total_count || 0,
          invalid_rows: response.data.invalid_rows || []
        };
      } else {
        return rejectWithValue(response.msg || '导入失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '导入失败');
    }
  }
);

// 异步上传图片
export const uploadProductImage = createAsyncThunk(
  'product/uploadImage',
  async ({ shopId, file }, { rejectWithValue }) => {
    try {
      const response = await uploadImage(shopId, file);
      if (response.code === 200) {
        return {
          image_url: response.data.image_url,
          file_name: file.name
        };
      } else {
        return rejectWithValue(response.msg || '上传失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '上传失败');
    }
  }
);

const initialState = {
  // 商品列表
  productList: [],
  listLoading: false,
  listError: null,
  
  // 分页信息
  pagination: {
    current: 1,
    pageSize: 20,
    total: 0,
    total_pages: 0
  },
  
  // 筛选条件
  filters: {
    shop_id: null,
    product_status: null,
    keyword: ''
  },
  
  // 选中的商品
  selectedProducts: [],
  
  // 批量创建
  createLoading: false,
  createError: null,
  lastCreateResult: null, // { task_id, invalid_product_list }
  
  // 任务管理
  tasks: {}, // { task_id: { total, success_count, failed, status, failed_list, start_time, end_time } }
  taskLoading: {},
  taskError: {},
  
  // 同步状态
  syncLoading: false,
  syncError: null,
  lastSyncResult: null,
  
  // Excel导入
  importLoading: false,
  importError: null,
  importResult: null, // { products, total_count, invalid_rows }
  
  // 图片上传
  uploadLoading: {},
  uploadError: {},
  uploadedImages: [], // [{ image_url, file_name }]
  
  // 全局错误
  error: null
};

const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    // 清除错误
    clearError: (state) => {
      state.error = null;
      state.listError = null;
      state.createError = null;
      state.syncError = null;
      state.importError = null;
    },
    
    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    // 设置分页
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    
    // 选中商品
    setSelectedProducts: (state, action) => {
      state.selectedProducts = action.payload;
    },
    
    // 添加选中商品
    addSelectedProduct: (state, action) => {
      const productId = action.payload;
      if (!state.selectedProducts.includes(productId)) {
        state.selectedProducts.push(productId);
      }
    },
    
    // 移除选中商品
    removeSelectedProduct: (state, action) => {
      const productId = action.payload;
      state.selectedProducts = state.selectedProducts.filter(id => id !== productId);
    },
    
    // 清空选中商品
    clearSelectedProducts: (state) => {
      state.selectedProducts = [];
    },
    
    // 更新商品状态（本地更新）
    updateProductStatus: (state, action) => {
      const { product_id, status } = action.payload;
      const product = state.productList.find(p => p.product_id === product_id);
      if (product) {
        product.product_status = status;
      }
    },
    
    // 批量更新商品状态
    updateProductsStatus: (state, action) => {
      const { product_ids, status } = action.payload;
      state.productList.forEach(product => {
        if (product_ids.includes(product.product_id)) {
          product.product_status = status;
        }
      });
    },
    
    // 添加任务
    addTask: (state, action) => {
      const { task_id, task_data } = action.payload;
      state.tasks[task_id] = task_data;
    },
    
    // 移除任务
    removeTask: (state, action) => {
      const task_id = action.payload;
      delete state.tasks[task_id];
      delete state.taskLoading[task_id];
      delete state.taskError[task_id];
    },
    
    // 清空导入结果
    clearImportResult: (state) => {
      state.importResult = null;
      state.importError = null;
    },
    
    // 清空上传的图片
    clearUploadedImages: (state) => {
      state.uploadedImages = [];
      state.uploadError = {};
    },
    
    // 添加上传的图片
    addUploadedImage: (state, action) => {
      state.uploadedImages.push(action.payload);
    },
    
    // 移除上传的图片
    removeUploadedImage: (state, action) => {
      const imageUrl = action.payload;
      state.uploadedImages = state.uploadedImages.filter(img => img.image_url !== imageUrl);
    }
  },
  extraReducers: (builder) => {
    // 获取商品列表
    builder
      .addCase(fetchProductList.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchProductList.fulfilled, (state, action) => {
        state.listLoading = false;
        state.productList = action.payload.list;
        state.pagination.total = action.payload.total;
        state.pagination.total_pages = action.payload.total_pages;
        state.pagination.current = action.payload.params.page_no || 1;
        state.pagination.pageSize = action.payload.params.page_size || 20;
        state.listError = null;
      })
      .addCase(fetchProductList.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      });
    
    // 批量创建商品
    builder
      .addCase(createProductsBatch.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createProductsBatch.fulfilled, (state, action) => {
        state.createLoading = false;
        state.lastCreateResult = action.payload;
        state.createError = null;
        
        // 添加任务到任务列表
        if (action.payload.task_id) {
          state.tasks[action.payload.task_id] = {
            total: 0,
            success_count: 0,
            failed: 0,
            status: '待处理',
            failed_list: [],
            start_time: null,
            end_time: null
          };
        }
      })
      .addCase(createProductsBatch.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
      });
    
    // 获取任务状态
    builder
      .addCase(fetchTaskStatus.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = true;
        state.taskError[taskId] = null;
      })
      .addCase(fetchTaskStatus.fulfilled, (state, action) => {
        const { task_id, ...taskData } = action.payload;
        state.taskLoading[task_id] = false;
        state.tasks[task_id] = taskData;
        state.taskError[task_id] = null;
      })
      .addCase(fetchTaskStatus.rejected, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = false;
        state.taskError[taskId] = action.payload;
      });
    
    // 取消任务
    builder
      .addCase(cancelProductTask.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = true;
      })
      .addCase(cancelProductTask.fulfilled, (state, action) => {
        const taskId = action.payload;
        state.taskLoading[taskId] = false;
        if (state.tasks[taskId]) {
          state.tasks[taskId].status = '已取消';
        }
      })
      .addCase(cancelProductTask.rejected, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = false;
        state.taskError[taskId] = action.payload;
      });
    
    // 同步商品状态
    builder
      .addCase(syncProducts.pending, (state) => {
        state.syncLoading = true;
        state.syncError = null;
      })
      .addCase(syncProducts.fulfilled, (state, action) => {
        state.syncLoading = false;
        state.lastSyncResult = action.payload;
        state.syncError = null;
      })
      .addCase(syncProducts.rejected, (state, action) => {
        state.syncLoading = false;
        state.syncError = action.payload;
      });
    
    // 导入Excel
    builder
      .addCase(importProductExcel.pending, (state) => {
        state.importLoading = true;
        state.importError = null;
      })
      .addCase(importProductExcel.fulfilled, (state, action) => {
        state.importLoading = false;
        state.importResult = action.payload;
        state.importError = null;
      })
      .addCase(importProductExcel.rejected, (state, action) => {
        state.importLoading = false;
        state.importError = action.payload;
      });
    
    // 上传图片
    builder
      .addCase(uploadProductImage.pending, (state, action) => {
        const fileName = action.meta.arg.file.name;
        state.uploadLoading[fileName] = true;
        state.uploadError[fileName] = null;
      })
      .addCase(uploadProductImage.fulfilled, (state, action) => {
        const fileName = action.payload.file_name;
        state.uploadLoading[fileName] = false;
        state.uploadedImages.push(action.payload);
        state.uploadError[fileName] = null;
      })
      .addCase(uploadProductImage.rejected, (state, action) => {
        const fileName = action.meta.arg.file.name;
        state.uploadLoading[fileName] = false;
        state.uploadError[fileName] = action.payload;
      });
  }
});

export const {
  clearError,
  setFilters,
  setPagination,
  setSelectedProducts,
  addSelectedProduct,
  removeSelectedProduct,
  clearSelectedProducts,
  updateProductStatus,
  updateProductsStatus,
  addTask,
  removeTask,
  clearImportResult,
  clearUploadedImages,
  addUploadedImage,
  removeUploadedImage
} = productSlice.actions;

// 选择器
export const selectProduct = (state) => state.product;
export const selectProductList = (state) => state.product.productList;
export const selectProductListLoading = (state) => state.product.listLoading;
export const selectProductPagination = (state) => state.product.pagination;
export const selectProductFilters = (state) => state.product.filters;
export const selectSelectedProducts = (state) => state.product.selectedProducts;
export const selectProductTasks = (state) => state.product.tasks;
export const selectTaskStatus = (taskId) => (state) => state.product.tasks[taskId];
export const selectImportResult = (state) => state.product.importResult;
export const selectUploadedImages = (state) => state.product.uploadedImages;

export default productSlice.reducer;