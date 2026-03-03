import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/Layout/MainLayout';
import Login from '../pages/Auth/Login';
import Dashboard from '../pages/Dashboard';
import ShopManage from '../pages/Shop/ShopManage';
import LocalTokenManage from '../pages/Shop/LocalTokenManage';
import ProductList from '../pages/Product/ProductList';
import BatchCreate from '../pages/Product/BatchCreate';
import ExcelImport from '../pages/Product/ExcelImport';
// import ProductTasks from '../pages/Product/ProductTasks'; // 隐藏上架任务
import CreateFission from '../pages/Fission/CreateFission';
import TaskList from '../pages/Fission/TaskList';
import EmployeeManage from '../pages/Account/EmployeeManage';
import AuthRequests from '../pages/Account/AuthRequests';
import PersonalCenter from '../pages/Profile/PersonalCenter';
import SystemSettings from '../pages/Settings/SystemSettings';
import PrivateRoute from '../components/Common/PrivateRoute';
import PermissionRoute from '../components/Common/PermissionRoute';
import { PERMISSIONS } from '../constants/permissions';

function AppRouter() {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />

      {/* 需要登录的路由 */}
      <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* 店铺管理 - 需要shop_manage权限 */}
        <Route path="shop" element={
          <PermissionRoute permission={PERMISSIONS.SHOP_MANAGE}>
            <ShopManage />
          </PermissionRoute>
        } />
        
        {/* 本地Token管理 - 仅桌面应用可用 */}
        <Route path="shop/local-tokens" element={
          <PermissionRoute permission={PERMISSIONS.SHOP_MANAGE}>
            <LocalTokenManage />
          </PermissionRoute>
        } />
        
        {/* 商品管理 - 需要product_manage权限 */}
        <Route path="product/list" element={
          <PermissionRoute permission={PERMISSIONS.PRODUCT_MANAGE}>
            <ProductList />
          </PermissionRoute>
        } />
        <Route path="product/batch-create" element={
          <PermissionRoute permission={PERMISSIONS.PRODUCT_MANAGE}>
            <BatchCreate />
          </PermissionRoute>
        } />
        <Route path="product/excel-import" element={
          <PermissionRoute permission={PERMISSIONS.PRODUCT_MANAGE}>
            <ExcelImport />
          </PermissionRoute>
        } />
        {/* 隐藏上架任务路由 */}
        {/* <Route path="product/tasks" element={
          <PermissionRoute permission={PERMISSIONS.PRODUCT_MANAGE}>
            <ProductTasks />
          </PermissionRoute>
        } /> */}
        
        {/* 商品裂变 - 需要fission_manage权限 */}
        <Route path="fission/create" element={
          <PermissionRoute permission={PERMISSIONS.FISSION_MANAGE}>
            <CreateFission />
          </PermissionRoute>
        } />
        <Route path="fission/tasks" element={
          <PermissionRoute permission={PERMISSIONS.FISSION_MANAGE}>
            <TaskList />
          </PermissionRoute>
        } />
        
        {/* 账号管理 - 需要account_manage权限 */}
        <Route path="account/employees" element={
          <PermissionRoute permission={PERMISSIONS.ACCOUNT_MANAGE}>
            <EmployeeManage />
          </PermissionRoute>
        } />
        <Route path="account/auth-requests" element={
          <PermissionRoute permission={PERMISSIONS.ACCOUNT_MANAGE}>
            <AuthRequests />
          </PermissionRoute>
        } />
        
        {/* 个人中心和系统设置 - 所有人都可以访问 */}
        <Route path="profile/personal" element={<PersonalCenter />} />
        <Route path="settings/system" element={<SystemSettings />} />
      </Route>
    </Routes>
  );
}

export default AppRouter;
