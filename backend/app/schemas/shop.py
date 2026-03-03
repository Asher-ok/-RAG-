from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ShopInfo(BaseModel):
    """店铺信息"""
    id: int
    shop_id: str  # 对应 douyin_shop_id，前端使用
    douyin_shop_id: str
    shop_name: str
    expire_time: Optional[datetime]  # Playwright模式下为None
    last_refresh_time: Optional[datetime]
    status: int
    create_time: datetime
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm(cls, obj):
        """从ORM对象创建，添加shop_id字段"""
        data = {
            'id': obj.id,
            'shop_id': obj.douyin_shop_id,  # 前端使用的字段
            'douyin_shop_id': obj.douyin_shop_id,
            'shop_name': obj.shop_name,
            'expire_time': obj.expire_time,
            'last_refresh_time': obj.last_refresh_time,
            'status': obj.status,
            'create_time': obj.create_time
        }
        return cls(**data)


class ShopListRequest(BaseModel):
    """店铺列表请求"""
    page_no: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    keyword: Optional[str] = Field(None, description="搜索关键词")
    status: Optional[int] = Field(None, description="状态筛选")


class ShopListResponse(BaseModel):
    """店铺列表响应"""
    total: int
    total_pages: int
    page_no: int
    page_size: int
    list: List[ShopInfo]


class UpdateShopStatusRequest(BaseModel):
    """更新店铺状态请求"""
    status: int = Field(..., ge=0, le=2, description="状态：0=删除，1=正常，2=禁用")
