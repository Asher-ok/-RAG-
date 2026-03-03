from pydantic import BaseModel, Field
from typing import List, Optional


class SKUItem(BaseModel):
    """SKU项"""
    sku_id: str = Field(..., description="SKU ID")
    sku_name: str = Field(..., description="SKU名称")
    merchant_sku_code: Optional[str] = Field(None, description="商家SKU编码")
    spec_id: Optional[str] = Field(None, description="规格ID（SKUID）")
    spec_name: Optional[str] = Field(None, description="商品规格")
    price: int = Field(..., description="价格，单位分")
    stock: int = Field(..., description="库存")
    available_stock: Optional[int] = Field(None, description="现货可售")
    presale_stock: Optional[int] = Field(None, description="预售库存")


class ProductItem(BaseModel):
    """商品项"""
    title: str = Field(..., description="商品名称")
    
    # 类目信息
    first_cid: str = Field(..., description="一级类目ID")
    second_cid: str = Field(..., description="二级类目ID")
    third_cid: str = Field(..., description="三级类目ID")
    fourth_cid: Optional[str] = Field(None, description="四级类目ID")
    first_cname: Optional[str] = Field(None, description="一级类目名称")
    second_cname: Optional[str] = Field(None, description="二级类目名称")
    third_cname: Optional[str] = Field(None, description="三级类目名称")
    fourth_cname: Optional[str] = Field(None, description="四级类目名称")
    
    # 商品类型和分组
    product_type: Optional[int] = Field(1, description="商品类型：1普通商品/2虚拟商品")
    product_group: Optional[str] = Field(None, description="商品分组")
    
    # 商家编码
    merchant_code: Optional[str] = Field(None, description="商家编码")
    item_number: Optional[str] = Field(None, description="货号")
    
    # 图片和SKU
    images: List[str] = Field(..., description="图片URL列表")
    sku_list: List[SKUItem] = Field(..., description="SKU列表")
    
    # 发货和销售
    delivery_time: Optional[str] = Field(None, description="商品发货时间")
    sales_count: Optional[int] = Field(0, description="销量")
    
    # 佣金和审核
    commission_rate: Optional[float] = Field(None, description="佣金比例")
    audit_status: Optional[int] = Field(0, description="商品审核状态：0待审核/1审核通过/2审核拒绝")
    
    # 链接
    product_url: Optional[str] = Field(None, description="商品链接")
    
    # 库存
    available_stock: Optional[int] = Field(None, description="现货可售")
    presale_stock: Optional[int] = Field(None, description="预售库存")
    ladder_stock: Optional[List] = Field(None, description="阶梯库存")


class BatchCreateRequest(BaseModel):
    """批量创建商品请求"""
    shop_id: int = Field(..., description="店铺ID")
    products: List[ProductItem] = Field(..., description="商品列表")
    publish_type: int = Field(1, description="0草稿/1直接上架")


class TaskStatusRequest(BaseModel):
    """任务状态查询请求"""
    task_id: str = Field(..., description="任务ID")


class CancelTaskRequest(BaseModel):
    """取消任务请求"""
    task_id: str = Field(..., description="任务ID")


class SyncStatusRequest(BaseModel):
    """同步商品状态请求"""
    shop_id: int = Field(..., description="店铺ID")
    product_ids: List[str] = Field(..., description="商品ID列表")


class ProductListRequest(BaseModel):
    """商品列表查询请求"""
    shop_id: int = Field(..., description="店铺ID")
    page_no: int = Field(1, description="页码")
    page_size: int = Field(20, description="每页数量")
    product_status: Optional[int] = Field(None, description="商品状态：0草稿/1上架/2下架")
