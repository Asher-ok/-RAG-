import { useState, useEffect, useRef } from 'react';
import { Card, Table, Button, Space, Tag, Switch, message, Modal } from 'antd';
import { PlusOutlined, ReloadOutlined, DatabaseOutlined } from '@ant-design/icons';
import { getShopList, updateShopStatus, getAuthUrl, playwrightLogin } from '../../services/shopService';
import { useShop } from '../../hooks/useShop';
import { formatDateTime } from '../../utils/format';
import { useSelector } from 'react-redux';
import { selectUser } from '../../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// 全局登录状态（不会因为组件卸载而丢失）
let globalLoginState = {
  inProgress: false,
  accountId: null,
  startTime: null
};

function ShopManage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [loginInProgress, setLoginInProgress] = useState(globalLoginState.inProgress);
  const { updateShopStatus: updateShopStatusInRedux, refreshShopList } = useShop();
  const currentUser = useSelector(selectUser);
  
  // 轮询检查登录状态
  const checkIntervalRef = useRef(null);

  useEffect(() => {
    fetchData();
    
    // 如果有正在进行的登录，启动轮询检查
    if (globalLoginState.inProgress) {
      startPolling();
    }
    
    // 组件卸载时清理轮询
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);
  
  const startPolling = () => {
    // 每5秒检查一次店铺列表，看是否有新店铺添加
    checkIntervalRef.current = setInterval(async () => {
      try {
        const response = await getShopList();
        if (response.code === 200) {
          const newShops = response.data?.list || [];
          
          // 检查是否有新店铺（对比数量或最新的创建时间）
          if (newShops.length > dataSource.length) {
            // 有新店铺，说明登录成功了
            clearInterval(checkIntervalRef.current);
            globalLoginState.inProgress = false;
            setLoginInProgress(false);
            setDataSource(newShops);
            
            // 同步更新全局店铺列表
            await refreshShopList();
            
            message.success('店铺添加成功！');
          }
        }
      } catch (error) {
        console.error('轮询检查失败:', error);
      }
    }, 5000);
    
    // 设置最大轮询时间（2分钟）
    setTimeout(() => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        globalLoginState.inProgress = false;
        setLoginInProgress(false);
        message.warning('登录超时，请重试');
      }
    }, 120000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getShopList();
      if (response.code === 200) {
        // 注意：后端接口可能还未完全实现，这里做兼容处理
        setDataSource(response.data?.list || []);
        
        // 同步更新全局店铺列表
        await refreshShopList();
      } else {
        message.warning(response.msg || '暂无店铺数据');
      }
    } catch (error) {
      message.error('获取店铺列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddShop = async () => {
    try {
      const response = await getAuthUrl();
      
      if (response.code === 200) {
        const { mode, auth_url, account_id, message: msg } = response.data;
        
        if (mode === 'playwright') {
          // Playwright自动化模式 - 在 Electron 中打开登录窗口
          Modal.confirm({
            title: '店铺授权登录',
            content: (
              <div>
                <p>系统将打开抖店登录页面，请完成登录操作</p>
                <p style={{ color: '#999', fontSize: 12 }}>
                  登录完成后，系统会自动保存登录状态
                </p>
              </div>
            ),
            okText: '开始登录',
            cancelText: '取消',
            onOk: async () => {
              let loadingMsg = null;
              try {
                console.log('\n========== [店铺登录] 开始登录流程 ==========');
                console.log('[店铺登录] 账号ID:', account_id);
                
                // 检查是否在 Electron 环境
                if (!window.electronAPI || !window.electronAPI.openDouyinLogin) {
                  console.error('[店铺登录] ✗ 不在 Electron 环境中');
                  message.error('请在桌面应用中使用此功能');
                  return;
                }
                console.log('[店铺登录] ✓ Electron 环境检查通过');

                // 显示加载提示
                loadingMsg = message.loading('正在打开登录窗口...', 0);

                // 调用 Electron API 打开登录窗口
                console.log('[店铺登录] 调用 Electron API 打开登录窗口...');
                const result = await window.electronAPI.openDouyinLogin(account_id);

                // 关闭加载提示
                if (loadingMsg) {
                  loadingMsg();
                }

                console.log('[店铺登录] Electron 返回结果:', {
                  success: result.success,
                  hasShopInfo: !!result.shopInfo,
                  message: result.message,
                  persistPartition: result.persistPartition
                });

                if (result.success) {
                  console.log('[店铺登录] ✓ 登录成功（持久化到本地）');
                  console.log('[店铺登录] 店铺信息:', result.shopInfo);
                  console.log('[店铺登录] 持久化 Partition:', result.persistPartition);
                  console.log('[店铺登录] 登录状态已保存到本地磁盘');
                  console.log('[店铺登录] 存储位置: AppData/Roaming/doushop-desktop/Partitions/' + (result.persistPartition ? result.persistPartition.replace('persist:', '') : 'unknown'));
                  
                  // 显示详细的持久化信息
                  if (result.persistDetails) {
                    console.log('[店铺登录] ========== 持久化详情 ==========');
                    console.log('[店铺登录] Partition 名称:', result.persistDetails.partitionName);
                    console.log('[店铺登录] 存储路径:', result.persistDetails.partitionPath);
                    console.log('[店铺登录] 数据大小:', result.persistDetails.folderSizeMB, 'MB');
                    console.log('[店铺登录] 调试文件:', result.persistDetails.debugJsonPath);
                    console.log('[店铺登录] Cookie:', result.persistDetails.cookieCount);
                    console.log('[店铺登录] localStorage:', result.persistDetails.localStorageCount);
                    console.log('[店铺登录] 说明:', result.persistDetails.note);
                    console.log('[店铺登录] =====================================');
                  }
                  
                  // 显示详细的保存信息
                  if (result.persistDetails) {
                    console.log('[店铺登录] ========== 持久化详情 ==========');
                    console.log('[店铺登录] Cookie 数量:', result.persistDetails.cookieCount);
                    console.log('[店铺登录] localStorage 项数:', result.persistDetails.localStorageCount);
                    console.log('[店铺登录] 关键 Cookie:');
                    if (result.persistDetails.keyCookies) {
                      result.persistDetails.keyCookies.forEach(cookie => {
                        console.log(`[店铺登录]   - ${cookie.name}: ${cookie.exists ? '✓ 存在' : '✗ 不存在'}`);
                      });
                    }
                    console.log('[店铺登录] =====================================');
                  }
                  
                  // 登录成功，将店铺信息发送给后端（不再需要storageState，使用本地持久化）
                  const requestData = {
                    account_id: account_id,
                    user_id: currentUser?.user_id || currentUser?.id,  // ✅ 兼容不同的字段名
                    storage_state: null,  // 不再需要，使用本地持久化
                    shop_info: result.shopInfo,
                    partition_name: result.persistPartition  // ✅ 传递实际的 partition 名称
                  };
                  
                  console.log('[店铺登录] 发送到后端的数据:', {
                    account_id: requestData.account_id,
                    user_id: requestData.user_id,
                    shop_info: requestData.shop_info,
                    note: '登录状态已持久化到本地，不需要传输storageState'
                  });
                  
                  console.log('[店铺登录] 调用后端 API: POST /playwright/save-login');
                  const saveResult = await api.post('/playwright/save-login', requestData);

                  console.log('[店铺登录] 后端响应:', {
                    code: saveResult.code,
                    msg: saveResult.msg,
                    data: saveResult.data
                  });

                  if (saveResult.code === 200) {
                    console.log('[店铺登录] ✓ 后端保存成功');
                    message.success('店铺授权成功！');
                    console.log('[店铺登录] 刷新店铺列表...');
                    await fetchData(); // 刷新店铺列表（会自动同步全局）
                    console.log('[店铺登录] ========== 登录流程完成 ==========\n');
                  } else {
                    console.error('[店铺登录] ✗ 后端保存失败:', saveResult.msg);
                    message.error(saveResult.msg || '保存登录状态失败');
                  }
                } else {
                  console.warn('[店铺登录] ⚠ 登录未成功:', result.message);
                  message.warning(result.message || '登录已取消');
                }
              } catch (error) {
                console.error('[店铺登录] ========== 登录异常 ==========');
                console.error('[店铺登录] 错误类型:', error.name);
                console.error('[店铺登录] 错误信息:', error.message);
                console.error('[店铺登录] 错误堆栈:', error.stack);
                console.error('[店铺登录] 响应数据:', error.response?.data);
                console.error('[店铺登录] 响应状态:', error.response?.status);
                
                // 确保在异常情况下也关闭loading
                if (loadingMsg) {
                  loadingMsg();
                }
                message.error('登录失败：' + (error.message || '未知错误'));
              }
            }
          });
        } else {
          // API OAuth模式
          if (auth_url) {
            window.open(auth_url, '_blank');
            message.info('请在新窗口完成店铺授权');
          } else {
            message.warning('授权链接获取失败');
          }
        }
      } else {
        message.error(response.msg || '获取授权信息失败');
      }
    } catch (error) {
      message.error('获取授权信息失败：' + (error.message || '未知错误'));
    }
  };

  const handleStatusChange = async (shopId, checked) => {
    const newStatus = checked ? 1 : 2;
    
    console.log('[店铺管理] ========== 更新店铺状态 ==========');
    console.log('[店铺管理] 店铺ID:', shopId);
    console.log('[店铺管理] 新状态:', newStatus === 1 ? '启用' : '禁用');
    
    try {
      const response = await updateShopStatus(shopId, newStatus);
      if (response.code === 200) {
        console.log('[店铺管理] ✓ 状态更新成功');
        message.success('状态更新成功');
        // 立即更新本地数据，避免重新请求
        setDataSource(prev => prev.map(shop => 
          shop.id === shopId ? { ...shop, status: newStatus } : shop
        ));
        // 同步更新 Redux 全局状态（这样顶部选择器会实时更新）
        updateShopStatusInRedux(shopId, newStatus);
      } else {
        console.error('[店铺管理] ✗ 状态更新失败:', response.msg);
        message.error(response.msg || '状态更新失败');
      }
    } catch (error) {
      console.error('[店铺管理] ✗ 状态更新异常:', error);
      message.error('状态更新失败');
    }
    console.log('[店铺管理] ========== 状态更新结束 ==========\n');
  };

  const handleDeleteShop = (record) => {
    console.log('[店铺管理] ========== 删除店铺 ==========');
    console.log('[店铺管理] 店铺信息:', {
      id: record.id,
      name: record.shop_name,
      douyin_shop_id: record.douyin_shop_id,
      auth_mode: record.auth_mode
    });
    
    Modal.confirm({
      title: '确认删除店铺',
      content: (
        <div>
          <p>确定要删除店铺 <strong>{record.shop_name}</strong> 吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>
            ⚠️ 删除后将无法恢复，该店铺的所有商品数据也将被清除
          </p>
          {record.auth_mode === 'api' && (
            <p style={{ color: '#999', fontSize: 12 }}>
              如需重新添加，需要重新进行OAuth授权
            </p>
          )}
          {record.auth_mode === 'playwright' && (
            <p style={{ color: '#999', fontSize: 12 }}>
              如需重新添加，需要重新进行Playwright登录
            </p>
          )}
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        console.log('[店铺管理] 用户确认删除');
        try {
          const response = await api.delete(`/auth/shop/${record.id}`);
          
          console.log('[店铺管理] 删除响应:', response);
          
          if (response.code === 200) {
            console.log('[店铺管理] ✓ 删除成功');
            message.success('店铺删除成功');
            
            // 更新本地数据
            setDataSource(prev => prev.filter(shop => shop.id !== record.id));
            
            // 刷新全局店铺列表
            await refreshShopList();
            
            console.log('[店铺管理] ✓ 已刷新全局店铺列表');
          } else {
            console.error('[店铺管理] ✗ 删除失败:', response.msg);
            message.error(response.msg || '删除失败');
          }
        } catch (error) {
          console.error('[店铺管理] ✗ 删除异常:', error);
          message.error(error?.response?.data?.msg || '删除失败');
        }
        console.log('[店铺管理] ========== 删除结束 ==========\n');
      },
      onCancel: () => {
        console.log('[店铺管理] 用户取消删除');
        console.log('[店铺管理] ========== 删除取消 ==========\n');
      }
    });
  };

  const columns = [
    { title: '店铺ID', dataIndex: 'douyin_shop_id', width: 200 },
    { title: '店铺名称', dataIndex: 'shop_name', width: 200 },
    {
      title: '授权模式',
      dataIndex: 'auth_mode',
      width: 120,
      render: (mode) => (
        <Tag color={mode === 'playwright' ? 'blue' : 'green'}>
          {mode === 'playwright' ? '自动化' : 'API'}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status, record) => (
        <Switch
          checked={status === 1}
          onChange={(checked) => handleStatusChange(record.id, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      )
    },
    {
      title: 'Token过期时间',
      dataIndex: 'expire_time',
      width: 180,
      render: (text, record) => {
        // Playwright模式没有过期时间
        if (record.auth_mode === 'playwright') {
          return <span style={{ color: '#999' }}>-</span>;
        }
        
        // API模式检查是否过期
        if (text) {
          const expireTime = new Date(text);
          const now = new Date();
          const isExpired = expireTime < now;
          
          return (
            <span style={{ color: isExpired ? '#ff4d4f' : undefined }}>
              {formatDateTime(text)}
              {isExpired && <Tag color="red" style={{ marginLeft: 8 }}>已过期</Tag>}
            </span>
          );
        }
        return '-';
      }
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
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          type="link" 
          danger 
          size="small"
          onClick={() => handleDeleteShop(record)}
        >
          删除
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>店铺管理</h2>
        <Space>
          <Button 
            icon={<DatabaseOutlined />} 
            onClick={() => navigate('/shop/local-tokens')}
          >
            本地Token管理
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddShop}
            loading={loginInProgress}
          >
            {loginInProgress ? '登录中...' : '添加店铺'}
          </Button>
        </Space>
      </div>
      
      {loginInProgress && (
        <Card style={{ marginBottom: 16, background: '#e6f7ff', borderColor: '#91d5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ color: '#1890ff', fontWeight: 500 }}>🔄 正在登录中...</span>
              <span style={{ color: '#666', marginLeft: 12, fontSize: 12 }}>
                请在浏览器中完成登录操作，您可以继续使用系统其他功能
              </span>
            </div>
            <Button 
              size="small" 
              onClick={() => {
                globalLoginState.inProgress = false;
                setLoginInProgress(false);
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                }
                message.destroy('playwright-login-global');
                message.info('已取消登录监听');
              }}
            >
              取消监听
            </Button>
          </div>
        </Card>
      )}

      <Card>
        {dataSource.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <p>暂无店铺数据</p>
            <p style={{ fontSize: 12 }}>点击"添加店铺"按钮进行店铺授权</p>
          </div>
        ) : (
          <Table
            loading={loading}
            dataSource={dataSource}
            columns={columns}
            rowKey="id"
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
}

export default ShopManage;
