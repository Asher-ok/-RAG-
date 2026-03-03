/**
 * 步骤3: 点击"全部"标签
 * 
 * 功能：
 * 1. 检查"全部"标签是否存在
 * 2. 检查标签是否已选中
 * 3. 如果未选中，点击标签
 * 4. 验证点击是否成功
 * 
 * 注意：
 * - 标签ID: #rc-tabs-0-tab-all
 * - 需要检查 aria-selected 属性
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
 * 点击"全部"标签
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string, details?: Object, skipped?: boolean, alreadySelected?: boolean}>}
 */
async function clickAllTab(window) {
  console.log(`\n========== [步骤3] 点击'全部'标签 ==========`);
  
  try {
    // 3.1 检查标签状态
    console.log(`[步骤3.1] 检查'全部'标签状态...`);
    
    await wait(1000);
    
    const tabStatus = await executeJS(window, `
      (function() {
        const tabContainer = document.querySelector('.ecom-g-tabs-nav-list');
        const allTab = document.querySelector('#rc-tabs-0-tab-all');
        
        const currentUrl = window.location.href;
        const pageTitle = document.title;
        
        const hasProductTable = !!document.querySelector('.ecom-g-table');
        const hasProductList = !!document.querySelector('[class*="product"]');
        
        return {
          currentUrl,
          pageTitle,
          hasContainer: !!tabContainer,
          hasAllTab: !!allTab,
          isSelected: allTab ? allTab.getAttribute('aria-selected') === 'true' : false,
          tabText: allTab ? allTab.innerText : '',
          hasProductTable,
          hasProductList
        };
      })()
    `);
    
    console.log(`  → 页面标题: ${tabStatus.pageTitle}`);
    console.log(`  → 当前URL: ${tabStatus.currentUrl}`);
    console.log(`  → 标签容器存在: ${tabStatus.hasContainer ? '是' : '否'}`);
    console.log(`  → '全部'标签存在: ${tabStatus.hasAllTab ? '是' : '否'}`);
    
    if (tabStatus.hasAllTab) {
      console.log(`  → 标签文本: ${tabStatus.tabText}`);
      console.log(`  → 已选中: ${tabStatus.isSelected ? '是' : '否'}`);
    }
    
    console.log(`  → 商品表格存在: ${tabStatus.hasProductTable ? '是' : '否'}`);
    
    // 3.2 判断是否需要点击
    if (!tabStatus.hasAllTab) {
      console.log(`\n[步骤3.2] 未找到'全部'标签`);
      console.log(`  ⚠ 页面可能不在商品列表，跳过此步骤`);
      console.log(`  → 当前URL: ${tabStatus.currentUrl}`);
      
      console.log(`========== [步骤3] 完成（跳过） ==========\n`);
      
      return {
        success: true,
        message: '未找到"全部"标签，跳过此步骤',
        skipped: true,
        details: tabStatus
      };
    }
    
    if (tabStatus.isSelected) {
      console.log(`\n[步骤3.2] '全部'标签已选中`);
      console.log(`  ✓ 无需点击，直接进入下一步`);
      console.log(`  → aria-selected='true'`);
      
      console.log(`========== [步骤3] 完成 ==========\n`);
      
      return {
        success: true,
        message: '"全部"标签已选中，无需点击',
        alreadySelected: true,
        details: tabStatus
      };
    }
    
    // 3.3 点击"全部"标签
    console.log(`\n[步骤3.3] '全部'标签未选中，开始点击...`);
    console.log(`  → 准备点击标签...`);
    
    const clickResult = await executeJS(window, `
      (function() {
        const allTab = document.querySelector('#rc-tabs-0-tab-all');
        if (allTab) {
          console.log('[点击全部标签] 找到标签，准备点击');
          allTab.click();
          console.log('[点击全部标签] 点击完成');
          return true;
        }
        console.log('[点击全部标签] 未找到标签');
        return false;
      })()
    `);
    
    if (!clickResult) {
      console.log(`  ✗ 点击失败：未找到标签元素`);
      
      return {
        success: false,
        message: '点击失败：未找到标签元素',
        details: tabStatus
      };
    }
    
    console.log(`  ✓ 点击操作已执行`);
    
    // 3.4 等待点击生效
    console.log(`\n[步骤3.4] 等待点击生效...`);
    console.log(`  → 等待2秒...`);
    await wait(2000);
    
    // 3.5 验证点击结果
    console.log(`\n[步骤3.5] 验证点击结果...`);
    
    const isSelected = await executeJS(window, `
      (function() {
        const allTab = document.querySelector('#rc-tabs-0-tab-all');
        if (!allTab) {
          return { success: false, reason: '标签元素消失' };
        }
        
        const selected = allTab.getAttribute('aria-selected') === 'true';
        console.log('[验证点击] aria-selected:', selected);
        
        return { success: selected, selected };
      })()
    `);
    
    if (isSelected.success) {
      console.log(`  ✓ 验证通过：'全部'标签已选中`);
      console.log(`  → aria-selected='true'`);
      
      console.log(`========== [步骤3] 完成 ==========\n`);
      
      return {
        success: true,
        message: '成功点击"全部"标签',
        clicked: true,
        details: {
          before: tabStatus,
          after: isSelected
        }
      };
    } else {
      console.log(`  ⚠ 点击了但未选中`);
      console.log(`  → aria-selected 仍为 false`);
      console.log(`  → 原因: ${isSelected.reason || '未知'}`);
      console.log(`  → 继续执行后续步骤`);
      
      console.log(`========== [步骤3] 完成（警告） ==========\n`);
      
      return {
        success: true,
        message: '点击了但未选中，继续执行',
        clicked: true,
        warning: true,
        details: {
          before: tabStatus,
          after: isSelected
        }
      };
    }
    
  } catch (error) {
    console.error(`  ✗ 点击'全部'标签失败: ${error.message}`);
    console.error(error.stack);
    
    console.log(`  → 继续执行后续步骤`);
    console.log(`========== [步骤3] 完成（错误） ==========\n`);
    
    return {
      success: true,
      message: `点击标签失败，继续执行: ${error.message}`,
      error: true,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  clickAllTab
};
