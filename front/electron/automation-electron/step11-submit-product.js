/**
 * 步骤11: 提交商品（发布、保存草稿或下架）
 * 
 * 功能：
 * 1. 如果是下架模式（publishMode = 3）：
 *    - 先找到"服务与履约"区域的"商品状态"单选框
 *    - 点击"下架"单选框（value="1"）
 *    - 然后点击"发布商品"按钮
 * 2. 如果是其他模式：
 *    - publishMode = 1: 点击"保存草稿"按钮
 *    - publishMode = 2: 点击"发布商品"按钮（默认）
 * 3. 等待提交完成
 * 
 * 注意：
 * - 提交按钮在页面底部固定显示，不需要滚动
 * - 点击后可能会有确认弹窗或加载提示
 * - 需要等待提交完成后才能继续下一个商品
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
 * 提交商品（发布或保存草稿或下架）
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {number} publishMode - 发布模式：1=保存草稿，2=发布商品（默认），3=下架
 * @param {Object} options - 选项
 * @param {boolean} options.isLastTask - 是否是最后一个任务（如果是，则关闭窗口）
 * @returns {Promise<{success: boolean, message?: string, mode?: string}>}
 */
async function submitProduct(window, publishMode = 2, options = {}) {
  console.log(`\n========== [步骤11] 提交商品 ==========`);
  
  const { isLastTask = true } = options; // 默认是最后一个任务
  
  try {
    // 确定提交模式
    const mode = publishMode === 1 ? '保存草稿' : publishMode === 3 ? '下架' : '发布商品';
    console.log(`  → 提交模式: ${mode}`);
    console.log(`  → 是否最后一个任务: ${isLastTask ? '是' : '否'}`);
    
    // 1. 等待一下确保页面稳定
    console.log(`\n[步骤11.1] 准备提交...`);
    await wait(1000);
    
    // 2. 如果是下架模式，需要先修改"商品状态"为下架
    if (publishMode === 3) {
      console.log(`\n[步骤11.2] 设置商品状态为"下架"...`);
      
      const setOfflineResult = await executeJS(window, `
        (function() {
          console.log('[下架商品] 开始查找"商品状态"区域');
          
          // 查找包含"商品状态"的区域
          const allDivs = document.querySelectorAll('div[attr-field-id="商品状态"]');
          if (allDivs.length === 0) {
            return { success: false, message: '未找到"商品状态"区域' };
          }
          
          console.log('[下架商品] ✓ 找到"商品状态"区域，共', allDivs.length, '个');
          
          // 遍历所有匹配的区域，找到包含单选框的那个
          for (const div of allDivs) {
            // 查找该区域内的所有单选框
            const radioInputs = div.querySelectorAll('input[type="radio"]');
            
            if (radioInputs.length === 0) continue;
            
            console.log('[下架商品] ✓ 找到单选框组，共', radioInputs.length, '个选项');
            
            // 查找 value="1" 的单选框（下架）
            let offlineRadio = null;
            for (const radio of radioInputs) {
              if (radio.value === '1') {
                offlineRadio = radio;
                break;
              }
            }
            
            if (!offlineRadio) {
              console.log('[下架商品] ✗ 未找到 value="1" 的下架单选框');
              continue;
            }
            
            console.log('[下架商品] ✓ 找到"下架"单选框');
            
            // 检查是否已经选中
            if (offlineRadio.checked) {
              console.log('[下架商品] ✓ "下架"单选框已经选中');
              return { success: true, alreadyChecked: true };
            }
            
            // 点击下架单选框
            offlineRadio.click();
            console.log('[下架商品] ✓ 已点击"下架"单选框');
            
            return { success: true, alreadyChecked: false };
          }
          
          return { success: false, message: '未找到有效的"商品状态"单选框' };
        })()
      `);
      
      if (!setOfflineResult.success) {
        console.log(`  ✗ ${setOfflineResult.message}`);
        return setOfflineResult;
      }
      
      if (setOfflineResult.alreadyChecked) {
        console.log(`  ✓ 商品状态已经是"下架"`);
      } else {
        console.log(`  ✓ 已设置商品状态为"下架"`);
        // 等待一下让状态生效
        await wait(1000);
      }
    }
    
    // 3. 查找并点击对应的按钮（下架模式也是点击"发布商品"按钮）
    const buttonMode = publishMode === 1 ? '保存草稿' : '发布商品';
    console.log(`\n[步骤11.3] 查找"${buttonMode}"按钮...`);
    
    const clickResult = await executeJS(window, `
      (function() {
        const mode = '${buttonMode}';
        
        console.log('[提交商品] 开始查找按钮:', mode);
        
        // 查找底部按钮区域
        const footer = document.querySelector('.styles_footer__ygzmw');
        if (!footer) {
          return { success: false, message: '未找到底部按钮区域' };
        }
        
        console.log('[提交商品] ✓ 找到底部按钮区域');
        
        let targetButton = null;
        
        if (mode === '发布商品') {
          // 查找"发布商品"按钮（主按钮，蓝色）
          const buttons = footer.querySelectorAll('button.ecom-g-btn-primary');
          for (const button of buttons) {
            const text = button.textContent || '';
            if (text.includes('发布商品')) {
              targetButton = button;
              break;
            }
          }
        } else if (mode === '保存草稿') {
          // 查找"保存草稿"按钮（虚线按钮）
          const buttons = footer.querySelectorAll('button.ecom-g-btn-dashed');
          for (const button of buttons) {
            const text = button.textContent || '';
            if (text.includes('保存草稿')) {
              targetButton = button;
              break;
            }
          }
        }
        
        if (!targetButton) {
          return { success: false, message: '未找到"' + mode + '"按钮' };
        }
        
        console.log('[提交商品] ✓ 找到"' + mode + '"按钮');
        
        // 检查按钮是否可点击
        const isDisabled = targetButton.disabled || targetButton.classList.contains('ecom-g-btn-disabled');
        if (isDisabled) {
          return { success: false, message: '按钮不可点击（可能表单未填写完整）' };
        }
        
        console.log('[提交商品] ✓ 按钮可点击');
        
        // 点击按钮
        targetButton.click();
        console.log('[提交商品] ✓ 已点击"' + mode + '"按钮');
        
        return { success: true };
      })()
    `);
    
    if (!clickResult.success) {
      console.log(`  ✗ ${clickResult.message}`);
      return clickResult;
    }
    
    console.log(`  ✓ 已点击"${buttonMode}"按钮`);
    
    // ✅ 验证按钮点击是否生效（检查按钮是否变为loading状态）
    await wait(500);
    const buttonStateResult = await executeJS(window, `
      (function() {
        const mode = '${buttonMode}';
        const footer = document.querySelector('.styles_footer__ygzmw');
        if (!footer) return { found: false };
        
        let targetButton = null;
        if (mode === '发布商品') {
          const buttons = footer.querySelectorAll('button.ecom-g-btn-primary');
          for (const button of buttons) {
            if ((button.textContent || '').includes('发布商品')) {
              targetButton = button;
              break;
            }
          }
        } else if (mode === '保存草稿') {
          const buttons = footer.querySelectorAll('button.ecom-g-btn-dashed');
          for (const button of buttons) {
            if ((button.textContent || '').includes('保存草稿')) {
              targetButton = button;
              break;
            }
          }
        }
        
        if (!targetButton) return { found: false };
        
        const isLoading = targetButton.classList.contains('ecom-g-btn-loading');
        const isDisabled = targetButton.disabled;
        const text = targetButton.textContent || '';
        
        return { 
          found: true, 
          isLoading, 
          isDisabled,
          text: text.trim()
        };
      })()
    `);
    
    if (buttonStateResult.found) {
      if (buttonStateResult.isLoading) {
        console.log(`  ✓ 按钮进入loading状态，正在提交...`);
      } else if (buttonStateResult.isDisabled) {
        console.log(`  ✓ 按钮已禁用，正在处理...`);
      } else {
        console.log(`  → 按钮状态: ${buttonStateResult.text}`);
      }
    }
    
    // 4. 等待提交处理
    console.log(`\n[步骤11.4] 等待提交处理...`);
    await wait(1000);
    
    // 5. 检测是否有确认弹窗或成功弹窗
    console.log(`\n[步骤11.5] 检测弹窗...`);
    
    const modalResult = await executeJS(window, `
      (function() {
        // 查找可能的弹窗
        const modal = document.querySelector('.ecom-g-modal');
        const drawer = document.querySelector('.auxo-drawer');
        
        if (modal || drawer) {
          const container = modal || drawer;
          const modalText = container.textContent || '';
          
          console.log('[提交商品] ✓ 检测到弹窗');
          
          // 检查是否是"保存成功"弹窗（通过标题判断）
          const titleElement = container.querySelector('.ecom-g-modal-confirm-title');
          const title = titleElement ? titleElement.textContent.trim() : '';
          
          console.log('[提交商品] 弹窗标题:', title);
          
          if (title === '保存成功' || modalText.includes('保存成功')) {
            console.log('[提交商品] ✓ 检测到"保存成功"弹窗');
            
            // 查找"我知道了"按钮（在 .ecom-g-modal-confirm-btns 区域）
            const btnsArea = container.querySelector('.ecom-g-modal-confirm-btns');
            if (btnsArea) {
              const buttons = btnsArea.querySelectorAll('button.ecom-g-btn-primary');
              for (const button of buttons) {
                const text = button.textContent || '';
                if (text.includes('我知道了')) {
                  console.log('[提交商品] ✓ 找到"我知道了"按钮，准备点击');
                  button.click();
                  console.log('[提交商品] ✓ 已点击"我知道了"按钮');
                  return { found: true, type: 'success', clicked: true };
                }
              }
            }
            
            return { found: true, type: 'success', clicked: false, message: '未找到"我知道了"按钮' };
          }
          
          // 查找确认按钮（其他类型的弹窗）
          const confirmButtons = container.querySelectorAll('button.ecom-g-btn-primary');
          for (const button of confirmButtons) {
            const text = button.textContent || '';
            if (text.includes('确定') || text.includes('确认') || text.includes('发布')) {
              console.log('[提交商品] ✓ 找到确认按钮，准备点击');
              button.click();
              console.log('[提交商品] ✓ 已点击确认按钮');
              return { found: true, type: 'confirm', clicked: true };
            }
          }
          
          return { found: true, type: 'unknown', clicked: false, message: '未找到确认按钮' };
        }
        
        console.log('[提交商品] 未检测到弹窗');
        return { found: false };
      })()
    `);
    
    if (modalResult.found) {
      if (modalResult.clicked) {
        if (modalResult.type === 'success') {
          console.log(`  ✓ 已点击"我知道了"按钮（保存成功）`);
        } else {
          console.log(`  ✓ 已点击确认按钮`);
        }
        
        // ✅ 点击"我知道了"后，等待页面处理完成
        console.log(`\n[步骤11.6] 等待页面处理完成...`);
        await wait(1000); // 等待3秒让页面刷新或清空
        
        console.log(`  ✓ 保存操作已完成`);
        
        // 如果是最后一个任务，关闭窗口
        if (isLastTask) {
          console.log(`\n[步骤11.7] 最后一个任务完成，准备关闭窗口...`);
          console.log(`  → isLastTask = ${isLastTask}`);
          await wait(100);
          
          console.log(`  → 检查窗口状态: isDestroyed = ${window.isDestroyed()}`);
          
          if (!window.isDestroyed()) {
            console.log(`  ✓ 强制关闭裂变窗口（调用 window.destroy()）`);
            try {
              // ✅ 使用 destroy() 而不是 close()，确保窗口立即关闭
              window.destroy();
              console.log(`  ✓ window.destroy() 调用成功`);
            } catch (error) {
              console.error(`  ✗ window.destroy() 调用失败:`, error.message);
            }
          } else {
            console.log(`  → 窗口已经被销毁，无需关闭`);
          }
        } else {
          // 如果不是最后一个任务，等待页面完全刷新后再继续
          console.log(`\n[步骤11.7] 等待页面刷新完成，准备创建下一个商品...`);
          console.log(`  → isLastTask = ${isLastTask}`);
          await wait(100);
        }
        
        console.log(`========== [步骤11] 完成 ==========\n`);
        return {
          success: true,
          mode: mode,
          message: mode === '保存草稿' ? '草稿保存成功' : mode === '下架' ? '商品下架成功' : '商品发布成功'
        };
      } else {
        console.log(`  ⚠ ${modalResult.message}`);
      }
    } else {
      console.log(`  → 未出现弹窗`);
    }
    
    // ✅ 如果没有弹窗，等待并验证提交是否真的成功
    console.log(`\n[步骤11.6] 未检测到弹窗，验证提交状态...`);
    
    // 等待提交处理
    await wait(1000);
    
    // ✅ 验证提交是否成功：检查按钮状态和页面变化
    let submitVerified = false;
    let checkCount = 0;
    const maxChecks = 5; // 最多检查5次（10秒）
    
    while (!submitVerified && checkCount < maxChecks) {
      const verifyResult = await executeJS(window, `
        (function() {
          const mode = '${buttonMode}';
          
          // 1. 检查提交按钮状态
          const footer = document.querySelector('.styles_footer__ygzmw');
          if (!footer) {
            return { buttonFound: false, buttonState: 'not_found' };
          }
          
          let targetButton = null;
          if (mode === '发布商品') {
            const buttons = footer.querySelectorAll('button.ecom-g-btn-primary');
            for (const button of buttons) {
              if ((button.textContent || '').includes('发布商品')) {
                targetButton = button;
                break;
              }
            }
          } else if (mode === '保存草稿') {
            const buttons = footer.querySelectorAll('button.ecom-g-btn-dashed');
            for (const button of buttons) {
              if ((button.textContent || '').includes('保存草稿')) {
                targetButton = button;
                break;
              }
            }
          }
          
          if (!targetButton) {
            return { buttonFound: false, buttonState: 'not_found' };
          }
          
          const isLoading = targetButton.classList.contains('ecom-g-btn-loading');
          const isDisabled = targetButton.disabled;
          
          // 2. 检查是否有错误提示
          const errorElements = document.querySelectorAll('.styles_publishErrorTextBottom__U_4YU, .ecom-g-form-item-explain-error');
          let hasError = false;
          let errorMessage = '';
          
          for (const el of errorElements) {
            const text = el.textContent || '';
            if (text.trim() && !text.includes('该项为必填项')) {
              hasError = true;
              errorMessage = text.trim();
              break;
            }
          }
          
          // 3. 检查页面是否已跳转或刷新（标题输入框是否清空）
          const titleInput = document.querySelector('textarea[placeholder*="请输入商品标题"]');
          const titleValue = titleInput ? (titleInput.value || '').trim() : '';
          const titleCleared = titleValue === '';
          
          // 4. 检查URL是否变化（可能跳转到列表页）
          const currentUrl = window.location.href;
          const isListPage = currentUrl.includes('/product/list') || currentUrl.includes('/draft/list');
          
          return {
            buttonFound: true,
            buttonState: isLoading ? 'loading' : (isDisabled ? 'disabled' : 'normal'),
            hasError: hasError,
            errorMessage: errorMessage,
            titleCleared: titleCleared,
            isListPage: isListPage,
            currentUrl: currentUrl
          };
        })()
      `);
      
      if (!verifyResult.buttonFound) {
        // 按钮消失了，可能页面已刷新或跳转
        console.log(`  → 提交按钮消失，可能页面已刷新`);
        submitVerified = true;
        break;
      }
      
      if (verifyResult.hasError) {
        // 检测到错误提示
        console.log(`  ✗ 检测到错误提示: ${verifyResult.errorMessage}`);
        console.log(`========== [步骤11] 完成（提交失败） ==========\n`);
        return {
          success: false,
          mode: mode,
          message: `提交失败: ${verifyResult.errorMessage}`
        };
      }
      
      if (verifyResult.isListPage) {
        // 已跳转到列表页
        console.log(`  ✓ 已跳转到列表页: ${verifyResult.currentUrl}`);
        submitVerified = true;
        break;
      }
      
      if (verifyResult.titleCleared && verifyResult.buttonState === 'normal') {
        // 标题已清空且按钮恢复正常，说明提交成功并刷新了页面
        console.log(`  ✓ 页面已刷新，标题已清空`);
        submitVerified = true;
        break;
      }
      
      if (verifyResult.buttonState === 'loading') {
        // 还在提交中
        console.log(`  → 按钮仍在loading状态，继续等待...`);
      } else if (verifyResult.buttonState === 'normal' && !verifyResult.titleCleared) {
        // 按钮恢复正常但标题未清空，可能提交失败但没有错误提示
        console.log(`  ⚠ 按钮恢复正常但页面未刷新，可能提交失败`);
        checkCount++;
        
        if (checkCount >= maxChecks) {
          console.log(`  ✗ 提交状态异常，无法确认是否成功`);
          console.log(`========== [步骤11] 完成（状态不明） ==========\n`);
          return {
            success: false,
            mode: mode,
            message: '提交状态异常，无法确认是否成功'
          };
        }
      }
      
      await wait(1000);
      checkCount++;
    }
    
    if (submitVerified) {
      console.log(`  ✓ 提交成功已验证`);
    } else {
      // console.log(`  ⚠ 无法验证提交状态，假定成功`);
      // 新增：如果提交失败，也返回失败状态
      console.log(`  ✗ 无法验证提交状态，可能是页面卡顿或网络异常`);
      console.log(`========== [步骤11] 完成（状态不明） ==========\n`);
      return {
        success: false,
        mode: mode,
        message: '提交状态异常，无法确认是否成功，请检查抖店后台'
      };
    }
    // 如果是最后一个任务，关闭窗口
    if (isLastTask) {
      console.log(`\n[步骤11.7] 最后一个任务完成，准备关闭窗口...`);
      console.log(`  → isLastTask = ${isLastTask}`);
      await wait(1000);
      
      console.log(`  → 检查窗口状态: isDestroyed = ${window.isDestroyed()}`);
      
      if (!window.isDestroyed()) {
        console.log(`  ✓ 强制关闭裂变窗口（调用 window.destroy()）`);
        try {
          // ✅ 使用 destroy() 而不是 close()，确保窗口立即关闭
          window.destroy();
          console.log(`  ✓ window.destroy() 调用成功`);
        } catch (error) {
          console.error(`  ✗ window.destroy() 调用失败:`, error.message);
        }
      } else {
        console.log(`  → 窗口已经被销毁，无需关闭`);
      }
    } else {
      // 如果不是最后一个任务，等待页面完全刷新后再继续
      console.log(`\n[步骤11.7] 等待页面刷新完成，准备创建下一个商品...`);
      console.log(`  → isLastTask = ${isLastTask}`);
      await wait(100);
    }
    console.log(`========== [步骤11] 完成 ==========\n`);
    return {
      success: true,
      mode: mode,
      message: mode === '保存草稿' ? '草稿保存成功' : mode === '下架' ? '商品下架成功' : '商品发布成功'
    };
  } catch (error) {
    console.error(`  ✗ 提交商品失败: ${error.message}`);
    console.error(error.stack);
    return {
      success: false,
      message: `提交商品失败: ${error.message}`
    };
  }
}

module.exports = {
  submitProduct
};
