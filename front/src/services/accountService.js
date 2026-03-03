import api from './api';

// 添加员工账号
export const addEmployee = (data) => {
  return api.post('/account/add_employee', data);
};

// 员工账号列表
export const getEmployeeList = (params) => {
  return api.get('/account/employee_list', { params });
};

// 修改员工账号
export const updateEmployee = (employeeId, data) => {
  return api.patch(`/account/employee/${employeeId}`, data);
};

// 删除员工账号
export const deleteEmployee = (employeeId) => {
  return api.delete(`/account/employee/${employeeId}`);
};

// 员工申请店铺授权
export const requestShopAuth = (data) => {
  return api.post('/account/request_shop_auth', data);
};

// 主账号审核店铺授权
export const approveShopAuth = (data) => {
  return api.post('/account/approve_shop_auth', data);
};

// 店铺授权申请列表
export const getShopAuthRequests = (params) => {
  return api.get('/account/shop_auth_requests', { params });
};
