import { useSelector, useDispatch } from 'react-redux';
import { 
  setCurrentShop, 
  setShopList, 
  setLoading,
  initCurrentShop, 
  clearShop,
  updateShopStatusLocal,
  selectCurrentShop,
  selectShopList,
  selectCurrentShopId,
  selectCurrentShopName,
  selectHasShop,
  selectShopCount,
  selectIsLoaded,
  selectIsLoading,
  selectNeedsReload
} from '../store/slices/shopSlice';
import { getShopList } from '../services/shopService';

/**
 * 店铺管理的自定义Hook
 * 统一管理全局店铺状态的访问和操作
 */
export const useShop = () => {
  const dispatch = useDispatch();
  
  // 使用记忆化选择器
  const currentShop = useSelector(selectCurrentShop);
  const shopList = useSelector(selectShopList);
  const currentShopId = useSelector(selectCurrentShopId);
  const currentShopName = useSelector(selectCurrentShopName);
  const hasShop = useSelector(selectHasShop);
  const shopCount = useSelector(selectShopCount);
  const isLoaded = useSelector(selectIsLoaded);
  const isLoading = useSelector(selectIsLoading);
  const needsReload = useSelector(selectNeedsReload);

  // 设置当前店铺
  const setShop = (shop) => {
    dispatch(setCurrentShop(shop));
  };

  // 设置店铺列表
  const updateShopList = (shops) => {
    dispatch(setShopList(shops));
  };

  // 设置加载状态
  const updateLoading = (loading) => {
    dispatch(setLoading(loading));
  };

  // 初始化当前店铺（从localStorage恢复）
  const initShop = () => {
    dispatch(initCurrentShop());
  };

  // 清除店铺状态
  const clearShopState = () => {
    dispatch(clearShop());
  };

  // 更新单个店铺状态（本地同步）
  const updateShopStatus = (shopId, status) => {
    dispatch(updateShopStatusLocal({ shopId, status }));
  };

  // 强制刷新店铺列表（用于添加/删除店铺后）
  const refreshShopList = async () => {
    try {
      dispatch(setLoading(true));
      const response = await getShopList({ 
        page_no: 1, 
        page_size: 100,
        status: 1
      });
      
      if (response.code === 200) {
        const shops = response.data.list || [];
        dispatch(setShopList(shops));
        return { success: true, shops };
      } else {
        console.error('[useShop] 刷新店铺列表失败:', response.msg);
        return { success: false, error: response.msg };
      }
    } catch (error) {
      console.error('[useShop] 刷新店铺列表异常:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    // 状态
    currentShop,
    shopList,
    currentShopId,
    currentShopName,
    hasShop,
    shopCount,
    isLoaded,
    isLoading,
    needsReload,
    
    // 方法
    setShop,
    updateShopList,
    updateLoading,
    initShop,
    clearShopState,
    updateShopStatus,
    refreshShopList  // 新增：强制刷新方法
  };
};

export default useShop;
