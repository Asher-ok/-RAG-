/**
 * 商品裂变自动化 - 模块导出
 * 
 * 完整迁移自后端 Python 代码
 * 所有逻辑、选择器、等待时间都与后端完全一致
 */

const { executeFission, createSingleProduct } = require('./fission-executor');
const { generateAllCombinations } = require('./fission-combinations');
const { generateRandomSuffix, generateRandomSkuCode, getImagesFromFolder } = require('./fission-utils');

module.exports = {
  // 主执行器
  executeFission,
  createSingleProduct,
  
  // 工具函数
  generateRandomSuffix,
  generateRandomSkuCode,
  getImagesFromFolder,
  generateAllCombinations
};
