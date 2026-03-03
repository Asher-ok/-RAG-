from fastapi import APIRouter, Depends, File, UploadFile, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, check_permission
from app.models.account import AccountUser
from app.schemas.response import ResponseModel
from app.schemas.product import (
    BatchCreateRequest,
    TaskStatusRequest,
    CancelTaskRequest,
    SyncStatusRequest,
    ProductListRequest
)
from app.services.product_service import ProductService
from app.utils.excel_parser import ExcelParser
import io

router = APIRouter()


@router.post("/upload_image")
async def upload_image(
    shop_id: int = Query(..., description="店铺ID"),
    file: UploadFile = File(..., description="图片文件"),
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """上传图片到抖音图床"""
    # 读取图片数据
    image_data = await file.read()
    
    # 验证文件大小（最大5MB）
    if len(image_data) > 5 * 1024 * 1024:
        return ResponseModel.error(msg="图片大小不能超过5MB")
    
    # 验证文件类型
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        return ResponseModel.error(msg="只支持jpg/png格式图片")
    
    # 调用服务上传图片
    service = ProductService(db)
    result = await service.upload_image_to_douyin(shop_id, image_data)
    
    if result.get("success"):
        return ResponseModel.success(data={"image_url": result.get("image_url")})
    else:
        return ResponseModel.error(msg=result.get("message", "上传失败"))


@router.post("/batch_create")
async def batch_create(
    request: BatchCreateRequest,
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """批量创建商品"""
    service = ProductService(db)
    
    # 转换请求数据
    products = [product.dict() for product in request.products]
    
    result = await service.batch_create_products(
        shop_id=request.shop_id,
        products=products,
        publish_type=request.publish_type
    )
    
    if result.get("success"):
        return ResponseModel.success(data={
            "task_id": result.get("task_id"),
            "invalid_product_list": result.get("invalid_product_list", [])
        })
    else:
        return ResponseModel.error(msg=result.get("message", "创建失败"))


@router.get("/task_list")
async def get_task_list(
    shop_id: int = Query(None, description="店铺ID，不传则查询所有店铺"),
    page_no: int = Query(1, description="页码", ge=1),
    page_size: int = Query(20, description="每页数量", ge=1, le=100),
    task_status: int = Query(None, description="任务状态：0待处理/1进行中/2已完成/3失败/4已取消"),
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取上架任务列表（带权限过滤）
    - 支持按店铺筛选
    - 支持按任务状态筛选
    - 支持分页
    """
    service = ProductService(db)
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
        return ResponseModel.success(data=result)
    else:
        return ResponseModel.error(msg=result.get("message", "查询失败"))


@router.get("/task_status")
async def get_task_status(
    task_id: str = Query(..., description="任务ID"),
    db: Session = Depends(get_db)
):
    """查询上架任务进度"""
    service = ProductService(db)
    result = service.get_task_status(task_id)
    
    if result.get("success"):
        # 直接返回任务状态数据，不再嵌套
        return ResponseModel.success(data={
            "total": result.get("total"),
            "success_count": result.get("success_count"),
            "failed": result.get("failed"),
            "status": result.get("status"),
            "failed_list": result.get("failed_list", []),
            "start_time": result.get("start_time"),
            "end_time": result.get("end_time")
        })
    else:
        return ResponseModel.error(msg=result.get("message", "查询失败"))


@router.post("/cancel_task")
async def cancel_task(
    request: CancelTaskRequest,
    db: Session = Depends(get_db)
):
    """取消上架任务"""
    service = ProductService(db)
    result = service.cancel_task(request.task_id)
    
    if result.get("success"):
        return ResponseModel.success(msg="任务已取消")
    else:
        return ResponseModel.error(msg=result.get("message", "取消失败"))


@router.post("/sync_status")
async def sync_status(
    request: SyncStatusRequest,
    db: Session = Depends(get_db)
):
    """同步商品状态"""
    service = ProductService(db)
    result = await service.sync_product_status(
        shop_id=request.shop_id,
        product_ids=request.product_ids
    )
    
    if result.get("success"):
        return ResponseModel.success(data={"sync_count": result.get("sync_count")})
    else:
        return ResponseModel.error(msg=result.get("message", "同步失败"))


@router.get("/list")
async def get_product_list(
    shop_id: int = Query(None, description="店铺ID（数据库自增ID），不传则查询所有店铺"),
    page_no: int = Query(1, description="页码"),
    page_size: int = Query(20, description="每页数量"),
    product_status: int = Query(None, description="商品状态"),
    search_text: str = Query(None, description="搜索关键词（商品标题或ID）"),
    product_ids: str = Query(None, description="批量查询商品ID，逗号分隔"),
    force_refresh: bool = Query(False, description="是否强制从抖店后台刷新数据"),
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """
    商品列表（支持API和Playwright双模式）
    
    - 默认从数据库读取已有商品
    - 如果数据库没有商品或 force_refresh=true，则从抖店后台抓取
    - 支持搜索：search_text 搜索标题或ID
    - 支持批量查询：product_ids 批量查询指定ID的商品
    
    店铺过滤逻辑：
    - 传入 shop_id：只返回该店铺的商品（数据库自增ID）
    - 不传 shop_id：返回用户有权限的所有店铺的商品
    """
    print(f"\n{'='*60}")
    print(f"[商品列表API] 收到请求")
    print(f"  数据库店铺ID: {shop_id}")
    print(f"  page_no: {page_no}, page_size: {page_size}")
    print(f"  product_status: {product_status}")
    print(f"  force_refresh: {force_refresh}")
    print(f"  user_id: {current_user.id}, account_type: {current_user.account_type}, is_hidden: {current_user.is_hidden}")
    
    service = ProductService(db)
    
    # 如果传了shop_id，验证权限
    if shop_id is not None:
        print(f"→ 查询具体店铺: shop_id={shop_id}")
        
        # 验证权限
        from app.services.shop_service import ShopService
        has_permission = ShopService.check_user_shop_permission(
            db, current_user.id, shop_id, current_user.account_type
        )
        if not has_permission:
            print(f"✗ 权限不足")
            print(f"{'='*60}\n")
            return ResponseModel.error(msg="无权访问该店铺的商品", code=403)
        print(f"✓ 权限验证通过")
    else:
        # 未指定店铺，查询所有店铺
        print(f"→ 查询所有店铺")
        # 隐藏管理员可以看到所有店铺的商品
        # 普通用户只能看到自己有权限的店铺的商品
        if current_user.is_hidden != 1:
            print(f"→ 非隐藏管理员，需要检查店铺权限")
            # 这里不需要提前查询，直接传递给service层处理
            # service层会根据user_id和account_type过滤
        else:
            print(f"→ 隐藏管理员，可查看所有店铺")
    
    try:
        # 用数据库shop_id查询
        result = await service.get_product_list(
            shop_id=shop_id,
            page_no=page_no,
            page_size=page_size,
            product_status=product_status,
            search_text=search_text,
            product_ids=product_ids,
            force_refresh=force_refresh,
            user_id=current_user.id,
            account_type=current_user.account_type,
            is_hidden=current_user.is_hidden
        )
        
        print(f"✓ 查询完成")
        print(f"{'='*60}\n")
        
        if result.get("success"):
            return ResponseModel.success(data=result)
        else:
            return ResponseModel.error(msg=result.get("message", "查询失败"))
    except Exception as e:
        print(f"✗ 查询异常: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        return ResponseModel.error(msg=f"查询失败: {str(e)}", code=500)


@router.post("/import_excel")
async def import_excel(
    file: UploadFile = File(..., description="Excel/CSV文件"),
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """导入Excel/CSV文件解析商品数据"""
    # 验证文件类型
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ['xlsx', 'xls', 'csv']:
        return ResponseModel.error(msg="只支持Excel(.xlsx/.xls)或CSV(.csv)格式文件")
    
    # 验证文件大小（最大10MB）
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:
        return ResponseModel.error(msg="文件大小不能超过10MB")
    
    # 解析文件
    result = ExcelParser.parse_excel(file_content, file_type=file_ext)
    
    if result.get("success"):
        return ResponseModel.success(data={
            "products": result.get("products", []),
            "total_count": result.get("total_count", 0),
            "invalid_rows": result.get("invalid_rows", [])
        })
    else:
        return ResponseModel.error(msg=result.get("message", "解析失败"))


@router.get("/download_template")
async def download_template():
    """下载商品导入模板"""
    try:
        template_content = ExcelParser.generate_template()
        
        return StreamingResponse(
            io.BytesIO(template_content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": "attachment; filename=product_import_template.xlsx"
            }
        )
    except Exception as e:
        return ResponseModel.error(msg=f"生成模板失败: {str(e)}")


@router.post("/create_playwright")
async def create_product_playwright(
    shop_id: int = Query(..., description="店铺ID"),
    title: str = Query(..., description="商品标题"),
    images: str = Query(..., description="图片路径列表，逗号分隔"),
    price: float = Query(None, description="价格"),
    stock: int = Query(None, description="库存"),
    db: Session = Depends(get_db)
):
    """
    使用Playwright模式创建商品
    
    - 适用于Playwright授权模式的店铺
    - 自动化填写商品信息并提交
    """
    service = ProductService(db)
    
    # 构建商品数据
    product_data = {
        "title": title,
        "images": images.split(",") if images else [],
        "price": price,
        "stock": stock
    }
    
    result = await service.create_product_playwright(
        shop_id=shop_id,
        product_data=product_data
    )
    
    if result.get("success"):
        return ResponseModel.success(data=result, msg="商品创建成功")
    else:
        return ResponseModel.error(msg=result.get("message", "创建失败"))


@router.post("/batch-save")
async def batch_save_products(
    request: dict,
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """
    批量保存商品（前端Electron同步专用）
    
    接收前端解析的商品数据，批量插入或更新到数据库
    
    请求体：
    {
        "shop_id": 123,
        "products": [
            {
                "product_id": "商品ID",
                "title": "商品标题",
                "price": 99.9,
                "stock": 100,
                "product_status": "已上架",
                "sku_list": [],
                "images": []
            }
        ]
    }
    """
    from app.models.product import ProductInfo
    from datetime import datetime
    import json
    
    print(f"\n{'='*60}")
    print(f"[批量保存API] 收到请求")
    
    try:
        shop_id = request.get("shop_id")
        products = request.get("products", [])
        
        if not shop_id:
            return ResponseModel.error(msg="缺少shop_id参数")
        
        if not products:
            return ResponseModel.error(msg="商品列表为空")
        
        product_count = len(products)
        print(f"  shop_id: {shop_id}")
        print(f"  商品总数: {product_count}")
        
        saved_count = 0
        updated_count = 0
        failed_count = 0
        failed_details = []
        
        for idx, product in enumerate(products):
            try:
                product_id = product.get("product_id")
                title = product.get("title")
                
                if not product_id:
                    print(f"  ⚠ 第 {idx + 1} 个商品缺少product_id，跳过")
                    failed_count += 1
                    failed_details.append({
                        'index': idx + 1,
                        'reason': '缺少product_id'
                    })
                    continue
                
                # 检查商品是否已存在
                existing = db.query(ProductInfo).filter(
                    ProductInfo.shop_id == shop_id,
                    ProductInfo.douyin_product_id == product_id
                ).first()
                
                if existing:
                    # 更新现有商品
                    existing.title = title
                    existing.price = product.get("price")
                    existing.stock = product.get("stock")
                    existing.product_status = product.get("product_status")
                    existing.sku_list = json.dumps(product.get("sku_list", []), ensure_ascii=False)
                    existing.images = json.dumps(product.get("images", []), ensure_ascii=False)
                    existing.update_time = datetime.now()
                    
                    updated_count += 1
                    
                    if (idx + 1) % 10 == 0 or idx == 0:
                        print(f"  → 第 {idx + 1}/{product_count} 个: 更新 - {title[:30]}...")
                    
                else:
                    # 新增商品
                    new_product = ProductInfo(
                        shop_id=shop_id,
                        douyin_product_id=product_id,
                        title=title,
                        price=product.get("price"),
                        stock=product.get("stock"),
                        product_status=product.get("product_status"),
                        sku_list=json.dumps(product.get("sku_list", []), ensure_ascii=False),
                        images=json.dumps(product.get("images", []), ensure_ascii=False),
                        source_type=2  # 2表示Playwright同步
                    )
                    db.add(new_product)
                    
                    saved_count += 1
                    
                    if (idx + 1) % 10 == 0 or idx == 0:
                        print(f"  → 第 {idx + 1}/{product_count} 个: 新增 - {title[:30]}...")
                
                # 提交事务
                db.commit()
                
            except Exception as e:
                db.rollback()
                failed_count += 1
                
                error_msg = str(e)
                print(f"  ✗ 第 {idx + 1} 个商品保存失败: {error_msg}")
                
                failed_details.append({
                    'index': idx + 1,
                    'product_id': product.get("product_id", 'unknown'),
                    'title': product.get("title", 'unknown')[:30],
                    'reason': error_msg
                })
                
                continue
        
        # 统计结果
        success_rate = ((saved_count + updated_count) / product_count * 100) if product_count > 0 else 0
        
        print(f"\n  ✓ 商品保存完成")
        print(f"  → 总计: {product_count} 个")
        print(f"  → 新增: {saved_count} 个")
        print(f"  → 更新: {updated_count} 个")
        print(f"  → 失败: {failed_count} 个")
        print(f"  → 成功率: {success_rate:.1f}%")
        print(f"{'='*60}\n")
        
        return ResponseModel.success(data={
            "saved_count": saved_count,
            "updated_count": updated_count,
            "failed_count": failed_count,
            "success_rate": success_rate,
            "failed_details": failed_details
        }, msg=f"商品保存完成，新增 {saved_count} 个，更新 {updated_count} 个")
        
    except Exception as e:
        print(f"  ✗ 批量保存失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        
        db.rollback()
        
        return ResponseModel.error(msg=f"批量保存失败: {str(e)}")
