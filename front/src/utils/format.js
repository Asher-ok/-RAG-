import dayjs from 'dayjs';

// 格式化日期时间
export const formatDateTime = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) return '-';
  return dayjs(date).format(format);
};

// 格式化日期
export const formatDate = (date) => {
  return formatDateTime(date, 'YYYY-MM-DD');
};

// 格式化时间
export const formatTime = (date) => {
  return formatDateTime(date, 'HH:mm:ss');
};

// 格式化价格（分转元）
export const formatPrice = (price) => {
  if (price === null || price === undefined) return '-';
  return (price / 100).toFixed(2);
};

// 格式化价格（元转分）
export const parsePriceToFen = (price) => {
  if (!price) return 0;
  return Math.round(parseFloat(price) * 100);
};

// 格式化文件大小
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// 格式化数字（千分位）
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
