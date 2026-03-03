from datetime import datetime
from sqlalchemy import Column, BigInteger, DateTime, SmallInteger
from app.core.database import Base

class BaseModel(Base):
    """基础模型"""
    __abstract__ = True
    
    id = Column(BigInteger, primary_key=True, autoincrement=True, comment="主键ID")
    status = Column(SmallInteger, nullable=False, default=1, comment="状态：0禁用/1启用")
    create_time = Column(DateTime, nullable=False, default=datetime.now, comment="创建时间")
    update_time = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now, comment="更新时间")
