/**
 * 商品同步自动化模块 - 入口文件 (Electron)
 * 
 * 导出所有商品同步功能
 */

const { executeProductSync } = require('./sync-executor');

/**
 * 使用 Electron BrowserWindow 执行商品同步
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} params - 同步参数
 * @param {number} params.shopId - 店铺ID
 * @param {string} params.shopName - 店铺名称
 * @param {string} params.apiBaseUrl - API基础URL（可选）
 * @param {string} params.token - 认证token
 * @param {string} params.downloadPath - 下载目录路径（可选）
 * @param {Function} onProgress - 进度回调函数（可选）
 * @returns {Promise<Object>} 同步结果
 */
async function executeProductSyncWithBrowserWindow(window, params, onProgress) {
  console.log('\n[Electron商品同步] 开始执行...');
  
  // 进度回调函数
  const progressCallback = async (progress) => {
    console.log(`[进度] ${progress.step} - ${progress.status}`);
    console.log(`  消息: ${progress.message}`);
    if (progress.details) {
      console.log(`  详情: ${typeof progress.details === 'string' ? progress.details : JSON.stringify(progress.details, null, 2)}`);
    }
    
    // 可以通过 IPC 发送进度到渲染进程
    if (window && !window.isDestroyed()) {
      window.webContents.send('product-sync-progress', progress);
    }
    
    // 调用用户提供的回调
    if (onProgress) {
      await onProgress(progress);
    }
  };
  
  // 执行同步
  const result = await executeProductSync(window, params, progressCallback);
  
  console.log('\n[Electron商品同步] 同步执行完成');
  if (result.success) {
    console.log(`  ✓ 成功: ${result.totalProducts} 个商品`);
    console.log(`  → 新增: ${result.savedCount}`);
    console.log(`  → 更新: ${result.updatedCount}`);
  } else {
    console.log(`  ✗ 失败: ${result.message}`);
  }
  
  return result;
}

module.exports = {
  executeProductSyncWithBrowserWindow,
  executeProductSync
};
