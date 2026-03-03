import { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Modal, message, Descriptions, Statistic, Row, Col, Alert } from 'antd';
import { ReloadOutlined, DeleteOutlined, InfoCircleOutlined, FolderOpenOutlined, ClearOutlined, FileTextOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../utils/format';
import './LocalTokenManage.css';

/**
 * 本地Token管理页面
 * 直接读取本机电脑上保存的店铺登录状态（Partition数据）
 * 不需要后端API，纯本地操作
 */
function LocalTokenManage() {
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState([]);
  const [selectedPartition, setSelectedPartition] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [mappingFileInfo, setMappingFileInfo] = useState(null);

  useEffect(() => {
    fetchLocalTokens();
    fetchMappingFileInfo();
  }, []);

  // 获取本地Token列表
  const fetchLocalTokens = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.getLocalPartitions();
      
      if (result.success) {
        setDataSource(result.data || []);
        console.log('[本地Token] 获取成功:', result.data);
      } else {
        message.error(result.message || '获取本地Token失败');
      }
    } catch (error) {
      console.error('[本地Token] 获取失败:', error);
      message.error('获取本地Token失败：' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取映射文件信息
  const fetchMappingFileInfo = async () => {
    try {
      const result = await window.electronAPI.getMappingFileInfo();
      
      if (result.success) {
        setMappingFileInfo(result.data);
        console.log('[本地Token] 映射文件信息:', result.data);
      }
    } catch (error) {
      console.error('[本地Token] 获取映射文件信息失败:', error);
    }
  };

  // 打开映射文件所在目录
  const handleOpenMappingFolder = async () => {
    try {
      await window.electronAPI.openMappingFileFolder();
    } catch (error) {
      console.error('[本地Token] 打开映射文件目录失败:', error);
      message.error('打开目录失败：' + error.message);
    }
  };

  // 查看详情
  const handleViewDetail = async (record) => {
    try {
      const result = await window.electronAPI.getPartitionDetail(record.shopId);
      
      if (result.success) {
        setSelectedPartition(result.data);
        setDetailModalVisible(true);
      } else {
        message.error(result.message || '获取详情失败');
      }
    } catch (error) {
      console.error('[本地Token] 获取详情失败:', error);
      message.error('获取详情失败：' + error.message);
    }
  };

  // 删除本地Token
  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除本地登录状态',
      content: (
        <div>
          <p>确定要删除店铺 <strong>{record.shopName}</strong> 的本地登录状态吗？</p>
          <p style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>
            ⚠️ 删除后将无法恢复，该店铺需要重新登录
          </p>
          <p style={{ color: '#999', fontSize: 12 }}>
            注意：这只会删除本地电脑上的登录状态，不会影响数据库中的店铺记录
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await window.electronAPI.deleteLocalPartition(record.shopId);
          
          if (result.success) {
            message.success('本地登录状态已删除');
            // 刷新列表
            await fetchLocalTokens();
          } else {
            message.error(result.message || '删除失败');
          }
        } catch (error) {
          console.error('[本地Token] 删除失败:', error);
          message.error('删除失败：' + error.message);
        }
      }
    });
  };

  // 打开存储目录
  const handleOpenFolder = async (record) => {
    try {
      const result = await window.electronAPI.openPartitionFolder(record.shopId);
      
      if (!result.success) {
        message.error(result.message || '打开文件夹失败');
      }
    } catch (error) {
      console.error('[本地Token] 打开文件夹失败:', error);
      message.error('打开文件夹失败：' + error.message);
    }
  };

  // 清理孤立的partition
  const handleCleanOrphans = () => {
    Modal.confirm({
      title: '清理孤立的登录状态',
      content: (
        <div>
          <p>此操作将清理没有映射关系的孤立partition目录</p>
          <p style={{ color: '#52c41a', fontSize: 12, marginTop: 8 }}>
            ✓ 已绑定店铺的登录状态不会被删除
          </p>
          <p style={{ color: '#ff4d4f', fontSize: 12 }}>
            ⚠️ 此操作不可恢复，请确认后再继续
          </p>
          <p style={{ color: '#999', fontSize: 11, marginTop: 8 }}>
            提示：清理功能只会删除不在映射文件中的partition，不会影响正常使用的店铺
          </p>
        </div>
      ),
      okText: '开始清理',
      okType: 'primary',
      cancelText: '取消',
      onOk: async () => {
        const hide = message.loading('正在清理...', 0);
        try {
          const result = await window.electronAPI.cleanOrphanPartitions();
          
          hide();
          
          if (result.success) {
            const freedMB = (result.freedSpace / 1024 / 1024).toFixed(2);
            
            if (result.cleaned === 0) {
              message.info('没有需要清理的孤立文件');
            } else {
              Modal.success({
                title: '清理完成',
                content: (
                  <div>
                    <p>已删除 {result.cleaned} 个孤立目录</p>
                    <p>释放空间：{freedMB} MB</p>
                    {result.orphanPartitions && result.orphanPartitions.length > 0 && (
                      <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                        <p style={{ fontSize: 12, color: '#999' }}>清理的目录：</p>
                        <ul style={{ fontSize: 11, color: '#666' }}>
                          {result.orphanPartitions.map((p, i) => (
                            <li key={i}>
                              {p.name} ({(p.size / 1024 / 1024).toFixed(2)} MB)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              });
              // 刷新列表
              await fetchLocalTokens();
            }
          } else {
            message.error(result.message || '清理失败');
          }
        } catch (error) {
          hide();
          console.error('[本地Token] 清理失败:', error);
          message.error('清理失败：' + error.message);
        }
      }
    });
  };

  // 格式化文件大小
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  };

  const columns = [
    {
      title: '店铺ID',
      dataIndex: 'shopId',
      width: 200,
      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>
    },
    {
      title: '店铺名称',
      dataIndex: 'shopName',
      width: 200
    },
    {
      title: 'Partition名称',
      dataIndex: 'partitionName',
      width: 250,
      render: (text) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
          {text}
        </Tag>
      )
    },
    {
      title: '登录时间',
      dataIndex: 'loginTime',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '存储大小',
      dataIndex: 'size',
      width: 120,
      render: (size) => (
        <span style={{ color: size > 10 * 1024 * 1024 ? '#ff4d4f' : undefined }}>
          {formatSize(size)}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'exists',
      width: 100,
      render: (exists) => (
        <Tag color={exists ? 'success' : 'error'}>
          {exists ? '正常' : '已失效'}
        </Tag>
      )
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
            icon={<InfoCircleOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={() => handleOpenFolder(record)}
          >
            打开
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="local-token-manage">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>本地Token管理</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#999' }}>
            管理本机电脑上保存的店铺登录状态（仅本地操作，不影响数据库）
          </p>
        </div>
        <Space>
          <Button 
            icon={<FileTextOutlined />} 
            onClick={handleOpenMappingFolder}
            type="default"
          >
            打开映射文件
          </Button>
          <Button 
            icon={<ClearOutlined />} 
            onClick={handleCleanOrphans}
            type="default"
          >
            清理孤立文件
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchLocalTokens}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 映射文件信息提示 */}
      {mappingFileInfo && (
        <Alert
          message="映射文件信息"
          description={
            <div style={{ fontSize: 12 }}>
              <p style={{ margin: '4px 0' }}>
                <strong>文件路径：</strong>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
                  {mappingFileInfo.path}
                </span>
              </p>
              <p style={{ margin: '4px 0' }}>
                <strong>状态：</strong>
                {mappingFileInfo.exists ? (
                  <Tag color="success" style={{ marginLeft: 4 }}>存在</Tag>
                ) : (
                  <Tag color="error" style={{ marginLeft: 4 }}>不存在</Tag>
                )}
                {mappingFileInfo.exists && (
                  <>
                    <span style={{ marginLeft: 8 }}>
                      大小：{(mappingFileInfo.size / 1024).toFixed(2)} KB
                    </span>
                    <span style={{ marginLeft: 8 }}>
                      修改时间：{formatDateTime(mappingFileInfo.modifiedTime)}
                    </span>
                  </>
                )}
              </p>
              <p style={{ margin: '4px 0', color: '#999', fontSize: 11 }}>
                此文件记录了店铺ID与partition目录的映射关系，清理功能会根据此文件判断哪些partition是孤立的
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本地店铺数"
              value={dataSource.length}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="正常状态"
              value={dataSource.filter(item => item.exists).length}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已失效"
              value={dataSource.filter(item => !item.exists).length}
              suffix="个"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总存储大小"
              value={formatSize(dataSource.reduce((sum, item) => sum + (item.size || 0), 0))}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        {dataSource.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <p>暂无本地登录状态</p>
            <p style={{ fontSize: 12 }}>添加店铺后，登录状态会自动保存到本地</p>
          </div>
        ) : (
          <Table
            loading={loading}
            dataSource={dataSource}
            columns={columns}
            rowKey="shopId"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="登录状态详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedPartition && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="店铺ID" span={2}>
                <span style={{ fontFamily: 'monospace' }}>{selectedPartition.shopId}</span>
              </Descriptions.Item>
              <Descriptions.Item label="店铺名称" span={2}>
                {selectedPartition.shopName}
              </Descriptions.Item>
              <Descriptions.Item label="Partition名称" span={2}>
                <Tag color="blue" style={{ fontFamily: 'monospace' }}>
                  {selectedPartition.partitionName}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="登录时间">
                {formatDateTime(selectedPartition.loginTime)}
              </Descriptions.Item>
              <Descriptions.Item label="存储大小">
                {formatSize(selectedPartition.size)}
              </Descriptions.Item>
              <Descriptions.Item label="存储路径" span={2}>
                <div style={{ 
                  fontFamily: 'monospace', 
                  fontSize: 11, 
                  wordBreak: 'break-all',
                  background: '#f5f5f5',
                  padding: '4px 8px',
                  borderRadius: 4
                }}>
                  {selectedPartition.path}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Cookie数量">
                {selectedPartition.cookieCount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="LocalStorage项数">
                {selectedPartition.localStorageCount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                <Tag color={selectedPartition.exists ? 'success' : 'error'}>
                  {selectedPartition.exists ? '正常' : '已失效'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedPartition.keyCookies && selectedPartition.keyCookies.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4>关键Cookie状态</h4>
                <Table
                  dataSource={selectedPartition.keyCookies}
                  columns={[
                    { title: 'Cookie名称', dataIndex: 'name', key: 'name' },
                    {
                      title: '状态',
                      dataIndex: 'exists',
                      key: 'exists',
                      render: (exists) => (
                        <Tag color={exists ? 'success' : 'default'}>
                          {exists ? '✓ 存在' : '✗ 不存在'}
                        </Tag>
                      )
                    }
                  ]}
                  pagination={false}
                  size="small"
                  rowKey="name"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LocalTokenManage;
