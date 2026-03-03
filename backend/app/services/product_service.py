"""
商品批量上架业务服务
"""
import re
import uuid
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.product import ProductInfo, ProductTask
from app.models.shop import ShopAuth
from app.services.douyin_api import DouyinAPIService


class ProductService:
    """商品服务类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def upload_image_to_douyin(self, shop_id: int, image_data: bytes) -> Dict[str, Any]:
        """
        上传图片到抖音图床
        :param shop_id: 店铺ID
        :param image_data: 图片二进制数据
        :return: 图片URL
        """
        # 获取店铺授权信息
        shop = self.db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            return {"success": False, "message": "店铺不存在或已禁用"}
        
        # 检查token是否过期
        if shop.expire_time < datetime.now():
            return {"success": False, "message": "店铺授权已过期，请重新授权"}
        
        # 调用抖音API上传图片
        api_service = DouyinAPIService(access_token=shop.access_token)
        result = await api_service.upload_image(image_data)
        
        if result.get("err_no") == 0:
            return {
                "success": True,
                "image_url": result.get("data", {}).get("url", "")
            }
        else:
            return {
                "success": False,
                "message": result.get("message", "上传失败")
            }
    
    async def batch_create_products(
        self,
        shop_id: int,
        products: List[Dict[str, Any]],
        publish_type: int = 1
    ) -> Dict[str, Any]:
        """
        批量创建商品（支持API和Playwright双模式）
        :param shop_id: 店铺ID
        :param products: 商品列表
        :param publish_type: 0草稿/1直接上架
        :return: 任务ID和无效商品列表
        """
        # 获取店铺授权信息
        shop = self.db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            return {"success": False, "message": "店铺不存在或已禁用"}
        
        # 根据授权模式选择创建方式
        if shop.auth_mode == 'playwright':
            print(f"\n[商品创建] 使用Playwright模式批量创建商品...")
            return await self._batch_create_playwright(shop, products, publish_type)
        elif shop.auth_mode == 'api':
            print(f"\n[商品创建] 使用API模式批量创建商品...")
            return await self._batch_create_api(shop, products, publish_type)
        else:
            return {"success": False, "message": "未知的授权模式"}
    
    async def _batch_create_playwright(
        self,
        shop: ShopAuth,
        products: List[Dict[str, Any]],
        publish_type: int
    ) -> Dict[str, Any]:
        """使用Playwright模式批量创建商品"""
        try:
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.playwright.product_creator商品创建发布 import ProductCreator
            
            print(f"  店铺ID: {shop.id}")
            print(f"  店铺名称: {shop.shop_name}")
            print(f"  Playwright账号ID: {shop.playwright_account_id}")
            
            browser_manager = BrowserManager()
            
            # 检查是否有保存的状态
            if not browser_manager.account_manager.has_state(shop.playwright_account_id):
                return {
                    "success": False,
                    "message": f"未找到账号 {shop.playwright_account_id} 的登录状态，请重新登录"
                }
            
            print(f"✓ 找到保存的登录状态")
            
            # 启动浏览器
            await browser_manager.launch_browser(headless=True)
            
            # 加载已保存的登录状态
            context = await browser_manager.create_context(
                account_id=shop.playwright_account_id
            )
            
            # 批量创建商品
            result = await ProductCreator.batch_create_products(context, products)
            
            # 清理资源
            await context.close()
            await browser_manager.stop()
            
            return {
                "success": True,
                "total": result.get("total"),
                "success_count": result.get("success_count"),
                "failed_count": result.get("failed_count"),
                "results": result.get("results")
            }
            
        except Exception as e:
            print(f"✗ Playwright模式批量创建失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"批量创建失败: {str(e)}"
            }
    
    async def _batch_create_api(
        self,
        shop: ShopAuth,
        products: List[Dict[str, Any]],
        publish_type: int
    ) -> Dict[str, Any]:
        """使用API模式批量创建商品"""
        # 检查token是否过期
        if shop.expire_time < datetime.now():
            return {"success": False, "message": "店铺授权已过期，请重新授权"}
        
        # 验证商品数据，找出无效商品
        invalid_products = []
        valid_products = []
        
        for idx, product in enumerate(products):
            # 验证必填字段
            if not all(key in product for key in ["title", "first_cid", "second_cid", "third_cid", "images", "sku_list"]):
                invalid_products.append({
                    "index": idx,
                    "reason": "缺少必填字段"
                })
                continue
            
            # 验证SKU列表
            if not product["sku_list"] or len(product["sku_list"]) == 0:
                invalid_products.append({
                    "index": idx,
                    "reason": "SKU列表不能为空"
                })
                continue
            
            valid_products.append(product)
        
        # 创建任务记录
        task_id = str(uuid.uuid4())
        task = ProductTask(
            task_id=task_id,
            shop_id=shop_id,
            task_type=1,  # 1批量上架
            total_count=len(valid_products),
            success_count=0,
            failed_count=0,
            task_status=0,  # 0待处理
            failed_detail=json.dumps([]),
            start_time=None,
            end_time=None
        )
        self.db.add(task)
        self.db.commit()
        
        # 异步执行批量创建任务
        asyncio.create_task(
            self._execute_batch_create_task(
                task_id, shop.access_token, valid_products, publish_type
            )
        )
        
        return {
            "success": True,
            "task_id": task_id,
            "invalid_product_list": invalid_products
        }
    
    async def _execute_batch_create_task(
        self,
        task_id: str,
        access_token: str,
        products: List[Dict[str, Any]],
        publish_type: int
    ):
        """
        执行批量创建任务（异步）
        :param task_id: 任务ID
        :param access_token: 访问令牌
        :param products: 商品列表
        :param publish_type: 发布类型
        """
        # 创建新的数据库连接
        from app.core.database import SessionLocal
        db = SessionLocal()
        
        try:
            # 更新任务状态为进行中
            task = db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            if not task:
                return
            
            task.task_status = 1  # 进行中
            task.start_time = datetime.now()
            db.commit()
            
            # 初始化API服务
            api_service = DouyinAPIService(access_token=access_token)
            
            # 批量创建商品
            success_count = 0
            failed_count = 0
            failed_details = []
            
            for idx, product in enumerate(products):
                retry_count = 0
                max_retries = 3
                success = False
                
                while retry_count < max_retries and not success:
                    try:
                        # 构建商品数据
                        product_data = {
                            "name": product["title"],
                            "pic": product["images"][0] if product["images"] else "",
                            "description": "|".join(product["images"]),  # 商品详情图
                            "category_leaf_id": product["third_cid"],
                            "pay_type": 1,  # 在线支付
                        }
                        
                        # 添加SKU信息
                        if product["sku_list"]:
                            first_sku = product["sku_list"][0]
                            product_data["market_price"] = first_sku.get("price", 0)
                            product_data["discount_price"] = first_sku.get("price", 0)
                        
                        # 调用抖音API创建商品
                        result = await api_service.add_product(product_data)
                        
                        if result.get("err_no") == 0:
                            # 创建成功，保存到数据库
                            douyin_product_id = result.get("data", {}).get("product_id", "")
                            
                            product_info = ProductInfo(
                                shop_id=task.shop_id,
                                douyin_product_id=str(douyin_product_id),
                                title=product["title"],
                                price=product["sku_list"][0].get("price", 0) if product["sku_list"] else 0,
                                stock=sum(sku.get("stock", 0) for sku in product["sku_list"]) if product["sku_list"] else 0,
                                first_cid=product["first_cid"],
                                second_cid=product["second_cid"],
                                third_cid=product["third_cid"],
                                fourth_cid=product.get("fourth_cid"),
                                first_cname=product.get("first_cname"),
                                second_cname=product.get("second_cname"),
                                third_cname=product.get("third_cname"),
                                fourth_cname=product.get("fourth_cname"),
                                product_type=product.get("product_type", 1),
                                product_group=product.get("product_group"),
                                merchant_code=product.get("merchant_code"),
                                item_number=product.get("item_number"),
                                available_stock=product.get("available_stock"),
                                presale_stock=product.get("presale_stock"),
                                ladder_stock=json.dumps(product.get("ladder_stock")) if product.get("ladder_stock") else None,
                                images=json.dumps(product["images"]),
                                sku_list=json.dumps(product["sku_list"]),
                                delivery_time=product.get("delivery_time"),
                                sales_count=product.get("sales_count", 0),
                                commission_rate=product.get("commission_rate"),
                                audit_status=product.get("audit_status", 0),
                                product_url=product.get("product_url"),
                                product_status=publish_type,
                                source_type=1,
                                source_id=None
                            )
                            db.add(product_info)
                            
                            success_count += 1
                            success = True
                        else:
                            # 失败，记录错误
                            if retry_count == max_retries - 1:
                                failed_count += 1
                                failed_details.append({
                                    "index": idx,
                                    "title": product["title"],
                                    "reason": result.get("message", "创建失败")
                                })
                            else:
                                # 等待5秒后重试
                                await asyncio.sleep(5)
                                retry_count += 1
                    
                    except Exception as e:
                        if retry_count == max_retries - 1:
                            failed_count += 1
                            failed_details.append({
                                "index": idx,
                                "title": product.get("title", ""),
                                "reason": str(e)
                            })
                        else:
                            await asyncio.sleep(5)
                            retry_count += 1
            
            # 更新任务状态
            task.success_count = success_count
            task.failed_count = failed_count
            task.task_status = 2  # 已完成
            task.failed_detail = json.dumps(failed_details, ensure_ascii=False)
            task.end_time = datetime.now()
            db.commit()
            
        finally:
            db.close()
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        查询任务状态
        :param task_id: 任务ID
        :return: 任务状态信息
        """
        task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
        
        if not task:
            return {"success": False, "message": "任务不存在"}
        
        # 解析失败详情
        failed_list = []
        if task.failed_detail:
            try:
                failed_list = json.loads(task.failed_detail)
            except:
                pass
        
        # 任务状态映射
        status_map = {
            0: "待处理",
            1: "进行中",
            2: "已完成",
            3: "失败",
            4: "已取消"
        }
        
        return {
            "success": True,
            "total": task.total_count,
            "success_count": task.success_count,
            "failed": task.failed_count,
            "status": status_map.get(task.task_status, "未知"),
            "failed_list": failed_list,
            "start_time": task.start_time,
            "end_time": task.end_time
        }
    
    def get_task_list(
        self,
        shop_id: Optional[int] = None,
        page_no: int = 1,
        page_size: int = 20,
        task_status: Optional[int] = None,
        user_id: Optional[int] = None,
        account_type: Optional[int] = None,
        is_hidden: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取任务列表（带权限过滤）
        :param shop_id: 店铺ID，不传则查询所有店铺
        :param page_no: 页码
        :param page_size: 每页数量
        :param task_status: 任务状态筛选
        :param user_id: 用户ID
        :param account_type: 账号类型
        :param is_hidden: 是否隐藏管理员
        :return: 任务列表
        """
        from app.models.account import EmployeeShopRelation
        
        print(f"\n[任务列表查询] ========== 开始查询 ==========")
        print(f"  shop_id: {shop_id}")
        print(f"  page_no: {page_no}, page_size: {page_size}")
        print(f"  task_status: {task_status}")
        print(f"  user_id: {user_id}, account_type: {account_type}, is_hidden: {is_hidden}")
        
        # 查询任务，只查询批量上架任务（task_type=1）
        query = self.db.query(ProductTask).filter(
            ProductTask.status == 1,
            ProductTask.task_type == 1  # 只查询批量上架任务
        )
        
        # 店铺过滤逻辑（与商品列表一致）
        if shop_id is not None:
            # 指定了具体店铺
            query = query.filter(ProductTask.shop_id == shop_id)
            print(f"[任务列表查询] → 查询具体店铺: shop_id={shop_id}")
        else:
            # 未指定店铺，根据用户权限过滤
            print(f"[任务列表查询] → 查询所有店铺（需权限过滤）")
            
            if is_hidden == 1:
                # 隐藏管理员：可以看到所有店铺的任务
                print(f"[任务列表查询] ✓ 隐藏管理员，可查看所有店铺")
                pass
            elif user_id and account_type:
                # 普通用户：只能看到有权限的店铺的任务
                print(f"[任务列表查询] → 普通用户，需要过滤店铺权限")
                
                if account_type == 1:
                    # 主账号：查询自己创建的店铺的任务
                    user_shop_ids = self.db.query(ShopAuth.id).filter(
                        ShopAuth.user_id == user_id,
                        ShopAuth.status == 1
                    ).all()
                    user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                    print(f"[任务列表查询] → 主账号，有权限的店铺数: {len(user_shop_ids)}")
                else:
                    # 员工账号：查询有权限的店铺的任务
                    user_shop_ids = self.db.query(EmployeeShopRelation.shop_id).filter(
                        EmployeeShopRelation.employee_id == user_id,
                        EmployeeShopRelation.status == 1
                    ).all()
                    user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                    print(f"[任务列表查询] → 员工账号，有权限的店铺数: {len(user_shop_ids)}")
                
                if user_shop_ids:
                    query = query.filter(ProductTask.shop_id.in_(user_shop_ids))
                    print(f"[任务列表查询] ✓ 添加店铺过滤条件")
                else:
                    # 用户没有任何店铺权限，返回空列表
                    print(f"[任务列表查询] ✗ 用户没有任何店铺权限")
                    return {
                        "success": True,
                        "total": 0,
                        "total_pages": 0,
                        "list": []
                    }
        
        # 任务状态过滤
        if task_status is not None:
            query = query.filter(ProductTask.task_status == task_status)
            print(f"[任务列表查询] → 添加状态过滤: task_status={task_status}")
        
        # 计算总数
        total = query.count()
        print(f"[任务列表查询] → 查询到任务总数: {total}")
        
        # 分页查询，按创建时间倒序
        tasks = query.order_by(ProductTask.create_time.desc()).offset((page_no - 1) * page_size).limit(page_size).all()
        print(f"[任务列表查询] → 当前页任务数: {len(tasks)}")
        
        # 任务状态映射
        status_map = {
            0: "待处理",
            1: "进行中",
            2: "已完成",
            3: "失败",
            4: "已取消"
        }
        
        # 构建返回数据
        task_list = []
        for task in tasks:
            task_list.append({
                "task_id": task.task_id,
                "shop_id": task.shop_id,
                "total_count": task.total_count,
                "success_count": task.success_count,
                "failed_count": task.failed_count,
                "task_status": task.task_status,
                "status_text": status_map.get(task.task_status, "未知"),
                "progress_percent": task.progress_percent,
                "current_product_title": task.current_product_title,
                "start_time": task.start_time,
                "end_time": task.end_time,
                "create_time": task.create_time
            })
        
        total_pages = (total + page_size - 1) // page_size
        
        print(f"[任务列表查询] ========== 查询结束 ==========\n")
        
        return {
            "success": True,
            "total": total,
            "total_pages": total_pages,
            "list": task_list
        }
    
    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        """
        取消任务
        :param task_id: 任务ID
        :return: 取消结果
        """
        task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
        
        if not task:
            return {"success": False, "message": "任务不存在"}
        
        if task.task_status not in [0, 1]:
            return {"success": False, "message": "任务已完成或已取消，无法取消"}
        
        task.task_status = 4  # 已取消
        task.end_time = datetime.now()
        self.db.commit()
        
        return {"success": True, "message": "任务已取消"}
    
    async def sync_product_status(self, shop_id: int, product_ids: List[str]) -> Dict[str, Any]:
        """
        同步商品状态
        :param shop_id: 店铺ID
        :param product_ids: 商品ID列表
        :return: 同步结果
        """
        # 获取店铺授权信息
        shop = self.db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            return {"success": False, "message": "店铺不存在或已禁用"}
        
        # 调用抖音API同步状态
        api_service = DouyinAPIService(access_token=shop.access_token)
        result = await api_service.sync_product_status(product_ids)
        
        # 更新本地数据库
        sync_count = 0
        for product_result in result.get("results", []):
            if product_result.get("err_no") == 0:
                product_data = product_result.get("data", {})
                douyin_product_id = str(product_data.get("product_id", ""))
                
                # 更新本地商品状态
                product = self.db.query(ProductInfo).filter(
                    ProductInfo.douyin_product_id == douyin_product_id
                ).first()
                
                if product:
                    product.product_status = product_data.get("status", 0)
                    sync_count += 1
        
        self.db.commit()
        
        return {"success": True, "sync_count": sync_count}
    
    async def get_product_list(
        self,
        shop_id: Optional[int] = None,
        page_no: int = 1,
        page_size: int = 20,
        product_status: Optional[int] = None,
        search_text: Optional[str] = None,
        product_ids: Optional[str] = None,
        force_refresh: bool = False,  # 是否强制刷新
        user_id: Optional[int] = None,  # 用户ID（用于权限过滤）
        account_type: Optional[int] = None,  # 账号类型
        is_hidden: Optional[int] = None  # 是否隐藏管理员
    ) -> Dict[str, Any]:
        """
        获取商品列表（支持API和Playwright双模式）
        :param shop_id: 店铺ID，不传则查询所有店铺
        :param page_no: 页码
        :param page_size: 每页数量
        :param product_status: 商品状态
        :param search_text: 搜索关键词（商品标题或ID）
        :param product_ids: 批量查询商品ID，逗号分隔
        :param force_refresh: 是否强制从抖店后台刷新数据
        :param user_id: 用户ID
        :param account_type: 账号类型
        :param is_hidden: 是否隐藏管理员
        :return: 商品列表
        """
        print(f"\n{'='*60}")
        print(f"[商品列表服务] 开始处理请求")
        print(f"  shop_id: {shop_id}")
        print(f"  page_no: {page_no}, page_size: {page_size}")
        print(f"  product_status: {product_status}")
        print(f"  force_refresh: {force_refresh}")
        print(f"  user_id: {user_id}, account_type: {account_type}, is_hidden: {is_hidden}")
        
        # 如果指定了shop_id，检查店铺的授权模式
        if shop_id is not None:
            shop = self.db.query(ShopAuth).filter(
                ShopAuth.id == shop_id,
                ShopAuth.status == 1
            ).first()
            
            if not shop:
                print(f"✗ 店铺不存在或已禁用: shop_id={shop_id}")
                print(f"{'='*60}\n")
                return {
                    "success": False,
                    "message": "店铺不存在或已禁用，请刷新店铺列表"
                }
            
            print(f"✓ 找到店铺: {shop.shop_name} (ID={shop.id})")
            print(f"  授权模式: {shop.auth_mode}")
            print(f"  抖音店铺ID: {shop.douyin_shop_id}")
            
            # 检查token是否过期（API模式）
            if shop.auth_mode == 'api' and shop.expire_time:
                if shop.expire_time < datetime.now():
                    print(f"✗ Token已过期: expire_time={shop.expire_time}")
                    print(f"{'='*60}\n")
                    return {
                        "success": False,
                        "message": "店铺授权已过期，请在店铺管理中删除该店铺后重新添加"
                    }
            
            # 先检查数据库中是否有商品数据
            db_product_count = self.db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop.id,
                ProductInfo.status == 1
            ).count()
            
            print(f"  数据库商品数量: {db_product_count}")
            
            # 如果数据库中有商品且不强制刷新，直接从数据库返回
            if db_product_count > 0 and not force_refresh:
                print(f"✓ 从数据库读取商品")
                result = self._get_product_list_from_db(
                    shop_id=shop.id,
                    page_no=page_no,
                    page_size=page_size,
                    product_status=product_status,
                    search_text=search_text,
                    product_ids=product_ids,
                    user_id=user_id,
                    account_type=account_type,
                    is_hidden=is_hidden
                )
                print(f"{'='*60}\n")
                return result
            
            # Playwright模式：从抖店后台抓取
            if shop.auth_mode == 'playwright':
                print(f"→ 使用Playwright模式抓取商品...")
                
                # 如果强制刷新，同步执行并返回步骤
                if force_refresh:
                    print(f"→ 强制刷新，同步执行...")
                    try:
                        result = await self._get_product_list_playwright(
                            shop=shop,
                            page_no=page_no,
                            page_size=page_size,
                            product_status=product_status
                        )
                        print(f"{'='*60}\n")
                        return result
                    except Exception as e:
                        print(f"✗ Playwright抓取失败: {str(e)}")
                        print(f"{'='*60}\n")
                        if "登录" in str(e) or "login" in str(e).lower():
                            return {
                                "success": False,
                                "message": "Playwright登录状态已失效，请重新进行授权登录"
                            }
                        return {
                            "success": False,
                            "message": f"从抖店后台抓取商品失败: {str(e)}"
                        }
                else:
                    # 不强制刷新，直接从数据库读取
                    print(f"✓ 从数据库读取商品")
                    result = self._get_product_list_from_db(
                        shop_id=shop.id,
                        page_no=page_no,
                        page_size=page_size,
                        product_status=product_status,
                        search_text=search_text,
                        product_ids=product_ids,
                        user_id=user_id,
                        account_type=account_type,
                        is_hidden=is_hidden
                    )
                    print(f"{'='*60}\n")
                    return result
            
            # API模式：调用抖店开放平台API
            elif shop.auth_mode == 'api':
                print(f"→ 使用API模式查询商品...")
                try:
                    result = await self._get_product_list_api(
                        shop=shop,
                        page_no=page_no,
                        page_size=page_size,
                        product_status=product_status
                    )
                    print(f"{'='*60}\n")
                    return result
                except Exception as e:
                    print(f"✗ API调用失败: {str(e)}")
                    print(f"{'='*60}\n")
                    return {
                        "success": False,
                        "message": f"调用抖店API失败: {str(e)}"
                    }
        
        # 没有指定shop_id，从数据库查询所有店铺的商品（带权限过滤）
        print(f"→ 查询所有店铺的商品（带权限过滤）")
        result = self._get_product_list_from_db(
            shop_id=shop_id,
            page_no=page_no,
            page_size=page_size,
            product_status=product_status,
            search_text=search_text,
            product_ids=product_ids,
            user_id=user_id,
            account_type=account_type,
            is_hidden=is_hidden
        )
        print(f"{'='*60}\n")
        return result
    
    async def _sync_products_background(self, shop_id: int, shop: ShopAuth):
        """
        后台异步同步商品（不阻塞主请求）
        """
        # 创建新的数据库连接
        from app.core.database import SessionLocal
        db = SessionLocal()
        
        try:
            print(f"\n[后台同步] 开始同步店铺 {shop.shop_name} (ID={shop_id}) 的商品...")
            
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.playwright.product_scraper商品信息抓取器 import ProductScraper
            
            browser_manager = BrowserManager()
            
            # 检查登录状态
            if not browser_manager.account_manager.has_state(shop.playwright_account_id):
                print(f"[后台同步] ✗ 未找到登录状态")
                return
            
            # 启动浏览器
            await browser_manager.launch_browser(headless=True)
            context = await browser_manager.create_context(account_id=shop.playwright_account_id)
            
            # 访问商品列表页面并触发导出
            page = await context.new_page()
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # 访问商品列表页
            await page.goto("https://fxg.jinritemai.com/ffa/g/list", wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # 点击"全部"标签
            try:
                await page.click('text=全部', timeout=10000)
                await asyncio.sleep(2)
            except:
                pass
            
            # 点击"导出查询商品"
            try:
                await page.click('text=导出查询商品', timeout=10000)
                await asyncio.sleep(2)
            except:
                pass
            
            # 点击抽屉中的"导出"确认按钮
            try:
                await page.click('.ecom-g-drawer-footer button.ecom-g-btn-primary:has-text("导出")', timeout=10000)
                await asyncio.sleep(2)
            except:
                pass
            
            await page.close()
            
            # 下载Excel文件（无超时限制）
            download_result = await ProductScraper.download_product_excel(context)
            
            if download_result.get("success"):
                # 解析Excel
                filepath = download_result.get("filepath")
                products = ProductScraper.parse_product_excel(filepath)
                
                # 保存到数据库
                saved_count = 0
                updated_count = 0
                
                for product in products:
                    try:
                        existing = db.query(ProductInfo).filter(
                            ProductInfo.shop_id == shop_id,
                            ProductInfo.douyin_product_id == product["product_id"]
                        ).first()
                        
                        if existing:
                            # 更新
                            existing.title = product["title"]
                            existing.price = product["price"]
                            existing.stock = product["stock"]
                            existing.available_stock = product["available_stock"]
                            existing.presale_stock = product["presale_stock"]
                            existing.merchant_code = product["merchant_code"]
                            existing.item_number = product["item_number"]
                            existing.first_cid = product.get("first_cid", "0")
                            existing.second_cid = product.get("second_cid", "0")
                            existing.third_cid = product.get("third_cid", "0")
                            existing.fourth_cid = product.get("fourth_cid")
                            existing.first_cname = product["first_cname"]
                            existing.second_cname = product["second_cname"]
                            existing.third_cname = product["third_cname"]
                            existing.fourth_cname = product["fourth_cname"]
                            existing.product_type = product["product_type"]
                            existing.product_group = product["product_group"]
                            existing.delivery_time = product["delivery_time"]
                            existing.sales_count = product["sales_count"]
                            existing.commission_rate = product["commission_rate"]
                            existing.audit_status = product["audit_status"]
                            existing.product_url = product["product_url"]
                            existing.product_status = product["product_status"]
                            existing.sku_list = json.dumps(product["sku_list"], ensure_ascii=False)
                            existing.update_time = datetime.now()
                            updated_count += 1
                        else:
                            # 新增
                            new_product = ProductInfo(
                                shop_id=shop_id,
                                douyin_product_id=product["product_id"],
                                title=product["title"],
                                price=product["price"],
                                stock=product["stock"],
                                available_stock=product["available_stock"],
                                presale_stock=product["presale_stock"],
                                merchant_code=product["merchant_code"],
                                item_number=product["item_number"],
                                first_cid=product.get("first_cid", "0"),
                                second_cid=product.get("second_cid", "0"),
                                third_cid=product.get("third_cid", "0"),
                                fourth_cid=product.get("fourth_cid"),
                                first_cname=product["first_cname"],
                                second_cname=product["second_cname"],
                                third_cname=product["third_cname"],
                                fourth_cname=product["fourth_cname"],
                                product_type=product["product_type"],
                                product_group=product["product_group"],
                                delivery_time=product["delivery_time"],
                                sales_count=product["sales_count"],
                                commission_rate=product["commission_rate"],
                                audit_status=product["audit_status"],
                                product_url=product["product_url"],
                                product_status=product["product_status"],
                                sku_list=json.dumps(product["sku_list"], ensure_ascii=False),
                                images=json.dumps(product["images"], ensure_ascii=False),
                                source_type=2,
                                ladder_stock=product["ladder_stock"]
                            )
                            db.add(new_product)
                            saved_count += 1
                        
                        db.commit()
                    except Exception as e:
                        print(f"[后台同步] ⚠ 保存商品失败: {str(e)}")
                        db.rollback()
                        continue
                
                print(f"[后台同步] ✓ 同步完成: 新增 {saved_count} 个, 更新 {updated_count} 个")
            
            # 清理资源
            await context.close()
            await browser_manager.stop()
            
        except Exception as e:
            print(f"[后台同步] ✗ 同步失败: {str(e)}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()
    
    async def _get_product_list_playwright(
        self,
        shop: ShopAuth,
        page_no: int,
        page_size: int,
        product_status: Optional[int]
    ) -> Dict[str, Any]:
        """使用Playwright模式获取商品列表"""
        steps = []  # 记录每一步的执行情况
        
        def add_step(step_name: str, status: str, message: str = "", details: str = ""):
            """添加步骤记录"""
            step = {
                "step": step_name,
                "status": status,  # success/failed/warning
                "message": message,
                "details": details,
                "timestamp": datetime.now().isoformat()
            }
            steps.append(step)
            print(f"[步骤] {step_name}: {status} - {message}")
            if details:
                print(f"  详情: {details}")
        
        try:
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.playwright.product_scraper商品信息抓取器 import ProductScraper
            
            add_step("初始化", "success", "开始商品同步流程", 
                    f"店铺: {shop.shop_name}, 账号ID: {shop.playwright_account_id}")
            
            print(f"[Playwright] 店铺信息:")
            print(f"  店铺ID(数据库): {shop.id}")
            print(f"  店铺ID(抖店): {shop.douyin_shop_id}")
            print(f"  店铺名称: {shop.shop_name}")
            print(f"  Playwright账号ID: {shop.playwright_account_id}")
            
            browser_manager = BrowserManager()
            
            # 步骤1: 检查登录状态文件
            add_step("检查登录状态", "success", "正在检查登录状态文件...")
            if not browser_manager.account_manager.has_state(shop.playwright_account_id):
                add_step("检查登录状态", "failed", "未找到登录状态文件", 
                        f"账号ID: {shop.playwright_account_id}, 请重新进行Playwright登录")
                return {
                    "success": False,
                    "message": f"未找到账号 {shop.playwright_account_id} 的登录状态，请重新登录",
                    "steps": steps
                }
            
            add_step("检查登录状态", "success", "找到登录状态文件", 
                    f"状态文件路径: ../states/account_{shop.playwright_account_id}/state.json (项目根目录)")
            
            # 步骤2: 启动浏览器
            add_step("启动浏览器", "success", "正在启动Chromium浏览器...")
            await browser_manager.launch_browser(headless=True)
            add_step("启动浏览器", "success", "浏览器启动成功", "无头模式: True")
            
            # 步骤3: 加载登录状态
            add_step("加载登录状态", "success", "正在加载Cookie和存储状态...")
            context = await browser_manager.create_context(
                account_id=shop.playwright_account_id
            )
            add_step("加载登录状态", "success", "登录状态加载成功", "Cookie已注入到浏览器上下文")
            
            # 第3.1步：先进入商品列表页面
            print(f"\n[商品同步] 第3.1步：进入商品列表页面...")
            add_step("访问商品列表页", "success", "正在访问商品列表页面...", 
                    "URL: https://fxg.jinritemai.com/ffa/g/list")
            
            page = await context.new_page()
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # 访问商品列表页面
            product_list_url = "https://fxg.jinritemai.com/ffa/g/list"
            try:
                await page.goto(product_list_url, wait_until="domcontentloaded", timeout=60000)
                await asyncio.sleep(3)
            except Exception as e:
                add_step("访问商品列表页", "failed", "页面加载超时", str(e))
                await page.close()
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": f"访问商品列表页面超时: {str(e)}",
                    "steps": steps
                }
            
            # 检查是否成功进入（支持重试）
            current_url = page.url
            print(f"[调试] 访问商品列表页后的URL: {current_url}")
            
            max_retries = 2  # 最多重试2次
            retry_count = 0
            
            while "/login" in current_url and retry_count < max_retries:
                retry_count += 1
                add_step("访问商品列表页", "warning", f"被重定向到登录页，尝试重新加载Cookie (第{retry_count}次重试)", 
                        f"当前URL: {current_url}")
                
                # 关闭当前页面和上下文
                await page.close()
                await context.close()
                
                # 等待一下
                await asyncio.sleep(2)
                
                # 重新创建上下文并加载Cookie
                add_step("重新加载Cookie", "success", f"正在重新加载登录状态 (第{retry_count}次)", 
                        f"重新从 ../states/account_{shop.playwright_account_id}/state.json 加载 (项目根目录)")
                
                context = await browser_manager.create_context(
                    account_id=shop.playwright_account_id
                )
                
                # 创建新页面
                page = await context.new_page()
                await page.set_viewport_size({"width": 1920, "height": 1080})
                
                # 再次访问商品列表页
                add_step("重新访问商品列表页", "success", f"正在重新访问商品列表页 (第{retry_count}次)")
                await page.goto(product_list_url, wait_until="domcontentloaded", timeout=60000)
                await asyncio.sleep(3)
                
                current_url = page.url
                print(f"[调试] 重试后的URL: {current_url}")
            
            # 最终检查
            if "/login" in current_url:
                add_step("访问商品列表页", "failed", f"重试{max_retries}次后仍被重定向到登录页", 
                        f"当前URL: {current_url}, Cookie已失效，请重新登录店铺")
                await page.close()
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": f"登录状态已过期（已重试{max_retries}次），请在店铺管理中重新登录",
                    "steps": steps
                }
            
            add_step("访问商品列表页", "success", "成功进入商品列表页面", 
                    f"当前URL: {current_url}")

            
            # 第3.2步：点击"全部"标签
            print(f"[商品同步] 第3.2步：点击'全部'标签...")
            add_step("点击全部标签", "success", "正在查找并点击'全部'标签...")
            
            try:
                # 等待标签页容器加载
                await page.wait_for_selector('.ecom-g-tabs-nav-list', timeout=10000)
                add_step("点击全部标签", "success", "标签容器已加载", "找到 .ecom-g-tabs-nav-list 元素")
                
                # 定位"全部"按钮
                selectors = [
                    '#rc-tabs-0-tab-all',  # 通过ID
                    'text=全部',  # 通过文本
                    '[role="tab"]:has-text("全部")',  # 通过role和文本
                ]
                
                clicked = False
                for selector in selectors:
                    try:
                        element = await page.wait_for_selector(selector, timeout=5000)
                        if element and await element.is_visible():
                            await element.click()
                            print(f"✓ 成功点击'全部'标签")
                            add_step("点击全部标签", "success", "成功点击'全部'标签", 
                                    f"使用选择器: {selector}")
                            await asyncio.sleep(2)
                            clicked = True
                            break
                    except Exception as e:
                        add_step("点击全部标签", "warning", f"选择器 {selector} 未找到", str(e))
                        continue
                
                if not clicked:
                    add_step("点击全部标签", "warning", "未能点击'全部'标签，继续执行", 
                            "可能页面结构已变化或默认就在'全部'标签")
                    
            except Exception as e:
                add_step("点击全部标签", "warning", "点击'全部'标签失败，继续执行", str(e))
            
            # 第3.3步：点击"导出查询商品"按钮
            print(f"[商品同步] 第3.3步：点击'导出查询商品'按钮...")
            add_step("点击导出按钮", "success", "正在查找并点击'导出查询商品'按钮...")
            
            try:
                # 等待页面稳定
                await asyncio.sleep(3)
                
                # 先尝试查找按钮，如果找不到就打印页面上所有按钮
                export_clicked = await page.evaluate('''() => {
                    const btn = document.querySelector('#exportSearchedGoods');
                    if (btn) {
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        btn.click();
                        return true;
                    }
                    
                    // 如果找不到，返回页面上所有包含"导出"的按钮信息
                    const allButtons = Array.from(document.querySelectorAll('button, a'));
                    const exportButtons = allButtons
                        .filter(btn => btn.textContent.includes('导出'))
                        .map(btn => ({
                            text: btn.textContent.trim(),
                            id: btn.id,
                            className: btn.className,
                            tagName: btn.tagName
                        }));
                    
                    return { found: false, buttons: exportButtons };
                }''')
                
                if export_clicked == True:
                    print(f"✓ 成功点击'导出查询商品'按钮")
                    add_step("点击导出按钮", "success", "成功点击'导出查询商品'按钮", "使用JavaScript直接点击")
                    await asyncio.sleep(2)
                elif isinstance(export_clicked, dict) and not export_clicked.get('found'):
                    # 打印找到的按钮信息
                    buttons_info = export_clicked.get('buttons', [])
                    print(f"⚠ 未找到 #exportSearchedGoods 按钮")
                    print(f"  页面上包含'导出'的按钮: {buttons_info}")
                    
                    add_step("点击导出按钮", "failed", "未找到'导出查询商品'按钮", 
                            f"按钮ID #exportSearchedGoods 不存在\n页面上的导出按钮: {buttons_info}")
                    await page.close()
                    await context.close()
                    await browser_manager.stop()
                    return {
                        "success": False,
                        "message": f"未找到'导出查询商品'按钮，页面可能已改版。找到的按钮: {buttons_info}",
                        "steps": steps
                    }
                else:
                    add_step("点击导出按钮", "failed", "未找到'导出查询商品'按钮", "按钮ID #exportSearchedGoods 不存在")
                    await page.close()
                    await context.close()
                    await browser_manager.stop()
                    return {
                        "success": False,
                        "message": "未找到'导出查询商品'按钮，页面可能已改版",
                        "steps": steps
                    }
                    
            except Exception as e:
                add_step("点击导出按钮", "failed", "点击'导出查询商品'按钮失败", str(e))
                await page.close()
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": f"点击导出按钮失败: {str(e)}",
                    "steps": steps
                }
            
            # 第3.4步：点击抽屉中的"导出"确认按钮
            print(f"[商品同步] 第3.4步：点击抽屉中的'导出'确认按钮...")
            add_step("点击确认导出", "success", "正在查找并点击抽屉中的'导出'确认按钮...")
            
            try:
                # 等待抽屉出现
                await page.wait_for_selector('.ecom-g-drawer-footer', timeout=10000)
                print(f"✓ 抽屉已弹出")
                add_step("点击确认导出", "success", "导出抽屉已弹出", "找到 .ecom-g-drawer-footer 元素")
                await asyncio.sleep(1)
                
                # 定位"导出"确认按钮
                confirm_selectors = [
                    '.ecom-g-drawer-footer button.ecom-g-btn-primary:has-text("导出")',  # 抽屉footer中的primary按钮
                    'button span[data-btm="d414745"]:has-text("导出")',  # 通过data-btm属性
                    '.ecom-g-drawer-footer .ecom-g-btn-primary',  # 抽屉footer中的primary按钮
                ]
                
                confirm_clicked = False
                for selector in confirm_selectors:
                    try:
                        element = await page.wait_for_selector(selector, timeout=5000)
                        if element and await element.is_visible():
                            # 如果是span，点击父元素button
                            if 'span' in selector:
                                button = await element.evaluate_handle('el => el.closest("button")')
                                await button.as_element().click()
                            else:
                                await element.click()
                            print(f"✓ 成功点击'导出'确认按钮")
                            add_step("点击确认导出", "success", "成功点击'导出'确认按钮", 
                                    f"使用选择器: {selector}")
                            await asyncio.sleep(2)
                            confirm_clicked = True
                            break
                    except Exception as e:
                        add_step("点击确认导出", "warning", f"选择器 {selector} 未找到", str(e))
                        continue
                
                if not confirm_clicked:
                    add_step("点击确认导出", "failed", "未能点击'导出'确认按钮", 
                            "所有选择器都未找到")
                    await page.close()
                    await context.close()
                    await browser_manager.stop()
                    return {
                        "success": False,
                        "message": "未找到'导出'确认按钮",
                        "steps": steps
                    }
                    
            except Exception as e:
                add_step("点击确认导出", "failed", "点击'导出'确认按钮失败", str(e))
                await page.close()
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": f"点击确认按钮失败: {str(e)}",
                    "steps": steps
                }
            
            # 关闭这个页面，因为download_product_excel会创建新页面
            await page.close()
            
            # 第4步：下载商品Excel文件
            add_step("下载Excel文件", "success", "正在下载商品Excel文件...", 
                    "等待导出任务完成并下载文件")
            
            download_result = await ProductScraper.download_product_excel(context)
            
            if not download_result.get("success"):
                add_step("下载Excel文件", "failed", "下载失败", 
                        download_result.get("message", "未知错误"))
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": download_result.get("message", "下载Excel失败"),
                    "steps": steps
                }
            
            add_step("下载Excel文件", "success", "Excel文件下载成功", 
                    f"文件路径: {download_result.get('filepath')}")
            
            # 解析Excel文件
            add_step("解析Excel文件", "success", "正在解析Excel文件...")
            filepath = download_result.get("filepath")
            products = ProductScraper.parse_product_excel(filepath)
            
            if not products:
                add_step("解析Excel文件", "failed", "Excel文件解析失败或无商品数据", 
                        f"文件路径: {filepath}")
                await context.close()
                await browser_manager.stop()
                return {
                    "success": False,
                    "message": "Excel文件解析失败或无商品数据",
                    "steps": steps
                }
            
            add_step("解析Excel文件", "success", f"成功解析 {len(products)} 个商品", 
                    f"文件路径: {filepath}")
            
            # 保存商品到数据库
            add_step("保存到数据库", "success", f"正在保存 {len(products)} 个商品到数据库...")
            print(f"\n[商品同步] 开始同步 {len(products)} 个商品到数据库...")
            saved_count = 0
            updated_count = 0
            
            for product in products:
                try:
                    # 检查商品是否已存在
                    existing = self.db.query(ProductInfo).filter(
                        ProductInfo.shop_id == shop.id,
                        ProductInfo.douyin_product_id == product["product_id"]
                    ).first()
                    
                    if existing:
                        # 更新现有商品
                        existing.title = product["title"]
                        existing.price = product["price"]
                        existing.stock = product["stock"]
                        existing.available_stock = product["available_stock"]
                        existing.presale_stock = product["presale_stock"]
                        existing.merchant_code = product["merchant_code"]
                        existing.item_number = product["item_number"]
                        existing.first_cid = product.get("first_cid", "0")
                        existing.second_cid = product.get("second_cid", "0")
                        existing.third_cid = product.get("third_cid", "0")
                        existing.fourth_cid = product.get("fourth_cid")
                        existing.first_cname = product["first_cname"]
                        existing.second_cname = product["second_cname"]
                        existing.third_cname = product["third_cname"]
                        existing.fourth_cname = product["fourth_cname"]
                        existing.product_type = product["product_type"]
                        existing.product_group = product["product_group"]
                        existing.delivery_time = product["delivery_time"]
                        existing.sales_count = product["sales_count"]
                        existing.commission_rate = product["commission_rate"]
                        existing.audit_status = product["audit_status"]
                        existing.product_url = product["product_url"]
                        existing.product_status = product["product_status"]  # ⭐ 更新商品状态
                        existing.sku_list = json.dumps(product["sku_list"], ensure_ascii=False)
                        existing.update_time = datetime.now()
                        updated_count += 1
                    else:
                        # 创建新商品
                        new_product = ProductInfo(
                            shop_id=shop.id,
                            douyin_product_id=product["product_id"],
                            title=product["title"],
                            price=product["price"],
                            stock=product["stock"],
                            available_stock=product["available_stock"],
                            presale_stock=product["presale_stock"],
                            merchant_code=product["merchant_code"],
                            item_number=product["item_number"],
                            first_cid=product.get("first_cid", "0"),
                            second_cid=product.get("second_cid", "0"),
                            third_cid=product.get("third_cid", "0"),
                            fourth_cid=product.get("fourth_cid"),
                            first_cname=product["first_cname"],
                            second_cname=product["second_cname"],
                            third_cname=product["third_cname"],
                            fourth_cname=product["fourth_cname"],
                            product_type=product["product_type"],
                            product_group=product["product_group"],
                            delivery_time=product["delivery_time"],
                            sales_count=product["sales_count"],
                            commission_rate=product["commission_rate"],
                            audit_status=product["audit_status"],
                            product_url=product["product_url"],
                            product_status=product["product_status"],
                            sku_list=json.dumps(product["sku_list"], ensure_ascii=False),
                            images=json.dumps(product["images"], ensure_ascii=False),
                            source_type=2,  # 2表示从Excel导入
                            ladder_stock=product["ladder_stock"]
                        )
                        self.db.add(new_product)
                        saved_count += 1
                    
                    # 每个商品单独提交，避免批量提交时出错
                    self.db.commit()
                    
                except Exception as e:
                    print(f"⚠ 保存商品 {product.get('product_id')} 失败: {str(e)}")
                    # 回滚当前事务
                    self.db.rollback()
                    continue
            
            print(f"✓ 商品同步完成: 新增 {saved_count} 个, 更新 {updated_count} 个")
            add_step("保存到数据库", "success", f"商品保存完成", 
                    f"新增 {saved_count} 个, 更新 {updated_count} 个")
            
            # 清理资源
            await context.close()
            await browser_manager.stop()
            
            add_step("完成", "success", "商品同步流程全部完成", 
                    f"总计: {len(products)} 个商品")
            
            # 从数据库查询返回分页数据
            result = self._get_product_list_from_db(
                shop_id=shop.id,
                page_no=page_no,
                page_size=page_size,
                product_status=product_status,
                search_text=None,  # Playwright抓取后不使用搜索
                product_ids=None   # Playwright抓取后不使用批量ID
            )
            
            # 添加步骤信息到返回结果
            result["steps"] = steps
            result["sync_summary"] = {
                "total": len(products),
                "new": saved_count,
                "updated": updated_count
            }
            
            return result
            
        except Exception as e:
            print(f"✗ Playwright模式获取商品失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            add_step("异常", "failed", "发生未预期的错误", str(e))
            
            return {
                "success": False,
                "message": f"获取商品失败: {str(e)}",
                "steps": steps
            }
    
    async def _get_product_list_api(
        self,
        shop: ShopAuth,
        page_no: int,
        page_size: int,
        product_status: Optional[int]
    ) -> Dict[str, Any]:
        """使用API模式获取商品列表"""
        try:
            # 检查token是否过期
            if shop.expire_time and shop.expire_time < datetime.now():
                return {
                    "success": False,
                    "message": "店铺授权已过期，请重新授权"
                }
            
            # 调用抖店开放平台API
            api_service = DouyinAPIService(access_token=shop.access_token)
            result = await api_service.get_product_list(
                page=page_no - 1,  # API从0开始
                size=page_size,
                status=product_status
            )
            
            if result.get("err_no") == 0:
                data = result.get("data", {})
                products = data.get("list", [])
                
                # 转换数据格式
                product_list = []
                for item in products:
                    product_list.append({
                        "product_id": str(item.get("product_id", "")),
                        "title": item.get("name", ""),
                        "price": float(item.get("price", 0)) / 100,  # 分转元
                        "stock": item.get("stock_num", 0),
                        "product_status": item.get("status", 0),
                        "shop_id": shop.id,
                        "create_time": item.get("create_time", "")
                    })
                
                total = data.get("total", len(product_list))
                total_pages = (total + page_size - 1) // page_size
                
                return {
                    "success": True,
                    "total": total,
                    "total_pages": total_pages,
                    "list": product_list
                }
            else:
                return {
                    "success": False,
                    "message": result.get("err_msg", "API调用失败")
                }
                
        except Exception as e:
            print(f"✗ API模式获取商品失败: {str(e)}")
            return {
                "success": False,
                "message": f"获取商品失败: {str(e)}"
            }
    
    def _get_product_list_from_db(
        self,
        shop_id: Optional[int],
        page_no: int,
        page_size: int,
        product_status: Optional[int],
        search_text: Optional[str] = None,
        product_ids: Optional[str] = None,
        user_id: Optional[int] = None,
        account_type: Optional[int] = None,
        is_hidden: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        从数据库查询商品列表（带权限过滤）
        """
        from app.models.account import EmployeeShopRelation
        
        print(f"\n[数据库查询] ========== 开始查询 ==========")
        print(f"[数据库查询] 参数:")
        print(f"  shop_id: {shop_id}")
        print(f"  page_no: {page_no}, page_size: {page_size}")
        print(f"  product_status: {product_status}")
        print(f"  user_id: {user_id}")
        print(f"  account_type: {account_type}")
        print(f"  is_hidden: {is_hidden}")
        
        query = self.db.query(ProductInfo).filter(
            ProductInfo.status == 1
        )
        
        # 严格的店铺过滤逻辑
        if shop_id is not None:
            # 指定了具体店铺，只查询该店铺的商品
            query = query.filter(ProductInfo.shop_id == shop_id)
            print(f"[数据库查询] → 查询具体店铺: shop_id={shop_id}")
        else:
            # 未指定店铺，根据用户权限过滤
            print(f"[数据库查询] → 查询所有店铺（需权限过滤）")
            
            if is_hidden == 1:
                # 隐藏管理员：可以看到所有店铺的商品
                print(f"[数据库查询] ✓ 隐藏管理员，可查看所有店铺")
                # 不添加任何过滤条件
                pass
            elif user_id and account_type:
                # 普通用户：只能看到有权限的店铺的商品
                print(f"[数据库查询] → 普通用户，需要过滤店铺权限")
                
                if account_type == 1:
                    # 主账号：查询自己创建的店铺的商品
                    user_shop_ids = self.db.query(ShopAuth.id).filter(
                        ShopAuth.user_id == user_id,
                        ShopAuth.status == 1
                    ).all()
                    user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                    print(f"[数据库查询] → 主账号，有权限的店铺数: {len(user_shop_ids)}")
                    print(f"[数据库查询]   店铺ID列表: {user_shop_ids}")
                else:
                    # 员工账号：查询有权限的店铺的商品
                    user_shop_ids = self.db.query(EmployeeShopRelation.shop_id).filter(
                        EmployeeShopRelation.employee_id == user_id,
                        EmployeeShopRelation.status == 1
                    ).all()
                    user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                    print(f"[数据库查询] → 员工账号，有权限的店铺数: {len(user_shop_ids)}")
                    print(f"[数据库查询]   店铺ID列表: {user_shop_ids}")
                
                if user_shop_ids:
                    query = query.filter(ProductInfo.shop_id.in_(user_shop_ids))
                    print(f"[数据库查询] ✓ 添加店铺过滤条件")
                else:
                    # 用户没有任何店铺权限，返回空列表
                    print(f"[数据库查询] ✗ 用户没有任何店铺权限")
                    print(f"[数据库查询] ========== 查询结束（无权限） ==========\n")
                    return {
                        "success": True,
                        "total": 0,
                        "total_pages": 0,
                        "list": []
                    }
            else:
                print(f"[数据库查询] ⚠ 警告：user_id或account_type为空")
        
        # 商品状态过滤
        if product_status is not None:
            query = query.filter(ProductInfo.product_status == product_status)
            print(f"[数据库查询] → 添加状态过滤: product_status={product_status}")
        
        # 批量查询指定ID的商品（优先级最高）
        if product_ids:
            # 解析商品ID列表（支持逗号、空格、换行分隔）
            id_list = re.split(r'[,\s\n]+', product_ids.strip())
            id_list = [pid.strip() for pid in id_list if pid.strip()]
            
            if id_list:
                query = query.filter(ProductInfo.douyin_product_id.in_(id_list))
                print(f"[数据库查询] → 批量查询 {len(id_list)} 个商品ID")
        
        # 搜索关键词（标题或ID模糊匹配）
        elif search_text:
            search_pattern = f"%{search_text}%"
            query = query.filter(
                (ProductInfo.title.like(search_pattern)) | 
                (ProductInfo.douyin_product_id.like(search_pattern))
            )
            print(f"[数据库查询] → 搜索关键词: {search_text}")
        
        # 计算总数
        total = query.count()
        print(f"[数据库查询] → 查询到商品总数: {total}")
        
        # 分页查询
        products = query.offset((page_no - 1) * page_size).limit(page_size).all()
        print(f"[数据库查询] → 当前页商品数: {len(products)}")
        
        # 构建返回数据
        product_list = []
        for product in products:
            product_list.append({
                "id": product.id,
                "product_id": product.douyin_product_id,
                "title": product.title,
                "price": product.price,
                "stock": product.stock,
                "available_stock": product.available_stock,
                "presale_stock": product.presale_stock,
                "merchant_code": product.merchant_code,
                "item_number": product.item_number,
                "first_cid": product.first_cid,
                "second_cid": product.second_cid,
                "third_cid": product.third_cid,
                "fourth_cid": product.fourth_cid,
                "first_cname": product.first_cname,
                "second_cname": product.second_cname,
                "third_cname": product.third_cname,
                "fourth_cname": product.fourth_cname,
                "product_type": product.product_type,
                "product_group": product.product_group,
                "delivery_time": product.delivery_time,
                "sales_count": product.sales_count,
                "commission_rate": float(product.commission_rate) if product.commission_rate else None,
                "audit_status": product.audit_status,
                "product_url": product.product_url,
                "product_status": product.product_status,
                "shop_id": product.shop_id,
                "create_time": product.create_time.strftime("%Y-%m-%d %H:%M:%S") if product.create_time else None
            })
        
        # 计算总页数
        total_pages = (total + page_size - 1) // page_size
        
        print(f"[数据库查询] ✓ 查询完成")
        print(f"[数据库查询]   总数: {total}")
        print(f"[数据库查询]   总页数: {total_pages}")
        print(f"[数据库查询]   当前页: {page_no}")
        print(f"[数据库查询]   返回商品数: {len(product_list)}")
        print(f"[数据库查询] ========== 查询结束 ==========\n")
        
        return {
            "success": True,
            "total": total,
            "total_pages": total_pages,
            "list": product_list
        }

    async def create_product_playwright(
        self,
        shop_id: int,
        product_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        使用Playwright模式创建单个商品
        :param shop_id: 店铺ID
        :param product_data: 商品数据（title, images, price, stock等）
        :return: 创建结果
        """
        # 获取店铺授权信息
        shop = self.db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            return {"success": False, "message": "店铺不存在或已禁用"}
        
        if shop.auth_mode != 'playwright':
            return {"success": False, "message": "该店铺未启用Playwright模式"}
        
        try:
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.playwright.product_creator商品创建发布 import ProductCreator
            
            print(f"\n[商品创建] 使用Playwright模式创建商品...")
            print(f"  店铺ID: {shop.id}")
            print(f"  店铺名称: {shop.shop_name}")
            print(f"  Playwright账号ID: {shop.playwright_account_id}")
            
            browser_manager = BrowserManager()
            
            # 检查是否有保存的状态
            if not browser_manager.account_manager.has_state(shop.playwright_account_id):
                return {
                    "success": False,
                    "message": f"未找到账号 {shop.playwright_account_id} 的登录状态，请重新登录"
                }
            
            print(f"✓ 找到保存的登录状态")
            
            # 启动浏览器
            await browser_manager.launch_browser(headless=True)
            
            # 加载已保存的登录状态
            context = await browser_manager.create_context(
                account_id=shop.playwright_account_id
            )
            
            # 创建商品
            result = await ProductCreator.create_product(context, product_data)
            
            # 清理资源
            await context.close()
            await browser_manager.stop()
            
            return result
            
        except Exception as e:
            print(f"✗ Playwright模式创建商品失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"创建商品失败: {str(e)}"
            }
