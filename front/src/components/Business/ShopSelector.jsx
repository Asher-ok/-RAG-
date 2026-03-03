import { useEffect } from 'react';
import { Select, Spin } from 'antd';
import { useShop } from '../../hooks/useShop';

/**
 * 店铺选择器组件
 * 使用全局Redux状态，避免重复请求
 */
function ShopSelector({ value, onChange, placeholder = "请选择店铺", style, disabled }) {
  const { shopList, isLoaded, isLoading, needsReload, refreshShopList } = useShop();

  useEffect(() => {
    // 只在需要时加载
    if (needsReload && !isLoading) {
      refreshShopList();
    }
  }, [needsReload, isLoading, refreshShopList]);

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      loading={isLoading}
      showSearch
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
      notFoundContent={isLoading ? <Spin size="small" /> : '暂无店铺'}
      options={shopList.map(shop => ({
        value: shop.id,
        label: `${shop.shop_name} (ID: ${shop.douyin_shop_id})`,
        shop: shop
      }))}
    />
  );
}

export default ShopSelector;
