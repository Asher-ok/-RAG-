from sqlalchemy import Column, BigInteger, String, DateTime, SmallInteger, Text, Index
from app.models.base import BaseModel

class AccountUser(BaseModel):
    """账号用户表"""
    __tablename__ = "tb_account_user"
    
    username = Column(String(64), nullable=False, unique=True, comment="账号")
    password = Column(String(256), nullable=False, comment="密码（加密存储）")
    real_name = Column(String(64), nullable=False, comment="真实姓名")
    avatar_url = Column(String(255), nullable=True, comment="头像URL")
    account_type = Column(SmallInteger, nullable=False, comment="1主账号/2员工账号")
    parent_id = Column(BigInteger, nullable=True, index=True, comment="主账号ID，员工账号必填")
    expire_time = Column(DateTime, nullable=True, comment="过期时间，员工账号必填")
    permissions = Column(Text, nullable=True, comment="权限列表，json数组，员工账号必填")
    last_login_time = Column(DateTime, nullable=True, comment="最后登录时间")
    last_login_ip = Column(String(64), nullable=True, comment="最后登录IP")
    account_status = Column(SmallInteger, nullable=False, default=1, comment="0禁用/1启用/2已过期")
    is_hidden = Column(SmallInteger, nullable=False, default=0, comment="0普通账号/1隐藏账号（仅开发者可见）")
    status = Column(SmallInteger, nullable=False, default=1, comment="0逻辑删除/1正常")
    
    __table_args__ = (
        Index('idx_username', 'username'),
        Index('idx_parent_id', 'parent_id'),
        Index('idx_create_time', 'create_time'),
    )


class ShopAuthRequest(BaseModel):
    """店铺授权申请表"""
    __tablename__ = "tb_shop_auth_request"
    
    request_id = Column(String(64), nullable=False, unique=True, comment="申请ID")
    employee_id = Column(BigInteger, nullable=False, index=True, comment="员工账号ID")
    master_id = Column(BigInteger, nullable=False, index=True, comment="主账号ID")
    shop_id = Column(BigInteger, nullable=False, index=True, comment="店铺ID")
    reason = Column(String(256), nullable=True, comment="申请理由")
    approve_status = Column(SmallInteger, nullable=False, default=0, comment="0待审核/1已通过/2已拒绝")
    reject_reason = Column(String(256), nullable=True, comment="拒绝理由")
    approve_time = Column(DateTime, nullable=True, comment="审核时间")
    
    __table_args__ = (
        Index('idx_employee_id', 'employee_id'),
        Index('idx_master_id', 'master_id'),
        Index('idx_shop_id', 'shop_id'),
        Index('idx_create_time', 'create_time'),
    )


class EmployeeShopRelation(BaseModel):
    """员工店铺关系表"""
    __tablename__ = "tb_employee_shop_relation"
    
    employee_id = Column(BigInteger, nullable=False, index=True, comment="员工账号ID")
    shop_id = Column(BigInteger, nullable=False, index=True, comment="店铺ID")
    master_id = Column(BigInteger, nullable=False, comment="主账号ID")
    authorized_time = Column(DateTime, nullable=False, comment="授权时间")
    # status 字段继承自 BaseModel，默认值为 1（启用）
    
    __table_args__ = (
        Index('idx_employee_id', 'employee_id'),
        Index('idx_shop_id', 'shop_id'),
    )
