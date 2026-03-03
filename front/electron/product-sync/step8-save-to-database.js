/**
 * 步骤8: 保存到数据库
 * 
 * 功能：
 * 1. 上传Excel文件到后端
 * 2. 后端解析并保存到数据库
 * 3. 返回保存结果
 * 
 * 注意：
 * - 直接上传Excel文件，避免前端解析不一致
 * - 后端使用统一的解析逻辑
 * - 避免大JSON导致的413错误
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * 保存商品到数据库（通过上传Excel文件）
 * 
 * @param {number} shopId - 店铺ID
 * @param {string} excelFilePath - Excel文件路径
 * @param {Object} options - 选项
 * @param {string} options.apiBaseUrl - API基础URL
 * @param {string} options.token - 认证token
 * @param {Function} options.progressCallback - 进度回调函数
 * @returns {Promise<{success: boolean, message?: string, savedCount?: number, updatedCount?: number, failedCount?: number, details?: Object}>}
 */
async function saveToDatabase(shopId, excelFilePath, options = {}) {
  const {
    apiBaseUrl = 'http://123.56.44.206/api/v1',
    token = '',
    progressCallback = null
  } = options;
  
  console.log(`\n========== [步骤8] 保存到数据库 ==========`);
  
  try {
    // 8.1 检查文件
    console.log(`[步骤8.1] 检查Excel文件...`);
    console.log(`  → 文件路径: ${excelFilePath}`);
    
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel文件不存在: ${excelFilePath}`);
    }
    
    const fileStats = fs.statSync(excelFilePath);
    const fileSizeKB = (fileStats.size / 1024).toFixed(2);
    console.log(`  → 文件大小: ${fileSizeKB} KB`);
    console.log(`  ✓ 文件检查通过`);
    
    // 8.2 准备上传
    console.log(`\n[步骤8.2] 准备上传文件...`);
    console.log(`  → 店铺ID: ${shopId}`);
    console.log(`  → API地址: ${apiBaseUrl}/product/upload-excel`);
    
    // 创建FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(excelFilePath));
    formData.append('shop_id', shopId.toString());
    
    console.log(`  ✓ FormData准备完成`);
    
    // 8.3 上传文件
    console.log(`\n[步骤8.3] 上传Excel文件到后端...`);
    
    const response = await axios.post(
      `${apiBaseUrl}/product/upload-excel`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...formData.getHeaders()
        },
        timeout: 300000, // 5分钟超时
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log(`  ✓ 文件上传完成`);
    
    // 8.4 处理响应
    console.log(`\n[步骤8.4] 处理后端响应...`);
    
    if (response.data.code !== 200) {
      console.log(`  ✗ 后端处理失败`);
      console.log(`  → 错误码: ${response.data.code}`);
      console.log(`  → 错误信息: ${response.data.msg}`);
      
      return {
        success: false,
        message: response.data.msg || '后端处理失败',
        details: response.data
      };
    }
    
    const result = response.data.data;
    const totalCount = result.total_count || 0;
    const savedCount = result.saved_count || 0;
    const updatedCount = result.updated_count || 0;
    const failedCount = result.failed_count || 0;
    const successRate = result.success_rate || 0;
    
    console.log(`  ✓ 后端处理完成`);
    console.log(`  → 总计: ${totalCount} 个`);
    console.log(`  → 新增: ${savedCount} 个`);
    console.log(`  → 更新: ${updatedCount} 个`);
    console.log(`  → 失败: ${failedCount} 个`);
    console.log(`  → 成功率: ${successRate.toFixed(1)}%`);
    
    // 8.5 显示失败详情
    if (failedCount > 0 && result.failed_details && result.failed_details.length > 0) {
      console.log(`\n[步骤8.5] 失败商品详情...`);
      
      const failedDetails = result.failed_details.slice(0, 5); // 最多显示前5个
      for (const detail of failedDetails) {
        console.log(`  → 第 ${detail.index} 个:`);
        if (detail.product_id) {
          console.log(`    • 商品ID: ${detail.product_id}`);
        }
        if (detail.title) {
          console.log(`    • 标题: ${detail.title}`);
        }
        console.log(`    • 原因: ${detail.reason}`);
      }
      
      if (failedCount > 5) {
        console.log(`  → ... 还有 ${failedCount - 5} 个失败商品`);
      }
    }
    
    // 调用进度回调
    if (progressCallback) {
      await progressCallback({
        current: totalCount,
        total: totalCount,
        saved: savedCount,
        updated: updatedCount,
        failed: failedCount,
        percentage: 100
      });
    }
    
    console.log(`========== [步骤8] 完成 ==========\n`);
    
    return {
      success: true,
      message: response.data.msg || `商品保存完成，新增 ${savedCount} 个，更新 ${updatedCount} 个`,
      savedCount,
      updatedCount,
      failedCount,
      details: {
        shopId,
        total: totalCount,
        saved: savedCount,
        updated: updatedCount,
        failed: failedCount,
        successRate,
        failedDetails: result.failed_details || []
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 保存到数据库失败: ${error.message}`);
    console.error(error.stack);
    
    // 检查是否是网络错误
    if (error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: '无法连接到后端服务器',
        details: {
          error: error.message,
          code: error.code
        }
      };
    }
    
    if (error.response) {
      // 服务器返回了错误响应
      return {
        success: false,
        message: `服务器错误: ${error.response.status} ${error.response.statusText}`,
        details: {
          status: error.response.status,
          data: error.response.data
        }
      };
    }
    
    return {
      success: false,
      message: `保存失败: ${error.message}`,
      details: {
        error: error.message
      }
    };
  }
}

module.exports = {
  saveToDatabase
};
