"""
API限流工具
使用Redis实现滑动窗口限流算法
"""
import time
import redis
from typing import Optional
from app.core.config import settings


class RateLimiter:
    """
    API限流器（基于Redis）
    
    限流策略：
    - 单店铺QPS限制：50次/秒（抖店开放平台要求）
    - 使用Redis计数器实现
    - 时间窗口：1秒
    - 超过限制则等待或拒绝
    """
    
    def __init__(self):
        """初始化Redis连接"""
        self.redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        self.max_requests = settings.API_RATE_LIMIT_PER_SHOP  # 默认50
    
    def _get_key(self, shop_id: int, api_path: str) -> str:
        """
        生成Redis key
        格式：rate_limit:shop_id:api_path:timestamp
        """
        current_second = int(time.time())
        return f"rate_limit:{shop_id}:{api_path}:{current_second}"
    
    def check_rate_limit(self, shop_id: int, api_path: str) -> bool:
        """
        检查是否超过限流
        
        :param shop_id: 店铺ID
        :param api_path: API路径
        :return: True表示允许请求，False表示超过限流
        """
        key = self._get_key(shop_id, api_path)
        
        # 获取当前计数
        current_count = self.redis_client.get(key)
        
        if current_count is None:
            # 第一次请求，初始化计数器
            self.redis_client.setex(key, 1, 1)  # 设置过期时间1秒
            return True
        
        current_count = int(current_count)
        
        if current_count >= self.max_requests:
            # 超过限流
            return False
        
        # 增加计数
        self.redis_client.incr(key)
        return True
    
    def wait_if_needed(self, shop_id: int, api_path: str, max_wait: float = 1.0) -> bool:
        """
        如果超过限流则等待
        
        :param shop_id: 店铺ID
        :param api_path: API路径
        :param max_wait: 最大等待时间（秒）
        :return: True表示成功获取许可，False表示等待超时
        """
        start_time = time.time()
        
        while True:
            if self.check_rate_limit(shop_id, api_path):
                return True
            
            # 检查是否超时
            if time.time() - start_time >= max_wait:
                return False
            
            # 等待100毫秒后重试
            time.sleep(0.1)
    
    def get_remaining_quota(self, shop_id: int, api_path: str) -> int:
        """
        获取剩余配额
        
        :param shop_id: 店铺ID
        :param api_path: API路径
        :return: 剩余可用请求次数
        """
        key = self._get_key(shop_id, api_path)
        current_count = self.redis_client.get(key)
        
        if current_count is None:
            return self.max_requests
        
        return max(0, self.max_requests - int(current_count))
    
    def reset_limit(self, shop_id: int, api_path: str):
        """
        重置限流计数（用于测试或特殊情况）
        
        :param shop_id: 店铺ID
        :param api_path: API路径
        """
        key = self._get_key(shop_id, api_path)
        self.redis_client.delete(key)


# 全局限流器实例
rate_limiter = RateLimiter()


def check_api_rate_limit(shop_id: int, api_path: str = "default") -> bool:
    """
    检查API限流（装饰器使用）
    
    :param shop_id: 店铺ID
    :param api_path: API路径
    :return: True表示允许请求，False表示超过限流
    """
    return rate_limiter.check_rate_limit(shop_id, api_path)
