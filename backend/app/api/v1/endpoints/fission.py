from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, check_permission
from app.models.account import AccountUser
from app.schemas.response import ResponseModel
from app.schemas.fission import (
    CreateFissionRequest,
    FissionTaskStatusRequest,
    FissionRecordsRequest,
    CancelFissionTaskRequest,
    CalculateCombinationsRequest,
    RetryFailedFissionRequest,
    UpdateFissionProgressRequest,  # 新增
    CompleteFissionTaskRequest     # 新增
)
from app.services.fission_service import FissionService

router = APIRouter()


@router.post("/create")
async def create_fission(
    request: CreateFissionRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """创建裂变任务（只创建记录，不执行，由前端执行）"""
    service = FissionService(db)
    
    # 为每个商品创建裂变任务记录
    results = []
    for source_product_id in request.source_product_ids:
        result = service.create_fission_task_only(
            shop_id=request.shop_id,
            source_product_id=source_product_id,
            count=request.count,
            price_float_amount=request.price_float_amount,
            title_suffix=request.title_suffix,
            title_replacements=request.title_replacements,
            publish_mode=request.publish_mode
        )
        results.append({
            "source_product_id": source_product_id,
            "success": result.get("success"),
            "task_id": result.get("task_id"),
            "message": result.get("message"),
            "source_product": result.get("source_product")  # 返回商品信息给前端
        })
    
    # 统计成功和失败数量
    success_count = sum(1 for r in results if r["success"])
    failed_count = len(results) - success_count
    
    if success_count > 0:
        return ResponseModel.success(
            data={
                "total": len(results),
                "success_count": success_count,
                "failed_count": failed_count,
                "results": results
            },
            msg=f"已创建 {success_count} 个裂变任务，失败 {failed_count} 个"
        )
    else:
        return ResponseModel.error(msg="所有任务创建失败")


@router.post("/update_progress")
async def update_fission_progress(
    request: UpdateFissionProgressRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """更新裂变任务进度（前端上报）"""
    service = FissionService(db)
    result = service.update_task_progress(
        task_id=request.task_id,
        current_index=request.current_index,
        current_product_title=request.current_product_title,
        success_count=request.success_count,
        failed_count=request.failed_count,
        progress_percent=request.progress_percent
    )
    
    if result.get("success"):
        return ResponseModel.success(msg="进度更新成功")
    else:
        return ResponseModel.error(msg=result.get("message", "进度更新失败"))


@router.post("/complete_task")
async def complete_fission_task(
    request: CompleteFissionTaskRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """完成裂变任务（前端上报最终结果）"""
    service = FissionService(db)
    result = service.complete_task(
        task_id=request.task_id,
        success_count=request.success_count,
        failed_count=request.failed_count,
        failed_details=request.failed_details
    )
    
    if result.get("success"):
        return ResponseModel.success(msg="任务完成")
    else:
        return ResponseModel.error(msg=result.get("message", "任务完成失败"))


@router.get("/task_status")
async def get_task_status(
    task_id: str = Query(..., description="任务ID"),
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """查询裂变任务进度"""
    service = FissionService(db)
    result = service.get_task_status(task_id)
    
    if result.get("success"):
        return ResponseModel.success(data=result.get("data"), msg="查询成功")
    else:
        return ResponseModel.error(msg=result.get("message", "查询失败"))


@router.get("/task_list")
async def get_task_list(
    shop_id: int = Query(None, description="店铺ID，不传则查询所有店铺"),
    page_no: int = Query(1, description="页码", ge=1),
    page_size: int = Query(20, description="每页数量", ge=1, le=100),
    task_status: int = Query(None, description="任务状态：0待处理/1进行中/2已完成/3失败/4已取消"),
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """查询店铺下的裂变任务列表（实时状态，带权限过滤）"""
    service = FissionService(db)
    result = service.get_task_list(
        shop_id=shop_id,
        page_no=page_no,
        page_size=page_size,
        task_status=task_status,
        user_id=current_user.id,
        account_type=current_user.account_type,
        is_hidden=current_user.is_hidden
    )
    
    if result.get("success"):
        return ResponseModel.success(data=result.get("data"), msg="查询成功")
    else:
        return ResponseModel.error(msg=result.get("message", "查询失败"))


@router.get("/records")
async def get_fission_records(
    shop_id: int = Query(None, description="店铺ID，不传则查询所有店铺"),
    page_no: int = Query(1, description="页码", ge=1),
    page_size: int = Query(20, description="每页数量", ge=1, le=100),
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """裂变记录"""
    service = FissionService(db)
    result = service.get_fission_records(
        shop_id=shop_id,
        page_no=page_no,
        page_size=page_size
    )
    
    if result.get("success"):
        return ResponseModel.success(data=result.get("data"), msg="查询成功")
    else:
        return ResponseModel.error(msg=result.get("message", "查询失败"))


@router.post("/cancel_task")
async def cancel_task(
    request: CancelFissionTaskRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """取消裂变任务"""
    service = FissionService(db)
    result = service.cancel_task(request.task_id)
    
    if result.get("success"):
        return ResponseModel.success(msg=result.get("message", "取消成功"))
    else:
        return ResponseModel.error(msg=result.get("message", "取消失败"))


@router.post("/calculate_combinations")
async def calculate_combinations(
    request: CalculateCombinationsRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """计算素材文件夹的组合数"""
    service = FissionService(db)
    result = service.calculate_combinations(
        cover_image_folder=request.cover_image_folder,
        main_image_folder=request.main_image_folder,
        detail_image_folder=request.detail_image_folder
    )
    
    if result.get("success"):
        return ResponseModel.success(data=result.get("data"), msg="计算成功")
    else:
        return ResponseModel.error(msg=result.get("message", "计算失败"))


@router.post("/retry_failed")
async def retry_failed_fission(
    request: RetryFailedFissionRequest,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """
    重试失败的裂变项（前端执行版本）
    
    返回失败项详情，由前端 Electron 重新执行
    """
    try:
        import json
        from app.models.product import ProductTask, FissionRecord, ProductInfo
        from app.models.shop import ShopAuth
        
        # 1. 获取任务信息
        task = db.query(ProductTask).filter(ProductTask.task_id == request.task_id).first()
        if not task:
            return ResponseModel.error(msg="任务不存在")
        
        # 2. 检查任务状态
        if task.task_status not in [2, 3]:  # 只能重试已完成或失败的任务
            return ResponseModel.error(msg="只能重试已完成或失败的任务")
        
        # 3. 检查是否有失败项
        if not task.failed_detail or task.failed_count == 0:
            return ResponseModel.error(msg="没有失败的项目需要重试")
        
        # 4. 解析失败详情
        try:
            failed_details = json.loads(task.failed_detail)
        except:
            return ResponseModel.error(msg="失败详情解析失败")
        
        if not failed_details:
            return ResponseModel.error(msg="没有失败的项目需要重试")
        
        # 5. 获取裂变记录
        fission_record = db.query(FissionRecord).filter(
            FissionRecord.task_id == request.task_id
        ).first()
        
        if not fission_record:
            return ResponseModel.error(msg="裂变记录不存在")
        
        # 6. 获取店铺信息
        shop = db.query(ShopAuth).filter(
            ShopAuth.id == task.shop_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            return ResponseModel.error(msg="店铺不存在或已禁用")
        
        # 7. 获取原商品信息
        source_product = db.query(ProductInfo).filter(
            ProductInfo.shop_id == task.shop_id,
            ProductInfo.douyin_product_id == fission_record.source_product_id,
            ProductInfo.status == 1
        ).first()
        
        if not source_product:
            return ResponseModel.error(msg="原商品不存在")
        
        # 8. 解析标题替换列表
        title_replacements = None
        if fission_record.title_replacements:
            try:
                title_replacements = json.loads(fission_record.title_replacements)
            except:
                pass
        
        # 9. 创建重试任务ID
        import uuid
        from datetime import datetime
        retry_task_id = f"RETRY_{request.task_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        # 10. 创建新的任务记录（待前端执行）
        retry_task = ProductTask(
            task_id=retry_task_id,
            shop_id=task.shop_id,
            task_type=task.task_type,
            total_count=len(failed_details),
            success_count=0,
            failed_count=0,
            current_index=0,
            current_product_title="",
            task_status=0,  # 待处理
            progress_percent=0,
            start_time=None,
            end_time=None
        )
        db.add(retry_task)
        db.commit()
        
        print(f"[重试裂变] 任务已创建: {retry_task_id}")
        print(f"[重试裂变] 将重试 {len(failed_details)} 个失败项")
        
        # 11. 返回重试所需的所有信息
        return ResponseModel.success(
            data={
                "retry_task_id": retry_task_id,
                "retry_count": len(failed_details),
                "failed_details": failed_details,
                "source_product": {
                    "product_id": source_product.id,
                    "douyin_product_id": source_product.douyin_product_id,
                    "shop_id": source_product.shop_id,
                    "title": source_product.title,
                    "images": source_product.images,
                    "price": source_product.price,
                    "sku_list": source_product.sku_list
                },
                "fission_params": {
                    "price_float_amount": float(fission_record.price_range) if fission_record.price_range else 0,
                    "title_suffix": fission_record.title_suffix,
                    "title_replacements": title_replacements,
                    "publish_mode": fission_record.publish_mode,
                    "cover_image_folder": None,
                    "main_image_folder": None,
                    "detail_image_folder": None
                }
            },
            msg=f"获取重试信息成功，共 {len(failed_details)} 个失败项"
        )
    
    except Exception as e:
        import traceback
        print(f"✗ 获取重试信息失败: {str(e)}")
        traceback.print_exc()
        return ResponseModel.error(msg=f"获取重试信息失败: {str(e)}")


@router.get("/task/{task_id}/failed-details")
async def get_failed_details(
    task_id: str,
    current_user: AccountUser = Depends(check_permission('fission_manage')),
    db: Session = Depends(get_db)
):
    """
    获取任务的失败详情
    用于前端重试功能
    """
    try:
        import json
        from app.models.product import ProductTask, FissionRecord, ProductInfo
        from app.models.shop import ShopAuth
        
        # 1. 获取任务信息
        task = db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
        if not task:
            return ResponseModel.error(msg="任务不存在")
        
        # 2. 检查是否有失败项
        if not task.failed_detail or task.failed_count == 0:
            return ResponseModel.error(msg="该任务没有失败项")
        
        # 3. 解析失败详情
        try:
            failed_details = json.loads(task.failed_detail)
        except:
            return ResponseModel.error(msg="失败详情解析失败")
        
        # 4. 获取裂变记录
        fission_record = db.query(FissionRecord).filter(
            FissionRecord.task_id == task_id
        ).first()
        
        if not fission_record:
            return ResponseModel.error(msg="裂变记录不存在")
        
        # 5. 获取原商品信息
        source_product = db.query(ProductInfo).filter(
            ProductInfo.shop_id == task.shop_id,
            ProductInfo.douyin_product_id == fission_record.source_product_id,
            ProductInfo.status == 1
        ).first()
        
        if not source_product:
            return ResponseModel.error(msg="原商品不存在")
        
        # 6. 解析标题替换列表
        title_replacements = None
        if fission_record.title_replacements:
            try:
                title_replacements = json.loads(fission_record.title_replacements)
            except:
                pass
        
        # 7. 返回失败详情和相关信息
        return ResponseModel.success(
            data={
                "task_id": task_id,
                "failed_count": len(failed_details),
                "failed_details": failed_details,
                "source_product": {
                    "product_id": source_product.id,
                    "douyin_product_id": source_product.douyin_product_id,
                    "shop_id": source_product.shop_id,
                    "shop_name": source_product.shop_name,
                    "title": source_product.title,
                    "images": source_product.images,
                    "price": source_product.price,
                    "sku_list": source_product.sku_list
                },
                "fission_params": {
                    "price_float_amount": float(fission_record.price_range) if fission_record.price_range else 0,
                    "title_suffix": fission_record.title_suffix,
                    "title_replacements": title_replacements,
                    "publish_mode": fission_record.publish_mode,
                    "cover_image_folder": None,
                    "main_image_folder": None,
                    "detail_image_folder": None
                }
            },
            msg="获取失败详情成功"
        )
    
    except Exception as e:
        import traceback
        print(f"✗ 获取失败详情失败: {str(e)}")
        traceback.print_exc()
        return ResponseModel.error(msg=f"获取失败详情失败: {str(e)}")
