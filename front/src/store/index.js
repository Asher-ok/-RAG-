import { configureStore } from '@reduxjs/toolkit';
import shopReducer from './slices/shopSlice';
import authReducer from './slices/authSlice';
import productReducer from './slices/productSlice';
import fissionReducer from './slices/fissionSlice';

const store = configureStore({
  reducer: {
    shop: shopReducer,
    auth: authReducer,
    product: productReducer,
    fission: fissionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略这些 action types 的序列化检查
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export default store;
