"""
商品Excel文件上传接口
"""
from fastapi import APIRouter, UploadFile, File, Depends, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.response import success_response, error_response
from app.core.dependencies import get_current_user, check_permission
from app.models.account import AccountUser
from app.playwright.product_scraper商品信息抓取器 import ProductScraper
from app.models.product import ProductInfo
from datetime import datetime
import json
import os
import tempfile

router = APIRouter()


@router.post("/upload-excel")
async def upload_product_excel(
    file: UploadFile = File(...),
    shop_id: str = Form(...),  # 这里接收的是抖音店铺ID
    current_user: AccountUser = Depends(check_permission('product_manage')),
    db: Session = Depends(get_db)
):
    """
    上传商品Excel文件并解析保存
    
    参数：
    - file: Excel文件
    - shop_id: 抖音店铺ID（字符串）
    
    返回：
    - saved_count: 新增数量
    - updated_count: 更新数量
    - failed_count: 失败数量
    """
    print(f"\n{'='*60}")
    print(f"[Excel上传] 收到文件上传请求")
    print(f"  文件名: {file.filename}")
    print(f"  抖音店铺ID: {shop_id}")
    print(f"  文件类型: {file.content_type}")
    
    # 根据抖音店铺ID查询数据库shop_id
    from app.models.shop import ShopAuth
    shop = db.query(ShopAuth).filter(
        ShopAuth.douyin_shop_id == shop_id,
        ShopAuth.status == 1
    ).first()
    
    if not shop:
        print(f"  ✗ 店铺不存在或已禁用")
        print(f"{'='*60}\n")
        return error_response(msg="店铺不存在或已禁用，请刷新店铺列表", code=400)
    
    db_shop_id = shop.id
    print(f"  → 数据库店铺ID: {db_shop_id}")
    print(f"  → 店铺名称: {shop.shop_name}")
    
    # 验证文件类型
    if not file.filename.endswith(('.xlsx', '.xls')):
        return error_response(msg="文件格式错误，只支持 .xlsx 或 .xls 文件", code=400)
    
    temp_file_path = None
    
    try:
        # 保存上传的文件到临时目录
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            temp_file_path = temp_file.name
            content = await file.read()
            temp_file.write(content)
        
        print(f"  → 临时文件: {temp_file_path}")
        print(f"  → 文件大小: {len(content)} 字节 ({len(content)/1024:.2f} KB)")
        
        # 使用后端现有的解析逻辑
        print(f"\n[Excel解析] 开始解析...")
        products = ProductScraper.parse_product_excel(temp_file_path)
        
        if not products:
            return error_response(msg="Excel文件解析失败或无商品数据", code=400)
        
        product_count = len(products)
        print(f"  ✓ 成功解析 {product_count} 个商品")
        
        # 批量保存到数据库
        print(f"\n[数据库保存] 开始保存...")
        
        saved_count = 0
        updated_count = 0
        failed_count = 0
        failed_details = []
        
        for idx, product in enumerate(products):
            try:
                product_id = product.get("product_id")
                title = product.get("title")
                
                if not product_id:
                    failed_count += 1
                    failed_details.append({
                        'index': idx + 1,
                        'reason': '缺少product_id'
                    })
                    continue
                
                # 检查商品是否已存在（使用douyin_product_id唯一索引）
                existing = db.query(ProductInfo).filter(
                    ProductInfo.douyin_product_id == product_id
                ).first()
                
                if existing:
                    # 更新现有商品
                    existing.shop_id = db_shop_id  # 更新shop_id
                    existing.title = title
                    existing.first_cid = product.get("first_cid", "0")
                    existing.second_cid = product.get("second_cid", "0")
                    existing.third_cid = product.get("third_cid", "0")
                    existing.fourth_cid = product.get("fourth_cid")
                    existing.first_cname = product.get("first_cname", "")
                    existing.second_cname = product.get("second_cname", "")
                    existing.third_cname = product.get("third_cname", "")
                    existing.fourth_cname = product.get("fourth_cname")
                    existing.product_type = product.get("product_type", 1)
                    existing.product_group = product.get("product_group")
                    existing.merchant_code = product.get("merchant_code")
                    existing.item_number = product.get("item_number")
                    existing.price = int(product.get("price", 0) * 100)  # 转换为分
                    existing.stock = product.get("stock", 0)
                    existing.available_stock = product.get("available_stock", 0)
                    existing.presale_stock = product.get("presale_stock", 0)
                    existing.ladder_stock = product.get("ladder_stock")
                    existing.delivery_time = str(product.get("delivery_time", 1))
                    existing.sales_count = product.get("sales_count", 0)
                    existing.commission_rate = product.get("commission_rate")
                    existing.audit_status = product.get("audit_status", 0)
                    existing.product_url = product.get("product_url")
                    existing.product_status = product.get("product_status", 0)
                    existing.sku_list = json.dumps(product.get("sku_list", []), ensure_ascii=False)
                    existing.images = json.dumps(product.get("images", []), ensure_ascii=False)
                    existing.update_time = datetime.now()
                    
                    updated_count += 1
                    
                else:
                    # 新增商品
                    new_product = ProductInfo(
                        shop_id=db_shop_id,
                        douyin_product_id=product_id,
                        title=title,
                        first_cid=product.get("first_cid", "0"),
                        second_cid=product.get("second_cid", "0"),
                        third_cid=product.get("third_cid", "0"),
                        fourth_cid=product.get("fourth_cid"),
                        first_cname=product.get("first_cname", ""),
                        second_cname=product.get("second_cname", ""),
                        third_cname=product.get("third_cname", ""),
                        fourth_cname=product.get("fourth_cname"),
                        product_type=product.get("product_type", 1),
                        product_group=product.get("product_group"),
                        merchant_code=product.get("merchant_code"),
                        item_number=product.get("item_number"),
                        price=int(product.get("price", 0) * 100),  # 转换为分
                        stock=product.get("stock", 0),
                        available_stock=product.get("available_stock", 0),
                        presale_stock=product.get("presale_stock", 0),
                        ladder_stock=product.get("ladder_stock"),
                        delivery_time=str(product.get("delivery_time", 1)),
                        sales_count=product.get("sales_count", 0),
                        commission_rate=product.get("commission_rate"),
                        audit_status=product.get("audit_status", 0),
                        product_url=product.get("product_url"),
                        product_status=product.get("product_status", 0),
                        sku_list=json.dumps(product.get("sku_list", []), ensure_ascii=False),
                        images=json.dumps(product.get("images", []), ensure_ascii=False),
                        source_type=2  # 2表示Playwright同步
                    )
                    db.add(new_product)
                    
                    saved_count += 1
                
                # 每100个提交一次
                if (idx + 1) % 100 == 0:
                    try:
                        db.commit()
                        print(f"  → 已处理 {idx + 1}/{product_count} 个 (新增:{saved_count}, 更新:{updated_count}, 失败:{failed_count})")
                    except Exception as commit_error:
                        db.rollback()
                        print(f"  ✗ 批量提交失败: {str(commit_error)}")
                        # 提交失败时，将这批商品标记为失败
                        failed_count += min(100, product_count - idx + 100)
                
            except Exception as e:
                error_msg = str(e)
                print(f"  ✗ 第 {idx + 1} 个商品处理失败: {error_msg}")
                
                failed_details.append({
                    'index': idx + 1,
                    'product_id': product.get("product_id", 'unknown'),
                    'title': product.get("title", 'unknown')[:30],
                    'reason': error_msg
                })
                failed_count += 1
        
        # 最后提交剩余的
        try:
            db.commit()
            print(f"  → 最终提交完成")
        except Exception as final_error:
            db.rollback()
            print(f"  ✗ 最终提交失败: {str(final_error)}")
        
        # 统计结果
        success_rate = ((saved_count + updated_count) / product_count * 100) if product_count > 0 else 0
        
        print(f"\n  ✓ 商品保存完成")
        print(f"  → 总计: {product_count} 个")
        print(f"  → 新增: {saved_count} 个")
        print(f"  → 更新: {updated_count} 个")
        print(f"  → 失败: {failed_count} 个")
        print(f"  → 成功率: {success_rate:.1f}%")
        print(f"{'='*60}\n")
        
        return success_response(data={
            "total_count": product_count,
            "saved_count": saved_count,
            "updated_count": updated_count,
            "failed_count": failed_count,
            "success_rate": success_rate,
            "failed_details": failed_details[:10]  # 最多返回前10个失败详情
        }, msg=f"商品保存完成，新增 {saved_count} 个，更新 {updated_count} 个")
        
    except Exception as e:
        print(f"  ✗ 处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        
        return error_response(msg=f"处理失败: {str(e)}", code=500)
        
    finally:
        # 清理临时文件
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                print(f"  ✓ 临时文件已删除")
            except:
                pass
