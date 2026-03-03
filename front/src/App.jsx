import { HashRouter, useNavigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useEffect } from 'react';
import AppRouter from './router';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

// 菜单导航监听组件
function MenuNavigationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    // 监听来自 Electron 主进程的导航事件
    if (window.electron) {
      const handleNavigate = (event, path) => {
        navigate(path);
      };

      window.electron.onNavigate(handleNavigate);

      return () => {
        // 清理监听器
        if (window.electron.removeNavigateListener) {
          window.electron.removeNavigateListener(handleNavigate);
        }
      };
    }
  }, [navigate]);

  return null;
}

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <HashRouter>
        <ErrorBoundary>
          <MenuNavigationListener />
          <AppRouter />
        </ErrorBoundary>
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;
