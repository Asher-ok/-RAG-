/**
 * 步骤6: 下载Excel文件
 * 
 * 功能：
 * 1. 等待导出任务完成
 * 2. 查找最新的导出记录
 * 3. 点击下载按钮
 * 4. 等待文件下载完成
 * 5. 返回文件路径
 * 
 * 注意：
 * - 需要等待导出任务完成（状态变为"已完成"）
 * - 下载的文件保存在用户的下载目录
 * - 需要监听 Electron 的下载事件
 */

const path = require('path');
const fs = require('fs');

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
 * 下载Excel文件
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} options - 选项
 * @param {string} options.downloadPath - 下载目录路径（可选）
 * @returns {Promise<{success: boolean, message?: string, filepath?: string, latestExportTime?: string, details?: Object}>}
 */
async function downloadExcel(window, options = {}) {
  const { downloadPath } = options;
  
  console.log(`\n========== [步骤6] 下载Excel文件 ==========`);
  
  try {
    // 6.1 检查最新导出记录
    console.log(`[步骤6.1] 检查最新导出记录...`);
    
    // 检查最新记录
    const taskStatus = await executeJS(window, `
      (function() {
        // 查找第一行
        const rows = document.querySelectorAll('.ecom-g-table-row');
        if (rows.length === 0) {
          return { found: false, reason: '未找到导出记录' };
        }
        
        const firstRow = rows[0];
        const cells = firstRow.querySelectorAll('.ecom-g-table-cell');
        
        // 获取时间（第一列）
        const timeText = cells[0] ? cells[0].textContent.trim() : '';
        
        // 查找状态
        let statusText = '';
        for (const cell of cells) {
          const text = cell.textContent.trim();
          if (text.includes('已完成') || text.includes('导出中') || text.includes('失败')) {
            statusText = text;
            break;
          }
        }
        
        return {
          found: true,
          status: statusText,
          time: timeText
        };
      })()
    `);
    
    if (!taskStatus.found) {
      console.log(`  ✗ ${taskStatus.reason}`);
      return {
        success: false,
        message: taskStatus.reason
      };
    }
    
    console.log(`  → 最新记录时间: ${taskStatus.time}`);
    console.log(`  → 任务状态: ${taskStatus.status || '未知'}`);
    
    // 检查是否失败
    if (taskStatus.status && taskStatus.status.includes('失败')) {
      console.log(`  ✗ 导出任务失败`);
      return {
        success: false,
        message: '导出任务失败',
        details: taskStatus
      };
    }
    
    // 检查记录时间是否在 20 分钟以内
    let canDownload = false;
    let isWithin20Minutes = false;
    
    if (taskStatus.time) {
      try {
        // 解析时间 (格式: 2026-02-02 19:58:53)
        const recordTime = new Date(taskStatus.time.replace(' ', 'T'));
        const now = new Date();
        const diffMinutes = (now - recordTime) / 1000 / 60;
        
        console.log(`  → 记录时间距今: ${diffMinutes.toFixed(1)} 分钟`);
        
        if (diffMinutes <= 20) {
          console.log(`  ✓ 记录时间在 20 分钟以内，可以下载`);
          isWithin20Minutes = true;
          canDownload = true;
        } else {
          console.log(`  ⚠ 记录时间超过 20 分钟`);
          console.log(`  → 容错机制：将下载第一条记录`);
          canDownload = true;
        }
      } catch (e) {
        console.warn(`  ⚠ 无法解析时间: ${e.message}`);
        console.log(`  → 容错机制：将下载第一条记录`);
        canDownload = true;
      }
    } else {
      console.warn(`  ⚠ 未找到记录时间`);
      console.log(`  → 容错机制：将下载第一条记录`);
      canDownload = true;
    }
    
    if (!canDownload) {
      console.log(`  ✗ 无法下载`);
      return {
        success: false,
        message: '无法下载导出记录'
      };
    }
    
    // 6.2 查找下载按钮并点击
    console.log(`\n[步骤6.2] 查找下载按钮...`);
    
    // 设置下载监听
    let downloadFilePath = null;
    let downloadCompleted = false;
    
    const session = window.webContents.session;
    
    session.once('will-download', (event, item, webContents) => {
      console.log(`  → 开始下载: ${item.getFilename()}`);
      
      // 设置保存路径
      const filename = item.getFilename();
      const savePath = downloadPath 
        ? path.join(downloadPath, filename)
        : path.join(require('os').tmpdir(), filename);
      
      item.setSavePath(savePath);
      
      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          console.log(`  ⚠ 下载中断`);
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            console.log(`  ⚠ 下载暂停`);
          } else {
            const received = item.getReceivedBytes();
            const total = item.getTotalBytes();
            const percent = total > 0 ? Math.floor((received / total) * 100) : 0;
            console.log(`  → 下载进度: ${percent}% (${received}/${total} 字节)`);
          }
        }
      });
      
      item.once('done', (event, state) => {
        if (state === 'completed') {
          console.log(`  ✓ 下载完成: ${savePath}`);
          downloadFilePath = savePath;
          downloadCompleted = true;
        } else {
          console.log(`  ✗ 下载失败: ${state}`);
        }
      });
    });
    
    // 点击下载按钮
    const downloadResult = await executeJS(window, `
      (function() {
        // 查找第一行的下载按钮
        const rows = document.querySelectorAll('.ecom-g-table-row');
        if (rows.length === 0) {
          return { found: false, reason: '未找到导出记录' };
        }
        
        const firstRow = rows[0];
        
        // 查找"下载"按钮或链接
        const downloadButtons = firstRow.querySelectorAll('button, a');
        for (const btn of downloadButtons) {
          const text = btn.textContent.trim();
          if (text === '下载' || text.includes('下载')) {
            console.log('[下载] 找到下载按钮，准备点击');
            btn.click();
            console.log('[下载] 点击完成');
            return { found: true, clicked: true };
          }
        }
        
        return { found: false, reason: '未找到下载按钮' };
      })()
    `);
    
    if (!downloadResult.found) {
      console.log(`  ✗ ${downloadResult.reason}`);
      return {
        success: false,
        message: downloadResult.reason,
        details: downloadResult
      };
    }
    
    console.log(`  ✓ 已点击下载按钮`);
    
    // 6.3 等待下载完成
    console.log(`\n[步骤6.3] 等待下载完成...`);
    
    let waitTime = 0;
    const maxWaitTime = 30000; // 最多等待30秒
    
    while (!downloadCompleted && waitTime < maxWaitTime) {
      await wait(1000);
      waitTime += 1000;
    }
    
    if (!downloadCompleted) {
      console.log(`  ✗ 下载超时`);
      return {
        success: false,
        message: '下载超时'
      };
    }
    
    // 6.4 验证文件
    console.log(`\n[步骤6.4] 验证文件...`);
    
    if (!fs.existsSync(downloadFilePath)) {
      console.log(`  ✗ 文件不存在`);
      console.log(`  → 路径: ${downloadFilePath}`);
      
      return {
        success: false,
        message: '文件下载后不存在',
        details: {
          filepath: downloadFilePath,
          exists: false
        }
      };
    }
    
    const fileSize = fs.statSync(downloadFilePath).size;
    console.log(`  ✓ 文件存在`);
    console.log(`  → 文件路径: ${downloadFilePath}`);
    console.log(`  → 文件大小: ${fileSize} 字节 (${(fileSize / 1024).toFixed(2)} KB)`);
    
    if (fileSize === 0) {
      console.log(`  ✗ 文件为空`);
      
      return {
        success: false,
        message: '下载的文件为空',
        details: {
          filepath: downloadFilePath,
          fileSize: 0
        }
      };
    }
    
    // 获取最新导出时间
    const latestExportTime = await executeJS(window, `
      (function() {
        const rows = document.querySelectorAll('.ecom-g-table-row');
        if (rows.length > 0) {
          const firstCell = rows[0].querySelector('.ecom-g-table-cell');
          return firstCell ? firstCell.textContent.trim() : '未知';
        }
        return '未知';
      })()
    `);
    
    console.log(`========== [步骤6] 完成 ==========\n`);
    
    return {
      success: true,
      message: 'Excel文件下载成功',
      filepath: downloadFilePath,
      latestExportTime,
      details: {
        filepath: downloadFilePath,
        fileSize,
        latestExportTime
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 下载Excel文件失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `下载失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  downloadExcel
};
