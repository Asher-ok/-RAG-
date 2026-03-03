# 前后端浏览器环境一致性说明

## 概述

为了避免被检测为不同的设备或环境，我们确保前端Electron和后端Playwright使用**完全一致**的浏览器配置。

## 为什么需要环境一致性？

1. **Cookie共享**: 前端登录获取的Cookie需要在后端同步时使用
2. **指纹一致**: 浏览器指纹（User-Agent、屏幕尺寸、硬件信息等）必须一致
3. **行为一致**: 浏览器行为特征（请求头、权限等）必须一致
4. **避免检测**: 如果前后端环境不一致，可能被识别为异常行为

## 统一配置文件

所有配置集中在 `browser_config.py` 中：

```python
from app.playwright.browser_config import config as browser_config
```

## 配置对比

### 1. User-Agent

**前端Electron**:
```javascript
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
```

**后端Playwright**:
```python
browser_config.USER_AGENT
# 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
```

✅ **完全一致**

### 2. 视口大小

**前端Electron**:
```javascript
width: 1920,
height: 1080
```

**后端Playwright**:
```python
browser_config.DEFAULT_VIEWPORT
# {"width": 1920, "height": 1080}
```

✅ **完全一致**

### 3. 语言和时区

**前端Electron**:
```javascript
locale: 'zh-CN'
timezone: 'Asia/Shanghai'
```

**后端Playwright**:
```python
browser_config.LOCALE  # 'zh-CN'
browser_config.TIMEZONE_ID  # 'Asia/Shanghai'
```

✅ **完全一致**

### 4. 屏幕信息

**前端Electron**:
```javascript
screen.width = 1920
screen.height = 1080
screen.availWidth = 1920
screen.availHeight = 1040
screen.colorDepth = 24
```

**后端Playwright**:
```python
browser_config.SCREEN_INFO
# {
#     "width": 1920,
#     "height": 1080,
#     "availWidth": 1920,
#     "availHeight": 1040,
#     "colorDepth": 24,
#     "pixelDepth": 24
# }
```

✅ **完全一致**

### 5. 硬件信息

**前端Electron**:
```javascript
navigator.hardwareConcurrency = 8
navigator.deviceMemory = 8
navigator.maxTouchPoints = 0
```

**后端Playwright**:
```python
browser_config.HARDWARE_INFO
# {
#     "hardwareConcurrency": 8,
#     "deviceMemory": 8,
#     "maxTouchPoints": 0
# }
```

✅ **完全一致**

### 6. Navigator信息

**前端Electron**:
```javascript
navigator.platform = 'Win32'
navigator.vendor = 'Google Inc.'
navigator.languages = ['zh-CN', 'zh', 'en-US', 'en']
```

**后端Playwright**:
```python
browser_config.NAVIGATOR_INFO
# {
#     "platform": "Win32",
#     "vendor": "Google Inc.",
#     "languages": ["zh-CN", "zh", "en-US", "en"]
# }
```

✅ **完全一致**

### 7. HTTP Headers

**前端Electron**:
```javascript
'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
'Accept': 'text/html,application/xhtml+xml,...'
'Accept-Encoding': 'gzip, deflate, br'
```

**后端Playwright**:
```python
browser_config.EXTRA_HTTP_HEADERS
# {
#     "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
#     "Accept": "text/html,application/xhtml+xml,...",
#     "Accept-Encoding": "gzip, deflate, br",
#     ...
# }
```

✅ **完全一致**

### 8. WebGL指纹

**前端Electron**:
```javascript
// 随机选择，但范围一致
UNMASKED_VENDOR_WEBGL: 'Google Inc. (NVIDIA)'
UNMASKED_RENDERER_WEBGL: 'ANGLE (NVIDIA GeForce GTX 1660 Ti...)'
```

**后端Playwright**:
```python
browser_config.WEBGL_VENDORS
# ['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', ...]

browser_config.WEBGL_RENDERERS
# ['ANGLE (NVIDIA GeForce GTX 1660 Ti...)', ...]
```

✅ **范围一致**（从相同的列表中随机选择）

### 9. Canvas指纹混淆

**前端Electron**:
```javascript
// 添加微小噪声
canvas_noise = 0.0001
```

**后端Playwright**:
```python
browser_config.CANVAS_NOISE_LEVEL
# 0.0001
```

✅ **完全一致**

### 10. Plugins

**前端Electron**:
```javascript
navigator.plugins = [
  'Chrome PDF Plugin',
  'Chrome PDF Viewer',
  'Native Client'
]
```

**后端Playwright**:
```python
browser_config.PLUGINS
# [
#     {"name": "Chrome PDF Plugin", ...},
#     {"name": "Chrome PDF Viewer", ...},
#     {"name": "Native Client", ...}
# ]
```

✅ **完全一致**

## 反检测脚本一致性

### 前端Electron
前端使用 Electron 的 BrowserWindow，通过 `executeJavaScript` 注入反检测脚本。

### 后端Playwright
后端使用 Playwright 的 `add_init_script` 注入**完全相同**的反检测脚本。

### 脚本内容
两者使用相同的 24 项防护措施：

1. ✅ 隐藏 webdriver 特征
2. ✅ 覆盖 chrome 对象
3. ✅ 覆盖 permissions
4. ✅ 添加真实的 plugins
5. ✅ 覆盖 languages
6. ✅ 覆盖 platform
7. ✅ 覆盖 vendor
8. ✅ 覆盖硬件信息
9. ✅ 覆盖屏幕信息
10. ✅ Canvas 指纹混淆
11. ✅ WebGL 指纹混淆
12. ✅ 覆盖 Notification.permission
13. ✅ 覆盖 Battery API
14. ✅ 覆盖 Connection API
15. ✅ 覆盖 MediaDevices
16. ✅ 覆盖时区信息
17. ✅ 覆盖 Intl.DateTimeFormat
18. ✅ 覆盖 maxTouchPoints
19. ✅ 覆盖窗口尺寸
20. ✅ 移除自动化痕迹
21. ✅ 覆盖 Error.stack
22. ✅ 添加真实的 mimeTypes
23. ✅ 覆盖 doNotTrack
24. ✅ 覆盖 appVersion

## Cookie和存储状态

### 前端登录流程
1. 用户在前端Electron窗口登录
2. 登录成功后，保存 `storageState`（包含Cookie和localStorage）
3. 存储到 `/root/states/account_{account_id}/state.json`

### 后端同步流程
1. 从相同路径加载 `storageState`
2. 使用完全相同的浏览器配置
3. Cookie和localStorage自动恢复
4. 浏览器指纹完全一致

## 验证方法

### 1. 检查User-Agent
```python
# 后端
print(browser_config.USER_AGENT)
```

```javascript
// 前端
console.log(window.navigator.userAgent);
```

应该输出完全相同的字符串。

### 2. 检查屏幕尺寸
```python
# 后端
print(browser_config.SCREEN_INFO)
```

```javascript
// 前端
console.log({
  width: screen.width,
  height: screen.height,
  availWidth: screen.availWidth,
  availHeight: screen.availHeight
});
```

应该输出完全相同的值。

### 3. 检查硬件信息
```python
# 后端
print(browser_config.HARDWARE_INFO)
```

```javascript
// 前端
console.log({
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory: navigator.deviceMemory,
  maxTouchPoints: navigator.maxTouchPoints
});
```

应该输出完全相同的值。

### 4. 检查Canvas指纹
前后端的Canvas指纹应该非常接近（有微小的随机噪声）。

### 5. 检查WebGL指纹
前后端的WebGL vendor和renderer应该在相同的范围内。

## 注意事项

### 1. 不要随机化
❌ **错误做法**:
```python
# 每次使用不同的User-Agent
user_agent = random.choice([...])
```

✅ **正确做法**:
```python
# 始终使用与前端一致的User-Agent
user_agent = browser_config.USER_AGENT
```

### 2. 不要修改配置
如果需要修改配置，必须同时修改：
1. `backend/app/playwright/browser_config.py`
2. `front/electron/main.js` 中的相关配置

### 3. Cookie路径一致
前后端必须使用相同的Cookie存储路径：
```
/root/states/account_{account_id}/state.json
```

### 4. 时间同步
确保服务器时间与用户本地时间一致（或使用相同的时区）。

## 测试建议

### 1. 指纹对比测试
访问指纹检测网站（如 https://browserleaks.com/），对比前后端的指纹信息。

### 2. Cookie测试
1. 前端登录并保存Cookie
2. 后端加载Cookie并访问需要登录的页面
3. 检查是否能正常访问（不被重定向到登录页）

### 3. 行为测试
1. 前端执行某些操作（如浏览商品）
2. 后端执行相同操作
3. 检查服务器日志，确认没有异常检测

## 常见问题

### Q1: 为什么后端还是被检测到？
A: 检查以下几点：
1. Cookie是否正确加载
2. User-Agent是否一致
3. 视口大小是否一致
4. 反检测脚本是否正确注入

### Q2: 如何确认配置一致？
A: 在前后端分别打印配置信息，逐项对比。

### Q3: 可以使用不同的浏览器版本吗？
A: 不建议。应该使用相同的Chrome版本号（120.0.0.0）。

### Q4: 需要定期更新配置吗？
A: 是的。当Chrome版本更新时，应该同步更新User-Agent和其他相关配置。

## 总结

通过统一的 `browser_config.py` 配置文件，我们确保了：

✅ 前后端User-Agent完全一致  
✅ 前后端视口大小完全一致  
✅ 前后端屏幕信息完全一致  
✅ 前后端硬件信息完全一致  
✅ 前后端Navigator信息完全一致  
✅ 前后端HTTP Headers完全一致  
✅ 前后端反检测脚本完全一致  
✅ 前后端Cookie和存储状态共享  

这样可以最大程度地避免被检测为不同的设备或环境！
