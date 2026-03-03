/**
 * 步骤7: 解析Excel文件
 * 
 * 功能：
 * 1. 读取Excel文件
 * 2. 解析商品数据
 * 3. 验证数据完整性
 * 4. 返回商品列表
 * 
 * 注意：
 * - 使用 xlsx 库解析Excel
 * - 需要验证必要字段是否存在
 * - 返回标准化的商品数据结构
 */

const XLSX = require('xlsx');
const fs = require('fs');

/**
 * 解析Excel文件
 * 
 * @param {string} filepath - Excel文件路径
 * @returns {Promise<{success: boolean, message?: string, products?: Array, details?: Object}>}
 */
async function parseExcel(filepath) {
  console.log(`\n========== [步骤7] 解析Excel文件 ==========`);
  
  try {
    // 7.1 开始解析
    console.log(`[步骤7.1] 开始解析Excel文件...`);
    console.log(`  → 文件路径: ${filepath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filepath)) {
      console.log(`  ✗ 文件不存在`);
      return {
        success: false,
        message: '文件不存在',
        products: [],
        details: {
          filepath,
          exists: false
        }
      };
    }
    
    // 读取Excel文件
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // 转换为JSON
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`  → 工作表名称: ${sheetName}`);
    console.log(`  → 原始行数: ${rawData.length}`);
    
    if (rawData.length === 0) {
      console.log(`  ✗ Excel文件为空`);
      return {
        success: false,
        message: 'Excel文件为空',
        products: [],
        details: {
          filepath,
          rowCount: 0
        }
      };
    }
    
    // 7.2 解析商品数据
    console.log(`\n[步骤7.2] 解析商品数据...`);
    
    // 按商品ID分组（一个商品可能有多个SKU行）
    const productMap = new Map();
    
    for (const row of rawData) {
      try {
        const productId = String(row['商品ID'] || '');
        if (!productId) continue;
        
        if (!productMap.has(productId)) {
          // 商品类型转换
          const productTypeStr = String(row['商品类型'] || '普通商品');
          const productType = productTypeStr.includes('虚拟') ? 2 : 1;
          
          // 审核状态转换
          const auditStatusStr = String(row['商品审核状态'] || '');
          let auditStatus = 0;
          if (auditStatusStr.includes('通过') || auditStatusStr.includes('审核通过')) {
            auditStatus = 1;
          } else if (auditStatusStr.includes('拒绝') || auditStatusStr.includes('审核拒绝')) {
            auditStatus = 2;
          }
          
          // 商品状态转换
          let productStatus = 0;
          if (auditStatusStr.includes('审核通过') || auditStatusStr.includes('通过')) {
            productStatus = 1; // 上架
          } else if (auditStatusStr.includes('未提交')) {
            productStatus = 2; // 下架
          }
          
          // 创建商品对象（完全匹配后端字段）
          productMap.set(productId, {
            product_id: productId,
            title: String(row['商品名称'] || ''),
            // 类目ID
            first_cid: String(row['一级类目ID'] || '0'),
            second_cid: String(row['二级类目ID'] || '0'),
            third_cid: String(row['三级类目ID'] || '0'),
            fourth_cid: row['四级类目ID'] ? String(row['四级类目ID']) : null,
            // 类目名称
            first_cname: String(row['一级类目'] || ''),
            second_cname: String(row['二级类目'] || ''),
            third_cname: String(row['三级类目'] || ''),
            fourth_cname: row['四级类目'] ? String(row['四级类目']) : null,
            product_type: productType,
            product_group: row['商品分组'] ? String(row['商品分组']) : null,
            merchant_code: row['商家编码'] ? String(row['商家编码']) : null,
            item_number: row['货号'] ? String(row['货号']) : null,
            price: 0, // 后面计算平均价格
            stock: 0, // 后面计算总库存
            available_stock: 0,
            presale_stock: parseInt(row['预售库存'] || 0),
            ladder_stock: row['阶梯库存'] ? String(row['阶梯库存']) : null,
            delivery_time: parseInt(row['商品发货时间'] || 1),
            sales_count: parseInt(row['销量'] || 0),
            commission_rate: row['佣金比例'] ? parseFloat(row['佣金比例']) : null,
            audit_status: auditStatus,
            product_url: row['商品链接'] ? String(row['商品链接']) : null,
            product_status: productStatus,
            sku_list: [],
            images: []
          });
        }
        
        // 添加SKU信息
        const product = productMap.get(productId);
        const sku = {
          sku_id: String(row['规格ID（SKUID）'] || ''),
          merchant_code: String(row['商家SKU编码'] || ''),
          spec: String(row['商品规格'] || ''),
          price: parseFloat(row['商品价格'] || 0),
          stock: parseInt(row['现货可售'] || 0),
          presale_stock: parseInt(row['预售库存'] || 0)
        };
        product.sku_list.push(sku);
        
      } catch (error) {
        console.log(`  ⚠ 解析行数据失败: ${error.message}`);
        continue;
      }
    }
    
    // 计算每个商品的总库存和平均价格
    const products = Array.from(productMap.values());
    for (const product of products) {
      if (product.sku_list.length > 0) {
        product.stock = product.sku_list.reduce((sum, sku) => sum + sku.stock, 0);
        product.available_stock = product.stock;
        product.price = product.sku_list.reduce((sum, sku) => sum + sku.price, 0) / product.sku_list.length;
      }
    }
    
    const productCount = products.length;
    console.log(`  ✓ 成功解析 ${productCount} 个商品`);
    
    // 7.3 验证商品数据
    console.log(`\n[步骤7.3] 验证商品数据...`);
    
    const requiredFields = ['product_id', 'title', 'price', 'stock', 'product_status'];
    const optionalFields = ['sku_list', 'images'];
    
    let validCount = 0;
    let invalidCount = 0;
    const fieldStats = {};
    
    for (const field of [...requiredFields, ...optionalFields]) {
      fieldStats[field] = 0;
    }
    
    for (const product of products) {
      let isValid = true;
      
      // 检查必需字段
      for (const field of requiredFields) {
        if (field in product && product[field] !== null && product[field] !== '') {
          fieldStats[field]++;
        } else {
          isValid = false;
        }
      }
      
      // 检查可选字段
      for (const field of optionalFields) {
        if (field in product && product[field] !== null) {
          fieldStats[field]++;
        }
      }
      
      if (isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }
    
    console.log(`  → 有效商品: ${validCount} 个`);
    console.log(`  → 无效商品: ${invalidCount} 个`);
    
    console.log(`\n  → 字段完整性统计:`);
    for (const field of requiredFields) {
      const count = fieldStats[field];
      const percentage = productCount > 0 ? (count / productCount * 100).toFixed(1) : 0;
      console.log(`    • ${field} (必需): ${count}/${productCount} (${percentage}%)`);
    }
    for (const field of optionalFields) {
      const count = fieldStats[field];
      const percentage = productCount > 0 ? (count / productCount * 100).toFixed(1) : 0;
      console.log(`    • ${field} (可选): ${count}/${productCount} (${percentage}%)`);
    }
    
    // 7.4 显示示例商品
    console.log(`\n[步骤7.4] 商品数据示例...`);
    
    if (products.length > 0) {
      const sampleProduct = products[0];
      console.log(`  → 第一个商品:`);
      console.log(`    • 商品ID: ${sampleProduct.product_id || 'N/A'}`);
      console.log(`    • 标题: ${(sampleProduct.title || 'N/A').substring(0, 50)}...`);
      console.log(`    • 价格: ${sampleProduct.price || 'N/A'}`);
      console.log(`    • 库存: ${sampleProduct.stock || 'N/A'}`);
      console.log(`    • 状态: ${sampleProduct.product_status || 'N/A'}`);
      
      if (sampleProduct.sku_list) {
        const skuCount = Array.isArray(sampleProduct.sku_list) ? sampleProduct.sku_list.length : 0;
        console.log(`    • SKU数量: ${skuCount}`);
      }
      
      if (sampleProduct.images) {
        const imageCount = Array.isArray(sampleProduct.images) ? sampleProduct.images.length : 0;
        console.log(`    • 图片数量: ${imageCount}`);
      }
    }
    
    // 7.5 统计商品状态分布
    console.log(`\n[步骤7.5] 商品状态分布...`);
    
    const statusStats = {};
    for (const product of products) {
      const status = product.product_status || '未知';
      if (!statusStats[status]) {
        statusStats[status] = 0;
      }
      statusStats[status]++;
    }
    
    for (const [status, count] of Object.entries(statusStats)) {
      const percentage = productCount > 0 ? (count / productCount * 100).toFixed(1) : 0;
      console.log(`  → ${status}: ${count} 个 (${percentage}%)`);
    }
    
    console.log(`========== [步骤7] 完成 ==========\n`);
    
    return {
      success: true,
      message: `成功解析 ${productCount} 个商品`,
      products,
      details: {
        filepath,
        productCount,
        validCount,
        invalidCount,
        fieldStats,
        statusStats
      }
    };
    
  } catch (error) {
    console.error(`  ✗ 解析Excel文件失败: ${error.message}`);
    console.error(error.stack);
    
    return {
      success: false,
      message: `解析失败: ${error.message}`,
      products: [],
      details: {
        filepath,
        error: error.message
      }
    };
  }
}

module.exports = {
  parseExcel
};
