/**
 * 步骤7: 上传主图区域的第2-5张辅助图（批量并发版）
 * 
 * 功能：
 * 1. 定位到主图区域的"上传辅助图"按钮
 * 2. 批量上传4张辅助图（第2-5张）- 使用 DataTransfer 一次性投递
 * 3. 智能等待上传完成（高频检测 + 动态超时）
 * 4. 自动处理"AI素材工具"弹窗
 * 
 * 优化点：
 * - 从串行上传改为批量并行上传
 * - 移除固定等待，改为轮询检测
 * - 优化检测频率（200ms）
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
 * 根据文件扩展名获取MIME类型
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * 在页面中执行 JavaScript（增强版，带完整错误处理）
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {string} code - JavaScript代码
 */
async function executeJS(window, code) {
  // ✅ 执行前检查窗口状态
  if (window.isDestroyed()) {
    throw new Error('窗口已关闭');
  }
  
  try {
    // ✅ 使用 Promise.race 添加超时保护
    const result = await Promise.race([
      window.webContents.executeJavaScript(code),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('executeJavaScript 超时（30秒）')), 30000)
      )
    ]);
    return result;
  } catch (error) {
    // ✅ 捕获执行过程中的错误
    if (window.isDestroyed()) {
      throw new Error('窗口在执行过程中被关闭');
    }
    
    // ✅ 重新抛出原始错误，保留错误信息
    throw error;
  }
}

/**
 * 检测并处理AI素材工具弹窗
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{found: boolean, clicked?: boolean}>}
 */
async function handleAIDrawer(window) {
  const drawerResult = await executeJS(window, `
    (function() {
      // 查找"AI素材工具"弹窗标题
      const drawerTitle = document.querySelector('.auxo-drawer-title');
      if (drawerTitle && drawerTitle.textContent.includes('AI素材工具')) {
        return { found: true };
      }
      return { found: false };
    })()
  `);
  
  if (drawerResult.found) {
    console.log(`  ✓ 检测到AI素材工具弹窗，尝试关闭...`);
    
    const clickResult = await executeJS(window, `
      (function() {
        // 优先点击"上传"或"确定"
        const footerWrapper = document.querySelector('.styles-module_footerWrapper__hfUez');
        if (footerWrapper) {
          const confirmBtn = footerWrapper.querySelector('button.ecom-g-btn-primary');
          if (confirmBtn) {
            confirmBtn.click();
            return { success: true, action: 'clicked_confirm' };
          }
        }
        
        // 兜底：点击遮罩层或关闭按钮
        const closeBtn = document.querySelector('.auxo-drawer-close');
        if (closeBtn) {
          closeBtn.click();
          return { success: true, action: 'clicked_close' };
        }
        
        return { success: false };
      })()
    `);
    
    if (clickResult.success) {
      console.log(`  ✓ 已处理AI弹窗 (${clickResult.action})`);
      await wait(500); // 稍微等待弹窗消失
      return true;
    }
  }
  return false;
}

/**
 * 批量上传辅助图
 */
async function uploadAuxiliaryImagesBatch(window, imagePaths) {
  console.log(`  → 准备批量上传 ${imagePaths.length} 张图片...`);
  
  // 1. 准备文件数据
  const filesData = [];
  for (const imagePath of imagePaths) {
    if (fs.existsSync(imagePath)) {
      filesData.push({
        base64: fs.readFileSync(imagePath).toString('base64'),
        name: path.basename(imagePath),
        mime: getMimeType(imagePath)
      });
    } else {
      console.log(`    ✗ 文件不存在跳过: ${imagePath}`);
    }
  }

  if (filesData.length === 0) {
    console.log('    ⚠ 没有有效的文件可上传，跳过');
    return { success: true, skipped: true, message: '没有有效的文件可上传，跳过' };
  }

  // 2. 执行浏览器端上传逻辑
  const uploadResult = await executeJS(window, `
    (async function() {
      const filesData = ${JSON.stringify(filesData)};
      
      // 查找主图区域
      const mainSection = document.querySelector('[attr-field-id="主图"]');
      if (!mainSection) return { success: false, message: '未找到主图区域' };
      
      // 查找上传按钮
      // 策略：找到所有"上传辅助图"或通用的图片上传按钮
      // 通常是 label.index-module_button__st1_R 或者是 input[type=file] 的父级
      
      const uploadLabels = Array.from(mainSection.querySelectorAll('label'));
      let targetLabel = uploadLabels.find(l => l.textContent.includes('上传辅助图')) || 
                        uploadLabels.find(l => l.querySelector('input[type="file"]'));
      
      if (!targetLabel) return { success: false, message: '未找到上传按钮' };
      
      const fileInput = targetLabel.querySelector('input[type="file"]');
      if (!fileInput) return { success: false, message: '未找到文件输入框' };
      
      // 构造 DataTransfer
      const dt = new DataTransfer();
      
      for (const fileData of filesData) {
        // Base64 -> Blob -> File
        const byteCharacters = atob(fileData.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: fileData.mime });
        const file = new File([blob], fileData.name, { type: fileData.mime });
        dt.items.add(file);
      }
      
      // 赋值并触发
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      return { success: true, count: filesData.length };
    })()
  `);

  if (!uploadResult.success) {
    return uploadResult;
  }

  console.log(`    ✓ 已触发批量上传，等待完成...`);
  return { success: true };
}

/**
 * 主函数：上传主图辅助图
 */
async function uploadAuxiliaryMainImages(window, imagePaths, maxRetries = 5) {
  console.log(`\n========== [步骤7] 上传主图辅助图（极速版） ==========`);
  
  if (!imagePaths || imagePaths.length !== 4) {
    return { success: false, message: `需要4张图片，实际提供了 ${imagePaths ? imagePaths.length : 0} 张` };
  }

  try {
    const start = Date.now();
    // 1. 定位
    await executeJS(window, `
      (function() {
        const el = document.querySelector('[attr-field-id="主图"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })()
    `);
    await wait(200); // 稍微等一下滚动

    // 2. 批量上传
    let success = false;
    let attempts = 0;
    
    while (!success && attempts < maxRetries) {
      attempts++;
      if (attempts > 1) console.log(`  → 第 ${attempts} 次尝试...`);

      // 检查当前数量，避免重复上传
      const currentCount = await executeJS(window, `
        (function() {
          const mainSection = document.querySelector('[attr-field-id="主图"]');
          if (!mainSection) return 0;
          const imgs = mainSection.querySelectorAll('img.index-module_img__j6_h0');
          const wrappers = mainSection.querySelectorAll('.index-module_imgWrapper__xOFF7');
          return Math.max(imgs.length, wrappers.length);
        })()
      `);

      if (currentCount >= 5) {
        console.log(`  ✓ 检测到已有 5 张图片，跳过上传`);
        success = true;
        break;
      }

      // 只要数量不够，就尝试上传
      // 注意：如果已经有3张（1主+2辅），还差2张，批量上传4张可能会导致重复或覆盖，
      // 但通常电商后台会自动处理或报错。
      // 更精细的做法是只上传缺失的，但为了简单和速度，我们假设是在全新流程中，直接传4张。
      // 如果是重试，可以根据 diff 上传，但这里简化处理，直接再次触发批量上传，
      // 让用户去手动删或者系统去重（通常系统会限制张数）。
      // 优化：只上传缺失的数量
      const missingCount = 5 - currentCount;
      const imagesToUpload = imagePaths.slice(0, missingCount); // 取前N张补位（假设顺序对应）
      
      const uploadRes = await uploadAuxiliaryImagesBatch(window, imagesToUpload);
      
      if (!uploadRes.success) {
        console.log(`  ⚠ 上传触发失败: ${uploadRes.message}`);
        await wait(1000);
        continue;
      }

      // 3. 智能等待完成
      const maxWait = 15000; // 15秒超时
      const loopStart = Date.now();
      const checkInterval = 200; // 200ms检测一次
      
      while (Date.now() - loopStart < maxWait) {
        await wait(checkInterval);
        
        // 检查弹窗
        await handleAIDrawer(window);

        // 检查数量
        const checkRes = await executeJS(window, `
          (function() {
            const mainSection = document.querySelector('[attr-field-id="主图"]');
            if (!mainSection) return { count: 0 };
            
            const imgs = mainSection.querySelectorAll('img.index-module_img__j6_h0');
            const wrappers = mainSection.querySelectorAll('.index-module_imgWrapper__xOFF7');
            // 检查是否有上传失败/错误提示
            const errorEl = mainSection.querySelector('.styles_publishErrorTextBottom__U_4YU');
            
            return { 
              count: Math.max(imgs.length, wrappers.length),
              hasError: !!errorEl
            };
          })()
        `);

        if (checkRes.count >= 5) {
          console.log(`  ✓ 图片上传完成 (当前数量: ${checkRes.count})`);
          success = true;
          break;
        }
        
        // 如果有错误提示，可能需要干预，这里简单重试
        if (checkRes.hasError) {
          console.log(`  ⚠ 检测到错误提示，准备重试...`);
          break; // 退出等待循环，触发外层重试
        }
      }
      
      if (!success) {
         console.log(`  ⚠ 等待超时或失败，准备重试...`);
      }
    }

    if (success) {
      console.log(`========== [步骤7] 完成 (耗时约 ${((Date.now() - start)/1000).toFixed(1)}s) ==========\n`);
      return { success: true };
    } else {
      console.log(`========== [步骤7] 失败 ==========\n`);
      return { success: false, message: '上传辅助图最终失败' };
    }

  } catch (error) {
    console.error(`  ✗ 步骤7出错: ${error.message}`);
    return { success: false, message: error.message };
  }
}

module.exports = {
  uploadAuxiliaryMainImages
};
