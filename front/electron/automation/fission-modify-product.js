/**
 * 商品裂变 - 修改商品信息模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应代码: _create_single_product 方法中的步骤2、步骤5
 * 
 * 包含：
 * 1. 修改商品标题（添加隐藏字符）
 * 2. 调整商品价格
 */

/**
 * 修改商品标题（添加隐藏字符确保不完全相同）
 * 对应后端: 步骤2
 * 
 * @param {Page} page - Playwright页面对象
 * @param {string} newTitle - 新标题
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function modifyProductTitle(page, newTitle) {
  console.log(`  [步骤2] 修改商品标题...`);

  try {
    // 添加零宽字符（不可见字符）使标题唯一
    // 零宽空格 (U+200B)、零宽非连接符 (U+200C)、零宽连接符 (U+200D)
    const invisibleChars = ['\u200B', '\u200C', '\u200D'];
    let randomInvisible = '';
    for (let i = 0; i < 3; i++) {
      randomInvisible += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
    }

    // 在标题中间插入隐藏字符
    const midPoint = Math.floor(newTitle.length / 2);
    const titleWithHidden = newTitle.slice(0, midPoint) + randomInvisible + newTitle.slice(midPoint);

    // 查找标题输入框
    const titleSelectors = [
      "input[placeholder*='商品标题']",
      "input[placeholder*='标题']",
      "textarea[placeholder*='商品标题']",
      "input[placeholder*='请输入']",
      "input[placeholder*='2-60个字符']"
    ];

    let titleFilled = false;
    for (const selector of titleSelectors) {
      try {
        // 清空原标题
        await page.fill(selector, '', { timeout: 3000 });
        // 填入新标题（带隐藏字符）
        await page.fill(selector, titleWithHidden, { timeout: 3000 });
        titleFilled = true;
        console.log(`  ✓ 标题修改成功: ${newTitle} (已添加隐藏字符)`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!titleFilled) {
      return { success: false, message: '未找到标题输入框' };
    }

    await page.waitForTimeout(2000);
    return { success: true };

  } catch (error) {
    return { success: false, message: `修改标题失败: ${error.message}` };
  }
}

/**
 * 调整商品价格
 * 对应后端: 步骤5
 * 
 * @param {Page} page - Playwright页面对象
 * @param {Array} newSkuList - 新的SKU列表
 * @returns {Promise<boolean>}
 */
async function adjustProductPrice(page, newSkuList) {
  console.log(`  [步骤5] 调整商品价格...`);

  try {
    // 滚动到价格库存区域
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    while (scrollAttempts < maxScrollAttempts) {
      // 查找"价格库存"文本
      const priceSectionSelectors = [
        "text=价格库存",
        "div:has-text('价格库存')",
        "span:has-text('价格库存')",
        "text=价格"
      ];

      let found = false;
      for (const selector of priceSectionSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // 滚动到该元素
            await element.scrollIntoViewIfNeeded();
            console.log(`  ✓ 已滚动到'价格库存'部分`);
            found = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (found) {
        break;
      }

      // 如果没找到，继续向下滚动
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(500);
      scrollAttempts++;
    }

    await page.waitForTimeout(2000);

    // 调整价格
    if (newSkuList && newSkuList.length > 0) {
      console.log(`  调整SKU价格...`);

      // 查找所有价格输入框
      let priceInputs = await page.$$("input[placeholder*='价格']");

      if (!priceInputs || priceInputs.length === 0) {
        // 尝试其他选择器
        priceInputs = await page.$$("input[type='number']");
      }

      if (priceInputs && priceInputs.length > 0) {
        // 遍历每个SKU，调整价格
        for (let i = 0; i < newSkuList.length; i++) {
          if (i < priceInputs.length) {
            const priceYuan = newSkuList[i].price / 100.0;  // 分转元
            const priceStr = priceYuan.toFixed(2);

            try {
              // 清空并填入新价格
              await priceInputs[i].fill('', { timeout: 2000 });
              await priceInputs[i].fill(priceStr, { timeout: 2000 });
              console.log(`  ✓ SKU ${i + 1} 价格已调整为: ¥${priceStr}`);
              await page.waitForTimeout(500);
            } catch (error) {
              console.log(`  ⚠ SKU ${i + 1} 价格调整失败: ${error.message}`);
            }
          }
        }
      } else {
        console.log(`  ⚠ 未找到价格输入框`);
      }
    }

    return true;

  } catch (error) {
    console.log(`  ⚠ 调整价格失败: ${error.message}，尝试继续`);
    return false;
  }
}

module.exports = {
  modifyProductTitle,
  adjustProductPrice
};
