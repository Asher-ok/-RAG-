"""
商品裂变 - Playwright自动化实现
"""
import asyncio
import json
import random
import string
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from playwright.async_api import BrowserContext
from app.models.product import ProductInfo
from app.models.shop import ShopAuth


class FissionPlaywright:
    """Playwright自动化裂变类"""
    
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
    
    def _get_images_from_folder(self, folder_path: str, has_subfolders: bool = False) -> List[str]:
        """
        从文件夹中获取图片文件路径
        
        Args:
            folder_path: 文件夹路径
            has_subfolders: 是否包含子文件夹
                - False: 直接从文件夹中获取所有图片
                - True: 随机选择一个子文件夹，获取该子文件夹中的所有图片
            
        Returns:
            图片文件路径列表
        """
        import os
        
        if not folder_path or not os.path.exists(folder_path):
            return []
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        
        try:
            if has_subfolders:
                # 获取所有子文件夹
                subfolders = []
                for item in os.listdir(folder_path):
                    item_path = os.path.join(folder_path, item)
                    if os.path.isdir(item_path):
                        subfolders.append(item_path)
                
                if not subfolders:
                    print(f"  ⚠ 文件夹中没有子文件夹: {folder_path}")
                    return []
                
                # 随机选择一个子文件夹
                selected_subfolder = random.choice(subfolders)
                print(f"  随机选择子文件夹: {os.path.basename(selected_subfolder)}")
                
                # 获取该子文件夹中的所有图片
                image_files = []
                for filename in os.listdir(selected_subfolder):
                    file_path = os.path.join(selected_subfolder, filename)
                    if os.path.isfile(file_path):
                        _, ext = os.path.splitext(filename)
                        if ext.lower() in image_extensions:
                            image_files.append(file_path)
                
                return sorted(image_files)
            else:
                # 直接从文件夹中获取所有图片
                image_files = []
                for filename in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, filename)
                    if os.path.isfile(file_path):
                        _, ext = os.path.splitext(filename)
                        if ext.lower() in image_extensions:
                            image_files.append(file_path)
                
                return sorted(image_files)
        except Exception as e:
            print(f"读取文件夹失败: {folder_path}, 错误: {str(e)}")
            return []
    
    def _generate_all_combinations(
        self,
        cover_image_folder: str = None,
        main_image_folder: str = None,
        detail_image_folder: str = None
    ) -> List[Dict[str, Any]]:
        """
        生成所有素材组合（排列组合模式，不重复）
        
        Args:
            cover_image_folder: 首图文件夹路径
            main_image_folder: 主图文件夹路径
            detail_image_folder: 详情图文件夹路径
            
        Returns:
            所有组合的列表，每个元素包含 {cover_image, main_images, detail_images}
        """
        import os
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        combinations = []
        
        # 1. 获取所有首图
        cover_images = []
        if cover_image_folder and os.path.exists(cover_image_folder):
            for filename in os.listdir(cover_image_folder):
                file_path = os.path.join(cover_image_folder, filename)
                if os.path.isfile(file_path):
                    _, ext = os.path.splitext(filename)
                    if ext.lower() in image_extensions:
                        cover_images.append(file_path)
            cover_images = sorted(cover_images)
        
        # 2. 获取所有主图方案（每个子文件夹是一个方案）
        main_image_plans = []
        if main_image_folder and os.path.exists(main_image_folder):
            subfolders = []
            for item in os.listdir(main_image_folder):
                item_path = os.path.join(main_image_folder, item)
                if os.path.isdir(item_path):
                    subfolders.append(item_path)
            
            for subfolder in sorted(subfolders):
                images = []
                for filename in os.listdir(subfolder):
                    file_path = os.path.join(subfolder, filename)
                    if os.path.isfile(file_path):
                        _, ext = os.path.splitext(filename)
                        if ext.lower() in image_extensions:
                            images.append(file_path)
                if images:
                    main_image_plans.append(sorted(images))
        
        # 3. 获取所有详情图方案（每个子文件夹是一个方案）
        detail_image_plans = []
        if detail_image_folder and os.path.exists(detail_image_folder):
            subfolders = []
            for item in os.listdir(detail_image_folder):
                item_path = os.path.join(detail_image_folder, item)
                if os.path.isdir(item_path):
                    subfolders.append(item_path)
            
            for subfolder in sorted(subfolders):
                images = []
                for filename in os.listdir(subfolder):
                    file_path = os.path.join(subfolder, filename)
                    if os.path.isfile(file_path):
                        _, ext = os.path.splitext(filename)
                        if ext.lower() in image_extensions:
                            images.append(file_path)
                if images:
                    detail_image_plans.append(sorted(images))
        
        # 4. 生成所有组合
        if cover_images and main_image_plans and detail_image_plans:
            for cover in cover_images:
                for main_plan in main_image_plans:
                    for detail_plan in detail_image_plans:
                        combinations.append({
                            'cover_image': cover,
                            'main_images': main_plan,
                            'detail_images': detail_plan
                        })
        
        # 5. 打乱顺序（看起来是随机的，但不会重复）
        random.shuffle(combinations)
        
        print(f"  生成组合总数: {len(combinations)}")
        print(f"    首图: {len(cover_images)}张")
        print(f"    主图方案: {len(main_image_plans)}个")
        print(f"    详情图方案: {len(detail_image_plans)}个")
        
        return combinations
    
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
        执行Playwright自动化裂变
        
        Args:
            shop: 店铺信息
            source_product: 原商品信息
            count: 裂变数量
            price_float_amount: 价格浮动金额（元）
            title_suffix: 标题后缀
            title_replacements: 标题替换列表（循环使用）
            publish_mode: 发布模式 1草稿/2上架
            cover_image_folder: 首图文件夹路径
            main_image_folder: 主图文件夹路径
            detail_image_folder: 详情图文件夹路径
            task_id: 任务ID（用于更新进度）
            
        Returns:
            裂变结果
        """
        try:
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.models.product import ProductTask
            from datetime import datetime
            
            print(f"\n[Playwright裂变] 开始执行...")
            print(f"  原商品: {source_product.title}")
            print(f"  裂变数量: {count}")
            print(f"  任务ID: {task_id}")
            print(f"  [调试] 接收到的文件夹路径:")
            print(f"    首图文件夹: {cover_image_folder}")
            print(f"    主图文件夹: {main_image_folder}")
            print(f"    详情图文件夹: {detail_image_folder}")
            
            # 更新任务状态为进行中
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 1  # 进行中
                    task.start_time = datetime.now()
                    task.current_index = 0
                    task.progress_percent = 0
                    self.db.commit()
            
            # 获取Playwright账号ID
            playwright_account_id = getattr(shop, 'playwright_account_id', None)
            if not playwright_account_id:
                # 更新任务状态为失败
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.task_status = 3  # 失败
                        task.error_message = "店铺未配置Playwright账号"
                        task.end_time = datetime.now()
                        self.db.commit()
                
                return {
                    "success": False,
                    "message": "店铺未配置Playwright账号"
                }
            
            # 创建浏览器管理器并获取上下文
            browser_manager = BrowserManager()
            await browser_manager.launch_browser(headless=True)
            context = await browser_manager.create_context(account_id=playwright_account_id)
            if not context:
                # 更新任务状态为失败
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.task_status = 3  # 失败
                        task.error_message = "无法获取浏览器上下文"
                        task.end_time = datetime.now()
                        self.db.commit()
                
                return {
                    "success": False,
                    "message": "无法获取浏览器上下文"
                }
            
            # 读取素材文件夹中的图片 - 使用排列组合模式
            print(f"  [素材模式] 使用排列组合模式（不重复）")
            all_combinations = self._generate_all_combinations(
                cover_image_folder=cover_image_folder,
                main_image_folder=main_image_folder,
                detail_image_folder=detail_image_folder
            )
            
            # 检查组合数是否足够
            if all_combinations and len(all_combinations) < count:
                print(f"  ⚠ 警告: 组合数({len(all_combinations)})少于裂变数量({count})，将循环使用")
            
            print(f"  首图数量: {len(all_combinations[0]['cover_image']) if all_combinations else 0}")
            print(f"  主图数量: {len(all_combinations[0]['main_images']) if all_combinations else 0}")
            print(f"  详情图数量: {len(all_combinations[0]['detail_images']) if all_combinations else 0}")
            
            # 如果没有提供素材，使用原商品图片
            if not all_combinations:
                print(f"  未提供素材文件夹，将使用原商品图片")
                original_images = json.loads(source_product.images)
                cover_images = [original_images[0]] if original_images else []
                main_images = original_images[1:5] if len(original_images) > 1 else []
                detail_images = original_images[5:] if len(original_images) > 5 else []
                
                # 创建一个默认组合
                all_combinations = [{
                    'cover_image': cover_images[0] if cover_images else None,
                    'main_images': main_images,
                    'detail_images': detail_images
                }]
            
            # 解析原商品SKU
            original_sku_list = json.loads(source_product.sku_list)
            
            # 批量创建裂变商品
            success_count = 0
            failed_count = 0
            failed_details = []
            
            for i in range(count):
                print(f"\n[Playwright裂变] 创建第 {i + 1}/{count} 个商品...")
                
                # 使用排列组合模式：按顺序取用，循环使用
                combination_index = i % len(all_combinations)
                combination = all_combinations[combination_index]
                
                cover_image = combination['cover_image']
                main_image_list = combination['main_images']
                detail_image_list = combination['detail_images']
                
                print(f"  使用组合 #{combination_index + 1}/{len(all_combinations)}")
                if cover_image:
                    import os
                    print(f"    首图: {os.path.basename(cover_image)}")
                print(f"    主图: {len(main_image_list)}张")
                print(f"    详情图: {len(detail_image_list)}张")
                
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
                
                # 确保标题不超过60字符
                if len(new_title) > 60:
                    new_title = new_title[:60]
                
                print(f"  生成标题: {new_title}")
                
                # 组合所有图片：首图 + 主图 + 详情图
                all_images = []
                if cover_image:
                    all_images.append(cover_image)
                all_images.extend(main_image_list)
                all_images.extend(detail_image_list)
                
                print(f"  本次使用图片: 首图1张 + 主图{len(main_image_list)}张 + 详情图{len(detail_image_list)}张")
                
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
                
                # 创建单个裂变商品
                result = await self._create_single_product(
                    context=context,
                    source_product=source_product,
                    new_title=new_title,
                    new_images=all_images,
                    new_sku_list=new_sku_list,
                    publish_mode=publish_mode,
                    cover_image=cover_image,
                    main_images=main_image_list,
                    detail_images=detail_image_list
                )
                
                if result.get('success'):
                    success_count += 1
                    print(f"✓ 第 {i + 1} 个商品创建成功")
                else:
                    failed_count += 1
                    # 保存失败详情，包含素材信息以便重试
                    failed_details.append({
                        "index": i + 1,
                        "title": new_title,
                        "reason": result.get('message', '未知错误'),
                        # 保存素材信息用于重试
                        "combination_index": combination_index,
                        "title_replacement_index": replacement_index if title_replacements and len(title_replacements) > 0 else None,
                        "cover_image": cover_image,
                        "main_images": main_image_list,
                        "detail_images": detail_image_list,
                        "sku_list": new_sku_list
                    })
                    print(f"✗ 第 {i + 1} 个商品创建失败: {result.get('message')}")
                
                # 更新任务进度
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.current_index = i + 1
                        task.current_product_title = new_title
                        task.success_count = success_count
                        task.failed_count = failed_count
                        task.progress_percent = int((i + 1) / count * 100)
                        if failed_details:
                            task.failed_detail = json.dumps(failed_details, ensure_ascii=False)
                        self.db.commit()
                        print(f"  [进度更新] {i + 1}/{count} ({task.progress_percent}%)")
                
                # 每个商品之间间隔3秒
                if i < count - 1:
                    await asyncio.sleep(3)
            
            # 更新任务状态为已完成
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 2  # 已完成
                    task.end_time = datetime.now()
                    task.progress_percent = 100
                    self.db.commit()
                    print(f"  [任务完成] 成功{success_count}个，失败{failed_count}个")
            
            return {
                "success": True,
                "message": f"裂变完成，成功{success_count}个，失败{failed_count}个",
                "total": count,
                "success_count": success_count,
                "failed_count": failed_count,
                "failed_details": failed_details
            }
            
        except Exception as e:
            print(f"✗ Playwright裂变失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 更新任务状态为失败
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 3  # 失败
                    task.error_message = str(e)
                    task.end_time = datetime.now()
                    self.db.commit()
            
            return {
                "success": False,
                "message": f"裂变失败: {str(e)}"
            }
        finally:
            # 清理浏览器资源
            if 'browser_manager' in locals():
                await browser_manager.stop()
    
    async def _create_single_product(
        self,
        context: BrowserContext,
        source_product: ProductInfo,
        new_title: str,
        new_images: List[str],
        new_sku_list: List[Dict[str, Any]],
        publish_mode: int,
        cover_image: str = None,
        main_images: List[str] = None,
        detail_images: List[str] = None
    ) -> Dict[str, Any]:
        """
        创建单个裂变商品（直接访问创建相似品页面）
        
        流程：
        1. 直接访问创建相似品页面（URL包含原商品ID）
        2. 等待页面加载（自动复制原商品信息）
        3. 修改标题（添加隐藏字符）
        4. 替换图片（主图、辅助图、详情图）
        5. 调整价格
        6. 提交
        """
        # 处理默认参数
        if main_images is None:
            main_images = []
        if detail_images is None:
            detail_images = []
        
        page = None
        try:
            page = await context.new_page()
            
            # 设置视口大小
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # 先访问首页，确保登录状态有效
            print(f"  [预检查] 验证登录状态...")
            homepage_url = "https://fxg.jinritemai.com/ffa/mshop/homepage/index"
            await page.goto(homepage_url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(2)
            
            # 检查是否在登录页面
            if "/login" in page.url:
                print(f"  ✗ 登录状态已过期")
                return {"success": False, "message": "登录状态已过期，请重新登录"}
            
            print(f"  ✓ 登录状态有效")
            
            # 1. 直接访问创建相似品页面
            print(f"  [步骤1] 直接访问创建相似品页面...")
            # 使用 douyin_product_id 作为 copyid 参数
            product_id = source_product.douyin_product_id
            create_similar_url = f"https://fxg.jinritemai.com/ffa/g/create?copyid={product_id}"
            print(f"  URL: {create_similar_url}")
            
            await page.goto(create_similar_url, wait_until="domcontentloaded", timeout=30000)
            
            # 等待页面加载（系统会自动复制原商品信息）
            print(f"  等待页面加载...")
            await asyncio.sleep(5)
            
            # 检查是否跳转到登录页面
            if "/login" in page.url:
                print(f"  ✗ 跳转到登录页面")
                return {"success": False, "message": "无法访问创建页面，登录状态可能已过期"}
            
            print(f"  ✓ 已进入创建相似品页面: {page.url}")
            
            # 确认已进入商品发布页面
            if 'create' not in page.url:
                return {"success": False, "message": "未能进入商品发布页面"}
            
            # 2. 修改标题（添加隐藏字符确保不完全相同）
            print(f"  [步骤2] 修改商品标题...")
            try:
                # 添加零宽字符（不可见字符）使标题唯一
                # 零宽空格 (U+200B)、零宽非连接符 (U+200C)、零宽连接符 (U+200D)
                invisible_chars = ['\u200B', '\u200C', '\u200D']
                random_invisible = ''.join(random.choices(invisible_chars, k=3))
                
                # 在标题中间插入隐藏字符
                title_with_hidden = new_title[:len(new_title)//2] + random_invisible + new_title[len(new_title)//2:]
                
                # 查找标题输入框
                title_selectors = [
                    "input[placeholder*='商品标题']",
                    "input[placeholder*='标题']",
                    "textarea[placeholder*='商品标题']",
                    "input[placeholder*='请输入']",
                    "input[placeholder*='2-60个字符']"
                ]
                
                title_filled = False
                for selector in title_selectors:
                    try:
                        # 清空原标题
                        await page.fill(selector, "", timeout=3000)
                        # 填入新标题（带隐藏字符）
                        await page.fill(selector, title_with_hidden, timeout=3000)
                        title_filled = True
                        print(f"  ✓ 标题修改成功: {new_title} (已添加隐藏字符)")
                        break
                    except:
                        continue
                
                if not title_filled:
                    return {"success": False, "message": "未找到标题输入框"}
                
                await asyncio.sleep(2)
                
            except Exception as e:
                return {"success": False, "message": f"修改标题失败: {str(e)}"}
            
            # 3. 删除原有的主图区域和主图3:4区域的所有图片
            print(f"  [步骤3] 删除原有的主图和主图3:4...")
            try:
                # 等待页面完全加载
                await asyncio.sleep(3)
                
                # 先定位到"图文信息"区域
                print(f"  定位到'图文信息'区域...")
                try:
                    # 通过ID定位到图文信息区域
                    image_section = await page.wait_for_selector("#goodsEditScrollContainer-图文信息", timeout=5000)
                    if image_section:
                        # 滚动到该区域
                        await image_section.scroll_into_view_if_needed()
                        print(f"  ✓ 已定位到'图文信息'区域")
                        await asyncio.sleep(2)
                except Exception as e:
                    print(f"  ⚠ 无法定位到'图文信息'区域: {str(e)}，尝试手动滚动")
                    await page.evaluate("window.scrollBy(0, 400)")
                    await asyncio.sleep(2)
                
                # 第一阶段：删除主图区域（1:1）的所有图片（最多5张）
                # 删除后会显示5个上传按钮
                deleted_main_count = 0
                max_delete_attempts = 15
                
                print(f"  [阶段1] 开始删除主图区域（1:1）的图片...")
                
                for attempt in range(max_delete_attempts):
                    try:
                        # 在主图区域内查找所有图片容器
                        main_image_section = await page.query_selector("[attr-field-id='主图']")
                        
                        if main_image_section:
                            # 在主图区域内查找图片容器
                            image_wrappers = await main_image_section.query_selector_all("div.index-module_imgWrapper__xOFF7")
                        else:
                            # 备用方法：查找所有图片容器
                            image_wrappers = await page.query_selector_all("div.index-module_imgWrapper__xOFF7")
                        
                        if not image_wrappers or len(image_wrappers) == 0:
                            print(f"  ✓ 主图区域（1:1）已清空，现在应该显示5个上传按钮")
                            break
                        
                        print(f"  主图区域还有 {len(image_wrappers)} 张图片待删除")
                        
                        # 鼠标悬停在第一张图片上
                        first_wrapper = image_wrappers[0]
                        await first_wrapper.hover()
                        await asyncio.sleep(0.8)
                        
                        # 查找删除按钮
                        deleted = False
                        
                        # 方法1: 直接在悬停的图片容器内查找删除按钮
                        try:
                            delete_icon = await first_wrapper.query_selector("use[href='#icon-shanchu']")
                            if delete_icon:
                                delete_button = await delete_icon.evaluate_handle("""
                                    el => el.closest('.index-module_actionAfter__MtUIB')
                                """)
                                if delete_button:
                                    await delete_button.as_element().click()
                                    deleted = True
                                    deleted_main_count += 1
                                    print(f"  ✓ 已删除主图 {deleted_main_count}/5")
                                    await asyncio.sleep(1)
                        except Exception as e:
                            print(f"  ⚠ 方法1删除失败: {str(e)}")
                        
                        # 方法2: 如果方法1失败，尝试通过可见的删除按钮
                        if not deleted:
                            try:
                                delete_button_selectors = [
                                    ".index-module_hoverWrapper__OjtoF .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])",
                                    ".index-module_controls__ys7qK .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])"
                                ]
                                
                                for selector in delete_button_selectors:
                                    try:
                                        delete_buttons = await page.query_selector_all(selector)
                                        if delete_buttons and len(delete_buttons) > 0:
                                            await delete_buttons[0].click()
                                            deleted = True
                                            deleted_main_count += 1
                                            print(f"  ✓ 已删除主图 {deleted_main_count}/5")
                                            await asyncio.sleep(1)
                                            break
                                    except:
                                        continue
                            except Exception as e:
                                print(f"  ⚠ 方法2删除失败: {str(e)}")
                        
                        if not deleted:
                            print(f"  ⚠ 未找到删除按钮，停止删除主图")
                            break
                            
                    except Exception as e:
                        print(f"  ⚠ 删除主图时出错: {str(e)}")
                        break
                
                print(f"  ✓ 主图区域（1:1）共删除 {deleted_main_count} 张")
                await asyncio.sleep(2)
                
                # 第二阶段：删除主图3:4区域的所有图片（最多5张）
                deleted_34_count = 0
                
                print(f"  [阶段2] 开始删除主图3:4区域的图片...")
                
                for attempt in range(max_delete_attempts):
                    try:
                        # 在主图3:4区域内查找所有图片容器
                        main_34_section = await page.query_selector("[attr-field-id='主图3:4']")
                        
                        if main_34_section:
                            # 在主图3:4区域内查找图片容器
                            image_wrappers = await main_34_section.query_selector_all("div.index-module_imgWrapper__xOFF7")
                        else:
                            # 备用方法：查找所有剩余的图片容器
                            image_wrappers = await page.query_selector_all("div.index-module_imgWrapper__xOFF7")
                        
                        if not image_wrappers or len(image_wrappers) == 0:
                            print(f"  ✓ 主图3:4区域已清空")
                            break
                        
                        print(f"  主图3:4区域还有 {len(image_wrappers)} 张图片待删除")
                        
                        # 鼠标悬停在第一张图片上
                        first_wrapper = image_wrappers[0]
                        await first_wrapper.hover()
                        await asyncio.sleep(0.8)
                        
                        # 查找删除按钮
                        deleted = False
                        
                        # 方法1: 直接在悬停的图片容器内查找删除按钮
                        try:
                            delete_icon = await first_wrapper.query_selector("use[href='#icon-shanchu']")
                            if delete_icon:
                                delete_button = await delete_icon.evaluate_handle("""
                                    el => el.closest('.index-module_actionAfter__MtUIB')
                                """)
                                if delete_button:
                                    await delete_button.as_element().click()
                                    deleted = True
                                    deleted_34_count += 1
                                    print(f"  ✓ 已删除主图3:4 {deleted_34_count}/5")
                                    await asyncio.sleep(1)
                        except Exception as e:
                            print(f"  ⚠ 方法1删除失败: {str(e)}")
                        
                        # 方法2: 如果方法1失败，尝试通过可见的删除按钮
                        if not deleted:
                            try:
                                delete_button_selectors = [
                                    ".index-module_hoverWrapper__OjtoF .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])",
                                    ".index-module_controls__ys7qK .index-module_actionAfter__MtUIB:has(use[href='#icon-shanchu'])"
                                ]
                                
                                for selector in delete_button_selectors:
                                    try:
                                        delete_buttons = await page.query_selector_all(selector)
                                        if delete_buttons and len(delete_buttons) > 0:
                                            await delete_buttons[0].click()
                                            deleted = True
                                            deleted_34_count += 1
                                            print(f"  ✓ 已删除主图3:4 {deleted_34_count}/5")
                                            await asyncio.sleep(1)
                                            break
                                    except:
                                        continue
                            except Exception as e:
                                print(f"  ⚠ 方法2删除失败: {str(e)}")
                        
                        if not deleted:
                            print(f"  ⚠ 未找到删除按钮，停止删除主图3:4")
                            break
                            
                    except Exception as e:
                        print(f"  ⚠ 删除主图3:4时出错: {str(e)}")
                        break
                
                print(f"  ✓ 主图3:4区域共删除 {deleted_34_count} 张")
                print(f"  ✓ 总计删除: 主图{deleted_main_count}张 + 主图3:4 {deleted_34_count}张 = {deleted_main_count + deleted_34_count}张")
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"  ⚠ 删除图片失败: {str(e)}，尝试继续")
            
            # 4. 上传新的主图（1张首图 + 4张主图）
            print(f"  [步骤4] 上传新的首图和主图...")
            try:
                # 分离首图和主图
                # new_images的结构：[首图1张, 主图4张, 详情图N张]
                if new_images and len(new_images) >= 5:
                    cover_image = [new_images[0]]  # 第1张是首图
                    main_images_2345 = new_images[1:5]  # 第2-5张是主图
                    
                    print(f"  准备上传:")
                    print(f"    首图: {cover_image[0]}")
                    print(f"    主图2-5:")
                    for idx, img in enumerate(main_images_2345, 2):
                        print(f"      主图{idx}: {img}")
                    
                    # 上传到主图区域（1:1比例）
                    try:
                        # 查找主图区域
                        main_image_section = await page.query_selector("[attr-field-id='主图']")
                        
                        if main_image_section:
                            print(f"  ✓ 找到主图区域")
                            
                            # 确保"本地上传"选项卡是激活状态
                            try:
                                local_upload_tab = await page.query_selector("text=本地上传")
                                if local_upload_tab:
                                    await local_upload_tab.click()
                                    print(f"  ✓ 已切换到'本地上传'选项卡")
                                    await asyncio.sleep(1)
                            except:
                                print(f"  ⚠ 未找到'本地上传'选项卡，可能已经是默认状态")
                            
                            # 在主图区域内查找所有文件输入框
                            file_inputs = await main_image_section.query_selector_all("input[type='file']")
                            
                            if file_inputs and len(file_inputs) >= 5:
                                print(f"  ✓ 找到 {len(file_inputs)} 个文件输入框")
                                
                                # 准备5张图片：首图 + 主图2-5
                                all_main_images = [cover_image[0]] + main_images_2345
                                
                                # 第一轮：上传所有5张图片
                                print(f"  [第一轮] 上传5张主图...")
                                for idx in range(5):
                                    print(f"  [{idx+1}/5] 上传主图{idx+1}...")
                                    try:
                                        await file_inputs[idx].set_input_files([all_main_images[idx]])
                                        print(f"  ✓ 主图{idx+1}已设置")
                                        await asyncio.sleep(3.5)
                                    except Exception as e:
                                        print(f"  ✗ 主图{idx+1}上传失败: {str(e)}")
                                
                                # 等待图片上传
                                print(f"  等待图片上传完成...")
                                await asyncio.sleep(12)
                                
                                # 检查并补传缺失的图片（一直重试直到成功）
                                retry = 0
                                while True:
                                    retry += 1
                                    # 重新获取文件输入框（页面可能已更新）
                                    main_image_section = await page.query_selector("[attr-field-id='主图']")
                                    if main_image_section:
                                        file_inputs = await main_image_section.query_selector_all("input[type='file']")
                                        uploaded_images = await main_image_section.query_selector_all("div.index-module_imgWrapper__xOFF7")
                                    else:
                                        print(f"  ⚠ 无法找到主图区域，等待3秒后重试...")
                                        await asyncio.sleep(3)
                                        continue
                                    
                                    actual_count = len(uploaded_images) if uploaded_images else 0
                                    
                                    if actual_count >= 5:
                                        print(f"  ✓ 主图上传成功！已上传 {actual_count} 张图片")
                                        break
                                    else:
                                        print(f"  第{retry}次检查：只检测到 {actual_count} 张图片，预期5张")
                                        print(f"  补传缺失的图片...")
                                        
                                        # 找出哪些位置还是空的（有file input但没有图片）
                                        missing_count = 5 - actual_count
                                        print(f"  需要补传 {missing_count} 张图片")
                                        
                                        # 从后往前补传（因为通常是后面的图片没上传成功）
                                        补传_start_idx = actual_count
                                        for idx in range(补传_start_idx, 5):
                                            if idx < len(file_inputs) and idx < len(all_main_images):
                                                print(f"  补传主图{idx+1}...")
                                                try:
                                                    await file_inputs[idx].set_input_files([all_main_images[idx]])
                                                    print(f"  ✓ 主图{idx+1}已补传")
                                                    await asyncio.sleep(3)
                                                except Exception as e:
                                                    print(f"  ✗ 主图{idx+1}补传失败: {str(e)}")
                                        
                                        # 等待补传完成
                                        print(f"  等待5秒后再次检查...")
                                        await asyncio.sleep(5)
                                
                                # 图片齐全，点击"从1:1主图智能裁剪"按钮
                                print(f"  ✓ 5张主图已齐全，点击'从1:1主图智能裁剪'按钮...")
                                try:
                                    # 使用更精确的选择器，增加超时时间
                                    crop_button = await page.wait_for_selector(
                                        "button.ecom-g-btn.ecom-g-btn-link:has-text('从1:1主图智能裁剪')", 
                                        timeout=10000
                                    )
                                    
                                    if crop_button:
                                        # 确保按钮可见并可点击
                                        await crop_button.scroll_into_view_if_needed()
                                        await asyncio.sleep(0.5)
                                        
                                        # 点击按钮
                                        await crop_button.click()
                                        print(f"  ✓ 已点击'从1:1主图智能裁剪'按钮")
                                        
                                        # 等待按钮文本变化为"取消智能裁剪"，确认点击成功
                                        try:
                                            await page.wait_for_selector(
                                                "button.ecom-g-btn.ecom-g-btn-link:has-text('取消智能裁剪')", 
                                                timeout=5000
                                            )
                                            print(f"  ✓ 按钮已变为'取消智能裁剪'，智能裁剪已启动")
                                        except:
                                            print(f"  ⚠ 未检测到按钮变化，但继续等待图片生成")
                                        
                                        # 等待图片生成完成（10-15秒）
                                        print(f"  等待3:4图片自动生成（约10-15秒）...")
                                        await asyncio.sleep(12)
                                        print(f"  ✓ 3:4图片应该已经生成完成")
                                    else:
                                        print(f"  ⚠ 未找到'从1:1主图智能裁剪'按钮，继续后续流程")
                                except Exception as e:
                                    print(f"  ⚠ 点击'从1:1主图智能裁剪'按钮失败: {str(e)}，继续后续流程")
                                        
                            else:
                                print(f"  ✗ 文件输入框数量不足，找到 {len(file_inputs) if file_inputs else 0} 个，需要5个")
                        else:
                            print(f"  ✗ 未找到主图区域")
                            
                    except Exception as e:
                        print(f"  ✗ 主图上传失败: {str(e)}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"  ⚠ 图片数量不足，需要至少5张（1张首图+4张主图），实际只有 {len(new_images) if new_images else 0} 张")
                    
            except Exception as e:
                print(f"  ✗ 图片上传失败: {str(e)}")
                import traceback
                traceback.print_exc()
            
            # 4.5. 删除详情图区域的所有原有图片
            print(f"  [步骤4.5] 删除详情图区域的所有原有图片...")
            try:
                # 滚动到详情编辑区域
                try:
                    detail_section = await page.wait_for_selector("text=详情编辑", timeout=5000)
                    if detail_section:
                        await detail_section.scroll_into_view_if_needed()
                        print(f"  ✓ 已定位到'详情编辑'区域")
                        await asyncio.sleep(2)
                except Exception as e:
                    print(f"  ⚠ 无法定位到'详情编辑'区域: {str(e)}")
                
                # 删除所有详情图（最多尝试删除50次，因为详情图最多50张）
                deleted_detail_count = 0
                max_delete_attempts = 60
                
                print(f"  开始删除详情图...")
                
                for attempt in range(max_delete_attempts):
                    try:
                        # 查找详情图区域的所有图片容器
                        detail_image_wrappers = await page.query_selector_all("div.styles_imgWrapper__dqiHn")
                        
                        if not detail_image_wrappers or len(detail_image_wrappers) == 0:
                            print(f"  ✓ 详情图区域已清空")
                            break
                        
                        if attempt % 5 == 0:  # 每5次打印一次进度
                            print(f"  详情图区域还有 {len(detail_image_wrappers)} 张图片待删除")
                        
                        # 鼠标悬停在第一张图片上，确保控制按钮显示
                        first_wrapper = detail_image_wrappers[0]
                        await first_wrapper.hover()
                        await asyncio.sleep(1)
                        
                        # 查找删除按钮
                        deleted = False
                        
                        # 方法1: 直接在图片容器内查找删除图标（最准确）
                        try:
                            # 详情图的删除按钮在 div.styles_controls__vZIXJ 内
                            delete_icon = await first_wrapper.query_selector("i.styles_iconDelete__y_88a")
                            if delete_icon:
                                # 确保按钮可见
                                is_visible = await delete_icon.is_visible()
                                if is_visible:
                                    await delete_icon.click()
                                    deleted = True
                                    deleted_detail_count += 1
                                    if attempt % 5 == 0:
                                        print(f"  ✓ 已删除详情图 {deleted_detail_count} 张")
                                    await asyncio.sleep(0.8)
                                else:
                                    print(f"  ⚠ 删除按钮不可见")
                        except Exception as e:
                            print(f"  ⚠ 方法1删除失败: {str(e)}")
                        
                        # 方法2: 通过controls容器查找
                        if not deleted:
                            try:
                                controls = await first_wrapper.query_selector("div.styles_controls__vZIXJ")
                                if controls:
                                    delete_icon = await controls.query_selector("i.styles_iconDelete__y_88a")
                                    if delete_icon:
                                        await delete_icon.click()
                                        deleted = True
                                        deleted_detail_count += 1
                                        if attempt % 5 == 0:
                                            print(f"  ✓ 已删除详情图 {deleted_detail_count} 张")
                                        await asyncio.sleep(0.8)
                            except Exception as e:
                                print(f"  ⚠ 方法2删除失败: {str(e)}")
                        
                        # 方法3: 使用JavaScript强制点击
                        if not deleted:
                            try:
                                delete_icon = await first_wrapper.query_selector("i.styles_iconDelete__y_88a")
                                if delete_icon:
                                    # 使用JavaScript点击，绕过可见性检查
                                    await delete_icon.evaluate("el => el.click()")
                                    deleted = True
                                    deleted_detail_count += 1
                                    if attempt % 5 == 0:
                                        print(f"  ✓ 已删除详情图 {deleted_detail_count} 张")
                                    await asyncio.sleep(0.8)
                            except Exception as e:
                                print(f"  ⚠ 方法3删除失败: {str(e)}")
                        
                        if not deleted:
                            print(f"  ⚠ 未找到删除按钮，停止删除详情图")
                            print(f"  调试信息: 第一个容器HTML: {await first_wrapper.inner_html()}")
                            break
                            
                    except Exception as e:
                        print(f"  ⚠ 删除详情图时出错: {str(e)}")
                        import traceback
                        traceback.print_exc()
                        break
                
                print(f"  ✓ 详情图区域共删除 {deleted_detail_count} 张")
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"  ⚠ 删除详情图失败: {str(e)}，尝试继续")
            
            # 4.6. 上传新的详情图
            print(f"  [步骤4.6] 上传新的详情图...")
            try:
                # 获取详情图列表（在execute_fission方法中已经随机选择了子文件夹）
                if detail_images and len(detail_images) > 0:
                    print(f"  准备上传 {len(detail_images)} 张详情图")
                    
                    # 查找详情图上传按钮（支持多选的文件输入框）
                    detail_upload_input = None
                    
                    # 方法1: 通过"详情编辑"区域查找
                    try:
                        detail_section_selectors = [
                            "div.styles_decorateImgEdit__IdRQn",
                            "text=详情编辑"
                        ]
                        
                        for selector in detail_section_selectors:
                            try:
                                section = await page.query_selector(selector)
                                if section:
                                    # 在详情编辑区域内查找支持多选的文件输入框
                                    detail_upload_input = await section.query_selector("input[type='file'][multiple]")
                                    if detail_upload_input:
                                        print(f"  ✓ 找到详情图上传输入框")
                                        break
                            except:
                                continue
                    except Exception as e:
                        print(f"  ⚠ 方法1查找失败: {str(e)}")
                    
                    # 方法2: 直接查找页面中支持多选的文件输入框（排除主图区域的）
                    if not detail_upload_input:
                        try:
                            all_file_inputs = await page.query_selector_all("input[type='file'][multiple]")
                            if all_file_inputs and len(all_file_inputs) > 0:
                                # 通常详情图的输入框在后面
                                detail_upload_input = all_file_inputs[-1]
                                print(f"  ✓ 找到详情图上传输入框（方法2）")
                        except Exception as e:
                            print(f"  ⚠ 方法2查找失败: {str(e)}")
                    
                    if detail_upload_input:
                        # 一次性上传所有详情图（利用multiple属性）
                        print(f"  开始上传 {len(detail_images)} 张详情图...")
                        try:
                            await detail_upload_input.set_input_files(detail_images)
                            print(f"  ✓ 详情图已设置")
                            
                            # 等待上传完成（根据图片数量动态调整，每张3秒，最少15秒）
                            wait_time = max(15, len(detail_images) * 3)
                            print(f"  等待 {wait_time:.0f} 秒让图片上传...")
                            await asyncio.sleep(wait_time)
                            
                            # 检查并补传缺失的详情图（一直重试直到成功）
                            retry = 0
                            while True:
                                retry += 1
                                # 查找已上传的详情图
                                uploaded_detail_images = await page.query_selector_all("div.styles_imgWrapper__dqiHn")
                                actual_count = len(uploaded_detail_images) if uploaded_detail_images else 0
                                
                                if actual_count >= len(detail_images):
                                    print(f"  ✓ 详情图上传成功！已上传 {actual_count} 张图片")
                                    break
                                else:
                                    print(f"  第{retry}次检查：只检测到 {actual_count} 张详情图，预期 {len(detail_images)} 张")
                                    print(f"  重新上传所有详情图...")
                                    
                                    try:
                                        await detail_upload_input.set_input_files(detail_images)
                                        print(f"  ✓ 详情图已重新设置")
                                        
                                        # 等待时间
                                        wait_time = max(15, len(detail_images) * 3)
                                        print(f"  等待 {wait_time:.0f} 秒后再次检查...")
                                        await asyncio.sleep(wait_time)
                                    except Exception as e:
                                        print(f"  ✗ 重新上传失败: {str(e)}")
                                        await asyncio.sleep(5)
                                
                        except Exception as e:
                            print(f"  ✗ 详情图上传失败: {str(e)}")
                    else:
                        print(f"  ✗ 未找到详情图上传输入框")
                else:
                    print(f"  ⚠ 没有详情图需要上传")
                    
            except Exception as e:
                print(f"  ✗ 详情图上传失败: {str(e)}")
                import traceback
                traceback.print_exc()
            
            # 5. 滚动到价格区域，调整价格
            print(f"  [步骤5] 调整商品价格...")
            try:
                # 滚动到价格库存区域
                scroll_attempts = 0
                max_scroll_attempts = 10
                
                while scroll_attempts < max_scroll_attempts:
                    # 查找"价格库存"文本
                    price_section_selectors = [
                        "text=价格库存",
                        "div:has-text('价格库存')",
                        "span:has-text('价格库存')",
                        "text=价格"
                    ]
                    
                    found = False
                    for selector in price_section_selectors:
                        try:
                            element = await page.query_selector(selector)
                            if element:
                                # 滚动到该元素
                                await element.scroll_into_view_if_needed()
                                print(f"  ✓ 已滚动到'价格库存'部分")
                                found = True
                                break
                        except:
                            continue
                    
                    if found:
                        break
                    
                    # 如果没找到，继续向下滚动
                    await page.evaluate("window.scrollBy(0, 300)")
                    await asyncio.sleep(0.5)
                    scroll_attempts += 1
                
                await asyncio.sleep(2)
                
                # 调整价格
                if new_sku_list and len(new_sku_list) > 0:
                    print(f"  调整SKU价格...")
                    
                    # 查找所有价格输入框
                    price_inputs = await page.query_selector_all("input[placeholder*='价格']")
                    
                    if not price_inputs:
                        # 尝试其他选择器
                        price_inputs = await page.query_selector_all("input[type='number']")
                    
                    if price_inputs and len(price_inputs) > 0:
                        # 遍历每个SKU，调整价格
                        for i, sku in enumerate(new_sku_list):
                            if i < len(price_inputs):
                                price_yuan = sku.get('price', 0) / 100.0  # 分转元
                                price_str = f"{price_yuan:.2f}"
                                
                                try:
                                    # 清空并填入新价格
                                    await price_inputs[i].fill("", timeout=2000)
                                    await price_inputs[i].fill(price_str, timeout=2000)
                                    print(f"  ✓ SKU {i+1} 价格已调整为: ¥{price_str}")
                                    await asyncio.sleep(0.5)
                                except Exception as e:
                                    print(f"  ⚠ SKU {i+1} 价格调整失败: {str(e)}")
                    else:
                        print(f"  ⚠ 未找到价格输入框")
                        
            except Exception as e:
                print(f"  ⚠ 调整价格失败: {str(e)}，尝试继续")
            
            # 6. 滚动到底部，提交商品
            print(f"  [步骤6] 提交商品...")
            try:
                # 滚动到页面底部
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(2)
                
                if publish_mode == 1:
                    # 保存为草稿
                    print(f"  点击'保存草稿'按钮...")
                    submit_selectors = [
                        "button.ecom-g-btn.ecom-g-btn-dashed:has-text('保存草稿')",
                        "button:has-text('保存草稿')",
                        "button.ecom-g-btn:has(span:text('保存草稿'))",
                        "text=保存草稿",
                        "[class*='draft']:has-text('保存')"
                    ]
                else:
                    # 直接发布
                    print(f"  点击'发布商品'按钮...")
                    submit_selectors = [
                        "button.ecom-g-btn.ecom-g-btn-primary:has-text('发布商品')",
                        "button:has-text('发布商品')",
                        "button.ecom-g-btn:has(span:text('发布商品'))",
                        "button:has-text('提交并上架')",
                        "button:has-text('立即上架')",
                        "text=发布商品"
                    ]
                
                submitted = False
                last_error = None
                
                for selector in submit_selectors:
                    try:
                        # 先尝试查找按钮
                        button = await page.wait_for_selector(selector, timeout=5000)
                        if button:
                            # 确保按钮可见
                            await button.scroll_into_view_if_needed()
                            await asyncio.sleep(0.5)
                            # 点击按钮
                            await button.click()
                            submitted = True
                            print(f"  ✓ 成功点击提交按钮（使用选择器: {selector}）")
                            break
                    except Exception as e:
                        last_error = str(e)
                        continue
                
                if not submitted:
                    error_msg = f"未找到提交按钮，最后一个错误: {last_error}"
                    print(f"  ✗ {error_msg}")
                    return {"success": False, "message": error_msg}
                
                # 等待提交完成
                print(f"  等待提交完成...")
                await asyncio.sleep(5)
                
                # 检查是否成功
                try:
                    # 查找成功提示
                    success_selectors = [
                        "text=创建成功",
                        "text=发布成功",
                        "text=保存成功",
                        "text=提交成功"
                    ]
                    
                    for selector in success_selectors:
                        try:
                            await page.wait_for_selector(selector, timeout=5000)
                            print(f"  ✓ 商品创建成功")
                            return {"success": True, "message": "商品创建成功"}
                        except:
                            continue
                    
                    # 检查URL是否跳转
                    if 'list' in page.url or 'success' in page.url:
                        print(f"  ✓ 商品创建成功（已跳转到列表页）")
                        return {"success": True, "message": "商品创建成功"}
                    else:
                        print(f"  ⚠ 无法确认是否创建成功，当前URL: {page.url}")
                        return {"success": False, "message": "无法确认是否创建成功"}
                        
                except Exception as e:
                    print(f"  ⚠ 检查结果时出错: {str(e)}")
                    return {"success": False, "message": f"无法确认是否创建成功: {str(e)}"}
                
            except Exception as e:
                return {"success": False, "message": f"提交商品失败: {str(e)}"}
            
        except Exception as e:
            print(f"  ✗ 创建失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "message": f"创建失败: {str(e)}"}
        finally:
            if page:
                await page.close()

    async def execute_retry(
        self,
        shop: ShopAuth,
        source_product: ProductInfo,
        failed_details: list,
        title_suffix: str = None,
        title_replacements: list = None,
        publish_mode: int = 2,
        task_id: str = None,
        original_task_id: str = None
    ) -> Dict[str, Any]:
        """
        执行失败项重试
        
        Args:
            shop: 店铺信息
            source_product: 原商品信息
            failed_details: 失败详情列表（包含素材信息）
            title_suffix: 标题后缀
            title_replacements: 标题替换列表
            publish_mode: 发布模式 1草稿/2上架
            task_id: 重试任务ID
            original_task_id: 原任务ID
            
        Returns:
            重试结果
        """
        try:
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            from app.models.product import ProductTask
            from datetime import datetime
            
            print(f"\n[Playwright重试] 开始执行...")
            print(f"  原任务ID: {original_task_id}")
            print(f"  重试任务ID: {task_id}")
            print(f"  重试数量: {len(failed_details)}")
            
            # 更新任务状态为进行中
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 1  # 进行中
                    task.start_time = datetime.now()
                    task.current_index = 0
                    task.progress_percent = 0
                    self.db.commit()
            
            # 获取Playwright账号ID
            playwright_account_id = getattr(shop, 'playwright_account_id', None)
            if not playwright_account_id:
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.task_status = 3  # 失败
                        task.error_message = "店铺未配置Playwright账号"
                        task.end_time = datetime.now()
                        self.db.commit()
                
                return {
                    "success": False,
                    "message": "店铺未配置Playwright账号"
                }
            
            # 创建浏览器管理器并获取上下文
            browser_manager = BrowserManager()
            await browser_manager.launch_browser(headless=True)
            context = await browser_manager.create_context(account_id=playwright_account_id)
            if not context:
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.task_status = 3  # 失败
                        task.error_message = "无法获取浏览器上下文"
                        task.end_time = datetime.now()
                        self.db.commit()
                
                return {
                    "success": False,
                    "message": "无法获取浏览器上下文"
                }
            
            # 统计
            success_count = 0
            failed_count = 0
            new_failed_details = []
            
            # 逐个重试失败项
            for idx, failed_item in enumerate(failed_details):
                print(f"\n[Playwright重试] 重试第 {idx + 1}/{len(failed_details)} 个商品...")
                print(f"  原索引: {failed_item.get('index')}")
                print(f"  原标题: {failed_item.get('title')}")
                print(f"  失败原因: {failed_item.get('reason')}")
                
                # 从失败详情中恢复素材信息
                combination_index = failed_item.get('combination_index')
                title_replacement_index = failed_item.get('title_replacement_index')
                cover_image = failed_item.get('cover_image')
                main_image_list = failed_item.get('main_images', [])
                detail_image_list = failed_item.get('detail_images', [])
                new_sku_list = failed_item.get('sku_list', [])
                
                # 重新生成标题（使用相同的标题索引）
                if title_replacements and title_replacement_index is not None:
                    base_title = title_replacements[title_replacement_index]
                    if title_suffix:
                        new_title = f"{base_title}{title_suffix}{self._generate_random_suffix()}"
                    else:
                        new_title = f"{base_title}{self._generate_random_suffix()}"
                else:
                    if title_suffix:
                        new_title = f"{source_product.title} {title_suffix} {self._generate_random_suffix()}"
                    else:
                        new_title = f"{source_product.title} {self._generate_random_suffix()}"
                
                # 确保标题不超过60字符
                if len(new_title) > 60:
                    new_title = new_title[:60]
                
                print(f"  新标题: {new_title}")
                print(f"  使用组合索引: {combination_index}")
                
                # 组合所有图片
                all_images = []
                if cover_image:
                    all_images.append(cover_image)
                all_images.extend(main_image_list)
                all_images.extend(detail_image_list)
                
                print(f"  使用图片: 首图1张 + 主图{len(main_image_list)}张 + 详情图{len(detail_image_list)}张")
                
                # 调用创建商品方法
                result = await self._create_single_product(
                    context=context,
                    source_product=source_product,
                    new_title=new_title,
                    new_images=all_images,
                    new_sku_list=new_sku_list,
                    publish_mode=publish_mode,
                    cover_image=cover_image,
                    main_images=main_image_list,
                    detail_images=detail_image_list
                )
                
                if result.get('success'):
                    success_count += 1
                    print(f"✓ 第 {idx + 1} 个商品重试成功")
                else:
                    failed_count += 1
                    # 再次失败，保存失败详情
                    new_failed_details.append({
                        "index": failed_item.get('index'),
                        "title": new_title,
                        "reason": result.get('message', '未知错误'),
                        # 保留素材信息以便再次重试
                        "combination_index": combination_index,
                        "title_replacement_index": title_replacement_index,
                        "cover_image": cover_image,
                        "main_images": main_image_list,
                        "detail_images": detail_image_list,
                        "sku_list": new_sku_list
                    })
                    print(f"✗ 第 {idx + 1} 个商品重试失败: {result.get('message')}")
                
                # 更新任务进度
                if task_id:
                    task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                    if task:
                        task.current_index = idx + 1
                        task.current_product_title = new_title
                        task.success_count = success_count
                        task.failed_count = failed_count
                        task.progress_percent = int((idx + 1) / len(failed_details) * 100)
                        if new_failed_details:
                            task.failed_detail = json.dumps(new_failed_details, ensure_ascii=False)
                        self.db.commit()
                        print(f"  [进度更新] {idx + 1}/{len(failed_details)} ({task.progress_percent}%)")
                
                # 每个商品之间间隔3秒
                if idx < len(failed_details) - 1:
                    await asyncio.sleep(3)
            
            # 更新任务状态为已完成
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 2  # 已完成
                    task.end_time = datetime.now()
                    task.progress_percent = 100
                    self.db.commit()
            
            # 关闭浏览器
            await browser_manager.close_browser()
            
            print(f"\n[Playwright重试] 重试完成")
            print(f"  成功: {success_count}")
            print(f"  失败: {failed_count}")
            
            return {
                "success": True,
                "message": f"重试完成，成功 {success_count} 个，失败 {failed_count} 个",
                "success_count": success_count,
                "failed_count": failed_count,
                "failed_details": new_failed_details
            }
            
        except Exception as e:
            print(f"✗ Playwright重试失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # 更新任务状态为失败
            if task_id:
                task = self.db.query(ProductTask).filter(ProductTask.task_id == task_id).first()
                if task:
                    task.task_status = 3  # 失败
                    task.error_message = str(e)
                    task.end_time = datetime.now()
                    self.db.commit()
            
            return {
                "success": False,
                "message": f"重试失败: {str(e)}"
            }
