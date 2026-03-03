"""
反检测脚本模块

提供强化的反爬虫和反检测功能，包括：
1. 隐藏自动化特征
2. 模拟真实浏览器环境
3. 随机化行为模式
4. Canvas指纹混淆
5. WebGL指纹混淆

注意：所有配置与前端Electron保持完全一致
"""

import random
from .browser_config浏览器配置 import config as browser_config


def get_enhanced_anti_detection_script() -> str:
    """
    获取增强的反检测脚本
    
    使用与前端Electron完全一致的配置
    
    Returns:
        JavaScript代码字符串
    """
    
    # 使用统一配置
    canvas_noise = browser_config.CANVAS_NOISE_LEVEL
    webgl_vendor = random.choice(browser_config.WEBGL_VENDORS)
    webgl_renderer = random.choice(browser_config.WEBGL_RENDERERS)
    
    # 屏幕信息
    screen_info = browser_config.SCREEN_INFO
    hardware_info = browser_config.HARDWARE_INFO
    navigator_info = browser_config.NAVIGATOR_INFO
    
    script = f"""
    (function() {{
        'use strict';
        
        console.log('[反检测] 开始注入反检测脚本...');
        
        // ========== 1. 隐藏 webdriver 特征 ==========
        Object.defineProperty(navigator, 'webdriver', {{
            get: () => undefined,
            configurable: true
        }});
        
        // 删除 window.navigator.webdriver
        delete navigator.__proto__.webdriver;
        
        console.log('[反检测] ✓ 已隐藏 webdriver 特征');
        
        // ========== 2. 覆盖 chrome 对象 ==========
        window.chrome = {{
            runtime: {{}},
            loadTimes: function() {{}},
            csi: function() {{}},
            app: {{}}
        }};
        
        console.log('[反检测] ✓ 已覆盖 chrome 对象');
        
        // ========== 3. 覆盖 permissions ==========
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({{ state: Notification.permission }}) :
                originalQuery(parameters)
        );
        
        console.log('[反检测] ✓ 已覆盖 permissions');
        
        // ========== 4. 添加真实的 plugins ==========
        Object.defineProperty(navigator, 'plugins', {{
            get: () => [
                {{
                    0: {{type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"}},
                    description: "Portable Document Format",
                    filename: "internal-pdf-viewer",
                    length: 1,
                    name: "Chrome PDF Plugin"
                }},
                {{
                    0: {{type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"}},
                    description: "Portable Document Format",
                    filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                    length: 1,
                    name: "Chrome PDF Viewer"
                }},
                {{
                    0: {{type: "application/x-nacl", suffixes: "", description: "Native Client Executable"}},
                    1: {{type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable"}},
                    description: "Native Client",
                    filename: "internal-nacl-plugin",
                    length: 2,
                    name: "Native Client"
                }}
            ],
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已添加真实的 plugins');
        
        // ========== 5. 覆盖 languages ==========
        Object.defineProperty(navigator, 'languages', {{
            get: () => ['zh-CN', 'zh', 'en-US', 'en'],
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖 languages');
        
        // ========== 6. 覆盖 platform ==========
        Object.defineProperty(navigator, 'platform', {{
            get: () => '{navigator_info['platform']}',
            configurable: true
        }});
        
        // ========== 7. 覆盖 vendor ==========
        Object.defineProperty(navigator, 'vendor', {{
            get: () => '{navigator_info['vendor']}',
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖 platform 和 vendor');
        
        // ========== 8. 覆盖硬件信息 ==========
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {hardware_info['hardwareConcurrency']},
            configurable: true
        }});
        
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {hardware_info['deviceMemory']},
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖硬件信息');
        
        // ========== 9. 覆盖屏幕信息 ==========
        Object.defineProperty(screen, 'availWidth', {{
            get: () => {screen_info['availWidth']},
            configurable: true
        }});
        Object.defineProperty(screen, 'availHeight', {{
            get: () => {screen_info['availHeight']},
            configurable: true
        }});
        Object.defineProperty(screen, 'width', {{
            get: () => {screen_info['width']},
            configurable: true
        }});
        Object.defineProperty(screen, 'height', {{
            get: () => {screen_info['height']},
            configurable: true
        }});
        Object.defineProperty(screen, 'colorDepth', {{
            get: () => {screen_info['colorDepth']},
            configurable: true
        }});
        Object.defineProperty(screen, 'pixelDepth', {{
            get: () => {screen_info['pixelDepth']},
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖屏幕信息');
        
        // ========== 10. Canvas 指纹混淆 ==========
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const originalToBlob = HTMLCanvasElement.prototype.toBlob;
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        
        // 添加随机噪声到Canvas
        const addCanvasNoise = (canvas, context) => {{
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 添加微小的随机噪声
            for (let i = 0; i < data.length; i += 4) {{
                data[i] = data[i] + Math.floor(Math.random() * {canvas_noise} * 255);
                data[i + 1] = data[i + 1] + Math.floor(Math.random() * {canvas_noise} * 255);
                data[i + 2] = data[i + 2] + Math.floor(Math.random() * {canvas_noise} * 255);
            }}
            
            context.putImageData(imageData, 0, 0);
        }};
        
        HTMLCanvasElement.prototype.toDataURL = function() {{
            const context = this.getContext('2d');
            if (context) {{
                addCanvasNoise(this, context);
            }}
            return originalToDataURL.apply(this, arguments);
        }};
        
        HTMLCanvasElement.prototype.toBlob = function() {{
            const context = this.getContext('2d');
            if (context) {{
                addCanvasNoise(this, context);
            }}
            return originalToBlob.apply(this, arguments);
        }};
        
        console.log('[反检测] ✓ 已添加 Canvas 指纹混淆');
        
        // ========== 11. WebGL 指纹混淆 ==========
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {{
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {{
                return '{webgl_vendor}';
            }}
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {{
                return '{webgl_renderer}';
            }}
            return getParameter.apply(this, arguments);
        }};
        
        console.log('[反检测] ✓ 已添加 WebGL 指纹混淆');
        
        // ========== 12. 覆盖 Notification.permission ==========
        try {{
            Object.defineProperty(Notification, 'permission', {{
                get: () => 'default',
                configurable: true
            }});
        }} catch (e) {{
            // 某些浏览器可能不支持
        }}
        
        // ========== 13. 覆盖 Battery API ==========
        if (navigator.getBattery) {{
            navigator.getBattery = () => Promise.resolve({{
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1
            }});
        }}
        
        console.log('[反检测] ✓ 已覆盖 Battery API');
        
        // ========== 14. 覆盖 Connection API ==========
        if (navigator.connection) {{
            Object.defineProperty(navigator.connection, 'rtt', {{
                get: () => 50,
                configurable: true
            }});
            Object.defineProperty(navigator.connection, 'downlink', {{
                get: () => 10,
                configurable: true
            }});
            Object.defineProperty(navigator.connection, 'effectiveType', {{
                get: () => '4g',
                configurable: true
            }});
        }}
        
        console.log('[反检测] ✓ 已覆盖 Connection API');
        
        // ========== 15. 覆盖 MediaDevices ==========
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {{
            const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
            navigator.mediaDevices.enumerateDevices = function() {{
                return originalEnumerateDevices.call(this).then(devices => {{
                    // 添加一些虚拟设备
                    return [
                        ...devices,
                        {{
                            deviceId: "default",
                            kind: "audioinput",
                            label: "默认 - 麦克风 (Realtek High Definition Audio)",
                            groupId: "default"
                        }},
                        {{
                            deviceId: "default",
                            kind: "audiooutput",
                            label: "默认 - 扬声器 (Realtek High Definition Audio)",
                            groupId: "default"
                        }},
                        {{
                            deviceId: "default",
                            kind: "videoinput",
                            label: "HD Webcam (04f2:b5ce)",
                            groupId: "default"
                        }}
                    ];
                }});
            }};
        }}
        
        console.log('[反检测] ✓ 已覆盖 MediaDevices');
        
        // ========== 16. 覆盖 Date.prototype.getTimezoneOffset ==========
        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {{
            return -480; // UTC+8 (中国时区)
        }};
        
        console.log('[反检测] ✓ 已覆盖时区信息');
        
        // ========== 17. 覆盖 Intl.DateTimeFormat ==========
        try {{
            const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
            Intl.DateTimeFormat.prototype.resolvedOptions = function() {{
                const options = originalResolvedOptions.call(this);
                options.timeZone = 'Asia/Shanghai';
                return options;
            }};
        }} catch (e) {{
            // 某些浏览器可能不支持
        }}
        
        // ========== 18. 覆盖 navigator.maxTouchPoints ==========
        Object.defineProperty(navigator, 'maxTouchPoints', {{
            get: () => {hardware_info['maxTouchPoints']},
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖触摸点信息');
        
        // ========== 19. 覆盖 window.outerWidth/outerHeight ==========
        Object.defineProperty(window, 'outerWidth', {{
            get: () => {screen_info['width']},
            configurable: true
        }});
        Object.defineProperty(window, 'outerHeight', {{
            get: () => {screen_info['height']},
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖窗口尺寸');
        
        // ========== 20. 移除自动化痕迹 ==========
        // 删除 __playwright、__puppeteer、__selenium 等标记
        delete window.__playwright;
        delete window.__puppeteer;
        delete window.__selenium;
        delete window.__webdriver;
        delete window.__driver;
        delete window.callPhantom;
        delete window._phantom;
        delete window.phantom;
        
        console.log('[反检测] ✓ 已移除自动化痕迹');
        
        // ========== 21. 覆盖 Error.stack ==========
        const originalStackGetter = Object.getOwnPropertyDescriptor(Error.prototype, 'stack').get;
        Object.defineProperty(Error.prototype, 'stack', {{
            get: function() {{
                const stack = originalStackGetter.call(this);
                // 移除包含 playwright、puppeteer 等关键词的堆栈信息
                return stack ? stack.replace(/playwright|puppeteer|selenium|webdriver/gi, '') : stack;
            }},
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖 Error.stack');
        
        // ========== 22. 添加真实的 navigator.mimeTypes ==========
        Object.defineProperty(navigator, 'mimeTypes', {{
            get: () => [
                {{
                    type: "application/pdf",
                    suffixes: "pdf",
                    description: "Portable Document Format",
                    enabledPlugin: {{
                        name: "Chrome PDF Viewer"
                    }}
                }},
                {{
                    type: "application/x-google-chrome-pdf",
                    suffixes: "pdf",
                    description: "Portable Document Format",
                    enabledPlugin: {{
                        name: "Chrome PDF Plugin"
                    }}
                }},
                {{
                    type: "application/x-nacl",
                    suffixes: "",
                    description: "Native Client Executable",
                    enabledPlugin: {{
                        name: "Native Client"
                    }}
                }}
            ],
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已添加真实的 mimeTypes');
        
        // ========== 23. 覆盖 navigator.doNotTrack ==========
        Object.defineProperty(navigator, 'doNotTrack', {{
            get: () => null,
            configurable: true
        }});
        
        // ========== 24. 覆盖 navigator.appVersion ==========
        Object.defineProperty(navigator, 'appVersion', {{
            get: () => '{navigator_info['appVersion']}',
            configurable: true
        }});
        
        console.log('[反检测] ✓ 已覆盖 appVersion 和 doNotTrack');
        
        // ========== 完成 ==========
        console.log('[反检测] ✅ 反检测脚本注入完成！');
        
        // 标记已注入（用于调试）
        window.__antiDetectionInjected = true;
        
    }})();
    """
    
    return script


def get_random_user_agent() -> str:
    """
    获取User-Agent（与前端Electron完全一致）
    
    Returns:
        User-Agent字符串
    """
    # 始终返回与前端一致的User-Agent
    return browser_config.USER_AGENT


def get_random_viewport() -> dict:
    """
    获取视口大小（与前端Electron完全一致）
    
    Returns:
        视口配置字典
    """
    # 始终返回与前端一致的视口
    return browser_config.DEFAULT_VIEWPORT.copy()


def get_enhanced_browser_args() -> list:
    """
    获取增强的浏览器启动参数（与前端Electron尽可能一致）
    
    Returns:
        参数列表
    """
    return browser_config.BROWSER_ARGS.copy()
