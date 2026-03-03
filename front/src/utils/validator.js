// 验证用户名
export const validateUsername = (rule, value) => {
  if (!value) {
    return Promise.reject('请输入用户名');
  }
  if (value.length < 3 || value.length > 20) {
    return Promise.reject('用户名长度为3-20个字符');
  }
  if (!/^[a-zA-Z0-9_]+$/.test(value)) {
    return Promise.reject('用户名只能包含字母、数字和下划线');
  }
  return Promise.resolve();
};

// 验证密码
export const validatePassword = (rule, value) => {
  if (!value) {
    return Promise.reject('请输入密码');
  }
  if (value.length < 6 || value.length > 20) {
    return Promise.reject('密码长度为6-20个字符');
  }
  return Promise.resolve();
};

// 验证真实姓名
export const validateRealName = (rule, value) => {
  if (!value) {
    return Promise.reject('请输入真实姓名');
  }
  if (value.length < 2 || value.length > 20) {
    return Promise.reject('真实姓名长度为2-20个字符');
  }
  return Promise.resolve();
};

// 验证手机号
export const validatePhone = (rule, value) => {
  if (!value) {
    return Promise.resolve();
  }
  if (!/^1[3-9]\d{9}$/.test(value)) {
    return Promise.reject('请输入正确的手机号');
  }
  return Promise.resolve();
};

// 验证邮箱
export const validateEmail = (rule, value) => {
  if (!value) {
    return Promise.resolve();
  }
  if (!/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(value)) {
    return Promise.reject('请输入正确的邮箱地址');
  }
  return Promise.resolve();
};
