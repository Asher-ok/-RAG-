import store from './index';
import { initAuth } from './slices/authSlice';
import { initCurrentShop } from './slices/shopSlice';

/**
 * 初始化Redux Store
 * 在应用启动时调用，恢复持久化的状态
 */
export const initializeStore = () => {
  // 初始化认证状态
  store.dispatch(initAuth());
  
  // 初始化当前店铺
  store.dispatch(initCurrentShop());
  
  console.log('Redux store initialized');
};

export default initializeStore;