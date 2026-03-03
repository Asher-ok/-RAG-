/**
 * 步骤5: 点击确认导出
 * 
 * 功能：
 * 1. 等待抽屉弹出
 * 2. 查找抽屉中的"导出"确认按钮
 * 3. 检查按钮是否可点击
 * 4. 点击按钮
 * 5. 等待页面跳转或抽屉关闭
 * 
 * 注意：
 * - 抽屉选择器: .ecom-g-drawer
 * - 按钮在 .ecom-g-drawer-footer 区域
 * - 点击后可能跳转到导出记录页面
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
 * 点击确认导出
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string, details?: Object}>}
 */
async function confirmExport(window) {
  console.log(`\n========== [步骤5] 点击确认导出 ==========`);
  
  try {
    // 5.1 等待抽屉弹出
    console.log(`[步骤5.1] 等待抽屉弹出...`);
    console.log(`  → 等待2秒...`);
    await wait(2000);
    
    // 5.2 查找抽屉和确认按钮
    console.log(`\n[步骤5.2] 查找抽屉中的'导出'确认按钮...`);
    
    const confirmResult = await executeJS(window, `
      (function() {
        console.log('[确认导出] 开始查找抽屉');
        
        // 查找抽屉
        const drawer = document.querySelector('.ecom-g-drawer');
        const drawerFooter = document.querySelector('.ecom-g-drawer-footer');
        
        if (!drawer && !drawerFooter) {
          console.log('[确认导出] 未找到导出抽屉');
          return { found: false, reason: '未找到导出抽屉' };
        }
        
        console.log('[确认导出] 找到抽屉');
        
        // 查找"导出"按钮
        const buttons = document.querySelectorAll('.ecom-g-drawer-footer button, .ecom-g-drawer button');
        let exportButton = null;
        
        console.log('[确认导出] 找到', buttons.length, '个按钮');
        
        for (const btn of buttons) {
          const text = btn.textContent.trim();
          console.log('[确认导出] 按钮文本:', text);
          
          if (text === '导出' || text.includes('导出')) {
            exportButton = btn;
            console.log('[确认导出] 找到导出按钮');
            break;
          }
        }
        
        if (!exportButton) {
          // 列出所有找到的按钮文本
          const buttonTexts = Array.from(buttons).map(b => b.textContent.trim());
          console.log('[确认导出] 未找到导出按钮，可用按钮:', buttonTexts);
          
          return { 
            found: false, 
            reason: '未找到导出按钮',
            availableButtons: buttonTexts
          };
        }
        
        // 检查按钮是否可点击
        const isDisabled = exportButton.disabled || exportButton.classList.contains('disabled');
        
        console.log('[确认导出] 按钮禁用状态:', isDisabled);
        
        if (isDisabled) {
          return { 
            found: true, 
            clickable: false, 
            reason: '按钮被禁用' 
          };
        }
        
        // 点击按钮
        exportButton.click();
        console.log('[确认导出] 点击完成');
        
        return { 
          found: true, 
          clickable: true, 
          clicked: true,
          buttonText: exportButton.textContent.trim()
        };
      })()
    `);
    
    // 5.3 处理查找结果
    if (!confirmResult.found) {
      console.log(`  ✗ 未找到确认导出按钮`);
      console.log(`  → 原因: ${confirmResult.reason || '未知'}`);
      
      if (confirmResult.availableButtons) {
        console.log(`  → 抽屉中可用的按钮:`);
        for (const btnText of confirmResult.availableButtons) {
          console.log(`    • ${btnText}`);
        }
      }
      
      return {
        success: false,
        message: '未找到确认导出按钮',
        details: confirmResult
      };
    }
    
    if (!confirmResult.clickable) {
      console.log(`  ✗ 确认按钮不可点击`);
      console.log(`  → 原因: ${confirmResult.reason || '未知'}`);
      
      return {
        success: false,
        message: `确认按钮不可点击: ${confirmResult.reason || '未知'}`,
        details: confirmResult
      };
    }
    
    console.log(`  ✓ 找到'导出'确认按钮`);
    console.log(`  → 按钮文本: ${confirmResult.buttonText || '导出'}`);
    console.log(`  ✓ 成功点击'导出'确认按钮`);
    
    // 5.3 等待点击操作完成
    console.log(`\n[步骤5.3] 等待点击操作完成...`);
    console.log(`  → 等待5秒...`);
    await wait(5000);
    
    // 5.4 主动跳转到导出记录页面
    console.log(`\n[步骤5.4] 主动跳转到导出记录页面...`);
    const exportPageUrl = 'https://fxg.jinritemai.com/ffa/g/excel';
    console.log(`  → 目标URL: ${exportPageUrl}`);
    
    await window.loadURL(exportPageUrl);
    console.log(`  ✓ 页面跳转成功`);
    
    // 等待页面加载
    console.log(`  → 等待页面加载...`);
    await wait(3000);
    
    // 5.5 等待导出任务完成（10秒）
    console.log(`\n[步骤5.5] 等待导出任务完成...`);
    console.log(`  → 等待10秒，确保导出任务完成...`);
    await wait(10000);
    
    // 5.6 检查页面状态
    console.log(`\n[步骤5.6] 检查页面状态...`);
    
    const currentUrl = window.webContents.getURL();
    console.log(`  → 当前URL: ${currentUrl}`);
    
    if (currentUrl.includes('/ffa/g/excel')) {
      console.log(`  ✓ 已在导出记录页面`);
      
      // 等待表格加载
      console.log(`  → 等待表格加载...`);
      await wait(2000);
      
      // 检查最新导出记录的时间
      const latestTime = await executeJS(window, `
        (function() {
          const firstCell = document.querySelector('.ecom-g-table-cell');
          return firstCell ? firstCell.textContent.trim() : null;
        })()
      `);
      
      if (latestTime) {
        console.log(`  ✓ 找到最新记录`);
        console.log(`  → 最新记录时间: ${latestTime}`);
        
        return {
          success: true,
          message: '导出任务已完成，已跳转到导出记录页面',
          jumped: true,
          details: {
            currentUrl,
            latestTime
          }
        };
      } else {
        console.log(`  ⚠ 未找到最新记录，但继续执行`);
        
        return {
          success: true,
          message: '已跳转到导出记录页面',
          jumped: true,
          details: {
            currentUrl
          }
        };
      }
    } else {
      console.log(`  ✗ 页面跳转失败`);
      
      return {
        success: false,
        message: '页面跳转失败，未到达导出记录页面',
        details: {
          currentUrl,
          expectedUrl: exportPageUrl
        }
      };
    }
    
    console.log(`========== [步骤5] 完成 ==========\n`);
    
  } catch (error) {
    console.error(`  ✗ 点击确认导出失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `点击确认导出失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  confirmExport
};
