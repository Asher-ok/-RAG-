const { app, shell } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * 本地Token管理处理器
 * 读取和管理本机电脑上保存的店铺登录状态（Partition数据）
 */

/**
 * 获取partition存储路径
 */
function getPartitionPath(partitionName) {
  const userDataPath = app.getPath('userData');
  // Electron partition存储在 userData/Partitions/ 目录下
  // persist:xxx 格式的partition会去掉 persist: 前缀
  const cleanName = partitionName.replace('persist:', '');
  return path.join(userDataPath, 'Partitions', cleanName);
}

/**
 * 获取映射文件路径
 */
function getMappingFilePath() {
  return path.join(app.getPath('userData'), 'shop-partition-mapping.json');
}

/**
 * 获取文件夹大小（递归）
 */
function getFolderSize(folderPath) {
  let totalSize = 0;
  
  try {
    if (!fs.existsSync(folderPath)) {
      return 0;
    }
    
    const files = fs.readdirSync(folderPath);
    
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getFolderSize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error('[获取文件夹大小失败]', error);
  }
  
  return totalSize;
}

/**
 * 读取Cookie数量
 */
async function getCookieCount(partitionName) {
  try {
    const { session } = require('electron');
    const partitionSession = session.fromPartition(partitionName);
    const cookies = await partitionSession.cookies.get({});
    return cookies.length;
  } catch (error) {
    console.error('[读取Cookie失败]', error);
    return 0;
  }
}

/**
 * 检查关键Cookie
 */
async function checkKeyCookies(partitionName) {
  const keyCookieNames = [
    'sessionid',
    'sessionid_ss',
    'sid_guard',
    'uid_tt',
    'uid_tt_ss',
    'sid_tt',
    'ssid_ucp_v1',
    'passport_csrf_token',
    'ecom_gray_shop_id'
  ];
  
  try {
    const { session } = require('electron');
    const partitionSession = session.fromPartition(partitionName);
    const cookies = await partitionSession.cookies.get({});
    
    return keyCookieNames.map(name => ({
      name,
      exists: cookies.some(c => c.name === name)
    }));
  } catch (error) {
    console.error('[检查关键Cookie失败]', error);
    return keyCookieNames.map(name => ({ name, exists: false }));
  }
}

/**
 * 注册本地Token管理的IPC处理器
 */
function registerLocalTokenHandlers(ipcMain) {
  
  // 获取本地所有partition列表
  ipcMain.handle('get-local-partitions', async () => {
    try {
      console.log('[本地Token] 开始获取partition列表...');
      
      // 读取映射文件
      const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
      
      if (!fs.existsSync(mappingFilePath)) {
        console.log('[本地Token] 映射文件不存在');
        return {
          success: true,
          data: []
        };
      }
      
      const content = fs.readFileSync(mappingFilePath, 'utf-8');
      const mappings = JSON.parse(content);
      
      console.log('[本地Token] 读取到映射:', Object.keys(mappings).length, '个店铺');
      
      // 转换为数组并添加详细信息
      const partitions = [];
      
      for (const [shopId, info] of Object.entries(mappings)) {
        const partitionPath = getPartitionPath(info.partitionName);
        const exists = fs.existsSync(partitionPath);
        const size = exists ? getFolderSize(partitionPath) : 0;
        
        partitions.push({
          shopId: shopId,
          shopName: info.shopName || `店铺_${shopId}`,
          partitionName: info.partitionName,
          loginTime: info.loginTime,
          path: partitionPath,
          exists: exists,
          size: size
        });
      }
      
      console.log('[本地Token] 返回', partitions.length, '个partition');
      
      return {
        success: true,
        data: partitions
      };
      
    } catch (error) {
      console.error('[本地Token] 获取partition列表失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 获取partition详情
  ipcMain.handle('get-partition-detail', async (event, shopId) => {
    try {
      console.log('[本地Token] 获取partition详情:', shopId);
      
      // 读取映射文件
      const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
      
      if (!fs.existsSync(mappingFilePath)) {
        return {
          success: false,
          message: '映射文件不存在'
        };
      }
      
      const content = fs.readFileSync(mappingFilePath, 'utf-8');
      const mappings = JSON.parse(content);
      
      const info = mappings[shopId];
      
      if (!info) {
        return {
          success: false,
          message: '未找到该店铺的映射信息'
        };
      }
      
      const partitionPath = getPartitionPath(info.partitionName);
      const exists = fs.existsSync(partitionPath);
      const size = exists ? getFolderSize(partitionPath) : 0;
      
      // 获取Cookie信息
      const cookieCount = await getCookieCount(info.partitionName);
      const keyCookies = await checkKeyCookies(info.partitionName);
      
      const detail = {
        shopId: shopId,
        shopName: info.shopName || `店铺_${shopId}`,
        partitionName: info.partitionName,
        loginTime: info.loginTime,
        path: partitionPath,
        exists: exists,
        size: size,
        cookieCount: cookieCount,
        localStorageCount: 0, // localStorage需要在渲染进程中读取，这里暂时为0
        keyCookies: keyCookies
      };
      
      console.log('[本地Token] 详情获取成功');
      
      return {
        success: true,
        data: detail
      };
      
    } catch (error) {
      console.error('[本地Token] 获取详情失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 删除本地partition
  ipcMain.handle('delete-local-partition', async (event, shopId) => {
    try {
      console.log('[本地Token] 删除partition:', shopId);
      
      // 读取映射文件
      const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
      
      if (!fs.existsSync(mappingFilePath)) {
        return {
          success: false,
          message: '映射文件不存在'
        };
      }
      
      const content = fs.readFileSync(mappingFilePath, 'utf-8');
      const mappings = JSON.parse(content);
      
      const info = mappings[shopId];
      
      if (!info) {
        return {
          success: false,
          message: '未找到该店铺的映射信息'
        };
      }
      
      // 删除partition文件夹
      const partitionPath = getPartitionPath(info.partitionName);
      
      if (fs.existsSync(partitionPath)) {
        console.log('[本地Token] 删除文件夹:', partitionPath);
        fs.rmSync(partitionPath, { recursive: true, force: true });
      }
      
      // 从映射文件中删除
      delete mappings[shopId];
      fs.writeFileSync(mappingFilePath, JSON.stringify(mappings, null, 2), 'utf-8');
      
      console.log('[本地Token] 删除成功');
      
      return {
        success: true,
        message: '删除成功'
      };
      
    } catch (error) {
      console.error('[本地Token] 删除失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 打开partition文件夹
  ipcMain.handle('open-partition-folder', async (event, shopId) => {
    try {
      console.log('[本地Token] 打开文件夹:', shopId);
      
      // 读取映射文件
      const mappingFilePath = path.join(app.getPath('userData'), 'shop-partition-mapping.json');
      
      if (!fs.existsSync(mappingFilePath)) {
        return {
          success: false,
          message: '映射文件不存在'
        };
      }
      
      const content = fs.readFileSync(mappingFilePath, 'utf-8');
      const mappings = JSON.parse(content);
      
      const info = mappings[shopId];
      
      if (!info) {
        return {
          success: false,
          message: '未找到该店铺的映射信息'
        };
      }
      
      const partitionPath = getPartitionPath(info.partitionName);
      
      if (!fs.existsSync(partitionPath)) {
        return {
          success: false,
          message: '文件夹不存在'
        };
      }
      
      // 在文件管理器中打开
      shell.showItemInFolder(partitionPath);
      
      console.log('[本地Token] 文件夹已打开');
      
      return {
        success: true
      };
      
    } catch (error) {
      console.error('[本地Token] 打开文件夹失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 清理孤立的partition（没有映射关系的临时目录）
  ipcMain.handle('clean-orphan-partitions', async () => {
    try {
      console.log('[本地Token] 开始清理孤立partition...');
      
      const userDataPath = app.getPath('userData');
      const partitionsDir = path.join(userDataPath, 'Partitions');
      
      // 检查Partitions目录是否存在
      if (!fs.existsSync(partitionsDir)) {
        console.log('[本地Token] Partitions目录不存在');
        return {
          success: true,
          message: '没有需要清理的文件',
          cleaned: 0,
          freedSpace: 0
        };
      }
      
      // 读取映射文件
      const mappingFilePath = path.join(userDataPath, 'shop-partition-mapping.json');
      let validPartitions = [];
      
      if (fs.existsSync(mappingFilePath)) {
        const content = fs.readFileSync(mappingFilePath, 'utf-8');
        const mappings = JSON.parse(content);
        
        // 提取所有有效的partition名称（去掉persist:前缀）
        validPartitions = Object.values(mappings).map(info => 
          info.partitionName.replace('persist:', '')
        );
        
        console.log('[本地Token] 有效的partition:', validPartitions);
      }
      
      // 扫描Partitions目录
      const allPartitions = fs.readdirSync(partitionsDir);
      console.log('[本地Token] 发现', allPartitions.length, '个partition目录');
      
      let cleanedCount = 0;
      let freedSpace = 0;
      const orphanPartitions = [];
      
      for (const partitionName of allPartitions) {
        const partitionPath = path.join(partitionsDir, partitionName);
        const stat = fs.statSync(partitionPath);
        
        // 只处理目录
        if (!stat.isDirectory()) {
          continue;
        }
        
        // 🔧 修复：只删除不在映射文件中的partition
        // 不再简单地根据名称判断，而是检查是否在有效列表中
        const isOrphan = !validPartitions.includes(partitionName);
        
        if (isOrphan) {
          const size = getFolderSize(partitionPath);
          
          orphanPartitions.push({
            name: partitionName,
            path: partitionPath,
            size: size,
            type: 'orphan'
          });
          
          console.log(`[本地Token] 发现孤立partition: ${partitionName}, 大小: ${(size / 1024 / 1024).toFixed(2)} MB`);
          
          // 删除目录
          try {
            fs.rmSync(partitionPath, { recursive: true, force: true });
            cleanedCount++;
            freedSpace += size;
            console.log(`[本地Token] ✓ 已删除: ${partitionName}`);
          } catch (deleteError) {
            console.error(`[本地Token] ✗ 删除失败: ${partitionName}`, deleteError);
          }
        }
      }
      
      console.log(`[本地Token] 清理完成: 删除 ${cleanedCount} 个目录, 释放 ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);
      
      return {
        success: true,
        message: `清理完成，删除 ${cleanedCount} 个孤立目录`,
        cleaned: cleanedCount,
        freedSpace: freedSpace,
        orphanPartitions: orphanPartitions
      };
      
    } catch (error) {
      console.error('[本地Token] 清理失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 获取映射文件信息
  ipcMain.handle('get-mapping-file-info', async () => {
    try {
      const mappingFilePath = getMappingFilePath();
      const userDataPath = app.getPath('userData');
      
      let exists = fs.existsSync(mappingFilePath);
      let content = null;
      let size = 0;
      let modifiedTime = null;
      
      if (exists) {
        const stats = fs.statSync(mappingFilePath);
        size = stats.size;
        modifiedTime = stats.mtime;
        
        try {
          content = fs.readFileSync(mappingFilePath, 'utf-8');
        } catch (e) {
          console.error('[本地Token] 读取映射文件失败:', e);
        }
      }
      
      return {
        success: true,
        data: {
          path: mappingFilePath,
          userDataPath: userDataPath,
          exists: exists,
          size: size,
          modifiedTime: modifiedTime,
          content: content
        }
      };
    } catch (error) {
      console.error('[本地Token] 获取映射文件信息失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  // 打开映射文件所在目录
  ipcMain.handle('open-mapping-file-folder', async () => {
    try {
      const mappingFilePath = getMappingFilePath();
      
      if (fs.existsSync(mappingFilePath)) {
        // 在文件管理器中显示文件
        shell.showItemInFolder(mappingFilePath);
      } else {
        // 文件不存在，打开父目录
        const userDataPath = app.getPath('userData');
        shell.openPath(userDataPath);
      }
      
      return {
        success: true
      };
    } catch (error) {
      console.error('[本地Token] 打开映射文件目录失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
}

module.exports = {
  registerLocalTokenHandlers
};
