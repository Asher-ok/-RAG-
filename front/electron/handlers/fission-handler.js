const { BrowserWindow } = require('electron');
const { setupProtocolBlocker } = require('../utils/protocol-blocker');

// 存储裂变窗口
let fissionWindows = new Map(); // taskId (优先) 或 accountId -> BrowserWindow
let app = null; // 保存 app 引用

// ✅ 存储任务取消状态
let cancelledTasks = new Map(); // taskId -> boolean

// ✅ 存储任务ID到账号ID的映射
let taskToAccount = new Map(); // taskId -> accountId

/**
 * 创建或获取裂变窗口（使用 Electron BrowserWindow）
 * @param {string} accountId - 账号ID
 * @param {string} taskId - 任务ID（可选，如果提供则支持多开）
 */
async function getFissionWindow(accountId, taskId = null) {
  // 确定窗口的键值：如果有taskId则使用taskId（支持多开），否则使用accountId（兼容旧版）
  const windowKey = taskId || accountId;
  
  // 如果已有窗口，直接返回
  if (fissionWindows.has(windowKey)) {
    const existingWindow = fissionWindows.get(windowKey);
    if (!existingWindow.isDestroyed()) {
      console.log(`[裂变] 使用已有窗口: ${windowKey} (Account: ${accountId})`);
      return existingWindow;
    } else {
      fissionWindows.delete(windowKey);
    }
  }

  console.log(`[裂变] 创建新窗口: ${windowKey} (Account: ${accountId})`);
  
  // ✅ 从映射文件读取实际的 partition 名称（和商品同步一样）
  const fs = require('fs');
  const path = require('path');
  
  const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
  console.log('[裂变] 映射文件路径:', mappingFilePath);
  
  let partitionName = `persist:douyin-shop-${accountId}`; // 默认值（兼容旧版）
  
  if (fs.existsSync(mappingFilePath)) {
    try {
      const mappingContent = fs.readFileSync(mappingFilePath, 'utf-8');
      const mappings = JSON.parse(mappingContent);
      
      if (mappings[accountId]) {
        partitionName = mappings[accountId].partitionName;
        console.log('[裂变] ✓ 找到映射:', partitionName);
      } else {
        console.warn('[裂变] ⚠ 未找到店铺映射，使用默认 partition');
      }
    } catch (e) {
      console.error('[裂变] ✗ 读取映射文件失败:', e.message);
      console.warn('[裂变] 使用默认 partition');
    }
  } else {
    console.warn('[裂变] ⚠ 映射文件不存在，使用默认 partition');
  }
  
  console.log('[裂变] 使用持久化partition:', partitionName);
  
  // 创建新的 BrowserWindow（后台运行模式）
  const fissionWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false, // ✅ 隐藏窗口，后台执行
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: partitionName, // ✅ 使用从映射文件读取的 partition
      webSecurity: true,
      navigateOnDragDrop: false,
      disableDialogs: true,
      safeDialogs: true,
      safeDialogsMessage: '阻止此页面创建更多对话框'
    },
    title: `裂变自动化 - ${accountId} - ${taskId || 'Default'}`
  });

  console.log('[裂变] ✅ 使用持久化partition，自动加载登录状态');
  console.log('[裂变] Partition:', partitionName);

  // 设置 User Agent
  fissionWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // 设置协议拦截
  setupProtocolBlocker(fissionWindow, '裂变窗口');

  // ❌ 不再需要手动恢复Cookie，持久化partition会自动加载
  console.log('[裂变] ✅ 登录状态已从持久化partition自动加载');
  
  // 保存窗口引用
  fissionWindows.set(windowKey, fissionWindow);

  // 窗口关闭时清理
  fissionWindow.on('closed', () => {
    fissionWindows.delete(windowKey);
    console.log(`[裂变] 窗口已关闭: ${windowKey}`);
  });

  return fissionWindow;
}

/**
 * 关闭裂变窗口
 * @param {string} key - 窗口键值（taskId 或 accountId）
 */
async function closeFissionWindow(key) {
  if (fissionWindows.has(key)) {
    const window = fissionWindows.get(key);
    if (!window.isDestroyed()) {
      window.close();
    }
    fissionWindows.delete(key);
    console.log(`[裂变] 已关闭窗口: ${key}`);
  }
}

/**
 * 关闭所有裂变窗口
 */
async function closeAllFissionWindows() {
  for (const [key, window] of fissionWindows.entries()) {
    try {
      if (!window.isDestroyed()) {
        window.close();
      }
      console.log(`[裂变] 已关闭窗口: ${key}`);
    } catch (error) {
      console.error(`[裂变] 关闭窗口失败: ${key}`, error);
    }
  }
  fissionWindows.clear();
  console.log('[裂变] 所有窗口已关闭');
}

/**
 * 注册裂变相关的 IPC 处理器
 * @param {IpcMain} ipcMain - Electron IPC Main 对象
 * @param {App} app - Electron App 对象
 */
function registerFissionHandlers(ipcMain, electronApp) {
  // 保存 app 引用供 getFissionWindow 使用
  app = electronApp;
  
  /**
   * 执行商品裂变（使用 Electron BrowserWindow）
   */
  ipcMain.handle('execute-fission', async (event, params) => {
    console.log('\n[裂变] 收到裂变请求');
    // console.log('[裂变] 参数:', JSON.stringify(params, null, 2)); // 避免日志过长
    console.log(`[裂变] TaskID: ${params.taskId}, AccountID: ${params.accountId}`);

    try {
      const {
        accountId,
        token,
        taskId,
        sourceProduct,
        count,
        priceFloatAmount,
        titleSuffix,
        titleReplacements,
        publishMode,
        coverImageFolder,
        mainImageFolder,
        detailImageFolder
      } = params;

      // 验证必需参数
      if (!accountId) {
        return {
          success: false,
          message: '缺少账号ID'
        };
      }
      
      // ✅ 强制检查 taskId
      if (!taskId) {
        console.warn('[裂变] ⚠️ 警告: 收到请求但缺少 TaskID，进度上报可能受影响');
      }

      if (!sourceProduct) {
        return {
          success: false,
          message: '缺少原商品信息'
        };
      }

      // ✅ 初始化任务取消状态
      if (taskId) {
        cancelledTasks.set(taskId, false);
        console.log(`[裂变] 初始化任务取消状态: ${taskId} = false`);
        
        // ✅ 记录任务ID到账号ID的映射
        taskToAccount.set(taskId, accountId);
        console.log(`[裂变] 记录任务映射: ${taskId} -> ${accountId}`);
      }

      // 获取或创建裂变窗口（使用持久化partition，自动加载登录状态）
      // ✅ 传入 taskId 以支持多开
      const fissionWindow = await getFissionWindow(accountId, taskId);
      console.log(`[裂变] ✅ 窗口已创建，登录状态自动从持久化partition加载 (TaskID: ${taskId})`);

      // 加载裂变执行器（Electron BrowserWindow版本）
      const { executeFissionWithBrowserWindow } = require('../automation-electron');

      // ✅ 创建进度回调函数（转发到渲染进程）
      const onProgressCallback = async (progress) => {
        // 转发进度到渲染进程
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('fission-progress', progress);
        }
      };

      // ✅ 创建取消状态检查函数
      const getCancelStatus = () => {
        if (!taskId) return false;
        const cancelled = cancelledTasks.get(taskId) || false;
        if (cancelled) {
          console.log(`[裂变] 检测到任务已取消: ${taskId}`);
        }
        return cancelled;
      };

      // 执行裂变（添加进度回调，转发到渲染进程）
      const result = await executeFissionWithBrowserWindow(
        fissionWindow, 
        {
          sourceProduct,
          count,
          priceFloatAmount,
          titleSuffix,
          titleReplacements,
          publishMode,
          coverImageFolder,
          mainImageFolder,
          detailImageFolder,
          taskId: params.taskId,
          token: params.token,
          getCancelStatus: getCancelStatus  // ✅ 传递取消状态检查函数
        },
        onProgressCallback, // ✅ 传递进度回调
        async (stepProgress) => {
          // ✅ 转发步骤进度到渲染进程（和商品同步一样）
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('fission-step-progress', stepProgress);
          }
        }
      );

      // ✅ 清理任务取消状态和映射
      if (taskId) {
        cancelledTasks.delete(taskId);
        taskToAccount.delete(taskId);
        console.log(`[裂变] 清理任务取消状态和映射: ${taskId}`);
      }

      console.log('[裂变] 执行完成:', result);
      return result;

    } catch (error) {
      console.error('[裂变] 执行失败:', error);
      return {
        success: false,
        message: `裂变失败: ${error.message}`
      };
    }
  });

  /**
   * ✅ 取消裂变任务
   */
  ipcMain.handle('cancel-fission-task', async (event, taskId) => {
    console.log(`\n[裂变] 收到取消任务请求: ${taskId}`);
    
    if (!taskId) {
      return {
        success: false,
        message: '缺少任务ID'
      };
    }
    
    // 设置取消标志
    cancelledTasks.set(taskId, true);
    console.log(`[裂变] ✅ 已设置任务取消标志: ${taskId} = true`);
    
    // ✅ 查找对应的账号ID并关闭窗口
    // 优先尝试直接通过 taskId 关闭窗口
    if (fissionWindows.has(taskId)) {
      console.log(`[裂变] 直接通过TaskId关闭窗口: ${taskId}`);
      closeFissionWindow(taskId);
    } else {
      // 兼容旧逻辑：通过 accountId 关闭（如果窗口是按 accountId 索引的）
      const accountId = taskToAccount.get(taskId);
      if (accountId) {
        console.log(`[裂变] 找到任务对应的账号: ${accountId}`);
        
        // 关闭对应的裂变窗口
        if (fissionWindows.has(accountId)) {
          console.log(`[裂变] 🔴 强制关闭隐藏的裂变窗口(Legacy): ${accountId}`);
          closeFissionWindow(accountId);
        } else {
          console.warn(`[裂变] ⚠️ 未找到账号对应的窗口: ${accountId}`);
        }
      } else {
        console.warn(`[裂变] ⚠️ 未找到任务对应的窗口或账号ID: ${taskId}`);
      }
    }
    
    // 清理映射
    if (taskToAccount.has(taskId)) {
      taskToAccount.delete(taskId);
    }
    
    return {
      success: true,
      message: '任务取消信号已发送，窗口已关闭'
    };
  });

  /**
   * 关闭裂变浏览器
   */
  ipcMain.handle('close-fission-browser', async () => {
    console.log('[裂变] 收到关闭浏览器请求');
    try {
      await closeAllFissionWindows();
      return { success: true };
    } catch (error) {
      console.error('[裂变] 关闭浏览器失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });

  // 应用退出时清理资源
  app.on('before-quit', async () => {
    console.log('[裂变] 应用退出，清理资源...');
    await closeAllFissionWindows();
  });
}

module.exports = {
  registerFissionHandlers,
  getFissionWindow,
  closeFissionWindow,
  closeAllFissionWindows
};
