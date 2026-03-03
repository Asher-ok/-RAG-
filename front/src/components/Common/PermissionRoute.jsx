import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';

/**
 * 权限路由组件
 * @param {string} permission - 需要的权限
 * @param {ReactNode} children - 子组件
 */
function PermissionRoute({ permission, children }) {
  const navigate = useNavigate();
  const accountType = useSelector(state => state.auth.accountType);
  const permissions = useSelector(state => state.auth.permissions);
  
  // 主账号拥有所有权限
  if (accountType === 1) {
    return children;
  }
  
  // 员工账号检查权限
  if (permissions && permissions.includes(permission)) {
    return children;
  }
  
  // 没有权限，显示提示页面
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '400px' 
    }}>
      <Result
        status="403"
        title="权限不足"
        subTitle="抱歉，您没有权限访问此页面。请联系管理员开通相应权限。"
        extra={
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            返回工作台
          </Button>
        }
      />
    </div>
  );
}

export default PermissionRoute;
