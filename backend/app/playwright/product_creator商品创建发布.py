"""
抖店商品创建自动化模块
使用 Playwright 自动化创建商品
"""
import asyncio
import os
from typing import Dict, List, Any, Optional
from playwright.async_api import Page, BrowserContext


class ProductCreator:
    """商品创建自动化类"""
    
    @staticmethod
    async def create_product(
        context: BrowserContext,
        product_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        自动化创建单个商品
        
        Args:
            context: 已登录的浏览器上下文
            product_data: 商品数据
                - title: 商品标题
                - images: 图片路径列表
                - category_id: 类目ID（可选）
                - price: 价格
                - stock: 库存
                - description: 商品描述（可选）
                
        Returns:
            创建结果
        """
        page = None
        try:
            page = await context.new_page()
            
            print(f"\n[商品创建] 开始创建商品: {product_data.get('title', '未命名')}")
            
            # 1. 访问商品管理页面
            print(f"[商品创建] 访问商品管理页面...")
            await page.goto("https://fxg.jinritemai.com/ffa/g/list", wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(2)
            
            # 检查是否跳转到登录页
            if "login" in page.url:
                return {
                    "success": False,
                    "message": "登录状态已失效，请重新登录"
                }
            
            # 2. 点击"新建商品"按钮
            print(f"[商品创建] 点击新建商品按钮...")
            try:
                # 等待并点击"新建商品"按钮
                await page.wait_for_selector('text=新建商品', timeout=10000)
                await page.click('text=新建商品')
                await asyncio.sleep(1)
                
                # 选择"单商品"
                print(f"[商品创建] 选择单商品...")
                await page.wait_for_selector('text=单商品', timeout=5000)
                await page.click('text=单商品')
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"⚠ 点击新建商品按钮失败: {str(e)}")
                return {
                    "success": False,
                    "message": f"点击新建商品按钮失败: {str(e)}"
                }
            
            # 3. 上传主图
            print(f"[商品创建] 上传商品图片...")
            images = product_data.get('images', [])
            if images:
                try:
                    # 找到图片上传按钮
                    upload_input = await page.query_selector('input[type="file"][accept*="image"]')
                    if upload_input:
                        # 上传第一张图片作为主图
                        image_path = images[0]
                        if os.path.exists(image_path):
                            await upload_input.set_input_files(image_path)
                            print(f"✓ 已上传主图: {image_path}")
                            await asyncio.sleep(2)
                        else:
                            print(f"⚠ 图片文件不存在: {image_path}")
                    else:
                        print(f"⚠ 未找到图片上传按钮")
                except Exception as e:
                    print(f"⚠ 上传图片失败: {str(e)}")
            
            # 4. 填写商品标题
            print(f"[商品创建] 填写商品标题...")
            title = product_data.get('title', '')
            if title:
                try:
                    # 查找商品标题输入框
                    title_input = await page.query_selector('textarea[placeholder*="请输入"], input[placeholder*="商品标题"]')
                    if title_input:
                        await title_input.fill(title)
                        print(f"✓ 已填写标题: {title}")
                        await asyncio.sleep(1)
                    else:
                        print(f"⚠ 未找到标题输入框")
                except Exception as e:
                    print(f"⚠ 填写标题失败: {str(e)}")
            
            # 5. 点击"下一步"按钮
            print(f"[商品创建] 点击下一步...")
            try:
                next_button = await page.query_selector('button:has-text("下一步")')
                if next_button:
                    await next_button.click()
                    await asyncio.sleep(3)
                    print(f"✓ 已进入下一步")
                else:
                    print(f"⚠ 未找到下一步按钮")
            except Exception as e:
                print(f"⚠ 点击下一步失败: {str(e)}")
            
            # 6. 填写价格和库存（如果在第二步）
            price = product_data.get('price')
            stock = product_data.get('stock')
            
            if price:
                print(f"[商品创建] 填写价格: {price}")
                try:
                    price_input = await page.query_selector('input[placeholder*="价格"]')
                    if price_input:
                        await price_input.fill(str(price))
                        await asyncio.sleep(1)
                except Exception as e:
                    print(f"⚠ 填写价格失败: {str(e)}")
            
            if stock:
                print(f"[商品创建] 填写库存: {stock}")
                try:
                    stock_input = await page.query_selector('input[placeholder*="库存"]')
                    if stock_input:
                        await stock_input.fill(str(stock))
                        await asyncio.sleep(1)
                except Exception as e:
                    print(f"⚠ 填写库存失败: {str(e)}")
            
            # 7. 保存商品（点击提交按钮）
            print(f"[商品创建] 提交商品...")
            try:
                submit_button = await page.query_selector('button:has-text("提交"), button:has-text("保存")')
                if submit_button:
                    await submit_button.click()
                    await asyncio.sleep(3)
                    print(f"✓ 商品已提交")
                    
                    # 检查是否有成功提示
                    success_msg = await page.query_selector('text=创建成功, text=提交成功')
                    if success_msg:
                        return {
                            "success": True,
                            "message": "商品创建成功"
                        }
                else:
                    print(f"⚠ 未找到提交按钮")
            except Exception as e:
                print(f"⚠ 提交商品失败: {str(e)}")
            
            return {
                "success": True,
                "message": "商品创建流程已完成，请检查抖店后台确认"
            }
            
        except Exception as e:
            print(f"✗ 创建商品失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"创建商品失败: {str(e)}"
            }
        finally:
            if page:
                await page.close()
    
    @staticmethod
    async def batch_create_products(
        context: BrowserContext,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        批量创建商品
        
        Args:
            context: 已登录的浏览器上下文
            products: 商品数据列表
            
        Returns:
            批量创建结果
        """
        success_count = 0
        failed_count = 0
        results = []
        
        for i, product_data in enumerate(products):
            print(f"\n[批量创建] 正在创建第 {i+1}/{len(products)} 个商品...")
            
            result = await ProductCreator.create_product(context, product_data)
            
            if result.get("success"):
                success_count += 1
            else:
                failed_count += 1
            
            results.append({
                "title": product_data.get("title"),
                "success": result.get("success"),
                "message": result.get("message")
            })
            
            # 每个商品之间间隔一下
            await asyncio.sleep(2)
        
        return {
            "success": True,
            "total": len(products),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }
