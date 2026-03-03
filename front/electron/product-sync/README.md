# 商品同步自动化模块 (Electron)

使用 Electron BrowserWindow 执行商品同步，通过 executeJavaScript 操作页面元素。

## 架构说明

本模块参考后端 Python 步骤化同步流程，使用 JavaScript 在前端 Electron 环境中实现。

### 与后端的对应关系

| 后端步骤 | 前端步骤 | 说明 |
|---------|---------|------|
| step1_verify_login.py | step1-verify-login.js | 验证登录状态（前端已登录，简化） |
| step2_visit_product_list.py | step2-visit-product-list.js | 访问商品列表页 |
| step3_click_all_tab.py | step3-click-all-tab.js | 点击"全部"标签 |
| step4_click_export_button.py | step4-click-export-button.js | 点击"导出查询商品"按钮 |
| step5_confirm_export.py | step5-confirm-export.js | 点击确认导出 |
| step6_download_excel.py | step6-download-excel.js | 下载Excel文件 |
| step7_parse_excel.py | step7-parse-excel.js | 解析Excel文件 |
| step8_save_to_database.py | step8-save-to-database.js | 保存到数据库 |

## 步骤列表

### 步骤1: 验证登录状态
- 检查是否已登录（通过访问首页）
- 前端环境下，登录状态由 Electron session 管理

### 步骤2: 访问商品列表页
- 访问 `https://fxg.jinritemai.com/ffa/g/list`
- 等待页面加载完成
- 检查是否被重定向到登录页

### 步骤3: 点击"全部"标签
- 查找"全部"标签 `#rc-tabs-0-tab-all`
- 检查是否已选中
- 如果未选中，点击标签

### 步骤4: 点击"导出查询商品"按钮
- 查找"导出查询商品"按钮 `#exportSearchedGoods`
- 检查按钮是否可见和可点击
- 点击按钮

### 步骤5: 点击确认导出
- 等待抽屉弹出
- 查找抽屉中的"导出"确认按钮
- 点击按钮

### 步骤6: 下载Excel文件
- 等待导出任务完成
- 查找最新的导出记录
- 点击下载按钮
- 监听下载事件，保存文件到本地

### 步骤7: 解析Excel文件
- 使用 xlsx 库读取Excel文件
- 解析商品数据
- 验证数据完整性

### 步骤8: 保存到数据库
- 将解析的商品数据发送到后端API
- 后端处理数据库插入/更新
- 返回保存结果

## 使用方式

```javascript
const { executeProductSync } = require('./product-sync');

// 执行商品同步
const result = await executeProductSync(window, {
  shopId: 123,
  shopName: '测试店铺'
}, (progress) => {
  console.log(`进度: ${progress.step} - ${progress.message}`);
});
```

## 优势

1. **环境一致性**: 登录和同步在同一个 Electron 环境
2. **Cookie 天然有效**: 不需要传输 state.json
3. **用户体验好**: 可以看到真实的浏览器操作过程
4. **避免风控**: 同一环境操作，不会被识别为异常

## 注意事项

1. 需要先在前端完成 Playwright 登录
2. 下载的 Excel 文件保存在用户的下载目录
3. 解析 Excel 需要安装 `xlsx` 依赖
4. 数据库操作通过后端 API 完成
