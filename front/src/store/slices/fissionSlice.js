import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { 
  createFission, 
  getTaskStatus, 
  getFissionRecords, 
  cancelTask 
} from '../../services/fissionService';

// 异步创建裂变任务
export const createFissionTask = createAsyncThunk(
  'fission/createTask',
  async (data, { rejectWithValue }) => {
    try {
      const response = await createFission(data);
      if (response.code === 200) {
        return {
          task_id: response.data.task_id,
          source_data: data
        };
      } else {
        return rejectWithValue(response.msg || '创建裂变任务失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '创建裂变任务失败');
    }
  }
);

// 异步获取裂变任务状态
export const fetchFissionTaskStatus = createAsyncThunk(
  'fission/fetchTaskStatus',
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await getTaskStatus({ task_id: taskId });
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

// 异步获取裂变记录
export const fetchFissionRecords = createAsyncThunk(
  'fission/fetchRecords',
  async (params, { rejectWithValue }) => {
    try {
      const response = await getFissionRecords(params);
      if (response.code === 200 && response.data.success) {
        return {
          list: response.data.list || [],
          total: response.data.total || 0,
          total_pages: response.data.total_pages || 0,
          params
        };
      } else {
        return rejectWithValue(response.msg || '获取裂变记录失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '获取裂变记录失败');
    }
  }
);

// 异步取消裂变任务
export const cancelFissionTaskAsync = createAsyncThunk(
  'fission/cancelTask',
  async (taskId, { rejectWithValue }) => {
    try {
      const response = await cancelTask({ task_id: taskId });
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

const initialState = {
  // 裂变任务列表
  tasks: {}, // { task_id: { total, success_count, failed, status, product_ids, product_details, failed_details, start_time, end_time, source_product_title } }
  taskLoading: {},
  taskError: {},
  
  // 裂变记录
  records: [],
  recordsLoading: false,
  recordsError: null,
  
  // 分页信息
  recordsPagination: {
    current: 1,
    pageSize: 20,
    total: 0,
    total_pages: 0
  },
  
  // 筛选条件
  recordsFilters: {
    shop_id: null,
    status: null,
    keyword: ''
  },
  
  // 创建裂变
  createLoading: false,
  createError: null,
  lastCreateResult: null, // { task_id, source_data }
  
  // 当前查看的任务详情
  currentTaskDetail: null,
  
  // 裂变配置模板（用于快速创建）
  templates: [],
  
  // 全局错误
  error: null,
  
  // ✅ 新增：实时步骤进度（按 task_id 存储）
  taskSteps: {}, // { task_id: [{ step, status, message, details, timestamp }] }
  taskInProgress: {}, // { task_id: boolean } 标记任务是否正在执行
};

const fissionSlice = createSlice({
  name: 'fission',
  initialState,
  reducers: {
    // 清除错误
    clearError: (state) => {
      state.error = null;
      state.createError = null;
      state.recordsError = null;
    },
    
    // 设置记录筛选条件
    setRecordsFilters: (state, action) => {
      state.recordsFilters = { ...state.recordsFilters, ...action.payload };
    },
    
    // 设置记录分页
    setRecordsPagination: (state, action) => {
      state.recordsPagination = { ...state.recordsPagination, ...action.payload };
    },
    
    // 添加任务
    addTask: (state, action) => {
      const { task_id, task_data } = action.payload;
      state.tasks[task_id] = task_data;
    },
    
    // 更新任务状态
    updateTaskStatus: (state, action) => {
      const { task_id, status } = action.payload;
      if (state.tasks[task_id]) {
        state.tasks[task_id].status = status;
      }
    },
    
    // 更新任务进度
    updateTaskProgress: (state, action) => {
      const { task_id, progress } = action.payload;
      if (state.tasks[task_id]) {
        state.tasks[task_id] = { ...state.tasks[task_id], ...progress };
      }
    },
    
    // 移除任务
    removeTask: (state, action) => {
      const task_id = action.payload;
      delete state.tasks[task_id];
      delete state.taskLoading[task_id];
      delete state.taskError[task_id];
    },
    
    // 设置当前任务详情
    setCurrentTaskDetail: (state, action) => {
      state.currentTaskDetail = action.payload;
    },
    
    // 清空当前任务详情
    clearCurrentTaskDetail: (state) => {
      state.currentTaskDetail = null;
    },
    
    // 添加配置模板
    addTemplate: (state, action) => {
      state.templates.push(action.payload);
    },
    
    // 移除配置模板
    removeTemplate: (state, action) => {
      const templateId = action.payload;
      state.templates = state.templates.filter(t => t.id !== templateId);
    },
    
    // 更新配置模板
    updateTemplate: (state, action) => {
      const { id, data } = action.payload;
      const template = state.templates.find(t => t.id === id);
      if (template) {
        Object.assign(template, data);
      }
    },
    
    // 清空创建结果
    clearCreateResult: (state) => {
      state.lastCreateResult = null;
      state.createError = null;
    },
    
    // 批量更新任务状态（用于轮询更新）
    batchUpdateTasks: (state, action) => {
      const updates = action.payload; // { task_id: task_data }
      Object.keys(updates).forEach(task_id => {
        if (state.tasks[task_id]) {
          state.tasks[task_id] = { ...state.tasks[task_id], ...updates[task_id] };
        }
      });
    },
    
    // ✅ 新增：添加任务步骤
    addTaskStep: (state, action) => {
      const { task_id, step } = action.payload;
      if (!state.taskSteps[task_id]) {
        state.taskSteps[task_id] = [];
      }
      
      // ✅ 添加去重逻辑
      const steps = state.taskSteps[task_id];
      
      // 判断是否是分隔步骤
      const isSeparator = step.step && step.step.includes('==========');
      
      if (isSeparator) {
        // 分隔步骤，直接添加
        steps.push(step);
      } else {
        // 普通步骤，查找最近的分隔步骤后是否有相同步骤名
        let lastSeparatorIndex = -1;
        for (let i = steps.length - 1; i >= 0; i--) {
          if (steps[i].step && steps[i].step.includes('==========')) {
            lastSeparatorIndex = i;
            break;
          }
        }
        
        // ✅ 在最近的分隔步骤之后查找相同步骤名（如果没有分隔步骤，从头开始查找）
        let existingIndex = -1;
        const searchStartIndex = lastSeparatorIndex !== -1 ? lastSeparatorIndex + 1 : 0;
        
        for (let i = searchStartIndex; i < steps.length; i++) {
          if (steps[i].step === step.step) {
            existingIndex = i;
            break;
          }
        }
        
        if (existingIndex !== -1) {
          // 找到相同步骤，更新它
          steps[existingIndex] = step;
        } else {
          // 没找到，添加新记录
          steps.push(step);
        }
      }
      
      // 限制日志数量，保留最新的100条
      const MAX_LOGS = 100;
      if (steps.length > MAX_LOGS) {
        state.taskSteps[task_id] = steps.slice(-MAX_LOGS);
      }
    },
    
    // ✅ 新增：清空任务步骤
    clearTaskSteps: (state, action) => {
      const task_id = action.payload;
      delete state.taskSteps[task_id];
    },
    
    // ✅ 新增：设置任务执行状态
    setTaskInProgress: (state, action) => {
      const { task_id, inProgress } = action.payload;
      state.taskInProgress[task_id] = inProgress;
    }
  },
  extraReducers: (builder) => {
    // 创建裂变任务
    builder
      .addCase(createFissionTask.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createFissionTask.fulfilled, (state, action) => {
        state.createLoading = false;
        state.lastCreateResult = action.payload;
        state.createError = null;
        
        // 添加任务到任务列表
        if (action.payload.task_id) {
          state.tasks[action.payload.task_id] = {
            total: action.payload.source_data.count || 0,
            success_count: 0,
            failed: 0,
            status: '待处理',
            status_code: 0,
            product_ids: [],
            product_details: [],
            failed_details: [],
            start_time: null,
            end_time: null,
            source_product_title: action.payload.source_data.source_product_id || '未知商品'
          };
        }
      })
      .addCase(createFissionTask.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload;
      });
    
    // 获取裂变任务状态
    builder
      .addCase(fetchFissionTaskStatus.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = true;
        state.taskError[taskId] = null;
      })
      .addCase(fetchFissionTaskStatus.fulfilled, (state, action) => {
        const { task_id, ...taskData } = action.payload;
        state.taskLoading[task_id] = false;
        state.tasks[task_id] = taskData;
        state.taskError[task_id] = null;
      })
      .addCase(fetchFissionTaskStatus.rejected, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = false;
        state.taskError[taskId] = action.payload;
      });
    
    // 获取裂变记录
    builder
      .addCase(fetchFissionRecords.pending, (state) => {
        state.recordsLoading = true;
        state.recordsError = null;
      })
      .addCase(fetchFissionRecords.fulfilled, (state, action) => {
        state.recordsLoading = false;
        state.records = action.payload.list;
        state.recordsPagination.total = action.payload.total;
        state.recordsPagination.total_pages = action.payload.total_pages;
        state.recordsPagination.current = action.payload.params.page_no || 1;
        state.recordsPagination.pageSize = action.payload.params.page_size || 20;
        state.recordsError = null;
        
        // 同时更新任务状态（如果记录中包含任务信息）
        action.payload.list.forEach(record => {
          if (record.task_id && state.tasks[record.task_id]) {
            state.tasks[record.task_id] = {
              ...state.tasks[record.task_id],
              status: record.status,
              success_count: record.success_count || 0,
              failed: record.failed_count || 0,
              product_details: record.product_details || []
            };
          }
        });
      })
      .addCase(fetchFissionRecords.rejected, (state, action) => {
        state.recordsLoading = false;
        state.recordsError = action.payload;
      });
    
    // 取消裂变任务
    builder
      .addCase(cancelFissionTaskAsync.pending, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = true;
      })
      .addCase(cancelFissionTaskAsync.fulfilled, (state, action) => {
        const taskId = action.payload;
        state.taskLoading[taskId] = false;
        if (state.tasks[taskId]) {
          state.tasks[taskId].status = '已取消';
          state.tasks[taskId].status_code = 4;
        }
      })
      .addCase(cancelFissionTaskAsync.rejected, (state, action) => {
        const taskId = action.meta.arg;
        state.taskLoading[taskId] = false;
        state.taskError[taskId] = action.payload;
      });
  }
});

export const {
  clearError,
  setRecordsFilters,
  setRecordsPagination,
  addTask,
  updateTaskStatus,
  updateTaskProgress,
  removeTask,
  setCurrentTaskDetail,
  clearCurrentTaskDetail,
  addTemplate,
  removeTemplate,
  updateTemplate,
  clearCreateResult,
  batchUpdateTasks,
  addTaskStep,
  clearTaskSteps,
  setTaskInProgress
} = fissionSlice.actions;

// 选择器
export const selectFission = (state) => state.fission;
export const selectFissionTasks = (state) => state.fission.tasks;
export const selectFissionTaskStatus = (taskId) => (state) => state.fission.tasks[taskId];
export const selectFissionRecords = (state) => state.fission.records;
export const selectFissionRecordsLoading = (state) => state.fission.recordsLoading;
export const selectFissionRecordsPagination = (state) => state.fission.recordsPagination;
export const selectFissionRecordsFilters = (state) => state.fission.recordsFilters;
export const selectCurrentTaskDetail = (state) => state.fission.currentTaskDetail;
export const selectFissionTemplates = (state) => state.fission.templates;
export const selectCreateLoading = (state) => state.fission.createLoading;
export const selectLastCreateResult = (state) => state.fission.lastCreateResult;

// ✅ 优化：使用 createSelector 避免返回新引用
export const selectTaskSteps = (taskId) => createSelector(
  [(state) => state.fission.taskSteps],
  (taskSteps) => taskSteps[taskId] || []
);

export const selectTaskInProgress = (taskId) => createSelector(
  [(state) => state.fission.taskInProgress],
  (taskInProgress) => taskInProgress[taskId] || false
);

// 复合选择器 - 使用 createSelector 进行记忆化，避免不必要的重新渲染
export const selectRunningTasks = createSelector(
  [selectFissionTasks],
  (tasks) => {
    return Object.keys(tasks).filter(taskId => {
      const task = tasks[taskId];
      return task.status_code === 0 || task.status_code === 1; // 待处理或进行中
    }).map(taskId => ({ task_id: taskId, ...tasks[taskId] }));
  }
);

export const selectCompletedTasks = createSelector(
  [selectFissionTasks],
  (tasks) => {
    return Object.keys(tasks).filter(taskId => {
      const task = tasks[taskId];
      return task.status_code === 2; // 已完成
    }).map(taskId => ({ task_id: taskId, ...tasks[taskId] }));
  }
);

export const selectFailedTasks = createSelector(
  [selectFissionTasks],
  (tasks) => {
    return Object.keys(tasks).filter(taskId => {
      const task = tasks[taskId];
      return task.status_code === 3; // 失败
    }).map(taskId => ({ task_id: taskId, ...tasks[taskId] }));
  }
);

export default fissionSlice.reducer;