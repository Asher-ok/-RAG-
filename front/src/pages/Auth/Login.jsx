import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, message, Checkbox } from 'antd';
import { UserOutlined, LockOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [rememberPassword, setRememberPassword] = useState(false);
  const { login, isAuthenticated, loginLoading, error, clearAuthError } = useAuth();

  // 显示来自其他页面的提示信息
  useEffect(() => {
    if (location.state?.message) {
      message.warning(location.state.message);
    }
  }, [location]);

  // 组件加载时，尝试读取保存的账号密码
  useEffect(() => {
    const savedUsername = localStorage.getItem('savedUsername');
    const savedPassword = localStorage.getItem('savedPassword');
    const remember = localStorage.getItem('rememberPassword') === 'true';
    
    if (remember && savedUsername && savedPassword) {
      form.setFieldsValue({
        username: savedUsername,
        password: savedPassword
      });
      setRememberPassword(true);
    }
  }, [form]);

  // 如果已经登录，直接跳转到工作台
  useEffect(() => {
    // 检查token是否存在
    const token = localStorage.getItem('token');
    if (isAuthenticated && token) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 清除错误信息
  useEffect(() => {
    if (error) {
      message.error(error);
      clearAuthError();
    }
  }, [error, clearAuthError]);

  const onFinish = async (values) => {
    try {
      // 如果勾选了记住密码，保存账号密码
      if (rememberPassword) {
        localStorage.setItem('savedUsername', values.username);
        localStorage.setItem('savedPassword', values.password);
        localStorage.setItem('rememberPassword', 'true');
      } else {
        // 如果没勾选，清除保存的账号密码
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
        localStorage.removeItem('rememberPassword');
      }

      const result = await login({
        username: values.username,
        password: values.password
      });

      if (result.type.endsWith('/fulfilled')) {
        message.success('登录成功！');
        
        // 通知Electron主进程登录成功
        if (window.electronAPI) {
          window.electronAPI.loginSuccess();
        }
        
        // 延迟跳转，确保状态已更新
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 300);
      }
    } catch (error) {
      // 错误已经在useEffect中处理
      console.error('Login error:', error);
    }
  };

  // 处理忘记密码
  const handleForgotPassword = () => {
    message.info('请联系管理员重置密码');
    // TODO: 后续可以实现找回密码功能
  };

  return (
    <div className="auth-container">
      <div className="auth-background"></div>
      <div className="auth-content">
        <Card className="auth-card">
          <div className="auth-header">
            <ShopOutlined className="auth-logo" />
            <h1 className="auth-title">抖店商家助手</h1>
            <p className="auth-subtitle">欢迎登录</p>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <div className="auth-options">
                <Checkbox 
                  checked={rememberPassword}
                  onChange={(e) => setRememberPassword(e.target.checked)}
                >
                  记住密码
                </Checkbox>
                <a className="auth-link" onClick={handleForgotPassword}>
                  忘记密码？
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
                size="large"
              >
                登录
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default Login;
