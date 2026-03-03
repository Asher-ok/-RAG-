/**
 * 步骤4: 删除主图区域（1:1）的所有图片
 * 
 * 功能：
 * 1. 定位到主图区域
 * 2. 从后往前删除所有图片（第5张→第4张→...→第1张）
 * 3. 使用鼠标悬停+点击删除按钮的方式
 * 
 * 注意：
 * - 必须从后往前删除，因为删除第一张时后面的图片不会自动前移
 * - 每次删除后需要等待页面更新
 * - 主图区域的图片是1:1比例（98px × 98px）
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
 * 删除主图区域（1:1）的所有图片
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string, deletedCount?: number}>}
 */
async function deleteMainImages(window) {
  console.log(`\n========== [步骤4] 删除主图区域（1:1）的所有图片 ==========`);
  
  try {
    // 1. 滚动到主图区域
    console.log(`[步骤4.1] 定位到主图区域...`);
    const scrolled = await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (mainSection) {
          mainSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      })()
    `);
    
    if (!scrolled) {
      console.log(`  ⚠ 未找到主图区域`);
      return { success: false, message: '未找到主图区域' };
    }
    
    console.log(`  ✓ 已定位到主图区域`);
    await wait(500);
    
    // 2. 从后往前删除所有图片
    console.log(`\n[步骤4.2] 开始删除图片（从后往前）...`);
    let deletedCount = 0;
    const maxDeleteAttempts = 10; // 最多删除10张（通常是5张）
    
    for (let attempt = 0; attempt < maxDeleteAttempts; attempt++) {
      try {
        // 查找主图区域内的所有图片容器
        const result = await executeJS(window, `
          (function() {
            // 查找主图区域
            const mainSection = document.querySelector('[attr-field-id="主图"]');
            if (!mainSection) {
              return { finished: true, count: 0, reason: '未找到主图区域' };
            }
            
            // 查找该区域内的所有图片容器
            const imageWrappers = mainSection.querySelectorAll('div.index-module_imgWrapper__xOFF7');
            
            if (!imageWrappers || imageWrappers.length === 0) {
              return { finished: true, count: 0, reason: '没有图片需要删除' };
            }
            
            const count = imageWrappers.length;
            console.log('[删除主图] 当前还有', count, '张图片');
            
            // 选择最后一张图片（从后往前删）
            const lastWrapper = imageWrappers[imageWrappers.length - 1];
            
            // 鼠标悬停在最后一张图片上
            const mouseoverEvent = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
            lastWrapper.dispatchEvent(mouseoverEvent);
            
            // 优化：尝试直接查找删除按钮，不需要长等待
            return new Promise(resolve => {
              // 快速尝试点击
              const tryClick = () => {
                let deleted = false;
                
                // 方法1: 直接在悬停的图片容器内查找删除按钮
                try {
                  const deleteIcon = lastWrapper.querySelector("use[href='#icon-shanchu']");
                  if (deleteIcon) {
                    const deleteButton = deleteIcon.closest('.index-module_actionAfter__MtUIB');
                    if (deleteButton) {
                      deleteButton.click();
                      deleted = true;
                      console.log('[删除主图] ✓ 已删除第', count, '张图片（方法1）');
                      return true;
                    }
                  }
                } catch (error) {
                  // ignore
                }
                
                // 方法2: 尝试通过可见的删除按钮
                if (!deleted) {
                  try {
                    const deleteButtonSelectors = [
                      ".index-module_hoverWrapper__OjtoF .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])",
                      ".index-module_controls__ys7qK .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])"
                    ];
                    
                    for (const selector of deleteButtonSelectors) {
                      const deleteButtons = document.querySelectorAll(selector);
                      if (deleteButtons && deleteButtons.length > 0) {
                        const lastDeleteButton = deleteButtons[deleteButtons.length - 1];
                        lastDeleteButton.click();
                        deleted = true;
                        console.log('[删除主图] ✓ 已删除第', count, '张图片（方法2）');
                        return true;
                      }
                    }
                  } catch (error) {
                    // ignore
                  }
                }
                
                // 方法3: 强制点击删除图标
                if (!deleted) {
                  try {
                    const deleteIcons = lastWrapper.querySelectorAll("use[href='#icon-shanchu']");
                    if (deleteIcons && deleteIcons.length > 0) {
                      const lastIcon = deleteIcons[deleteIcons.length - 1];
                      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                      lastIcon.dispatchEvent(clickEvent);
                      deleted = true;
                      console.log('[删除主图] ✓ 已删除第', count, '张图片（方法3）');
                      return true;
                    }
                  } catch (error) {
                    // ignore
                  }
                }
                
                return deleted;
              };
              
              // 立即尝试第一次
              if (tryClick()) {
                resolve({ finished: false, deleted: true, count: count });
                return;
              }
              
              // 如果第一次失败，等待一小会儿再试（给悬停效果一点时间）
              setTimeout(() => {
                const success = tryClick();
                resolve({ finished: false, deleted: success, count: count });
              }, 200); // 优化：从800ms减少到200ms
            });
          })()
        `);
        
        if (result.finished) {
          console.log(`  ✓ 主图区域已清空`);
          if (result.reason) {
            console.log(`  → 原因: ${result.reason}`);
          }
          break;
        }
        
        if (result.deleted) {
          deletedCount++;
          // 优化：减少等待时间
          await wait(100); // 从500ms减少到100ms
        } else {
          console.log(`  ⚠ 未找到删除按钮，停止删除`);
          break;
        }
        
      } catch (error) {
        console.log(`  ⚠ 删除图片时出错: ${error.message}`);
        break;
      }
    }
    
    console.log(`\n  ✓ 主图区域共删除 ${deletedCount} 张图片`);
    
    // 3. 验证删除结果
    console.log(`\n[步骤4.3] 验证删除结果...`);
    await wait(500);
    
    const verifyResult = await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (!mainSection) {
          return { success: false, reason: '未找到主图区域' };
        }
        
        // 检查是否还有图片
        const imageWrappers = mainSection.querySelectorAll('div.index-module_imgWrapper__xOFF7');
        const remainingCount = imageWrappers ? imageWrappers.length : 0;
        
        // 检查是否显示上传按钮
        const uploadButtons = mainSection.querySelectorAll('label.index-module_button__st1_R');
        const uploadButtonCount = uploadButtons ? uploadButtons.length : 0;
        
        // 检查是否有"商品正面图"按钮
        const hasMainButton = Array.from(uploadButtons || []).some(btn => 
          btn.textContent && btn.textContent.includes('商品正面图')
        );
        
        // 检查是否有"上传辅助图"按钮
        const hasAuxButtons = Array.from(uploadButtons || []).some(btn => 
          btn.textContent && btn.textContent.includes('上传辅助图')
        );
        
        // 检查是否有错误提示（说明删除成功）
        const errorText = document.querySelector('.styles_publishErrorTextBottom__U_4YU');
        const hasErrorPrompt = errorText && errorText.textContent.includes('该项为必填项，请上传图片');
        
        // 检查是否有 has-error 类（说明删除成功）
        const hasErrorClass = mainSection.parentElement && 
          (mainSection.parentElement.classList.contains('has-error') || 
           mainSection.parentElement.classList.contains('ecom-g-zform-item-has-error'));
        
        return {
          success: remainingCount === 0 && uploadButtonCount === 5,
          remainingCount: remainingCount,
          uploadButtonCount: uploadButtonCount,
          hasMainButton: hasMainButton,
          hasAuxButtons: hasAuxButtons,
          hasErrorPrompt: hasErrorPrompt,
          hasErrorClass: hasErrorClass
        };
      })()
    `);
    
    if (verifyResult.success) {
      console.log(`  ✓ 验证通过：主图区域已完全清空`);
      console.log(`  → 剩余图片: ${verifyResult.remainingCount} 张`);
      console.log(`  → 上传按钮: ${verifyResult.uploadButtonCount} 个`);
      console.log(`  → 商品正面图按钮: ${verifyResult.hasMainButton ? '✓' : '✗'}`);
      console.log(`  → 上传辅助图按钮: ${verifyResult.hasAuxButtons ? '✓' : '✗'}`);
      console.log(`  → 错误提示: ${verifyResult.hasErrorPrompt ? '✓ "该项为必填项，请上传图片"' : '✗'}`);
      console.log(`  → 错误样式: ${verifyResult.hasErrorClass ? '✓ has-error' : '✗'}`);
    } else {
      console.log(`  ⚠ 验证失败：`);
      console.log(`  → 剩余图片: ${verifyResult.remainingCount} 张`);
      console.log(`  → 上传按钮: ${verifyResult.uploadButtonCount} 个（预期5个）`);
    }
    
    console.log(`========== [步骤4] 完成 ==========\n`);
    
    return { 
      success: true, 
      deletedCount,
      verified: verifyResult.success,
      remainingCount: verifyResult.remainingCount
    };
    
  } catch (error) {
    console.error(`  ✗ 删除主图失败: ${error.message}`);
    console.error(error.stack);
    return { 
      success: false, 
      message: `删除主图失败: ${error.message}` 
    };
  }
}

module.exports = {
  deleteMainImages
};
