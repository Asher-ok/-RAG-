/**
 * 商品裂变 - 上传图片模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应代码: _create_single_product 方法中的步骤4、步骤4.6
 * 
 * 包含：
 * 1. 上传主图（1张首图 + 4张主图）
 * 2. 智能裁剪生成3:4图
 * 3. 上传详情图
 */

const path = require('path');

/**
 * 上传主图（首图 + 主图2-5）
 * 对应后端: 步骤4
 * 
 * @param {Page} page - Playwright页面对象
 * @param {string[]} newImages - 所有图片列表
 * @param {string} coverImage - 首图路径
 * @param {string[]} mainImages - 主图列表（4张）
 * @returns {Promise<boolean>} 是否成功
 */
async function uploadMainImages(page, newImages, coverImage, mainImages) {
  console.log(`  [步骤4] 上传新的首图和主图...`);

  try {
    // 分离首图和主图
    if (newImages && newImages.length >= 5) {
      const coverImageList = [newImages[0]];  // 第1张是首图
      const mainImages2345 = newImages.slice(1, 5);  // 第2-5张是主图

      console.log(`  准备上传:`);
      console.log(`    首图: ${coverImageList[0]}`);
      console.log(`    主图2-5:`);
      for (let idx = 0; idx < mainImages2345.length; idx++) {
        console.log(`      主图${idx + 2}: ${mainImages2345[idx]}`);
      }

      // 上传到主图区域（1:1比例）
      try {
        // 查找主图区域
        const mainImageSection = await page.$("[attr-field-id='主图']");

        if (mainImageSection) {
          console.log(`  ✓ 找到主图区域`);

          // 确保"本地上传"选项卡是激活状态
          try {
            const localUploadTab = await page.$("text=本地上传");
            if (localUploadTab) {
              await localUploadTab.click();
              console.log(`  ✓ 已切换到'本地上传'选项卡`);
              await page.waitForTimeout(1000);
            }
          } catch (e) {
            console.log(`  ⚠ 未找到'本地上传'选项卡，可能已经是默认状态`);
          }

          // 在主图区域内查找所有文件输入框
          const fileInputs = await mainImageSection.$$("input[type='file']");

          if (fileInputs && fileInputs.length >= 5) {
            console.log(`  ✓ 找到 ${fileInputs.length} 个文件输入框`);

            // 准备5张图片：首图 + 主图2-5
            const allMainImages = [coverImageList[0], ...mainImages2345];

            // 第一轮：上传所有5张图片
            console.log(`  [第一轮] 上传5张主图...`);
            for (let idx = 0; idx < 5; idx++) {
              console.log(`  [${idx + 1}/5] 上传主图${idx + 1}...`);
              try {
                await fileInputs[idx].setInputFiles([allMainImages[idx]]);
                console.log(`  ✓ 主图${idx + 1}已设置`);
                await page.waitForTimeout(3500);
              } catch (error) {
                console.log(`  ✗ 主图${idx + 1}上传失败: ${error.message}`);
              }
            }

            // 等待图片上传
            console.log(`  等待图片上传完成...`);
            await page.waitForTimeout(12000);

            // 检查并补传缺失的图片（一直重试直到成功）
            let retry = 0;
            while (true) {
              retry++;
              // 重新获取文件输入框（页面可能已更新）
              const mainImageSectionRefresh = await page.$("[attr-field-id='主图']");
              let fileInputsRefresh;
              let uploadedImages;

              if (mainImageSectionRefresh) {
                fileInputsRefresh = await mainImageSectionRefresh.$$("input[type='file']");
                uploadedImages = await mainImageSectionRefresh.$$("div.index-module_imgWrapper__xOFF7");
              } else {
                console.log(`  ⚠ 无法找到主图区域，等待3秒后重试...`);
                await page.waitForTimeout(3000);
                continue;
              }

              const actualCount = uploadedImages ? uploadedImages.length : 0;

              if (actualCount >= 5) {
                console.log(`  ✓ 主图上传成功！已上传 ${actualCount} 张图片`);
                break;
              } else {
                console.log(`  第${retry}次检查：只检测到 ${actualCount} 张图片，预期5张`);
                console.log(`  补传缺失的图片...`);

                // 找出哪些位置还是空的（有file input但没有图片）
                const missingCount = 5 - actualCount;
                console.log(`  需要补传 ${missingCount} 张图片`);

                // 从后往前补传（因为通常是后面的图片没上传成功）
                const startIdx = actualCount;
                for (let idx = startIdx; idx < 5; idx++) {
                  if (idx < fileInputsRefresh.length && idx < allMainImages.length) {
                    console.log(`  补传主图${idx + 1}...`);
                    try {
                      await fileInputsRefresh[idx].setInputFiles([allMainImages[idx]]);
                      console.log(`  ✓ 主图${idx + 1}已补传`);
                      await page.waitForTimeout(3000);
                    } catch (error) {
                      console.log(`  ✗ 主图${idx + 1}补传失败: ${error.message}`);
                    }
                  }
                }

                // 等待补传完成
                console.log(`  等待5秒后再次检查...`);
                await page.waitForTimeout(5000);
              }
            }

            // 图片齐全，点击"从1:1主图智能裁剪"按钮
            console.log(`  ✓ 5张主图已齐全，点击'从1:1主图智能裁剪'按钮...`);
            try {
              // 使用更精确的选择器，增加超时时间
              const cropButton = await page.waitForSelector(
                "button.ecom-g-btn.ecom-g-btn-link:has-text('从1:1主图智能裁剪')",
                { timeout: 10000 }
              );

              if (cropButton) {
                // 确保按钮可见并可点击
                await cropButton.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);

                // 点击按钮
                await cropButton.click();
                console.log(`  ✓ 已点击'从1:1主图智能裁剪'按钮`);

                // 等待按钮文本变化为"取消智能裁剪"，确认点击成功
                try {
                  await page.waitForSelector(
                    "button.ecom-g-btn.ecom-g-btn-link:has-text('取消智能裁剪')",
                    { timeout: 5000 }
                  );
                  console.log(`  ✓ 按钮已变为'取消智能裁剪'，智能裁剪已启动`);
                } catch (e) {
                  console.log(`  ⚠ 未检测到按钮变化，但继续等待图片生成`);
                }

                // 等待图片生成完成（10-15秒）
                console.log(`  等待3:4图片自动生成（约10-15秒）...`);
                await page.waitForTimeout(12000);
                console.log(`  ✓ 3:4图片应该已经生成完成`);
              } else {
                console.log(`  ⚠ 未找到'从1:1主图智能裁剪'按钮，继续后续流程`);
              }
            } catch (error) {
              console.log(`  ⚠ 点击'从1:1主图智能裁剪'按钮失败: ${error.message}，继续后续流程`);
            }

            return true;

          } else {
            console.log(`  ✗ 文件输入框数量不足，找到 ${fileInputs ? fileInputs.length : 0} 个，需要5个`);
            return false;
          }
        } else {
          console.log(`  ✗ 未找到主图区域`);
          return false;
        }

      } catch (error) {
        console.log(`  ✗ 主图上传失败: ${error.message}`);
        console.error(error.stack);
        return false;
      }
    } else {
      console.log(`  ⚠ 图片数量不足，需要至少5张（1张首图+4张主图），实际只有 ${newImages ? newImages.length : 0} 张`);
      return false;
    }

  } catch (error) {
    console.log(`  ✗ 图片上传失败: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

/**
 * 上传详情图
 * 对应后端: 步骤4.6
 * 
 * @param {Page} page - Playwright页面对象
 * @param {string[]} detailImages - 详情图列表
 * @returns {Promise<boolean>} 是否成功
 */
async function uploadDetailImages(page, detailImages) {
  console.log(`  [步骤4.6] 上传新的详情图...`);

  try {
    // 获取详情图列表
    if (detailImages && detailImages.length > 0) {
      console.log(`  准备上传 ${detailImages.length} 张详情图`);

      // 查找详情图上传按钮（支持多选的文件输入框）
      let detailUploadInput = null;

      // 方法1: 通过"详情编辑"区域查找
      try {
        const detailSectionSelectors = [
          "div.styles_decorateImgEdit__IdRQn",
          "text=详情编辑"
        ];

        for (const selector of detailSectionSelectors) {
          try {
            const section = await page.$(selector);
            if (section) {
              // 在详情编辑区域内查找支持多选的文件输入框
              detailUploadInput = await section.$("input[type='file'][multiple]");
              if (detailUploadInput) {
                console.log(`  ✓ 找到详情图上传输入框`);
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
      } catch (error) {
        console.log(`  ⚠ 方法1查找失败: ${error.message}`);
      }

      // 方法2: 直接查找页面中支持多选的文件输入框（排除主图区域的）
      if (!detailUploadInput) {
        try {
          const allFileInputs = await page.$$("input[type='file'][multiple]");
          if (allFileInputs && allFileInputs.length > 0) {
            // 通常详情图的输入框在后面
            detailUploadInput = allFileInputs[allFileInputs.length - 1];
            console.log(`  ✓ 找到详情图上传输入框（方法2）`);
          }
        } catch (error) {
          console.log(`  ⚠ 方法2查找失败: ${error.message}`);
        }
      }

      if (detailUploadInput) {
        // 一次性上传所有详情图（利用multiple属性）
        console.log(`  开始上传 ${detailImages.length} 张详情图...`);
        try {
          await detailUploadInput.setInputFiles(detailImages);
          console.log(`  ✓ 详情图已设置`);

          // 等待上传完成（根据图片数量动态调整，每张3秒，最少15秒）
          const waitTime = Math.max(15, detailImages.length * 3);
          console.log(`  等待 ${waitTime} 秒让图片上传...`);
          await page.waitForTimeout(waitTime * 1000);

          // 检查并补传缺失的详情图（一直重试直到成功）
          let retry = 0;
          while (true) {
            retry++;
            // 查找已上传的详情图
            const uploadedDetailImages = await page.$$("div.styles_imgWrapper__dqiHn");
            const actualCount = uploadedDetailImages ? uploadedDetailImages.length : 0;

            if (actualCount >= detailImages.length) {
              console.log(`  ✓ 详情图上传成功！已上传 ${actualCount} 张图片`);
              break;
            } else {
              console.log(`  第${retry}次检查：只检测到 ${actualCount} 张详情图，预期 ${detailImages.length} 张`);
              console.log(`  重新上传所有详情图...`);

              try {
                await detailUploadInput.setInputFiles(detailImages);
                console.log(`  ✓ 详情图已重新设置`);

                // 等待时间
                const retryWaitTime = Math.max(15, detailImages.length * 3);
                console.log(`  等待 ${retryWaitTime} 秒后再次检查...`);
                await page.waitForTimeout(retryWaitTime * 1000);
              } catch (error) {
                console.log(`  ✗ 重新上传失败: ${error.message}`);
                await page.waitForTimeout(5000);
              }
            }
          }

          return true;

        } catch (error) {
          console.log(`  ✗ 详情图上传失败: ${error.message}`);
          return false;
        }
      } else {
        console.log(`  ✗ 未找到详情图上传输入框`);
        return false;
      }
    } else {
      console.log(`  ⚠ 没有详情图需要上传`);
      return true;
    }

  } catch (error) {
    console.log(`  ✗ 详情图上传失败: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

module.exports = {
  uploadMainImages,
  uploadDetailImages
};
