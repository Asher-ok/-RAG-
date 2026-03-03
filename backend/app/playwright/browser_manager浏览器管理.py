"""
浏览器管理器
负责Playwright浏览器实例的创建、配置和管理

注意：所有配置与前端Electron保持完全一致，确保前后端环境一致性
"""
from typing import Optional, Dict
from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright
from app.core.config import settings
from app.playwright.account_manager账号管理 import AccountManager
from app.playwright.browser_config浏览器配置 import config as browser_config
from app.playwright.anti_detection反检测脚本生成器 import (
    get_enhanced_anti_detection_script,
    get_random_user_agent,
    get_random_viewport,
    get_enhanced_browser_args
)


class BrowserManager:
    """浏览器管理器"""
    
    def __init__(self):
        """初始化浏览器管理器"""
        self.playwright: Optional[Playwright] = None
        self.browser: Optional[Browser] = None
        self.account_manager = AccountManager(settings.PLAYWRIGHT_STATES_DIR)
    
    async def start(self):
        """启动Playwright"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            print("✓ Playwright已启动")
    
    async def stop(self):
        """停止Playwright"""
        if self.browser:
            await self.browser.close()
            self.browser = None
        
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
            print("✓ Playwright已停止")
    
    async def launch_browser(self, headless: bool = None) -> Browser:
        """
        启动浏览器
        
        Args:
            headless: 是否无头模式，默认使用配置
            
        Returns:
            浏览器实例
        """
        if not self.playwright:
            await self.start()
        
        if headless is None:
            headless = settings.PLAYWRIGHT_HEADLESS
        
        try:
            # 使用增强的浏览器参数
            browser_args = get_enhanced_browser_args()
            
            # 添加随机User-Agent
            user_agent = get_random_user_agent()
            browser_args.append(f'--user-agent={user_agent}')
            
            self.browser = await self.playwright.chromium.launch(
                headless=headless,
                args=browser_args
            )
            
            print(f"✓ 浏览器已启动 (无头模式: {headless})")
            print(f"  → User-Agent: {browser_config.USER_AGENT[:80]}...")
            print(f"  → 反检测: 已启用增强模式（与前端Electron完全一致）")
            print(f"  → 视口: {browser_config.DEFAULT_VIEWPORT['width']}x{browser_config.DEFAULT_VIEWPORT['height']}")
            return self.browser
        except Exception as e:
            print(f"✗ 浏览器启动失败: {str(e)}")
            print(f"  请确保已安装Chromium: playwright install chromium")
            raise
    
    async def create_context(
        self, 
        account_id: Optional[str] = None,
        viewport: Dict = None,
        no_viewport: bool = False
    ) -> BrowserContext:
        """
        创建浏览器上下文
        
        Args:
            account_id: 账号ID，如果提供则尝试加载已保存的状态
            viewport: 视口大小配置
            no_viewport: 是否禁用固定视口（True=窗口自适应/最大化）
            
        Returns:
            浏览器上下文
        """
        if not self.browser:
            await self.launch_browser()
        
        # 视口配置 - 使用与前端Electron完全一致的配置
        if no_viewport:
            viewport_config = None
            no_viewport_flag = True
        elif viewport is None:
            # 使用与前端Electron完全一致的视口
            viewport_config = browser_config.DEFAULT_VIEWPORT.copy()
            no_viewport_flag = False
        else:
            viewport_config = viewport
            no_viewport_flag = False
        
        # 使用与前端Electron完全一致的User-Agent
        user_agent = browser_config.USER_AGENT
        
        # 基础上下文配置 - 与前端Electron完全一致
        context_options = browser_config.get_context_options()
        
        # 添加视口配置
        if no_viewport_flag:
            context_options["no_viewport"] = True
        else:
            context_options["viewport"] = viewport_config
        
        # 如果提供了账号ID，尝试加载已保存的状态
        if account_id and self.account_manager.has_state(account_id):
            state_data = self.account_manager.load_state(account_id)
            if state_data:
                # 使用保存的状态创建上下文
                context = await self.browser.new_context(
                    **context_options,
                    storage_state=state_data
                )
                if no_viewport_flag:
                    print(f"✓ 已加载账号 {account_id} 的登录状态 (窗口最大化)")
                else:
                    print(f"✓ 已加载账号 {account_id} 的登录状态 (视口: {viewport_config['width']}x{viewport_config['height']})")
                print(f"  → User-Agent: {user_agent[:80]}...")
                print(f"  → 配置: 与前端Electron完全一致")
                return context
        
        # 创建新的上下文
        context = await self.browser.new_context(**context_options)
        if no_viewport_flag:
            print(f"✓ 已创建新的浏览器上下文 (窗口最大化)")
        else:
            print(f"✓ 已创建新的浏览器上下文 (视口: {viewport_config['width']}x{viewport_config['height']})")
        print(f"  → User-Agent: {user_agent[:80]}...")
        print(f"  → 配置: 与前端Electron完全一致")
        return context
    
    async def save_context_state(self, context: BrowserContext, account_id: str) -> bool:
        """
        保存浏览器上下文状态
        
        Args:
            context: 浏览器上下文
            account_id: 账号ID
            
        Returns:
            是否保存成功
        """
        try:
            state_data = await context.storage_state()
            success = self.account_manager.save_state(account_id, state_data)
            
            if success:
                print(f"✓ 账号 {account_id} 的登录状态已保存")
            
            return success
            
        except Exception as e:
            print(f"✗ 保存账号 {account_id} 状态失败: {str(e)}")
            return False
    
    async def create_page(self, context: BrowserContext) -> Page:
        """
        创建新页面
        
        Args:
            context: 浏览器上下文
            
        Returns:
            页面实例
        """
        page = await context.new_page()
        
        # 设置默认超时
        page.set_default_timeout(settings.PLAYWRIGHT_TIMEOUT)
        
        # 注入增强的反检测脚本
        anti_detection_script = get_enhanced_anti_detection_script()
        await page.add_init_script(anti_detection_script)
        
        print(f"✓ 已创建新页面")
        print(f"  → 反检测脚本: 已注入 (24项防护)")
        
        return page
    
    async def goto_with_retry(
        self, 
        page: Page, 
        url: str, 
        max_retries: int = 3
    ) -> bool:
        """
        访问URL（带重试）
        
        Args:
            page: 页面实例
            url: 目标URL
            max_retries: 最大重试次数
            
        Returns:
            是否成功
        """
        for attempt in range(max_retries):
            try:
                await page.goto(url, wait_until="networkidle")
                print(f"✓ 已访问: {url}")
                return True
            except Exception as e:
                print(f"⚠ 访问失败 (尝试 {attempt + 1}/{max_retries}): {str(e)}")
                if attempt == max_retries - 1:
                    return False
        
        return False
