"""
统一的浏览器配置

确保前端Electron和后端Playwright使用完全一致的浏览器环境配置
这样可以避免被检测为不同的设备或环境
"""


class BrowserConfig:
    """统一的浏览器配置"""
    
    # ==================== User-Agent配置 ====================
    # 与前端Electron完全一致
    USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    # ==================== 视口配置 ====================
    # 与前端Electron裂变窗口一致
    DEFAULT_VIEWPORT = {
        "width": 1920,
        "height": 1080
    }
    
    # ==================== 语言和时区配置 ====================
    LOCALE = "zh-CN"
    TIMEZONE_ID = "Asia/Shanghai"
    LANGUAGES = ["zh-CN", "zh", "en-US", "en"]
    
    # ==================== 地理位置配置 ====================
    # 北京坐标
    GEOLOCATION = {
        "latitude": 39.9042,
        "longitude": 116.4074
    }
    
    # ==================== 权限配置 ====================
    PERMISSIONS = ["geolocation", "notifications"]
    
    # ==================== HTTP Headers配置 ====================
    # 与真实浏览器完全一致
    EXTRA_HTTP_HEADERS = {
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    }
    
    # ==================== 浏览器启动参数 ====================

    # 与前端Electron尽可能一致
    BROWSER_ARGS = [
        # 核心反检测参数
        '--disable-blink-features=AutomationControlled',  # 禁用自动化检测
        '--exclude-switches=enable-automation',   # 排除自动化开关
        
        # 安全和沙箱
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        
        # 窗口和显示
        '--window-size=1920,1080',
        '--start-maximized',
        
        # 禁用不必要的功能
        '--disable-extensions',  # 禁用扩展检测
        '--disable-infobars',  # 禁用"Chrome正受到自动化测试软件控制"提示
        '--disable-dev-tools',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-translate',
        
        # 性能优化
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-hang-monitor',
        
        # 网络和安全
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        
        # 其他
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-component-extensions-with-background-pages',
        
        # GPU相关（根据环境可能需要调整）
        '--disable-gpu',
        '--disable-software-rasterizer',
    ]
    
    # ==================== 浏览器上下文配置 ====================
    @classmethod
    def get_context_options(cls, storage_state=None):
        """
        获取浏览器上下文配置
        
        Args:
            storage_state: 存储状态（Cookie等）
            
        Returns:
            dict: 上下文配置
        """
        options = {
            "user_agent": cls.USER_AGENT,
            "viewport": cls.DEFAULT_VIEWPORT,
            "locale": cls.LOCALE,
            "timezone_id": cls.TIMEZONE_ID,
            "permissions": cls.PERMISSIONS,
            "geolocation": cls.GEOLOCATION,
            "color_scheme": "light",
            "extra_http_headers": cls.EXTRA_HTTP_HEADERS,
            "ignore_https_errors": False,  # 不忽略HTTPS错误
            "java_script_enabled": True,
            "accept_downloads": True,
            "has_touch": False,  # 不是触摸设备
            "is_mobile": False,  # 不是移动设备
        }
        
        if storage_state:
            options["storage_state"] = storage_state
        
        return options
    
    # ==================== 屏幕信息配置 ====================
    SCREEN_INFO = {
        "width": 1920,
        "height": 1080,
        "availWidth": 1920,
        "availHeight": 1040,
        "colorDepth": 24,
        "pixelDepth": 24
    }
    
    # ==================== 硬件信息配置 ====================
    HARDWARE_INFO = {
        "hardwareConcurrency": 8,  # CPU核心数
        "deviceMemory": 8,  # 内存GB
        "maxTouchPoints": 0,  # 不支持触摸
    }
    
    # ==================== Navigator信息配置 ====================
    NAVIGATOR_INFO = {
        "platform": "Win32",
        "vendor": "Google Inc.",
        "appVersion": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "doNotTrack": None,
        "languages": LANGUAGES,
    }
    
    # ==================== WebGL配置 ===伪装（GPU信息）====================
    WEBGL_VENDORS = [
        "Google Inc. (NVIDIA)",
        "Google Inc. (Intel)",
        "Google Inc. (AMD)",
        "Google Inc."
    ]
    
    WEBGL_RENDERERS = [
        "ANGLE (NVIDIA GeForce GTX 1660 Ti Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0)",
        "ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)"
    ]
    
    # ==================== Plugins配置 ====================
    PLUGINS = [
        {
            "name": "Chrome PDF Plugin",
            "description": "Portable Document Format",
            "filename": "internal-pdf-viewer",
            "mimeTypes": [
                {
                    "type": "application/x-google-chrome-pdf",
                    "suffixes": "pdf",
                    "description": "Portable Document Format"
                }
            ]
        },
        {
            "name": "Chrome PDF Viewer",
            "description": "Portable Document Format",
            "filename": "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            "mimeTypes": [
                {
                    "type": "application/pdf",
                    "suffixes": "pdf",
                    "description": "Portable Document Format"
                }
            ]
        },
        {
            "name": "Native Client",
            "description": "Native Client",
            "filename": "internal-nacl-plugin",
            "mimeTypes": [
                {
                    "type": "application/x-nacl",
                    "suffixes": "",
                    "description": "Native Client Executable"
                },
                {
                    "type": "application/x-pnacl",
                    "suffixes": "",
                    "description": "Portable Native Client Executable"
                }
            ]
        }
    ]
    
    # ==================== MediaDevices配置 ====================
    MEDIA_DEVICES = [
        {
            "deviceId": "default",
            "kind": "audioinput",
            "label": "默认 - 麦克风 (Realtek High Definition Audio)",
            "groupId": "default"
        },
        {
            "deviceId": "default",
            "kind": "audiooutput",
            "label": "默认 - 扬声器 (Realtek High Definition Audio)",
            "groupId": "default"
        },
        {
            "deviceId": "default",
            "kind": "videoinput",
            "label": "HD Webcam (04f2:b5ce)",
            "groupId": "default"
        }
    ]
    
    # ==================== Battery API配置 ====================
    BATTERY_INFO = {
        "charging": True,
        "chargingTime": 0,
        "dischargingTime": float('inf'),
        "level": 1.0
    }
    
    # ==================== Connection API配置 ====================
    CONNECTION_INFO = {
        "rtt": 50,
        "downlink": 10,
        "effectiveType": "4g",
        "saveData": False
    }
    
    # ==================== Canvas噪声配置 ====================
    CANVAS_NOISE_LEVEL = 0.0001  # 非常小的噪声，不影响显示但能混淆指纹
    
    # ==================== 允许的域名白名单 ====================
    ALLOWED_DOMAINS = [
        'fxg.jinritemai.com',
        'sso.douyin.com',
        'open.douyin.com',
        'login.douyin.com',
        'www.douyin.com',
        'lf-cdn-tos.bytescm.com',  # 抖店CDN
        'p3-sign.douyinpic.com',  # 抖音图片CDN
        'p6-sign.douyinpic.com',
        'p9-sign.douyinpic.com',
    ]
    
    @classmethod
    def is_allowed_domain(cls, url: str) -> bool:
        """
        检查URL是否在允许的域名白名单中
        
        Args:
            url: 要检查的URL
            
        Returns:
            bool: 是否允许
        """
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc
            
            # 检查是否在白名单中
            for allowed in cls.ALLOWED_DOMAINS:
                if domain == allowed or domain.endswith('.' + allowed):
                    return True
            
            return False
        except:
            return False


# 导出配置实例
config = BrowserConfig()
