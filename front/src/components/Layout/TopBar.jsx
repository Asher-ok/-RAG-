import { useState, useEffect } from 'react';
import { Layout, Space, Dropdown, Avatar, Badge, Button, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  UserOutlined,
  BellOutlined,
  SettingOutlined,
  LogoutOutlined,
  ClockCircleOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import GlobalShopSelector from '../Common/GlobalShopSelector';
import { getShopAuthRequests } from '../../services/accountService';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './TopBar.css';

dayjs.locale('zh-cn');

const { Header } = Layout;

function TopBar() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isLoggingOut, setIsLoggingOut] = useState(false); // 添加登出状态
  
  const { user, logout, isMasterAccount } = useAuth();

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取通知数量
  useEffect(() => {
    fetchNotificationCount();
  }, []);

  const fetchNotificationCount = async () => {
    try {
      // 获取待审核的授权申请数量作为通知数
      const response = await getShopAuthRequests({
        approve_status: 0,
        page_no: 1,
        page_size: 1
      });
      
      if (response.code === 200) {
        setNotificationCount(response.data?.total || 0);
      }
    } catch (error) {
      // 静默失败
      console.error('[TopBar] 获取通知数量失败:', error);
    }
  };

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心'
    },
    // 只有主账号才能看到系统设置
    ...(isMasterAccount() ? [{
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    }] : []),
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true
    }
  ];

  const handleMenuClick = async ({ key }) => {
    if (key === 'profile') {
      navigate('/profile/personal');
    } else if (key === 'settings') {
      navigate('/settings/system');
    } else if (key === 'logout') {
      // 防止重复点击
      if (isLoggingOut) {
        return;
      }
      
      setIsLoggingOut(true);
      
      try {
        // 立即清除本地存储
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        localStorage.removeItem('currentShop');
        
        // 调用登出API（不等待结果）
        logout().catch(err => console.error('Logout API error:', err));
        
        message.success('退出登录成功');
        
        // 通知Electron主进程退出登录
        if (window.electronAPI) {
          try {
            window.electronAPI.logout();
          } catch (error) {
            console.error('Electron logout error:', error);
          }
        }
        
        // 立即跳转到登录页
        navigate('/login', { replace: true });
      } catch (error) {
        console.error('Logout error:', error);
        // 即使出错也要跳转
        navigate('/login', { replace: true });
      } finally {
        // 延迟重置状态，避免快速重复点击
        setTimeout(() => {
          setIsLoggingOut(false);
        }, 1000);
      }
    }
  };

  return (
    <Header className="top-bar">
      <div className="top-bar-left">
        <GlobalShopSelector />
      </div>

      <div className="top-bar-right">
        <Space size={isMobile ? "small" : "middle"}>
          {/* 当前时间 */}
          <div className="time-display">
            <ClockCircleOutlined className="time-icon" />
            <span className="time-text">
              {isMobile 
                ? currentTime.format('HH:mm:ss')
                : currentTime.format('YYYY-MM-DD HH:mm:ss')
              }
            </span>
          </div>

          {/* 全屏按钮 - 在移动端隐藏 */}
          {!isMobile && (
            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              className="icon-button"
            />
          )}

          {/* 通知 */}
          <Badge count={notificationCount} size="small">
            <Button
              type="text"
              icon={<BellOutlined />}
              className="icon-button"
            />
          </Badge>

          {/* 用户信息 */}
          <Dropdown
            menu={{ items: userMenuItems, onClick: handleMenuClick }}
            placement="bottomRight"
            arrow
          >
            <div className="user-info">
              <Avatar size="small" icon={<UserOutlined />} />
              <span className="username">{user?.real_name || user?.username || '用户'}</span>
            </div>
          </Dropdown>
        </Space>
      </div>
    </Header>
  );
}

export default TopBar;
