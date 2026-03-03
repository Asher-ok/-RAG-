from sqlalchemy import Column, BigInteger, String, DateTime, Index
from app.models.base import BaseModel

class ShopAuth(BaseModel):
    """店铺授权表"""
    __tablename__ = "tb_shop_auth"
    
    user_id = Column(BigInteger, nullable=False, index=True, comment="关联用户ID")
    douyin_shop_id = Column(String(64), nullable=False, unique=True, comment="抖音店铺ID")
    shop_name = Column(String(128), nullable=False, comment="店铺名称")
    access_token = Column(String(512), nullable=True, comment="访问令牌（API模式）")
    refresh_token = Column(String(512), nullable=True, comment="刷新令牌（API模式）")
    expire_time = Column(DateTime, nullable=True, index=True, comment="token过期时间（API模式）")
    last_refresh_time = Column(DateTime, nullable=True, comment="最后刷新token时间")
    auth_mode = Column(String(20), nullable=True, default='api', comment="授权模式：api/playwright")
    playwright_account_id = Column(String(64), nullable=True, comment="Playwright账号ID")
    # status, create_time, update_time 继承自 BaseModel
    
    __table_args__ = (
        Index('idx_user_id', 'user_id'),
        Index('idx_expire_time', 'expire_time'),
        Index('idx_create_time', 'create_time'),
    )
