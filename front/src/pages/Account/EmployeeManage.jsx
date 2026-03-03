import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, DatePicker, Checkbox, Radio, Space, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getEmployeeList, addEmployee, updateEmployee, deleteEmployee } from '../../services/accountService';
import { ACCOUNT_STATUS_LABELS, ACCOUNT_STATUS_COLORS } from '../../constants/status';
import { PERMISSION_OPTIONS } from '../../constants/permissions';
import { formatDateTime } from '../../utils/format';
import dayjs from 'dayjs';

function EmployeeManage() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getEmployeeList({
        page_no: pagination.current,
        page_size: pagination.pageSize
      });

      if (response.code === 200) {
        setDataSource(response.data.list);
        setPagination(prev => ({ ...prev, total: response.data.total }));
      } else {
        message.error(response.msg || '获取数据失败');
      }
    } catch (error) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理权限变化
   * 规则：商品管理和店铺管理必须同时选择或同时取消
   * 原因：商品管理依赖店铺管理，两者功能紧密关联
   */
  const handlePermissionChange = (checkedValues) => {
    const hasProductManage = checkedValues.includes('product_manage');
    const hasShopManage = checkedValues.includes('shop_manage');

    // 如果选择了商品管理但没选店铺管理，自动添加店铺管理
    if (hasProductManage && !hasShopManage) {
      checkedValues.push('shop_manage');
      message.info('商品管理需要店铺管理权限，已自动添加');
    }
    // 如果选择了店铺管理但没选商品管理，自动添加商品管理
    else if (hasShopManage && !hasProductManage) {
      checkedValues.push('product_manage');
      message.info('店铺管理需要商品管理权限，已自动添加');
    }

    form.setFieldsValue({ permissions: checkedValues });
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    // 设置默认值
    form.setFieldsValue({
      permissions: [] // 默认不选中任何权限
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      expire_time: record.expire_time ? dayjs(record.expire_time) : null,
      account_status: record.account_status
    });
    setModalVisible(true);
  };

  const handleDelete = async (employeeId) => {
    try {
      const response = await deleteEmployee(employeeId);
      if (response.code === 200) {
        message.success('删除成功');
        fetchData();
      } else {
        message.error(response.msg || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        expire_time: values.expire_time ? values.expire_time.format('YYYY-MM-DD HH:mm:ss') : null
      };

      let response;
      if (editingRecord) {
        response = await updateEmployee(editingRecord.employee_id, data);
      } else {
        response = await addEmployee(data);
      }

      if (response.code === 200) {
        message.success(editingRecord ? '修改成功' : '添加成功');
        setModalVisible(false);
        form.resetFields(); // 重置表单
        setEditingRecord(null); // 清空编辑记录
        fetchData();
      } else {
        message.error(response.msg || '操作失败');
      }
    } catch (error) {
      console.error(error);
      if (error.errorFields) {
        // 表单验证错误，不需要提示
        return;
      }
      message.error('操作失败，请重试');
    }
  };

  const columns = [
    { title: '员工ID', dataIndex: 'employee_id', width: 100 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '真实姓名', dataIndex: 'real_name', width: 120 },
    {
      title: '过期时间',
      dataIndex: 'expire_time',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      width: 200,
      render: (permissions) => (
        <Space wrap>
          {permissions?.map(p => (
            <Tag key={p} color="blue">{PERMISSION_OPTIONS.find(opt => opt.value === p)?.label}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'account_status',
      width: 100,
      render: (status) => (
        <Tag color={ACCOUNT_STATUS_COLORS[status]}>{ACCOUNT_STATUS_LABELS[status]}</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.employee_id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>员工管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加员工
        </Button>
      </div>

      <Card>
        <Table
          loading={loading}
          dataSource={dataSource}
          columns={columns}
          rowKey="employee_id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setPagination({ ...pagination, current: page, pageSize })
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingRecord ? '编辑员工' : '添加员工'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingRecord(null);
        }}
        width={600}
        destroyOnHidden={true}
        // destroyOnClose={true}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="请输入用户名" disabled={!!editingRecord} />
          </Form.Item>

          {!editingRecord && (
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}

          <Form.Item name="real_name" label="真实姓名" rules={[{ required: true, message: '请输入真实姓名' }]}>
            <Input placeholder="请输入真实姓名" />
          </Form.Item>

          <Form.Item name="expire_time" label="过期时间" rules={[{ required: true, message: '请选择过期时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} placeholder="请选择过期时间" />
          </Form.Item>

          <Form.Item 
            name="permissions" 
            label="权限" 
            rules={[{ required: true, message: '请选择权限' }]}
            extra="注意：商品管理和店铺管理必须同时选择"
          >
            <Checkbox.Group 
              options={PERMISSION_OPTIONS}
              onChange={handlePermissionChange}
            />
          </Form.Item>

          {editingRecord && (
            <Form.Item name="account_status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
              <Radio.Group>
                <Radio value={1}>启用</Radio>
                <Radio value={0}>禁用</Radio>
              </Radio.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default EmployeeManage;
