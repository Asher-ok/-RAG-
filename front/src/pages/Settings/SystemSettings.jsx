import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Select, InputNumber, message, Space, Alert, Modal } from 'antd';
import { SaveOutlined, ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { getSystemConfig, updateSystemConfig, resetSystemConfig, testDouyinAPI } from '../../services/settingsService';
import './SystemSettings.css';

const { Option } = Select;

function SystemSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const { isMasterAccount } = useAuth();

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  // 获取系统配置
  const fetchSystemConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await getSystemConfig();
      if (response.code === 200) {
        form.setFieldsValue(response.data);
      } else {
        message.error(response.msg || '获取系统配置失败');
      }
    } catch (error) {
      message.error('获取系统配置失败');
    } finally {
      setConfigLoading(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await updateSystemConfig(values);
      
      if (response.code === 200) {
        message.success('系统配置保存成功');
        
        // 如果修改了关键配置，提示重启
        const currentValues = form.getFieldsValue();
        if (values.douyin_app_key !== currentValues.douyin_app_key || 
            values.douyin_app_secret !== currentValues.douyin_app_secret) {
          Modal.confirm({
            title: '配置已更新',
            icon: <ExclamationCircleOutlined />,
            content: '抖音API配置已更新，建议重启应用以确保配置生效。',
            okText: '确定',
            cancelText: '取消'
          });
        }
      } else {
        message.error(response.msg || '保存失败');
      }
    } catch (error) {
      message.error('保存失败，请检查配置项');
    } finally {
      setLoading(false);
    }
  };

  // 重置配置
  const handleReset = () => {
    Modal.confirm({
      title: '确认重置',
      icon: <ExclamationCircleOutlined />,
      content: '确定要重置所有配置到默认值吗？此操作不可撤销。',
      okText: '确定重置',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setResetLoading(true);
        try {
          const response = await resetSystemConfig();
          
          if (response.code === 200) {
            message.success('配置已重置为默认值');
            // 重新获取配置
            await fetchSystemConfig();
          } else {
            message.error(response.msg || '重置失败');
          }
        } catch (error) {
          message.error('重置失败，请重试');
        } finally {
          setResetLoading(false);
        }
      }
    });
  };

  // 测试抖音API连接
  const testDouyinConnection = async () => {
    const appKey = form.getFieldValue('douyin_app_key');
    const appSecret = form.getFieldValue('douyin_app_secret');
    
    if (!appKey || !appSecret) {
      message.warning('请先填写抖音API配置');
      return;
    }

    setTestLoading(true);
    try {
      const response = await testDouyinAPI({
        app_key: appKey,
        app_secret: appSecret
      });
      
      if (response.code === 200) {
        message.success('抖音API连接测试成功');
      } else {
        message.error(response.msg || '抖音API连接测试失败');
      }
    } catch (error) {
      message.error('抖音API连接测试失败，请检查配置');
    } finally {
      setTestLoading(false);
    }
  };

  if (!isMasterAccount()) {
    return (
      <div>
        <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>系统设置</h2>
        <Alert
          title="权限不足"
          description="只有主账号才能访问系统设置页面。"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>系统设置</h2>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            loading={resetLoading}
            onClick={handleReset}
          >
            重置配置
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={handleSave}
          >
            保存配置
          </Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        {configLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Button loading>加载配置中...</Button>
          </div>
        ) : (
          <>
            {/* 抖音API配置 */}
        <Card title="抖音开放平台配置" style={{ marginBottom: 16 }}>
          <Alert
            title="重要提示"
            description="请在抖音开放平台申请应用后，填写正确的App Key和App Secret。配置错误将导致无法正常使用店铺授权功能。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item
            name="douyin_app_key"
            label="App Key"
            rules={[{ required: true, message: '请输入抖音App Key' }]}
          >
            <Input placeholder="请输入抖音开放平台的App Key" />
          </Form.Item>

          <Form.Item
            name="douyin_app_secret"
            label="App Secret"
            rules={[{ required: true, message: '请输入抖音App Secret' }]}
          >
            <Input.Password placeholder="请输入抖音开放平台的App Secret" />
          </Form.Item>

          <Form.Item
            name="douyin_redirect_uri"
            label="回调地址"
            rules={[
              { required: true, message: '请输入回调地址' },
              { type: 'url', message: '请输入有效的URL地址' }
            ]}
          >
            <Input placeholder="请输入OAuth回调地址" />
          </Form.Item>

          <Button 
            type="dashed" 
            loading={testLoading}
            onClick={testDouyinConnection}
          >
            测试API连接
          </Button>
        </Card>

        {/* 系统基础配置 */}
        <Card title="系统基础配置" style={{ marginBottom: 16 }}>
          <Form.Item
            name="system_name"
            label="系统名称"
            rules={[{ required: true, message: '请输入系统名称' }]}
          >
            <Input placeholder="请输入系统名称" />
          </Form.Item>

          <Form.Item name="system_version" label="系统版本">
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="max_concurrent_tasks"
            label="最大并发任务数"
            rules={[{ required: true, message: '请输入最大并发任务数' }]}
          >
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="task_retry_times"
            label="任务重试次数"
            rules={[{ required: true, message: '请输入任务重试次数' }]}
          >
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="task_timeout"
            label="任务超时时间（秒）"
            rules={[{ required: true, message: '请输入任务超时时间' }]}
          >
            <InputNumber min={60} max={3600} style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        {/* 文件上传配置 */}
        <Card title="文件上传配置" style={{ marginBottom: 16 }}>
          <Form.Item
            name="max_file_size"
            label="最大文件大小（MB）"
            rules={[{ required: true, message: '请输入最大文件大小' }]}
          >
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="allowed_file_types"
            label="允许的文件类型"
            rules={[{ required: true, message: '请输入允许的文件类型' }]}
          >
            <Input placeholder="用逗号分隔，如：jpg,png,xlsx" />
          </Form.Item>
        </Card>

        {/* 安全配置 */}
        <Card title="安全配置" style={{ marginBottom: 16 }}>
          <Form.Item
            name="session_timeout"
            label="会话超时时间（小时）"
            rules={[{ required: true, message: '请输入会话超时时间' }]}
          >
            <InputNumber min={1} max={168} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="password_min_length"
            label="密码最小长度"
            rules={[{ required: true, message: '请输入密码最小长度' }]}
          >
            <InputNumber min={6} max={20} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="login_max_attempts"
            label="登录最大尝试次数"
            rules={[{ required: true, message: '请输入登录最大尝试次数' }]}
          >
            <InputNumber min={3} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Card>

        {/* 通知配置 */}
        <Card title="通知配置" style={{ marginBottom: 16 }}>
          <Form.Item name="email_notifications" label="邮件通知" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="task_completion_notify" label="任务完成通知" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="error_notifications" label="错误通知" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        {/* 日志配置 */}
        <Card title="日志配置" style={{ marginBottom: 16 }}>
          <Form.Item name="log_level" label="日志级别" rules={[{ required: true }]}>
            <Select>
              <Option value="DEBUG">DEBUG</Option>
              <Option value="INFO">INFO</Option>
              <Option value="WARNING">WARNING</Option>
              <Option value="ERROR">ERROR</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="log_retention_days"
            label="日志保留天数"
            rules={[{ required: true, message: '请输入日志保留天数' }]}
          >
            <InputNumber min={7} max={365} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enable_api_log" label="启用API日志" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        {/* 其他配置 */}
        <Card title="其他配置" style={{ marginBottom: 16 }}>
          <Form.Item name="auto_refresh_token" label="自动刷新Token" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="enable_debug_mode" label="启用调试模式" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="maintenance_mode" label="维护模式" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>
        </>
        )}
      </Form>
    </div>
  );
}

export default SystemSettings;