import { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Space, Tag, message, Select, Modal, Steps, Alert } from 'antd';
import { ReloadOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { API_BASE_URL } from '../../config';
import { useProduct } from '../../hooks/useProduct';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_COLORS } from '../../constants/status';
import { formatDateTime, formatPrice } from '../../utils/format';

function ProductList() {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncSteps, setSyncSteps] = useState([]);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const stepsContainerRef = useRef(null); // 用于滚动到底部
  
  // 使用Redux状态管理
  const {
    productList,
    listLoading,
    pagination,
    filters,
    selectedProducts,
    getProductList,
    syncProductStatus,
    setProductFilters,
    setProductPagination,
    selectProducts,
    clearSelection
  } = useProduct();
  
  // 从 Redux 获取当前店铺和店铺列表
  const currentShop = useSelector(state => state.shop.currentShop);
  const shopList = useSelector(state => state.shop.shopList);
  const shopId = currentShop?.id;  // 使用数据库自增ID

  // 当步骤更新时，自动滚动到底部
  useEffect(() => {
    if (stepsContainerRef.current && syncSteps.length > 0) {
      stepsContainerRef.current.scrollTop = stepsContainerRef.current.scrollHeight;
    }
  }, [syncSteps]);

  // 当店铺切换时，重置分页和选中状态（不自动拉取商品）
  useEffect(() => {
    if (shopId) {
      setProductPagination({ current: 1 });
      setSelectedRowKeys([]);
      clearSelection();
      // 不自动拉取商品，让用户手动点击"同步商品"按钮
      // fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  // 当分页或筛选条件变化时，重新加载数据
  useEffect(() => {
    if (shopId && pagination.current !== 1) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize]);

  const fetchData = async (forceRefresh = false) => {
    if (!shopId) {
      console.warn('[商品列表] shopId 为空，跳过加载');
      return;
    }

    console.log('[商品列表] ========== 开始加载商品 ==========');
    console.log('[商品列表] 店铺ID:', shopId);
    console.log('[商品列表] 页码:', pagination.current);
    console.log('[商品列表] 每页数量:', pagination.pageSize);
    console.log('[商品列表] 强制刷新:', forceRefresh);
    console.log('[商品列表] 筛选条件:', filters);

    try {
      const params = {
        page_no: pagination.current,
        page_size: pagination.pageSize,
        force_refresh: Boolean(forceRefresh)
      };
      
      if (filters.product_status !== null && filters.product_status !== undefined) {
        params.product_status = filters.product_status;
      }
      
      if (shopId !== 'all') {
        params.shop_id = shopId;
      }
      
      console.log('[商品列表] 最终请求参数:', JSON.stringify(params, null, 2));
      
      const result = await getProductList(params);
      
      console.log('[商品列表] Redux返回结果:', {
        type: result?.type,
        hasPayload: !!result?.payload,
        hasError: !!result?.error
      });
      
      // 只在出错时记录详细信息
      if (result?.type?.includes('rejected')) {
        const errorMsg = result?.payload || result?.error?.message;
        console.error('[商品列表] ========== 加载失败 ==========');
        console.error('[商品列表] 错误信息:', errorMsg);
        console.error('[商品列表] 完整结果:', result);
      } else {
        console.log('[商品列表] ========== 加载成功 ==========');
      }
    } catch (error) {
      console.error('[商品列表] ========== 请求异常 ==========');
      console.error('[商品列表] 异常信息:', error?.response?.data?.msg || error?.message);
      console.error('[商品列表] 响应状态:', error?.response?.status);
      console.error('[商品列表] 响应数据:', error?.response?.data);
      
      // 详细的错误处理
      const errorData = error?.response?.data;
      const errorMsg = errorData?.msg || error?.message || '获取数据失败';
      const errorCode = error?.response?.status;
      
      // 根据不同错误类型显示不同提示
      if (errorCode === 403) {
        message.error('无权访问该店铺的商品，请检查权限设置');
      } else if (errorCode === 401) {
        message.error('登录已过期，请重新登录');
      } else if (errorMsg.includes('token') || errorMsg.includes('授权')) {
        message.error({
          content: (
            <div>
              <div>店铺授权已过期或失效</div>
              <div style={{ fontSize: 12, marginTop: 4, color: '#999' }}>
                请在店铺管理中删除该店铺后重新添加
              </div>
            </div>
          ),
          duration: 5
        });
      } else if (errorMsg.includes('不存在') || errorMsg.includes('禁用')) {
        message.error('店铺不存在或已被禁用，请刷新店铺列表');
      } else {
        message.error(errorMsg);
      }
    }
  };

  const handleSync = async () => {
    if (!shopId || shopId === 'all') {
      message.warning('同步操作需要选择具体店铺');
      return;
    }

    console.log(`[商品同步] 开始同步店铺 ${shopId}`);
    
    // 打开步骤Modal
    setSyncModalVisible(true);
    setSyncSteps([]);
    setSyncInProgress(true);
    
    try {
      // 检查是否在Electron环境
      console.log('[商品同步] 检查 Electron 环境...');
      console.log('[商品同步] window.electron:', !!window.electron);
      console.log('[商品同步] window.electron.ipcRenderer:', !!window.electron?.ipcRenderer);
      console.log('[商品同步] window.electronAPI:', !!window.electronAPI);
      
      if (!window.electron || !window.electron.ipcRenderer) {
        console.error('[商品同步] ✗ 不在 Electron 环境中');
        message.error('商品同步功能需要在桌面应用中使用');
        setSyncInProgress(false);
        return;
      }
      
      console.log('[商品同步] ✓ Electron 环境检查通过');

      // 获取当前店铺信息（使用 shopList 而不是 shops）
      const shop = shopList.find(s => s.id === parseInt(shopId));
      if (!shop) {
        console.error('[商品同步] ✗ 未找到店铺信息，shopId:', shopId);
        message.error('未找到店铺信息');
        setSyncInProgress(false);
        return;
      }

      console.log(`[商品同步] 店铺信息:`, shop);

      // 监听同步进度
      const progressHandler = (progress) => {
        console.group(`[商品同步] ${progress.step} - ${progress.status}`);
        console.log('时间:', new Date(progress.timestamp).toLocaleString());
        console.log('消息:', progress.message);
        if (progress.details) {
          console.log('详细信息:', progress.details);
        }
        console.groupEnd();
        
        // 添加步骤到列表
        setSyncSteps(prev => [...prev, progress]);
        
        // 如果是最后一步或失败，关闭连接
        if (progress.step === '完成' || progress.step === '异常' || progress.status === 'failed') {
          setSyncInProgress(false);
          
          // 移除监听器
          window.electron.ipcRenderer.removeListener('product-sync-progress', progressHandler);
          
          if (progress.status === 'success') {
            message.success('同步成功！');
            // 刷新商品列表
            fetchData();
            setSelectedRowKeys([]);
            clearSelection();
          } else if (progress.status === 'failed') {
            message.error(progress.message || '同步失败');
          }
        }
      };

      // 注册进度监听
      window.electron.ipcRenderer.on('product-sync-progress', progressHandler);

      // 调用Electron主进程执行同步
      const token = localStorage.getItem('token');
      console.log('[商品同步] 准备调用 IPC...');
      console.log('[商品同步] 参数:', {
        shopId: shop.douyin_shop_id || shop.shop_id,  // ✅ 使用抖店店铺ID，不是数据库ID
        shopName: shop.shop_name,
        hasToken: !!token
      });
      
      const result = await window.electron.ipcRenderer.invoke('execute-product-sync', {
        shopId: shop.douyin_shop_id || shop.shop_id,  // ✅ 使用抖店店铺ID
        shopName: shop.shop_name,
        token: token,
        apiBaseUrl: API_BASE_URL  // 新增
      });

      console.log('[商品同步] 同步结果:', result);

      // 如果立即返回错误（不是通过进度回调）
      if (result && !result.success) {
        setSyncInProgress(false);
        message.error(result.message || '同步失败');
        window.electron.ipcRenderer.removeListener('product-sync-progress', progressHandler);
      }
      
    } catch (error) {
      console.error('[商品同步] 同步失败:', error);
      setSyncInProgress(false);
      message.error('同步失败: ' + error.message);
    }
  };

  const handleStatusChange = (status) => {
    setProductPagination({ current: 1 });
    setProductFilters({ product_status: status });
    setTimeout(() => fetchData(), 100);
  };

  const handlePaginationChange = (page, pageSize) => {
    setProductPagination({ current: page, pageSize });
  };

  const handleRefresh = () => {
    fetchData(false); // 刷新当前数据，不强制从后台抓取
  };

  const columns = [
    { title: '商品ID', dataIndex: 'product_id', width: 150, fixed: 'left' },
    { title: '商品名称', dataIndex: 'title', width: 250, ellipsis: true, fixed: 'left' },
    // 当选择"全部店铺"时，显示所属店铺列
    ...(shopId === 'all' ? [{
      title: '所属店铺',
      dataIndex: 'shop_id',
      width: 150,
      render: (shop_id) => {
        const shop = shopList.find(s => s.id === shop_id);
        return shop ? shop.shop_name : `店铺${shop_id}`;
      }
    }] : []),
    {
      title: '商家编码',
      dataIndex: 'merchant_code',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '货号',
      dataIndex: 'item_number',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '类目',
      key: 'category',
      width: 200,
      render: (_, record) => {
        const parts = [];
        if (record.first_cname) parts.push(record.first_cname);
        if (record.second_cname) parts.push(record.second_cname);
        if (record.third_cname) parts.push(record.third_cname);
        if (record.fourth_cname) parts.push(record.fourth_cname);
        return parts.length > 0 ? parts.join(' / ') : `${record.first_cid}/${record.second_cid}/${record.third_cid}`;
      }
    },
    {
      title: '商品类型',
      dataIndex: 'product_type',
      width: 100,
      render: (type) => type === 2 ? <Tag color="purple">虚拟商品</Tag> : <Tag>普通商品</Tag>
    },
    {
      title: '商品分组',
      dataIndex: 'product_group',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '价格',
      dataIndex: 'price',
      width: 100,
      render: (price) => `¥${formatPrice(price)}`
    },
    { 
      title: '总库存', 
      dataIndex: 'stock', 
      width: 80 
    },
    {
      title: '现货可售',
      dataIndex: 'available_stock',
      width: 90,
      render: (text) => text ?? '-'
    },
    {
      title: '预售库存',
      dataIndex: 'presale_stock',
      width: 90,
      render: (text) => text ?? '-'
    },
    {
      title: '销量',
      dataIndex: 'sales_count',
      width: 80,
      render: (text) => text || 0
    },
    {
      title: '佣金比例',
      dataIndex: 'commission_rate',
      width: 100,
      render: (rate) => rate ? `${rate}%` : '-'
    },
    {
      title: '发货时间',
      dataIndex: 'delivery_time',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '审核状态',
      dataIndex: 'audit_status',
      width: 100,
      render: (status) => {
        const statusMap = {
          0: { text: '待审核', color: 'default' },
          1: { text: '审核通过', color: 'success' },
          2: { text: '审核拒绝', color: 'error' }
        };
        const s = statusMap[status] || statusMap[0];
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    },
    {
      title: '商品状态',
      dataIndex: 'product_status',
      width: 100,
      render: (status) => (
        <Tag color={PRODUCT_STATUS_COLORS[status]}>{PRODUCT_STATUS_LABELS[status]}</Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'create_time',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '商品链接',
      dataIndex: 'product_url',
      width: 100,
      render: (url) => url ? <a href={url} target="_blank" rel="noopener noreferrer">查看</a> : '-'
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
      selectProducts(keys);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>商品列表</h2>
          {shopId === 'all' && (
            <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>
              （正在查看所有店铺的商品）
            </span>
          )}
        </div>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="商品状态"
            allowClear
            value={filters.product_status}
            onChange={handleStatusChange}
            options={[
              { label: '草稿', value: 0 },
              { label: '上架', value: 1 },
              { label: '下架', value: 2 }
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleSync}
            disabled={shopId === 'all'}
          >
            同步商品
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
            loading={listLoading}
            dataSource={productList}
            columns={columns}
            rowKey="product_id"
            rowSelection={shopId === 'all' ? undefined : rowSelection}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              onChange: handlePaginationChange
            }}
            scroll={{ x: 2500, y: 'calc(100vh - 350px)' }}
          />
        )}
      </Card>

      {/* 同步步骤Modal */}
      <Modal
        title="商品同步进度"
        open={syncModalVisible}
        onCancel={() => setSyncModalVisible(false)}
        footer={[
          <Button 
            key="copy" 
            onClick={() => {
              const logText = syncSteps.map(step => 
                `[${new Date(step.timestamp).toLocaleTimeString()}] ${step.step} - ${step.status}\n` +
                `消息: ${step.message}\n` +
                (step.details ? `详细信息: ${step.details}\n` : '') +
                `-------------------`
              ).join('\n');
              navigator.clipboard.writeText(logText);
              message.success('日志已复制到剪贴板');
            }}
            disabled={syncSteps.length === 0}
          >
            复制所有日志
          </Button>,
          <Button key="close" onClick={() => setSyncModalVisible(false)} disabled={syncInProgress}>
            {syncInProgress ? '同步中...' : '关闭'}
          </Button>
        ]}
        width={700}
        centered
        // maskClosable={false}
        mask={{ closable: false }} // 新配置方式
      >
        {syncSteps.length === 0 && syncInProgress && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff', marginBottom: 16 }} />
            <div>正在初始化同步流程...</div>
          </div>
        )}
        
        {syncSteps.length > 0 && (
          <div 
            ref={stepsContainerRef}
            style={{ 
              maxHeight: '500px', 
              overflowY: 'auto',
              paddingRight: '10px'
            }}
          >
            <Steps
              orientation="vertical"
              current={syncSteps.length - 1}
              items={syncSteps.map((step, index) => {
                let status = 'wait';
                let icon = null;
                
                if (step.status === 'success') {
                  status = 'finish';
                  icon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                } else if (step.status === 'failed') {
                  status = 'error';
                  icon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                } else if (step.status === 'warning') {
                  status = 'finish';
                  icon = <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
                }
                
                return {
                  title: step.step,
                  status: status,
                  icon: icon,
                  content: (
                    <div>
                      <div style={{ marginBottom: 4, fontWeight: 500 }}>{step.message}</div>
                      {step.details && (
                        <div style={{ 
                          fontSize: 12, 
                          color: '#666', 
                          marginTop: 6,
                          padding: '8px 12px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          border: '1px solid #e8e8e8',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          <strong>详细信息：</strong><br/>
                          {typeof step.details === 'string' ? step.details : JSON.stringify(step.details, null, 2)}
                        </div>
                      )}
                      {step.timestamp && (
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )
                };
              })}
            />
            
            {syncSteps.some(s => s.status === 'failed') && (
              <Alert
                title="同步失败"
                description="请查看上方步骤详情，根据错误信息进行处理"
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
            
            {syncSteps.some(s => s.status === 'success') && !syncSteps.some(s => s.status === 'failed') && !syncInProgress && (
              <Alert
                title="同步成功"
                description={`商品数据已成功同步到数据库`}
                type="success"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ProductList;
