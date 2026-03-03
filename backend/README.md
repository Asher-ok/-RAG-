# 抖音商家管理系统 - 后端

基于 FastAPI 的抖音商家管理系统后端服务

## 技术栈

- FastAPI - Web 框架
- SQLAlchemy - ORM
- MySQL - 数据库
- Redis - 缓存和限流
- Celery - 异步任务队列
- JWT - 身份认证

## 项目结构

```
backend/
├── app/
│   ├── api/              # API路由
│   │   └── v1/
│   │       └── endpoints/  # 接口端点
│   ├── core/             # 核心配置
│   ├── models/           # 数据模型
│   ├── schemas/          # Pydantic模型
│   ├── services/         # 业务逻辑
│   └── utils/            # 工具函数
├── main.py               # 应用入口
├── requirements.txt      # 依赖包
└── .env.example          # 环境变量示例
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 文档

详见项目文档：`docs/02-接口对接规范文档.md`

## 开发说明

- 所有接口返回统一的响应格式
- 使用 JWT 进行身份认证
- 数据库操作使用 SQLAlchemy ORM
- 异步任务使用 Celery
- API 限流使用 Redis
