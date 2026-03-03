/**
 * 步骤6: 上传主图区域的第一张图片（商品正面图）
 * 
 * 功能：
 * 1. 定位到主图区域的"商品正面图"上传按钮
 * 2. 触发文件选择并上传第一张图片
 * 3. 检测并处理可能出现的"AI素材工具"弹窗
 * 4. 等待图片上传成功
 * 
 * 注意：
 * - 只上传第一张图片（商品正面图）
 * - 可能会弹出"AI素材工具"弹窗，需要点击"上传"按钮
 * - 需要等待图片上传完成后才能继续
 */

const path = require('path');

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 根据文件扩展名获取MIME类型
 * @param {string} filePath - 文件路径
 * @returns {string} MIME类型
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
 * 上传主图区域的第一张图片
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {string} imagePath - 图片文件的绝对路径
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function uploadFirstMainImage(window, imagePath) {
  console.log(`\n========== [步骤6] 上传主图第一张图片 ==========`);
  
  try {
    // 验证图片路径
    if (!imagePath) {
      console.log(`  ✗ 未提供图片路径`);
      return { success: false, message: '未提供图片路径' };
    }
    
    console.log(`  → 图片路径: ${imagePath}`);
    
    // 读取文件内容（Base64编码）
    const fs = require('fs');
    if (!fs.existsSync(imagePath)) {
      console.log(`  ⚠ 图片文件不存在，跳过上传: ${imagePath}`);
      return { success: true, skipped: true, message: '图片文件不存在，跳过' };
    }
    
    const fileBuffer = fs.readFileSync(imagePath);
    const fileBase64 = fileBuffer.toString('base64');
    const fileName = path.basename(imagePath);
    const mimeType = getMimeType(imagePath);
    
    console.log(`  → 文件名: ${fileName}`);
    console.log(`  → 文件大小: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`  → MIME类型: ${mimeType}`);
    
    // 1. 滚动到主图区域
    console.log(`\n[步骤6.1] 定位到主图区域...`);
    await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (mainSection) {
          mainSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })()
    `);
    await wait(500);
    
    // 2. 上传图片（通过Base64注入）
    console.log(`\n[步骤6.2] 上传图片到"商品正面图"...`);
    
    const uploadResult = await executeJS(window, `
      (async function() {
        const fileBase64 = '${fileBase64}';
        const fileName = '${fileName}';
        const mimeType = '${mimeType}';
        
        console.log('[上传主图] 开始上传，文件名:', fileName);
        
        // 查找主图区域
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (!mainSection) {
          return { success: false, message: '未找到主图区域' };
        }
        
        // 查找所有上传按钮
        const uploadButtons = mainSection.querySelectorAll('label.index-module_button__st1_R');
        
        // 找到"商品正面图"按钮
        let mainImageButton = null;
        for (const button of uploadButtons) {
          const text = button.textContent || '';
          if (text.includes('商品正面图')) {
            mainImageButton = button;
            break;
          }
        }
        
        if (!mainImageButton) {
          return { success: false, message: '未找到"商品正面图"上传按钮' };
        }
        
        // 查找input元素
        const fileInput = mainImageButton.querySelector('input[type="file"]');
        if (!fileInput) {
          return { success: false, message: '未找到文件输入框' };
        }
        
        console.log('[上传主图] ✓ 找到文件输入框');
        
        // 将Base64转换为Blob
        const byteCharacters = atob(fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        // 创建File对象
        const file = new File([blob], fileName, { type: mimeType });
        
        console.log('[上传主图] ✓ 文件对象已创建:', file.name, file.size, 'bytes');
        
        // 创建DataTransfer对象
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        
        // 设置到input
        fileInput.files = dataTransfer.files;
        
        // 触发change事件
        const changeEvent = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(changeEvent);
        
        console.log('[上传主图] ✓ 文件已设置，触发change事件');
        
        return { success: true };
      })()
    `);
    
    if (!uploadResult.success) {
      console.log(`  ✗ ${uploadResult.message}`);
      return uploadResult;
    }
    
    console.log(`  ✓ 图片已上传到input`);
    
    // 3. 等待文件上传处理
    console.log(`\n[步骤6.3] 等待文件上传处理...`);
    await wait(500); // 优化：缩短初始等待时间
    
    // 3.1 检查图片是否还在上传中，如果是则等待上传完成（带停滞检测）
    console.log(`\n[步骤6.3.1] 检查图片上传状态...`);
    
    let checkCount = 0;
    const maxChecks = 50; // 增加检查次数（配合更短的间隔）
    const noProgressTimeout = 8000; // 优化：8秒无进展判定为停滞
    let stillUploading = true;
    let lastUploadingCount = -1; // 上一次检查的上传中数量（-1表示未初始化）
    let noProgressStartTime = Date.now(); // 无进展开始时间
    
    while (stillUploading && checkCount < maxChecks) {
      const uploadStatus = await executeJS(window, `
        (function() {
          const mainSection = document.querySelector('[attr-field-id="主图"]');
          if (!mainSection) {
            return { found: false, uploading: false, uploadingCount: 0 };
          }
          
          // 查找所有上传按钮容器
          const uploadButtons = mainSection.querySelectorAll('.index-module_button__st1_R');
          
          let uploadingCount = 0;
          
          for (const button of uploadButtons) {
            // 检查是否有"上传中"的class（index-module_uploading__uXZzT 或类似的）
            const isUploading = button.className.includes('index-module_uploading__');
            
            // 或者检查是否有进度文本
            const progressText = button.querySelector('.index-module_progressText__NwB__');
            
            if (isUploading || progressText) {
              uploadingCount++;
            }
          }
          
          return {
            found: true,
            uploading: uploadingCount > 0,
            uploadingCount: uploadingCount
          };
        })()
      `);
      
      if (!uploadStatus.found) {
        // 找不到主图区域，可能页面结构变化
        console.log(`  ⚠ 未找到主图区域，停止检查`);
        stillUploading = false; // ✅ 修复：设置为false
        break;
      }
      
      if (!uploadStatus.uploading) {
        // 没有正在上传的图片了
        console.log(`  ✓ 图片上传完成`);
        stillUploading = false;
        break;
      }
      
      // ✅ 检测上传进展：如果上传中的数量有变化，重置无进展计时器
      const currentUploadingCount = uploadStatus.uploadingCount;
      
      // 初始化lastUploadingCount
      if (lastUploadingCount === -1) {
        lastUploadingCount = currentUploadingCount;
        noProgressStartTime = Date.now();
      }
      
      // 检查是否有进展（上传中的数量减少说明有图片上传完成）
      if (currentUploadingCount < lastUploadingCount) {
        // 有进展，重置无进展计时器
        console.log(`  ✓ 检测到上传进展: ${lastUploadingCount} → ${currentUploadingCount} 张正在上传`);
        lastUploadingCount = currentUploadingCount;
        noProgressStartTime = Date.now();
      } else if (currentUploadingCount === lastUploadingCount) {
        // 没有进展，检查是否超过无进展超时
        const noProgressDuration = Date.now() - noProgressStartTime;
        
        if (noProgressDuration >= noProgressTimeout) {
          // 超过无进展超时，判定为停滞
          console.log(`  ⚠ 检测到上传停滞: ${noProgressDuration / 1000}秒内无进展（${currentUploadingCount}张仍在上传）`);
          console.log(`  → 可能上传失败，停止等待`);
          stillUploading = false;
          break;
        }
        
        // 还在无进展超时时间内
        if (checkCount % 5 === 0) {
          const remainingTime = Math.ceil((noProgressTimeout - noProgressDuration) / 1000);
          console.log(`  → ${currentUploadingCount}张图片正在上传，还剩 ${remainingTime}秒判定为停滞`);
        }
      }
      
      // 还在上传中
      checkCount++;
      
      await wait(500); // 优化：每500ms检查一次
    }
    
    if (stillUploading) {
      console.log(`  ⚠ 等待60秒后图片仍在上传中，可能上传失败`);
    }
    
    // 4. 检测是否出现"AI素材工具"弹窗
    console.log(`\n[步骤6.4] 检测AI素材工具弹窗...`);
    
    const drawerResult = await executeJS(window, `
      (function() {
        // 查找"AI素材工具"弹窗标题
        const drawerTitle = document.querySelector('.auxo-drawer-title');
        
        if (drawerTitle && drawerTitle.textContent.includes('AI素材工具')) {
          console.log('[上传主图] ✓ 检测到AI素材工具弹窗');
          return { found: true };
        }
        
        console.log('[上传主图] 未检测到AI素材工具弹窗');
        return { found: false };
      })()
    `);
    
    if (drawerResult.found) {
      console.log(`  ✓ 检测到AI素材工具弹窗`);
      
      // 5. 点击弹窗中的"上传"按钮
      console.log(`\n[步骤6.5] 点击弹窗中的"上传"按钮...`);
      
      const clickResult = await executeJS(window, `
        (function() {
          // 查找弹窗底部的"上传"按钮
          const footerWrapper = document.querySelector('.styles-module_footerWrapper__hfUez');
          if (!footerWrapper) {
            return { success: false, message: '未找到弹窗底部区域' };
          }
          
          // 查找"上传"按钮
          const uploadButton = footerWrapper.querySelector('button.ecom-g-btn-primary');
          if (!uploadButton) {
            return { success: false, message: '未找到"上传"按钮' };
          }
          
          const buttonText = uploadButton.textContent || '';
          if (!buttonText.includes('上传')) {
            return { success: false, message: '按钮文本不是"上传"' };
          }
          
          console.log('[上传主图] ✓ 找到"上传"按钮，准备点击');
          uploadButton.click();
          console.log('[上传主图] ✓ 已点击"上传"按钮');
          
          return { success: true };
        })()
      `);
      
      if (clickResult.success) {
        console.log(`  ✓ 已点击"上传"按钮`);
        
        // 等待上传处理
        console.log(`\n[步骤6.6] 等待图片上传完成...`);
        await wait(2000);
      } else {
        console.log(`  ⚠ ${clickResult.message}`);
      }
    } else {
      console.log(`  → 未出现AI素材工具弹窗，直接等待上传完成`);
      await wait(1000);
    }
    
    // 6. 验证图片是否上传成功
    console.log(`\n[步骤6.7] 验证图片上传结果...`);
    
    const verifyResult = await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (!mainSection) {
          return { success: false, message: '未找到主图区域' };
        }
        
        // 检查是否有已上传的图片
        const uploadedImages = mainSection.querySelectorAll('img.index-module_img__j6_h0');
        const imageCount = uploadedImages ? uploadedImages.length : 0;
        
        // 检查是否有AI标记的图片容器
        const imageWrappers = mainSection.querySelectorAll('.index-module_imgWrapper__xOFF7');
        const wrapperCount = imageWrappers ? imageWrappers.length : 0;
        
        // 检查是否有成功状态
        const parentDiv = mainSection.nextElementSibling;
        const hasSuccessClass = parentDiv && 
          parentDiv.classList.contains('ecom-g-zform-item-has-success');
        
        // 检查是否还有错误提示
        const errorText = parentDiv ? parentDiv.querySelector('.styles_publishErrorTextBottom__U_4YU') : null;
        const hasError = errorText && errorText.textContent.includes('该项为必填项');
        
        console.log('[上传主图] 验证结果:');
        console.log('[上传主图]   - 图片数量:', imageCount);
        console.log('[上传主图]   - 图片容器数量:', wrapperCount);
        console.log('[上传主图]   - 成功状态:', hasSuccessClass);
        console.log('[上传主图]   - 错误提示:', hasError);
        
        // 判断上传是否成功：至少有1张图片，且没有错误提示
        const uploadSuccess = (imageCount >= 1 || wrapperCount >= 1) && !hasError;
        
        return {
          success: uploadSuccess,
          imageCount: imageCount,
          wrapperCount: wrapperCount,
          hasSuccessClass: hasSuccessClass,
          hasError: hasError
        };
      })()
    `);
    
    if (verifyResult.success) {
      console.log(`  ✓ 图片上传成功`);
      console.log(`  → 已上传图片数量: ${verifyResult.imageCount || verifyResult.wrapperCount}`);
      console.log(`  → 成功状态: ${verifyResult.hasSuccessClass ? '✓' : '✗'}`);
      console.log(`  → 错误提示: ${verifyResult.hasError ? '有' : '无'}`);
    } else {
      console.log(`  ⚠ 图片上传可能失败`);
      console.log(`  → 图片数量: ${verifyResult.imageCount}`);
      console.log(`  → 容器数量: ${verifyResult.wrapperCount}`);
      console.log(`  → 错误提示: ${verifyResult.hasError ? '有' : '无'}`);
    }
    
    console.log(`========== [步骤6] 完成 ==========\n`);
    
    return {
      success: verifyResult.success,
      imageCount: verifyResult.imageCount || verifyResult.wrapperCount,
      details: verifyResult
    };
    
  } catch (error) {
    console.error(`  ✗ 上传图片失败: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `上传图片失败: ${error.message}`
    };
  }
}

module.exports = {
  uploadFirstMainImage
};
