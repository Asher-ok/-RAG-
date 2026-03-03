/**
 * 商品裂变 - 提交商品模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应代码: _create_single_product 方法中的步骤6
 * 
 * 包含：
 * 1. 滚动到页面底部
 * 2. 点击提交按钮（保存草稿/发布商品）
 * 3. 检查提交结果
 */

/**
 * 提交商品
 * 对应后端: 步骤6
 * 
 * @param {Page} page - Playwright页面对象
 * @param {number} publishMode - 发布模式 1=草稿 2=上架
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function submitProduct(page, publishMode) {
  console.log(`  [步骤6] 提交商品...`);

  try {
    // 滚动到页面底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    let submitSelectors;
    if (publishMode === 1) {
      // 保存为草稿
      console.log(`  点击'保存草稿'按钮...`);
      submitSelectors = [
        "button.ecom-g-btn.ecom-g-btn-dashed:has-text('保存草稿')",
        "button:has-text('保存草稿')",
        "button.ecom-g-btn:has(span:text('保存草稿'))",
        "text=保存草稿",
        "[class*='draft']:has-text('保存')"
      ];
    } else {
      // 直接发布
      console.log(`  点击'发布商品'按钮...`);
      submitSelectors = [
        "button.ecom-g-btn.ecom-g-btn-primary:has-text('发布商品')",
        "button:has-text('发布商品')",
        "button.ecom-g-btn:has(span:text('发布商品'))",
        "button:has-text('提交并上架')",
        "button:has-text('立即上架')",
        "text=发布商品"
      ];
    }

    let submitted = false;
    let lastError = null;

    for (const selector of submitSelectors) {
      try {
        // 先尝试查找按钮
        const button = await page.waitForSelector(selector, { timeout: 5000 });
        if (button) {
          // 确保按钮可见
          await button.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          // 点击按钮
          await button.click();
          submitted = true;
          console.log(`  ✓ 成功点击提交按钮（使用选择器: ${selector}）`);
          break;
        }
      } catch (error) {
        lastError = error.message;
        continue;
      }
    }

    if (!submitted) {
      const errorMsg = `未找到提交按钮，最后一个错误: ${lastError}`;
      console.log(`  ✗ ${errorMsg}`);
      return { success: false, message: errorMsg };
    }

    // 等待提交完成
    console.log(`  等待提交完成...`);
    await page.waitForTimeout(5000);

    // 检查是否成功
    try {
      // 查找成功提示
      const successSelectors = [
        "text=创建成功",
        "text=发布成功",
        "text=保存成功",
        "text=提交成功"
      ];

      for (const selector of successSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`  ✓ 商品创建成功`);
          return { success: true, message: '商品创建成功' };
        } catch (e) {
          continue;
        }
      }

      // 检查URL是否跳转
      if (page.url().includes('list') || page.url().includes('success')) {
        console.log(`  ✓ 商品创建成功（URL已跳转）`);
        return { success: true, message: '商品创建成功' };
      } else {
        console.log(`  ⚠ 无法确认是否创建成功，当前URL: ${page.url()}`);
        return { success: false, message: '无法确认是否创建成功' };
      }

    } catch (error) {
      console.log(`  ⚠ 检查结果时出错: ${error.message}`);
      return { success: false, message: `无法确认是否创建成功: ${error.message}` };
    }

  } catch (error) {
    return { success: false, message: `提交商品失败: ${error.message}` };
  }
}

module.exports = {
  submitProduct
};
