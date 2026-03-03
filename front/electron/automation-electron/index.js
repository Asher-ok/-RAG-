/**
 * Electron 自动化模块 - 入口文件
 * 
 * 导出所有自动化功能
 */

const { executeFissionElectron } = require('./fission-executor-electron');

/**
 * 使用 Electron BrowserWindow 执行裂变
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} params - 裂变参数
 * @param {Function} onProgress - 进度回调函数（商品级别）
 * @param {Function} onStepProgress - 步骤进度回调函数
 * @returns {Promise<Object>} 裂变结果
 */
async function executeFissionWithBrowserWindow(window, params, onProgress, onStepProgress) {
  console.log('\n[Electron自动化] 开始执行裂变...');
  
  // 步骤进度回调函数（和商品同步完全一样）
  const stepProgressCallback = async (stepData) => {
    console.log(`[步骤] ${stepData.step} - ${stepData.status}: ${stepData.message}`);
    
    // ✅ 确保 stepData 包含 taskId
    const stepDataWithTask = {
      ...stepData,
      taskId: params.taskId // 注入 taskId
    };
    
    // 调用外部传入的回调（handler 会转发到主窗口的渲染进程）
    if (onStepProgress) {
      await onStepProgress(stepDataWithTask);
    }
  };
  
  // 商品级别进度回调函数
  const progressCallback = async (progressData) => {
    console.log(`[进度] ${progressData.currentIndex}/${progressData.total} - 成功:${progressData.successCount} 失败:${progressData.failedCount}`);
    
    // ✅ 确保 progressData 包含 taskId
    const progressDataWithTask = {
      ...progressData,
      taskId: params.taskId // 注入 taskId
    };
    
    // 调用外部传入的回调（handler 会转发到主窗口的渲染进程）
    if (onProgress) {
      await onProgress(progressDataWithTask);
    }
  };
  
  // 执行裂变，传递步骤进度回调和商品进度回调
  const result = await executeFissionElectron(window, params, stepProgressCallback, progressCallback);
  
  console.log('\n[Electron自动化] 裂变执行完成');
  console.log(`  成功: ${result.successCount}/${result.total}`);
  console.log(`  失败: ${result.failedCount}/${result.total}`);
  
  return result;
}

module.exports = {
  executeFissionWithBrowserWindow
};
