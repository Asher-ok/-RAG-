import { useState } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Space, message, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { batchCreateProducts } from '../../services/productService';
import ShopSelector from '../../components/Business/ShopSelector';
import CategorySelector from '../../components/Business/CategorySelector';

function BatchCreate() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState(null);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await batchCreateProducts({
        shop_id: shopId,
        products: values.products.map(p => ({
          ...p,
          price: p.price * 100, // 元转分
          sku_list: p.sku_list.map(sku => ({
            ...sku,
            price: sku.price * 100,
            stock: sku.stock
          }))
        })),
        publish_type: values.publish_type
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
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>手动批量上架</h2>
      <Card>
        <Form form={form} layout="vertical" initialValues={{ publish_type: 1, products: [{}] }}>
          <Form.Item label="店铺" required>
            <ShopSelector
              value={shopId}
              onChange={setShopId}
              placeholder="请选择店铺"
              style={{ width: 400 }}
            />
          </Form.Item>

          <Form.Item
            name="publish_type"
            label="发布类型"
            rules={[{ required: true, message: '请选择发布类型' }]}
          >
            <Select style={{ width: 200 }}>
              <Select.Option value={0}>保存为草稿</Select.Option>
              <Select.Option value={1}>直接上架</Select.Option>
            </Select>
          </Form.Item>

          <Divider>商品信息</Divider>

          <Form.List name="products">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    title={`商品 ${name + 1}`}
                    extra={
                      fields.length > 1 && (
                        <Button
                          type="link"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        >
                          删除
                        </Button>
                      )
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'title']}
                      label="商品标题"
                      rules={[{ required: true, message: '请输入商品标题' }]}
                    >
                      <Input placeholder="请输入商品标题" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'category']}
                      label="商品类目"
                      rules={[{ required: true, message: '请选择类目' }]}
                    >
                      <CategorySelector 
                        placeholder="请选择三级类目"
                        style={{ width: '100%' }}
                        onChange={(category) => {
                          if (category) {
                            const products = form.getFieldValue('products');
                            products[name] = {
                              ...products[name],
                              first_cid: category.first_cid,
                              second_cid: category.second_cid,
                              third_cid: category.third_cid
                            };
                            form.setFieldsValue({ products });
                          }
                        }}
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, 'images']}
                      label="商品图片URL"
                      rules={[{ required: true, message: '请输入图片URL' }]}
                    >
                      <Select mode="tags" placeholder="输入图片URL后按回车添加" />
                    </Form.Item>

                    <Form.Item label="SKU列表">
                      <Form.List name={[name, 'sku_list']} initialValue={[{}]}>
                        {(skuFields, { add: addSku, remove: removeSku }) => (
                          <>
                            {skuFields.map(({ key, name: skuName, ...skuField }) => (
                              <Space key={key} align="baseline" style={{ marginBottom: 8 }}>
                                <Form.Item
                                  {...skuField}
                                  name={[skuName, 'sku_id']}
                                  rules={[{ required: true, message: '请输入SKU ID' }]}
                                >
                                  <Input placeholder="SKU ID" style={{ width: 120 }} />
                                </Form.Item>

                                <Form.Item
                                  {...skuField}
                                  name={[skuName, 'sku_name']}
                                  rules={[{ required: true, message: '请输入SKU名称' }]}
                                >
                                  <Input placeholder="SKU名称" style={{ width: 120 }} />
                                </Form.Item>

                                <Form.Item
                                  {...skuField}
                                  name={[skuName, 'price']}
                                  rules={[{ required: true, message: '请输入价格' }]}
                                >
                                  <InputNumber placeholder="价格(元)" min={0} step={0.01} style={{ width: 120 }} />
                                </Form.Item>

                                <Form.Item
                                  {...skuField}
                                  name={[skuName, 'stock']}
                                  rules={[{ required: true, message: '请输入库存' }]}
                                >
                                  <InputNumber placeholder="库存" min={0} style={{ width: 100 }} />
                                </Form.Item>

                                {skuFields.length > 1 && (
                                  <MinusCircleOutlined onClick={() => removeSku(skuName)} />
                                )}
                              </Space>
                            ))}
                            <Button type="dashed" onClick={() => addSku()} block icon={<PlusOutlined />}>
                              添加SKU
                            </Button>
                          </>
                        )}
                      </Form.List>
                    </Form.Item>
                  </Card>
                ))}

                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加商品
                </Button>
              </>
            )}
          </Form.List>

          <Divider />

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleSubmit} loading={loading}>
                提交
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default BatchCreate;
