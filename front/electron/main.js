const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');

// 导入处理器模块
const { registerLoginHandlers } = require('./handlers/login-handler');
const { registerFissionHandlers } = require('./handlers/fission-handler');
const { registerSyncHandlers } = require('./handlers/sync-handler');
const { registerLocalTokenHandlers } = require('./handlers/local-token-handler');

// 禁用开发环境的安全警告（仅开发时）
if (process.env.NODE_ENV === 'development') {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
}

// ==================== 彻底阻止外部协议弹窗 ====================

// 1. 在app ready之前就设置，阻止任何协议处理
app.setAsDefaultProtocolClient('bytedance', process.execPath, []);
app.setAsDefaultProtocolClient('snssdk', process.execPath, []);
app.setAsDefaultProtocolClient('aweme', process.execPath, []);

// 2. 立即移除（这样Windows就不会弹窗了）
process.nextTick(() => {
  app.removeAsDefaultProtocolClient('bytedance');
  app.removeAsDefaultProtocolClient('snssdk');
  app.removeAsDefaultProtocolClient('aweme');
});

// 3. 阻止所有外部协议打开
app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('[App] 阻止打开外部协议:', url);
});

// 4. 阻止命令行参数中的协议调用
app.on('second-instance', (event, commandLine, workingDirectory) => {
  console.log('[App] 阻止second-instance协议调用:', commandLine);
  event.preventDefault();
});

// 5. 阻止 shell.openExternal 调用外部协议
const originalOpenExternal = shell.openExternal;
shell.openExternal = function(url, options) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      console.log('[App] 阻止 shell.openExternal 打开外部协议:', url);
      return Promise.resolve();
    }
  } catch (e) {
    console.log('[App] 阻止 shell.openExternal 打开无效URL:', url);
    return Promise.resolve();
  }
  return originalOpenExternal.call(shell, url, options);
};

// 6. 阻止 web-contents-created 中的协议调用
app.on('web-contents-created', (event, contents) => {
  // 阻止所有非 http/https 协议的导航
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'data:' && parsedUrl.protocol !== 'blob:') {
        console.log('[App] 阻止导航到外部协议:', navigationUrl);
        event.preventDefault();
      }
    } catch (e) {
      console.log('[App] 阻止导航到无效URL:', navigationUrl);
      event.preventDefault();
    }
  });
  
  // 阻止新窗口打开外部协议
  contents.setWindowOpenHandler((details) => {
    const url = details.url;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        console.log('[App] 阻止打开外部协议窗口:', url);
        return { action: 'deny' };
      }
      
      // 只允许抖店商品链接在外部浏览器打开
      if (url.includes('haohuo.jinritemai.com') || url.includes('haohuo.snssdk.com')) {
        console.log('[App] 在外部浏览器打开商品链接:', url);
        shell.openExternal(url);
        return { action: 'deny' };
      }
    } catch (e) {
      console.log('[App] 阻止打开无效URL窗口:', url);
      return { action: 'deny' };
    }
    return { action: 'deny' }; // 默认阻止所有新窗口
  });
  
  // 阻止所有外部协议的重定向
  contents.on('will-redirect', (event, url) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        console.log('[App] 阻止重定向到外部协议:', url);
        event.preventDefault();
      }
    } catch (e) {
      console.log('[App] 阻止重定向到无效URL:', url);
      event.preventDefault();
    }
  });
});

let mainWindow;

// ==================== 基础 IPC 处理器 ====================

// 监听登录成功事件
ipcMain.on('login-success', () => {
  console.log('User logged in successfully');
  // 前端路由会自动处理跳转，这里不需要做任何操作
});

// 监听退出登录事件
ipcMain.on('logout', () => {
  console.log('[Main] 收到退出登录事件');
  // 退出登录时，重新加载整个应用到根路径，让前端路由自动跳转到登录页
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Main] 重新加载应用...');
    
    // 延迟500ms，让前端先清理localStorage
    setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        // 开发环境：重新加载根路径
        mainWindow.loadURL('http://localhost:5173/').then(() => {
          console.log('[Main] 开发环境重新加载完成');
        }).catch(err => {
          console.error('[Main] 开发环境重新加载失败:', err);
        });
      } else {
        // 生产环境：重新加载index.html
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).then(() => {
          console.log('[Main] 生产环境重新加载完成');
        }).catch(err => {
          console.error('[Main] 生产环境重新加载失败:', err);
        });
      }
    }, 500);
  }
});

// 监听选择文件夹事件
ipcMain.handle('select-folder', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 计算素材组合数（在本地计算，不需要后端）
ipcMain.handle('calculate-combinations', async (event, folders) => {
  const fs = require('fs');
  const path = require('path');
  
  try {
    const { coverImageFolder, mainImageFolder, detailImageFolder } = folders;
    
    // 图片扩展名
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    // 统计首图数量（直接文件）
    let coverCount = 0;
    if (coverImageFolder && fs.existsSync(coverImageFolder)) {
      const files = fs.readdirSync(coverImageFolder);
      for (const file of files) {
        const filePath = path.join(coverImageFolder, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (imageExtensions.includes(ext)) {
            coverCount++;
          }
        }
      }
    }
    
    // 统计主图方案数（子文件夹数量）
    let mainCount = 0;
    if (mainImageFolder && fs.existsSync(mainImageFolder)) {
      const items = fs.readdirSync(mainImageFolder);
      for (const item of items) {
        const itemPath = path.join(mainImageFolder, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          mainCount++;
        }
      }
    }
    
    // 统计详情图方案数（子文件夹数量）
    let detailCount = 0;
    if (detailImageFolder && fs.existsSync(detailImageFolder)) {
      const items = fs.readdirSync(detailImageFolder);
      for (const item of items) {
        const itemPath = path.join(detailImageFolder, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          detailCount++;
        }
      }
    }
    
    // 计算总组合数
    let totalCombinations = 0;
    if (coverCount > 0 && mainCount > 0 && detailCount > 0) {
      totalCombinations = coverCount * mainCount * detailCount;
    }
    
    return {
      success: true,
      data: {
        cover_count: coverCount,
        main_count: mainCount,
        detail_count: detailCount,
        total_combinations: totalCombinations
      }
    };
  } catch (error) {
    console.error('[计算组合数失败]', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// ==================== 注册各功能模块的 IPC 处理器 ====================

// 注册登录处理器
registerLoginHandlers(ipcMain);

// 注册裂变处理器
registerFissionHandlers(ipcMain, app);

// 注册同步处理器
registerSyncHandlers(ipcMain);

// 注册本地Token管理处理器
registerLocalTokenHandlers(ipcMain);

// ==================== App 生命周期 ====================

app.whenReady().then(() => {
  // 创建完整的菜单（包含编辑菜单以支持复制粘贴）
  const isMac = process.platform === 'darwin';
  
  const template = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    }] : []),
    
    // 编辑菜单（关键：支持复制粘贴）
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
          { role: 'delete', label: '删除' },
          { role: 'selectAll', label: '全选' }
        ] : [
          { role: 'delete', label: '删除' },
          { type: 'separator' },
          { role: 'selectAll', label: '全选' }
        ])
      ]
    },
    
    // 工具菜单
    {
      label: '工具',
      submenu: [
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          }
        },
        {
          label: '刷新',
          accelerator: isMac ? 'Cmd+R' : 'Ctrl+R',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.reload();
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // 创建主窗口（大窗口）
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    title: '抖店商家助手',
    icon: path.join(__dirname, '../public/icon.png'),
    backgroundColor: '#ffffff',
    show: false
  });

  // 开发环境加载本地服务器根路径
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境：加载index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 监听页面加载完成
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] 页面加载完成');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  // 监听页面加载失败
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[Main] 页面加载失败:', errorCode, errorDescription);
    // 重新加载
    setTimeout(() => {
      const win = mainWindow;
      if (win && !win.isDestroyed()) win.reload();
    }, 1000);
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1280,
        minHeight: 720,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        },
        frame: true,
        title: '抖店商家助手',
        icon: path.join(__dirname, '../public/icon.png'),
        backgroundColor: '#ffffff'
      });
      
      if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173/');
      } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
