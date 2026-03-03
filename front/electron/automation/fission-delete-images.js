/**
 * 商品裂变 - 删除原有图片模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应代码: _create_single_product 方法中的步骤3、步骤4.5
 * 
 * 包含：
 * 1. 删除主图区域（1:1）的所有图片
 * 2. 删除主图3:4区域的所有图片
 * 3. 删除详情图区域的所有图片
 */

/**
 * 删除主图区域（1:1）的所有图片
 * 对应后端: 步骤3 - 第一阶段
 * 
 * @param {Page} page - Playwright页面对象
 * @returns {Promise<number>} 删除的图片数量
 */
async function deleteMainImages(page) {
  let deletedMainCount = 0;
  const maxDeleteAttempts = 15;

  console.log(`  [阶段1] 开始删除主图区域（1:1）的图片...`);

  for (let attempt = 0; attempt < maxDeleteAttempts; attempt++) {
    try {
      // 在主图区域内查找所有图片容器
      const mainImageSection = await page.$("[attr-field-id='主图']");

      let imageWrappers;
      if (mainImageSection) {
        imageWrappers = await mainImageSection.$$("div.index-module_imgWrapper__xOFF7");
      } else {
        imageWrappers = await page.$$("div.index-module_imgWrapper__xOFF7");
      }

      if (!imageWrappers || imageWrappers.length === 0) {
        console.log(`  ✓ 主图区域（1:1）已清空，现在应该显示5个上传按钮`);
        break;
      }

      console.log(`  主图区域还有 ${imageWrappers.length} 张图片待删除`);

      // 鼠标悬停在第一张图片上
      const firstWrapper = imageWrappers[0];
      await firstWrapper.hover();
      await page.waitForTimeout(800);

      // 查找删除按钮
      let deleted = false;

      // 方法1: 直接在悬停的图片容器内查找删除按钮
      try {
        const deleteIcon = await firstWrapper.$("use[href='#icon-shanchu']");
        if (deleteIcon) {
          const deleteButton = await deleteIcon.evaluateHandle(el => el.closest('.index-module_actionAfter__MtUIB'));
          if (deleteButton) {
            await deleteButton.asElement().click();
            deleted = true;
            deletedMainCount++;
            console.log(`  ✓ 已删除主图 ${deletedMainCount}/5`);
            await page.waitForTimeout(1000);
          }
        }
      } catch (error) {
        console.log(`  ⚠ 方法1删除失败: ${error.message}`);
      }

      // 方法2: 如果方法1失败，尝试通过可见的删除按钮
      if (!deleted) {
        try {
          const deleteButtonSelectors = [
            ".index-module_hoverWrapper__OjtoF .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])",
            ".index-module_controls__ys7qK .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])"
          ];

          for (const selector of deleteButtonSelectors) {
            try {
              const deleteButtons = await page.$$(selector);
              if (deleteButtons && deleteButtons.length > 0) {
                await deleteButtons[0].click();
                deleted = true;
                deletedMainCount++;
                console.log(`  ✓ 已删除主图 ${deletedMainCount}/5`);
                await page.waitForTimeout(1000);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          console.log(`  ⚠ 方法2删除失败: ${error.message}`);
        }
      }

      if (!deleted) {
        console.log(`  ⚠ 未找到删除按钮，停止删除主图`);
        break;
      }

    } catch (error) {
      console.log(`  ⚠ 删除主图时出错: ${error.message}`);
      break;
    }
  }

  console.log(`  ✓ 主图区域（1:1）共删除 ${deletedMainCount} 张`);
  return deletedMainCount;
}

/**
 * 删除主图3:4区域的所有图片
 * 对应后端: 步骤3 - 第二阶段
 * 
 * @param {Page} page - Playwright页面对象
 * @returns {Promise<number>} 删除的图片数量
 */
async function deleteMain34Images(page) {
  let deleted34Count = 0;
  const maxDeleteAttempts = 15;

  console.log(`  [阶段2] 开始删除主图3:4区域的图片...`);

  for (let attempt = 0; attempt < maxDeleteAttempts; attempt++) {
    try {
      // 在主图3:4区域内查找所有图片容器
      const main34Section = await page.$("[attr-field-id='主图3:4']");

      let imageWrappers;
      if (main34Section) {
        imageWrappers = await main34Section.$$("div.index-module_imgWrapper__xOFF7");
      } else {
        imageWrappers = await page.$$("div.index-module_imgWrapper__xOFF7");
      }

      if (!imageWrappers || imageWrappers.length === 0) {
        console.log(`  ✓ 主图3:4区域已清空`);
        break;
      }

      console.log(`  主图3:4区域还有 ${imageWrappers.length} 张图片待删除`);

      // 鼠标悬停在第一张图片上
      const firstWrapper = imageWrappers[0];
      await firstWrapper.hover();
      await page.waitForTimeout(800);

      // 查找删除按钮
      let deleted = false;

      // 方法1: 直接在悬停的图片容器内查找删除按钮
      try {
        const deleteIcon = await firstWrapper.$("use[href='#icon-shanchu']");
        if (deleteIcon) {
          const deleteButton = await deleteIcon.evaluateHandle(el => el.closest('.index-module_actionAfter__MtUIB'));
          if (deleteButton) {
            await deleteButton.asElement().click();
            deleted = true;
            deleted34Count++;
            console.log(`  ✓ 已删除主图3:4 ${deleted34Count}/5`);
            await page.waitForTimeout(1000);
          }
        }
      } catch (error) {
        console.log(`  ⚠ 方法1删除失败: ${error.message}`);
      }

      // 方法2: 如果方法1失败，尝试通过可见的删除按钮
      if (!deleted) {
        try {
          const deleteButtonSelectors = [
            ".index-module_hoverWrapper__OjtoF .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])",
            ".index-module_controls__ys7qK .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])"
          ];

          for (const selector of deleteButtonSelectors) {
            try {
              const deleteButtons = await page.$$(selector);
              if (deleteButtons && deleteButtons.length > 0) {
                await deleteButtons[0].click();
                deleted = true;
                deleted34Count++;
                console.log(`  ✓ 已删除主图3:4 ${deleted34Count}/5`);
                await page.waitForTimeout(1000);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        } catch (error) {
          console.log(`  ⚠ 方法2删除失败: ${error.message}`);
        }
      }

      if (!deleted) {
        console.log(`  ⚠ 未找到删除按钮，停止删除主图3:4`);
        break;
      }

    } catch (error) {
      console.log(`  ⚠ 删除主图3:4时出错: ${error.message}`);
      break;
    }
  }

  console.log(`  ✓ 主图3:4区域共删除 ${deleted34Count} 张`);
  return deleted34Count;
}

/**
 * 删除详情图区域的所有图片
 * 对应后端: 步骤4.5
 * 
 * @param {Page} page - Playwright页面对象
 * @returns {Promise<number>} 删除的图片数量
 */
async function deleteDetailImages(page) {
  let deletedDetailCount = 0;
  const maxDeleteAttempts = 60;

  console.log(`  [步骤4.5] 删除详情图区域的所有原有图片...`);

  try {
    // 滚动到详情编辑区域
    try {
      const detailSection = await page.waitForSelector("text=详情编辑", { timeout: 5000 });
      if (detailSection) {
        await detailSection.scrollIntoViewIfNeeded();
        console.log(`  ✓ 已定位到'详情编辑'区域`);
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log(`  ⚠ 无法定位到'详情编辑'区域: ${error.message}`);
    }

    console.log(`  开始删除详情图...`);

    for (let attempt = 0; attempt < maxDeleteAttempts; attempt++) {
      try {
        // 查找详情图区域的所有图片容器
        const detailImageWrappers = await page.$$("div.styles_imgWrapper__dqiHn");

        if (!detailImageWrappers || detailImageWrappers.length === 0) {
          console.log(`  ✓ 详情图区域已清空`);
          break;
        }

        if (attempt % 5 === 0) {
          console.log(`  详情图区域还有 ${detailImageWrappers.length} 张图片待删除`);
        }

        // 鼠标悬停在第一张图片上，确保控制按钮显示
        const firstWrapper = detailImageWrappers[0];
        await firstWrapper.hover();
        await page.waitForTimeout(1000);

        // 查找删除按钮
        let deleted = false;

        // 方法1: 直接在图片容器内查找删除图标（最准确）
        try {
          const deleteIcon = await firstWrapper.$("i.styles_iconDelete__y_88a");
          if (deleteIcon) {
            const isVisible = await deleteIcon.isVisible();
            if (isVisible) {
              await deleteIcon.click();
              deleted = true;
              deletedDetailCount++;
              if (attempt % 5 === 0) {
                console.log(`  ✓ 已删除详情图 ${deletedDetailCount} 张`);
              }
              await page.waitForTimeout(800);
            } else {
              console.log(`  ⚠ 删除按钮不可见`);
            }
          }
        } catch (error) {
          console.log(`  ⚠ 方法1删除失败: ${error.message}`);
        }

        // 方法2: 通过controls容器查找
        if (!deleted) {
          try {
            const controls = await firstWrapper.$("div.styles_controls__vZIXJ");
            if (controls) {
              const deleteIcon = await controls.$("i.styles_iconDelete__y_88a");
              if (deleteIcon) {
                await deleteIcon.click();
                deleted = true;
                deletedDetailCount++;
                if (attempt % 5 === 0) {
                  console.log(`  ✓ 已删除详情图 ${deletedDetailCount} 张`);
                }
                await page.waitForTimeout(800);
              }
            }
          } catch (error) {
            console.log(`  ⚠ 方法2删除失败: ${error.message}`);
          }
        }

        // 方法3: 使用JavaScript强制点击
        if (!deleted) {
          try {
            const deleteIcon = await firstWrapper.$("i.styles_iconDelete__y_88a");
            if (deleteIcon) {
              await deleteIcon.evaluate(el => el.click());
              deleted = true;
              deletedDetailCount++;
              if (attempt % 5 === 0) {
                console.log(`  ✓ 已删除详情图 ${deletedDetailCount} 张`);
              }
              await page.waitForTimeout(800);
            }
          } catch (error) {
            console.log(`  ⚠ 方法3删除失败: ${error.message}`);
          }
        }

        if (!deleted) {
          console.log(`  ⚠ 未找到删除按钮，停止删除详情图`);
          const firstWrapperHtml = await firstWrapper.innerHTML();
          console.log(`  调试信息: 第一个容器HTML: ${firstWrapperHtml}`);
          break;
        }

      } catch (error) {
        console.log(`  ⚠ 删除详情图时出错: ${error.message}`);
        console.error(error.stack);
        break;
      }
    }

    console.log(`  ✓ 详情图区域共删除 ${deletedDetailCount} 张`);

  } catch (error) {
    console.log(`  ⚠ 删除详情图失败: ${error.message}，尝试继续`);
  }

  return deletedDetailCount;
}

/**
 * 删除所有原有图片（主图1:1、主图3:4、详情图）
 * 对应后端: 步骤3 完整流程
 * 
 * @param {Page} page - Playwright页面对象
 * @returns {Promise<{mainCount: number, main34Count: number, detailCount: number}>} 删除统计
 */
async function deleteAllImages(page) {
  console.log(`  [步骤3] 删除原有的主图和主图3:4...`);

  try {
    // 等待页面完全加载
    await page.waitForTimeout(3000);

    // 先定位到"图文信息"区域
    console.log(`  定位到'图文信息'区域...`);
    try {
      const imageSection = await page.waitForSelector("#goodsEditScrollContainer-图文信息", { timeout: 5000 });
      if (imageSection) {
        await imageSection.scrollIntoViewIfNeeded();
        console.log(`  ✓ 已定位到'图文信息'区域`);
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log(`  ⚠ 无法定位到'图文信息'区域: ${error.message}，尝试手动滚动`);
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(2000);
    }

    // 删除主图区域（1:1）
    const mainCount = await deleteMainImages(page);
    await page.waitForTimeout(2000);

    // 删除主图3:4区域
    const main34Count = await deleteMain34Images(page);
    console.log(`  ✓ 总计删除: 主图${mainCount}张 + 主图3:4 ${main34Count}张 = ${mainCount + main34Count}张`);
    await page.waitForTimeout(2000);

    return { mainCount, main34Count, detailCount: 0 };

  } catch (error) {
    console.log(`  ⚠ 删除图片失败: ${error.message}，尝试继续`);
    return { mainCount: 0, main34Count: 0, detailCount: 0 };
  }
}

module.exports = {
  deleteMainImages,
  deleteMain34Images,
  deleteDetailImages,
  deleteAllImages
};
