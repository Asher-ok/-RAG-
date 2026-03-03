/**
 * 外部协议拦截器
 * 用于阻止 bytedance://、snssdk:// 等外部协议弹窗
 */

// ✅ 使用模块级 Set 记录已初始化的 Partition，避免重复注册导致错误
const initializedPartitions = new Set();

/**
 * 为窗口设置协议拦截
 * @param {BrowserWindow} window - Electron 窗口对象
 * @param {string} windowName - 窗口名称（用于日志）
 */
function setupProtocolBlocker(window, windowName = '窗口') {
  // 1. 阻止新窗口打开（包括 window.open）
  window.webContents.setWindowOpenHandler((details) => {
    // 如果是外部协议，直接拒绝
    if (!details.url.startsWith('https://') && !details.url.startsWith('http://')) {
      console.log(`[${windowName}] 阻止外部协议新窗口:`, details.url);
    }
    return { action: 'deny' };
  });

  // 2. 阻止所有非HTTPS的协议（如 bytedance://、snssdk://等）
  window.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    
    // 阻止所有非HTTPS/HTTP/FILE协议
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'file:') {
      console.log(`[${windowName}] 阻止导航到外部协议:`, url);
      event.preventDefault();
      return;
    }
  });

  // 3. 监听并阻止所有非http/https协议
  window.webContents.on('will-redirect', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      console.log(`[${windowName}] 阻止协议重定向:`, url);
      event.preventDefault();
    }
  });

  // 4. 注入JavaScript代码，在页面级别阻止外部协议调用
  window.webContents.on('did-finish-load', () => {
    window.webContents.executeJavaScript(`
      (function() {
        // 拦截 window.location 的修改
        const originalLocationSetter = Object.getOwnPropertyDescriptor(window, 'location').set;
        Object.defineProperty(window, 'location', {
          set: function(value) {
            const url = String(value);
            if (!url.startsWith('https://') && !url.startsWith('http://')) {
              console.log('[页面拦截] 阻止location跳转:', url);
              return;
            }
            originalLocationSetter.call(window, value);
          },
          get: function() {
            return window.location;
          }
        });
        
        // 拦截 window.open
        const originalOpen = window.open;
        window.open = function(url, ...args) {
          if (url && !url.startsWith('https://') && !url.startsWith('http://')) {
            console.log('[页面拦截] 阻止window.open:', url);
            return null;
          }
          return originalOpen.call(window, url, ...args);
        };
        
        // 拦截所有 <a> 标签点击
        document.addEventListener('click', function(e) {
          let target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentElement;
          }
          
          if (target && target.tagName === 'A') {
            const href = target.getAttribute('href');
            if (href && !href.startsWith('https://') && !href.startsWith('http://') && !href.startsWith('#') && !href.startsWith('/')) {
              console.log('[页面拦截] 阻止链接点击:', href);
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }
        }, true);
      })();
    `).catch(err => {
      // 忽略注入失败，可能是页面已关闭
    });
  });
  
  // 5. ✅ 恢复 Session 级别的协议注册（registerStringProtocol）
  // 原因：Electron 的 registerStringProtocol 是拦截自定义协议（如 bytedance://）最根本的方法，
  // 它可以阻止系统弹出"打开外部应用"的对话框。
  // 为了避免多窗口冲突，我们使用 initializedPartitions 确保每个 Partition 只注册一次。
  // 注意：我们只恢复 registerStringProtocol，不恢复 webRequest.onBeforeRequest（那个会导致冲突）。
  
  const session = window.webContents.session;
  
  // 获取当前窗口的 partition 名称
  let partitionName = 'default';
  try {
    const webPreferences = window.webContents.getWebPreferences();
    if (webPreferences && webPreferences.partition) {
      partitionName = webPreferences.partition;
    }
  } catch (e) {
    console.warn(`[${windowName}] 获取 partition 失败:`, e);
  }
  
  // 检查是否已初始化
  if (initializedPartitions.has(partitionName)) {
    console.log(`[${windowName}] Partition [${partitionName}] 协议处理器已注册，跳过`);
  } else {
    console.log(`[${windowName}] 注册协议处理器 (Partition: ${partitionName})...`);
    
    // 注册 bytedance:// 协议处理器
    try {
      if (!session.protocol.isProtocolHandled('bytedance')) {
        session.protocol.registerStringProtocol('bytedance', (request, callback) => {
          console.log(`[${windowName}] 拦截 bytedance:// 协议:`, request.url);
          callback(''); // 返回空内容
        });
        console.log(`[${windowName}] 已注册 bytedance:// 协议处理器`);
      }
    } catch (e) {
      console.log(`[${windowName}] 注册 bytedance:// 协议失败:`, e.message);
    }
    
    // 注册 snssdk:// 协议处理器
    try {
      if (!session.protocol.isProtocolHandled('snssdk')) {
        session.protocol.registerStringProtocol('snssdk', (request, callback) => {
          console.log(`[${windowName}] 拦截 snssdk:// 协议:`, request.url);
          callback('');
        });
        console.log(`[${windowName}] 已注册 snssdk:// 协议处理器`);
      }
    } catch (e) {
      console.log(`[${windowName}] 注册 snssdk:// 协议失败:`, e.message);
    }
    
    // 注册 aweme:// 协议处理器
    try {
      if (!session.protocol.isProtocolHandled('aweme')) {
        session.protocol.registerStringProtocol('aweme', (request, callback) => {
          console.log(`[${windowName}] 拦截 aweme:// 协议:`, request.url);
          callback('');
        });
        console.log(`[${windowName}] 已注册 aweme:// 协议处理器`);
      }
    } catch (e) {
      console.log(`[${windowName}] 注册 aweme:// 协议失败:`, e.message);
    }
    
    // 标记已初始化
    initializedPartitions.add(partitionName);
  }
}

module.exports = {
  setupProtocolBlocker
};
