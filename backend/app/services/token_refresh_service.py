"""
Token自动刷新服务
"""
import httpx
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.shop import ShopAuth
from app.core.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class TokenRefreshService:
    """Token刷新服务"""
    
    @staticmethod
    async def refresh_shop_token(db: Session, shop: ShopAuth) -> bool:
        """
        刷新单个店铺的token
        
        Args:
            db: 数据库会话
            shop: 店铺对象
            
        Returns:
            是否刷新成功
        """
        try:
            # 调用抖店刷新token接口
            token_url = f"{settings.DOUYIN_API_BASE_URL}/token/refresh"
            params = {
                'app_key': settings.DOUYIN_APP_KEY,
                'app_secret': settings.DOUYIN_APP_SECRET,
                'refresh_token': shop.refresh_token,
                'grant_type': 'refresh_token'
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(token_url, json=params)
                result = response.json()
            
            if result.get('code') != 0:
                logger.error(f"刷新token失败 shop_id={shop.id}: {result.get('message')}")
                return False
            
            data = result.get('data', {})
            new_access_token = data.get('access_token')
            new_refresh_token = data.get('refresh_token')
            expires_in = data.get('expires_in', 86400)
            
            # 更新数据库
            shop.access_token = new_access_token
            shop.refresh_token = new_refresh_token
            shop.expire_time = datetime.now() + timedelta(seconds=expires_in)
            shop.last_refresh_time = datetime.now()
            
            db.commit()
            
            logger.info(f"Token刷新成功 shop_id={shop.id} shop_name={shop.shop_name}")
            return True
            
        except Exception as e:
            logger.error(f"刷新token异常 shop_id={shop.id}: {str(e)}")
            db.rollback()
            return False
    
    @staticmethod
    async def refresh_expiring_tokens(db: Session, hours_before: int = 2) -> dict:
        """
        批量刷新即将过期的token
        
        Args:
            db: 数据库会话
            hours_before: 提前多少小时刷新（默认2小时）
            
        Returns:
            刷新结果统计
        """
        try:
            # 查询即将过期的token
            threshold = datetime.now() + timedelta(hours=hours_before)
            shops = db.query(ShopAuth).filter(
                ShopAuth.expire_time < threshold,
                ShopAuth.status == 1  # 只刷新启用状态的店铺
            ).all()
            
            total = len(shops)
            success = 0
            failed = 0
            
            logger.info(f"开始批量刷新token，共{total}个店铺")
            
            for shop in shops:
                if await TokenRefreshService.refresh_shop_token(db, shop):
                    success += 1
                else:
                    failed += 1
            
            result = {
                'total': total,
                'success': success,
                'failed': failed
            }
            
            logger.info(f"批量刷新完成: {result}")
            return result
            
        except Exception as e:
            logger.error(f"批量刷新token异常: {str(e)}")
            return {
                'total': 0,
                'success': 0,
                'failed': 0,
                'error': str(e)
            }
    
    @staticmethod
    def check_token_expired(shop: ShopAuth) -> bool:
        """
        检查token是否已过期
        
        Args:
            shop: 店铺对象
            
        Returns:
            是否已过期
        """
        if not shop.expire_time:
            return True
        return datetime.now() >= shop.expire_time
    
    @staticmethod
    def check_token_expiring_soon(shop: ShopAuth, hours: int = 2) -> bool:
        """
        检查token是否即将过期
        
        Args:
            shop: 店铺对象
            hours: 提前多少小时判断（默认2小时）
            
        Returns:
            是否即将过期
        """
        if not shop.expire_time:
            return True
        threshold = datetime.now() + timedelta(hours=hours)
        return shop.expire_time < threshold
    
    @staticmethod
    async def ensure_token_valid(db: Session, shop: ShopAuth) -> bool:
        """
        确保token有效，如果过期则自动刷新
        
        Args:
            db: 数据库会话
            shop: 店铺对象
            
        Returns:
            token是否有效
        """
        # 如果token即将过期，先刷新
        if TokenRefreshService.check_token_expiring_soon(shop):
            logger.info(f"Token即将过期，自动刷新 shop_id={shop.id}")
            return await TokenRefreshService.refresh_shop_token(db, shop)
        
        return True
