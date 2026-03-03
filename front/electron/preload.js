const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  // 登录成功通知主进程
  loginSuccess: () => ipcRenderer.send('login-success'),
  // 退出登录通知主进程
  logout: () => ipcRenderer.send('logout'),
  // 选择文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // 打开抖店登录窗口
  openDouyinLogin: (accountId) => ipcRenderer.invoke('open-douyin-login', accountId),
  // 计算素材组合数
  calculateCombinations: (folders) => ipcRenderer.invoke('calculate-combinations', folders),
  
  // ==================== 商品裂变自动化 ====================
  // 执行商品裂变
  executeFission: (params) => ipcRenderer.invoke('execute-fission', params),
  // 监听裂变进度
  onFissionProgress: (callback) => {
    ipcRenderer.on('fission-progress', (event, progress) => callback(progress));
  },
  // 移除裂变进度监听
  offFissionProgress: (callback) => {
    ipcRenderer.removeListener('fission-progress', callback);
  },
  // ✅ 取消裂变任务
  cancelFissionTask: (taskId) => ipcRenderer.invoke('cancel-fission-task', taskId),
  // 关闭裂变浏览器
  closeFissionBrowser: () => ipcRenderer.invoke('close-fission-browser'),
  
  // ==================== 本地Token管理 ====================
  // 获取本地所有partition列表
  getLocalPartitions: () => ipcRenderer.invoke('get-local-partitions'),
  // 获取partition详情
  getPartitionDetail: (shopId) => ipcRenderer.invoke('get-partition-detail', shopId),
  // 删除本地partition
  deleteLocalPartition: (shopId) => ipcRenderer.invoke('delete-local-partition', shopId),
  // 打开partition文件夹
  openPartitionFolder: (shopId) => ipcRenderer.invoke('open-partition-folder', shopId),
  // 清理孤立的partition
  cleanOrphanPartitions: () => ipcRenderer.invoke('clean-orphan-partitions'),
  // 获取映射文件信息
  getMappingFileInfo: () => ipcRenderer.invoke('get-mapping-file-info'),
  // 打开映射文件所在目录
  openMappingFileFolder: () => ipcRenderer.invoke('open-mapping-file-folder')
});

// 暴露导航相关API
contextBridge.exposeInMainWorld('electron', {
  // 监听导航事件
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', callback);
  },
  // 移除导航监听器
  removeNavigateListener: (callback) => {
    ipcRenderer.removeListener('navigate', callback);
  },
  
  // ==================== 商品同步自动化 ====================
  ipcRenderer: {
    // 执行商品同步
    invoke: (channel, data) => {
      const validChannels = ['execute-product-sync'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    // 监听商品同步进度和裂变步骤进度
    on: (channel, func) => {
      const validChannels = ['product-sync-progress', 'fission-step-progress'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    // 移除监听器
    removeListener: (channel, func) => {
      const validChannels = ['product-sync-progress', 'fission-step-progress'];
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
});
