/**
 * Electron 商品裂变 - 主执行器
 * 
 * 串联所有11个步骤，执行完整的裂变流程
 * 
 * 步骤列表：
 * 1. 访问创建相似品页面
 * 2. 修改商品标题
 * 3. 删除主图3:4区域图片
 * 4. 删除主图区域图片
 * 5. 验证删除完成
 * 6. 上传主图第一张
 * 7. 上传主图辅助图2-5
 * 8. 智能裁剪生成3:4主图
 * 9. 删除详情图片
 * 10. 上传详情图片
 * 11. 提交商品（发布或保存草稿）
 */

const { visitCreateSimilarPage } = require('./step1-visit-page');
const { modifyProductTitle } = require('./step2-modify-title');
const { deleteMain34Images } = require('./step3-delete-main34-images');
const { deleteMainImages } = require('./step4-delete-main-images');
const { verifyDeletion } = require('./step5-verify-deletion');
const { uploadFirstMainImage } = require('./step6-upload-first-main-image');
const { uploadAuxiliaryMainImages } = require('./step7-upload-auxiliary-main-images');
const { smartCropMain34 } = require('./step8-smart-crop-main34');
const { deleteDetailImages } = require('./step9-delete-detail-images');
const { uploadDetailImages } = require('./step10-upload-detail-images');
const { submitProduct } = require('./step11-submit-product');

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * 创建单个裂变商品（Electron版本）
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} sourceProduct - 原商品信息
 * @param {string} newTitle - 新标题
 * @param {number} index - 当前索引（用于循环标题）
 * @param {Object} options - 选项
 * @param {string[]} options.titleReplacements - 循环标题列表
 * @param {string} options.titleSuffix - 标题后缀
 * @param {string} options.coverImage - 首图路径
 * @param {string[]} options.mainImages - 主图列表（4张）
 * @param {string[]} options.detailImages - 详情图列表
 * @param {number} options.publishMode - 发布模式 1=草稿 2=上架 3=下架
 * @param {boolean} options.isLastTask - 是否是最后一个任务
 * @param {Function} options.stepProgressCallback - 步骤进度回调函数
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function createSingleProduct(window, sourceProduct, newTitle, index, options = {}) {
  const {
    titleReplacements = null,
    titleSuffix = null,
    coverImage = null,
    mainImages = [],
    detailImages = [],
    publishMode = 2,
    isLastTask = true, // 默认是最后一个任务
    stepProgressCallback = null, // 步骤进度回调
    getCancelStatus = null // ✅ 新增：取消状态检查函数
  } = options;

  /**
   * 发送步骤进度（只通过回调，不直接发送IPC）
   */
  async function sendProgress(stepName, status, message = '', details = '') {
    const progressData = {
      step: stepName,
      status,
      message,
      details,
      timestamp: new Date().toISOString()
    };
    
    // 只调用回调函数（handler 会转发到主窗口的渲染进程）
    if (stepProgressCallback) {
      await stepProgressCallback(progressData);
    }
    
    console.log(`[步骤进度] ${stepName} - ${status}: ${message}`);
  }

  try {
    console.log(`\n========================================`);
    console.log(`  开始创建商品: ${newTitle}`);
    console.log(`========================================`);

    // ✅ 检查取消状态
    if (getCancelStatus && getCancelStatus()) {
      console.log(`[创建商品] ⚠️ 任务已被取消，停止创建`);
      return { success: false, message: '任务已取消', cancelled: true };
    }

    // 步骤1: 访问创建相似品页面
    await sendProgress('访问创建页面', 'processing', '正在访问创建相似品页面...', 
                      `商品ID: ${sourceProduct.douyin_product_id}`);
    const step1Result = await visitCreateSimilarPage(window, sourceProduct.douyin_product_id, {
      shopName: sourceProduct.shop_name || '未知店铺',
      taskId: options.taskId //  // 新增✅ 透传 taskId，用于日志或调试
    });
    if (!step1Result.success) {
      await sendProgress('访问创建页面', 'failed', step1Result.message, 
                        `商品ID: ${sourceProduct.douyin_product_id}`);
      await sendProgress('跳过当前商品', 'warning', '步骤1失败，跳过当前商品，继续下一个', 
                        `失败原因: ${step1Result.message}`);
      return { success: false, message: `步骤1失败: ${step1Result.message}`, skipToNext: true };
    }
    await sendProgress('访问创建页面', 'success', '成功访问创建相似品页面', 
                      `店铺: ${sourceProduct.shop_name || '未知店铺'}`);

    // ✅ 检查取消状态
    if (getCancelStatus && getCancelStatus()) {
      console.log(`[创建商品] ⚠️ 任务已被取消，停止创建`);
      return { success: false, message: '任务已取消', cancelled: true };
    }

    // 步骤2: 修改商品标题
    await sendProgress('修改商品标题', 'processing', '正在修改商品标题...', `新标题: ${newTitle}`);
    const step2Result = await modifyProductTitle(window, newTitle, index, {
      // ✅ 不传递 titleReplacements 和 titleSuffix，直接使用传入的 newTitle
      // titleReplacements,
      // titleSuffix
    });
    if (!step2Result.success) {
      await sendProgress('修改商品标题', 'failed', step2Result.message);
      await sendProgress('跳过当前商品', 'warning', '步骤2失败，跳过当前商品，继续下一个');
      return { success: false, message: `步骤2失败: ${step2Result.message}`, skipToNext: true };
    }
    await sendProgress('修改商品标题', 'success', '标题修改成功', `新标题: ${newTitle}`);

    // ✅ 检查取消状态
    if (getCancelStatus && getCancelStatus()) {
      console.log(`[创建商品] ⚠️ 任务已被取消，停止创建`);
      return { success: false, message: '任务已取消', cancelled: true };
    }

    // 步骤3: 删除主图3:4区域图片
    await sendProgress('删除主图3:4', 'processing', '正在删除主图3:4区域图片...');
    const step3Result = await deleteMain34Images(window);
    if (!step3Result.success) {
      await sendProgress('删除主图3:4', 'warning', step3Result.message);
      console.log(`  ⚠ 步骤3警告: ${step3Result.message}，继续执行`);
    } else {
      await sendProgress('删除主图3:4', 'success', '主图3:4区域图片删除成功');
    }

    // 步骤4: 删除主图区域图片
    await sendProgress('删除主图', 'processing', '正在删除主图区域图片...');
    const step4Result = await deleteMainImages(window);
    if (!step4Result.success) {
      await sendProgress('删除主图', 'warning', step4Result.message);
      console.log(`  ⚠ 步骤4警告: ${step4Result.message}，继续执行`);
    } else {
      await sendProgress('删除主图', 'success', '主图区域图片删除成功');
    }

    // 步骤5: 验证删除完成
    await sendProgress('验证删除', 'processing', '正在验证图片删除...');
    const step5Result = await verifyDeletion(window);
    if (!step5Result.success) {
      await sendProgress('验证删除', 'warning', step5Result.message);
      console.log(`  ⚠ 步骤5警告: ${step5Result.message}，继续执行`);
    } else {
      await sendProgress('验证删除', 'success', '图片删除验证通过');
    }

    // 步骤6: 上传主图第一张（商品正面图）
    if (coverImage) {
      await sendProgress('上传首图', 'processing', '正在上传首图...');
      const step6Result = await uploadFirstMainImage(window, coverImage);
      if (!step6Result.success) {
        await sendProgress('上传首图', 'failed', step6Result.message);
        await sendProgress('跳过当前商品', 'warning', '步骤6失败，跳过当前商品，继续下一个');
        return { success: false, message: `步骤6失败: ${step6Result.message}`, skipToNext: true };
      }
      await sendProgress('上传首图', 'success', '首图上传成功');
    } else {
      await sendProgress('上传首图', 'warning', '未提供首图，跳过此步骤');
      console.log(`  ⚠ 未提供首图，跳过步骤6`);
    }

    // ✅ 检查取消状态
    if (getCancelStatus && getCancelStatus()) {
      console.log(`[创建商品] ⚠️ 任务已被取消，停止创建`);
      return { success: false, message: '任务已取消', cancelled: true };
    }

    // 步骤7: 上传主图辅助图2-5
    if (mainImages && mainImages.length > 0) {
      await sendProgress('上传主图2-5', 'processing', `正在上传主图辅助图...`, `共${mainImages.length}张`);
      // 确保有4张图片
      const auxiliaryImages = mainImages.slice(0, 4);
      if (auxiliaryImages.length < 4) {
        console.log(`  ⚠ 主图数量不足4张（实际${auxiliaryImages.length}张），可能影响上传`);
      }

      const step7Result = await uploadAuxiliaryMainImages(window, auxiliaryImages);
      if (!step7Result.success) {
        await sendProgress('上传主图2-5', 'warning', step7Result.message);
        console.log(`  ⚠ 步骤7警告: ${step7Result.message}，继续执行`);
      } else {
        await sendProgress('上传主图2-5', 'success', `主图辅助图上传成功`, `共${auxiliaryImages.length}张`);
      }
    } else {
      await sendProgress('上传主图2-5', 'warning', '未提供主图，跳过此步骤');
      console.log(`  ⚠ 未提供主图，跳过步骤7`);
    }

    // 步骤8: 智能裁剪生成3:4主图
    await sendProgress('智能裁剪3:4', 'processing', '正在智能裁剪生成3:4主图...');
    const step8Result = await smartCropMain34(window);
    if (!step8Result.success) {
      await sendProgress('智能裁剪3:4', 'warning', step8Result.message);
      console.log(`  ⚠ 步骤8警告: ${step8Result.message}，继续执行`);
    } else {
      await sendProgress('智能裁剪3:4', 'success', '3:4主图生成成功');
    }

    // 步骤9: 删除详情图片
    await sendProgress('删除详情图', 'processing', '正在删除详情图片...');
    const step9Result = await deleteDetailImages(window, stepProgressCallback);
    if (!step9Result.success) {
      await sendProgress('删除详情图', 'warning', step9Result.message);
      console.log(`  ⚠ 步骤9警告: ${step9Result.message}，继续执行`);
    } else {
      await sendProgress('删除详情图', 'success', '详情图片删除成功');
    }

    // 步骤10: 上传详情图片
    if (detailImages && detailImages.length > 0) {
      await sendProgress('上传详情图', 'processing', `正在上传详情图...`, `共${detailImages.length}张`);
      const step10Result = await uploadDetailImages(window, detailImages, stepProgressCallback);
      if (!step10Result.success) {
        await sendProgress('上传详情图', 'warning', step10Result.message);
        console.log(`  ⚠ 步骤10警告: ${step10Result.message}，继续执行`);
      } else {
        await sendProgress('上传详情图', 'success', `详情图上传成功`, `共${detailImages.length}张`);
      }
    } else {
      await sendProgress('上传详情图', 'warning', '未提供详情图，跳过此步骤');
      console.log(`  ⚠ 未提供详情图，跳过步骤10`);
    }

    // ✅ 检查取消状态
    if (getCancelStatus && getCancelStatus()) {
      console.log(`[创建商品] ⚠️ 任务已被取消，停止创建`);
      return { success: false, message: '任务已取消', cancelled: true };
    }

    // 步骤11: 提交商品
    const publishModeText = publishMode === 1 ? '保存为草稿' : publishMode === 2 ? '发布商品' : '下架';
    await sendProgress('提交商品', 'processing', `正在提交商品（${publishModeText}）...`);
    const step11Result = await submitProduct(window, publishMode, {
      isLastTask: isLastTask // 传递是否最后一个任务
    });
    if (!step11Result.success) {
      await sendProgress('提交商品', 'failed', step11Result.message);
      await sendProgress('跳过当前商品', 'warning', '步骤11失败，跳过当前商品，继续下一个');
      return { success: false, message: `步骤11失败: ${step11Result.message}`, skipToNext: true };
    }
    await sendProgress('提交商品', 'success', `商品${publishModeText}成功`);

    console.log(`\n========================================`);
    console.log(`  ✓ 商品创建成功: ${newTitle}`);
    console.log(`========================================\n`);

    await sendProgress('完成', 'success', '商品创建完成', `标题: ${newTitle}`);

    return {
      success: true,
      message: '商品创建成功'
    };

  } catch (error) {
    console.error(`✗ 创建商品失败: ${error.message}`);
    console.error(error.stack);
    
    // ✅ 检查是否是窗口销毁错误（取消任务导致）
    const isWindowDestroyed = 
      error.message.includes('Object has been destroyed') ||
      error.message.includes('window is destroyed') ||
      error.message.includes('WebContents was destroyed');
    
    if (isWindowDestroyed) {
      console.log(`[创建商品] ⚠️ 窗口已销毁（任务已取消）`);
      return {
        success: false,
        message: '任务已取消（窗口已关闭）',
        cancelled: true
      };
    }
    
    if (stepProgressCallback) {
      await stepProgressCallback({
        step: '异常',
        status: 'failed',
        message: `创建商品失败: ${error.message}`,
        details: error.stack,
        timestamp: new Date().toISOString()
      });
      await stepProgressCallback({
        step: '跳过当前商品',
        status: 'warning',
        message: '发生异常，跳过当前商品，继续下一个',
        details: '',
        timestamp: new Date().toISOString()
      });
    }
    
    return {
      success: false,
      message: `创建商品失败: ${error.message}`,
      skipToNext: true // 标记为跳过，继续下一个
    };
  }
}

/**
 * 执行完整的裂变流程（Electron版本）
 * 
 * @param {BrowserWindow} window - Electron窗口对象
 * @param {Object} params - 裂变参数
 * @param {Object} params.sourceProduct - 原商品信息
 * @param {number} params.count - 裂变数量
 * @param {number} params.priceFloatAmount - 价格浮动金额（暂不实现）
 * @param {string} params.titleSuffix - 标题后缀
 * @param {string[]} params.titleReplacements - 循环标题列表
 * @param {number} params.publishMode - 发布模式 1=草稿 2=上架
 * @param {string} params.coverImageFolder - 首图文件夹路径
 * @param {string} params.mainImageFolder - 主图文件夹路径
 * @param {string} params.detailImageFolder - 详情图文件夹路径
 * @param {string} params.taskId - 任务ID（用于检查取消状态）
 * @param {string} params.token - 认证token（用于调用后端API）
 * @param {Function} stepProgressCallback - 步骤进度回调函数
 * @param {Function} progressCallback - 商品级别进度回调函数
 * @returns {Promise<Object>} 裂变结果
 */
async function executeFissionElectron(window, params, stepProgressCallback, progressCallback) {
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
    console.log(`\n========================================`);
    console.log(`  [Electron裂变] 开始执行`);
    console.log(`========================================`);
    console.log(`  原商品: ${sourceProduct.title}`);
    console.log(`  裂变数量: ${count}`);
    console.log(`  发布模式: ${publishMode === 1 ? '保存草稿' : '发布商品'}`);
    console.log(`  首图文件夹: ${coverImageFolder || '未提供'}`);
    console.log(`  主图文件夹: ${mainImageFolder || '未提供'}`);
    console.log(`  详情图文件夹: ${detailImageFolder || '未提供'}`);

    // 读取素材文件夹中的图片 - 使用排列组合模式
    const { generateAllCombinations } = require('../automation/fission-combinations');
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
      console.log(`  素材组合数: ${allCombinations.length}`);
      console.log(`  首图数量: ${allCombinations[0].coverImage ? 1 : 0}`);
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

    // 批量创建裂变商品
    let successCount = 0;
    let failedCount = 0;
    const failedDetails = [];
    
    // ✅ 取消标志（通过外部设置）
    let isCancelled = false;
    
    // ✅ 暴露取消方法（通过 params 传入）
    if (params.getCancelStatus) {
      // 每次循环前检查取消状态
    }

    for (let i = 0; i < count; i++) {
      console.log(`\n[Electron裂变] 创建第 ${i + 1}/${count} 个商品...`);

      // ✅ 检查任务是否被取消（通过回调函数）
      if (params.getCancelStatus && params.getCancelStatus()) {
        console.log(`[Electron裂变] ⚠️ 任务已被取消，停止执行`);
        
        if (stepProgressCallback) {
          await stepProgressCallback({
            step: '任务已取消',
            status: 'warning',
            message: '用户取消了任务，停止执行',
            details: `已完成 ${i}/${count} 个商品`,
            timestamp: new Date().toISOString()
          });
        }
        
        // 返回当前进度
        return {
          success: false,
          message: `任务已取消，已完成${successCount}个，失败${failedCount}个`,
          total: count,
          successCount,
          failedCount,
          failedDetails,
          cancelled: true
        };
      }

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

        // ✅ 标题 = 替换标题 + 标题后缀（不添加可见的随机后缀）
        if (titleSuffix) {
          newTitle = `${baseTitle}${titleSuffix}`;
        } else {
          newTitle = baseTitle;
        }
      } else {
        // ✅ 使用原标题 + 标题后缀（不添加可见的随机后缀）
        if (titleSuffix) {
          newTitle = `${sourceProduct.title} ${titleSuffix}`;
        } else {
          newTitle = sourceProduct.title;
        }
      }

      // 确保标题不超过60字符
      if (newTitle.length > 60) {
        newTitle = newTitle.substring(0, 60);
      }

      console.log(`  生成标题: ${newTitle}`);

      // 创建单个裂变商品
      const result = await createSingleProduct(
        window,
        sourceProduct,
        newTitle,
        i,
        {
          titleReplacements,
          titleSuffix,
          coverImage,
          mainImages: mainImageList,
          detailImages: detailImageList,
          publishMode,
          isLastTask: (i === count - 1), // 只有最后一个任务才关闭窗口
          stepProgressCallback: stepProgressCallback, // 传递步骤进度回调
          getCancelStatus: params.getCancelStatus, // ✅ 传递取消状态检查函数
          taskId: params.taskId // 新增：✅ 必须传递 taskId，供 createSingleProduct 内部使用
        }
      );

      if (result.success) {
        successCount++;
        console.log(`✓ 第 ${i + 1} 个商品创建成功`);
      } else if (result.cancelled) {
        // ✅ 任务被取消，立即停止
        console.log(`⚠️ 第 ${i + 1} 个商品创建时任务被取消`);
        return {
          success: false,
          message: `任务已取消，已完成${successCount}个，失败${failedCount}个`,
          total: count,
          successCount,
          failedCount,
          failedDetails,
          cancelled: true
        };
      } else {
        failedCount++;
        failedDetails.push({
          index: i + 1,
          title: newTitle,
          reason: result.message || '未知错误',
          combinationIndex: combinationIndex,
          titleReplacementIndex: replacementIndex
        });
        console.log(`✗ 第 ${i + 1} 个商品创建失败: ${result.message}`);
      }

      // ✅ 调用进度回调（修复：添加 await）
      if (progressCallback) {
        // 新增 ： 计算进度百分比，如果是最后一个任务，强制设置为100%
        const isLast = (i + 1) === count;
        const progressPercent = isLast ? 100 : Math.floor(((i + 1) / count) * 100);
        
        await progressCallback({
          currentIndex: i + 1,
          total: count,
          successCount,
          failedCount,
          currentTitle: newTitle,
          progressPercent: progressPercent
          //  progressPercent: Math.floor(((i + 1) / count) * 100)
        });
      }

      // 每个商品之间间隔3秒
      if (i < count - 1) {
        console.log(`  等待3秒后创建下一个商品...`);
        await wait(3000);
      }
    }

    console.log(`\n========================================`);
    console.log(`  [Electron裂变] 裂变完成`);
    console.log(`========================================`);
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
    console.error(`✗ Electron裂变失败: ${error.message}`);
    console.error(error.stack);

    return {
      success: false,
      message: `裂变失败: ${error.message}`
    };
  }
}

module.exports = {
  createSingleProduct,
  executeFissionElectron
};
