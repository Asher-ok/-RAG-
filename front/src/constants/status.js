// 账号状态
export const ACCOUNT_STATUS = {
  DISABLED: 0,    // 禁用
  ENABLED: 1,     // 启用
  EXPIRED: 2      // 已过期
};

export const ACCOUNT_STATUS_LABELS = {
  [ACCOUNT_STATUS.DISABLED]: '禁用',
  [ACCOUNT_STATUS.ENABLED]: '启用',
  [ACCOUNT_STATUS.EXPIRED]: '已过期'
};

export const ACCOUNT_STATUS_COLORS = {
  [ACCOUNT_STATUS.DISABLED]: 'default',
  [ACCOUNT_STATUS.ENABLED]: 'success',
  [ACCOUNT_STATUS.EXPIRED]: 'error'
};

// 商品状态
export const PRODUCT_STATUS = {
  DRAFT: 0,       // 草稿
  ONLINE: 1,      // 上架
  OFFLINE: 2      // 下架
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUS.DRAFT]: '草稿',
  [PRODUCT_STATUS.ONLINE]: '上架',
  [PRODUCT_STATUS.OFFLINE]: '下架'
};

export const PRODUCT_STATUS_COLORS = {
  [PRODUCT_STATUS.DRAFT]: 'default',
  [PRODUCT_STATUS.ONLINE]: 'success',
  [PRODUCT_STATUS.OFFLINE]: 'error'
};

// 任务状态
export const TASK_STATUS = {
  PENDING: 0,     // 待处理
  PROCESSING: 1,  // 进行中
  COMPLETED: 2,   // 已完成
  FAILED: 3,      // 失败
  CANCELLED: 4    // 已取消
};

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.PENDING]: '待处理',
  [TASK_STATUS.PROCESSING]: '进行中',
  [TASK_STATUS.COMPLETED]: '已完成',
  [TASK_STATUS.FAILED]: '失败',
  [TASK_STATUS.CANCELLED]: '已取消'
};

export const TASK_STATUS_COLORS = {
  [TASK_STATUS.PENDING]: 'default',
  [TASK_STATUS.PROCESSING]: 'processing',
  [TASK_STATUS.COMPLETED]: 'success',
  [TASK_STATUS.FAILED]: 'error',
  [TASK_STATUS.CANCELLED]: 'default'
};

// 审核状态
export const APPROVE_STATUS = {
  PENDING: 0,     // 待审核
  APPROVED: 1,    // 已通过
  REJECTED: 2     // 已拒绝
};

export const APPROVE_STATUS_LABELS = {
  [APPROVE_STATUS.PENDING]: '待审核',
  [APPROVE_STATUS.APPROVED]: '已通过',
  [APPROVE_STATUS.REJECTED]: '已拒绝'
};

export const APPROVE_STATUS_COLORS = {
  [APPROVE_STATUS.PENDING]: 'warning',
  [APPROVE_STATUS.APPROVED]: 'success',
  [APPROVE_STATUS.REJECTED]: 'error'
};

// 图片模式
export const IMAGE_MODE = {
  REUSE: 1,       // 复用原图
  UPLOAD: 2,      // 本地上传
  RANDOM: 3       // 随机选择
};

export const IMAGE_MODE_LABELS = {
  [IMAGE_MODE.REUSE]: '复用原图',
  [IMAGE_MODE.UPLOAD]: '本地上传',
  [IMAGE_MODE.RANDOM]: '随机选择'
};

// 发布模式
export const PUBLISH_MODE = {
  DRAFT: 1,       // 保存为草稿
  ONLINE: 2,      // 立即上架
  OFFLINE: 3      // 下架
};

export const PUBLISH_MODE_LABELS = {
  [PUBLISH_MODE.DRAFT]: '保存为草稿',
  [PUBLISH_MODE.ONLINE]: '立即上架',
  [PUBLISH_MODE.OFFLINE]: '下架'
};

export const PUBLISH_MODE_COLORS = {
  [PUBLISH_MODE.DRAFT]: 'default',
  [PUBLISH_MODE.ONLINE]: 'success',
  [PUBLISH_MODE.OFFLINE]: 'warning'
};
