const { BrowserWindow } = require('electron');

/**
 * 注册商品同步相关的 IPC 处理器
 * @param {IpcMain} ipcMain - Electron IPC Main 对象
 */
function registerSyncHandlers(ipcMain) {
  /**
   * 执行商品同步（使用 Electron BrowserWindow，支持重试机制）
   */
  ipcMain.handle('execute-product-sync', async (event, params) => {
    console.log('\n[商品同步] 收到同步请求');
    console.log('[商品同步] 参数:', JSON.stringify(params, null, 2));

    const {
      shopId,
      shopName,
      token
    } = params;

    // 验证参数
    if (!shopId || !shopName || !token) {
      console.error('[商品同步] 参数不完整');
      return {
        success: false,
        message: '参数不完整：缺少shopId、shopName或token'
      };
    }

    // 重试配置
    const MAX_RETRIES = 3; // 最多重试3次
    let currentAttempt = 0;
    let lastError = null;
    let syncWindow = null;

    // 重试循环
    while (currentAttempt < MAX_RETRIES) {
      currentAttempt++;
      
      try {
        console.log(`\n[商品同步] 第 ${currentAttempt}/${MAX_RETRIES} 次尝试`);
        
        // 如果是重试，先发送重试通知
        if (currentAttempt > 1) {
          if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('product-sync-progress', {
              step: '重试',
              status: 'warning',
              message: `第 ${currentAttempt} 次尝试同步`,
              details: `上次失败原因: ${lastError}`,
              timestamp: new Date().toISOString()
            });
          }
          
          // 重试前等待3秒
          console.log('[商品同步] 等待3秒后重试...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // ✅ 从映射文件读取实际的 partition 名称
        console.log('[商品同步] 读取 partition 映射...');
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');
        
        const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
        console.log('[商品同步] 映射文件路径:', mappingFilePath);
        
        let partitionName = `persist:douyin-shop-${shopId}`; // 默认值（兼容旧版）
        
        if (fs.existsSync(mappingFilePath)) {
          try {
            const mappingContent = fs.readFileSync(mappingFilePath, 'utf-8');
            const mappings = JSON.parse(mappingContent);
            
            if (mappings[shopId]) {
              partitionName = mappings[shopId].partitionName;
              console.log('[商品同步] ✓ 找到映射:', partitionName);
            } else {
              console.warn('[商品同步] ⚠ 未找到店铺映射，使用默认 partition');
            }
          } catch (e) {
            console.error('[商品同步] ✗ 读取映射文件失败:', e.message);
            console.warn('[商品同步] 使用默认 partition');
          }
        } else {
          console.warn('[商品同步] ⚠ 映射文件不存在，使用默认 partition');
        }

        // 创建同步窗口（使用已登录的session）
        console.log('[商品同步] 创建同步窗口...');
        console.log('[商品同步] 使用持久化 Partition:', partitionName);
        
        syncWindow = new BrowserWindow({
          width: 1400,
          height: 900,
          show: false, // 后台执行，不显示窗口
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            // 使用持久化session（包含登录状态）
            partition: partitionName
          }
        });

        // ✅ 设置协议拦截（阻止 bytedance:// 等协议弹窗）
        const { setupProtocolBlocker } = require('../utils/protocol-blocker');
        setupProtocolBlocker(syncWindow, '商品同步');

        // 验证持久化数据是否存在（不加载页面，只检查 session）
        console.log('[商品同步] 验证持久化数据...');
        const session = syncWindow.webContents.session;
        const cookies = await session.cookies.get({});
        console.log('[商品同步] 从持久化 session 加载到 Cookie 数量:', cookies.length);
        
        // 检查关键 Cookie
        const keyCookieNames = ['sessionid', 'uid_tt', 'sid_tt', 'passport_csrf_token'];
        console.log('[商品同步] 关键 Cookie 检查:');
        keyCookieNames.forEach(name => {
          const exists = cookies.some(c => c.name === name);
          console.log(`[商品同步]   ${exists ? '✓' : '✗'} ${name}`);
        });

        // 设置窗口标题
        syncWindow.setTitle(`商品同步 - ${shopName}`);

        // 导入商品同步模块
        const { executeProductSyncWithBrowserWindow } = require('../product-sync');

        // 执行同步
        console.log('[商品同步] 开始执行同步...');
        
        const result = await executeProductSyncWithBrowserWindow(
          syncWindow,
          {
            shopId,
            shopName,
            apiBaseUrl: 'http://123.56.44.206/api/v1',
            token,
            downloadPath: null // 使用默认下载路径
          },
          async (progress) => {
            // 进度回调：通过IPC发送到渲染进程
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('product-sync-progress', progress);
            }
          }
        );

        console.log('[商品同步] 同步完成');
        console.log('[商品同步] 结果:', JSON.stringify(result, null, 2));

        // 同步完成后，延迟3秒关闭窗口
        setTimeout(() => {
          if (syncWindow && !syncWindow.isDestroyed()) {
            syncWindow.close();
            console.log('[商品同步] 窗口已关闭');
          }
        }, 3000);

        // 如果成功，直接返回结果
        if (result.success) {
          console.log(`[商品同步] ✓ 第 ${currentAttempt} 次尝试成功`);
          return result;
        } else {
          // 如果失败，记录错误并继续重试
          lastError = result.message || '未知错误';
          console.log(`[商品同步] ✗ 第 ${currentAttempt} 次尝试失败: ${lastError}`);
          
          // 关闭失败的窗口
          if (syncWindow && !syncWindow.isDestroyed()) {
            syncWindow.close();
          }
          
          // 如果还有重试机会，继续循环
          if (currentAttempt < MAX_RETRIES) {
            console.log(`[商品同步] 准备第 ${currentAttempt + 1} 次重试...`);
            continue;
          } else {
            // 已达到最大重试次数
            console.log(`[商品同步] ✗ 已达到最大重试次数 (${MAX_RETRIES}次)，同步失败`);
            return {
              success: false,
              message: `同步失败，已重试${MAX_RETRIES}次: ${lastError}`,
              attempts: currentAttempt,
              lastError
            };
          }
        }

      } catch (error) {
        lastError = error.message;
        console.error(`[商品同步] 第 ${currentAttempt} 次尝试异常:`, error);
        console.error(error.stack);
        
        // 关闭异常的窗口
        if (syncWindow && !syncWindow.isDestroyed()) {
          try {
            syncWindow.close();
          } catch (e) {
            console.error('[商品同步] 关闭窗口失败:', e);
          }
        }
        
        // 如果还有重试机会，继续循环
        if (currentAttempt < MAX_RETRIES) {
          console.log(`[商品同步] 准备第 ${currentAttempt + 1} 次重试...`);
          continue;
        } else {
          // 已达到最大重试次数
          console.log(`[商品同步] ✗ 已达到最大重试次数 (${MAX_RETRIES}次)，同步失败`);
          return {
            success: false,
            message: `同步失败，已重试${MAX_RETRIES}次: ${lastError}`,
            attempts: currentAttempt,
            lastError
          };
        }
      }
    }

    // 理论上不会到这里，但为了安全还是返回失败
    return {
      success: false,
      message: `同步失败，已重试${MAX_RETRIES}次: ${lastError}`,
      attempts: currentAttempt,
      lastError
    };
  });

  console.log('[Main] 商品同步IPC处理器已注册');
}

module.exports = {
  registerSyncHandlers
};
