import { useEffect, useState } from 'react';
import { Select } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useShop } from '../../hooks/useShop';
import { getShopList } from '../../services/shopService';

/**
 * 全局店铺切换器
 * 显示在顶部导航栏，切换后全局生效
 * 
 * 优化策略：
 * 1. 使用Redux缓存，避免重复请求
 * 2. 只在必要时加载（首次或超过5分钟）
 * 3. 立即显示缓存数据，后台更新
 */
function GlobalShopSelector() {
  const { 
    shopList, 
    currentShopId, 
    isLoaded, 
    isLoading,
    needsReload,
    setShop, 
    updateShopList, 
    updateLoading,
    initShop 
  } = useShop();
  
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    // 监听窗口大小变化
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // 初始化：从 localStorage 恢复当前店铺
    initShop();
    
    // 只在需要时加载店铺列表
    if (needsReload && !isLoading) {
      loadShops();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

  // 监听店铺列表变化，如果从0变成有数据，说明添加了新店铺
  useEffect(() => {
    if (isLoaded && shopList.length > 0 && !currentShopId) {
      // 自动选择"全部店铺"
      setShop({ id: 'all', shop_name: '全部店铺' });
    }
  }, [shopList.length, isLoaded, currentShopId, setShop]);

  const loadShops = async () => {
    // 防止重复请求
    if (isLoading) {
      console.log('[GlobalShopSelector] 已在加载中，跳过');
      return;
    }

    try {
      updateLoading(true);
      
      const response = await getShopList({ 
        page_no: 1, 
        page_size: 100,
        status: 1
      });
      
      if (response.code === 200) {
        const shops = response.data.list || [];
        updateShopList(shops);
      } else {
        console.error('[GlobalShopSelector] 加载失败:', response.msg);
        // 如果是首次加载失败，设置空列表
        if (!isLoaded) {
          updateShopList([]);
        }
      }
    } catch (error) {
      console.error('[GlobalShopSelector] 加载异常:', error);
      // 如果是首次加载失败，设置空列表
      if (!isLoaded) {
        updateShopList([]);
      }
    }
  };

  const handleChange = (value) => {
    if (value === 'all') {
      setShop({ id: 'all', shop_name: '全部店铺' });
    } else {
      const selectedShop = shopList.find(shop => shop.id === value);
      setShop(selectedShop);
    }
  };

  // 如果还没加载过且正在加载，显示加载状态
  if (!isLoaded && isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        color: '#999',
        fontSize: isMobile ? 12 : 14
      }}>
        <ShopOutlined style={{ marginRight: isMobile ? 4 : 8 }} />
        <span>加载中...</span>
      </div>
    );
  }

  // 如果加载完成但没有店铺
  if (isLoaded && shopList.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        color: '#999',
        fontSize: isMobile ? 12 : 14
      }}>
        <ShopOutlined style={{ marginRight: isMobile ? 4 : 8 }} />
        <span>{isMobile ? "无店铺" : "暂无店铺"}</span>
      </div>
    );
  }

  // 有店铺数据（可能是缓存的）
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <ShopOutlined style={{ 
        marginRight: isMobile ? 4 : 8, 
        color: '#1890ff', 
        fontSize: isMobile ? 14 : 16 
      }} />
      <Select
        value={currentShopId}
        onChange={handleChange}
        style={{ 
          minWidth: isMobile ? 120 : 200,
          maxWidth: isMobile ? 150 : 300
        }}
        size={isMobile ? 'small' : 'middle'}
        showSearch
        filterOption={(input, option) =>
          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        placeholder={isMobile ? "选择店铺" : "请选择店铺"}
      >
        <Select.Option value="all" label="全部店铺">
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>全部店铺</span>
        </Select.Option>
        <Select.OptGroup label="我的店铺">
          {shopList.map(shop => (
            <Select.Option key={shop.id} value={shop.id} label={shop.shop_name}>
              {shop.shop_name}
            </Select.Option>
          ))}
        </Select.OptGroup>
      </Select>
    </div>
  );
}

export default GlobalShopSelector;
