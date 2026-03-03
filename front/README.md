# 抖店商家助手 - 桌面版

基于 React + Vite + Electron 的抖音商家管理系统桌面应用

## 技术栈

- **前端框架**: React 19
- **UI组件库**: Ant Design 6
- **路由**: React Router DOM 7
- **状态管理**: Redux Toolkit
- **桌面端**: Electron 39
- **构建工具**: Vite 7
- **HTTP客户端**: Axios
- **日期处理**: Day.js

## 项目结构

```
front/
├── electron/              # Electron主进程
│   ├── main.js           # 主进程入口
│   └── preload.js        # 预加载脚本
├── public/               # 静态资源
├── src/
│   ├── components/       # 组件
│   │   ├── Business/     # 业务组件
│   │   ├── Common/       # 通用组件
│   │   └── Layout/       # 布局组件
│   ├── constants/        # 常量定义
│   ├── hooks/            # 自定义Hooks
│   ├── pages/            # 页面
│   │   ├── Dashboard/    # 工作台
│   │   ├── Shop/         # 店铺管理
│   │   ├── Product/      # 商品管理
│   │   ├── Fission/      # 商品裂变
│   │   └── Account/      # 账号管理
│   ├── router/           # 路由配置
│   ├── services/         # API服务
│   ├── store/            # Redux状态管理
│   ├── styles/           # 样式文件
│   └── utils/            # 工具函数
└── package.json
```

## 功能模块（一期）

### 1. 工作台
- 数据概览统计
- 快捷操作入口

### 2. 店铺管理
- 店铺授权（OAuth2.0）
- 店铺列表
- 启用/禁用店铺

### 3. 商品管理
- **商品列表**: 查看、筛选、分页
- **批量上架**: Excel/CSV导入、图片上传
- **上架任务**: 任务进度查询、失败重试

### 4. 商品裂变
- **创建裂变**: 设置裂变数量、价格浮动、标题规则
- **裂变任务**: 任务进度监控
- **裂变记录**: 历史记录查询

### 5. 账号管理（主账号专属）
- **员工管理**: 添加、编辑、删除员工账号
- **授权申请**: 审核员工店铺授权申请

## 开发命令

### 安装依赖
```bash
npm install
```

### 启动开发服务器（网页版）
```bash
npm run dev
```
访问: http://localhost:5173

### 启动桌面应用（开发模式）
```bash
npm run electron:dev
```
会同时启动Vite开发服务器和Electron窗口

### 构建生产版本
```bash
npm run build
```

### 打包桌面应用
```bash
npm run electron:build
```
打包后的文件在 `release/` 目录

## 开发说明

### 侧边栏菜单结构
- 工作台
- 店铺管理
- 商品管理
  - 商品列表
  - 批量上架
  - 上架任务
- 商品裂变
  - 创建裂变
  - 裂变任务
  - 裂变记录
- 账号管理
  - 员工管理
  - 授权申请

### 顶部状态栏
- 当前店铺显示
- 实时时间显示
- 全屏切换
- 通知提醒
- 用户信息下拉菜单

### 窗口配置
- 默认尺寸: 1400x900
- 最小尺寸: 1280x720
- 支持全屏切换
- 开发模式自动打开DevTools

## API对接

后端接口地址: `http://localhost:8000/api/v1`

所有接口统一返回格式:
```json
{
  "code": 200,
  "msg": "success",
  "data": {},
  "trace_id": "uuid"
}
```

## 注意事项

1. 确保后端服务已启动（端口8000）
2. Electron开发模式需要先启动Vite服务器
3. 图标文件需要准备: icon.png / icon.ico / icon.icns
4. 生产环境打包前需要先执行 `npm run build`

## 后续开发计划

### 二期功能
- Playwright浏览器自动化
- 多店铺并行发布
- 营销活动管理
- 优惠券批量配置

### 三期功能
- AI自动生成/优化标题
- AI智能比价与调价
- AI图片处理与替换
- 竞品商品信息爬虫

## 许可证

Private
