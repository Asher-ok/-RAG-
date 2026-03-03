import { useState } from 'react';
import { 
  Card, 
  Upload, 
  Button, 
  Table, 
  Space, 
  message, 
  Alert, 
  Divider,
  Select,
  Tag,
  Modal
} from 'antd';
import { 
  UploadOutlined, 
  DownloadOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { importExcel, downloadTemplate, batchCreateProducts } from '../../services/productService';
import ShopSelector from '../../components/Business/ShopSelector';

function ExcelImport() {
  const navigate = useNavigate();
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [shopId, setShopId] = useState(null);
  const [publishType, setPublishType] = useState(1);

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplate();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'product_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('模板下载成功');
    } catch (error) {
      message.error('模板下载失败');
      console.error(error);
    }
  };

  // 文件上传配置
  const uploadProps = {
    accept: '.xlsx,.xls,.csv',
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      // 验证文件大小
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB');
        return false;
      }
      
      // 验证文件类型
      const isExcel = file.name.endsWith('.xlsx') || 
                      file.name.endsWith('.xls') || 
                      file.name.endsWith('.csv');
      if (!isExcel) {
        message.error('只支持Excel(.xlsx/.xls)或CSV(.csv)格式文件');
        return false;
      }
      
      setFileList([file]);
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
      setParsedData(null);
    }
  };

  // 解析文件
  const handleParseFile = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setLoading(true);
    try {
      const response = await importExcel(fileList[0]);
      
      if (response.code === 200) {
        const { products, total_count, invalid_rows } = response.data;
        
        setParsedData({
          products,
          total_count,
          invalid_rows
        });
        
        message.success(`解析成功！共${total_count}个商品`);
        
        if (invalid_rows && invalid_rows.length > 0) {
          Modal.warning({
            title: '部分数据解析失败',
            content: (
              <div>
                <p>以下行数据存在问题：</p>
                {invalid_rows.map((item, index) => (
                  <div key={index}>
                    第{item.row}行: {item.error}
                  </div>
                ))}
              </div>
            ),
            width: 600
          });
        }
      } else {
        message.error(response.msg || '解析失败');
      }
    } catch (error) {
      message.error('解析失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 提交导入
  const handleSubmit = async () => {
    if (!parsedData || parsedData.products.length === 0) {
      message.warning('没有可导入的商品数据');
      return;
    }

    setLoading(true);
    try {
      const response = await batchCreateProducts({
        shop_id: shopId,
        products: parsedData.products,
        publish_type: publishType
      });

      if (response.code === 200) {
        message.success('批量创建任务已提交');
        message.info(`任务ID: ${response.data.task_id}`);
        
        setTimeout(() => {
          navigate('/product/tasks');
        }, 1500);
      } else {
        message.error(response.msg || '创建失败');
      }
    } catch (error) {
      message.error('创建失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      fixed: 'left',
      render: (_, __, index) => index + 1
    },
    {
      title: '商品名称',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      fixed: 'left',
      ellipsis: true
    },
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
      width: 180,
      render: (_, record) => {
        const parts = [];
        if (record.first_cname) parts.push(record.first_cname);
        else if (record.first_cid) parts.push(record.first_cid);
        
        if (record.second_cname) parts.push(record.second_cname);
        else if (record.second_cid) parts.push(record.second_cid);
        
        if (record.third_cname) parts.push(record.third_cname);
        else if (record.third_cid) parts.push(record.third_cid);
        
        if (record.fourth_cname) parts.push(record.fourth_cname);
        else if (record.fourth_cid) parts.push(record.fourth_cid);
        
        return parts.join(' / ');
      }
    },
    {
      title: '商品类型',
      dataIndex: 'product_type',
      width: 100,
      render: (type) => (
        <Tag color={type === 2 ? 'purple' : 'blue'}>
          {type === 2 ? '虚拟商品' : '普通商品'}
        </Tag>
      )
    },
    {
      title: '商品分组',
      dataIndex: 'product_group',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '图片数量',
      key: 'images',
      width: 100,
      render: (_, record) => (
        <Tag color="blue">{record.images?.length || 0}张</Tag>
      )
    },
    {
      title: 'SKU数量',
      key: 'sku_count',
      width: 100,
      render: (_, record) => (
        <Tag color="green">{record.sku_list?.length || 0}个</Tag>
      )
    },
    {
      title: '发货时间',
      dataIndex: 'delivery_time',
      width: 120,
      render: (text) => text || '-'
    },
    {
      title: '佣金比例',
      dataIndex: 'commission_rate',
      width: 100,
      render: (rate) => rate ? `${rate}%` : '-'
    },
    {
      title: 'SKU详情',
      key: 'sku_detail',
      width: 300,
      render: (_, record) => (
        <div>
          {record.sku_list?.map((sku, index) => (
            <div key={index} style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              <strong>{sku.sku_name}</strong>: ¥{(sku.price / 100).toFixed(2)} 
              {sku.merchant_sku_code && <span> (编码:{sku.merchant_sku_code})</span>}
              {sku.spec_name && <span> [{sku.spec_name}]</span>}
              <span> 库存:{sku.stock}</span>
              {sku.available_stock && <span> 现货:{sku.available_stock}</span>}
              {sku.presale_stock && <span> 预售:{sku.presale_stock}</span>}
            </div>
          ))}
        </div>
      )
    }
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>Excel批量导入</h2>
      
      <Card style={{ marginBottom: 16 }}>
        <Alert
          title="使用说明"
          description={
            <div>
              <p><strong>步骤：</strong></p>
              <p>1. 下载Excel模板，按照模板格式填写商品信息</p>
              <p>2. 上传填写好的Excel文件，系统会自动解析</p>
              <p>3. 确认解析结果无误后，选择店铺和发布类型</p>
              <p>4. 提交批量创建任务</p>
              <Divider style={{ margin: '12px 0' }} />
              <p><strong>格式说明：</strong></p>
              <p>• <strong>商品名称：</strong>必填，商品的完整名称</p>
              <p>• <strong>类目ID：</strong>必填，一级/二级/三级类目ID（从抖店后台获取），四级类目可选</p>
              <p>• <strong>商家编码：</strong>可选，用于内部管理的商品编码</p>
              <p>• <strong>货号：</strong>可选，商品货号</p>
              <p>• <strong>商品类型：</strong>可选，1=普通商品，2=虚拟商品，默认为1</p>
              <p>• <strong>商品分组：</strong>可选，商品分组名称</p>
              <p>• <strong>图片URL：</strong>必填，多个图片用分号(;)分隔</p>
              <p>• <strong>SKU列表：</strong>必填，格式为 "SKU编码:SKU名称:价格(元):库存:商家SKU编码:规格ID:规格名称:现货可售:预售库存"</p>
              <p>• <strong>发货时间：</strong>可选，如"24小时内发货"</p>
              <p>• <strong>佣金比例：</strong>可选，如10表示10%</p>
              <p style={{ color: '#ff4d4f', marginTop: 8, paddingLeft: 16 }}>
                ⚠️ SKU示例（完整）：SKU001:红色-S码:99.00:100:MSKU001:SPEC001:颜色规格:80:20
              </p>
              <p style={{ color: '#ff4d4f', paddingLeft: 16 }}>
                ⚠️ SKU示例（简化）：SKU001:红色-S码:99.00:100
              </p>
              <p style={{ color: '#1890ff', paddingLeft: 16 }}>
                💡 提示：多个SKU用分号(;)分隔，SKU字段中后面的参数可选，价格单位为元（系统会自动转换为分）
              </p>
            </div>
          }
          type="info"
          showIcon
        />
      </Card>

      <Card title="步骤1：下载模板" style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
        >
          下载Excel模板
        </Button>
      </Card>

      <Card title="步骤2：上传文件" style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: '100%' }}>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>选择文件</Button>
          </Upload>
          
          {fileList.length > 0 && (
            <Button 
              type="primary" 
              onClick={handleParseFile}
              loading={loading}
            >
              解析文件
            </Button>
          )}
        </Space>
      </Card>

      {parsedData && (
        <>
          <Card title="步骤3：确认数据" style={{ marginBottom: 16 }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Alert
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <span>解析成功！共{parsedData.total_count}个商品</span>
                    {parsedData.invalid_rows?.length > 0 && (
                      <>
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        <span style={{ color: '#faad14' }}>
                          {parsedData.invalid_rows.length}行数据解析失败
                        </span>
                      </>
                    )}
                  </Space>
                }
                type="success"
              />

              <Space>
                <span>店铺：</span>
                <ShopSelector
                  value={shopId}
                  onChange={setShopId}
                  placeholder="请选择店铺"
                  style={{ width: 300 }}
                />
              </Space>

              <Space>
                <span>发布类型：</span>
                <Select
                  value={publishType}
                  onChange={setPublishType}
                  style={{ width: 200 }}
                >
                  <Select.Option value={0}>保存为草稿</Select.Option>
                  <Select.Option value={1}>直接上架</Select.Option>
                </Select>
              </Space>

              <Table
                columns={columns}
                dataSource={parsedData.products}
                rowKey={(_, index) => index}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 2000 }}
              />
            </Space>
          </Card>

          <Card title="步骤4：提交导入">
            <Space>
              <Button 
                type="primary" 
                size="large"
                onClick={handleSubmit}
                loading={loading}
              >
                提交批量创建
              </Button>
              <Button 
                size="large"
                onClick={() => {
                  setFileList([]);
                  setParsedData(null);
                }}
              >
                重新上传
              </Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  );
}

export default ExcelImport;
