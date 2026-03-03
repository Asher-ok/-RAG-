/**
 * 商品裂变 - 工具函数模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应方法:
 * - _generate_random_suffix
 * - _generate_random_sku_code
 * - _get_images_from_folder
 */

const fs = require('fs');
const path = require('path');

/**
 * 生成随机后缀
 * 对应后端: _generate_random_suffix(self, length: int = 4) -> str
 * 
 * @param {number} length - 后缀长度，默认4
 * @returns {string} 随机后缀
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
 * 生成随机SKU编码
 * 对应后端: _generate_random_sku_code(self, original_code: str) -> str
 * 
 * @param {string} originalCode - 原始SKU编码
 * @returns {string} 新的SKU编码
 */
function generateRandomSkuCode(originalCode) {
  const suffix = generateRandomSuffix(6);
  return `${originalCode}-${suffix}`;
}

/**
 * 从文件夹中获取图片文件路径
 * 对应后端: _get_images_from_folder(self, folder_path: str, has_subfolders: bool = False) -> List[str]
 * 
 * @param {string} folderPath - 文件夹路径
 * @param {boolean} hasSubfolders - 是否包含子文件夹
 *   - false: 直接从文件夹中获取所有图片
 *   - true: 随机选择一个子文件夹，获取该子文件夹中的所有图片
 * @returns {string[]} 图片文件路径列表
 */
function getImagesFromFolder(folderPath, hasSubfolders = false) {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return [];
  }

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

  try {
    if (hasSubfolders) {
      // 获取所有子文件夹
      const subfolders = [];
      const items = fs.readdirSync(folderPath);
      for (const item of items) {
        const itemPath = path.join(folderPath, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          subfolders.push(itemPath);
        }
      }

      if (subfolders.length === 0) {
        console.log(`  ⚠ 文件夹中没有子文件夹: ${folderPath}`);
        return [];
      }

      // 随机选择一个子文件夹
      const selectedSubfolder = subfolders[Math.floor(Math.random() * subfolders.length)];
      console.log(`  随机选择子文件夹: ${path.basename(selectedSubfolder)}`);

      // 获取该子文件夹中的所有图片
      const imageFiles = [];
      const files = fs.readdirSync(selectedSubfolder);
      for (const filename of files) {
        const filePath = path.join(selectedSubfolder, filename);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filename).toLowerCase();
          if (imageExtensions.includes(ext)) {
            imageFiles.push(filePath);
          }
        }
      }

      return imageFiles.sort();
    } else {
      // 直接从文件夹中获取所有图片
      const imageFiles = [];
      const files = fs.readdirSync(folderPath);
      for (const filename of files) {
        const filePath = path.join(folderPath, filename);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filename).toLowerCase();
          if (imageExtensions.includes(ext)) {
            imageFiles.push(filePath);
          }
        }
      }

      return imageFiles.sort();
    }
  } catch (error) {
    console.log(`读取文件夹失败: ${folderPath}, 错误: ${error.message}`);
    return [];
  }
}

module.exports = {
  generateRandomSuffix,
  generateRandomSkuCode,
  getImagesFromFolder
};
