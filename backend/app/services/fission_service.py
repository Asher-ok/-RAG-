"""
商品裂变业务服务 - 统一调度层
根据店铺授权模式自动选择API或Playwright方式
"""
from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.product import ProductInfo
from app.models.shop import ShopAuth
from app.services.fission_api import FissionAPI
from app.services.fission_playwright import FissionPlaywright


class FissionService:
    """裂变服务统一调度类"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_fission_task_only(
        self,
        shop_id: int,
        source_product_id: str,
        count: int,
        price_float_amount: float = 0,
        title_suffix: str = None,
        title_replacements: list = None,
        publish_mode: int = 2
    ) -> Dict[str, Any]:
        """
        只创建裂变任务记录，不执行（由前端执行）
        
        Args:
            shop_id: 店铺ID
            source_product_id: 原商品ID
            count: 裂变数量
            price_float_amount: 价格浮动金额（元）
            title_suffix: 标题后缀
            title_replacements: 标题替换列表
            publish_mode: 发布模式 1草稿/2上架
            
        Returns:
            创建结果（包含task_id和source_product信息）
        """
        try:
            import uuid
            from app.models.product import ProductTask, FissionRecord
            
            # 1. 获取店铺信息
            shop = self.db.query(ShopAuth).filter(
                ShopAuth.id == shop_id,
                ShopAuth.status == 1
            ).first()
            
            if not shop:
                return {
                    "success": False,
                    "message": "店铺不存在或已禁用"
                }
            
            # 2. 获取原商品信息
            print(f"[裂变服务] 查询商品: shop_id={shop_id}, douyin_product_id={source_product_id}")
            source_product = self.db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop_id,
                ProductInfo.douyin_product_id == source_product_id,
                ProductInfo.status == 1
            ).first()
            
            if not source_product:
                print(f"[裂变服务] ✗ 商品不存在或已禁用")
                # 尝试不加 status 条件查询
                source_product_any = self.db.query(ProductInfo).filter(
                    ProductInfo.shop_id == shop_id,
                    ProductInfo.douyin_product_id == source_product_id
                ).first()
                if source_product_any:
                    print(f"[裂变服务] 找到商品但status={source_product_any.status}")
                else:
                    print(f"[裂变服务] 完全找不到该商品")
                
                return {
                    "success": False,
                    "message": "原商品不存在"
                }
            
            print(f"[裂变服务] ✓ 找到商品: {source_product.title}")
            
            # 3. 创建任务记录
            task_id = f"FISSION_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            task = ProductTask(
                task_id=task_id,
                shop_id=shop_id,
                task_type=2,  # 裂变任务
                total_count=count,
                success_count=0,
                failed_count=0,
                current_index=0,
                current_product_title="",
                task_status=0,  # 待处理
                progress_percent=0,
                start_time=None,
                end_time=None
            )
            self.db.add(task)
            
            # 4. 创建裂变记录
            import json
            fission_record = FissionRecord(
                task_id=task_id,
                shop_id=shop_id,
                source_product_id=source_product_id,
                source_product_title=source_product.title,
                fission_count=count,
                price_range=price_float_amount,
                title_suffix=title_suffix or "",
                title_replacements=json.dumps(title_replacements, ensure_ascii=False) if title_replacements else None,
                publish_mode=publish_mode
            )
            self.db.add(fission_record)
            self.db.commit()
            
            print(f"[裂变服务] 任务已创建: {task_id}")
            
            # 获取店铺名称和抖店ID
            shop_name = shop.shop_name if shop else ""
            douyin_shop_id = shop.douyin_shop_id if shop else None
            
            # 5. 返回任务ID和商品信息（给前端执行用）
            return {
                "success": True,
                "message": "裂变任务已创建",
                "task_id": task_id,
                "source_product": {
                    "product_id": source_product.id,
                    "douyin_product_id": source_product.douyin_product_id,
                    "shop_id": source_product.shop_id,
                    "douyin_shop_id": douyin_shop_id,  # ✅ 添加抖店店铺ID
                    "shop_name": shop_name,  # 从 shop 对象获取
                    "title": source_product.title,
                    "images": source_product.images,
                    "price": source_product.price,
                    "sku_list": source_product.sku_list
                }
            }
        
        except Exception as e:
            print(f"✗ 创建裂变任务失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"创建裂变任务失败: {str(e)}"
            }
    
    def update_task_progress(
        self,
        task_id: str,
        current_index: int,
        current_product_title: str,
        success_count: int,
        failed_count: int,
        progress_percent: int
    ) -> Dict[str, Any]:
        """
        更新任务进度（前端上报）
        """
        try:
            from app.models.product import ProductTask
            
            task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            
            if not task:
                return {
                    "success": False,
                    "message": "任务不存在"
                }
            
            # 更新进度（只允许进度向前更新，防止乱序请求覆盖新数据）
            task.task_status = 1  # 进行中
            # task.current_index = current_index
            # task.current_product_title = current_product_title
            # task.success_count = success_count
            # task.failed_count = failed_count
            # task.progress_percent = progress_percent
            # 如果上报的索引比数据库中的小，说明是乱序请求，不要覆盖核心计数
            if current_index >= task.current_index:  # current_index是当前处理的商品索引，task.current_index是数据库中的索引
                task.current_index = current_index
                task.current_product_title = current_product_title
                task.success_count = max(success_count, task.success_count)
                task.failed_count = max(failed_count, task.failed_count)
                task.progress_percent = max(progress_percent, task.progress_percent)
            
            if not task.start_time:
                task.start_time = datetime.now()
            
            self.db.commit()
            
            return {
                "success": True,
                "message": "进度更新成功"
            }
        
        except Exception as e:
            print(f"✗ 更新任务进度失败: {str(e)}")
            return {
                "success": False,
                "message": f"更新任务进度失败: {str(e)}"
            }
    
    def complete_task(
        self,
        task_id: str,
        success_count: int,
        failed_count: int,
        failed_details: list = None
    ) -> Dict[str, Any]:
        """
        完成任务（前端上报最终结果）
        """
        try:
            import json
            from app.models.product import ProductTask
            
            task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            
            if not task:
                return {
                    "success": False,
                    "message": "任务不存在"
                }
            
            # ✅ 如果任务已经是"已取消"状态（4），不要覆盖它
            if task.task_status == 4:
                # 只更新计数和详情，不改变状态
                task.success_count = success_count
                task.failed_count = failed_count
                task.progress_percent = 100
                
                if failed_details:
                    task.failed_detail = json.dumps(failed_details, ensure_ascii=False)
                
                self.db.commit()
                
                return {
                    "success": True,
                    "message": "任务已取消（已更新计数）"
                }
            
            # 更新任务状态为已完成
            task.task_status = 2  # 已完成
            task.success_count = success_count
            task.failed_count = failed_count
            task.progress_percent = 100
            task.end_time = datetime.now()
            
            if failed_details:
                task.failed_detail = json.dumps(failed_details, ensure_ascii=False)
            
            self.db.commit()
            
            return {
                "success": True,
                "message": "任务已完成"
            }
        
        except Exception as e:
            print(f"✗ 完成任务失败: {str(e)}")
            return {
                "success": False,
                "message": f"完成任务失败: {str(e)}"
            }
    
    async def create_fission(
        self,
        shop_id: int,
        source_product_id: str,
        count: int,
        price_float_amount: float = 0,
        title_suffix: str = None,
        title_replacements: list = None,
        publish_mode: int = 2,
        cover_image_folder: str = None,
        main_image_folder: str = None,
        detail_image_folder: str = None
    ) -> Dict[str, Any]:
        """
        创建裂变任务
        
        Args:
            shop_id: 店铺ID
            source_product_id: 原商品ID
            count: 裂变数量
            price_float_amount: 价格浮动金额（元）
            title_suffix: 标题后缀
            title_replacements: 标题替换列表（循环使用）
            publish_mode: 发布模式 1草稿/2上架
            cover_image_folder: 首图文件夹路径
            main_image_folder: 主图文件夹路径
            detail_image_folder: 详情图文件夹路径
            
        Returns:
            裂变结果
        """
        try:
            import uuid
            from app.models.product import ProductTask, FissionRecord
            from app.services.task_queue_service import task_queue_service
            
            # 1. 获取店铺信息
            shop = self.db.query(ShopAuth).filter(
                ShopAuth.id == shop_id,
                ShopAuth.status == 1
            ).first()
            
            if not shop:
                return {
                    "success": False,
                    "message": "店铺不存在或已禁用"
                }
            
            # 2. 获取原商品信息
            source_product = self.db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop_id,
                ProductInfo.douyin_product_id == source_product_id,
                ProductInfo.status == 1
            ).first()
            
            if not source_product:
                return {
                    "success": False,
                    "message": "原商品不存在"
                }
            
            # 3. 创建任务记录
            task_id = f"FISSION_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            task = ProductTask(
                task_id=task_id,
                shop_id=shop_id,
                task_type=2,  # 裂变任务
                total_count=count,
                success_count=0,
                failed_count=0,
                current_index=0,
                current_product_title="",
                task_status=0,  # 待处理
                progress_percent=0,
                start_time=None,
                end_time=None
            )
            self.db.add(task)
            
            # 4. 创建裂变记录
            import json
            fission_record = FissionRecord(
                task_id=task_id,
                shop_id=shop_id,
                source_product_id=source_product_id,
                source_product_title=source_product.title,
                fission_count=count,
                price_range=price_float_amount,
                title_suffix=title_suffix or "",
                title_replacements=json.dumps(title_replacements, ensure_ascii=False) if title_replacements else None,
                publish_mode=publish_mode
            )
            self.db.add(fission_record)
            self.db.commit()
            
            print(f"[裂变服务] 任务已创建: {task_id}")
            
            # 5. 根据店铺授权模式选择裂变方式
            auth_mode = getattr(shop, 'auth_mode', 'api')
            
            print(f"[裂变服务] 店铺授权模式: {auth_mode}")
            
            # 6. 将任务添加到队列
            if auth_mode == 'playwright':
                # Playwright自动化模式
                await task_queue_service.add_task(
                    task_id=task_id,
                    task_func=self._execute_playwright_fission,
                    task_args={
                        'shop_id': shop_id,
                        'source_product_id': source_product_id,
                        'count': count,
                        'price_float_amount': price_float_amount,
                        'title_suffix': title_suffix,
                        'title_replacements': title_replacements,
                        'publish_mode': publish_mode,
                        'cover_image_folder': cover_image_folder,
                        'main_image_folder': main_image_folder,
                        'detail_image_folder': detail_image_folder,
                        'task_id': task_id
                    }
                )
            else:
                # API模式
                # 检查token是否过期
                if shop.expire_time and shop.expire_time < datetime.now():
                    task.task_status = 3  # 失败
                    task.error_message = "店铺授权已过期，请重新授权"
                    self.db.commit()
                    return {
                        "success": False,
                        "message": "店铺授权已过期，请重新授权"
                    }
                
                await task_queue_service.add_task(
                    task_id=task_id,
                    task_func=self._execute_api_fission,
                    task_args={
                        'shop_id': shop_id,
                        'source_product_id': source_product_id,
                        'count': count,
                        'price_float_amount': price_float_amount,
                        'title_suffix': title_suffix,
                        'title_replacements': title_replacements,
                        'publish_mode': publish_mode,
                        'cover_image_folder': cover_image_folder,
                        'main_image_folder': main_image_folder,
                        'detail_image_folder': detail_image_folder,
                        'task_id': task_id
                    }
                )
            
            return {
                "success": True,
                "message": "裂变任务已创建，正在队列中等待执行",
                "task_id": task_id
            }
        
        except Exception as e:
            print(f"✗ 裂变服务异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"裂变服务异常: {str(e)}"
            }
    
    async def _execute_playwright_fission(
        self,
        shop_id: int,
        source_product_id: str,
        count: int,
        price_float_amount: float,
        title_suffix: str,
        title_replacements: list,
        publish_mode: int,
        cover_image_folder: str,
        main_image_folder: str,
        detail_image_folder: str,
        task_id: str
    ):
        """执行Playwright裂变（在队列中调用）"""
        from app.core.database import get_db
        
        # 创建新的数据库会话
        db = next(get_db())
        
        try:
            # 重新查询店铺和商品信息（在新的Session中）
            shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
            source_product = db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop_id,
                ProductInfo.douyin_product_id == source_product_id
            ).first()
            
            if not shop or not source_product:
                return
            
            # 创建新的FissionPlaywright实例，使用新的Session
            fission_service = FissionPlaywright(db)
            await fission_service.execute_fission(
                shop=shop,
                source_product=source_product,
                count=count,
                price_float_amount=price_float_amount,
                title_suffix=title_suffix,
                title_replacements=title_replacements,
                publish_mode=publish_mode,
                cover_image_folder=cover_image_folder,
                main_image_folder=main_image_folder,
                detail_image_folder=detail_image_folder,
                task_id=task_id
            )
        finally:
            db.close()
    
    async def _execute_api_fission(
        self,
        shop_id: int,
        source_product_id: str,
        count: int,
        price_float_amount: float,
        title_suffix: str,
        title_replacements: list,
        publish_mode: int,
        cover_image_folder: str,
        main_image_folder: str,
        detail_image_folder: str,
        task_id: str
    ):
        """执行API裂变（在队列中调用）"""
        from app.core.database import get_db
        
        # 创建新的数据库会话
        db = next(get_db())
        
        try:
            # 重新查询店铺和商品信息（在新的Session中）
            shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
            source_product = db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop_id,
                ProductInfo.douyin_product_id == source_product_id
            ).first()
            
            if not shop or not source_product:
                return
            
            # 创建新的FissionAPI实例，使用新的Session
            fission_service = FissionAPI(db)
            await fission_service.execute_fission(
                shop=shop,
                source_product=source_product,
                count=count,
                price_float_amount=price_float_amount,
                title_suffix=title_suffix,
                title_replacements=title_replacements,
                publish_mode=publish_mode,
                cover_image_folder=cover_image_folder,
                main_image_folder=main_image_folder,
                detail_image_folder=detail_image_folder,
                task_id=task_id
            )
        finally:
            db.close()

    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """获取任务状态"""
        try:
            from app.models.product import ProductTask
            
            task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            
            if not task:
                return {
                    "success": False,
                    "message": "任务不存在"
                }
            
            return {
                "success": True,
                "data": {
                    "task_id": task.task_id,
                    "shop_id": task.shop_id,
                    "task_type": task.task_type,
                    "total_count": task.total_count,
                    "success_count": task.success_count,
                    "failed_count": task.failed_count,
                    "current_index": task.current_index,
                    "current_product_title": task.current_product_title,
                    "task_status": task.task_status,
                    "progress_percent": task.progress_percent,
                    "error_message": task.error_message,
                    "start_time": task.start_time.strftime('%Y-%m-%d %H:%M:%S') if task.start_time else None,
                    "end_time": task.end_time.strftime('%Y-%m-%d %H:%M:%S') if task.end_time else None,
                    "create_time": task.create_time.strftime('%Y-%m-%d %H:%M:%S') if task.create_time else None
                }
            }
        except Exception as e:
            print(f"✗ 获取任务状态失败: {str(e)}")
            return {
                "success": False,
                "message": f"获取任务状态失败: {str(e)}"
            }
    
    def get_task_list(
        self,
        shop_id: int = None,
        page_no: int = 1,
        page_size: int = 20,
        task_status: int = None,
        user_id: Optional[int] = None,
        account_type: Optional[int] = None,
        is_hidden: Optional[int] = None
    ) -> Dict[str, Any]:
        """获取任务列表（带权限过滤）"""
        try:
            from app.models.product import ProductTask
            from app.models.shop import ShopAuth
            from app.models.account import EmployeeShopRelation
            
            print(f"\n[裂变任务列表] ========== 开始查询 ==========")
            print(f"  shop_id: {shop_id}")
            print(f"  page_no: {page_no}, page_size: {page_size}")
            print(f"  task_status: {task_status}")
            print(f"  user_id: {user_id}, account_type: {account_type}, is_hidden: {is_hidden}")
            
            # 构建查询，只查询裂变任务（task_type=2）
            query = self.db.query(ProductTask).filter(
                ProductTask.status == 1,
                ProductTask.task_type == 2  # 只查询裂变任务
            )
            
            # 店铺过滤逻辑（与商品列表一致）
            if shop_id is not None:
                # 指定了具体店铺
                query = query.filter(ProductTask.shop_id == shop_id)
                print(f"[裂变任务列表] → 查询具体店铺: shop_id={shop_id}")
            else:
                # 未指定店铺，根据用户权限过滤
                print(f"[裂变任务列表] → 查询所有店铺（需权限过滤）")
                
                if is_hidden == 1:
                    # 隐藏管理员：可以看到所有店铺的任务
                    print(f"[裂变任务列表] ✓ 隐藏管理员，可查看所有店铺")
                    pass
                elif user_id and account_type:
                    # 普通用户：只能看到有权限的店铺的任务
                    print(f"[裂变任务列表] → 普通用户，需要过滤店铺权限")
                    
                    if account_type == 1:
                        # 主账号：查询自己创建的店铺的任务
                        user_shop_ids = self.db.query(ShopAuth.id).filter(
                            ShopAuth.user_id == user_id,
                            ShopAuth.status == 1
                        ).all()
                        user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                        print(f"[裂变任务列表] → 主账号，有权限的店铺数: {len(user_shop_ids)}")
                    else:
                        # 员工账号：查询有权限的店铺的任务
                        user_shop_ids = self.db.query(EmployeeShopRelation.shop_id).filter(
                            EmployeeShopRelation.employee_id == user_id,
                            EmployeeShopRelation.status == 1
                        ).all()
                        user_shop_ids = [shop_id[0] for shop_id in user_shop_ids]
                        print(f"[裂变任务列表] → 员工账号，有权限的店铺数: {len(user_shop_ids)}")
                    
                    if user_shop_ids:
                        query = query.filter(ProductTask.shop_id.in_(user_shop_ids))
                        print(f"[裂变任务列表] ✓ 添加店铺过滤条件")
                    else:
                        # 用户没有任何店铺权限，返回空列表
                        print(f"[裂变任务列表] ✗ 用户没有任何店铺权限")
                        return {
                            "success": True,
                            "data": {
                                "list": [],
                                "total": 0,
                                "page_no": page_no,
                                "page_size": page_size
                            }
                        }
            
            # 任务状态过滤
            if task_status is not None:
                query = query.filter(ProductTask.task_status == task_status)
                print(f"[裂变任务列表] → 添加状态过滤: task_status={task_status}")
            
            # 按创建时间倒序
            query = query.order_by(ProductTask.create_time.desc())
            
            # 分页
            total = query.count()
            print(f"[裂变任务列表] → 查询到任务总数: {total}")
            
            tasks = query.offset((page_no - 1) * page_size).limit(page_size).all()
            print(f"[裂变任务列表] → 当前页任务数: {len(tasks)}")
            
            task_list = []
            for task in tasks:
                task_list.append({
                    "task_id": task.task_id,
                    "shop_id": task.shop_id,
                    "task_type": task.task_type,
                    "total_count": task.total_count,
                    "success_count": task.success_count,
                    "failed_count": task.failed_count,
                    "current_index": task.current_index,
                    "current_product_title": task.current_product_title,
                    "task_status": task.task_status,
                    "progress_percent": task.progress_percent,
                    "error_message": task.error_message,
                    "start_time": task.start_time.strftime('%Y-%m-%d %H:%M:%S') if task.start_time else None,
                    "end_time": task.end_time.strftime('%Y-%m-%d %H:%M:%S') if task.end_time else None,
                    "create_time": task.create_time.strftime('%Y-%m-%d %H:%M:%S') if task.create_time else None
                })
            
            print(f"[裂变任务列表] ========== 查询结束 ==========\n")
            
            return {
                "success": True,
                "data": {
                    "list": task_list,
                    "total": total,
                    "page_no": page_no,
                    "page_size": page_size
                }
            }
        except Exception as e:
            print(f"✗ 获取任务列表失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"获取任务列表失败: {str(e)}"
            }
    
    def get_fission_records(
        self,
        shop_id: int = None,
        page_no: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        """获取裂变记录"""
        try:
            import json
            from app.models.product import FissionRecord
            
            # 构建查询
            query = self.db.query(FissionRecord)
            
            if shop_id:
                query = query.filter(FissionRecord.shop_id == shop_id)
            
            # 按创建时间倒序
            query = query.order_by(FissionRecord.create_time.desc())
            
            # 分页
            total = query.count()
            records = query.offset((page_no - 1) * page_size).limit(page_size).all()
            
            record_list = []
            for record in records:
                record_list.append({
                    "id": record.id,
                    "task_id": record.task_id,
                    "shop_id": record.shop_id,
                    "source_product_id": record.source_product_id,
                    "source_product_title": record.source_product_title,
                    "fission_count": record.fission_count,
                    "price_range": float(record.price_range) if record.price_range else 0,
                    "title_suffix": record.title_suffix,
                    "title_replacements": json.loads(record.title_replacements) if record.title_replacements else None,
                    "publish_mode": record.publish_mode,
                    "create_time": record.create_time.strftime('%Y-%m-%d %H:%M:%S') if record.create_time else None
                })
            
            return {
                "success": True,
                "data": {
                    "list": record_list,
                    "total": total,
                    "page_no": page_no,
                    "page_size": page_size
                }
            }
        except Exception as e:
            print(f"✗ 获取裂变记录失败: {str(e)}")
            return {
                "success": False,
                "message": f"获取裂变记录失败: {str(e)}"
            }
    
    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        """取消任务"""
        try:
            from app.models.product import ProductTask
            
            task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            
            if not task:
                return {
                    "success": False,
                    "message": "任务不存在"
                }
            
            # 只能取消待处理或进行中的任务
            if task.task_status not in [0, 1]:
                return {
                    "success": False,
                    "message": "只能取消待处理或进行中的任务"
                }
            
            task.task_status = 4  # 已取消
            task.end_time = datetime.now()
            self.db.commit()
            
            return {
                "success": True,
                "message": "任务已取消"
            }
        except Exception as e:
            print(f"✗ 取消任务失败: {str(e)}")
            return {
                "success": False,
                "message": f"取消任务失败: {str(e)}"
            }

    def calculate_combinations(
        self,
        cover_image_folder: str = None,
        main_image_folder: str = None,
        detail_image_folder: str = None
    ) -> Dict[str, Any]:
        """
        计算素材文件夹的组合数
        
        Args:
            cover_image_folder: 首图文件夹路径
            main_image_folder: 主图文件夹路径
            detail_image_folder: 详情图文件夹路径
            
        Returns:
            组合数信息
        """
        try:
            import os
            
            # 统计首图数量
            cover_count = 0
            if cover_image_folder and os.path.exists(cover_image_folder):
                image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
                for filename in os.listdir(cover_image_folder):
                    file_path = os.path.join(cover_image_folder, filename)
                    if os.path.isfile(file_path):
                        _, ext = os.path.splitext(filename)
                        if ext.lower() in image_extensions:
                            cover_count += 1
            
            # 统计主图方案数（子文件夹数量）
            main_count = 0
            if main_image_folder and os.path.exists(main_image_folder):
                for item in os.listdir(main_image_folder):
                    item_path = os.path.join(main_image_folder, item)
                    if os.path.isdir(item_path):
                        main_count += 1
            
            # 统计详情图方案数（子文件夹数量）
            detail_count = 0
            if detail_image_folder and os.path.exists(detail_image_folder):
                for item in os.listdir(detail_image_folder):
                    item_path = os.path.join(detail_image_folder, item)
                    if os.path.isdir(item_path):
                        detail_count += 1
            
            # 计算总组合数
            total_combinations = 0
            if cover_count > 0 and main_count > 0 and detail_count > 0:
                total_combinations = cover_count * main_count * detail_count
            
            return {
                "success": True,
                "data": {
                    "cover_count": cover_count,
                    "main_count": main_count,
                    "detail_count": detail_count,
                    "total_combinations": total_combinations
                }
            }
        except Exception as e:
            print(f"✗ 计算组合数失败: {str(e)}")
            return {
                "success": False,
                "message": f"计算组合数失败: {str(e)}"
            }

    async def retry_failed_fission(self, task_id: str) -> Dict[str, Any]:
        """
        重试失败的裂变项
        
        Args:
            task_id: 任务ID
            
        Returns:
            重试结果
        """
        try:
            import json
            from app.models.product import ProductTask, FissionRecord
            from app.services.task_queue_service import task_queue_service
            
            # 1. 获取任务信息
            task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
            if not task:
                return {
                    "success": False,
                    "message": "任务不存在"
                }
            
            # 2. 检查任务状态
            if task.task_status not in [2, 3]:  # 只能重试已完成或失败的任务
                return {
                    "success": False,
                    "message": "只能重试已完成或失败的任务"
                }
            
            # 3. 检查是否有失败项
            if not task.failed_detail or task.failed_count == 0:
                return {
                    "success": False,
                    "message": "没有失败的项目需要重试"
                }
            
            # 4. 解析失败详情
            try:
                failed_details = json.loads(task.failed_detail)
            except:
                return {
                    "success": False,
                    "message": "失败详情解析失败"
                }
            
            if not failed_details:
                return {
                    "success": False,
                    "message": "没有失败的项目需要重试"
                }
            
            # 5. 获取裂变记录
            fission_record = self.db.query(FissionRecord).filter(
                FissionRecord.task_id == task_id
            ).first()
            
            if not fission_record:
                return {
                    "success": False,
                    "message": "裂变记录不存在"
                }
            
            # 6. 获取店铺信息
            shop = self.db.query(ShopAuth).filter(
                ShopAuth.id == task.shop_id,
                ShopAuth.status == 1
            ).first()
            
            if not shop:
                return {
                    "success": False,
                    "message": "店铺不存在或已禁用"
                }
            
            # 7. 获取原商品信息
            source_product = self.db.query(ProductInfo).filter(
                ProductInfo.shop_id == task.shop_id,
                ProductInfo.douyin_product_id == fission_record.source_product_id,
                ProductInfo.status == 1
            ).first()
            
            if not source_product:
                return {
                    "success": False,
                    "message": "原商品不存在"
                }
            
            # 8. 创建重试任务ID
            import uuid
            from datetime import datetime
            retry_task_id = f"RETRY_{task_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            
            # 9. 创建新的任务记录
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
            self.db.add(retry_task)
            self.db.commit()
            
            print(f"[重试裂变] 任务已创建: {retry_task_id}")
            print(f"[重试裂变] 将重试 {len(failed_details)} 个失败项")
            
            # 10. 解析标题替换列表
            title_replacements = None
            if fission_record.title_replacements:
                try:
                    title_replacements = json.loads(fission_record.title_replacements)
                except:
                    pass
            
            # 11. 根据店铺授权模式选择裂变方式
            auth_mode = getattr(shop, 'auth_mode', 'api')
            
            # 12. 将重试任务添加到队列
            if auth_mode == 'playwright':
                await task_queue_service.add_task(
                    task_id=retry_task_id,
                    task_func=self._execute_playwright_retry,
                    task_args={
                        'shop_id': task.shop_id,
                        'source_product_id': fission_record.source_product_id,
                        'failed_details': failed_details,
                        'title_suffix': fission_record.title_suffix,
                        'title_replacements': title_replacements,
                        'publish_mode': fission_record.publish_mode,
                        'task_id': retry_task_id,
                        'original_task_id': task_id
                    }
                )
            else:
                # API模式暂不支持重试（因为API模式没有保存素材信息）
                retry_task.task_status = 3
                retry_task.error_message = "API模式暂不支持重试功能"
                self.db.commit()
                return {
                    "success": False,
                    "message": "API模式暂不支持重试功能"
                }
            
            return {
                "success": True,
                "message": f"重试任务已创建，将重试 {len(failed_details)} 个失败项",
                "retry_task_id": retry_task_id,
                "retry_count": len(failed_details)
            }
        
        except Exception as e:
            print(f"✗ 创建重试任务失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"创建重试任务失败: {str(e)}"
            }
    
    async def _execute_playwright_retry(
        self,
        shop_id: int,
        source_product_id: str,
        failed_details: list,
        title_suffix: str,
        title_replacements: list,
        publish_mode: int,
        task_id: str,
        original_task_id: str
    ):
        """执行Playwright重试（在队列中调用）"""
        from app.core.database import get_db
        
        # 创建新的数据库会话
        db = next(get_db())
        
        try:
            # 重新查询店铺和商品信息
            shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
            source_product = db.query(ProductInfo).filter(
                ProductInfo.shop_id == shop_id,
                ProductInfo.douyin_product_id == source_product_id
            ).first()
            
            if not shop or not source_product:
                return
            
            # 创建新的FissionPlaywright实例
            fission_service = FissionPlaywright(db)
            await fission_service.execute_retry(
                shop=shop,
                source_product=source_product,
                failed_details=failed_details,
                title_suffix=title_suffix,
                title_replacements=title_replacements,
                publish_mode=publish_mode,
                task_id=task_id,
                original_task_id=original_task_id
            )
        finally:
            db.close()
