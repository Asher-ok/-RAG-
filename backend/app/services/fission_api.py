"""
商品裂变 - API实现
"""
import json
import random
import string
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.product import ProductInfo
from app.models.shop import ShopAuth
from app.services.douyin_api import DouyinAPIService


class FissionAPI:
    """API裂变类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_random_suffix(self, length: int = 4) -> str:
        """生成随机后缀"""
        chars = string.ascii_uppercase + string.digits
        return ''.join(random.choice(chars) for _ in range(length))
    
    def _generate_random_sku_code(self, original_code: str) -> str:
        """生成随机SKU编码"""
        suffix = self._generate_random_suffix(6)
        return f"{original_code}-{suffix}"
    
    async def execute_fission(
        self,
        shop: ShopAuth,
        source_product: ProductInfo,
        count: int,
        price_float_amount: float = 0,
        title_suffix: str = None,
        title_replacements: list = None,
        publish_mode: int = 2,
        cover_image_folder: str = None,
        main_image_folder: str = None,
        detail_image_folder: str = None,
        task_id: str = None
    ) -> Dict[str, Any]:
        """
        执行API裂变
        
        Args:
            shop: 店铺信息
            source_product: 原商品信息
            count: 裂变数量
            price_float_amount: 价格浮动金额（元）
            title_suffix: 标题后缀
            title_replacements: 标题替换列表（循环使用）
            publish_mode: 发布模式 1草稿/2上架
            cover_image_folder: 首图文件夹路径（API模式不使用）
            main_image_folder: 主图文件夹路径（API模式不使用）
            detail_image_folder: 详情图文件夹路径（API模式不使用）
            task_id: 任务ID（用于更新进度）
            
        Returns:
            裂变结果
        """
        try:
            print(f"\n[API裂变] 开始执行...")
            print(f"  原商品: {source_product.title}")
            print(f"  裂变数量: {count}")
            
            # 初始化API服务
            api_service = DouyinAPIService(access_token=shop.access_token)
            
            # 解析原商品数据
            original_images = json.loads(source_product.images)
            original_sku_list = json.loads(source_product.sku_list)
            
            # 批量创建裂变商品
            success_count = 0
            failed_count = 0
            failed_details = []
            generated_product_ids = []
            
            for i in range(count):
                print(f"\n[API裂变] 创建第 {i + 1}/{count} 个商品...")
                
                # 生成新标题
                if title_replacements and len(title_replacements) > 0:
                    # 使用标题替换列表（循环使用）
                    replacement_index = i % len(title_replacements)
                    base_title = title_replacements[replacement_index]
                    print(f"  使用替换标题 #{replacement_index + 1}/{len(title_replacements)}: {base_title}")
                    
                    # 标题 = 替换标题 + 标题后缀 + 随机后缀
                    if title_suffix:
                        new_title = f"{base_title}{title_suffix}{self._generate_random_suffix()}"
                    else:
                        new_title = f"{base_title}{self._generate_random_suffix()}"
                else:
                    # 使用原标题 + 标题后缀 + 随机后缀
                    if title_suffix:
                        new_title = f"{source_product.title} {title_suffix} {self._generate_random_suffix()}"
                    else:
                        new_title = f"{source_product.title} {self._generate_random_suffix()}"
                
                # 确保标题不超过256字符
                if len(new_title) > 256:
                    new_title = new_title[:256]
                
                print(f"  生成标题: {new_title}")
                
                # 处理图片（API模式使用原商品图片）
                new_images = original_images.copy()
                # API模式可以随机打乱顺序
                random.shuffle(new_images)
                
                # 处理SKU（价格浮动）
                new_sku_list = []
                for sku in original_sku_list:
                    new_sku = sku.copy()
                    # 生成新的SKU编码
                    if 'sku_id' in new_sku:
                        new_sku['sku_id'] = self._generate_random_sku_code(new_sku['sku_id'])
                    # 价格浮动
                    if 'price' in new_sku and price_float_amount > 0:
                        float_amount_cents = int(price_float_amount * 100)
                        variation = random.randint(-float_amount_cents, float_amount_cents)
                        new_sku['price'] = max(1, new_sku['price'] + variation)
                    new_sku_list.append(new_sku)
                
                # 构建商品数据
                product_data = {
                    "name": new_title,
                    "pic": new_images[0] if new_images else "",
                    "description": "|".join(new_images),
                    "category_leaf_id": source_product.third_cid,
                    "pay_type": 1,
                }
                
                # 添加SKU信息
                if new_sku_list:
                    first_sku = new_sku_list[0]
                    product_data["market_price"] = first_sku.get("price", 0)
                    product_data["discount_price"] = first_sku.get("price", 0)
                
                # 调用抖音API创建商品
                result = await api_service.add_product(product_data)
                
                if result.get("err_no") == 0:
                    # 创建成功，保存到数据库
                    douyin_product_id = result.get("data", {}).get("product_id", "")
                    
                    # 根据发布模式设置商品状态
                    if publish_mode == 1:
                        product_status = 0  # 草稿
                    elif publish_mode == 2:
                        product_status = 1  # 上架
                    else:
                        product_status = 0  # 仓库
                    
                    # 保存到数据库
                    product_info = ProductInfo(
                        shop_id=source_product.shop_id,
                        douyin_product_id=str(douyin_product_id),
                        title=new_title,
                        price=new_sku_list[0].get("price", 0) if new_sku_list else 0,
                        stock=sum(sku.get("stock", 0) for sku in new_sku_list) if new_sku_list else 0,
                        first_cid=source_product.first_cid,
                        second_cid=source_product.second_cid,
                        third_cid=source_product.third_cid,
                        fourth_cid=source_product.fourth_cid,
                        first_cname=source_product.first_cname,
                        second_cname=source_product.second_cname,
                        third_cname=source_product.third_cname,
                        fourth_cname=source_product.fourth_cname,
                        product_type=source_product.product_type,
                        product_group=source_product.product_group,
                        merchant_code=source_product.merchant_code,
                        item_number=source_product.item_number,
                        available_stock=source_product.available_stock,
                        presale_stock=source_product.presale_stock,
                        ladder_stock=source_product.ladder_stock,
                        images=json.dumps(new_images),
                        sku_list=json.dumps(new_sku_list),
                        delivery_time=source_product.delivery_time,
                        sales_count=0,
                        commission_rate=source_product.commission_rate,
                        audit_status=0,
                        product_url=None,
                        product_status=product_status,
                        source_type=2,  # 裂变生成
                        source_id=source_product.id
                    )
                    self.db.add(product_info)
                    self.db.commit()
                    
                    generated_product_ids.append(str(douyin_product_id))
                    success_count += 1
                    print(f"✓ 第 {i + 1} 个商品创建成功，ID: {douyin_product_id}")
                else:
                    # 失败，记录错误
                    failed_count += 1
                    failed_details.append({
                        "index": i + 1,
                        "title": new_title,
                        "reason": result.get("message", "创建失败")
                    })
                    print(f"✗ 第 {i + 1} 个商品创建失败: {result.get('message')}")
            
            return {
                "success": True,
                "message": f"裂变完成，成功{success_count}个，失败{failed_count}个",
                "total": count,
                "success_count": success_count,
                "failed_count": failed_count,
                "failed_details": failed_details,
                "product_ids": generated_product_ids
            }
            
        except Exception as e:
            print(f"✗ API裂变失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"裂变失败: {str(e)}"
            }
