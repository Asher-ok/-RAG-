"""
步骤8: 保存到数据库

功能：
1. 遍历商品列表
2. 检查商品是否已存在
3. 新增或更新商品记录
4. 统计保存结果
5. 每10个商品推送一次进度

注意：
- 使用shop_id和douyin_product_id作为唯一标识
- 已存在的商品会更新信息
- 新商品会插入数据库
- 需要处理异常情况
"""

import json
from datetime import datetime
from app.models.product import ProductInfo


async def save_to_database(db, shop_id, products, progress_callback=None):
    """
    保存商品到数据库
    
    Args:
        db: 数据库Session
        shop_id: 店铺ID
        products: 商品列表
        progress_callback: 进度回调函数 (可选)
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'saved_count': int,
            'updated_count': int,
            'failed_count': int,
            'details': dict
        }
    """
    print(f"\n========== [步骤8] 保存到数据库 ==========")
    
    try:
        # 8.1 开始保存
        product_count = len(products)
        print(f"[步骤8.1] 开始保存商品到数据库...")
        print(f"  → 店铺ID: {shop_id}")
        print(f"  → 商品总数: {product_count} 个")
        
        saved_count = 0
        updated_count = 0
        failed_count = 0
        failed_details = []
        
        # 8.2 遍历商品
        print(f"\n[步骤8.2] 遍历商品并保存...")
        
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
                
                # 8.2.1 检查商品是否已存在
                existing = db.query(ProductInfo).filter(
                    ProductInfo.shop_id == shop_id,
                    ProductInfo.douyin_product_id == product_id
                ).first()
                
                if existing:
                    # 8.2.2 更新现有商品
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
                    # 8.2.3 新增商品
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
                
                # 8.2.4 提交事务
                db.commit()
                
                # 8.2.5 每10个商品推送一次进度
                if progress_callback and ((idx + 1) % 10 == 0 or idx == product_count - 1):
                    progress_info = {
                        'current': idx + 1,
                        'total': product_count,
                        'saved': saved_count,
                        'updated': updated_count,
                        'failed': failed_count,
                        'percentage': int((idx + 1) / product_count * 100)
                    }
                    await progress_callback(progress_info)
                
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
        
        # 8.3 统计结果
        print(f"\n[步骤8.3] 保存结果统计...")
        
        total_processed = saved_count + updated_count + failed_count
        success_rate = ((saved_count + updated_count) / product_count * 100) if product_count > 0 else 0
        
        print(f"  ✓ 商品保存完成")
        print(f"  → 总计: {product_count} 个")
        print(f"  → 新增: {saved_count} 个")
        print(f"  → 更新: {updated_count} 个")
        print(f"  → 失败: {failed_count} 个")
        print(f"  → 成功率: {success_rate:.1f}%")
        
        # 8.4 显示失败详情
        if failed_count > 0:
            print(f"\n[步骤8.4] 失败商品详情...")
            
            for detail in failed_details[:5]:  # 最多显示前5个
                print(f"  → 第 {detail['index']} 个:")
                if 'product_id' in detail:
                    print(f"    • 商品ID: {detail['product_id']}")
                if 'title' in detail:
                    print(f"    • 标题: {detail['title']}")
                print(f"    • 原因: {detail['reason']}")
            
            if failed_count > 5:
                print(f"  → ... 还有 {failed_count - 5} 个失败商品")
        
        print(f"========== [步骤8] 完成 ==========\n")
        
        return {
            'success': True,
            'message': f'商品保存完成，新增 {saved_count} 个，更新 {updated_count} 个',
            'saved_count': saved_count,
            'updated_count': updated_count,
            'failed_count': failed_count,
            'details': {
                'shop_id': shop_id,
                'total': product_count,
                'saved': saved_count,
                'updated': updated_count,
                'failed': failed_count,
                'success_rate': success_rate,
                'failed_details': failed_details
            }
        }
        
    except Exception as e:
        print(f"  ✗ 保存到数据库失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        db.rollback()
        
        return {
            'success': False,
            'message': f'保存失败: {str(e)}',
            'saved_count': saved_count if 'saved_count' in locals() else 0,
            'updated_count': updated_count if 'updated_count' in locals() else 0,
            'failed_count': failed_count if 'failed_count' in locals() else 0,
            'details': {
                'error': str(e)
            }
        }
