"""
商品同步 - 下架商品
专门用于拉取下架状态的商品
"""
from typing import Dict, List
from playwright.async_api import BrowserContext, Page
import asyncio
import os
import pandas as pd


class ProductSyncOffline:
    """下架商品同步器"""
    
    @staticmethod
    async def goto_product_list_page(context: BrowserContext) -> Dict:
        """
        进入商品列表页面
        
        Args:
            context: 已登录的浏览器上下文
            
        Returns:
            访问结果 {"success": bool, "page": Page, "message": str}
        """
        page = None
        try:
            # 1. 创建新页面
            page = await context.new_page()
            print(f"\n[下架商品同步] 创建新页面")
            
            # 2. 设置视口大小（确保页面完整显示）
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # 3. 先访问首页，确保登录状态有效
            print(f"[下架商品同步] 先访问首页验证登录状态...")
            homepage_url = "https://fxg.jinritemai.com/ffa/mshop/homepage/index"
            await page.goto(homepage_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # 4. 检查是否在登录页面
            if "/login" in page.url:
                print(f"⚠ 登录状态已过期")
                return {
                    "success": False,
                    "page": page,
                    "message": "登录状态已过期，请重新登录"
                }
            
            print(f"✓ 登录状态有效")
            
            # 5. 访问商品列表页面
            print(f"[下架商品同步] 访问商品列表页面...")
            product_list_url = "https://fxg.jinritemai.com/ffa/g/list"
            await page.goto(product_list_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # 6. 检查是否成功进入商品列表页面
            current_url = page.url
            print(f"✓ 当前URL: {current_url}")
            
            if "/login" in current_url:
                print(f"⚠ 被重定向到登录页面")
                return {
                    "success": False,
                    "page": page,
                    "message": "无法访问商品列表页面，可能需要重新登录"
                }
            
            if "/ffa/g/list" not in current_url:
                print(f"⚠ 未能进入商品列表页面")
                return {
                    "success": False,
                    "page": page,
                    "message": f"页面跳转异常，当前URL: {current_url}"
                }
            
            print(f"✓ 成功进入商品列表页面")
            
            return {
                "success": True,
                "page": page,
                "message": "成功进入商品列表页面"
            }
            
        except Exception as e:
            print(f"✗ 进入商品列表页面失败: {str(e)}")
            import traceback
            traceback.print_exc()
            
            if page:
                await page.close()
            
            return {
                "success": False,
                "page": None,
                "message": f"访问失败: {str(e)}"
            }
    
    @staticmethod
    async def click_offline_tab(page: Page) -> Dict:
        """
        点击"已下架"标签页
        
        Args:
            page: 页面实例
            
        Returns:
            点击结果 {"success": bool, "message": str}
        """
        try:
            print(f"[下架商品同步] 开始定位'已下架'按钮...")
            
            # 等待标签页容器加载
            await page.wait_for_selector('.ecom-g-tabs-nav-list', timeout=10000)
            print(f"✓ 标签页容器已加载")
            
            # 多种选择器策略，按优先级尝试
            selectors = [
                # 策略1: 通过ID定位（最精确）
                '#rc-tabs-0-tab-offline',
                
                # 策略2: 通过文本内容定位
                'text=已下架',
                
                # 策略3: 通过role和文本组合
                '[role="tab"]:has-text("已下架")',
                
                # 策略4: 通过class和文本组合
                '.ecom-g-tabs-tab-btn:has-text("已下架")',
                
                # 策略5: 通过aria-controls属性
                '[aria-controls="rc-tabs-0-panel-offline"]'
            ]
            
            clicked = False
            for idx, selector in enumerate(selectors):
                try:
                    print(f"  尝试选择器 {idx + 1}: {selector}")
                    
                    # 等待元素出现
                    element = await page.wait_for_selector(selector, timeout=5000)
                    
                    if element:
                        # 检查元素是否可见
                        is_visible = await element.is_visible()
                        if not is_visible:
                            print(f"  ⚠ 元素不可见，尝试下一个选择器")
                            continue
                        
                        # 点击元素
                        await element.click()
                        print(f"✓ 成功点击'已下架'按钮（使用选择器 {idx + 1}）")
                        
                        # 等待页面更新
                        await asyncio.sleep(2)
                        
                        # 验证是否点击成功（检查按钮是否变为激活状态）
                        is_active = await page.evaluate(f"""
                            () => {{
                                const element = document.querySelector('{selector}');
                                if (!element) return false;
                                
                                // 检查父元素是否有active类
                                const parent = element.closest('.ecom-g-tabs-tab');
                                if (parent && parent.classList.contains('ecom-g-tabs-tab-active')) {{
                                    return true;
                                }}
                                
                                // 检查aria-selected属性
                                if (element.getAttribute('aria-selected') === 'true') {{
                                    return true;
                                }}
                                
                                return false;
                            }}
                        """)
                        
                        if is_active:
                            print(f"✓ '已下架'标签页已激活")
                        else:
                            print(f"⚠ 按钮已点击，但未检测到激活状态（可能需要更多时间）")
                        
                        clicked = True
                        break
                        
                except Exception as e:
                    print(f"  ⚠ 选择器 {idx + 1} 失败: {str(e)}")
                    continue
            
            if not clicked:
                return {
                    "success": False,
                    "message": "未能找到或点击'已下架'按钮"
                }
            
            return {
                "success": True,
                "message": "成功点击'已下架'按钮"
            }
            
        except Exception as e:
            print(f"✗ 点击'已下架'按钮失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"点击失败: {str(e)}"
            }
    
    @staticmethod
    async def click_confirm_export_button(page: Page) -> Dict:
        """
        点击抽屉中的"导出"确认按钮
        
        Args:
            page: 页面实例
            
        Returns:
            点击结果 {"success": bool, "message": str}
        """
        try:
            print(f"[下架商品同步] 等待右侧抽屉弹出...")
            
            # 等待抽屉出现
            await page.wait_for_selector('.ecom-g-drawer-footer', timeout=10000)
            print(f"✓ 抽屉已弹出")
            
            # 等待1秒，确保抽屉完全展开
            await asyncio.sleep(1)
            
            # 定位"导出"按钮（主要按钮，带primary类）
            print(f"[下架商品同步] 开始定位'导出'确认按钮...")
            
            selectors = [
                # 策略1: 通过抽屉footer中的primary按钮和文本
                '.ecom-g-drawer-footer button.ecom-g-btn-primary:has-text("导出")',
                
                # 策略2: 通过data-btm属性
                'button span[data-btm="d414745"]:has-text("导出")',
                
                # 策略3: 通过抽屉footer中的primary按钮（不依赖文本）
                '.ecom-g-drawer-footer .ecom-g-btn-primary',
            ]
            
            clicked = False
            for idx, selector in enumerate(selectors):
                try:
                    print(f"  尝试选择器 {idx + 1}: {selector}")
                    
                    # 等待元素出现
                    element = await page.wait_for_selector(selector, timeout=5000)
                    
                    if element:
                        # 检查元素是否可见
                        is_visible = await element.is_visible()
                        if not is_visible:
                            print(f"  ⚠ 元素不可见，尝试下一个选择器")
                            continue
                        
                        # 如果选择器定位到的是span，需要点击父元素button
                        if 'span' in selector:
                            button = await element.evaluate_handle('el => el.closest("button")')
                            await button.as_element().click()
                        else:
                            await element.click()
                        
                        print(f"✓ 成功点击'导出'确认按钮（使用选择器 {idx + 1}）")
                        
                        # 等待导出任务提交
                        await asyncio.sleep(2)
                        
                        clicked = True
                        break
                        
                except Exception as e:
                    print(f"  ⚠ 选择器 {idx + 1} 失败: {str(e)}")
                    continue
            
            if not clicked:
                return {
                    "success": False,
                    "message": "未能找到或点击'导出'确认按钮"
                }
            
            return {
                "success": True,
                "message": "成功点击'导出'确认按钮，导出任务已提交"
            }
            
        except Exception as e:
            print(f"✗ 点击'导出'确认按钮失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"点击失败: {str(e)}"
            }
    
    @staticmethod
    async def click_export_button(page: Page) -> Dict:
        """
        点击"导出查询商品"按钮
        
        Args:
            page: 页面实例
            
        Returns:
            点击结果 {"success": bool, "message": str}
        """
        try:
            print(f"[下架商品同步] 开始定位'导出查询商品'按钮...")
            
            # 等待3秒，让页面加载完成
            print(f"  等待3秒，让页面加载完成...")
            await asyncio.sleep(3)
            
            # 根据你提供的HTML，最直接的定位方式
            selectors = [
                # 策略1: 通过ID定位（最精确）
                '#exportSearchedGoods',
                
                # 策略2: 通过文本内容定位
                'button:has-text("导出查询商品")',
                
                # 策略3: 通过span文本定位
                'button span:has-text("导出查询商品")',
            ]
            
            clicked = False
            for idx, selector in enumerate(selectors):
                try:
                    print(f"  尝试选择器 {idx + 1}: {selector}")
                    
                    # 等待元素出现
                    element = await page.wait_for_selector(selector, timeout=5000)
                    
                    if element:
                        # 检查元素是否可见
                        is_visible = await element.is_visible()
                        if not is_visible:
                            print(f"  ⚠ 元素不可见，尝试下一个选择器")
                            continue
                        
                        # 如果选择器定位到的是span，需要点击父元素button
                        if 'span' in selector:
                            # 获取父元素button
                            button = await element.evaluate_handle('el => el.closest("button")')
                            await button.as_element().click()
                        else:
                            # 直接点击button
                            await element.click()
                        
                        print(f"✓ 成功点击'导出查询商品'按钮（使用选择器 {idx + 1}）")
                        
                        # 等待一下，让导出操作开始
                        await asyncio.sleep(1)
                        
                        clicked = True
                        break
                        
                except Exception as e:
                    print(f"  ⚠ 选择器 {idx + 1} 失败: {str(e)}")
                    continue
            
            if not clicked:
                return {
                    "success": False,
                    "message": "未能找到或点击'导出查询商品'按钮"
                }
            
            return {
                "success": True,
                "message": "成功点击'导出查询商品'按钮"
            }
            
        except Exception as e:
            print(f"✗ 点击'导出查询商品'按钮失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"点击失败: {str(e)}"
            }
    
    @staticmethod
    async def download_offline_products_excel(
        context: BrowserContext,
        download_dir: str = None
    ) -> Dict:
        """
        下载下架商品的Excel文件
        
        Args:
            context: 已登录的浏览器上下文
            download_dir: 下载目录，默认为backend/downloads
            
        Returns:
            下载结果，包含文件路径
        """
        # 1. 先进入商品列表页面
        result = await ProductSyncOffline.goto_product_list_page(context)
        
        if not result["success"]:
            return result
        
        page = result["page"]
        
        try:
            # 2. 点击"已下架"标签页
            click_result = await ProductSyncOffline.click_offline_tab(page)
            
            if not click_result["success"]:
                return click_result
            
            print(f"✓ 已切换到'已下架'标签页")
            
            # 3. 点击"导出查询商品"按钮
            export_result = await ProductSyncOffline.click_export_button(page)
            
            if not export_result["success"]:
                return export_result
            
            print(f"✓ 已点击'导出查询商品'按钮")
            
            # 4. 点击抽屉中的"导出"确认按钮
            confirm_result = await ProductSyncOffline.click_confirm_export_button(page)
            
            if not confirm_result["success"]:
                return confirm_result
            
            print(f"✓ 导出任务已提交")
            
            # 5. 等待45秒，让导出任务完成
            print(f"[下架商品同步] 等待45秒，让导出任务完成...")
            await asyncio.sleep(45)
            print(f"✓ 等待完成")
            
            # 6. 进入导出记录页面
            print(f"[下架商品同步] 进入导出记录页面...")
            export_record_url = "https://fxg.jinritemai.com/ffa/g/excel"
            await page.goto(export_record_url, wait_until="domcontentloaded", timeout=60000)
            await asyncio.sleep(3)
            
            # 检查是否成功进入导出记录页面
            current_url = page.url
            print(f"✓ 当前URL: {current_url}")
            
            if "/login" in current_url:
                return {
                    "success": False,
                    "message": "被重定向到登录页面"
                }
            
            if "/ffa/g/excel" not in current_url:
                return {
                    "success": False,
                    "message": f"未能进入导出记录页面，当前URL: {current_url}"
                }
            
            print(f"✓ 成功进入导出记录页面")
            
            # 7. 等待表格加载
            print(f"[下架商品同步] 等待导出记录表格加载...")
            await page.wait_for_selector('.ecom-g-table-tbody', timeout=10000)
            print(f"✓ 表格已加载")
            
            # 等待2秒，确保数据完全加载
            await asyncio.sleep(2)
            
            # 8. 点击第一行的"下载报表"按钮
            print(f"[下架商品同步] 开始下载最新的导出记录...")
            
            # 设置下载目录
            if download_dir is None:
                download_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../downloads"))
                os.makedirs(download_dir, exist_ok=True)
            
            try:
                # 定位第一行的"下载报表"链接
                selectors = [
                    # 策略1: 第一行的下载报表链接
                    '.ecom-g-table-tbody tr:first-child a.index_operate__bwfEj:has-text("下载报表")',
                    
                    # 策略2: 第一行的下载报表链接（通过data-btm）
                    '.ecom-g-table-tbody tr:first-child a[data-btm="d38173"]',
                    
                    # 策略3: 第一个下载报表链接
                    'a.index_operate__bwfEj:has-text("下载报表")',
                ]
                
                download_clicked = False
                for idx, selector in enumerate(selectors):
                    try:
                        print(f"  尝试选择器 {idx + 1}: {selector}")
                        
                        # 等待元素出现
                        element = await page.wait_for_selector(selector, timeout=5000)
                        
                        if element:
                            # 检查元素是否可见
                            is_visible = await element.is_visible()
                            if not is_visible:
                                print(f"  ⚠ 元素不可见，尝试下一个选择器")
                                continue
                            
                            # 设置下载监听
                            async with page.expect_download(timeout=120000) as download_info:
                                # 点击下载按钮
                                await element.click()
                                print(f"✓ 成功点击'下载报表'按钮（使用选择器 {idx + 1}）")
                            
                            # 等待下载完成
                            download = await download_info.value
                            
                            # 保存文件
                            filename = download.suggested_filename
                            filepath = os.path.join(download_dir, filename)
                            await download.save_as(filepath)
                            
                            print(f"✓ 文件下载成功: {filepath}")
                            
                            download_clicked = True
                            
                            return {
                                "success": True,
                                "filepath": filepath,
                                "filename": filename,
                                "message": "下架商品Excel下载成功"
                            }
                            
                    except Exception as e:
                        print(f"  ⚠ 选择器 {idx + 1} 失败: {str(e)}")
                        continue
                
                if not download_clicked:
                    return {
                        "success": False,
                        "message": "未能找到或点击'下载报表'按钮"
                    }
                    
            except Exception as e:
                print(f"✗ 下载文件失败: {str(e)}")
                import traceback
                traceback.print_exc()
                return {
                    "success": False,
                    "message": f"下载失败: {str(e)}"
                }
            
            return {
                "success": False,
                "message": "下载失败"
            }
            
        except Exception as e:
            print(f"✗ 下载下架商品Excel失败: {str(e)}")
            return {
                "success": False,
                "message": f"下载失败: {str(e)}"
            }
        finally:
            if page:
                await page.close()
    
    @staticmethod
    def parse_offline_products_excel(filepath: str) -> List[Dict]:
        """
        解析下架商品Excel文件
        
        Args:
            filepath: Excel文件路径
            
        Returns:
            商品列表（product_status=2 下架）
        """
        # TODO: 实现解析逻辑，设置 product_status=2
        pass
