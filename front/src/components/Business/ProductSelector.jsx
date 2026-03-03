import { useState, useEffect } from 'react';
import { Modal, Table, Input, Button, Space, Tag, message, Tabs, Alert } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getProductList } from '../../services/productService';

const { TextArea } = Input;

/**
 * 商品选择器组件
 * 弹窗展示商品列表供用户选择
 * @param {boolean} multiple - 是否支持多选
 * @param {function} onSelect - 单选回调 (product) => {}
 * @param {function} onMultiSelect - 多选回调 (products) => {}
 */
function ProductSelector({ 
  shopId, 
  onSelect, 
  onMultiSelect,
  buttonText = "从商品列表选择",
  multiple = false 
}) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [batchIds, setBatchIds] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10
  });

  useEffect(() => {
    if (visible && shopId) {
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, shopId, pagination.current, pagination.pageSize]);

  const loadProducts = async (isSearch = false) => {
    if (!shopId) {
      message.warning('请先选择店铺');
      return;
    }

    setLoading(true);
    try {
      const params = {
        shop_id: shopId,
        page_no: pagination.current,
        page_size: pagination.pageSize,
        // 不限制商品状态，允许选择已上架、已下架的商品
        // product_status: 1  // 移除限制
      };

      // 根据当前标签页添加不同的查询参数
      if (activeTab === 'search' && searchText.trim()) {
        params.search_text = searchText.trim();
      } else if (activeTab === 'batch' && batchIds.trim()) {
        // 处理批量ID：支持逗号、空格、换行分隔
        const ids = batchIds
          .trim()
          .split(/[,\s\n]+/)  // 按逗号、空格、换行分割
          .map(id => id.trim())
          .filter(id => id.length > 0)
          .join(',');  // 用逗号连接
        
        if (ids) {
          params.product_ids = ids;
          console.log('[ProductSelector] 批量查询ID:', ids);
        }
      }

      const response = await getProductList(params);

      if (response.code === 200) {
        setProducts(response.data.list || []);
        setTotal(response.data.total || 0);
        
        if (isSearch && response.data.list.length === 0) {
          message.info('未找到匹配的商品');
        }
      }
    } catch (error) {
      console.error('加载商品列表失败:', error);
      message.error('加载商品列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
  };

  // 批量查询商品
  const handleBatchQuery = () => {
    if (!batchIds.trim()) {
      message.warning('请输入商品ID');
      return;
    }
    
    // 重置分页
    setPagination({ current: 1, pageSize: 10 });
    loadProducts(true);
  };

  // 搜索商品
  const handleSearch = () => {
    // 清空搜索时，重新加载所有商品
    if (!searchText.trim()) {
      setPagination({ current: 1, pageSize: 10 });
      loadProducts(false);
      return;
    }
    
    // 重置分页
    setPagination({ current: 1, pageSize: 10 });
    loadProducts(true);
  };

  // 批量选择查询结果
  const handleSelectAll = () => {
    if (products.length === 0) {
      message.warning('当前没有商品可选择');
      return;
    }
    
    const allKeys = products.map(p => p.id);
    setSelectedRowKeys(allKeys);
    setSelectedProducts(products);
    message.success(`已选择当前页 ${products.length} 个商品`);
  };

  // 切换标签页时清空搜索条件
  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearchText('');
    setBatchIds('');
    setProducts([]);
    setTotal(0);
    setPagination({ current: 1, pageSize: 10 });
  };

  // 单选
  const handleSelect = (product) => {
    if (onSelect) {
      onSelect(product);
    }
    setVisible(false);
    message.success(`已选择商品: ${product.title}`);
  };

  // 多选确认
  const handleMultiSelectConfirm = () => {
    if (selectedProducts.length === 0) {
      message.warning('请至少选择一个商品');
      return;
    }
    
    if (onMultiSelect) {
      onMultiSelect(selectedProducts);
    }
    setVisible(false);
    setSelectedRowKeys([]);
    setSelectedProducts([]);
    message.success(`已选择 ${selectedProducts.length} 个商品`);
  };

  // 多选配置
  const rowSelection = multiple ? {
    selectedRowKeys,
    onChange: (selectedKeys, selectedRows) => {
      setSelectedRowKeys(selectedKeys);
      setSelectedProducts(selectedRows);
    },
    getCheckboxProps: (record) => ({
      name: record.title,
    }),
  } : null;

  const columns = [
    {
      title: '商品ID',
      dataIndex: 'product_id',
      key: 'product_id',
      width: 120
    },
    {
      title: '商品标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 300
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (price) => `¥${(price / 100).toFixed(2)}`
    },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 80
    },
    {
      title: '状态',
      dataIndex: 'product_status',
      key: 'product_status',
      width: 80,
      render: (status) => {
        const statusMap = {
          0: { text: '草稿', color: 'default' },
          1: { text: '上架', color: 'success' },
          2: { text: '下架', color: 'error' }
        };
        const s = statusMap[status] || statusMap[0];
        return <Tag color={s.color}>{s.text}</Tag>;
      }
    }
  ];

  // 单选模式添加操作列
  if (!multiple) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => handleSelect(record)}>
          选择
        </Button>
      )
    });
  }

  return (
    <>
      <Button 
        onClick={() => setVisible(true)}
        disabled={!shopId}
        icon={<SearchOutlined />}
      >
        {buttonText}
      </Button>

      <Modal
        title={multiple ? "选择商品（多选）" : "选择商品"}
        open={visible}
        onCancel={() => {
          setVisible(false);
          setSelectedRowKeys([]);
          setSelectedProducts([]);
          setSearchText('');
          setBatchIds('');
          setActiveTab('search');
        }}
        footer={multiple ? (
          <Space>
            <Button onClick={() => {
              setVisible(false);
              setSelectedRowKeys([]);
              setSelectedProducts([]);
              setSearchText('');
              setBatchIds('');
              setActiveTab('search');
            }}>
              取消
            </Button>
            <Button type="primary" onClick={handleMultiSelectConfirm}>
              确定（已选 {selectedProducts.length} 个）
            </Button>
          </Space>
        ) : null}
        width={1000}
      >
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Tabs activeKey={activeTab} onChange={handleTabChange} >
            <Tabs.TabPane tab="搜索商品" key="search">
              <Space style={{ width: '100%' }} direction="vertical">
                <Alert
                  message="搜索提示"
                  description="输入商品标题或商品ID进行搜索，支持模糊匹配"
                  type="info"
                  showIcon
                  closable
                />
                <Space>
                  <Input
                    placeholder="输入商品标题或ID"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    onPressEnter={handleSearch}
                    style={{ width: 300 }}
                    prefix={<SearchOutlined />}
                  />
                  <Button type="primary" onClick={handleSearch} loading={loading}>
                    搜索
                  </Button>
                  <Button onClick={() => {
                    setSearchText('');
                    // 清空后重新加载所有商品
                    setPagination({ current: 1, pageSize: 10 });
                    loadProducts(false);
                  }}>
                    清空
                  </Button>
                </Space>
              </Space>
            </Tabs.TabPane>
            
            <Tabs.TabPane tab="批量粘贴ID" key="batch">
              <Space style={{ width: '100%' }} orientation="vertical">
                <Alert
                  message="批量查询提示"
                  description="粘贴多个商品ID，支持逗号、空格、换行分隔。例如：123456,789012 或每行一个ID"
                  type="info"
                  showIcon
                  closable
                />
                <TextArea
                  placeholder="粘贴商品ID，支持多种分隔符：&#10;123456,789012&#10;或&#10;123456&#10;789012&#10;345678"
                  value={batchIds}
                  onChange={(e) => setBatchIds(e.target.value)}
                  rows={6}
                  style={{ width: '100%' }}
                />
                <Space>
                  <Button type="primary" onClick={handleBatchQuery} loading={loading}>
                    批量查询
                  </Button>
                  <Button onClick={() => {
                    setBatchIds('');
                    setProducts([]);
                    setTotal(0);
                  }}>
                    清空
                  </Button>
                  {multiple && products.length > 0 && (
                    <Button type="dashed" onClick={handleSelectAll}>
                      全选当前页（{products.length}个）
                    </Button>
                  )}
                </Space>
              </Space>
            </Tabs.TabPane>
          </Tabs>

          {multiple && selectedProducts.length > 0 && (
            <div style={{ 
              padding: 12, 
              background: '#e6f7ff', 
              border: '1px solid #91d5ff',
              borderRadius: 4 
            }}>
              <p style={{ margin: 0, color: '#1890ff', fontSize: 14 }}>
                已选择 {selectedProducts.length} 个商品
              </p>
            </div>
          )}

          <Table
            columns={columns}
            dataSource={products}
            rowKey="id"
            loading={loading}
            rowSelection={rowSelection}
            pagination={{
              ...pagination,
              total,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个商品`
            }}
            onChange={handleTableChange}
          />
        </Space>
      </Modal>
    </>
  );
}

export default ProductSelector;
