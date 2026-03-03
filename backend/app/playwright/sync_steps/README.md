# 商品同步步骤模块

## 概述

本模块将商品同步流程拆分为8个独立的步骤，每个步骤都有详细的日志输出，便于调试和前端展示。

## 架构设计

```
SSE接口 (product_sync_sse.py)
    ↓
主执行器 (sync_executor.py)
    ↓
8个独立步骤模块
```

## 文件结构

```
backend/app/playwright/sync_steps/
├── __init__.py                    # 模块入口
├── README.md                      # 本文档
├── sync_executor.py               # 主执行器（串联所有步骤）
├── step1_verify_login.py          # 步骤1: 验证登录状态
├── step2_visit_product_list.py    # 步骤2: 访问商品列表页
├── step3_click_all_tab.py         # 步骤3: 点击"全部"标签
├── step4_click_export_button.py   # 步骤4: 点击"导出查询商品"
├── step5_confirm_export.py        # 步骤5: 点击确认导出
├── step6_download_excel.py        # 步骤6: 下载Excel文件
├── step7_parse_excel.py           # 步骤7: 解析Excel文件
└── step8_save_to_database.py      # 步骤8: 保存到数据库
```

## 8个步骤详解

### 步骤1: 验证登录状态
- **功能**: 检查登录状态文件是否存在和有效
- **检查项**:
  - 状态文件是否存在
  - 文件大小是否正常
  - Cookie数量和有效性
  - 关键认证Cookie（token、session等）
  - localStorage/sessionStorage数据
- **返回**: 详细的状态信息和Cookie分析

### 步骤2: 访问商品列表页
- **功能**: 启动浏览器并访问商品列表页
- **流程**:
  1. 启动Chromium浏览器（无头模式）
  2. 加载登录状态（Cookie和存储）
  3. 注入反检测脚本
  4. 访问商品列表页面
  5. 检测是否被重定向到登录页
- **重试机制**: 最多重试2次
- **返回**: Page和Context对象

### 步骤3: 点击"全部"标签
- **功能**: 点击商品列表的"全部"标签
- **检查项**:
  - 标签是否存在
  - 标签是否已选中（aria-selected）
  - 页面是否在正确位置
- **返回**: 点击结果和验证信息

### 步骤4: 点击"导出查询商品"按钮
- **功能**: 点击导出按钮
- **定位方式**:
  1. 通过ID: #exportSearchedGoods
  2. 通过文本匹配: "导出查询商品"
- **检查项**:
  - 按钮是否可见
  - 按钮是否被禁用
- **返回**: 点击结果和定位方式

### 步骤5: 点击确认导出
- **功能**: 在弹出的抽屉中点击"导出"按钮
- **流程**:
  1. 等待抽屉弹出
  2. 查找"导出"按钮
  3. 点击按钮
  4. 检查页面是否跳转或抽屉是否关闭
- **返回**: 点击结果和页面状态

### 步骤6: 下载Excel文件
- **功能**: 等待导出任务完成并下载文件
- **流程**:
  1. 等待导出任务完成
  2. 查找最新的导出记录
  3. 点击下载按钮
  4. 等待文件下载完成
- **返回**: 文件路径和最新导出时间

### 步骤7: 解析Excel文件
- **功能**: 解析下载的Excel文件
- **检查项**:
  - 文件是否存在
  - 文件大小是否正常
  - 商品数据是否完整
  - 字段完整性统计
  - 商品状态分布
- **返回**: 商品列表和统计信息

### 步骤8: 保存到数据库
- **功能**: 将商品保存到数据库
- **流程**:
  1. 遍历商品列表
  2. 检查商品是否已存在（通过shop_id和douyin_product_id）
  3. 新增或更新商品记录
  4. 每10个商品推送一次进度
- **返回**: 保存统计（新增、更新、失败）

## 日志系统

每个步骤都有详细的日志输出，包括：

1. **步骤开始**: 显示步骤名称和编号
2. **子步骤**: 每个步骤内部的详细操作
3. **检查点**: 关键数据的验证和检查
4. **结果**: 成功/失败/警告状态
5. **详细信息**: 相关的数据和参数
6. **步骤完成**: 显示完成状态

### 日志格式示例

```
========== [步骤1] 验证登录状态 ==========
[步骤1.1] 检查登录状态文件...
  → 账号ID: 12345
  ✓ 找到登录状态文件
  → 状态文件路径: ../states/account_12345/state.json

[步骤1.2] 验证状态文件内容...
  → 文件大小: 15234 字节 (14.88 KB)

[步骤1.3] 解析状态文件...
  ✓ 状态文件解析成功

[步骤1.4] 检查Cookie数据...
  → Cookie总数: 45 个

[步骤1.5] 分析Cookie详情...
  → 域名分布:
    • .jinritemai.com: 30 个Cookie
    • .douyin.com: 15 个Cookie
  → 关键认证Cookie: 3 个
    • sessionid: 还剩15天过期
    • passport_auth_token: 还剩30天过期

========== [步骤1] 完成 ==========
```

## SSE 事件格式

每个步骤的进度都会通过SSE推送到前端：

```json
{
  "step": "步骤名称",
  "status": "success|failed|warning",
  "message": "消息内容",
  "details": "详细信息",
  "timestamp": "2025-01-30T12:34:56.789"
}
```

## 使用方法

### 1. 在SSE接口中使用

```python
from app.playwright.sync_steps import execute_product_sync

# 定义进度回调
async def progress_callback(step_data):
    # 将步骤数据推送到前端
    yield f"data: {json.dumps(step_data)}\n\n"

# 执行同步
result = await execute_product_sync(
    browser_manager=browser_manager,
    shop=shop,
    db=db,
    progress_callback=progress_callback
)
```

### 2. 单独使用某个步骤

```python
from app.playwright.sync_steps.step1_verify_login import verify_login_status

result = await verify_login_status(browser_manager, account_id)
if result['success']:
    print(f"验证成功: {result['message']}")
    print(f"Cookie数量: {result['details']['cookie_count']}")
```

## 错误处理

每个步骤都有完善的错误处理：

1. **try-catch**: 捕获所有异常
2. **详细日志**: 输出错误信息和堆栈
3. **返回结果**: 统一的返回格式
4. **资源清理**: 确保浏览器和上下文正确关闭

## 重试机制

步骤2（访问商品列表页）支持重试机制：

- 最多重试2次
- 每次重试前重新加载Cookie
- 详细记录重试原因和过程

## 优势

1. **模块化**: 每个步骤独立，易于维护和测试
2. **详细日志**: 便于调试和问题定位
3. **前端友好**: SSE实时推送，用户体验好
4. **可扩展**: 易于添加新步骤或修改现有步骤
5. **可复用**: 步骤可以单独使用或组合使用

## 与前端Electron模块的对比

| 特性 | 后端同步模块 | 前端Electron模块 |
|------|-------------|-----------------|
| 步骤数 | 8个步骤 | 11个步骤 |
| 主要功能 | 同步商品数据 | 裂变发布商品 |
| 技术栈 | Python + Playwright | JavaScript + Electron |
| 日志系统 | 详细的控制台日志 | 详细的控制台日志 |
| 进度推送 | SSE实时推送 | IPC消息推送 |
| 错误处理 | 完善的异常处理 | 完善的异常处理 |

## 未来优化

1. **并行处理**: 某些步骤可以并行执行
2. **缓存机制**: 缓存Excel文件和解析结果
3. **增量同步**: 只同步变化的商品
4. **性能监控**: 记录每个步骤的耗时
5. **更多验证**: 增加数据完整性验证

## 版本历史

- **v1.0.0** (2025-01-30): 初始版本，拆分为8个独立步骤
