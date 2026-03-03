"""
State管理服务（防CSRF攻击）
使用JWT编码user_id到state中，无需Redis
"""
import secrets
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta
from app.core.config import settings


class StateService:
    """State管理服务（基于JWT，无需Redis）"""
    
    @staticmethod
    def generate_state(user_id: int) -> str:
        """
        生成state（将user_id编码到JWT中）
        
        :param user_id: 用户ID
        :return: state字符串
        """
        # 生成随机字符串作为额外的安全措施
        random_str = secrets.token_urlsafe(16)
        
        # 创建JWT payload
        payload = {
            "user_id": user_id,
            "random": random_str,
            "exp": datetime.utcnow() + timedelta(minutes=10),  # 10分钟过期
            "type": "oauth_state"
        }
        
        # 生成JWT token作为state
        state = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        return state
    
    @staticmethod
    def verify_state(state: str) -> Optional[int]:
        """
        验证state并获取user_id
        
        :param state: state字符串（JWT token）
        :return: user_id，如果验证失败返回None
        """
        try:
            # 解码JWT
            payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            
            # 验证类型
            if payload.get("type") != "oauth_state":
                return None
            
            # 返回user_id
            return payload.get("user_id")
            
        except JWTError:
            # JWT无效或已过期
            return None
        except Exception:
            return None

