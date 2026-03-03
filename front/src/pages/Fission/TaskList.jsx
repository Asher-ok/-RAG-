import { useState, useEffect, useRef } from 'react';
import { Card, Table, Tag, Progress, Button, Space, message, Modal, Tooltip, Steps } from 'antd';
import { ReloadOutlined, StopOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getTaskList, getTaskStatus, cancelTask } from '../../services/fissionService';
import { selectTaskSteps, selectTaskInProgress } from '../../store/slices/fissionSlice';

function TaskList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [taskList, setTaskList] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  
  // ✅ 使用 ref 保存当前页码，避免定时器闭包问题
  const currentPageRef = useRef(1);
  
  // ✅ 新增：进度弹窗状态
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const stepsContainerRef = useRef(null);
  
  // 从全局状态获取当前选中的店铺
  const currentShop = useSelector(state => state.shop.currentShop);
  const shopList = useSelector(state => state.shop.shopList);
  const shopId = currentShop?.id;
  
  // ✅ 从 Redux 获取选中任务的步骤和执行状态
  const taskSteps = useSelector(selectTaskSteps(selectedTaskId));
  const taskInProgress = useSelector(selectTaskInProgress(selectedTaskId));
  
  // 自动刷新定时器
  const refreshTimerRef = useRef(null);
  
  // 加载任务列表
  const loadTaskList = async (page = 1) => {
    if (!shopId) {
      return;
    }
    
    try {
      setLoading(true);
      const params = {
        page_no: page,
        page_size: pagination.pageSize
      };
      
      // 如果不是"全部店铺"，添加shop_id参数
      if (shopId !== 'all') {
        params.shop_id = shopId;
      }
      
      console.log(`[裂变任务] 加载任务 - 店铺:${shopId === 'all' ? '全部' : shopId}, 页码:${page}`);
      
      const response = await getTaskList(params);
      
      if (response.code === 200) {
        setTaskList(response.data.list || []);
        setPagination({
          ...pagination,
          current: page,
          total: response.data.total || 0
        });
      } else {
        message.error(response.msg || '加载失败');
      }
    } catch (error) {
      console.error(error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    if (shopId) {
      loadTaskList(1);
      
      // 启动自动刷新（每5秒刷新一次）
      refreshTimerRef.current = setInterval(() => {
        loadTaskList(pagination.current);
      }, 5000);
    }
    
    // 清理定时器
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [shopId, pagination.current]); // ✅ 添加 pagination.current 依赖
  
  // 手动刷新
  const handleRefresh = () => {
    loadTaskList(pagination.current);
  };
  
  // 取消任务
  const handleCancelTask = async (taskId) => {
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消这个任务吗？',
      onOk: async () => {
        try {
          // ✅ 1. 先通知Electron停止执行（立即生效）
          if (window.electronAPI && window.electronAPI.cancelFissionTask) {
            try {
              await window.electronAPI.cancelFissionTask(taskId);
              console.log('[前端] ✅ 已通知Electron取消任务:', taskId);
            } catch (error) {
              console.error('[前端] 通知Electron取消任务失败:', error);
            }
          }
          
          // ✅ 2. 再调用后端API更新任务状态
          const response = await cancelTask({ task_id: taskId });
          if (response.code === 200) {
            message.success('任务已取消');
            loadTaskList(pagination.current);
          } else {
            message.error(response.msg || '取消失败');
          }
        } catch (error) {
          console.error(error);
          message.error('取消失败');
        }
      }
    });
  };
  
  // 查看任务详情
  const handleViewDetail = async (taskId) => {
    try {
      const response = await getTaskStatus({ task_id: taskId });
      if (response.code === 200) {
        const task = response.data;
        
        // 计算实际进度
        const actualProgress = task.total_count > 0 
          ? (task.task_status === 2 ? 100 : Math.floor(((task.success_count + task.failed_count) / task.total_count) * 100))
          : 0;
        
        // 任务状态文本
        const statusText = {
          0: '待处理',
          1: '进行中',
          2: '已完成',
          3: '失败',
          4: '已取消'
        }[task.task_status] || '未知';
        
        Modal.info({
          title: '任务详情',
          width: 600,
          content: (
            <div style={{ marginTop: 16 }}>
              <p><strong>任务ID：</strong>{task.task_id}</p>
              <p><strong>任务状态：</strong>{statusText}</p>
              <p><strong>总数量：</strong>{task.total_count}</p>
              <p><strong>成功数量：</strong><span style={{ color: '#52c41a' }}>{task.success_count}</span></p>
              <p><strong>失败数量：</strong><span style={{ color: '#ff4d4f' }}>{task.failed_count}</span></p>
              <p><strong>当前进度：</strong>{task.success_count + task.failed_count}/{task.total_count}</p>
              <p><strong>进度百分比：</strong>{actualProgress}%</p>
              {task.task_status === 1 && task.current_product_title && (
                <p><strong>当前商品：</strong>{task.current_product_title}</p>
              )}
              <p><strong>创建时间：</strong>{task.create_time || '-'}</p>
              <p><strong>开始时间：</strong>{task.start_time || '-'}</p>
              <p><strong>结束时间：</strong>{task.end_time || '-'}</p>
              {task.error_message && (
                <p style={{ color: '#ff4d4f' }}>
                  <strong>错误信息：</strong>{task.error_message}
                </p>
              )}
            </div>
          )
        });
      }
    } catch (error) {
      console.error(error);
      message.error('加载详情失败');
    }
  };

  // ✅ 新增：查看步骤进度
  const handleViewProgress = (taskId) => {
    setSelectedTaskId(taskId);
    setProgressModalVisible(true);
  };

  // ✅ 新增：关闭进度弹窗
  const handleCloseProgressModal = () => {
    setProgressModalVisible(false);
    setSelectedTaskId(null);
  };

  // ✅ 新增：获取步骤状态图标
  const getStepIcon = (step) => {
    if (step.status === 'success') {
      return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    } else if (step.status === 'error') {
      return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    } else if (step.status === 'process') {
      return <SyncOutlined spin style={{ color: '#1890ff' }} />;
    } else {
      return <ExclamationCircleOutlined style={{ color: '#d9d9d9' }} />;
    }
  };

  // 重试功能已隐藏
  // const handleRetryFailed = async (taskId, failedCount) => {
  //   ...
  // };
  
  // 任务状态标签
  const getStatusTag = (status) => {
    const statusMap = {
      0: { text: '待处理', color: 'default' },
      1: { text: '进行中', color: 'processing' },
      2: { text: '已完成', color: 'success' },
      3: { text: '失败', color: 'error' },
      4: { text: '已取消', color: 'warning' }
    };
    const config = statusMap[status] || { text: '未知', color: 'default' };
    return <Tag color={config.color}>{config.text}</Tag>;
  };
  
  // 表格列定义
  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 200,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{text}</span>
        </Tooltip>
      )
    },
    // 当选择"全部店铺"时，显示所属店铺列
    ...(shopId === 'all' ? [{
      title: '所属店铺',
      dataIndex: 'shop_id',
      key: 'shop_id',
      width: 150,
      render: (shop_id) => {
        const shop = shopList.find(s => s.id === shop_id);
        return shop ? shop.shop_name : `店铺${shop_id}`;
      }
    }] : []),
    {
      title: '状态',
      dataIndex: 'task_status',
      key: 'task_status',
      width: 100,
      render: (status) => getStatusTag(status)
    },
    {
      title: '进度',
      key: 'progress',
      width: 250,
      render: (_, record) => {
        // 如果状态是已完成(2)，强制显示100%
        const percent = record.task_status === 2 ? 100 : record.progress_percent;
        
        return (
          <div>
            <Progress 
              percent={percent} 
              size="small"
              status={
                record.task_status === 3 ? 'exception' : 
                record.task_status === 2 ? 'success' : 
                'active'
              }
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              {record.current_index}/{record.total_count} 
              {record.task_status === 1 && record.current_product_title && (
                <span style={{ marginLeft: 8 }}>
                  正在处理: {record.current_product_title.substring(0, 20)}...
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      title: '总数/成功/失败',
      key: 'counts',
      width: 150,
      render: (_, record) => (
        <span>
          {record.total_count} / 
          <span style={{ color: '#52c41a', margin: '0 4px' }}>{record.success_count}</span> / 
          <span style={{ color: '#ff4d4f' }}>{record.failed_count}</span>
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      key: 'create_time',
      width: 160
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 160,
      render: (text) => text || '-'
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 160,
      render: (text) => text || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.task_id)}
          >
            详情
          </Button>
          {(record.task_status === 0 || record.task_status === 1) && (
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<StopOutlined />}
              onClick={() => handleCancelTask(record.task_id)}
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24 
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>裂变任务列表</h2>
          {shopId === 'all' && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
              （正在查看所有店铺的任务）
            </span>
          )}
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
          <Button 
            type="primary"
            onClick={() => navigate('/fission/create')}
          >
            创建裂变
          </Button>
        </Space>
      </div>
      
      {!shopId ? (
        <Card>
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <p style={{ fontSize: 16 }}>请先在顶部选择店铺</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ 
            padding: 12, 
            background: '#e6f7ff', 
            border: '1px solid #91d5ff',
            borderRadius: 4,
            marginBottom: 16
          }}>
            <p style={{ margin: 0, color: '#1890ff', fontSize: 14 }}>
              💡 <strong>说明：</strong>页面每5秒自动刷新一次，实时显示任务进度。
            </p>
          </div>
          
          <Table
            columns={columns}
            dataSource={taskList}
            rowKey="task_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
              onChange: (page) => loadTaskList(page)
            }}
            scroll={{ x: shopId === 'all' ? 1550 : 1400 }}
          />
        </Card>
      )}

      {/* ✅ 新增：步骤进度弹窗 */}
      <Modal
        title="裂变步骤进度"
        open={progressModalVisible}
        onCancel={handleCloseProgressModal}
        footer={[
          <Button key="close" onClick={handleCloseProgressModal}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {taskSteps && taskSteps.length > 0 ? (
          <div ref={stepsContainerRef} style={{ maxHeight: 500, overflowY: 'auto', padding: '16px 0' }}>
            <Steps
              direction="vertical"
              current={taskSteps.findIndex(s => s.status === 'process')}
              items={taskSteps.map((step, index) => ({
                title: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {getStepIcon(step)}
                    <span>{step.title}</span>
                  </div>
                ),
                description: (
                  <div style={{ marginTop: 8 }}>
                    {step.description && (
                      <div style={{ color: '#666', marginBottom: 4 }}>{step.description}</div>
                    )}
                    {step.error && (
                      <div style={{ color: '#ff4d4f', fontSize: 12 }}>
                        错误: {step.error}
                      </div>
                    )}
                    {step.timestamp && (
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {new Date(step.timestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                ),
                status: step.status === 'success' ? 'finish' : 
                       step.status === 'error' ? 'error' : 
                       step.status === 'process' ? 'process' : 'wait'
              }))}
            />
            {taskInProgress && (
              <div style={{ 
                marginTop: 16, 
                padding: 12, 
                background: '#e6f7ff', 
                border: '1px solid #91d5ff',
                borderRadius: 4,
                textAlign: 'center'
              }}>
                <SyncOutlined spin style={{ marginRight: 8, color: '#1890ff' }} />
                <span style={{ color: '#1890ff' }}>任务执行中，步骤实时更新...</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <p>暂无步骤信息</p>
            <p style={{ fontSize: 12 }}>该任务可能尚未开始执行或步骤信息未记录</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TaskList;
