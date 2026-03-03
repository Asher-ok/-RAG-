import { useSelector, useDispatch } from 'react-redux';
import { 
  createFissionTask,
  fetchFissionTaskStatus,
  fetchFissionRecords,
  cancelFissionTaskAsync,
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
  selectFission,
  selectFissionTasks,
  selectFissionTaskStatus,
  selectFissionRecords,
  selectFissionRecordsLoading,
  selectFissionRecordsPagination,
  selectFissionRecordsFilters,
  selectCurrentTaskDetail,
  selectFissionTemplates,
  selectCreateLoading,
  selectLastCreateResult,
  selectRunningTasks,
  selectCompletedTasks,
  selectFailedTasks
} from '../store/slices/fissionSlice';

/**
 * 裂变管理相关的自定义Hook
 */
export const useFission = () => {
  const dispatch = useDispatch();
  const fission = useSelector(selectFission);
  const tasks = useSelector(selectFissionTasks);
  const records = useSelector(selectFissionRecords);
  const recordsLoading = useSelector(selectFissionRecordsLoading);
  const recordsPagination = useSelector(selectFissionRecordsPagination);
  const recordsFilters = useSelector(selectFissionRecordsFilters);
  const currentTaskDetail = useSelector(selectCurrentTaskDetail);
  const templates = useSelector(selectFissionTemplates);
  const createLoading = useSelector(selectCreateLoading);
  const lastCreateResult = useSelector(selectLastCreateResult);
  const runningTasks = useSelector(selectRunningTasks);
  const completedTasks = useSelector(selectCompletedTasks);
  const failedTasks = useSelector(selectFailedTasks);

  // 创建裂变任务
  const createTask = async (data) => {
    return dispatch(createFissionTask(data));
  };

  // 获取任务状态
  const getTaskStatus = async (taskId) => {
    return dispatch(fetchFissionTaskStatus(taskId));
  };

  // 获取裂变记录
  const getRecords = async (params) => {
    return dispatch(fetchFissionRecords(params));
  };

  // 取消任务
  const cancelTask = async (taskId) => {
    return dispatch(cancelFissionTaskAsync(taskId));
  };

  // 清除错误
  const clearFissionError = () => {
    dispatch(clearError());
  };

  // 设置记录筛选条件
  const setFilters = (newFilters) => {
    dispatch(setRecordsFilters(newFilters));
  };

  // 设置记录分页
  const setPagination = (newPagination) => {
    dispatch(setRecordsPagination(newPagination));
  };

  // 任务管理
  const addFissionTask = (taskId, taskData) => {
    dispatch(addTask({ task_id: taskId, task_data: taskData }));
  };

  const updateTask = (taskId, status) => {
    dispatch(updateTaskStatus({ task_id: taskId, status }));
  };

  const updateProgress = (taskId, progress) => {
    dispatch(updateTaskProgress({ task_id: taskId, progress }));
  };

  const removeFissionTask = (taskId) => {
    dispatch(removeTask(taskId));
  };

  // 任务详情
  const setTaskDetail = (taskDetail) => {
    dispatch(setCurrentTaskDetail(taskDetail));
  };

  const clearTaskDetail = () => {
    dispatch(clearCurrentTaskDetail());
  };

  // 配置模板管理
  const addConfigTemplate = (template) => {
    dispatch(addTemplate(template));
  };

  const removeConfigTemplate = (templateId) => {
    dispatch(removeTemplate(templateId));
  };

  const updateConfigTemplate = (templateId, data) => {
    dispatch(updateTemplate({ id: templateId, data }));
  };

  // 清除创建结果
  const clearCreate = () => {
    dispatch(clearCreateResult());
  };

  // 批量更新任务（用于轮询）
  const batchUpdate = (updates) => {
    dispatch(batchUpdateTasks(updates));
  };

  // 轮询运行中的任务状态
  const pollRunningTasks = async () => {
    const running = runningTasks;
    if (running.length === 0) return;

    const updates = {};
    for (const task of running) {
      try {
        const result = await dispatch(fetchFissionTaskStatus(task.task_id));
        if (result.payload) {
          updates[task.task_id] = result.payload;
        }
      } catch (error) {
        console.error(`Failed to poll task ${task.task_id}:`, error);
      }
    }

    if (Object.keys(updates).length > 0) {
      batchUpdate(updates);
    }
  };

  return {
    // 状态
    fission,
    tasks,
    records,
    recordsLoading,
    recordsPagination,
    recordsFilters,
    currentTaskDetail,
    templates,
    createLoading,
    lastCreateResult,
    runningTasks,
    completedTasks,
    failedTasks,
    
    // 方法
    createTask,
    getTaskStatus,
    getRecords,
    cancelTask,
    clearFissionError,
    setFilters,
    setPagination,
    addFissionTask,
    updateTask,
    updateProgress,
    removeFissionTask,
    setTaskDetail,
    clearTaskDetail,
    addConfigTemplate,
    removeConfigTemplate,
    updateConfigTemplate,
    clearCreate,
    batchUpdate,
    pollRunningTasks
  };
};

/**
 * 获取特定裂变任务状态的Hook
 */
export const useFissionTaskStatus = (taskId) => {
  return useSelector(selectFissionTaskStatus(taskId));
};

export default useFission;