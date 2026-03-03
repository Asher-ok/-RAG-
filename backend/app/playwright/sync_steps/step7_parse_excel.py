"""
步骤7: 解析Excel文件

功能：
1. 读取Excel文件
2. 解析商品数据
3. 验证数据完整性
4. 返回商品列表

注意：
- 使用ProductScraper的解析方法
- 需要验证必要字段是否存在
- 返回标准化的商品数据结构
"""

from app.playwright.product_scraper商品信息抓取器 import ProductScraper


async def parse_excel(filepath):
    """
    解析Excel文件
    
    Args:
        filepath: Excel文件路径
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'products': list,
            'details': dict
        }
    """
    print(f"\n========== [步骤7] 解析Excel文件 ==========")
    
    try:
        # 7.1 开始解析
        print(f"[步骤7.1] 开始解析Excel文件...")
        print(f"  → 文件路径: {filepath}")
        
        # 调用ProductScraper的解析方法
        products = ProductScraper.parse_product_excel(filepath)
        
        # 7.2 检查解析结果
        print(f"\n[步骤7.2] 检查解析结果...")
        
        if not products:
            print(f"  ✗ Excel文件解析失败或无商品数据")
            print(f"  → 文件路径: {filepath}")
            
            return {
                'success': False,
                'message': 'Excel文件解析失败或无商品数据',
                'products': [],
                'details': {
                    'filepath': filepath,
                    'product_count': 0
                }
            }
        
        product_count = len(products)
        print(f"  ✓ 成功解析 {product_count} 个商品")
        
        # 7.3 验证商品数据
        print(f"\n[步骤7.3] 验证商品数据...")
        
        # 统计字段完整性
        required_fields = ['product_id', 'title', 'price', 'stock', 'product_status']
        optional_fields = ['sku_list', 'images']
        
        valid_count = 0
        invalid_count = 0
        field_stats = {field: 0 for field in required_fields + optional_fields}
        
        for product in products:
            is_valid = True
            
            # 检查必需字段
            for field in required_fields:
                if field in product and product[field] is not None:
                    field_stats[field] += 1
                else:
                    is_valid = False
            
            # 检查可选字段
            for field in optional_fields:
                if field in product and product[field] is not None:
                    field_stats[field] += 1
            
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1
        
        print(f"  → 有效商品: {valid_count} 个")
        print(f"  → 无效商品: {invalid_count} 个")
        
        print(f"\n  → 字段完整性统计:")
        for field, count in field_stats.items():
            percentage = (count / product_count * 100) if product_count > 0 else 0
            field_type = "必需" if field in required_fields else "可选"
            print(f"    • {field} ({field_type}): {count}/{product_count} ({percentage:.1f}%)")
        
        # 7.4 显示示例商品
        print(f"\n[步骤7.4] 商品数据示例...")
        
        if products:
            sample_product = products[0]
            print(f"  → 第一个商品:")
            print(f"    • 商品ID: {sample_product.get('product_id', 'N/A')}")
            print(f"    • 标题: {sample_product.get('title', 'N/A')[:50]}...")
            print(f"    • 价格: {sample_product.get('price', 'N/A')}")
            print(f"    • 库存: {sample_product.get('stock', 'N/A')}")
            print(f"    • 状态: {sample_product.get('product_status', 'N/A')}")
            
            if 'sku_list' in sample_product:
                sku_count = len(sample_product['sku_list']) if isinstance(sample_product['sku_list'], list) else 0
                print(f"    • SKU数量: {sku_count}")
            
            if 'images' in sample_product:
                image_count = len(sample_product['images']) if isinstance(sample_product['images'], list) else 0
                print(f"    • 图片数量: {image_count}")
        
        # 7.5 统计商品状态分布
        print(f"\n[步骤7.5] 商品状态分布...")
        
        status_stats = {}
        for product in products:
            status = product.get('product_status', '未知')
            if status not in status_stats:
                status_stats[status] = 0
            status_stats[status] += 1
        
        for status, count in status_stats.items():
            percentage = (count / product_count * 100) if product_count > 0 else 0
            print(f"  → {status}: {count} 个 ({percentage:.1f}%)")
        
        print(f"========== [步骤7] 完成 ==========\n")
        
        return {
            'success': True,
            'message': f'成功解析 {product_count} 个商品',
            'products': products,
            'details': {
                'filepath': filepath,
                'product_count': product_count,
                'valid_count': valid_count,
                'invalid_count': invalid_count,
                'field_stats': field_stats,
                'status_stats': status_stats
            }
        }
        
    except Exception as e:
        print(f"  ✗ 解析Excel文件失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'success': False,
            'message': f'解析失败: {str(e)}',
            'products': [],
            'details': {
                'filepath': filepath,
                'error': str(e)
            }
        }
