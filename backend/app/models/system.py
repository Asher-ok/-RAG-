from sqlalchemy import Column, BigInteger, String, Text, DateTime, SmallInteger, Integer, Index
from app.models.base import BaseModel


class SystemConfig(BaseModel):
    """系统配置表"""
    __tablename__ = "tb_system_config"
    
    config_key = Column(String(64), nullable=False, unique=True, comment="配置键")
    config_value = Column(Text, nullable=False, comment="配置值")
    config_type = Column(String(32), nullable=False, default='string', comment="配置类型：string/number/boolean/json")
    config_group = Column(String(32), nullable=False, default='system', comment="配置分组：system/api/upload/notification")
    config_desc = Column(String(256), nullable=True, comment="配置描述")
    is_public = Column(SmallInteger, nullable=False, default=0, comment="是否公开：0私有/1公开")
    
    __table_args__ = (
        Index('idx_config_key', 'config_key'),
        Index('idx_config_group', 'config_group'),
        Index('idx_create_time', 'create_time'),
    )


class ApiLimit(BaseModel):
    """API限流表"""
    __tablename__ = "tb_api_limit"
    
    shop_id = Column(BigInteger, nullable=False, index=True, comment="关联店铺ID")
    api_path = Column(String(128), nullable=False, comment="接口路径")
    call_count = Column(Integer, nullable=False, default=0, comment="调用次数")
    window_start = Column(DateTime, nullable=False, comment="时间窗口开始")
    
    __table_args__ = (
        Index('idx_shop_id', 'shop_id'),
        Index('idx_create_time', 'create_time'),
    )


class OperationLog(BaseModel):
    """操作日志表"""
    __tablename__ = "tb_operation_log"
    
    user_id = Column(BigInteger, nullable=False, index=True, comment="操作用户ID")
    shop_id = Column(BigInteger, nullable=True, index=True, comment="关联店铺ID")
    operation_type = Column(String(64), nullable=False, comment="操作类型")
    operation_desc = Column(String(256), nullable=False, comment="操作描述")
    request_data = Column(Text, nullable=True, comment="请求数据，json")
    response_data = Column(Text, nullable=True, comment="响应数据，json")
    ip_address = Column(String(64), nullable=False, comment="IP地址")
    
    __table_args__ = (
        Index('idx_user_id', 'user_id'),
        Index('idx_shop_id', 'shop_id'),
        Index('idx_create_time', 'create_time'),
    )