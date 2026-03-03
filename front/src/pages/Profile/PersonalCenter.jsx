import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Descriptions, Modal, DatePicker, Tag, Space } from 'antd';
import { EditOutlined, KeyOutlined } from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { changePassword } from '../../services/authService';
import { updateUserInfo } from '../../services/profileService';
import { PERMISSION_LABELS } from '../../constants/permissions';
import { formatDateTime } from '../../utils/format';
import dayjs from 'dayjs';
import './PersonalCenter.css';

function PersonalCenter() {
  const [editMode, setEditMode] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const { user, accountType, permissions, updateUser } = useAuth();

  useEffect(() => {
    if (user) {
      // 使用 setTimeout 确保 Form 已经挂载
      setTimeout(() => {
        form.setFieldsValue({
          username: user.username,
          real_name: user.real_name,
          expire_time: user.expire_time ? dayjs(user.expire_time) : null
        });
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // 保存个人信息
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const response = await updateUserInfo({
        real_name: values.real_name
      });
      
      if (response.code === 200) {
        updateUser({
          real_name: values.real_name
        });
        message.success('个人信息更新成功');
        setEditMode(false);
      } else {
        message.error(response.msg || '更新失败');
      }
    } catch (error) {
      message.error(error.msg || '更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 修改密码
  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordLoading(true);

      const response = await changePassword({
        old_password: values.old_password,
        new_password: values.new_password
      });

      if (response.code === 200) {
        message.success('密码修改成功');
        setPasswordModalVisible(false);
        passwordForm.resetFields();
      } else {
        message.error(response.msg || '密码修改失败');
      }
    } catch (error) {
      message.error('密码修改失败，请重试');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>个人中心</h2>
      
      <div style={{ maxWidth: 800 }}>
        {/* 基本信息 */}
        <Card
          title="基本信息"
          extra={
            <Space>
              <Button
                type="link"
                icon={<KeyOutlined />}
                onClick={() => setPasswordModalVisible(true)}
              >
                修改密码
              </Button>
              {!editMode ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditMode(true)}
                >
                  编辑
                </Button>
              ) : (
                <Space>
                  <Button onClick={() => setEditMode(false)}>取消</Button>
                  <Button type="primary" loading={loading} onClick={handleSave}>
                    保存
                  </Button>
                </Space>
              )}
            </Space>
          }
        >
          {!editMode ? (
            <Descriptions column={1} styles={{ label: { width: 100 } }}>
              <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
              <Descriptions.Item label="真实姓名">{user?.real_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="账号类型">
                <Tag color={accountType === 1 ? 'gold' : accountType === 2 ? 'blue' : 'default'}>
                  {accountType === 1 ? '主账号' : accountType === 2 ? '员工账号' : '普通账号'}
                </Tag>
              </Descriptions.Item>
              {accountType === 2 && (
                <>
                  <Descriptions.Item label="过期时间">
                    {user?.expire_time ? formatDateTime(user.expire_time) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="账号状态">
                    <Tag color="success">正常</Tag>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          ) : (
            <Form form={form} layout="vertical">
              <Form.Item label="用户名">
                <Input value={user?.username} disabled />
              </Form.Item>
              <Form.Item
                name="real_name"
                label="真实姓名"
                rules={[{ required: true, message: '请输入真实姓名' }]}
              >
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
              {accountType === 2 && (
                <Form.Item name="expire_time" label="过期时间">
                  <DatePicker showTime disabled style={{ width: '100%' }} />
                </Form.Item>
              )}
            </Form>
          )}
        </Card>

        {/* 权限信息 */}
        {accountType === 2 && permissions && permissions.length > 0 && (
          <Card title="权限信息" style={{ marginTop: 16 }}>
            <Space wrap>
              {permissions.map(permission => (
                <Tag key={permission} color="blue">
                  {PERMISSION_LABELS[permission] || permission}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {/* 登录信息 */}
        <Card 
          title="登录信息" 
          style={{ marginTop: 16 }}
        >
          <Descriptions column={1} styles={{ label: { width: 100 } }}>
            <Descriptions.Item label="最后登录">
              {user?.last_login_time ? formatDateTime(user.last_login_time) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="登录IP">
              {user?.last_login_ip || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onOk={handleChangePassword}
        onCancel={() => {
          setPasswordModalVisible(false);
          passwordForm.resetFields();
        }}
        confirmLoading={passwordLoading}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="old_password"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前密码" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            dependencies={['new_password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PersonalCenter;