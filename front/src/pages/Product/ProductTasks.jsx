import { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Progress, message, Modal, Input, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getTaskList, getTaskStatus, cancelTask } from '../../services/productService';
import { useSelector } from 'react-redux';
import { TASK_STATUS_COLORS } from '../../constants/status';
import { formatDateTime } from '../../utils/format';

function ProductTasks() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [taskIdInput, setTaskIdInput] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [statusFilter, setStatusFilter] = useState(null);

  // 从 Redux 获取当前店铺
  const currentShop = useSelector(state => state.shop.currentShop);
  const shopList = useSelector(state => state.shop.shopList);
  const shopId = currentShop?.id;

  useEffect(() => {
    if (shopId) {
      fetchTaskList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, pagination.current, statusFilter]);

  const fetchTaskList = async () => {
    if (!shopId) {
      return;
    }

    console.log(`[任务列表] 加载任务 - 店铺:${shopId === 'all' ? '全部' : shopId}, 页码:${pagination.current}`);

    setLoading(true);
    try {
      const params = {
        page_no: pagination.current,
        page_size: pagination.pageSize
      };

      // 如果不是"全部店铺"，添加shop_id参数
      if (shopId !== 'all') {
        params.shop_id = shopId;
      }

      // 添加状态筛选
      if (statusFilter !== null) {
        params.task_status = statusFilter;
      }

      const response = await getTaskList(params);
      
      if (response.code === 200 && response.data.success) {
        setDataSource(response.data.list || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0
        }));
      } else {
        message.error(response.msg || '获取任务列表失败');
        setDataSource([]);
      }
    } catch (error) {
      console.error('[任务列表] 请求异常:', error);
      message.error('获取任务列表失败');
      setDataSource([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskDetail = async (taskId) => {
    if (!taskId) {
      message.warning('请先输入有效的任务ID');
      return;
    }
    
    setLoading(true);
    try {
      const response = await getTaskStatus(taskId);
      if (response.code === 200) {
        setCurrentTask({ task_id: taskId, ...response.data });
        setDetailVisible(true);
      } else {
        message.error(response.msg || '任务不存在或查询失败');
      }
    } catch (error) {
      message.error('获取任务详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (taskId) => {
    if (!taskId) {
      message.warning('请先输入有效的任务ID');
      return;
    }
    
    try {
      const response = await cancelTask({ task_id: taskId });
      if (response.code === 200) {
        message.success('任务已取消');
        fetchTaskList();
      } else {
        message.error(response.msg || '取消失败');
      }
    } catch (error) {
      message.error('取消失败');
    }
  };

  const handleQueryTask = () => {
    if (!taskIdInput.trim()) {
      message.warning('请输入任务ID');
      return;
    }
    fetchTaskDetail(taskIdInput.trim());
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPagination({ ...pagination, current: 1 });
  };

  const columns = [
    { 
      title: '任务ID', 
      dataIndex: 'task_id', 
      width: 280,
      ellipsis: true
    },
    { 
      title: '店铺ID', 
      dataIndex: 'shop_id', 
      width: 100,
      render: (shop_id) => {
        if (shopId === 'all') {
          const shop = shopList.find(s => s.id === shop_id);
          return shop ? shop.shop_name : `店铺${shop_id}`;
        }
        return shop_id;
      }
    },
    {
      title: '状态',
      dataIndex: 'status_text',
      width: 100,
      render: (text, record) => (
        <Tag color={TASK_STATUS_COLORS[record.task_status]}>{text}</Tag>
      )
    },
    {
      title: '进度',
      dataIndex: 'progress_percent',
      width: 150,
      render: (percent, record) => (
        <Progress 
          percent={percent} 
          size="small"
          status={record.task_status === 3 ? 'exception' : record.task_status === 2 ? 'success' : 'active'}
        />
      )
    },
    {
      title: '总数/成功/失败',
      key: 'counts',
      width: 150,
      render: (_, record) => (
        <span>
          {record.total_count} / 
          <span style={{ color: '#52c41a' }}> {record.success_count}</span> / 
          <span style={{ color: '#ff4d4f' }}> {record.failed_count}</span>
        </span>
      )
    },
    {
      title: '当前商品',
      dataIndex: 'current_product_title',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-'
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      width: 180,
      render: (text) => text ? formatDateTime(text) : '-'
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      width: 180,
      render: (text) => text ? formatDateTime(text) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            size="small"
            onClick={() => fetchTaskDetail(record.task_id)}
          >
            查看详情
          </Button>
          {(record.task_status === 0 || record.task_status === 1) && (
            <Button 
              type="link" 
              size="small"
              danger
              onClick={() => handleCancel(record.task_id)}
            >
              取消
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>上架任务</h2>
          {shopId === 'all' && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
              （正在查看所有店铺的任务）
            </span>
          )}
        </div>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="任务状态"
            allowClear
            value={statusFilter}
            onChange={handleStatusChange}
            options={[
              { label: '待处理', value: 0 },
              { label: '进行中', value: 1 },
              { label: '已完成', value: 2 },
              { label: '失败', value: 3 },
              { label: '已取消', value: 4 }
            ]}
          />
          <Input
            placeholder="输入任务ID查询详情"
            style={{ width: 250 }}
            value={taskIdInput}
            onChange={(e) => setTaskIdInput(e.target.value)}
            onPressEnter={handleQueryTask}
          />
          <Button type="primary" onClick={handleQueryTask}>
            查询详情
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchTaskList}>
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        {!shopId ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <p style={{ fontSize: 16 }}>请先在顶部选择店铺</p>
          </div>
        ) : (
          <Table
            loading={loading}
            dataSource={dataSource}
            columns={columns}
            rowKey="task_id"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page, pageSize) => handleTableChange({ current: page, pageSize })
            }}
            scroll={{ x: 1500 }}
          />
        )}
      </Card>

      <Modal
        title="任务详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          currentTask && currentTask.status !== '已完成' && currentTask.status !== '已取消' && (
            <Button key="cancel" danger onClick={() => {
              handleCancel(currentTask.task_id);
              setDetailVisible(false);
            }}>
              取消任务
            </Button>
          )
        ]}
        width={700}
      >
        {currentTask && (
          <div>
            <p><strong>任务ID:</strong> {currentTask.task_id}</p>
            <p><strong>状态:</strong> <Tag color={TASK_STATUS_COLORS[currentTask.status]}>{currentTask.status}</Tag></p>
            <p><strong>总数:</strong> {currentTask.total}</p>
            <p><strong>成功:</strong> {currentTask.success_count}</p>
            <p><strong>失败:</strong> {currentTask.failed}</p>
            <p><strong>开始时间:</strong> {formatDateTime(currentTask.start_time)}</p>
            <p><strong>结束时间:</strong> {formatDateTime(currentTask.end_time)}</p>

            <Progress
              percent={currentTask.total > 0 ? Math.round((currentTask.success_count / currentTask.total) * 100) : 0}
              status={currentTask.failed > 0 ? 'exception' : 'success'}
            />

            {currentTask.failed_list && currentTask.failed_list.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong>失败列表:</strong>
                <ul>
                  {currentTask.failed_list.map((item, index) => (
                    <li key={index}>{JSON.stringify(item)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ProductTasks;
