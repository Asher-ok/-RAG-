/**
 * 步骤9: 删除详情图片区域的所有图片
 * 
 * 功能：
 * 1. 定位到"详情编辑"区域
 * 2. 查找所有已上传的详情图片
 * 3. 循环删除第一张图片，直到所有图片删除完成
 * 4. 验证删除是否完成（应显示"已上传 0/50张"）
 * 
 * 注意：
 * - 每次只删除第一张图片（第一张永远在可见区域）
 * - 删除后，后面的图片会自动前移，第二张变成第一张
 * - 每次删除后需要等待DOM更新
 * - 删除完成后，详情编辑区域应该为空
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
 * 删除详情图片区域的所有图片
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Function} progressCallback - 进度回调函数（可选）
 * @returns {Promise<{success: boolean, message?: string, deletedCount?: number}>}
 */
async function deleteDetailImages(window, progressCallback = null) {
  console.log(`\n========== [步骤9] 删除详情图片 ==========`);
  
  try {
    // 1. 滚动到详情编辑区域
    console.log(`[步骤9.1] 定位到详情编辑区域...`);
    await executeJS(window, `
      (function() {
        // 查找详情编辑区域
        const detailSection = document.querySelector('.styles_decorateImgManageWrapper__SIpnI');
        if (detailSection) {
          detailSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })()
    `);
    await wait(500);
    console.log(`  ✓ 已定位到详情编辑区域`);
    
    // 2. 获取详情图片数量（从"已上传X/50张"文本中读取）
    console.log(`\n[步骤9.2] 检查详情图片数量...`);
    
    const countResult = await executeJS(window, `
      (function() {
        // 查找"已上传X/50张"文本
        const uploadText = document.querySelector('.styles_decorateImgEditDescNew__kW6EW');
        if (!uploadText) {
          return { success: false, message: '未找到上传状态文本' };
        }
        
        const textContent = uploadText.textContent || '';
        console.log('[删除详情图] 上传状态文本:', textContent);
        
        // 解析"已上传X/50张"，提取数字X
        const match = textContent.match(/已上传(\\d+)/);
        if (!match) {
          return { success: false, message: '无法解析图片数量' };
        }
        
        const imageCount = parseInt(match[1], 10);
        console.log('[删除详情图] 解析到图片数量:', imageCount);
        
        return {
          success: true,
          count: imageCount
        };
      })()
    `);
    
    if (!countResult.success) {
      console.log(`  ✗ ${countResult.message}`);
      return countResult;
    }
    
    const imageCount = countResult.count;
    console.log(`  → 找到 ${imageCount} 张详情图片`);
    
    if (imageCount === 0) {
      console.log(`  → 详情图片已经为空，无需删除`);
      console.log(`========== [步骤9] 完成 ==========\n`);
      return { success: true, deletedCount: 0 };
    }
    
    // 3. 循环删除图片，每次都重新检查数量
    console.log(`\n[步骤9.3] 开始删除图片...`);
    
    let deletedCount = 0;
    let remainingCount = imageCount;
    let consecutiveFailures = 0; // 连续失败次数
    const maxConsecutiveFailures = 3; // 最多允许连续失败3次
    let consecutiveCountCheckFailures = 0; // 连续无法获取数量的次数
    const maxCountCheckFailures = 3; // 最多允许连续3次无法获取数量
    let lastValidCount = imageCount; // 上一次成功获取的数量
    
    while (remainingCount > 0) {
      console.log(`  → 剩余 ${remainingCount} 张图片，删除第一张...`);
      
      // 直接删除，不做任何检查
      const deleteResult = await executeJS(window, `
        (function() {
          // 查找详情图片列表容器
          const imageList = document.querySelector('.styles_decorateImgManageWrapper__SIpnI .styles_previewInstanceImgSortableList__fdC4o');
          if (!imageList) {
            return { success: false, message: '未找到详情图片列表' };
          }
          
          // 查找所有图片容器
          const imageWrappers = imageList.querySelectorAll('.styles_imgWrapper__dqiHn');
          
          // 找到第一张有效图片（不是占位图）
          let firstValidWrapper = null;
          for (const wrapper of imageWrappers) {
            const img = wrapper.querySelector('img.styles_img__Hq35m');
            if (img) {
              const src = img.getAttribute('src') || '';
              if (!src.startsWith('data:image/gif')) {
                firstValidWrapper = wrapper;
                break;
              }
            }
          }
          
          if (!firstValidWrapper) {
            return { success: false, message: '没有找到可删除的图片' };
          }
          
          // 先触发鼠标悬停
          const mouseoverEvent = new MouseEvent('mouseover', { bubbles: true, cancelable: true });
          firstValidWrapper.dispatchEvent(mouseoverEvent);
          
          // 优化：尝试直接查找删除按钮，不需要长等待
          return new Promise(resolve => {
            const tryClick = () => {
              const deleteIcon = firstValidWrapper.querySelector('.styles_iconDelete__y_88a');
              
              if (!deleteIcon) return false;
              
              console.log('[删除详情图] 点击第一张图片的删除按钮');
              deleteIcon.click();
              return true;
            };
            
            // 立即尝试
            if (tryClick()) {
              resolve({ success: true });
              return;
            }
            
            // 稍后重试
            setTimeout(() => {
              const success = tryClick();
              if (success) {
                resolve({ success: true });
              } else {
                resolve({ success: false, message: '未找到删除按钮' });
              }
            }, 200); // 优化：从800ms减少到200ms
          });
        })()
      `);
      
      if (deleteResult.success) {
        deletedCount++;
        consecutiveFailures = 0; // 重置连续失败计数
        console.log(`    ✓ 删除成功`);
        
        // ✅ 发送进度更新（使用固定的步骤名，让Redux自动更新同一个步骤）
        if (progressCallback) {
          await progressCallback({
            step: '删除详情图',
            status: 'processing',
            message: `正在删除详情图片...`,
            details: `已删除 ${deletedCount}/${imageCount} 张`,
            timestamp: new Date().toISOString()
          });
        }
        
        // 等待DOM更新（优化等待时间）
        await wait(200); // 从1000ms减少到200ms
        
        // 重新获取剩余图片数量
        const checkResult = await executeJS(window, `
          (function() {
            const uploadText = document.querySelector('.styles_decorateImgEditDescNew__kW6EW');
            if (!uploadText) {
              return { success: false, count: -1 };
            }
            
            const textContent = uploadText.textContent || '';
            const match = textContent.match(/已上传(\\d+)/);
            
            if (!match) {
              return { success: false, count: -1 };
            }
            
            return { success: true, count: parseInt(match[1], 10) };
          })()
        `);
        
        if (checkResult.success) {
          // ✅ 成功获取数量
          remainingCount = checkResult.count;
          lastValidCount = checkResult.count;
          consecutiveCountCheckFailures = 0; // 重置计数检查失败次数
          console.log(`    → 当前剩余: ${remainingCount} 张`);
        } else {
          // ✅ 无法获取数量，增加失败计数
          consecutiveCountCheckFailures++;
          console.log(`    ⚠ 无法获取剩余数量（第${consecutiveCountCheckFailures}次）`);
          
          // ✅ 如果连续多次无法获取数量，判定为页面异常
          if (consecutiveCountCheckFailures >= maxCountCheckFailures) {
            console.log(`    ✗ 连续${maxCountCheckFailures}次无法获取图片数量，可能页面结构变化`);
            console.log(`    → 停止删除，使用最后有效数量: ${lastValidCount}`);
            break;
          }
          
          // ✅ 使用最后有效数量减1作为估算（而不是盲目减1）
          remainingCount = Math.max(0, lastValidCount - 1);
          console.log(`    → 估算剩余: ${remainingCount} 张（基于最后有效数量 ${lastValidCount}）`);
        }
        
      } else {
        console.log(`    ⚠ 删除失败: ${deleteResult.message}`);
        consecutiveFailures++;
        
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.log(`    ✗ 连续失败${maxConsecutiveFailures}次，停止删除`);
          break;
        }
        
        // 等待后重试
        await wait(1000);
      }
    }
    
    console.log(`\n  ✓ 已删除 ${deletedCount} 张图片`);
    
    // 4. 等待删除完成（增加等待时间，让页面完全稳定）
    console.log(`\n[步骤9.4] 等待删除完成...`);
    await wait(3000); // 从2秒增加到5秒
    
    // 5. 验证删除结果
    console.log(`\n[步骤9.5] 验证删除结果...`);
    
    const verifyResult = await executeJS(window, `
      (function() {
        // 查找详情图片列表容器
        const imageList = document.querySelector('.styles_decorateImgManageWrapper__SIpnI .styles_previewInstanceImgSortableList__fdC4o');
        if (!imageList) {
          return { success: false, message: '未找到详情图片列表' };
        }
        
        // 查找所有图片容器
        const imageWrappers = imageList.querySelectorAll('.styles_imgWrapper__dqiHn');
        
        // 过滤出有效图片
        let validImages = 0;
        for (const wrapper of imageWrappers) {
          const img = wrapper.querySelector('img.styles_img__Hq35m');
          if (img) {
            const src = img.getAttribute('src') || '';
            if (!src.startsWith('data:image/gif')) {
              validImages++;
            }
          }
        }
        
        // 检查"已上传"文本
        const uploadText = document.querySelector('.styles_decorateImgEditDescNew__kW6EW');
        const uploadTextContent = uploadText ? uploadText.textContent : '';
        
        console.log('[删除详情图] 验证结果:');
        console.log('[删除详情图]   - 剩余图片数量:', validImages);
        console.log('[删除详情图]   - 上传文本:', uploadTextContent);
        
        // 判断删除是否成功：应该没有图片，且显示"已上传 0/50张"
        const deleteSuccess = validImages === 0 && uploadTextContent.includes('已上传0');
        
        return {
          success: deleteSuccess,
          remainingCount: validImages,
          uploadText: uploadTextContent
        };
      })()
    `);
    
    if (verifyResult.success) {
      console.log(`  ✓ 详情图片删除成功`);
      console.log(`  → 剩余图片: ${verifyResult.remainingCount} 张`);
      console.log(`  → 上传状态: ${verifyResult.uploadText}`);
    } else {
      console.log(`  ⚠ 详情图片可能未完全删除`);
      console.log(`  → 剩余图片: ${verifyResult.remainingCount} 张`);
      console.log(`  → 上传状态: ${verifyResult.uploadText}`);
    }
    
    console.log(`========== [步骤9] 完成 ==========\n`);
    
    return {
      success: verifyResult.success,
      deletedCount: deletedCount,
      remainingCount: verifyResult.remainingCount,
      details: verifyResult
    };
    
  } catch (error) {
    console.error(`  ✗ 删除详情图片失败: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `删除详情图片失败: ${error.message}`
    };
  }
}

module.exports = {
  deleteDetailImages
};
