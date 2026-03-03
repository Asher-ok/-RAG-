/**
 * 步骤1: 验证登录状态
 * 
 * 功能：
 * 1. 检查登录状态（通过访问首页）
 * 2. 验证是否被重定向到登录页
 * 
 * 注意：
 * - 前端环境下，登录状态由 Electron session 管理
 * - 如果已登录，直接返回成功
 */

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证登录状态
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} options - 选项
 * @param {string} options.shopName - 店铺名称
 * @returns {Promise<{success: boolean, message?: string, details?: Object}>}
 */
async function verifyLoginStatus(window, options = {}) {
  const { shopName = '未知店铺' } = options;
  
  console.log(`\n========== [步骤1] 验证登录状态 ==========`);
  
  try {
    // 1.1 访问首页检查登录状态
    console.log(`[步骤1.1] 检查登录状态...`);
    console.log(`  → 店铺: ${shopName}`);
    
    const homepageUrl = 'https://fxg.jinritemai.com/ffa/mshop/homepage/index';
    console.log(`  → 访问首页: ${homepageUrl}`);
    
    // 使用 Promise 包装 loadURL，添加超时和错误处理
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('加载超时'));
        }, 15000); // 15秒超时
        
        // 监听加载完成
        window.webContents.once('did-finish-load', () => {
          clearTimeout(timeout);
          resolve();
        });
        
        // 监听加载失败
        window.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
          clearTimeout(timeout);
          // 如果是 ERR_ABORTED，可能是重定向，不算失败
          if (errorCode === -3) {
            console.log(`  → 检测到重定向 (ERR_ABORTED)，继续检查...`);
            resolve();
          } else {
            reject(new Error(`加载失败: ${errorDescription} (${errorCode})`));
          }
        });
        
        // 开始加载
        window.loadURL(homepageUrl).catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (loadError) {
      console.log(`  → 加载过程中出现问题: ${loadError.message}`);
      console.log(`  → 继续检查当前URL...`);
    }
    
    // 等待页面稳定
    await wait(3000);
    
    // 1.2 检查当前URL
    console.log(`\n[步骤1.2] 检查当前URL...`);
    const currentUrl = window.webContents.getURL();
    console.log(`  → 当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      console.log(`  ✗ 登录状态已过期`);
      console.log(`  → 需要重新登录`);
      
      return {
        success: false,
        message: '登录状态已过期，请重新登录',
        details: {
          currentUrl,
          shopName
        }
      };
    }
    
    console.log(`  ✓ 登录状态有效`);
    
    // 1.3 验证结果
    console.log(`\n[步骤1.3] 验证结果汇总...`);
    console.log(`  ✓ 登录状态验证成功`);
    console.log(`  → 店铺: ${shopName}`);
    console.log(`  → 当前URL: ${currentUrl}`);
    
    console.log(`========== [步骤1] 完成 ==========\n`);
    
    return {
      success: true,
      message: '登录状态验证成功',
      details: {
        currentUrl,
        shopName
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 验证登录状态失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `验证登录状态失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  verifyLoginStatus
};
