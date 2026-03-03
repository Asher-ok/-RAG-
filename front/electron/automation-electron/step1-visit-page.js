/**
 * 步骤1: 访问创建相似品页面
 * 
 * 功能：
 * 1. 验证登录状态（通过访问首页）
 * 2. 访问创建相似品页面
 * 3. 等待页面加载完成
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
 * 访问创建相似品页面
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {string} productId - 原商品ID（抖音商品ID）
 * @param {Object} options - 选项
 * @param {string} options.shopName - 店铺名称
 * @returns {Promise<{success: boolean, message?: string, url?: string}>}
 */
async function visitCreateSimilarPage(window, productId, options = {}) {
  const { shopName = '未知店铺' } = options;
  
  console.log(`\n========== [步骤1] 访问创建相似品页面 ==========`);
  
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
          // ✅ ERR_ABORTED (-3) 通常是用户主动取消或重定向，需要验证最终URL
          // ✅ ERR_NETWORK_CHANGED (-21) 网络切换，可以重试
          if (errorCode === -3) {
            console.log(`  → 检测到 ERR_ABORTED，可能是重定向或取消`);
            resolve(); // 继续检查最终URL
          } else if (errorCode === -21) {
            console.log(`  → 检测到网络切换 (ERR_NETWORK_CHANGED)`);
            resolve(); // 继续检查
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
    await wait(500);
    
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
    
    // 1.3 访问创建相似品页面
    console.log(`\n[步骤1.3] 访问创建相似品页面...`);
    const createSimilarUrl = `https://fxg.jinritemai.com/ffa/g/create?copyid=${productId}`;
    
    console.log(`  → 目标URL: ${createSimilarUrl}`);
    console.log(`  → 商品ID: ${productId}`);
    
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
          // ✅ ERR_ABORTED (-3) 通常是用户主动取消或重定向，需要验证最终URL
          // ✅ ERR_NETWORK_CHANGED (-21) 网络切换，可以重试
          if (errorCode === -3) {
            console.log(`  → 检测到 ERR_ABORTED，可能是重定向或取消`);
            resolve(); // 继续检查最终URL
          } else if (errorCode === -21) {
            console.log(`  → 检测到网络切换 (ERR_NETWORK_CHANGED)`);
            resolve(); // 继续检查
          } else {
            reject(new Error(`加载失败: ${errorDescription} (${errorCode})`));
          }
        });
        
        // 开始加载
        window.loadURL(createSimilarUrl).catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (loadError) {
      console.log(`  → 加载过程中出现问题: ${loadError.message}`);
      console.log(`  → 继续检查当前URL...`);
    }
    
    // 1.4 等待页面加载
    console.log(`\n[步骤1.4] 等待页面加载...`);
    await wait(200); // 优化：从1000ms缩短为200ms
    
    // 1.4.1 等待关键元素加载（标题输入框）+ 页面状态检测
    console.log(`\n[步骤1.4.1] 等待关键元素加载（标题输入框）...`);
    
    let elementFound = false;
    const maxWaitTime = 15000; // 最多等待15秒（从30秒降低）
    const checkInterval = 200; // 每1秒检查一次
    let waitedTime = 0;
    let lastPageState = null; // 记录上一次的页面状态
    let noChangeCount = 0; // 页面状态无变化的次数
    
    while (!elementFound && waitedTime < maxWaitTime) {
      try {
        const checkResult = await window.webContents.executeJavaScript(`
          (function() {
            // 查找标题输入框（使用多种方法）
            let titleInput = null;
            let method = '';
            
            // 方法1: 使用ID选择器
            titleInput = document.querySelector("input#pg-title-input");
            if (titleInput) {
              return { found: true, method: 'ID选择器', pageReady: true };
            }
            
            // 方法2: 使用dropdownclassname属性
            const inputs = document.querySelectorAll("input[dropdownclassname]");
            for (const input of inputs) {
              const className = input.getAttribute('dropdownclassname');
              if (className && className.includes('商品标题') && !className.includes('导购')) {
                return { found: true, method: 'dropdownclassname属性', pageReady: true };
              }
            }
            
            // 方法3: 使用placeholder精确匹配
            const placeholderInputs = document.querySelectorAll("input[placeholder]");
            for (const input of placeholderInputs) {
              const placeholder = input.getAttribute('placeholder');
              if (placeholder && 
                  (placeholder.includes('15-60个字符') || placeholder.includes('8-30个汉字')) &&
                  !placeholder.includes('导购')) {
                return { found: true, method: 'placeholder匹配', pageReady: true };
              }
            }
            
            // 方法4: 使用attr-field-id属性
            const container = document.querySelector('[attr-field-id="商品标题"]');
            if (container) {
              const input = container.querySelector('input[type="text"]');
              if (input) {
                return { found: true, method: 'attr-field-id属性', pageReady: true };
              }
            }
            
            // 未找到输入框，检查页面状态
            const pageState = {
              readyState: document.readyState,
              bodyExists: !!document.body,
              inputCount: document.querySelectorAll('input').length,
              divCount: document.querySelectorAll('div').length
            };
            
            return { 
              found: false, 
              pageReady: document.readyState === 'complete',
              pageState: pageState
            };
          })()
        `);
        
        if (checkResult.found) {
          console.log(`  ✓ 找到标题输入框（使用${checkResult.method}）`);
          elementFound = true;
          break;
        }
        
        // 检查页面状态是否有变化
        if (lastPageState) {
          const currentState = JSON.stringify(checkResult.pageState);
          const lastState = JSON.stringify(lastPageState);
          
          if (currentState === lastState) {
            noChangeCount++;
            
            // 如果页面状态连续5秒没有变化，且页面已完成加载，说明页面结构可能有问题
            if (noChangeCount >= 5 && checkResult.pageReady) {
              console.log(`  ✗ 页面已加载完成但未找到标题输入框`);
              console.log(`  → 页面状态: readyState=${checkResult.pageState.readyState}`);
              console.log(`  → 页面元素: ${checkResult.pageState.inputCount}个input, ${checkResult.pageState.divCount}个div`);
              console.log(`  → 可能原因: 页面结构已变化，或登录已过期`);
              
              // 获取当前URL
              const currentUrl = window.webContents.getURL();
              
              return {
                success: false,
                message: '页面加载完成但未找到标题输入框，可能页面结构已变化',
                details: {
                  finalUrl: currentUrl,
                  shopName,
                  pageState: checkResult.pageState
                }
              };
            }
          } else {
            // 页面有变化，重置计数器
            noChangeCount = 0;
          }
        }
        
        lastPageState = checkResult.pageState;
        
      } catch (error) {
        console.log(`  → 检查元素时出错: ${error.message}`);
      }
      
      // 等待后继续检查
      await wait(checkInterval);
      waitedTime += checkInterval;
      
      if (waitedTime % 5000 === 0) {
        console.log(`  → 已等待 ${waitedTime / 1000} 秒，继续等待...`);
      }
    }
    
    if (!elementFound) {
      console.log(`  ✗ 等待${maxWaitTime / 1000}秒后仍未找到标题输入框`);
      console.log(`  → 页面可能加载失败或结构已变化`);
      
      // 获取当前URL
      const currentUrl = window.webContents.getURL();
      
      return {
        success: false,
        message: `等待${maxWaitTime / 1000}秒后仍未找到标题输入框`,
        details: {
          finalUrl: currentUrl,
          shopName,
          waitedTime: waitedTime / 1000
        }
      };
    } else {
      console.log(`  ✓ 页面关键元素已加载（耗时 ${waitedTime / 1000} 秒）`);
    }
    
    // 再等待2秒让页面完全稳定
    console.log(`  → 等待页面完全稳定...`);
    await wait(500);
    
    // 1.5 验证是否成功进入创建页面
    console.log(`\n[步骤1.5] 验证页面加载结果...`);
    const finalUrl = window.webContents.getURL();
    console.log(`  → 最终URL: ${finalUrl}`);
    
    if (finalUrl.includes('/login')) {
      console.log(`  ✗ 跳转到登录页面，登录状态可能已过期`);
      return {
        success: false,
        message: '无法访问创建页面，登录状态可能已过期',
        details: {
          finalUrl,
          shopName
        }
      };
    }
    
    if (!finalUrl.includes('create')) {
      console.log(`  ✗ 未能进入商品发布页面`);
      return {
        success: false,
        message: '未能进入商品发布页面',
        details: {
          finalUrl,
          shopName
        }
      };
    }
    
    console.log(`  ✓ 成功进入创建相似品页面`);
    
    // 1.6 验证结果
    console.log(`\n[步骤1.6] 验证结果汇总...`);
    console.log(`  ✓ 页面访问成功`);
    console.log(`  → 店铺: ${shopName}`);
    console.log(`  → 商品ID: ${productId}`);
    console.log(`  → 最终URL: ${finalUrl}`);
    
    console.log(`========== [步骤1] 完成 ==========\n`);
    
    return {
      success: true,
      message: '成功进入创建相似品页面',
      url: finalUrl,
      details: {
        finalUrl,
        shopName,
        productId
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 访问页面失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `访问页面失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  visitCreateSimilarPage
};
