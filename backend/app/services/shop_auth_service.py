"""
店铺授权服务 - 统一调度层
根据配置自动选择API模式或Playwright模式
"""
from typing import Tuple, Dict, Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.shop import ShopAuth
from app.models.account import AccountUser
from datetime import datetime, timedelta


class ShopAuthService:
    """店铺授权统一服务"""
    
    @staticmethod
    def get_auth_mode() -> str:
        """
        获取当前授权模式
        
        Returns:
            'api' 或 'playwright'
        """
        
        return 'playwright' if settings.USE_PLAYWRIGHT else 'api'

    
    @staticmethod
    async def start_auth_flow(user_id: int) -> Dict:
        """
        启动授权流程
        根据配置返回不同的授权方式
        
        Args:
            user_id: 用户ID
            
        Returns:
            授权信息字典
        """
        mode = ShopAuthService.get_auth_mode()
        
        if mode == 'playwright':
            # Playwright模式：返回前端需要的信息
            return {
                "mode": "playwright",
                "message": "请使用自动化登录方式",
                "account_id": f"user_{user_id}",
                "instructions": "系统将打开浏览器窗口，请手动完成登录操作"
            }
        else:
            # API模式：返回OAuth授权URL
            from app.services.state_service import StateService
            import urllib.parse
            
            if not settings.DOUYIN_APP_KEY or not settings.DOUYIN_APP_SECRET:
                raise ValueError("系统未配置抖音开放平台信息")
            state = StateService.generate_state(user_id)
            
            auth_params = {
                'app_key': settings.DOUYIN_APP_KEY,
                'response_type': 'code',
                'redirect_uri': settings.DOUYIN_REDIRECT_URI,
                'state': state,
                'scope': 'item.list,item.add,item.edit,item.delete,shop.basic'
            }
            
            auth_url = f"https://fuwu.jinritemai.com/authorize?{urllib.parse.urlencode(auth_params)}"
            
            return {
                "mode": "api",
                "auth_url": auth_url,
                "state": state,
                "message": "请在新窗口完成OAuth授权"
            }
    
    @staticmethod
    async def complete_playwright_auth(
        db: Session,
        user_id: int,
        account_id: str,
        shop_info: Dict
    ) -> Tuple[bool, str]:
        """
        完成Playwright授权
        前端调用Playwright登录接口后，将店铺信息保存到数据库
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            account_id: Playwright账号ID
            shop_info: 店铺信息（从页面抓取）
            
        Returns:
            (是否成功, 消息)
        """
        try:
            shop_id = shop_info.get("shop_id")
            shop_name = shop_info.get("shop_name")
            
            print(f"\n{'='*60}")
            print(f"[保存店铺授权] 开始保存...")
            print(f"  用户ID: {user_id}")
            print(f"  账号ID: {account_id}")
            print(f"  店铺ID: {shop_id}")
            print(f"  店铺名称: {shop_name}")
            print(f"{'='*60}\n")
            
            # 验证必填字段
            if not shop_id:
                return False, "店铺ID不能为空"
            
            if not shop_name:
                return False, "店铺名称不能为空"
            
            # 验证店铺名称不是纯数字或等于店铺ID
            if shop_name.isdigit() or shop_name == shop_id:
                print(f"⚠ 检测到店铺名称异常: {shop_name}")
                shop_name = f"抖店_{shop_id[:8]}"
                print(f"✓ 使用默认店铺名称: {shop_name}")
            
            # 检查店铺是否已存在（根据店铺ID，因为店铺ID在系统中是唯一的）
            existing_shop = db.query(ShopAuth).filter(
                ShopAuth.douyin_shop_id == shop_id
            ).first()
            
            if existing_shop:
                print(f"[保存店铺授权] 店铺已存在，更新信息...")
                print(f"  原店铺名称: {existing_shop.shop_name}")
                print(f"  新店铺名称: {shop_name}")
                
                # 更新已存在的店铺
                existing_shop.shop_name = shop_name
                existing_shop.playwright_account_id = account_id
                existing_shop.auth_mode = 'playwright'
                existing_shop.status = 1
                existing_shop.last_refresh_time = datetime.now()
                existing_shop.update_time = datetime.now()
                db.commit()
                
                print(f"✓ 店铺信息已更新")
                return True, "店铺信息已更新"
            else:
                print(f"[保存店铺授权] 新增店铺...")
                
                # 新增店铺
                new_shop = ShopAuth(
                    user_id=user_id,
                    douyin_shop_id=shop_id,
                    shop_name=shop_name,
                    playwright_account_id=account_id,
                    auth_mode='playwright',
                    status=1,
                    last_refresh_time=datetime.now()
                )
                db.add(new_shop)
                db.commit()
                
                print(f"✓ 店铺授权成功")
                print(f"  数据库ID: {new_shop.id}")
                print(f"  店铺ID: {new_shop.douyin_shop_id}")
                print(f"  店铺名称: {new_shop.shop_name}")
                
                return True, "店铺授权成功"
            
        except Exception as e:
            db.rollback()
            error_msg = f"保存店铺信息失败: {str(e)}"
            print(f"✗ {error_msg}")
            import traceback
            traceback.print_exc()
            return False, error_msg
    
    @staticmethod
    def get_shop_auth_info(db: Session, shop_id: int) -> Optional[Dict]:
        """
        获取店铺授权信息
        
        Args:
            db: 数据库会话
            shop_id: 店铺数据库ID
            
        Returns:
            授权信息字典
        """
        shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
        
        if not shop:
            return None
        
        auth_mode = getattr(shop, 'auth_mode', 'api')
        
        result = {
            "shop_id": shop.id,
            "douyin_shop_id": shop.douyin_shop_id,
            "shop_name": shop.shop_name,
            "auth_mode": auth_mode,
            "status": shop.status
        }
        
        if auth_mode == 'playwright':
            result["playwright_account_id"] = getattr(shop, 'playwright_account_id', None)
        else:
            result["access_token"] = shop.access_token
            result["expire_time"] = shop.expire_time
        
        return result
