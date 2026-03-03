import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Input, Space, Tag, message, Select } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { getShopAuthRequests, approveShopAuth } from '../../services/accountService';
import { APPROVE_STATUS_LABELS, APPROVE_STATUS_COLORS } from '../../constants/status';
import { formatDateTime } from '../../utils/format';

const { TextArea } = Input;

function AuthRequests() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filterStatus, setFilterStatus] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getShopAuthRequests({
        page_no: pagination.current,
        page_size: pagination.pageSize,
        approve_status: filterStatus
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

  const handleApprove = async (requestId, approveStatus, rejectReason = '') => {
    try {
      const response = await approveShopAuth({
        request_id: requestId,
        approve_status: approveStatus,
        reject_reason: rejectReason
      });

      if (response.code === 200) {
        message.success('审核成功');
        setModalVisible(false);
        setRejectReason('');
        fetchData();
      } else {
        message.error(response.msg || '审核失败');
      }
    } catch (error) {
      message.error('审核失败');
    }
  };

  const showRejectModal = (record) => {
    setCurrentRequest(record);
    setModalVisible(true);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      message.warning('请输入拒绝理由');
      return;
    }
    handleApprove(currentRequest.request_id, 2, rejectReason);
  };

  const columns = [
    { title: '申请ID', dataIndex: 'request_id', width: 200 },
    { title: '员工用户名', dataIndex: 'username', width: 120 },
    { title: '店铺ID', dataIndex: 'shop_id', width: 100 },
    { title: '店铺名称', dataIndex: 'shop_name', width: 150 },
    { title: '申请理由', dataIndex: 'reason', width: 200, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'approve_status',
      width: 100,
      render: (status) => (
        <Tag color={APPROVE_STATUS_COLORS[status]}>{APPROVE_STATUS_LABELS[status]}</Tag>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'create_time',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => {
        if (record.approve_status === 0) {
          return (
            <Space>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.request_id, 1)}
              >
                通过
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => showRejectModal(record)}
              >
                拒绝
              </Button>
            </Space>
          );
        }
        return '-';
      }
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>授权申请</h2>
        <Select
          style={{ width: 150 }}
          placeholder="筛选状态"
          allowClear
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { label: '待审核', value: 0 },
            { label: '已通过', value: 1 },
            { label: '已拒绝', value: 2 }
          ]}
        />
      </div>

      <Card>
        <Table
          loading={loading}
          dataSource={dataSource}
          columns={columns}
          rowKey="request_id"
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
        title="拒绝申请"
        open={modalVisible}
        onOk={handleReject}
        onCancel={() => {
          setModalVisible(false);
          setRejectReason('');
        }}
      >
        <TextArea
          rows={4}
          placeholder="请输入拒绝理由"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default AuthRequests;
