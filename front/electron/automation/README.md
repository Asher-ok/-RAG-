# 商品裂变自动化模块

## 📦 模块说明

本目录包含完整的商品裂变自动化功能，**完全迁移自后端 Python 代码**。

所有逻辑、选择器、等待时间、重试机制都与后端 `backend/app/services/fission_playwright.py` **完全一致**。

## 📁 文件结构

```
automation/
├── index.js                      # 模块导出（统一入口）
├── fission-executor.js           # 主执行器（串联所有模块）
├── fission-utils.js              # 工具函数（随机后缀、SKU编码、读取图片）
├── fission-combinations.js       # 素材组合生成（排列组合，不重复）
├── fission-delete-images.js      # 删除原有图片（主图1:1、主图3:4、详情图）
├── fission-upload-images.js      # 上传新图片（主图、详情图、智能裁剪）
├── fission-modify-product.js     # 修改商品信息（标题、价格）
├── fission-submit.js             # 提交商品（草稿/上架）
└── README.md                     # 本文档
```

## 🔄 模块对应关系

| 前端模块 | 后端对应方法 | 功能说明 |
|---------|------------|---------|
| `fission-utils.js` | `_generate_random_suffix`<br>`_generate_random_sku_code`<br>`_get_images_from_folder` | 生成随机后缀<br>生成SKU编码<br>读取图片文件 |
| `fission-combinations.js` | `_generate_all_combinations` | 生成素材排列组合 |
| `fission-delete-images.js` | `_create_single_product` 步骤3、4.5 | 删除主图1:1<br>删除主图3:4<br>删除详情图 |
| `fission-upload-images.js` | `_create_single_product` 步骤4、4.6 | 上传主图<br>智能裁剪3:4<br>上传详情图 |
| `fission-modify-product.js` | `_create_single_product` 步骤2、5 | 修改标题<br>调整价格 |
| `fission-submit.js` | `_create_single_product` 步骤6 | 提交商品 |
| `fission-executor.js` | `execute_fission`<br>`_create_single_product` | 主执行器<br>创建单个商品 |

## 🚀 使用方法

### 1. 导入模块

```javascript
const { executeFission } = require('./automation');
```

### 2. 准备参数

```javascript
const params = {
  sourceProduct: {
    douyin_product_id: '原商品ID',
    title: '原商品标题',
    images: '["图片1", "图片2"]',  // JSON字符串
    sku_list: '[{"sku_id": "SKU1", "price": 1000}]'  // JSON字符串
  },
  count: 10,  // 裂变数量
  priceFloatAmount: 5,  // 价格浮动金额（元）
  titleSuffix: '新品',  // 标题后缀
  titleReplacements: ['标题1', '标题2'],  // 标题替换列表（循环使用）
  publishMode: 2,  // 1=草稿 2=上架
  coverImageFolder: 'C:/素材/首图',  // 首图文件夹
  mainImageFolder: 'C:/素材/主图',  // 主图文件夹（包含子文件夹）
  detailImageFolder: 'C:/素材/详情图'  // 详情图文件夹（包含子文件夹）
};
```

### 3. 执行裂变

```javascript
const result = await executeFission(context, params, (progress) => {
  console.log(`进度: ${progress.currentIndex}/${progress.total}`);
  console.log(`成功: ${progress.successCount}, 失败: ${progress.failedCount}`);
});

console.log(result);
// {
//   success: true,
//   message: '裂变完成，成功10个，失败0个',
//   total: 10,
//   successCount: 10,
//   failedCount: 0,
//   failedDetails: []
// }
```

## 📝 完整流程

### 单个商品创建流程（`createSingleProduct`）

1. **预检查**：验证登录状态
2. **步骤1**：访问创建相似品页面（`copyid=原商品ID`）
3. **步骤2**：修改标题（添加隐藏字符）
4. **步骤3**：删除所有原图
   - 删除主图区域（1:1）的所有图片
   - 删除主图3:4区域的所有图片
5. **步骤4**：上传新的主图
   - 上传1张首图 + 4张主图
   - 点击"从1:1主图智能裁剪"自动生成3:4图
6. **步骤4.5**：删除详情图区域的所有原有图片
7. **步骤4.6**：上传新的详情图
8. **步骤5**：调整商品价格
9. **步骤6**：提交商品（草稿/上架）

### 批量裂变流程（`executeFission`）

1. 生成所有素材组合（排列组合，不重复）
2. 循环创建商品：
   - 按顺序取用组合（循环使用）
   - 生成新标题（使用标题替换列表，循环使用）
   - 处理SKU（价格浮动）
   - 调用 `createSingleProduct` 创建商品
   - 更新进度
   - 间隔3秒
3. 返回结果统计

## ⚠️ 重要说明

### 1. 完全照搬后端逻辑

- ✅ 所有选择器都与后端一致
- ✅ 所有等待时间都与后端一致
- ✅ 所有重试次数都与后端一致
- ✅ 所有错误处理都与后端一致
- ✅ 所有调试日志都与后端一致

### 2. 素材文件夹结构

```
素材/
├── 首图/              # 直接放图片文件
│   ├── 首图1.jpg
│   ├── 首图2.jpg
│   └── 首图3.jpg
├── 主图/              # 子文件夹，每个子文件夹是一个方案
│   ├── 方案1/
│   │   ├── 主图1.jpg
│   │   ├── 主图2.jpg
│   │   ├── 主图3.jpg
│   │   └── 主图4.jpg
│   └── 方案2/
│       ├── 主图1.jpg
│       ├── 主图2.jpg
│       ├── 主图3.jpg
│       └── 主图4.jpg
└── 详情图/            # 子文件夹，每个子文件夹是一个方案
    ├── 方案1/
    │   ├── 详情1.jpg
    │   ├── 详情2.jpg
    │   └── 详情3.jpg
    └── 方案2/
        ├── 详情1.jpg
        ├── 详情2.jpg
        └── 详情3.jpg
```

### 3. 组合数计算

总组合数 = 首图数量 × 主图方案数 × 详情图方案数

例如：
- 首图：3张
- 主图方案：2个
- 详情图方案：2个
- **总组合数 = 3 × 2 × 2 = 12**

### 4. 循环使用

如果裂变数量 > 组合数，会循环使用组合。

例如：
- 组合数：12
- 裂变数量：20
- 前12个商品使用不同组合
- 第13-20个商品循环使用前8个组合

## 🔧 调试

所有模块都包含详细的调试日志，格式与后端完全一致：

```
[Playwright裂变] 开始执行...
  原商品: 测试商品
  裂变数量: 10
  [调试] 接收到的文件夹路径:
    首图文件夹: C:/素材/首图
    主图文件夹: C:/素材/主图
    详情图文件夹: C:/素材/详情图
  [素材模式] 使用排列组合模式（不重复）
  生成组合总数: 12
    首图: 3张
    主图方案: 2个
    详情图方案: 2个
...
```

## 📄 许可证

与后端代码保持一致
