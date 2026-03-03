/**
 * 商品裂变 - 素材组合生成模块
 * 
 * 完整迁移自: backend/app/services/fission_playwright.py
 * 对应方法: _generate_all_combinations
 */

const fs = require('fs');
const path = require('path');

/**
 * 生成所有素材组合（排列组合模式，不重复）
 * 对应后端: _generate_all_combinations(self, cover_image_folder, main_image_folder, detail_image_folder) -> List[Dict[str, Any]]
 * 
 * @param {string} coverImageFolder - 首图文件夹路径
 * @param {string} mainImageFolder - 主图文件夹路径
 * @param {string} detailImageFolder - 详情图文件夹路径
 * @returns {Array<{coverImage: string, mainImages: string[], detailImages: string[]}>} 所有组合的列表
 */
function generateAllCombinations(coverImageFolder, mainImageFolder, detailImageFolder) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const combinations = [];

  // 1. 获取所有首图
  const coverImages = [];
  if (coverImageFolder && fs.existsSync(coverImageFolder)) {
    const files = fs.readdirSync(coverImageFolder);
    for (const filename of files) {
      const filePath = path.join(coverImageFolder, filename);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        const ext = path.extname(filename).toLowerCase();
        if (imageExtensions.includes(ext)) {
          coverImages.push(filePath);
        }
      }
    }
    coverImages.sort();
  }

  // 2. 获取所有主图方案（每个子文件夹是一个方案）
  const mainImagePlans = [];
  if (mainImageFolder && fs.existsSync(mainImageFolder)) {
    const items = fs.readdirSync(mainImageFolder);
    const subfolders = [];
    for (const item of items) {
      const itemPath = path.join(mainImageFolder, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        subfolders.push(itemPath);
      }
    }

    for (const subfolder of subfolders.sort()) {
      const images = [];
      const files = fs.readdirSync(subfolder);
      for (const filename of files) {
        const filePath = path.join(subfolder, filename);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filename).toLowerCase();
          if (imageExtensions.includes(ext)) {
            images.push(filePath);
          }
        }
      }
      if (images.length > 0) {
        mainImagePlans.push(images.sort());
      }
    }
  }

  // 3. 获取所有详情图方案（每个子文件夹是一个方案）
  const detailImagePlans = [];
  if (detailImageFolder && fs.existsSync(detailImageFolder)) {
    const items = fs.readdirSync(detailImageFolder);
    const subfolders = [];
    for (const item of items) {
      const itemPath = path.join(detailImageFolder, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        subfolders.push(itemPath);
      }
    }

    for (const subfolder of subfolders.sort()) {
      const images = [];
      const files = fs.readdirSync(subfolder);
      for (const filename of files) {
        const filePath = path.join(subfolder, filename);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          const ext = path.extname(filename).toLowerCase();
          if (imageExtensions.includes(ext)) {
            images.push(filePath);
          }
        }
      }
      if (images.length > 0) {
        detailImagePlans.push(images.sort());
      }
    }
  }

  // 4. 生成所有组合
  if (coverImages.length > 0 && mainImagePlans.length > 0 && detailImagePlans.length > 0) {
    for (const cover of coverImages) {
      for (const mainPlan of mainImagePlans) {
        for (const detailPlan of detailImagePlans) {
          combinations.push({
            coverImage: cover,
            mainImages: mainPlan,
            detailImages: detailPlan
          });
        }
      }
    }
  }

  // 5. 打乱顺序（看起来是随机的，但不会重复）
  for (let i = combinations.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combinations[i], combinations[j]] = [combinations[j], combinations[i]];
  }

  console.log(`  生成组合总数: ${combinations.length}`);
  console.log(`    首图: ${coverImages.length}张`);
  console.log(`    主图方案: ${mainImagePlans.length}个`);
  console.log(`    详情图方案: ${detailImagePlans.length}个`);

  return combinations;
}

module.exports = {
  generateAllCombinations
};
