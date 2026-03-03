/**
 * 商品裂变 - 主执行器
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 串联所有模块，执行完整的裂变流程
 */

const { generateRandomSuffix, generateRandomSkuCode } = require('./fission-utils');
const { generateAllCombinations } = require('./fission-combinations');
const { deleteAllImages, deleteDetailImages } = require('./fission-delete-images');
const { uploadMainImages, uploadDetailImages } = require('./fission-upload-images');
const { modifyProductTitle, adjustProductPrice } = require('./fission-modify-product');
const { submitProduct } = require('./fission-submit');

/**
 * 创建单个裂变商品
 * 对应后端: _create_single_product
 * 
 * 完全按照后端逻辑实现，包括：
 * 1. 访问创建相似品页面
 * 2. 修改标题（添加隐藏字符）
 * 3. 删除所有原图（主图1:1、主图3:4、详情图）
 * 4. 上传新图片（首图+主图，自动裁剪3:4，详情图）
 * 5. 调整价格
 * 6. 提交发布
 * 
 * @param {Page} page - Playwright页面对象
 * @param {Object} sourceProduct - 原商品信息
 * @param {string} newTitle - 新标题
 * @param {string[]} newImages - 新图片列表
 * @param {Array} newSkuList - 新SKU列表
 * @param {number} publishMode - 发布模式 1=草稿 2=上架
 * @param {string} coverImage - 首图路径
 * @param {string[]} mainImages - 主图列表
 * @param {string[]} detailImages - 详情图列表
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function createSingleProduct(page, sourceProduct, newTitle, newImages, newSkuList, publishMode, coverImage, mainImages, detailImages) {
  // 处理默认参数
  if (!mainImages) mainImages = [];
  if (!detailImages) detailImages = [];

  try {
    // 设置视口大小
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 先访问首页，确保登录状态有效
    console.log(`  [预检查] 验证登录状态...`);
    const homepageUrl = 'https://fxg.jinritemai.com/ffa/mshop/homepage/index';
    await page.goto(homepageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 检查是否在登录页面
    if (page.url().includes('/login')) {
      console.log(`  ✗ 登录状态已过期`);
      return { success: false, message: '登录状态已过期，请重新登录' };
    }

    console.log(`  ✓ 登录状态有效`);

    // 1. 直接访问创建相似品页面
    console.log(`  [步骤1] 直接访问创建相似品页面...`);
    const productId = sourceProduct.douyin_product_id;
    const createSimilarUrl = `https://fxg.jinritemai.com/ffa/g/create?copyid=${productId}`;
    console.log(`  URL: ${createSimilarUrl}`);

    await page.goto(createSimilarUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 等待页面加载（系统会自动复制原商品信息）
    console.log(`  等待页面加载...`);
    await page.waitForTimeout(5000);

    // 检查是否跳转到登录页面
    if (page.url().includes('/login')) {
      console.log(`  ✗ 跳转到登录页面`);
      return { success: false, message: '无法访问创建页面，登录状态可能已过期' };
    }

    console.log(`  ✓ 已进入创建相似品页面: ${page.url()}`);

    // 确认已进入商品发布页面
    if (!page.url().includes('create')) {
      return { success: false, message: '未能进入商品发布页面' };
    }

    // 2. 修改标题（添加隐藏字符确保不完全相同）
    const titleResult = await modifyProductTitle(page, newTitle);
    if (!titleResult.success) {
      return titleResult;
    }

    // 3. 删除所有原有图片（主图1:1、主图3:4）
    await deleteAllImages(page);

    // 4. 上传新的主图（首图 + 主图2-5）
    const mainUploadSuccess = await uploadMainImages(page, newImages, coverImage, mainImages);
    if (!mainUploadSuccess) {
      console.log(`  ⚠ 主图上传失败，但继续执行`);
    }

    // 4.5. 删除详情图区域的所有原有图片
    await deleteDetailImages(page);

    // 4.6. 上传新的详情图
    const detailUploadSuccess = await uploadDetailImages(page, detailImages);
    if (!detailUploadSuccess) {
      console.log(`  ⚠ 详情图上传失败，但继续执行`);
    }

    // 5. 调整商品价格
    await adjustProductPrice(page, newSkuList);

    // 6. 提交商品
    const submitResult = await submitProduct(page, publishMode);
    return submitResult;

  } catch (error) {
    console.log(`✗ 创建商品失败: ${error.message}`);
    console.error(error.stack);
    return { success: false, message: `创建商品失败: ${error.message}` };
  }
}

/**
 * 执行完整的裂变流程
 * 对应后端: execute_fission
 * 
 * @param {BrowserContext} context - Playwright浏览器上下文
 * @param {Object} params - 裂变参数
 * @param {Function} onProgress - 进度回调函数
 * @returns {Promise<Object>} 裂变结果
 */
async function executeFission(context, params, onProgress) {
  const {
    sourceProduct,
    count,
    priceFloatAmount = 0,
    titleSuffix = null,
    titleReplacements = null,
    publishMode = 2,
    coverImageFolder = null,
    mainImageFolder = null,
    detailImageFolder = null
  } = params;

  try {
    console.log(`\n[Playwright裂变] 开始执行...`);
    console.log(`  原商品: ${sourceProduct.title}`);
    console.log(`  裂变数量: ${count}`);
    console.log(`  [调试] 接收到的文件夹路径:`);
    console.log(`    首图文件夹: ${coverImageFolder}`);
    console.log(`    主图文件夹: ${mainImageFolder}`);
    console.log(`    详情图文件夹: ${detailImageFolder}`);

    // 读取素材文件夹中的图片 - 使用排列组合模式
    console.log(`  [素材模式] 使用排列组合模式（不重复）`);
    const allCombinations = generateAllCombinations(
      coverImageFolder,
      mainImageFolder,
      detailImageFolder
    );

    // 检查组合数是否足够
    if (allCombinations && allCombinations.length < count) {
      console.log(`  ⚠ 警告: 组合数(${allCombinations.length})少于裂变数量(${count})，将循环使用`);
    }

    if (allCombinations && allCombinations.length > 0) {
      console.log(`  首图数量: ${allCombinations.length > 0 ? 1 : 0}`);
      console.log(`  主图数量: ${allCombinations[0].mainImages.length}`);
      console.log(`  详情图数量: ${allCombinations[0].detailImages.length}`);
    }

    // 如果没有提供素材，使用原商品图片
    let combinations = allCombinations;
    if (!combinations || combinations.length === 0) {
      console.log(`  未提供素材文件夹，将使用原商品图片`);
      const originalImages = JSON.parse(sourceProduct.images || '[]');
      const coverImages = originalImages.length > 0 ? [originalImages[0]] : [];
      const mainImagesFromOriginal = originalImages.length > 1 ? originalImages.slice(1, 5) : [];
      const detailImagesFromOriginal = originalImages.length > 5 ? originalImages.slice(5) : [];

      combinations = [{
        coverImage: coverImages[0] || null,
        mainImages: mainImagesFromOriginal,
        detailImages: detailImagesFromOriginal
      }];
    }

    // 解析原商品SKU
    const originalSkuList = JSON.parse(sourceProduct.sku_list || '[]');

    // 批量创建裂变商品
    let successCount = 0;
    let failedCount = 0;
    const failedDetails = [];

    // 创建页面
    const page = await context.newPage();

    try {
      for (let i = 0; i < count; i++) {
        console.log(`\n[Playwright裂变] 创建第 ${i + 1}/${count} 个商品...`);

        // 使用排列组合模式：按顺序取用，循环使用
        const combinationIndex = i % combinations.length;
        const combination = combinations[combinationIndex];

        const coverImage = combination.coverImage;
        const mainImageList = combination.mainImages;
        const detailImageList = combination.detailImages;

        console.log(`  使用组合 #${combinationIndex + 1}/${combinations.length}`);
        if (coverImage) {
          const path = require('path');
          console.log(`    首图: ${path.basename(coverImage)}`);
        }
        console.log(`    主图: ${mainImageList.length}张`);
        console.log(`    详情图: ${detailImageList.length}张`);

        // 生成新标题
        let newTitle;
        let replacementIndex = null;
        if (titleReplacements && titleReplacements.length > 0) {
          // 使用标题替换列表（循环使用）
          replacementIndex = i % titleReplacements.length;
          const baseTitle = titleReplacements[replacementIndex];
          console.log(`  使用替换标题 #${replacementIndex + 1}/${titleReplacements.length}: ${baseTitle}`);

          // 标题 = 替换标题 + 标题后缀 + 随机后缀
          if (titleSuffix) {
            newTitle = `${baseTitle}${titleSuffix}${generateRandomSuffix()}`;
          } else {
            newTitle = `${baseTitle}${generateRandomSuffix()}`;
          }
        } else {
          // 使用原标题 + 标题后缀 + 随机后缀
          if (titleSuffix) {
            newTitle = `${sourceProduct.title} ${titleSuffix} ${generateRandomSuffix()}`;
          } else {
            newTitle = `${sourceProduct.title} ${generateRandomSuffix()}`;
          }
        }

        // 确保标题不超过60字符
        if (newTitle.length > 60) {
          newTitle = newTitle.substring(0, 60);
        }

        console.log(`  生成标题: ${newTitle}`);

        // 组合所有图片：首图 + 主图 + 详情图
        const allImages = [];
        if (coverImage) {
          allImages.push(coverImage);
        }
        allImages.push(...mainImageList);
        allImages.push(...detailImageList);

        console.log(`  本次使用图片: 首图1张 + 主图${mainImageList.length}张 + 详情图${detailImageList.length}张`);

        // 处理SKU（价格浮动）
        const newSkuList = [];
        for (const sku of originalSkuList) {
          const newSku = { ...sku };
          // 生成新的SKU编码
          if (newSku.sku_id) {
            newSku.sku_id = generateRandomSkuCode(newSku.sku_id);
          }
          // 价格浮动
          if (newSku.price && priceFloatAmount > 0) {
            const floatAmountCents = Math.floor(priceFloatAmount * 100);
            const variation = Math.floor(Math.random() * (2 * floatAmountCents + 1)) - floatAmountCents;
            newSku.price = Math.max(1, newSku.price + variation);
          }
          newSkuList.push(newSku);
        }

        // 创建单个裂变商品
        const result = await createSingleProduct(
          page,
          sourceProduct,
          newTitle,
          allImages,
          newSkuList,
          publishMode,
          coverImage,
          mainImageList,
          detailImageList
        );

        if (result.success) {
          successCount++;
          console.log(`✓ 第 ${i + 1} 个商品创建成功`);
        } else {
          failedCount++;
          // 保存失败详情，包含素材信息以便重试
          failedDetails.push({
            index: i + 1,
            title: newTitle,
            reason: result.message || '未知错误',
            // 保存素材信息用于重试
            combinationIndex: combinationIndex,
            titleReplacementIndex: replacementIndex,
            coverImage: coverImage,
            mainImages: mainImageList,
            detailImages: detailImageList,
            skuList: newSkuList
          });
          console.log(`✗ 第 ${i + 1} 个商品创建失败: ${result.message}`);
        }

        // 调用进度回调
        if (onProgress) {
          onProgress({
            currentIndex: i + 1,
            total: count,
            successCount,
            failedCount,
            currentTitle: newTitle,
            progressPercent: Math.floor(((i + 1) / count) * 100)
          });
        }

        // 每个商品之间间隔3秒
        if (i < count - 1) {
          await page.waitForTimeout(3000);
        }
      }

    } finally {
      // 关闭页面
      await page.close();
    }

    console.log(`\n[Playwright裂变] 裂变完成`);
    console.log(`  成功: ${successCount}`);
    console.log(`  失败: ${failedCount}`);

    return {
      success: true,
      message: `裂变完成，成功${successCount}个，失败${failedCount}个`,
      total: count,
      successCount,
      failedCount,
      failedDetails
    };

  } catch (error) {
    console.log(`✗ Playwright裂变失败: ${error.message}`);
    console.error(error.stack);

    return {
      success: false,
      message: `裂变失败: ${error.message}`
    };
  }
}

module.exports = {
  createSingleProduct,
  executeFission
};
