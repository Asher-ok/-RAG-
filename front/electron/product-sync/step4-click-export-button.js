/**
 * 步骤4: 点击"导出查询商品"按钮
 * 
 * 功能：
 * 1. 查找"导出查询商品"按钮
 * 2. 检查按钮是否可见和可点击
 * 3. 滚动到按钮位置
 * 4. 点击按钮
 * 
 * 注意：
 * - 按钮ID: #exportSearchedGoods
 * - 如果通过ID找不到，尝试通过文本查找
 * - 需要检查按钮是否被禁用
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
 * 点击"导出查询商品"按钮
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string, details?: Object}>}
 */
async function clickExportButton(window) {
  console.log(`\n========== [步骤4] 点击'导出查询商品'按钮 ==========`);
  
  try {
    // 4.1 查找按钮
    console.log(`[步骤4.1] 查找'导出查询商品'按钮...`);
    
    await wait(1000);
    
    const exportResult = await executeJS(window, `
      (function() {
        const currentUrl = window.location.href;
        const pageTitle = document.title;
        
        console.log('[导出按钮] 开始查找按钮');
        console.log('[导出按钮] 当前URL:', currentUrl);
        
        // 方法1: 通过ID查找
        const btn = document.querySelector('#exportSearchedGoods');
        
        if (!btn) {
          console.log('[导出按钮] 通过ID未找到，尝试文本匹配');
          
          // 方法2: 通过文本查找
          const allButtons = document.querySelectorAll('button');
          for (const button of allButtons) {
            if (button.textContent && button.textContent.includes('导出查询商品')) {
              console.log('[导出按钮] 通过文本找到按钮');
              
              // 滚动到按钮位置
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // 等待滚动完成后点击
              setTimeout(() => {
                button.click();
                console.log('[导出按钮] 点击完成（文本匹配）');
              }, 500);
              
              return { 
                found: true, 
                method: '文本匹配', 
                text: button.textContent.trim(), 
                currentUrl, 
                pageTitle 
              };
            }
          }
          
          // 列出页面上所有按钮的文本（前10个）
          const buttonTexts = Array.from(allButtons)
            .map(b => b.textContent.trim())
            .filter(t => t)
            .slice(0, 10);
          
          console.log('[导出按钮] 未找到导出按钮');
          console.log('[导出按钮] 可用按钮:', buttonTexts);
          
          return { 
            found: false, 
            reason: '未找到导出按钮', 
            currentUrl, 
            pageTitle, 
            availableButtons: buttonTexts 
          };
        }
        
        console.log('[导出按钮] 通过ID找到按钮');
        
        // 检查按钮是否可见和可点击
        const rect = btn.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0;
        const isDisabled = btn.disabled || btn.classList.contains('disabled');
        
        console.log('[导出按钮] 可见:', isVisible);
        console.log('[导出按钮] 禁用:', isDisabled);
        
        if (!isVisible) {
          return { 
            found: true, 
            clickable: false, 
            reason: '按钮不可见', 
            currentUrl, 
            pageTitle 
          };
        }
        
        if (isDisabled) {
          return { 
            found: true, 
            clickable: false, 
            reason: '按钮被禁用', 
            currentUrl, 
            pageTitle 
          };
        }
        
        // 滚动到按钮位置
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log('[导出按钮] 滚动到按钮位置');
        
        // 等待滚动完成后点击
        setTimeout(() => {
          btn.click();
          console.log('[导出按钮] 点击完成（ID匹配）');
        }, 500);
        
        return { 
          found: true, 
          clickable: true, 
          clicked: true, 
          method: 'ID匹配', 
          currentUrl, 
          pageTitle 
        };
      })()
    `);
    
    // 4.2 处理查找结果
    console.log(`  → 页面标题: ${exportResult.pageTitle || 'unknown'}`);
    console.log(`  → 当前URL: ${exportResult.currentUrl || 'unknown'}`);
    
    if (!exportResult.found) {
      console.log(`  ✗ 未找到'导出查询商品'按钮`);
      console.log(`  → 原因: ${exportResult.reason || '未知'}`);
      
      if (exportResult.availableButtons && exportResult.availableButtons.length > 0) {
        console.log(`  → 页面上可用的按钮（前5个）:`);
        for (const btnText of exportResult.availableButtons.slice(0, 5)) {
          console.log(`    • ${btnText}`);
        }
      }
      
      return {
        success: false,
        message: '未找到"导出查询商品"按钮',
        details: exportResult
      };
    }
    
    if (!exportResult.clickable) {
      console.log(`  ✗ 导出按钮不可点击`);
      console.log(`  → 原因: ${exportResult.reason || '未知'}`);
      
      return {
        success: false,
        message: `导出按钮不可点击: ${exportResult.reason || '未知'}`,
        details: exportResult
      };
    }
    
    console.log(`  ✓ 找到'导出查询商品'按钮`);
    console.log(`  → 定位方式: ${exportResult.method || '未知'}`);
    
    if (exportResult.text) {
      console.log(`  → 按钮文本: ${exportResult.text}`);
    }
    
    // 4.3 等待点击生效
    console.log(`\n[步骤4.3] 等待点击生效...`);
    console.log(`  → 等待2秒...`);
    await wait(2000);
    
    console.log(`  ✓ 成功点击'导出查询商品'按钮`);
    
    console.log(`========== [步骤4] 完成 ==========\n`);
    
    return {
      success: true,
      message: '成功点击"导出查询商品"按钮',
      details: exportResult
    };
    
  } catch (error) {
    console.error(`  ✗ 点击'导出查询商品'按钮失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `点击按钮失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  clickExportButton
};
