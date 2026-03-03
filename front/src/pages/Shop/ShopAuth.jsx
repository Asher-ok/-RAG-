import { useState, useEffect } from 'react';
import { Button, Card, Steps, Alert, Space, Typography, Spin, Result } from 'antd';
import { ShopOutlined, SafetyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { shopService } from '../../services/shopService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ShopAuth.css';

const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;

/**
 * 店铺授权页面
 * 用于引导用户完成抖店OAuth授权
 */
function ShopAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authUrl, setAuthUrl] = useState('');
  const [error, setError] = useState('');
  const [authWindow, setAuthWindow] = useState(null);

  // 检查URL参数，判断是否是回调返回
  useEffect(() => {
    const success = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const msg = searchParams.get('msg');
    const shopName = searchParams.get('shop_name');

    if (success === 'true') {
      // 授权成功
      setCurrentStep(2);
      setTimeout(() => {
        navigate('/shop');
      }, 2000);
    } else if (errorParam) {
      // 授权失败
      setError(decodeURIComponent(msg || '授权失败'));
      setCurrentStep(0);
    }
  }, [searchParams, navigate]);

  // 监听授权窗口关闭
  useEffect(() => {
    if (authWindow) {
      const timer = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(timer);
          setAuthWindow(null);
          // 窗口关闭后，等待URL参数更新
          setCurrentStep(2);
        }
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [authWindow]);

  // 步骤1：获取授权链接
  const handleGetAuthUrl = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await shopService.getAuthUrl();
      
      if (response.code === 200) {
        setAuthUrl(response.data.auth_url);
        setCurrentStep(1);
      } else {
        setError(response.msg || '获取授权链接失败');
      }
    } catch (err) {
      setError(err.message || '网络请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 步骤2：打开授权窗口
  const handleOpenAuthWindow = () => {
    if (!authUrl) {
      setError('授权链接无效');
      return;
    }

    // 直接跳转到授权页面（不使用弹窗）
    window.location.href = authUrl;
  };

  // 授权步骤说明
  const steps = [
    {
      title: '准备授权',
      description: '获取抖店授权链接',
      icon: <ShopOutlined />
    },
    {
      title: '进行授权',
      description: '在抖店页面完成授权',
      icon: <SafetyOutlined />
    },
    {
      title: '授权完成',
      description: '店铺授权成功',
      icon: <CheckCircleOutlined />
    }
  ];

  // 如果是授权成功状态
  if (currentStep === 2 && searchParams.get('success') === 'true') {
    return (
      <div className="shop-auth-container">
        <Card className="auth-card">
          <Result
            status="success"
            title="店铺授权成功！"
            subTitle={`店铺 ${searchParams.get('shop_name') || ''} 已成功授权，正在跳转到店铺列表...`}
            extra={[
              <Button type="primary" key="goto" onClick={() => navigate('/shop')}>
                立即查看
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="shop-auth-container">
      <Card className="auth-card">
        <Title level={2} style={{ textAlign: 'center', marginBottom: 30 }}>
          <ShopOutlined /> 添加抖店店铺
        </Title>

        <Steps current={currentStep} style={{ marginBottom: 40 }}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              icon={step.icon}
            />
          ))}
        </Steps>

        {error && (
          <Alert
            message="错误"
            description={error}
            type="error"
            closable
            onClose={() => setError('')}
            style={{ marginBottom: 20 }}
          />
        )}

        {/* 步骤0：准备授权 */}
        {currentStep === 0 && (
          <div className="auth-step-content">
            <Alert
              message="授权说明"
              description={
                <div>
                  <Paragraph>
                    为了使用本系统管理您的抖店商品，需要您授权以下权限：
                  </Paragraph>
                  <ul>
                    <li>商品列表查询</li>
                    <li>商品创建</li>
                    <li>商品编辑</li>
                    <li>商品删除</li>
                    <li>店铺基础信息</li>
                  </ul>
                  <Paragraph type="secondary">
                    授权后，系统将能够帮您批量管理商品、进行商品裂变等操作。
                  </Paragraph>
                </div>
              }
              type="info"
              style={{ marginBottom: 30 }}
            />

            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleGetAuthUrl}
                icon={<ShopOutlined />}
              >
                开始授权
              </Button>
            </div>
          </div>
        )}

        {/* 步骤1：获取授权链接成功 */}
        {currentStep === 1 && (
          <div className="auth-step-content">
            <Alert
              message="授权链接已生成"
              description="点击下方按钮，将跳转到抖店授权页面"
              type="success"
              style={{ marginBottom: 30 }}
            />

            <div style={{ textAlign: 'center' }}>
              <Space direction="vertical" size="large">
                <Button
                  type="primary"
                  size="large"
                  onClick={handleOpenAuthWindow}
                  icon={<SafetyOutlined />}
                >
                  前往授权
                </Button>
                <Text type="secondary">
                  授权完成后会自动返回
                </Text>
              </Space>
            </div>
          </div>
        )}

        {/* 步骤2：等待授权完成 */}
        {currentStep === 2 && !searchParams.get('success') && (
          <div className="auth-step-content">
            <div style={{ textAlign: 'center' }}>
              <Spin size="large" />
              <Paragraph style={{ marginTop: 20 }}>
                正在处理授权信息...
              </Paragraph>
            </div>
          </div>
        )}

        {/* 底部提示 */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <Text type="secondary">
            遇到问题？查看 <a href="/docs/shop-auth-guide" target="_blank">授权帮助文档</a>
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default ShopAuth;
