/**
 * 商品同步主执行器 (Electron)
 * 
 * 串联所有8个步骤，执行完整的商品同步流程
 * 
 * 步骤列表：
 * 1. 验证登录状态
 * 2. 访问商品列表页（包含重试机制）
 * 3. 点击"全部"标签
 * 4. 点击"导出查询商品"按钮
 * 5. 点击确认导出
 * 6. 下载Excel文件
 * 7. 解析Excel文件
 * 8. 保存到数据库
 */

const { verifyLoginStatus } = require('./step1-verify-login');
const { visitProductListPage } = require('./step2-visit-product-list');
const { clickAllTab } = require('./step3-click-all-tab');
const { clickExportButton } = require('./step4-click-export-button');
const { confirmExport } = require('./step5-confirm-export');
const { downloadExcel } = require('./step6-download-excel');
const { parseExcel } = require('./step7-parse-excel');
const { saveToDatabase } = require('./step8-save-to-database');
//  
/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 执行完整的商品同步流程
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} params - 同步参数
 * @param {number} params.shopId - 店铺ID
 * @param {string} params.shopName - 店铺名称
 * @param {string} params.apiBaseUrl - API基础URL
 * @param {string} params.token - 认证token
 * @param {string} params.downloadPath - 下载目录路径（可选）
 * @param {Function} progressCallback - 进度回调函数 async function(step, status, message, details)
 * @returns {Promise<Object>} 同步结果
 */
async function executeProductSync(window, params, progressCallback) {
  const {
    shopId,
    shopName,
    apiBaseUrl = 'http://123.56.44.206/api/v1',
    token = '',
    downloadPath = null
  } = params;
  
  /**
   * 发送进度事件
   */
  async function sendProgress(stepName, status, message = '', details = '') {
    if (progressCallback) {
      const stepData = {
        step: stepName,
        status,
        message,
        details,
        timestamp: new Date().toISOString()
      };
      await progressCallback(stepData);
    }
  }
  
  try {
    // 初始化
    await sendProgress('初始化', 'success', '开始商品同步流程', 
                      `店铺: ${shopName}, 店铺ID: ${shopId}`);
    await wait(500);
    
    // ========== 步骤1: 验证登录状态 ==========
    await sendProgress('检查登录状态', 'success', '正在检查登录状态...');
    
    const step1Result = await verifyLoginStatus(window, { shopName });
    
    if (!step1Result.success) {
      await sendProgress('检查登录状态', 'failed', step1Result.message, 
                        step1Result.details || {});
      return step1Result;
    }
    
    await sendProgress('检查登录状态', 'success', '登录状态有效', 
                      `店铺: ${shopName}`);
    await wait(500);
    
    // ========== 步骤2: 访问商品列表页（支持重试） ==========
    await sendProgress('访问商品列表页', 'success', '正在访问商品列表页...');
    await wait(500);
    
    const maxRetries = 2;
    let retryCount = 0;
    let step2Success = false;
    let step2Result;
    
    while (retryCount <= maxRetries && !step2Success) {
      if (retryCount > 0) {
        await sendProgress('重新访问商品列表页', 'success', 
                          `正在重新访问商品列表页 (第${retryCount}次重试)`);
      }
      
      step2Result = await visitProductListPage(window, { shopName });
      
      if (step2Result.success) {
        step2Success = true;
        await sendProgress('访问商品列表页', 'success', '成功进入商品列表页面', 
                          `当前URL: ${step2Result.details.currentUrl}`);
        break;
      }
      
      // 检查是否需要重试
      if (step2Result.needRetry && retryCount < maxRetries) {
        retryCount++;
        
        const reason = step2Result.message || '未知原因';
        
        await sendProgress('访问商品列表页', 'warning', 
                          `被重定向到登录页，尝试重新访问 (第${retryCount}次重试)`, 
                          `原因: ${reason}`);
        
        await wait(2000);
        
        await sendProgress('重新加载页面', 'success', 
                          `正在重新加载页面 (第${retryCount}次)`, 
                          `重新访问商品列表页`);
        
        continue;
      } else {
        // 不需要重试或已达到最大重试次数
        await sendProgress('访问商品列表页', 'failed', step2Result.message, 
                          step2Result.details || {});
        
        if (retryCount >= maxRetries) {
          await sendProgress('访问商品列表页', 'failed', 
                            `重试${maxRetries}次后仍被重定向到登录页`, 
                            '登录状态可能已失效，需要重新登录');
        }
        
        return step2Result;
      }
    }
    
    await wait(500);
    
    // ========== 步骤3: 点击"全部"标签 ==========
    await sendProgress('点击全部标签', 'success', '正在检查\'全部\'标签状态...');
    
    const step3Result = await clickAllTab(window);
    
    if (step3Result.skipped) {
      await sendProgress('点击全部标签', 'warning', step3Result.message, 
                        step3Result.details || {});
    } else if (step3Result.alreadySelected) {
      await sendProgress('点击全部标签', 'success', '\'全部\'标签已选中，无需点击', 
                        '检测到 aria-selected=\'true\'，直接进入下一步');
    } else if (step3Result.success) {
      await sendProgress('点击全部标签', 'success', '成功点击\'全部\'标签', 
                        '验证通过: aria-selected=\'true\'');
    } else {
      await sendProgress('点击全部标签', 'warning', step3Result.message, 
                        step3Result.details || {});
    }
    
    await wait(500);
    
    // ========== 步骤4: 点击"导出查询商品"按钮 ==========
    await sendProgress('点击导出按钮', 'success', '正在查找\'导出查询商品\'按钮...');
    
    const step4Result = await clickExportButton(window);
    
    if (!step4Result.success) {
      await sendProgress('点击导出按钮', 'failed', step4Result.message, 
                        step4Result.details || {});
      return step4Result;
    }
    
    await sendProgress('点击导出按钮', 'success', '成功点击\'导出查询商品\'按钮', 
                      `定位方式: ${step4Result.details.method || '未知'}`);
    await wait(500);
    
    // ========== 步骤5: 点击确认导出 ==========
    await sendProgress('点击确认导出', 'success', '正在查找抽屉中的\'导出\'确认按钮...');
    
    const step5Result = await confirmExport(window);
    
    if (!step5Result.success) {
      await sendProgress('点击确认导出', 'failed', step5Result.message, 
                        step5Result.details || {});
      return step5Result;
    }
    
    await sendProgress('点击确认导出', 'success', '成功点击\'导出\'确认按钮', 
                      `按钮文本: ${step5Result.details.buttonText || '导出'}`);
    await wait(500);
    
    // ========== 步骤6: 下载Excel文件 ==========
    await sendProgress('下载Excel文件', 'success', '正在下载商品Excel文件...', 
                      '等待导出任务完成并下载文件');
    
    const step6Result = await downloadExcel(window, { downloadPath });
    
    if (!step6Result.success) {
      await sendProgress('下载Excel文件', 'failed', step6Result.message, 
                        step6Result.details || {});
      return step6Result;
    }
    
    const filepath = step6Result.filepath;
    const latestExportTime = step6Result.latestExportTime;
    
    await sendProgress('下载Excel文件', 'success', 'Excel文件下载成功', 
                      `文件路径: ${filepath}\n最新导出时间: ${latestExportTime}`);
    await wait(500);
    
    // ========== 步骤7: 跳过解析（由后端处理） ==========
    // 前端不再解析Excel，直接上传给后端
    // 后端使用统一的解析逻辑，确保100%一致
    console.log(`\n[步骤7] 跳过前端解析，将由后端统一处理`);
    console.log(`  → Excel文件: ${filepath}`);
    console.log(`  → 后端将使用 ProductScraper.parse_product_excel() 解析`);
    
    await wait(500);
    
    // ========== 步骤8: 保存到数据库 ==========
    await sendProgress('保存到数据库', 'success', `正在上传Excel文件到后端...`);
    
    // 定义数据库保存的进度回调
    const dbProgressCallback = async (progressInfo) => {
      await sendProgress('保存到数据库', 'success', 
                        `已保存 ${progressInfo.current}/${progressInfo.total} 个商品`, 
                        `新增: ${progressInfo.saved}, 更新: ${progressInfo.updated}`);
    };
    
    // 直接上传Excel文件，让后端解析和保存
    const step8Result = await saveToDatabase(shopId, filepath, {
      apiBaseUrl,
      token,
      progressCallback: dbProgressCallback
    });
    
    if (!step8Result.success) {
      await sendProgress('保存到数据库', 'failed', step8Result.message, 
                        step8Result.details || {});
      return step8Result;
    }
    
    const savedCount = step8Result.savedCount;
    const updatedCount = step8Result.updatedCount;
    const productCount = step8Result.details.total || 0;
    
    await sendProgress('保存到数据库', 'success', '商品保存完成', 
                      `新增 ${savedCount} 个, 更新 ${updatedCount} 个`);
    await wait(500);
    
    // ========== 清理：删除下载的Excel文件 ==========
    console.log(`\n[清理] 删除临时Excel文件...`);
    console.log(`  → 文件路径: ${filepath}`);
    
    try {
      const fs = require('fs');
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`  ✓ 文件已删除`);
      } else {
        console.log(`  ⚠ 文件不存在，无需删除`);
      }
    } catch (error) {
      console.warn(`  ⚠ 删除文件失败: ${error.message}`);
      // 删除失败不影响整体流程
    }
    
    // ========== 完成 ==========
    await sendProgress('完成', 'success', '商品同步流程全部完成', 
                      `总计: ${productCount} 个商品\n最新导出时间: ${latestExportTime}`);
    
    return {
      success: true,
      message: `商品同步完成，总计 ${productCount} 个商品`,
      totalProducts: productCount,
      savedCount,
      updatedCount,
      latestExportTime,
      details: {
        shopId,
        shopName,
        total: productCount,
        saved: savedCount,
        updated: updatedCount,
        failed: step8Result.failedCount || 0,
        latestExportTime
      }
    };
    
  } catch (error) {
    console.error(`✗ 商品同步失败: ${error.message}`);
    console.error(error.stack);
    
    await sendProgress('异常', 'failed', '发生未预期的错误', error.message);
    
    return {
      success: false,
      message: `商品同步失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  executeProductSync
};
