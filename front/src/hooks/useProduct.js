import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchProductList,
  createProductsBatch,
  fetchTaskStatus,
  cancelProductTask,
  syncProducts,
  importProductExcel,
  uploadProductImage,
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
  selectProduct,
  selectProductList,
  selectProductListLoading,
  selectProductPagination,
  selectProductFilters,
  selectSelectedProducts,
  selectProductTasks,
  selectTaskStatus,
  selectImportResult,
  selectUploadedImages
} from '../store/slices/productSlice';

/**
 * 商品管理相关的自定义Hook
 */
export const useProduct = () => {
  const dispatch = useDispatch();
  const product = useSelector(selectProduct);
  const productList = useSelector(selectProductList);
  const listLoading = useSelector(selectProductListLoading);
  const pagination = useSelector(selectProductPagination);
  const filters = useSelector(selectProductFilters);
  const selectedProducts = useSelector(selectSelectedProducts);
  const tasks = useSelector(selectProductTasks);
  const importResult = useSelector(selectImportResult);
  const uploadedImages = useSelector(selectUploadedImages);

  // 获取商品列表
  const getProductList = async (params) => {
    return dispatch(fetchProductList(params));
  };

  // 批量创建商品
  const createProducts = async (data) => {
    return dispatch(createProductsBatch(data));
  };

  // 获取任务状态
  const getTaskStatus = async (taskId) => {
    return dispatch(fetchTaskStatus(taskId));
  };

  // 取消任务
  const cancelTask = async (taskId) => {
    return dispatch(cancelProductTask(taskId));
  };

  // 同步商品状态
  const syncProductStatus = async (data) => {
    return dispatch(syncProducts(data));
  };

  // 导入Excel
  const importExcel = async (file) => {
    return dispatch(importProductExcel(file));
  };

  // 上传图片
  const uploadImage = async (shopId, file) => {
    return dispatch(uploadProductImage({ shopId, file }));
  };

  // 清除错误
  const clearProductError = () => {
    dispatch(clearError());
  };

  // 设置筛选条件
  const setProductFilters = (newFilters) => {
    dispatch(setFilters(newFilters));
  };

  // 设置分页
  const setProductPagination = (newPagination) => {
    dispatch(setPagination(newPagination));
  };

  // 选中商品相关
  const selectProducts = (productIds) => {
    dispatch(setSelectedProducts(productIds));
  };

  const selectSingleProduct = (productId) => {
    dispatch(addSelectedProduct(productId));
  };

  const unselectProduct = (productId) => {
    dispatch(removeSelectedProduct(productId));
  };

  const clearSelection = () => {
    dispatch(clearSelectedProducts());
  };

  // 更新商品状态
  const updateStatus = (productId, status) => {
    dispatch(updateProductStatus({ product_id: productId, status }));
  };

  const updateMultipleStatus = (productIds, status) => {
    dispatch(updateProductsStatus({ product_ids: productIds, status }));
  };

  // 任务管理
  const addProductTask = (taskId, taskData) => {
    dispatch(addTask({ task_id: taskId, task_data: taskData }));
  };

  const removeProductTask = (taskId) => {
    dispatch(removeTask(taskId));
  };

  // 清除导入结果
  const clearImport = () => {
    dispatch(clearImportResult());
  };

  // 清除上传的图片
  const clearUploads = () => {
    dispatch(clearUploadedImages());
  };

  return {
    // 状态
    product,
    productList,
    listLoading,
    pagination,
    filters,
    selectedProducts,
    tasks,
    importResult,
    uploadedImages,
    
    // 方法
    getProductList,
    createProducts,
    getTaskStatus,
    cancelTask,
    syncProductStatus,
    importExcel,
    uploadImage,
    clearProductError,
    setProductFilters,
    setProductPagination,
    selectProducts,
    selectSingleProduct,
    unselectProduct,
    clearSelection,
    updateStatus,
    updateMultipleStatus,
    addProductTask,
    removeProductTask,
    clearImport,
    clearUploads
  };
};

/**
 * 获取特定任务状态的Hook
 */
export const useTaskStatus = (taskId) => {
  return useSelector(selectTaskStatus(taskId));
};

export default useProduct;