/**
 * 步骤2: 访问商品列表页
 * 
 * 功能：
 * 1. 访问商品列表页面
 * 2. 等待页面加载完成
 * 3. 检测是否被重定向到登录页
 * 4. 支持重试机制（最多2次）
 * 
 * 注意：
 * - URL: https://fxg.jinritemai.com/ffa/g/list
 * - 需要检查页面是否正常加载
 */

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 在页面中执行 JavaScript
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {string} code - JavaScript代码
 */
async function executeJS(window, code) {
  if (window.isDestroyed()) {
    throw new Error('窗口已关闭');
  }
  return await window.webContents.executeJavaScript(code);
}

/**
 * 访问商品列表页
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} options - 选项
 * @param {string} options.shopName - 店铺名称
 * @returns {Promise<{success: boolean, message?: string, details?: Object, needRetry?: boolean}>}
 */
async function visitProductListPage(window, options = {}) {
  const { shopName = '未知店铺' } = options;
  
  console.log(`\n========== [步骤2] 访问商品列表页 ==========`);
  
  try {
    // 2.1 访问商品列表页
    console.log(`[步骤2.1] 访问商品列表页...`);
    console.log(`  → 店铺: ${shopName}`);
    
    const productListUrl = 'https://fxg.jinritemai.com/ffa/g/list';
    console.log(`  → 目标URL: ${productListUrl}`);
    
    await window.loadURL(productListUrl);
    
    // 2.2 等待页面加载
    console.log(`\n[步骤2.2] 等待页面加载...`);
    console.log(`  → 等待5秒...`);
    await wait(5000);
    
    // 2.3 检查当前URL
    console.log(`\n[步骤2.3] 检查页面状态...`);
    const currentUrl = window.webContents.getURL();
    console.log(`  → 当前URL: ${currentUrl}`);
    
    // 2.4 检查是否在登录页
    if (currentUrl.includes('/login')) {
      console.log(`  ✗ 检测到重定向到登录页`);
      console.log(`  → 当前URL: ${currentUrl}`);
      
      return {
        success: false,
        message: '被重定向到登录页',
        needRetry: true,
        details: {
          currentUrl,
          shopName
        }
      };
    }
    
    // 2.5 获取页面标题
    const pageTitle = await executeJS(window, 'document.title');
    console.log(`  → 页面标题: ${pageTitle}`);
    
    // 2.6 检查页面元素
    const pageInfo = await executeJS(window, `
      (function() {
        const hasProductTable = !!document.querySelector('.ecom-g-table');
        const hasTabContainer = !!document.querySelector('.ecom-g-tabs-nav-list');
        const hasExportButton = !!document.querySelector('#exportSearchedGoods');
        
        return {
          hasProductTable,
          hasTabContainer,
          hasExportButton
        };
      })()
    `);
    
    console.log(`  → 商品表格存在: ${pageInfo.hasProductTable ? '是' : '否'}`);
    console.log(`  → 标签容器存在: ${pageInfo.hasTabContainer ? '是' : '否'}`);
    console.log(`  → 导出按钮存在: ${pageInfo.hasExportButton ? '是' : '否'}`);
    
    // 2.7 验证页面状态
    console.log(`\n[步骤2.7] 验证页面状态...`);
    
    if (!pageInfo.hasProductTable && !pageInfo.hasTabContainer) {
      console.log(`  ⚠ 页面元素不完整，可能未加载完成`);
      console.log(`  → 继续执行后续步骤`);
    } else {
      console.log(`  ✓ 页面状态正常`);
    }
    
    console.log(`  ✓ 成功进入商品列表页面`);
    console.log(`  → 最终URL: ${currentUrl}`);
    
    console.log(`========== [步骤2] 完成 ==========\n`);
    
    return {
      success: true,
      message: '成功访问商品列表页',
      details: {
        currentUrl,
        pageTitle,
        ...pageInfo,
        shopName
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 访问商品列表页失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `访问商品列表页失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  visitProductListPage
};
