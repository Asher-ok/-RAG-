import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { login as loginAPI, register as registerAPI, getCurrentUser, logout as logoutAPI } from '../../services/authService';

// 异步登录
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await loginAPI(credentials);
      if (response.code === 200) {
        // 保存token和用户信息到localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userInfo', JSON.stringify(response.data));
        return response.data;
      } else {
        return rejectWithValue(response.msg || '登录失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '登录失败，请检查网络连接');
    }
  }
);

// 异步注册
export const registerAsync = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await registerAPI(userData);
      if (response.code === 200) {
        // 注册成功后自动保存token和用户信息
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('userInfo', JSON.stringify(response.data));
        return response.data;
      } else {
        return rejectWithValue(response.msg || '注册失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '注册失败，请检查网络连接');
    }
  }
);

// 异步获取当前用户信息
export const getCurrentUserAsync = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getCurrentUser();
      if (response.code === 200) {
        // 更新localStorage中的用户信息
        localStorage.setItem('userInfo', JSON.stringify(response.data));
        return response.data;
      } else {
        return rejectWithValue(response.msg || '获取用户信息失败');
      }
    } catch (error) {
      return rejectWithValue(error.msg || '获取用户信息失败');
    }
  }
);

// 异步登出
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      // 先清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('currentShop');
      
      // 调用API
      const response = await logoutAPI();
      return response.data;
    } catch (error) {
      // 即使API调用失败，也要清除本地存储
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('currentShop');
      // 不返回错误，确保登出流程继续
      return null;
    }
  }
);

const initialState = {
  // 用户信息
  user: null, // { user_id, username, real_name, account_type, expire_time, permissions }
  token: null,
  
  // 认证状态
  isAuthenticated: false,
  isLoading: false,
  
  // 权限相关
  permissions: [], // 员工账号的权限列表
  accountType: null, // 1主账号/2员工账号
  
  // 错误信息
  error: null,
  
  // 登录状态
  loginLoading: false,
  registerLoading: false,
  
  // 过期时间（员工账号）
  expireTime: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 清除错误信息
    clearError: (state) => {
      state.error = null;
    },
    
    // 从localStorage初始化认证状态
    initAuth: (state) => {
      const token = localStorage.getItem('token');
      const userInfo = localStorage.getItem('userInfo');
      
      if (token && userInfo) {
        try {
          const user = JSON.parse(userInfo);
          state.token = token;
          state.user = user;
          state.isAuthenticated = true;
          state.accountType = user.account_type;
          state.permissions = user.permissions || [];
          state.expireTime = user.expire_time;
          
          // 检查员工账号是否过期
          if (user.account_type === 2 && user.expire_time) {
            const expireDate = new Date(user.expire_time);
            const now = new Date();
            if (expireDate <= now) {
              // 账号已过期，清除认证状态
              state.token = null;
              state.user = null;
              state.isAuthenticated = false;
              state.accountType = null;
              state.permissions = [];
              state.expireTime = null;
              state.error = '账号已过期，请联系管理员';
              localStorage.removeItem('token');
              localStorage.removeItem('userInfo');
            }
          }
        } catch (error) {
          console.error('Failed to parse user info:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('userInfo');
        }
      }
    },
    
    // 更新用户信息
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('userInfo', JSON.stringify(state.user));
    },
    
    // 检查权限
    checkPermission: (state, action) => {
      const permission = action.payload;
      // 主账号拥有所有权限
      if (state.accountType === 1) {
        return true;
      }
      // 员工账号检查具体权限
      return state.permissions.includes(permission);
    },
    
    // 强制登出（用于token过期等情况）
    forceLogout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.accountType = null;
      state.permissions = [];
      state.expireTime = null;
      state.error = null;
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('currentShop');
    }
  },
  extraReducers: (builder) => {
    // 登录
    builder
      .addCase(loginAsync.pending, (state) => {
        state.loginLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loginLoading = false;
        state.user = action.payload;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.accountType = action.payload.account_type;
        state.permissions = action.payload.permissions || [];
        state.expireTime = action.payload.expire_time;
        state.error = null;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loginLoading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
      });
    
    // 注册
    builder
      .addCase(registerAsync.pending, (state) => {
        state.registerLoading = true;
        state.error = null;
      })
      .addCase(registerAsync.fulfilled, (state, action) => {
        state.registerLoading = false;
        state.user = action.payload;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.accountType = action.payload.account_type;
        state.permissions = action.payload.permissions || [];
        state.expireTime = action.payload.expire_time;
        state.error = null;
      })
      .addCase(registerAsync.rejected, (state, action) => {
        state.registerLoading = false;
        state.error = action.payload;
      });
    
    // 获取当前用户信息
    builder
      .addCase(getCurrentUserAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUserAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.accountType = action.payload.account_type;
        state.permissions = action.payload.permissions || [];
        state.expireTime = action.payload.expire_time;
        state.error = null;
      })
      .addCase(getCurrentUserAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
        // 如果获取用户信息失败，可能是token过期，强制登出
        if (action.payload.includes('401') || action.payload.includes('token')) {
          state.user = null;
          state.token = null;
          state.isAuthenticated = false;
          state.accountType = null;
          state.permissions = [];
          state.expireTime = null;
          localStorage.removeItem('token');
          localStorage.removeItem('userInfo');
        }
      });
    
    // 登出
    builder
      .addCase(logoutAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.accountType = null;
        state.permissions = [];
        state.expireTime = null;
        state.error = null;
      })
      .addCase(logoutAsync.rejected, (state) => {
        state.isLoading = false;
        // 即使登出API失败，也要清除本地状态
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.accountType = null;
        state.permissions = [];
        state.expireTime = null;
      });
  }
});

export const { 
  clearError, 
  initAuth, 
  updateUser, 
  checkPermission, 
  forceLogout 
} = authSlice.actions;

// 选择器
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAccountType = (state) => state.auth.accountType;
export const selectPermissions = (state) => state.auth.permissions;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectError = (state) => state.auth.error;

// 权限检查选择器
export const selectHasPermission = (permission) => (state) => {
  const { accountType, permissions } = state.auth;
  // 主账号拥有所有权限
  if (accountType === 1) return true;
  // 员工账号检查具体权限
  if (accountType === 2) {
    return permissions.includes(permission);
  }
  // 普通账号没有任何权限
  return false;
};

export default authSlice.reducer;