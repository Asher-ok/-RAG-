"""
登录助手
提供抖店登录相关的自动化操作
"""
from typing import Optional, Dict
from playwright.async_api import Page, BrowserContext
from app.playwright.browser_manager浏览器管理 import BrowserManager
import asyncio


class LoginHelper:
    """登录助手"""
    
    def __init__(self):
        """初始化登录助手"""
        self.browser_manager = BrowserManager()
        self.douyin_login_url = "https://fxg.jinritemai.com"  # 抖店商家后台
    
    async def manual_login(
        self, 
        account_id: str,
        headless: bool = False,
        wait_time: int = 120
    ) -> Dict:
        """
        手动登录模式
        打开浏览器让用户手动登录，登录完成后自动保存Cookie和店铺信息
        
        Args:
            account_id: 账号ID
            headless: 是否无头模式（手动登录建议False）
            wait_time: 等待用户登录的时间（秒）
            
        Returns:
            登录结果
        """
        context = None
        page = None
        
        try:
            from app.playwright.shop_info_extractor店铺信息 import ShopInfoExtractor
            
            # 启动浏览器（非无头模式，方便用户操作）
            await self.browser_manager.launch_browser(headless=headless)
            
            # 创建上下文（不固定视口，让窗口最大化）
            context = await self.browser_manager.create_context(
                account_id=None,
                no_viewport=True  # 窗口最大化
            )
            
            # 创建页面
            page = await self.browser_manager.create_page(context)
            
            # 访问登录页面
            print(f"\n{'='*60}")
            print(f"请在浏览器中完成登录操作")
            print(f"账号ID: {account_id}")
            print(f"登录URL: {self.douyin_login_url}")
            print(f"等待时间: {wait_time}秒")
            print(f"{'='*60}\n")
            
            await page.goto(self.douyin_login_url)
            
            # 等待用户登录
            print(f"⏳ 等待用户登录中...")
            
            # 使用ShopInfoExtractor等待登录完成
            login_success = await ShopInfoExtractor.wait_for_login_complete(page, wait_time)
            
            if not login_success:
                print(f"\n⚠ 等待超时，请确认是否已完成登录")
            
            # 提取店铺信息
            shop_info = None
            if login_success:
                # 登录成功后，主动导航到首页确保Cookie完整
                current_url = page.url
                homepage_url = "https://fxg.jinritemai.com/ffa/mshop/homepage/index"
                
                if homepage_url not in current_url:
                    print(f"\n⏳ 导航到首页以确保Cookie完整...")
                    try:
                        await page.goto(homepage_url, timeout=30000)
                        await asyncio.sleep(3)  # 等待页面加载和Cookie设置
                        print(f"✓ 已进入首页")
                    except Exception as e:
                        print(f"⚠ 导航到首页失败: {str(e)}")
                
                shop_info = await ShopInfoExtractor.extract_shop_info(page)
                if shop_info:
                    print(f"\n✓ 店铺信息:")
                    print(f"  店铺ID: {shop_info['shop_id']}")
                    print(f"  店铺名称: {shop_info['shop_name']}")
            
            # 保存登录状态
            success = await self.browser_manager.save_context_state(context, account_id)
            
            if success:
                return {
                    "success": True,
                    "account_id": account_id,
                    "message": "登录状态已保存",
                    "login_detected": login_success,
                    "shop_info": shop_info
                }
            else:
                return {
                    "success": False,
                    "account_id": account_id,
                    "message": "保存登录状态失败"
                }
        
        except Exception as e:
            print(f"\n✗ 登录过程出错: {str(e)}")
            return {
                "success": False,
                "account_id": account_id,
                "message": f"登录失败: {str(e)}"
            }
        
        finally:
            # 清理资源
            if page:
                await page.close()
            if context:
                await context.close()
            await self.browser_manager.stop()
    
    async def verify_login_state(self, account_id: str) -> Dict:
        """
        验证登录状态是否有效
        
        Args:
            account_id: 账号ID
            
        Returns:
            验证结果
        """
        context = None
        page = None
        
        try:
            # 检查是否有保存的状态
            if not self.browser_manager.account_manager.has_state(account_id):
                return {
                    "success": False,
                    "account_id": account_id,
                    "message": "未找到保存的登录状态"
                }
            
            # 启动浏览器
            await self.browser_manager.launch_browser(headless=True)
            
            # 加载已保存的状态
            context = await self.browser_manager.create_context(account_id=account_id)
            page = await self.browser_manager.create_page(context)
            
            # 访问商家后台
            await page.goto(self.douyin_login_url)
            await asyncio.sleep(3)
            
            # 检查是否需要重新登录
            current_url = page.url
            
            if "login" in current_url.lower():
                return {
                    "success": False,
                    "account_id": account_id,
                    "message": "登录状态已失效，需要重新登录",
                    "valid": False
                }
            else:
                return {
                    "success": True,
                    "account_id": account_id,
                    "message": "登录状态有效",
                    "valid": True
                }
        
        except Exception as e:
            return {
                "success": False,
                "account_id": account_id,
                "message": f"验证失败: {str(e)}"
            }
        
        finally:
            if page:
                await page.close()
            if context:
                await context.close()
            await self.browser_manager.stop()
    
    async def batch_check_accounts(self, account_ids: list) -> Dict:
        """
        批量检查多个账号的登录状态
        
        Args:
            account_ids: 账号ID列表
            
        Returns:
            检查结果汇总
        """
        results = []
        
        for account_id in account_ids:
            print(f"\n检查账号: {account_id}")
            result = await self.verify_login_state(account_id)
            results.append(result)
        
        # 统计
        valid_count = sum(1 for r in results if r.get("valid", False))
        invalid_count = len(results) - valid_count
        
        return {
            "total": len(account_ids),
            "valid": valid_count,
            "invalid": invalid_count,
            "results": results
        }
