import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  currentShop: null, // 当前选中的店铺对象 { id, shop_name, douyin_shop_id }
  shopList: [], // 用户有权限的店铺列表
  isLoaded: false, // 是否已加载过店铺列表
  isLoading: false, // 是否正在加载
  lastLoadTime: null, // 最后加载时间
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setCurrentShop: (state, action) => {
      state.currentShop = action.payload;
      // 保存到 localStorage
      if (action.payload) {
        localStorage.setItem('currentShop', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('currentShop');
      }
    },
    setShopList: (state, action) => {
      state.shopList = action.payload;
      state.isLoaded = true;
      state.isLoading = false;
      state.lastLoadTime = Date.now();
      
      // 如果没有当前店铺且列表不为空，自动选择"全部店铺"
      if (!state.currentShop && action.payload.length > 0) {
        state.currentShop = { id: 'all', shop_name: '全部店铺' };
        localStorage.setItem('currentShop', JSON.stringify({ id: 'all', shop_name: '全部店铺' }));
      }
      // 如果当前选中的店铺在新列表中不存在或被禁用，切换到"全部店铺"
      if (state.currentShop && state.currentShop.id !== 'all') {
        const currentShopInList = action.payload.find(shop => shop.id === state.currentShop.id);
        if (!currentShopInList || currentShopInList.status !== 1) {
          state.currentShop = { id: 'all', shop_name: '全部店铺' };
          localStorage.setItem('currentShop', JSON.stringify({ id: 'all', shop_name: '全部店铺' }));
        }
      }
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    initCurrentShop: (state) => {
      // 从 localStorage 恢复当前店铺
      const savedShop = localStorage.getItem('currentShop');
      if (savedShop) {
        try {
          state.currentShop = JSON.parse(savedShop);
        } catch (e) {
          console.error('Failed to parse saved shop:', e);
        }
      }
    },
    clearShop: (state) => {
      state.currentShop = null;
      state.shopList = [];
      state.isLoaded = false;
      state.isLoading = false;
      state.lastLoadTime = null;
      localStorage.removeItem('currentShop');
    },
    // 更新单个店铺状态（用于本地同步，避免重新请求）
    updateShopStatusLocal: (state, action) => {
      const { shopId, status } = action.payload;
      const shop = state.shopList.find(s => s.id === shopId);
      if (shop) {
        shop.status = status;
      }
      // 如果当前选中的店铺被禁用，切换到"全部店铺"
      if (state.currentShop && state.currentShop.id === shopId && status !== 1) {
        state.currentShop = { id: 'all', shop_name: '全部店铺' };
        localStorage.setItem('currentShop', JSON.stringify({ id: 'all', shop_name: '全部店铺' }));
      }
    }
  }
});

export const { 
  setCurrentShop, 
  setShopList, 
  setLoading,
  initCurrentShop, 
  clearShop, 
  updateShopStatusLocal 
} = shopSlice.actions;

// 基础选择器
export const selectShop = (state) => state.shop;
export const selectCurrentShop = (state) => state.shop.currentShop;
export const selectShopList = (state) => state.shop.shopList;
export const selectIsLoaded = (state) => state.shop.isLoaded;
export const selectIsLoading = (state) => state.shop.isLoading;
export const selectLastLoadTime = (state) => state.shop.lastLoadTime;

// 记忆化选择器
export const selectCurrentShopId = createSelector(
  [selectCurrentShop],
  (currentShop) => currentShop?.id
);

export const selectCurrentShopName = createSelector(
  [selectCurrentShop],
  (currentShop) => currentShop?.shop_name
);

export const selectHasShop = createSelector(
  [selectCurrentShop],
  (currentShop) => !!currentShop
);

export const selectShopCount = createSelector(
  [selectShopList],
  (shopList) => shopList.length
);

// 是否需要重新加载（超过5分钟）
export const selectNeedsReload = createSelector(
  [selectIsLoaded, selectLastLoadTime],
  (isLoaded, lastLoadTime) => {
    if (!isLoaded) return true;
    if (!lastLoadTime) return true;
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() - lastLoadTime > fiveMinutes;
  }
);

export default shopSlice.reducer;
