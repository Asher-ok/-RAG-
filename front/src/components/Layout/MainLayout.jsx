import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { useSelector } from 'react-redux';
import {
  DashboardOutlined,
  ShopOutlined,
  AppstoreOutlined,
  PlusSquareOutlined,
  UnorderedListOutlined,
  SplitCellsOutlined,
  TeamOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  FileExcelOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import { PERMISSIONS } from '../../constants/permissions';
import TopBar from './TopBar';
import './MainLayout.css';

const { Sider, Content } = Layout;

function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  
  // 从Redux获取用户权限信息
  const accountType = useSelector(state => state.auth.accountType);
  const permissions = useSelector(state => state.auth.permissions);

  // 检查是否有权限
  const hasPermission = (permission) => {
    // 主账号拥有所有权限
    if (accountType === 1) return true;
    // 员工账号检查具体权限
    if (accountType === 2) {
      return permissions && permissions.includes(permission);
    }
    // 普通账号没有任何权限
    return false;
  };

  // 根据路由更新选中的菜单项
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/dashboard')) setSelectedKey('dashboard');
    else if (path === '/shop' || path.includes('/shop') && !path.includes('/shop/local-tokens')) setSelectedKey('shop-list');
    else if (path.includes('/shop/local-tokens')) setSelectedKey('shop-local-tokens');
    else if (path.includes('/product/list')) setSelectedKey('product-list');
    else if (path.includes('/product/excel-import')) setSelectedKey('product-excel');
    else if (path.includes('/product/tasks')) setSelectedKey('product-tasks');
    else if (path.includes('/fission/create')) setSelectedKey('fission-create');
    else if (path.includes('/fission/tasks')) setSelectedKey('fission-tasks');
    else if (path.includes('/account/employees')) setSelectedKey('account-employees');
    else if (path.includes('/account/auth-requests')) setSelectedKey('account-auth');
  }, [location]);

  // 菜单项配置（根据权限动态生成）
  const getAllMenuItems = () => {
    const items = [
      {
        key: 'dashboard',
        icon: <DashboardOutlined />,
        label: '工作台',
        onClick: () => navigate('/dashboard'),
        show: true // 工作台所有人都可以看
      },
      {
        key: 'shop',
        icon: <ShopOutlined />,
        label: '店铺管理',
        show: hasPermission(PERMISSIONS.SHOP_MANAGE),
        children: [
          {
            key: 'shop-list',
            icon: <ShopOutlined />,
            label: '店铺列表',
            onClick: () => navigate('/shop')
          },
          {
            key: 'shop-local-tokens',
            icon: <DatabaseOutlined />,
            label: '本地Token管理',
            onClick: () => navigate('/shop/local-tokens')
          }
        ]
      },
      {
        key: 'product',
        icon: <AppstoreOutlined />,
        label: '商品管理',
        show: hasPermission(PERMISSIONS.PRODUCT_MANAGE),
        children: [
          {
            key: 'product-list',
            icon: <UnorderedListOutlined />,
            label: '商品列表',
            onClick: () => navigate('/product/list')
          },
          {
            key: 'product-excel',
            icon: <FileExcelOutlined />,
            label: 'Excel导入',
            onClick: () => navigate('/product/excel-import')
          }
          // 已隐藏：上架任务
          // {
          //   key: 'product-tasks',
          //   icon: <ClockCircleOutlined />,
          //   label: '上架任务',
          //   onClick: () => navigate('/product/tasks')
          // }
        ]
      },
      {
        key: 'fission',
        icon: <SplitCellsOutlined />,
        label: '商品裂变',
        show: hasPermission(PERMISSIONS.FISSION_MANAGE),
        children: [
          {
            key: 'fission-create',
            icon: <PlusSquareOutlined />,
            label: '创建裂变',
            onClick: () => navigate('/fission/create')
          },
          {
            key: 'fission-tasks',
            icon: <ClockCircleOutlined />,
            label: '任务列表',
            onClick: () => navigate('/fission/tasks')
          }
        ]
      },
      {
        key: 'account',
        icon: <TeamOutlined />,
        label: '账号管理',
        show: hasPermission(PERMISSIONS.ACCOUNT_MANAGE),
        children: [
          {
            key: 'account-employees',
            icon: <TeamOutlined />,
            label: '员工管理',
            onClick: () => navigate('/account/employees')
          }
        ]
      }
    ];

    // 过滤掉没有权限的菜单项，并移除 show 属性
    return items
      .filter(item => item.show === true)
      .map(({ show, ...item }) => item); // 移除 show 属性
  };

  const menuItems = getAllMenuItems();

  return (
    <Layout className="main-layout">
      <Sider
        collapsed={collapsed}
        width={220}
        className="main-sider"
        trigger={null}
      >
        <div 
          className="logo" 
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: 'pointer' }}
        >
          <ShopOutlined className="logo-icon" />
          {!collapsed && <span className="logo-text">抖店商家助手</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          className="main-menu"
        />
      </Sider>
      <Layout>
        <TopBar />
        <Content className="main-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
