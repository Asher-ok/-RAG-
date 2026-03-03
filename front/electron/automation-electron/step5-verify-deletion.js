/**
 * 步骤5: 验证主图和主图3:4区域的图片是否已完全删除
 * 
 * 功能：
 * 1. 检查主图区域（1:1）是否已清空
 * 2. 检查主图3:4区域是否已清空
 * 3. 验证上传按钮是否正确显示
 * 
 * 验证标准：
 * - 主图区域：0张图片，5个上传按钮（1个商品正面图 + 4个辅助图）
 * - 主图3:4区域：0张图片，5个上传按钮（1个商品正面图 + 4个辅助图）
 * - 主图区域应该显示错误提示："该项为必填项，请上传图片"
 */

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * 验证图片删除是否完成
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string, details?: object}>}
 */
async function verifyDeletion(window) {
  console.log(`\n========== [步骤5] 验证图片删除完成 ==========`);
  
  try {
    // 1. 验证主图区域（1:1）
    console.log(`[步骤5.1] 验证主图区域（1:1）...`);
    
    const mainResult = await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (!mainSection) {
          return { found: false, reason: '未找到主图区域' };
        }
        
        // 按钮在 mainSection 的兄弟元素中，不是在 mainSection 内部
        const buttonContainer = mainSection.nextElementSibling;
        if (!buttonContainer) {
          // ✅ 未找到按钮容器，说明已经完全清空，这是成功的标志
          return { 
            found: true, 
            imageCount: 0,
            uploadButtonCount: 0,
            hasMainButton: false,
            auxButtonCount: 0,
            hasErrorPrompt: false,
            hasErrorClass: false,
            isClean: true,
            note: '按钮容器不存在，说明已完全清空'
          };
        }
        
        // 检查是否还有图片（图片在 buttonContainer 内部）
        const imageWrappers = buttonContainer.querySelectorAll('div.index-module_imgWrapper__xOFF7');
        const imageCount = imageWrappers ? imageWrappers.length : 0;
        
        // 检查上传按钮数量（按钮也在 buttonContainer 内部）
        const uploadButtons = buttonContainer.querySelectorAll('label.index-module_button__st1_R');
        const uploadButtonCount = uploadButtons ? uploadButtons.length : 0;
        
        // 检查是否有"商品正面图"按钮
        const hasMainButton = Array.from(uploadButtons || []).some(btn => 
          btn.textContent && btn.textContent.includes('商品正面图')
        );
        
        // 检查是否有"上传辅助图"按钮（应该有4个）
        const auxButtons = Array.from(uploadButtons || []).filter(btn => 
          btn.textContent && btn.textContent.includes('上传辅助图')
        );
        const auxButtonCount = auxButtons.length;
        
        // 检查是否有错误提示
        const errorText = buttonContainer.querySelector('.styles_publishErrorTextBottom__U_4YU');
        const hasErrorPrompt = errorText && errorText.textContent.includes('该项为必填项，请上传图片');
        
        // 检查是否有 has-error 类
        const hasErrorClass = buttonContainer.classList.contains('has-error') || 
                              buttonContainer.classList.contains('ecom-g-zform-item-has-error');
        
        return {
          found: true,
          imageCount: imageCount,
          uploadButtonCount: uploadButtonCount,
          hasMainButton: hasMainButton,
          auxButtonCount: auxButtonCount,
          hasErrorPrompt: hasErrorPrompt,
          hasErrorClass: hasErrorClass,
          isClean: imageCount === 0 && uploadButtonCount === 5 && hasMainButton && auxButtonCount === 4
        };
      })()
    `);
    
    if (!mainResult.found) {
      console.log(`  ✗ ${mainResult.reason}`);
      return { success: false, message: mainResult.reason };
    }
    
    if (mainResult.note) {
      console.log(`  ✓ ${mainResult.note}`);
    } else {
      console.log(`  → 剩余图片: ${mainResult.imageCount} 张`);
      console.log(`  → 上传按钮: ${mainResult.uploadButtonCount} 个`);
      console.log(`  → 商品正面图按钮: ${mainResult.hasMainButton ? '✓' : '✗'}`);
      console.log(`  → 上传辅助图按钮: ${mainResult.auxButtonCount} 个`);
      console.log(`  → 错误提示: ${mainResult.hasErrorPrompt ? '✓ "该项为必填项，请上传图片"' : '✗'}`);
      console.log(`  → 错误样式: ${mainResult.hasErrorClass ? '✓ has-error' : '✗'}`);
    }
    
    if (mainResult.isClean) {
      console.log(`  ✓ 主图区域验证通过`);
    } else {
      console.log(`  ✗ 主图区域验证失败`);
    }
    
    // 2. 验证主图3:4区域
    console.log(`\n[步骤5.2] 验证主图3:4区域...`);
    
    const main34Result = await executeJS(window, `
      (function() {
        const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
        if (!main34Section) {
          return { found: false, reason: '未找到主图3:4区域' };
        }
        
        // 按钮在 main34Section 的兄弟元素中，不是在 main34Section 内部
        const buttonContainer = main34Section.nextElementSibling;
        if (!buttonContainer) {
          // ✅ 未找到按钮容器，说明已经完全清空，这是成功的标志
          return { 
            found: true, 
            imageCount: 0,
            uploadButtonCount: 0,
            hasMainButton: false,
            auxButtonCount: 0,
            hasSuccessClass: false,
            hasSmartCropButton: false,
            isClean: true,
            note: '按钮容器不存在，说明已完全清空'
          };
        }
        
        // 检查是否还有图片（图片在 buttonContainer 内部）
        const imageWrappers = buttonContainer.querySelectorAll('div.index-module_imgWrapper__xOFF7');
        const imageCount = imageWrappers ? imageWrappers.length : 0;
        
        // 检查上传按钮数量（按钮也在 buttonContainer 内部）
        const uploadButtons = buttonContainer.querySelectorAll('label.index-module_button__st1_R');
        const uploadButtonCount = uploadButtons ? uploadButtons.length : 0;
        
        // 检查是否有"商品正面图"按钮
        const hasMainButton = Array.from(uploadButtons || []).some(btn => 
          btn.textContent && btn.textContent.includes('商品正面图')
        );
        
        // 检查是否有"上传辅助图"按钮（应该有4个）
        const auxButtons = Array.from(uploadButtons || []).filter(btn => 
          btn.textContent && btn.textContent.includes('上传辅助图')
        );
        const auxButtonCount = auxButtons.length;
        
        // 检查是否有成功状态类
        const hasSuccessClass = buttonContainer.classList.contains('ecom-g-zform-item-has-success');
        
        // 检查是否有"从1:1主图智能裁剪"按钮（这个按钮在 main34Section 内部，不是在 buttonContainer 里）
        const smartCropButton = main34Section.querySelector('button.ecom-g-btn-link');
        const hasSmartCropButton = smartCropButton && 
          smartCropButton.textContent.includes('从1:1主图智能裁剪');
        
        return {
          found: true,
          imageCount: imageCount,
          uploadButtonCount: uploadButtonCount,
          hasMainButton: hasMainButton,
          auxButtonCount: auxButtonCount,
          hasSuccessClass: hasSuccessClass,
          hasSmartCropButton: hasSmartCropButton,
          isClean: imageCount === 0 && uploadButtonCount === 5 && hasMainButton && auxButtonCount === 4
        };
      })()
    `);
    
    if (!main34Result.found) {
      console.log(`  ✗ ${main34Result.reason}`);
      return { success: false, message: main34Result.reason };
    }
    
    if (main34Result.note) {
      console.log(`  ✓ ${main34Result.note}`);
    } else {
      console.log(`  → 剩余图片: ${main34Result.imageCount} 张`);
      console.log(`  → 上传按钮: ${main34Result.uploadButtonCount} 个`);
      console.log(`  → 商品正面图按钮: ${main34Result.hasMainButton ? '✓' : '✗'}`);
      console.log(`  → 上传辅助图按钮: ${main34Result.auxButtonCount} 个`);
      console.log(`  → 成功状态: ${main34Result.hasSuccessClass ? '✓ has-success' : '✗'}`);
      console.log(`  → 智能裁剪按钮: ${main34Result.hasSmartCropButton ? '✓' : '✗'}`);
    }
    
    if (main34Result.isClean) {
      console.log(`  ✓ 主图3:4区域验证通过`);
    } else {
      console.log(`  ✗ 主图3:4区域验证失败`);
    }
    
    // 3. 综合验证结果
    console.log(`\n[步骤5.3] 综合验证结果...`);
    
    const allClean = mainResult.isClean && main34Result.isClean;
    
    if (allClean) {
      console.log(`  ✓ 所有图片已完全删除，可以继续上传新图片`);
      console.log(`========== [步骤5] 完成 ==========\n`);
      
      return {
        success: true,
        details: {
          main: mainResult,
          main34: main34Result
        }
      };
    } else {
      const failedAreas = [];
      if (!mainResult.isClean) failedAreas.push('主图区域');
      if (!main34Result.isClean) failedAreas.push('主图3:4区域');
      
      console.log(`  ✗ 验证失败：${failedAreas.join('、')} 未完全清空`);
      console.log(`========== [步骤5] 失败 ==========\n`);
      
      return {
        success: false,
        message: `${failedAreas.join('、')} 未完全清空`,
        details: {
          main: mainResult,
          main34: main34Result
        }
      };
    }
    
  } catch (error) {
    console.error(`  ✗ 验证失败: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `验证失败: ${error.message}`
    };
  }
}

module.exports = {
  verifyDeletion
};
