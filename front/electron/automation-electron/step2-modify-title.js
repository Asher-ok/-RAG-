/**
 * 步骤2: 修改商品标题
 * 
 * 功能：
 * 1. 生成新标题（支持循环标题列表）
 * 2. 添加零宽字符确保标题唯一性
 * 3. 填入标题输入框
 * 
 * 标题生成逻辑：
 * - 如果有循环标题列表：使用 titleReplacements[index % length] + titleSuffix + 随机后缀
 * - 如果没有循环标题：使用 原标题 + titleSuffix + 随机后缀
 * - 随机后缀：4位大写字母+数字（如：A3F9）
 * - 零宽字符：在标题中间插入3个零宽字符（\u200B、\u200C、\u200D）
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
 * 生成随机后缀（4位大写字母+数字）
 * @param {number} length - 后缀长度，默认4
 * @returns {string} 随机后缀，如：A3F9
 */
function generateRandomSuffix(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成新标题
 * 
 * @param {string} originalTitle - 原商品标题
 * @param {number} index - 当前索引（用于循环标题）
 * @param {Object} options - 选项
 * @param {string[]} options.titleReplacements - 循环标题列表
 * @param {string} options.titleSuffix - 标题后缀
 * @returns {string} 新标题
 */
function generateNewTitle(originalTitle, index, options = {}) {
  const { titleReplacements, titleSuffix } = options;
  
  let newTitle;
  
  // 1. 确定基础标题
  if (titleReplacements && titleReplacements.length > 0) {
    // 使用循环标题列表
    const replacementIndex = index % titleReplacements.length;
    const baseTitle = titleReplacements[replacementIndex];
    console.log(`  → 使用循环标题 #${replacementIndex + 1}/${titleReplacements.length}: ${baseTitle}`);
    
    // 标题 = 循环标题 + 标题后缀（不添加可见的随机后缀）
    if (titleSuffix) {
      newTitle = `${baseTitle}${titleSuffix}`;
    } else {
      newTitle = baseTitle;
    }
  } else {
    // 使用原标题
    console.log(`  → 使用原标题: ${originalTitle}`);
    
    // 标题 = 原标题 + 标题后缀（不添加可见的随机后缀）
    if (titleSuffix) {
      newTitle = `${originalTitle} ${titleSuffix}`;
    } else {
      newTitle = originalTitle;
    }
  }
  
  // 2. 确保标题不超过60字符
  if (newTitle.length > 60) {
    console.log(`  ⚠ 标题过长(${newTitle.length}字符)，截断到60字符`);
    newTitle = newTitle.substring(0, 60);
  }
  
  return newTitle;
}

/**
 * 修改商品标题（简化版 - 直接使用传入的标题）
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {string} newTitle - 新标题（已经生成好的）
 * @param {number} index - 当前索引（未使用，保留兼容性）
 * @param {Object} options - 选项（未使用，保留兼容性）
 * @returns {Promise<{success: boolean, message?: string, title?: string}>}
 */
async function modifyProductTitle(window, newTitle, index, options = {}) {
  console.log(`\n========== [步骤2] 修改商品标题 ==========`);
  
  try {
    console.log(`[步骤2.1] 使用传入的标题: ${newTitle}`);
    
    // 添加不可见字符（不可见字符）使标题唯一
    console.log(`\n[步骤2.2] 添加不可见字符确保唯一性...`);
    console.log(`  → 原标题长度: ${newTitle.length}字符`);
    
    // ✅ 先检查标题长度，确保加上不可见字符后不超过60字符
    const maxInvisibleChars = 4; // ✅ 最多4个不可见字符（减少长度占用）
    const maxTitleLength = 60;
    
    // ✅ 使用新变量存储处理后的标题
    let processedTitle = newTitle;
    
    // 如果原标题 + 最大不可见字符数 > 60，需要截断原标题
    if (processedTitle.length + maxInvisibleChars > maxTitleLength) {
      const maxVisibleLength = maxTitleLength - maxInvisibleChars;
      console.log(`  ⚠ 标题过长(${processedTitle.length}字符)，需要截断到 ${maxVisibleLength} 字符`);
      processedTitle = processedTitle.substring(0, maxVisibleLength);
      console.log(`  → 截断后标题: ${processedTitle} (${processedTitle.length}字符)`);
    }
    
    // ✅ 使用多种真正不可见的Unicode字符
    const invisibleChars = [
      '\u200B', // 零宽空格 (Zero Width Space)
      '\u200C', // 零宽非连接符 (Zero Width Non-Joiner)
      '\u200D', // 零宽连接符 (Zero Width Joiner)
      '\uFEFF'  // 零宽非断空格 (Zero Width No-Break Space / BOM)
    ];
    
    // 生成随机的不可见字符组合（2-4个字符，减少长度占用）
    const randomLength = 2 + Math.floor(Math.random() * 3); // 2-4个
    let randomInvisible = '';
    for (let i = 0; i < randomLength; i++) {
      randomInvisible += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    }
    
    // ✅ 在标题末尾添加不可见字符（而不是中间），这样更不容易被发现
    const titleWithHidden = processedTitle + randomInvisible;
    console.log(`  ✓ 已在标题末尾添加${randomLength}个不可见字符`);
    console.log(`  → 显示标题: ${processedTitle} (${processedTitle.length}字符)`);
    console.log(`  → 实际长度: ${titleWithHidden.length}字符 (含不可见字符)`);
    
    // ✅ 最终验证：确保不超过60字符
    if (titleWithHidden.length > maxTitleLength) {
      console.error(`  ✗ 错误：标题长度超过限制 (${titleWithHidden.length} > ${maxTitleLength})`);
      return {
        success: false,
        message: `标题长度超过限制: ${titleWithHidden.length}字符 > ${maxTitleLength}字符`
      };
    }
    
    // 先尝试不可见字符方案
    let finalTitle = titleWithHidden;
    
    // 3. 填入标题输入框（带循环截断逻辑）
    console.log(`\n[步骤2.3] 填入标题输入框...`);
    
    let attemptCount = 0;
    const maxAttempts = 5; // 最多尝试5次
    let currentTitle = finalTitle;
    let fillSuccess = false;
    
    while (attemptCount < maxAttempts && !fillSuccess) {
      attemptCount++;
      console.log(`\n[步骤2.3.${attemptCount}] 第${attemptCount}次尝试填入标题...`);
      console.log(`  → 当前标题长度: ${currentTitle.length}字符`);
      
      const result = await executeJS(window, `
        (async function() {
          const newTitle = ${JSON.stringify(currentTitle)};
          
          console.log('[标题修改] 开始查找标题输入框...');
          console.log('[标题修改] 标题长度:', newTitle.length);
          
          // 查找标题输入框（使用精确的选择器，排除导购短标题）
          let titleInput = null;
          
          // 方法1: 使用ID选择器（最精确）
          titleInput = document.querySelector("input#pg-title-input");
          if (titleInput) {
            console.log('[标题修改] ✓ 找到标题输入框（方法1: ID选择器）');
          }
          
          // 方法2: 使用dropdownclassname属性（排除导购短标题）
          if (!titleInput) {
            const inputs = document.querySelectorAll("input[dropdownclassname]");
            for (const input of inputs) {
              const className = input.getAttribute('dropdownclassname');
              // 只匹配包含"商品标题"的，排除"导购短标题"
              if (className && className.includes('商品标题') && !className.includes('导购')) {
                titleInput = input;
                console.log('[标题修改] ✓ 找到标题输入框（方法2: dropdownclassname）');
                break;
              }
            }
          }
          
          // 方法3: 使用placeholder精确匹配（排除导购短标题）
          if (!titleInput) {
            const inputs = document.querySelectorAll("input[placeholder]");
            for (const input of inputs) {
              const placeholder = input.getAttribute('placeholder');
              // 只匹配"15-60个字符"或"8-30个汉字"，排除"导购短标题"的placeholder
              if (placeholder && 
                  (placeholder.includes('15-60个字符') || placeholder.includes('8-30个汉字')) &&
                  !placeholder.includes('导购') &&
                  !placeholder.includes('简明准确')) {
                titleInput = input;
                console.log('[标题修改] ✓ 找到标题输入框（方法3: placeholder精确匹配）');
                break;
              }
            }
          }
          
          // 方法4: 使用attr-field-id属性
          if (!titleInput) {
            const container = document.querySelector('[attr-field-id="商品标题"]');
            if (container) {
              titleInput = container.querySelector('input[type="text"]');
              if (titleInput) {
                console.log('[标题修改] ✓ 找到标题输入框（方法4: attr-field-id）');
              }
            }
          }
          
          if (!titleInput) {
            console.log('[标题修改] ✗ 未找到标题输入框');
            return { success: false, message: '未找到标题输入框' };
          }
          
          // 验证不是导购短标题
          const dropdownClassName = titleInput.getAttribute('dropdownclassname') || '';
          const placeholder = titleInput.getAttribute('placeholder') || '';
          
          if (dropdownClassName.includes('导购') || placeholder.includes('导购') || placeholder.includes('简明准确')) {
            console.log('[标题修改] ✗ 错误：找到的是导购短标题，不是商品标题');
            return { success: false, message: '找到的是导购短标题，不是商品标题' };
          }
          
          console.log('[标题修改] 验证通过，这是商品标题输入框');
          
          // 等待函数
          const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
          
          // 先聚焦输入框
          titleInput.focus();
          await wait(50); // 优化：减少等待 200->50
          
          // 清空原标题（使用多种方法）
          titleInput.value = '';
          
          // 使用 React 的方式触发变更（针对 React 应用）
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(titleInput, '');
          
          // 触发清空事件
          titleInput.dispatchEvent(new Event('input', { bubbles: true }));
          titleInput.dispatchEvent(new Event('change', { bubbles: true }));
          
          await wait(50); // 优化：减少等待 500->50
          
          // 填入新标题（使用 React 的方式）
          nativeInputValueSetter.call(titleInput, newTitle);
          
          // 触发多种事件确保生效
          const inputEvent = new Event('input', { bubbles: true });
          const changeEvent = new Event('change', { bubbles: true });
          
          titleInput.dispatchEvent(inputEvent);
          await wait(50); // 优化：减少等待 100->50
          titleInput.dispatchEvent(changeEvent);
          await wait(50); // 优化：减少等待 100->50
          
          // 失焦以确保保存
          titleInput.blur();
          await wait(200); // 优化：减少等待 500->200
          
          // 验证是否填入成功
          const currentValue = titleInput.value;
          if (currentValue !== newTitle) {
            console.log('[标题修改] ⚠ 标题填入失败');
            return { success: false, message: '标题填入失败，值未正确设置' };
          }
          
          console.log('[标题修改] ✓ 标题填入成功');
          
          // ✅ 检查是否有错误提示（增加等待时间，让页面有足够时间显示错误）
          console.log('[标题修改] 等待错误提示出现...');
          await wait(1000); // 增加到2秒，给页面足够时间验证和显示错误
          
          // 使用多种方法查找错误提示
          let errorText = '';
          
          // 方法1: 查找标题输入框下方的错误提示
          const errorDiv1 = document.querySelector('.styles_publishErrorTextBottom__U_4YU .styles_publishErrorText__ivbwE div');
          if (errorDiv1) {
            errorText = errorDiv1.textContent || '';
            console.log('[标题修改] 检测到错误提示（方法1）:', errorText);
          }
          
          // 方法2: 查找标题字段区域的错误提示
          if (!errorText) {
            const titleFieldContainer = document.querySelector('[attr-field-id="商品标题"]');
            if (titleFieldContainer) {
              const errorDiv2 = titleFieldContainer.querySelector('.styles_publishErrorText__ivbwE div');
              if (errorDiv2) {
                errorText = errorDiv2.textContent || '';
                console.log('[标题修改] 检测到错误提示（方法2）:', errorText);
              }
            }
          }
          
          // 方法3: 查找任何包含"最长不能超过"的错误提示
          if (!errorText) {
            const allErrorDivs = document.querySelectorAll('.styles_publishErrorText__ivbwE div');
            for (const div of allErrorDivs) {
              const text = div.textContent || '';
              if (text.includes('最长不能超过') || text.includes('60个字符') || text.includes('字符')) {
                errorText = text;
                console.log('[标题修改] 检测到错误提示（方法3）:', errorText);
                break;
              }
            }
          }
          
          // 方法4: 检查输入框是否有错误样式
          if (!errorText) {
            const hasErrorClass = titleInput.classList.contains('ecom-g-input-error') || 
                                  titleInput.classList.contains('error') ||
                                  titleInput.parentElement.classList.contains('ecom-g-input-error');
            if (hasErrorClass) {
              console.log('[标题修改] 检测到输入框有错误样式');
              errorText = '输入框显示错误状态';
            }
          }
          
          if (errorText) {
            console.log('[标题修改] 检测到错误提示:', errorText);
            
            if (errorText.includes('最长不能超过') || errorText.includes('60个字符') || errorText.includes('字符')) {
              console.log('[标题修改] ✗ 标题超出长度限制');
              return { success: false, hasLengthError: true, message: '标题超出长度限制: ' + errorText };
            }
            
            // 其他类型的错误
            console.log('[标题修改] ✗ 检测到其他错误');
            return { success: false, message: '标题验证失败: ' + errorText };
          }
          
          console.log('[标题修改] ✓ 没有错误提示，标题长度合格');
          return { success: true };
        })()
      `);
      
      if (result.success) {
        console.log(`  ✓ 标题填入成功，没有错误提示`);
        fillSuccess = true;
        finalTitle = currentTitle; // 更新最终标题
        break;
      } else if (result.hasLengthError) {
        console.log(`  ✗ 标题超出长度限制: ${result.message}`);
        console.log(`  → 当前标题长度: ${currentTitle.length}字符`);
        
        // 智能截断：每次减少10%的长度，但至少减少3个字符
        const reduceLength = Math.max(3, Math.floor(currentTitle.length * 0.1));
        const newLength = currentTitle.length - reduceLength;
        
        if (newLength < 10) {
          console.error(`  ✗ 标题已经太短(${newLength}字符)，无法继续截断`);
          return {
            success: false,
            message: '标题无法满足长度要求（已截断到最短）'
          };
        }
        
        currentTitle = currentTitle.substring(0, newLength);
        console.log(`  → 截断 ${reduceLength} 个字符，新长度: ${newLength} 字符`);
        console.log(`  → 准备第 ${attemptCount + 1} 次重试...`);
        await wait(500);
      } else {
        console.log(`  ✗ ${result.message}`);
        
        // 如果不是长度错误，可能是找不到输入框等其他问题，直接返回失败
        if (attemptCount >= 2) {
          // 尝试2次后仍然失败，直接返回
          return result;
        }
        
        // 第一次失败，等待后重试
        console.log(`  → 等待后重试...`);
        await wait(1000);
      }
    }
    
    if (!fillSuccess) {
      console.error(`  ✗ 尝试${maxAttempts}次后仍然失败`);
      return {
        success: false,
        message: `尝试${maxAttempts}次后仍然无法填入标题`
      };
    }
    
    console.log(`  ✓ 标题修改成功（尝试${attemptCount}次）`);
    console.log(`  → 最终标题: ${finalTitle.substring(0, 50)}... (${finalTitle.length}字符)`);
    
    // 5. 最终验证标题是否真的被修改
    console.log(`\n[步骤2.5] 最终验证标题...`);
    const verifyResult = await executeJS(window, `
      (function() {
        const expectedTitle = ${JSON.stringify(finalTitle)};
        
        // 再次查找标题输入框
        let titleInput = document.querySelector("input#pg-title-input");
        if (!titleInput) {
          const inputs = document.querySelectorAll("input[dropdownclassname]");
          for (const input of inputs) {
            const className = input.getAttribute('dropdownclassname');
            if (className && className.includes('商品标题') && !className.includes('导购')) {
              titleInput = input;
              break;
            }
          }
        }
        
        if (!titleInput) {
          return { success: false, message: '验证失败：未找到标题输入框' };
        }
        
        const currentValue = titleInput.value;
        if (currentValue === expectedTitle) {
          console.log('[标题验证] ✓ 标题验证成功，值正确');
          return { success: true, value: currentValue };
        } else {
          console.log('[标题验证] ✗ 标题验证失败');
          console.log('[标题验证] 期望长度:', expectedTitle.length);
          console.log('[标题验证] 实际长度:', currentValue.length);
          return { success: false, message: '标题值不匹配', expected: expectedTitle, actual: currentValue };
        }
      })()
    `);
    
    if (!verifyResult.success) {
      console.log(`  ✗ 标题验证失败: ${verifyResult.message}`);
      return verifyResult;
    }
    
    console.log(`  ✓ 标题验证通过`);
    console.log(`========== [步骤2] 完成 ==========\n`);
    
    return { 
      success: true, 
      title: newTitle 
    };
    
  } catch (error) {
    console.error(`  ✗ 修改标题失败: ${error.message}`);
    console.error(error.stack);
    return { 
      success: false, 
      message: `修改标题失败: ${error.message}` 
    };
  }
}

module.exports = {
  modifyProductTitle,
  generateNewTitle,
  generateRandomSuffix
};
