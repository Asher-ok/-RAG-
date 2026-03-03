"""
Token相关的Celery定时任务
"""
from celery import Celery
from celery.schedules import crontab
from app.core.database import SessionLocal
from app.services.token_refresh_service import TokenRefreshService
import asyncio
import logging

logger = logging.getLogger(__name__)

# 创建Celery实例
celery_app = Celery(
    'doushop_tasks',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

# 配置定时任务
celery_app.conf.beat_schedule = {
    # 每天凌晨2点执行token刷新
    'refresh-expiring-tokens': {
        'task': 'app.tasks.token_tasks.refresh_expiring_tokens_task',
        'schedule': crontab(hour=2, minute=0),
    },
    # 每小时检查一次即将过期的token
    'check-expiring-tokens-hourly': {
        'task': 'app.tasks.token_tasks.refresh_expiring_tokens_task',
        'schedule': crontab(minute=0),  # 每小时的0分执行
    },
}

celery_app.conf.timezone = 'Asia/Shanghai'


@celery_app.task(name='app.tasks.token_tasks.refresh_expiring_tokens_task')
def refresh_expiring_tokens_task():
    """
    定时刷新即将过期的token
    """
    db = SessionLocal()
    try:
        logger.info("开始执行定时token刷新任务")
        
        # 使用asyncio运行异步函数
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            TokenRefreshService.refresh_expiring_tokens(db, hours_before=2)
        )
        
        logger.info(f"定时token刷新任务完成: {result}")
        return result
        
    except Exception as e:
        logger.error(f"定时token刷新任务异常: {str(e)}")
        return {
            'error': str(e)
        }
    finally:
        db.close()


@celery_app.task(name='app.tasks.token_tasks.refresh_single_shop_token')
def refresh_single_shop_token(shop_id: int):
    """
    刷新单个店铺的token
    
    Args:
        shop_id: 店铺ID
    """
    db = SessionLocal()
    try:
        from app.models.shop import ShopAuth
        
        shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
        if not shop:
            logger.error(f"店铺不存在 shop_id={shop_id}")
            return {'success': False, 'error': '店铺不存在'}
        
        loop = asyncio.get_event_loop()
        success = loop.run_until_complete(
            TokenRefreshService.refresh_shop_token(db, shop)
        )
        
        return {
            'success': success,
            'shop_id': shop_id,
            'shop_name': shop.shop_name
        }
        
    except Exception as e:
        logger.error(f"刷新单个店铺token异常 shop_id={shop_id}: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        db.close()


# 启动Celery Worker的命令：
# celery -A app.tasks.token_tasks worker --loglevel=info

# 启动Celery Beat的命令（定时任务调度器）：
# celery -A app.tasks.token_tasks beat --loglevel=info
