// 权限常量定义
export const PERMISSIONS = {
  PRODUCT_MANAGE: 'product_manage',      // 商品管理
  SHOP_MANAGE: 'shop_manage',            // 店铺管理
  FISSION_MANAGE: 'fission_manage',      // 裂变管理
  ACCOUNT_MANAGE: 'account_manage'       // 账号管理
};

// 权限标签映射
export const PERMISSION_LABELS = {
  [PERMISSIONS.PRODUCT_MANAGE]: '商品管理',
  [PERMISSIONS.SHOP_MANAGE]: '店铺管理',
  [PERMISSIONS.FISSION_MANAGE]: '裂变管理',
  [PERMISSIONS.ACCOUNT_MANAGE]: '账号管理'
};

// 权限选项（用于表单）
export const PERMISSION_OPTIONS = [
  { label: '商品管理', value: PERMISSIONS.PRODUCT_MANAGE },
  { label: '店铺管理', value: PERMISSIONS.SHOP_MANAGE },
  { label: '裂变管理', value: PERMISSIONS.FISSION_MANAGE },
  { label: '账号管理', value: PERMISSIONS.ACCOUNT_MANAGE }
];
