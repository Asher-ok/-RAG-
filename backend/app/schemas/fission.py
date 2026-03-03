from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class CreateFissionRequest(BaseModel):
    """创建裂变任务请求"""
    shop_id: int = Field(..., description="店铺ID")
    source_product_ids: List[str] = Field(..., description="原商品ID列表（支持多选）", min_items=1, max_items=50)
    count: int = Field(..., description="每个商品的裂变数量", ge=1, le=1000)
    price_float_amount: float = Field(0, description="价格浮动金额（元）", ge=0)
    title_suffix: Optional[str] = Field(None, description="标题后缀")
    title_replacements: Optional[List[str]] = Field(None, description="需要替换的标题列表（循环使用）")
    publish_mode: int = Field(2, description="发布模式，1草稿/2上架/3下架", ge=1, le=3)
    
    # 图片素材文件夹路径（自动化模式使用）
    cover_image_folder: Optional[str] = Field(None, description="首图文件夹路径")
    main_image_folder: Optional[str] = Field(None, description="主图2345文件夹路径")
    detail_image_folder: Optional[str] = Field(None, description="详情图文件夹路径")


class FissionTaskStatusRequest(BaseModel):
    """裂变任务状态查询请求"""
    task_id: str = Field(..., description="任务ID")


class FissionRecordsRequest(BaseModel):
    """裂变记录查询请求"""
    shop_id: int = Field(..., description="店铺ID")
    page_no: int = Field(1, description="页码", ge=1)
    page_size: int = Field(20, description="每页数量", ge=1, le=100)


class CancelFissionTaskRequest(BaseModel):
    """取消裂变任务请求"""
    task_id: str = Field(..., description="任务ID")


class CalculateCombinationsRequest(BaseModel):
    """计算素材组合数请求"""
    cover_image_folder: Optional[str] = Field(None, description="首图文件夹路径")
    main_image_folder: Optional[str] = Field(None, description="主图2345文件夹路径")
    detail_image_folder: Optional[str] = Field(None, description="详情图文件夹路径")


class RetryFailedFissionRequest(BaseModel):
    """重试失败的裂变项请求"""
    task_id: str = Field(..., description="任务ID")


class UpdateFissionProgressRequest(BaseModel):
    """更新裂变任务进度请求（前端上报）"""
    task_id: str = Field(..., description="任务ID")
    current_index: int = Field(..., description="当前索引")
    current_product_title: str = Field(..., description="当前商品标题")
    success_count: int = Field(..., description="成功数量")
    failed_count: int = Field(..., description="失败数量")
    progress_percent: int = Field(..., description="进度百分比", ge=0, le=100)


class CompleteFissionTaskRequest(BaseModel):
    """完成裂变任务请求（前端上报最终结果）"""
    task_id: str = Field(..., description="任务ID")
    success_count: int = Field(..., description="成功数量")
    failed_count: int = Field(..., description="失败数量")
    failed_details: Optional[List[Dict[str, Any]]] = Field(None, description="失败详情列表")
