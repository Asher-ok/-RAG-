# API 配置说明

## 当前配置

所有环境（开发、生产、Electron）统一连接到服务器后端：

**服务器地址**: `http://123.56.44.206/api/v1`

## 配置文件位置

1. **主配置文件**: `src/config/index.js`
   - 统一管理所有配置
   - 修改 `API_BASE_URL` 即可更改所有环境的后端地址

2. **API 服务**: `src/services/api.js`
   - 从 `config/index.js` 导入配置
   - 自动识别 Electron 环境
   - 添加了日志输出，方便调试

3. **环境变量**:
   - `.env.development`: 开发环境配置
   - `.env.production`: 生产环境配置

## 环境说明

### 1. Electron 开发环境
- 运行命令: `npm run electron:dev`
- API地址: `http://123.56.44.206/api/v1`
- 特点: 在用户本地电脑运行，连接远程服务器

### 2. Electron 生产环境
- 运行命令: `npm run electron:build`
- API地址: `http://123.56.44.206/api/v1`
- 特点: 打包后的桌面应用，连接远程服务器

### 3. Web 开发环境
- 运行命令: `npm run dev`
- API地址: `http://123.56.44.206/api/v1`
- 特点: 浏览器访问，连接远程服务器

### 4. Web 生产环境
- 运行命令: `npm run build`
- API地址: `http://123.56.44.206/api/v1`
- 特点: 部署后的Web应用，连接远程服务器

## 修改配置

如需修改后端地址，只需修改 `src/config/index.js` 中的 `API_BASE_URL`：

```javascript
export const API_BASE_URL = 'http://your-server-ip/api/v1';
```

## 验证配置

启动应用后，在浏览器控制台查看日志：

```
[API Config] Electron环境，使用服务器地址: http://123.56.44.206/api/v1
```

或

```
[API Config] Web开发环境，使用服务器地址: http://123.56.44.206/api/v1
```

## Cookie 获取流程

### Electron 环境（当前方案）

1. 用户点击"添加店铺"
2. Electron 打开抖店登录窗口（在用户本地电脑）
3. 用户完成登录
4. Electron 获取 Cookie 和店铺信息（使用完整的后端提取逻辑）
5. 将数据发送到服务器后端 `/playwright/save-login`
6. 服务器保存 Cookie 到 `backend/states/` 目录
7. 服务器保存店铺信息到数据库

### 优势

- Cookie 在用户本地电脑获取，更安全
- 不需要在服务器上运行浏览器
- 用户可以看到登录过程，更放心
- 服务器只负责存储和管理 Cookie

## 注意事项

1. 确保服务器后端正常运行在 `http://123.56.44.206:8000`
2. 确保服务器防火墙开放了 8000 端口
3. 所有环境都连接同一个后端，数据统一管理
