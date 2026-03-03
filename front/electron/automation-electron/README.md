# Electron 商品裂变自动化模块

## 概述

本模块实现了基于 Electron BrowserWindow 的抖店商品裂变自动化功能，通过 11 个步骤完成商品的创建、修改和发布。

## 架构设计

```
前端发起请求
    ↓
后端创建裂变任务记录
    ↓
前端接收任务ID
    ↓
Electron主进程执行裂变
    ↓
11个步骤依次执行
    ↓
返回执行结果
```

## 文件结构

```
front/electron/automation-electron/
├── index.js                              # 入口文件
├── fission-executor-electron.js          # 主执行器
├── step1-visit-page.js                   # 步骤1: 访问创建相似品页面
├── step2-modify-title.js                 # 步骤2: 修改商品标题
├── step3-delete-main34-images.js         # 步骤3: 删除主图3:4区域图片
├── step4-delete-main-images.js           # 步骤4: 删除主图区域图片
├── step5-verify-deletion.js              # 步骤5: 验证删除完成
├── step6-upload-first-main-image.js      # 步骤6: 上传主图第一张
├── step7-upload-auxiliary-main-images.js # 步骤7: 上传主图辅助图2-5
├── step8-smart-crop-main34.js            # 步骤8: 智能裁剪生成3:4主图
├── step9-delete-detail-images.js         # 步骤9: 删除详情图片
├── step10-upload-detail-images.js        # 步骤10: 上传详情图片
└── step11-submit-product.js              # 步骤11: 提交商品
```

## 11个步骤详解

### 步骤1: 访问创建相似品页面
- **功能**: 验证登录状态，访问创建相似品页面
- **URL**: `https://fxg.jinritemai.com/ffa/g/create?copyid={productId}`
- **耗时**: 约 7-10 秒

### 步骤2: 修改商品标题
- **功能**: 生成新标题（支持循环标题列表），添加零宽字符确保唯一性
- **逻辑**: 
  - 如果有循环标题：`循环标题 + 标题后缀`
  - 如果没有循环标题：`原标题 + 标题后缀`
  - 零宽字符：在标题中间插入5-8个随机零宽字符（完全不可见）
  - 不添加可见的随机后缀，保持标题简洁
- **唯一性**: 通过零宽字符组合保证每个标题都不同
- **耗时**: 约 2-3 秒

### 步骤3: 删除主图3:4区域图片
- **功能**: 删除主图3:4区域的所有图片
- **逻辑**: 从后往前删除，避免索引变化
- **耗时**: 约 5-8 秒（假设5张图片）

### 步骤4: 删除主图区域图片
- **功能**: 删除主图1:1区域的所有图片
- **逻辑**: 从后往前删除，避免索引变化
- **耗时**: 约 5-8 秒（假设5张图片）

### 步骤5: 验证删除完成
- **功能**: 验证主图和主图3:4区域是否已清空
- **验证**: 检查是否显示"该项为必填项，请上传图片"
- **耗时**: 约 2-3 秒

### 步骤6: 上传主图第一张
- **功能**: 上传主图区域的第一张图片（商品正面图）
- **方法**: Base64 + DataTransfer API
- **处理**: 自动处理"AI素材工具"弹窗
- **耗时**: 约 8-10 秒

### 步骤7: 上传主图辅助图2-5
- **功能**: 上传主图区域的第2-5张辅助图（4张）
- **方法**: Base64 + DataTransfer API
- **处理**: 每张图片上传后处理"AI素材工具"弹窗
- **耗时**: 约 30-40 秒（4张图片）

### 步骤8: 智能裁剪生成3:4主图
- **功能**: 点击"从1:1主图智能裁剪"按钮，自动生成3:4主图
- **等待**: AI处理需要约8秒
- **结果**: 主图3:4区域应有5张图片
- **耗时**: 约 10-15 秒

### 步骤9: 删除详情图片
- **功能**: 删除详情编辑区域的所有图片
- **逻辑**: 
  - 从"已上传X/50张"文本读取图片数量
  - 循环删除，每次删除最后一张图片
  - 每次删除后重新检查剩余数量
  - 直到"已上传0/50张"为止
- **改进**: 使用页面文本获取准确数量，不再依赖DOM元素计数
- **耗时**: 约 10-20 秒（取决于图片数量）

### 步骤10: 上传详情图片
- **功能**: 上传详情图片（最多50张）
- **方法**: Base64 + DataTransfer API
- **等待**: 每张图片上传后等待3秒
- **验证**: 从"已上传X/50张"文本读取实际上传数量
- **改进**: 使用页面文本验证上传结果，不再依赖DOM元素计数
- **耗时**: 约 30-150 秒（取决于图片数量）

### 步骤11: 提交商品
- **功能**: 根据发布模式提交商品
- **模式**: 
  - `publishMode = 1`: 保存草稿
  - `publishMode = 2`: 发布商品（默认）
- **处理**: 
  - 保存草稿：检测"保存成功"弹窗，点击"我知道了"按钮
  - 发布商品：检测成功页面 `#createSuccessGuideContainer`
- **验证**: 
  - 保存草稿：通过 `.ecom-g-modal-confirm-title` 检测"保存成功"弹窗
  - 发布商品：通过成功页面标题"商品提交成功，继续发布商品视频，分享到抖音"判断
- **改进**: 使用精确的页面元素判断成功状态，不再依赖URL或按钮消失
- **耗时**: 约 8-12 秒

## 总耗时估算

单个商品创建总耗时：**约 120-200 秒（2-3.5分钟）**

- 步骤1: 7-10秒
- 步骤2: 2-3秒
- 步骤3: 5-8秒
- 步骤4: 5-8秒
- 步骤5: 2-3秒
- 步骤6: 8-10秒
- 步骤7: 30-40秒
- 步骤8: 10-15秒
- 步骤9: 10-20秒（取决于详情图数量）
- 步骤10: 30-150秒（取决于详情图数量）
- 步骤11: 8-12秒

## 使用方法

### 1. 前端发起裂变请求

```javascript
// 在 React 组件中
import { useFission } from '@/hooks/useFission';

const { createTask } = useFission();

// 创建裂变任务
const result = await createTask({
  shop_id: shopId,
  source_product_ids: [productId],
  count: 10,
  title_suffix: '新品',
  title_replacements: ['标题1', '标题2', '标题3'],
  publish_mode: 2,
  cover_image_folder: 'C:\\素材\\首图',
  main_image_folder: 'C:\\素材\\主图',
  detail_image_folder: 'C:\\素材\\详情图'
});
```

### 2. 后端创建任务记录

后端接收请求后，创建裂变任务记录，返回任务ID。

### 3. Electron 执行裂变

Electron 主进程接收到 `execute-fission` IPC 消息后：

```javascript
// front/electron/main.js
ipcMain.handle('execute-fission', async (event, params) => {
  // 1. 获取店铺授权信息
  // 2. 创建或获取裂变窗口
  // 3. 执行裂变
  const { executeFissionWithBrowserWindow } = require('./automation-electron');
  const result = await executeFissionWithBrowserWindow(fissionWindow, params);
  return result;
});
```

### 4. 监听进度

```javascript
// 在渲染进程中监听进度
ipcRenderer.on('fission-progress', (event, progress) => {
  console.log(`进度: ${progress.progressPercent}%`);
  console.log(`当前: ${progress.currentIndex}/${progress.total}`);
  console.log(`成功: ${progress.successCount}, 失败: ${progress.failedCount}`);
});
```

## 核心技术

### 1. Base64 + DataTransfer API 上传图片

绕过浏览器文件选择限制，直接将本地图片上传到网页：

```javascript
// 读取文件
const fileBuffer = fs.readFileSync(imagePath);
const fileBase64 = fileBuffer.toString('base64');

// 在页面中执行
const byteCharacters = atob(fileBase64);
const byteArray = new Uint8Array(byteCharacters.length);
for (let i = 0; i < byteCharacters.length; i++) {
  byteArray[i] = byteCharacters.charCodeAt(i);
}
const blob = new Blob([byteArray], { type: mimeType });
const file = new File([blob], fileName, { type: mimeType });

const dataTransfer = new DataTransfer();
dataTransfer.items.add(file);
fileInput.files = dataTransfer.files;
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

### 2. 零宽字符确保标题唯一

在标题中间插入不可见的零宽字符，保证每个标题都不同：

```javascript
const invisibleChars = ['\u200B', '\u200C', '\u200D'];

// 生成5-8个随机零宽字符
const randomLength = 5 + Math.floor(Math.random() * 4);
let randomInvisible = '';
for (let i = 0; i < randomLength; i++) {
  randomInvisible += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
}

// 在标题中间插入
const midPoint = Math.floor(title.length / 2);
const titleWithHidden = title.slice(0, midPoint) + randomInvisible + title.slice(midPoint);
```

**效果：**
- 用户看到：`香蕉窝猫窝狗窝加厚冬季保暖`
- 实际标题：`香蕉窝猫窝狗窝加[零宽字符×5-8个]厚冬季保暖`
- 零宽字符完全不可见，但能保证唯一性

### 3. 从后往前删除避免索引变化

```javascript
for (let i = imageCount - 1; i >= 0; i--) {
  // 删除第 i 张图片
  deleteIcon.click();
  await wait(1000);
}
```

### 4. 排列组合模式

支持首图、主图、详情图的排列组合，生成不重复的商品：

```javascript
// 首图: 3张
// 主图方案: 2个（每个方案4张图片）
// 详情图方案: 2个（每个方案10张图片）
// 总组合数: 3 × 2 × 2 = 12 种组合
```

## 注意事项

1. **图片路径必须是绝对路径**，如：`C:\Users\xxx\images\product1.jpg`
2. **主图必须有5张**（1张商品正面图 + 4张辅助图）
3. **详情图最多50张**
4. **每个商品之间间隔3秒**，避免请求过快
5. **登录状态有效期**：如果登录过期，会自动返回错误
6. **窗口管理**：每个账号使用独立的窗口，避免冲突

## 错误处理

所有步骤都有错误处理机制：

- **步骤1失败**：返回错误，停止执行
- **步骤2失败**：返回错误，停止执行
- **步骤3-5失败**：记录警告，继续执行
- **步骤6失败**：返回错误，停止执行
- **步骤7-10失败**：记录警告，继续执行
- **步骤11失败**：返回错误，停止执行

## 调试

所有步骤都有详细的日志输出：

```
========== [步骤1] 访问创建相似品页面 ==========
[步骤1.1] 验证登录状态...
  → 访问首页: https://fxg.jinritemai.com/ffa/mshop/homepage/index
  → 当前URL: https://fxg.jinritemai.com/ffa/mshop/homepage/index
  ✓ 登录状态有效
[步骤1.2] 访问创建相似品页面...
  → 目标URL: https://fxg.jinritemai.com/ffa/g/create?copyid=3612345678901234567
  → 商品ID: 3612345678901234567
[步骤1.3] 等待页面加载...
  → 最终URL: https://fxg.jinritemai.com/ffa/g/create?copyid=3612345678901234567
  ✓ 成功进入创建相似品页面
========== [步骤1] 完成 ==========
```

## 未来优化

1. **并行上传**：多张图片可以并行上传，减少总耗时
2. **智能重试**：上传失败时自动重试
3. **断点续传**：支持从失败的商品继续执行
4. **价格调整**：实现SKU价格浮动功能
5. **更多验证**：增加更多的验证步骤，确保商品信息正确

## 版本历史

- **v1.1.0** (2025-01-30): 
  - 优化步骤9：从页面文本读取详情图数量，循环删除直到清空
  - 优化步骤10：从页面文本验证上传结果
  - 优化步骤11：精确检测保存草稿和发布商品的成功状态
  - 优化步骤2：移除可见随机后缀，只用零宽字符保证唯一性
- **v1.0.0** (2025-01-30): 初始版本，实现11个步骤的完整流程
