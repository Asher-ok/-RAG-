/**
 * 店铺信息提取器
 * 从登录后的页面中提取店铺ID和店铺名称
 */

/**
 * 生成用于提取店铺信息的 JavaScript 代码
 * @returns {string} 可在浏览器中执行的 JS 代码
 */
function getShopInfoExtractionScript() {
  return `
    (function() {
      try {
        let shopName = '';
        let shopId = '';
        
        console.log('[提取店铺信息] 开始提取...');
        console.log('[提取店铺信息] 当前URL:', window.location.href);

        // 方法1：从Cookie中提取shop_id（最可靠）- 对应后端方法1
        console.log('[调试] 尝试从Cookie提取店铺ID...');
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'ecom_gray_shop_id') {
            shopId = value;
            console.log('✓ 从Cookie提取到店铺ID:', shopId);
            break;
          }
        }

        // 方法2：从URL中提取shop_id - 对应后端方法2
        if (!shopId && window.location.href.includes('shop_id=')) {
          console.log('[调试] 尝试从URL提取店铺ID...');
          const match = window.location.href.match(/shop_id=(\\d+)/);
          if (match) {
            shopId = match[1];
            console.log('✓ 从URL提取到店铺ID:', shopId);
          }
        }

        // 方法3：从页面JavaScript变量中提取 - 对应后端方法3
        console.log('[调试] 尝试从JS变量提取店铺信息...');
        try {
          // 从全局变量获取
          const globalShopId = window.shopId || window.shop_id || 
                              (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.shopId);
          const globalShopName = window.shopName || window.shop_name ||
                                (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.shopName);
          
          // 从localStorage获取
          let localShopId = null;
          let localShopName = null;
          try {
            const shopInfoKeys = ['shopInfo', 'shop_info', 'ecom_shop_info'];
            for (const key of shopInfoKeys) {
              const shopInfoStr = localStorage.getItem(key);
              if (shopInfoStr) {
                const info = JSON.parse(shopInfoStr);
                localShopId = info.shop_id || info.shopId;
                localShopName = info.shop_name || info.shopName || info.name;
                if (localShopId) break;
              }
            }
          } catch(e) {
            console.error('localStorage解析失败:', e);
          }
          
          // 从sessionStorage获取
          let sessionShopId = null;
          let sessionShopName = null;
          try {
            const shopInfoKeys = ['shopInfo', 'shop_info'];
            for (const key of shopInfoKeys) {
              const shopInfoStr = sessionStorage.getItem(key);
              if (shopInfoStr) {
                const info = JSON.parse(shopInfoStr);
                sessionShopId = info.shop_id || info.shopId;
                sessionShopName = info.shop_name || info.shopName || info.name;
                if (sessionShopId) break;
              }
            }
          } catch(e) {}
          
          if (!shopId && (globalShopId || localShopId || sessionShopId)) {
            shopId = String(globalShopId || localShopId || sessionShopId);
            console.log('✓ 从JS变量提取到店铺ID:', shopId);
          }
          if (!shopName && (globalShopName || localShopName || sessionShopName)) {
            shopName = globalShopName || localShopName || sessionShopName;
            console.log('✓ 从JS变量提取到店铺名称:', shopName);
          }
        } catch(e) {
          console.error('⚠ JS提取失败:', e);
        }

        // 方法4：从页面元素中提取店铺名称 - 对应后端方法4
        if (!shopName) {
          console.log('[调试] 尝试从页面元素提取店铺名称...');
          const selectors = [
            // 抖店特定选择器（优先级高）
            'div[class*="ShopInfo"] span[class*="name"]',
            'div[class*="shop-info"] span[class*="name"]',
            'div[class*="header"] span[class*="shop"]',
            '.shop-name',
            '[class*="shop-name"]',
            '[class*="shopName"]',
            '.header-shop-name',
            '[data-testid="shop-name"]',
            '.shop-info .name',
            '.header .shop',
            // 通用选择器
            '[class*="ShopInfo"]',
            '[class*="shop-info"]',
            'div[class*="name"]',
            'span[class*="name"]',
            // 标题选择器
            'h1', 'h2', 'h3'
          ];
          
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              for (const element of elements) {
                const text = element.innerText ? element.innerText.trim() : '';
                
                // 过滤条件：
                // 1. 长度在2-50之间
                // 2. 不是纯数字（排除ID）
                // 3. 不是常见的导航文本
                // 4. 包含中文字符（店铺名称通常有中文）
                if (text && text.length >= 2 && text.length <= 50) {
                  // 排除纯数字
                  if (/^\\d+$/.test(text)) {
                    continue;
                  }
                  
                  // 排除常见的非店铺名称文本
                  const excludedTexts = [
                    '首页', '商品', '订单', '数据', '店铺', '设置', '帮助',
                    '工作台', '营销', '客服', '财务', '物流', '售后',
                    '商品管理', '订单管理', '数据中心', '店铺装修',
                    '退出', '登录', '注册', '确定', '取消', '保存'
                  ];
                  if (excludedTexts.includes(text)) {
                    continue;
                  }
                  
                  // 检查是否包含中文字符
                  const hasChinese = /[\\u4e00-\\u9fff]/.test(text);
                  
                  if (hasChinese) {
                    shopName = text;
                    console.log('✓ 从页面元素提取到店铺名称:', shopName, '(选择器:', selector + ')');
                    break;
                  }
                }
              }
              
              if (shopName) break;
            } catch(e) {
              console.error('⚠ 选择器', selector, '提取失败:', e);
            }
          }
        }

        // 方法5：尝试从页面标题提取 - 对应后端方法5
        if (!shopName) {
          console.log('[调试] 尝试从页面标题提取店铺名称...');
          const title = document.title;
          console.log('[调试] 页面标题:', title);
          
          // 从标题中提取店铺名称（通常格式：店铺名称 - 抖店）
          if (title && title.includes('-')) {
            const parts = title.split('-');
            const potentialName = parts[0].trim();
            
            // 验证是否是有效的店铺名称
            if (potentialName.length >= 2 && potentialName.length <= 50 && !/^\\d+$/.test(potentialName)) {
              const hasChinese = /[\\u4e00-\\u9fff]/.test(potentialName);
              if (hasChinese) {
                shopName = potentialName;
                console.log('✓ 从页面标题提取到店铺名称:', shopName);
              }
            }
          }
        }

        // 如果还是没有shop_id，使用Cookie中的uid作为标识
        if (!shopId) {
          console.log('[调试] 未找到shop_id，尝试使用会话ID生成...');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (['uid_tt', 'sessionid', 'sid_tt'].includes(name)) {
              // 简单hash生成唯一标识
              let hash = 0;
              for (let i = 0; i < value.length; i++) {
                const char = value.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
              }
              shopId = Math.abs(hash).toString(16).substring(0, 16);
              console.log('✓ 使用会话ID生成店铺标识:', shopId);
              break;
            }
          }
        }

        // 验证结果
        console.log('[提取结果] 店铺ID:', shopId);
        console.log('[提取结果] 店铺名称:', shopName);

        // 如果没有shop_name，使用默认名称
        if (!shopName) {
          if (shopId) {
            shopName = '抖店_' + shopId.substring(0, 8);
          } else {
            shopName = '未命名店铺';
          }
          console.log('⚠ 使用默认店铺名称:', shopName);
        }

        // 最终验证：确保shop_name不是纯数字或shop_id
        if (shopName && (/^\\d+$/.test(shopName) || shopName === shopId)) {
          console.log('⚠ 检测到店铺名称异常（纯数字或等于ID），使用默认名称');
          shopName = shopId ? ('抖店_' + shopId.substring(0, 8)) : '未命名店铺';
        }

        console.log('✓ 店铺信息提取完成:', { shopId, shopName });
        return { shopId, shopName };
      } catch(e) {
        console.error('✗ 获取店铺信息失败:', e);
        return { shopId: '', shopName: '' };
      }
    })()
  `;
}

module.exports = {
  getShopInfoExtractionScript
};
