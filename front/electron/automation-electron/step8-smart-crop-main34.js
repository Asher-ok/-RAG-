/**
 * 步骤8: 点击"从1:1主图智能裁剪"按钮，自动生成3:4主图
 * 
 * 功能：
 * 1. 定位到主图3:4区域
 * 2. 查找并点击"从1:1主图智能裁剪"按钮
 * 3. 等待智能裁剪完成（约12秒）
 * 4. 验证主图3:4区域是否有5张图片
 * 
 * 注意：
 * - 必须在主图区域已上传5张图片后才能执行
 * - 点击按钮后会自动将主图1:1的5张图片裁剪成3:4比例
 * - 裁剪过程需要等待约12秒
 * - 最终主图3:4区域应该有5张图片
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
 * 点击"从1:1主图智能裁剪"按钮
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function smartCropMain34(window) {
  console.log(`\n========== [步骤8] 智能裁剪生成3:4主图 ==========`);
  
  try {
    // 0. 前置检查：检查是否有1:1主图（数据源）
    // 如果没有主图，无法进行裁剪，直接跳过
    const sourceCheck = await executeJS(window, `
      (function() {
        const mainSection = document.querySelector('[attr-field-id="主图"]');
        if (!mainSection) return { hasImages: false };
        
        const imgs = mainSection.querySelectorAll('img.index-module_img__j6_h0');
        const wrappers = mainSection.querySelectorAll('.index-module_imgWrapper__xOFF7');
        const count = Math.max(imgs ? imgs.length : 0, wrappers ? wrappers.length : 0);
        
        return { hasImages: count > 0, count: count };
      })()
    `);

    if (!sourceCheck.hasImages) {
      console.log(`  ⚠ 未检测到1:1主图（源数据为空），跳过智能裁剪`);
      console.log(`========== [步骤8] 跳过 (无主图) ==========\n`);
      return { success: false, skipped: true, message: '无1:1主图，跳过' };
    }

    console.log(`  ✓ 检测到 ${sourceCheck.count} 张1:1主图，继续执行...`);

    // 1. 滚动到主图3:4区域
    console.log(`[步骤8.1] 定位到主图3:4区域...`);
    await executeJS(window, `
      (function() {
        const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
        if (main34Section) {
          main34Section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      })()
    `);
    await wait(500);
    console.log(`  ✓ 已定位到主图3:4区域`);
    
    // 2. 最多尝试3次点击智能裁剪按钮
    let attemptCount = 0;
    const maxAttempts = 3;
    let cropSuccess = false;
    let lastVerifyResult = null;
    
    while (!cropSuccess && attemptCount < maxAttempts) {
      attemptCount++;
      console.log(`\n[步骤8.2] 第${attemptCount}次尝试智能裁剪...`);
      
      // 2.1 查找并点击"从1:1主图智能裁剪"按钮
      console.log(`  → 查找"从1:1主图智能裁剪"按钮...`);
      
      const clickResult = await executeJS(window, `
        (function() {
          // 查找主图3:4区域
          const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
          if (!main34Section) {
            return { success: false, message: '未找到主图3:4区域' };
          }
          
          // 查找"从1:1主图智能裁剪"按钮
          // 方法1: 使用精确的文本匹配
          const buttons = main34Section.querySelectorAll('button.ecom-g-btn-link');
          let cropButton = null;
          
          for (const button of buttons) {
            const text = button.textContent || '';
            if (text.includes('从1:1主图智能裁剪')) {
              cropButton = button;
              break;
            }
          }
          
          if (!cropButton) {
            // 方法2: 使用更宽泛的选择器
            const allButtons = document.querySelectorAll('button');
            for (const button of allButtons) {
              const text = button.textContent || '';
              if (text.includes('从1:1主图智能裁剪') || text.includes('智能裁剪')) {
                // 确保按钮在主图3:4区域内或附近
                const buttonRect = button.getBoundingClientRect();
                const sectionRect = main34Section.getBoundingClientRect();
                
                // 检查按钮是否在区域附近（允许一定的偏差）
                if (Math.abs(buttonRect.top - sectionRect.top) < 200) {
                  cropButton = button;
                  break;
                }
              }
            }
          }
          
          if (!cropButton) {
            return { success: false, message: '未找到"从1:1主图智能裁剪"按钮' };
          }
          
          console.log('[智能裁剪] ✓ 找到"从1:1主图智能裁剪"按钮');
          console.log('[智能裁剪] 按钮文本:', cropButton.textContent);
          
          // 确保按钮可见并可点击
          cropButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // 等待一下确保滚动完成
          return new Promise(resolve => {
            setTimeout(() => {
              // 点击按钮
              cropButton.click();
              console.log('[智能裁剪] ✓ 已点击"从1:1主图智能裁剪"按钮');
              resolve({ success: true });
            }, 200); // 优化：减少等待时间 500ms -> 200ms
          });
        })()
      `);
      
      if (!clickResult.success) {
        console.log(`  ✗ ${clickResult.message}`);
        
        // 如果找不到按钮，不再重试
        return clickResult;
      }
      
      console.log(`  ✓ 已点击"从1:1主图智能裁剪"按钮`);
      
      // 2.2 动态等待智能裁剪完成（带进展检测）
      console.log(`\n  → 等待智能裁剪完成（动态检测）...`);
      
      const maxWaitTime = 15000; // 最多等待15秒
      const checkInterval = 200; // 优化：每200ms检查一次 (原2000ms)
      const noProgressTimeout = 8000; // 优化：延长无进展判定时间到8秒，避免误判
      const startTime = Date.now();
      let lastImageCount = 0;
      let noProgressStartTime = Date.now();
      let cropCompleted = false;
      
      while (Date.now() - startTime < maxWaitTime) {
        await wait(checkInterval);
        
        // 检查当前图片数量
        const checkResult = await executeJS(window, `
          (function() {
            const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
            if (!main34Section) {
              return { totalCount: 0 };
            }
            
            const parentContainer = main34Section.parentElement;
            if (!parentContainer) {
              return { totalCount: 0 };
            }
            
            const uploadedImages = parentContainer.querySelectorAll('img.index-module_img__j6_h0');
            const imageWrappers = parentContainer.querySelectorAll('.index-module_imgWrapper__xOFF7');
            const totalCount = Math.max(
              uploadedImages ? uploadedImages.length : 0,
              imageWrappers ? imageWrappers.length : 0
            );
            
            return { totalCount: totalCount };
          })()
        `);
        
        const currentImageCount = checkResult.totalCount;
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // 仅在状态变化或每秒打印一次日志，避免刷屏
        if (currentImageCount !== lastImageCount || Math.floor(Date.now() / 1000) % 2 === 0) {
             // console.log(`  → 检查裁剪进度: ${currentImageCount}/5 张（已等待 ${elapsedTime} 秒）`);
        }
        
        // 如果已经达到5张，裁剪完成
        if (currentImageCount >= 5) {
          console.log(`  ✓ 智能裁剪完成（耗时 ${elapsedTime} 秒）`);
          cropCompleted = true;
          break;
        }
        
        // 检测进展：如果图片数量增加，重置无进展计时器
        if (currentImageCount > lastImageCount) {
          console.log(`  ✓ 检测到裁剪进展: ${lastImageCount} → ${currentImageCount}`);
          lastImageCount = currentImageCount;
          noProgressStartTime = Date.now();
        } else {
          // 没有进展，检查是否超过无进展超时
          const noProgressDuration = Date.now() - noProgressStartTime;
          
          if (noProgressDuration >= noProgressTimeout) {
            console.log(`  ⚠ 检测到裁剪停滞: ${noProgressDuration / 1000}秒内无进展（${currentImageCount}/5）`);
            
            // 如果有部分图片生成，可能只是慢，再给3秒机会
            if (currentImageCount > 0 && currentImageCount < 5) {
              console.log(`  → 已生成${currentImageCount}张，再等待3秒...`);
              await wait(3000);
              
              // 再次检查
              const finalCheck = await executeJS(window, `
                (function() {
                  const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
                  if (!main34Section) return { totalCount: 0 };
                  
                  const parentContainer = main34Section.parentElement;
                  if (!parentContainer) return { totalCount: 0 };
                  
                  const uploadedImages = parentContainer.querySelectorAll('img.index-module_img__j6_h0');
                  const imageWrappers = parentContainer.querySelectorAll('.index-module_imgWrapper__xOFF7');
                  const totalCount = Math.max(
                    uploadedImages ? uploadedImages.length : 0,
                    imageWrappers ? imageWrappers.length : 0
                  );
                  
                  return { totalCount: totalCount };
                })()
              `);
              
              if (finalCheck.totalCount >= 5) {
                console.log(`  ✓ 智能裁剪完成（延迟完成）`);
                cropCompleted = true;
                break;
              }
            }
            
            // 停滞且没有完成，判定为失败
            console.log(`  ✗ 裁剪停滞，判定为失败`);
            break;
          }
        }
      }
      
      // 超时检查
      if (!cropCompleted && Date.now() - startTime >= maxWaitTime) {
        console.log(`  ⚠ 等待超时（30秒），裁剪可能失败`);
      }
      
      // 2.3 最终验证裁剪结果
      console.log(`\n  → 最终验证智能裁剪结果...`);
      
      const verifyResult = await executeJS(window, `
        (function() {
          const main34Section = document.querySelector('[attr-field-id="主图3:4"]');
          if (!main34Section) {
            return { success: false, message: '未找到主图3:4区域' };
          }
          
          // 图片在主图3:4区域的父容器内部，不是兄弟元素
          // 直接从主图3:4的父容器中查找图片
          const parentContainer = main34Section.parentElement;
          if (!parentContainer) {
            return { success: false, totalCount: 0 };
          }
          
          // 检查是否有已上传的图片
          const uploadedImages = parentContainer.querySelectorAll('img.index-module_img__j6_h0');
          const imageCount = uploadedImages ? uploadedImages.length : 0;
          
          // 检查是否有AI标记的图片容器
          const imageWrappers = parentContainer.querySelectorAll('.index-module_imgWrapper__xOFF7');
          const wrapperCount = imageWrappers ? imageWrappers.length : 0;
          
          // 检查按钮文本是否变化（可能变成"取消智能裁剪"）
          const buttons = parentContainer.querySelectorAll('button.ecom-g-btn-link');
          let buttonText = '';
          for (const button of buttons) {
            const text = button.textContent || '';
            if (text.includes('裁剪')) {
              buttonText = text;
              break;
            }
          }
          
          console.log('[智能裁剪] 验证结果:');
          console.log('[智能裁剪]   - 图片数量:', imageCount);
          console.log('[智能裁剪]   - 图片容器数量:', wrapperCount);
          console.log('[智能裁剪]   - 按钮文本:', buttonText);
          
          // 判断裁剪是否成功：应该有5张图片
          const totalCount = Math.max(imageCount, wrapperCount);
          const cropSuccess = totalCount === 5;
          
          return {
            success: cropSuccess,
            imageCount: imageCount,
            wrapperCount: wrapperCount,
            totalCount: totalCount,
            buttonText: buttonText
          };
        })()
      `);
      
      lastVerifyResult = verifyResult;
      
      if (verifyResult.success) {
        console.log(`  ✓ 智能裁剪成功`);
        console.log(`  → 主图3:4区域图片数量: ${verifyResult.totalCount} 张`);
        console.log(`  → 按钮文本: ${verifyResult.buttonText}`);
        cropSuccess = true;
        break;
      } else {
        console.log(`  ⚠ 智能裁剪未完成`);
        console.log(`  → 主图3:4区域图片数量: ${verifyResult.totalCount} 张（预期5张）`);
        console.log(`  → 图片数量: ${verifyResult.imageCount}`);
        console.log(`  → 容器数量: ${verifyResult.wrapperCount}`);
        console.log(`  → 按钮文本: ${verifyResult.buttonText}`);
        
        // 如果还没成功且还有重试次数，继续重试
        if (attemptCount < maxAttempts) {
          console.log(`\n  → 准备第${attemptCount + 1}次重试...`);
          await wait(1000);
        }
      }
    }
    
    // 3. 最终结果
    if (cropSuccess) {
      console.log(`\n========== [步骤8] 完成（尝试${attemptCount}次） ==========\n`);
      return {
        success: true,
        imageCount: lastVerifyResult.totalCount,
        attempts: attemptCount,
        details: lastVerifyResult
      };
    } else {
      console.log(`\n========== [步骤8] 失败（尝试${attemptCount}次后仍未成功） ==========\n`);
      return {
        success: false,
        message: `智能裁剪失败：尝试${attemptCount}次后图片数量仍为${lastVerifyResult.totalCount}张（预期5张）`,
        imageCount: lastVerifyResult.totalCount,
        attempts: attemptCount,
        details: lastVerifyResult
      };
    }
    
  } catch (error) {
    console.error(`  ✗ 智能裁剪失败: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `智能裁剪失败: ${error.message}`
    };
  }
}

module.exports = {
  smartCropMain34
};
