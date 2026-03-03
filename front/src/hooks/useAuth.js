import { useSelector, useDispatch } from 'react-redux';
import { 
  loginAsync, 
  registerAsync, 
  logoutAsync, 
  getCurrentUserAsync,
  clearError,
  forceLogout,
  updateUser as updateUserAction,
  selectAuth,
  selectUser,
  selectIsAuthenticated,
  selectAccountType,
  selectPermissions,
  selectIsLoading,
  selectError,
  selectHasPermission
} from '../store/slices/authSlice';

/**
 * 认证相关的自定义Hook
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const accountType = useSelector(selectAccountType);
  const permissions = useSelector(selectPermissions);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);

  // 登录
  const login = async (credentials) => {
    return dispatch(loginAsync(credentials));
  };

  // 注册
  const register = async (userData) => {
    return dispatch(registerAsync(userData));
  };

  // 登出
  const logout = async () => {
    try {
      // 调用登出action
      const result = await dispatch(logoutAsync());
      return result;
    } catch (error) {
      console.error('Logout error:', error);
      // 即使出错也返回成功，确保能跳转
      return { type: 'auth/logout/fulfilled' };
    }
  };

  // 获取当前用户信息
  const getCurrentUser = async () => {
    return dispatch(getCurrentUserAsync());
  };

  // 清除错误
  const clearAuthError = () => {
    dispatch(clearError());
  };

  // 强制登出
  const forceLogoutUser = () => {
    dispatch(forceLogout());
  };

  // 检查权限
  const hasPermission = (permission) => {
    // 主账号拥有所有权限
    if (accountType === 1) return true;
    // 员工账号检查具体权限
    if (accountType === 2) {
      return permissions.includes(permission);
    }
    // 普通账号没有任何权限
    return false;
  };

  // 检查是否为主账号
  const isMasterAccount = () => {
    return accountType === 1;
  };

  // 检查是否为员工账号
  const isEmployeeAccount = () => {
    return accountType === 2;
  };

  // 检查账号是否过期（员工账号）
  const isAccountExpired = () => {
    if (accountType !== 2 || !user?.expire_time) return false;
    const expireDate = new Date(user.expire_time);
    const now = new Date();
    return expireDate <= now;
  };

  // 更新用户信息
  const updateUser = (userData) => {
    dispatch(updateUserAction(userData));
  };

  return {
    // 状态
    auth,
    user,
    isAuthenticated,
    accountType,
    permissions,
    isLoading,
    error,
    
    // 方法
    login,
    register,
    logout,
    getCurrentUser,
    clearAuthError,
    forceLogoutUser,
    updateUser,
    hasPermission,
    isMasterAccount,
    isEmployeeAccount,
    isAccountExpired
  };
};

/**
 * 权限检查Hook
 */
export const usePermission = (permission) => {
  return useSelector(selectHasPermission(permission));
};

export default useAuth;