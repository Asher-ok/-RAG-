import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Spin, message } from 'antd';
import { ShopOutlined, AppstoreOutlined, SplitCellsOutlined, TeamOutlined } from '@ant-design/icons';
import api from '../../services/api';
import './index.css';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    shop_count: 0,
    product_count: 0,
    fission_count: 0,
    employee_count: 0
  });

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await api.get('/dashboard/statistics');
      if (response.code === 200) {
        setStatistics(response.data);
      } else {
        message.error(response.msg || '获取统计数据失败');
      }
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <h2 className="page-title">工作台</h2>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card>
              <Statistic
                title="店铺总数"
                value={statistics.shop_count}
                prefix={<ShopOutlined />}
                styles={{ value: { color: '#3f8600' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="商品总数"
                value={statistics.product_count}
                prefix={<AppstoreOutlined />}
                styles={{ value: { color: '#1890ff' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="裂变任务"
                value={statistics.fission_count}
                prefix={<SplitCellsOutlined />}
                styles={{ value: { color: '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="员工账号"
                value={statistics.employee_count}
                prefix={<TeamOutlined />}
                styles={{ value: { color: '#722ed1' } }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

export default Dashboard;
