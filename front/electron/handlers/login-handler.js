const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { setupProtocolBlocker } = require('../utils/protocol-blocker');
const { getShopInfoExtractionScript } = require('../utils/shop-info-extractor');

/**
 * 注册登录相关的 IPC 处理器
 * @param {IpcMain} ipcMain - Electron IPC Main 对象
 */
function registerLoginHandlers(ipcMain) {
  // 监听打开抖店登录窗口事件
  ipcMain.handle('open-douyin-login', async (event, accountId) => {
    return new Promise(async (resolve) => {
      // ✅ 使用临时持久化 partition，登录成功后复制为最终的店铺partition
      // 这样可以保证浏览器指纹一致性
      const timestamp = Date.now();
      const tempPartitionName = `persist:douyin-shop-temp-${timestamp}`;
      
      console.log('[Electron Login] 创建临时持久化登录窗口');
      console.log('[Electron Login] Account ID:', accountId);
      console.log('[Electron Login] Temp Partition:', tempPartitionName);
      console.log('[Electron Login] 登录成功后将复制为: persist:douyin-shop-${shopId}');
      
      // ✅ 清理临时 session 的所有缓存，确保是全新环境
      try {
        const { session } = require('electron');
        const tempSession = session.fromPartition(tempPartitionName);
        
        console.log('[Electron Login] 清理临时 session 缓存...');
        
        // 清除所有缓存
        await tempSession.clearCache();
        console.log('[Electron Login] ✓ 缓存已清除');
        
        // 清除所有 Cookie
        await tempSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage']
        });
        console.log('[Electron Login] ✓ 存储数据已清除');
        
        console.log('[Electron Login] ✓ 临时 session 已完全清理，确保全新环境');
      } catch (cleanError) {
        console.warn('[Electron Login] ⚠ 清理缓存失败（可能是首次使用）:', cleanError.message);
      }
      
      // 创建登录窗口 - 使用临时持久化 partition（带 persist: 前缀）
      const loginWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          partition: tempPartitionName, // ✅ 临时持久化partition，登录成功后复制
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false,
          enableRemoteModule: false,
          navigateOnDragDrop: false,
          safeDialogs: true,
          safeDialogsMessage: '阻止此页面创建更多对话框'
        },
        title: '抖店登录'
      });

      // 设置协议拦截
      setupProtocolBlocker(loginWindow, 'Electron Login');

      // 加载抖店登录页面
      loginWindow.loadURL('https://fxg.jinritemai.com/login');

      let checkInterval;
      let hasResolved = false;

      // 定期检查是否登录成功
      checkInterval = setInterval(async () => {
        if (hasResolved) {
          clearInterval(checkInterval);
          return;
        }

        try {
          const url = loginWindow.webContents.getURL();
          
          // 检查是否登录成功（不在登录页面了）
          if (url.includes('fxg.jinritemai.com') && !url.includes('/login')) {
            hasResolved = true;
            clearInterval(checkInterval);

            console.log('[Electron Login] 检测到登录成功，URL:', url);

            // 等待页面完全加载并多次尝试提取店铺信息
            let shopInfo = null;
            const maxRetries = 5; // 最多尝试5次
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              console.log(`[Electron Login] 第 ${attempt} 次尝试提取店铺信息...`);
              
              // 等待页面加载
              await new Promise(r => setTimeout(r, 2000 * attempt)); // 递增等待时间
              
              try {
                shopInfo = await loginWindow.webContents.executeJavaScript(
                  getShopInfoExtractionScript()
                );
                
                console.log(`[Electron Login] 第 ${attempt} 次提取结果:`, shopInfo);
                
                // 检查是否成功获取到有效的店铺信息
                if (shopInfo && shopInfo.shopId && shopInfo.shopId !== '') {
                  console.log('[Electron Login] ✓ 成功获取店铺信息:', shopInfo);
                  break; // 成功获取，跳出循环
                } else {
                  console.warn(`[Electron Login] ⚠ 第 ${attempt} 次提取失败，店铺信息不完整`);
                  shopInfo = null;
                }
              } catch (scriptError) {
                console.warn(`[Electron Login] ⚠ 第 ${attempt} 次脚本执行失败:`, scriptError.message);
                shopInfo = null;
              }
              
              // 如果不是最后一次尝试，继续等待
              if (attempt < maxRetries && !shopInfo) {
                console.log(`[Electron Login] 等待后重试...`);
              }
            }
            
            // 如果所有尝试都失败，使用备用方案从 Cookie 提取
            if (!shopInfo || !shopInfo.shopId) {
              console.warn('[Electron Login] ⚠ 所有尝试都失败，使用备用方案从 Cookie 提取');
              
              try {
                const { session } = require('electron');
                const tempSession = session.fromPartition(tempPartitionName);
                const cookies = await tempSession.cookies.get({});
                
                console.log('[Electron Login] 可用的 Cookies:', cookies.map(c => c.name).join(', '));
                
                // 尝试从多个可能的 cookie 中找到店铺 ID
                const shopIdCookie = cookies.find(c => 
                  c.name === 'ecom_gray_shop_id' || 
                  c.name === 'shop_id' || 
                  c.name === 'shopId'
                );
                
                if (shopIdCookie) {
                  shopInfo = {
                    shopId: shopIdCookie.value,
                    shopName: `抖店_${shopIdCookie.value.substring(0, 8)}`
                  };
                  console.log('[Electron Login] ✓ 从 Cookie 获取到店铺信息:', shopInfo);
                } else {
                  console.error('[Electron Login] ✗ Cookie 中也没有找到店铺 ID');
                  shopInfo = null;
                }
              } catch (cookieError) {
                console.error('[Electron Login] ✗ 从 Cookie 提取失败:', cookieError);
                shopInfo = null;
              }
            }

            // 如果最终还是没有获取到店铺信息，返回失败
            if (!shopInfo || !shopInfo.shopId) {
              console.error('[Electron Login] ✗ 无法获取店铺信息，登录失败');
              
              // 关闭登录窗口
              if (!loginWindow.isDestroyed()) {
                loginWindow.close();
              }
              
              resolve({
                success: false,
                message: '无法获取店铺信息，请稍后重试。建议：两次添加店铺之间间隔30秒以上'
              });
              return;
            }

            // ✅ 登录成功后，保存店铺和 partition 的映射关系
            const shopId = shopInfo ? shopInfo.shopId : null;
            let persistDetails = null;
            
            if (shopId) {
              console.log('\n========== [Electron Login] 保存映射关系 ==========');
              console.log('[Electron Login] 店铺ID:', shopId);
              console.log('[Electron Login] Partition:', tempPartitionName);
              
              // 保存映射关系到 JSON 文件
              const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
              
              // 读取现有映射
              let mappings = {};
              if (fs.existsSync(mappingFilePath)) {
                try {
                  const content = fs.readFileSync(mappingFilePath, 'utf-8');
                  mappings = JSON.parse(content);
                } catch (e) {
                  console.warn('[Electron Login] ⚠ 读取映射文件失败，将创建新文件');
                }
              }
              
              // 添加新映射
              mappings[shopId] = {
                shopId: shopId,
                shopName: shopInfo.shopName,
                partitionName: tempPartitionName,
                loginTime: new Date().toISOString()
              };
              
              // 保存映射文件
              fs.writeFileSync(mappingFilePath, JSON.stringify(mappings, null, 2), 'utf-8');
              console.log('[Electron Login] ✓ 映射关系已保存:', mappingFilePath);
              
              // 关闭登录窗口
              console.log('[Electron Login] 关闭登录窗口...');
              loginWindow.close();
              
              persistDetails = {
                partitionName: tempPartitionName,
                mappingFilePath: mappingFilePath,
                note: '使用临时 partition，映射关系已保存'
              };
              
              console.log('========== [Electron Login] 映射关系保存完成 ==========\n');
            }

            console.log('\n========== [Electron Login] 准备返回结果 ==========');
            console.log('[Electron Login] 店铺ID:', shopInfo.shopId);
            console.log('[Electron Login] 店铺名称:', shopInfo.shopName);
            console.log('[Electron Login] ✅ 登录状态已保存');
            if (persistDetails) {
              console.log('[Electron Login] Partition:', persistDetails.partitionName);
              console.log('[Electron Login] 映射文件:', persistDetails.mappingFilePath);
            }
            console.log('========== [Electron Login] 返回结果准备完成 ==========\n');
            
            console.log('[Electron Login] ✓ 返回结果到渲染进程');
            resolve({
              success: true,
              shopInfo: shopInfo,
              message: '登录成功，状态已保存到本地',
              persistPartition: tempPartitionName,
              persistDetails: persistDetails
            });
          }
        } catch (error) {
          console.error('[Electron Login] 检查登录状态失败:', error);
        }
      }, 2000); // 每2秒检查一次

      // 窗口关闭事件
      loginWindow.on('closed', () => {
        console.log('[Electron Login] 登录窗口已关闭');
        
        if (!hasResolved) {
          hasResolved = true;
          clearInterval(checkInterval);
          console.log('[Electron Login] 用户关闭了登录窗口');
          resolve({
            success: false,
            message: '用户关闭了登录窗口'
          });
        }
      });

      // 30分钟超时
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          clearInterval(checkInterval);
          if (!loginWindow.isDestroyed()) {
            loginWindow.close();
          }
          console.log('[Electron Login] 登录超时');
          resolve({
            success: false,
            message: '登录超时'
          });
        }
      }, 30 * 60 * 1000);
    });
  });
}

module.exports = {
  registerLoginHandlers
};
