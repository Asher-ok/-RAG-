"""
商品信息抓取器
通过Playwright从抖店后台抓取商品列表
"""
from typing import Optional, Dict, List
from playwright.async_api import Page, BrowserContext
import asyncio
import json
import os
import pandas as pd
from pathlib import Path
import time


class ProductScraper:
    """商品信息抓取器"""
    
    @staticmethod
    async def download_product_excel(
        context: BrowserContext,
        download_dir: str = None
    ) -> Dict:
        """
        通过导出记录下载商品Excel文件
        
        Args:
            context: 已登录的浏览器上下文
            download_dir: 下载目录，默认为backend/downloads
            
        Returns:
            下载结果，包含文件路径
        """
        page = None
        try:
            if download_dir is None:
                # 设置下载目录为 backend/downloads
                download_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../downloads"))
                # 确保目录存在
                os.makedirs(download_dir, exist_ok=True)
            
            page = await context.new_page()
            
            # 设置视口大小（确保页面完整显示）
            await page.set_viewport_size({"width": 1920, "height": 1080})
            
            # 先访问首页，确保登录状态有效
            print(f"\n[商品导出] 先访问首页验证登录状态...")
            homepage_url = "https://fxg.jinritemai.com/ffa/mshop/homepage/index"
            await page.goto(homepage_url, wait_until="domcontentloaded", timeout=60000)  # 60秒
            await asyncio.sleep(5)  # 等待5秒
            
            # 打印当前URL用于调试
            current_url = page.url
            print(f"[调试] 访问首页后的URL: {current_url}")
            
            # 检查是否在登录页面
            if "/login" in current_url:
                print(f"⚠ 登录状态已过期")
                return {
                    "success": False,
                    "message": "登录状态已过期，请重新登录"
                }
            
            print(f"✓ 登录状态有效")
            
            # 直接访问导出记录页面
            print(f"[商品导出] 访问导出记录页面...")
            export_record_url = "https://fxg.jinritemai.com/ffa/g/excel"
            await page.goto(export_record_url, wait_until="domcontentloaded", timeout=60000)  # 60秒
            
            # 等待30秒，让导出任务完成
            print(f"[商品导出] 等待30秒，让导出任务完成...")
            await asyncio.sleep(30)
            
            # 检查是否跳转到登录页面
            current_url = page.url
            print(f"✓ 当前URL: {current_url}")
            
            if "/login" in current_url:
                print(f"⚠ 检测到跳转到登录页面")
                return {
                    "success": False,
                    "message": "无法访问导出记录页面，可能需要特殊权限"
                }
            
            print(f"✓ 已进入导出记录页面")
            
            # 等待表格加载（延长超时时间到2分钟）
            try:
                print(f"[商品导出] 等待表格加载...")
                await page.wait_for_selector("table, [class*='table'], [class*='Table']", timeout=120000)  # 120秒
                print(f"✓ 导出记录表格已加载")
            except Exception as e:
                print(f"⚠ 等待表格加载超时: {str(e)}")
                # 即使超时也继续尝试，可能表格已经加载但选择器不匹配
            
            await asyncio.sleep(5)  # 等待5秒
            
            # 获取最新导出记录的时间
            latest_export_time = None
            try:
                latest_export_time = await page.evaluate('''() => {
                    const firstCell = document.querySelector('.ecom-g-table-cell');
                    return firstCell ? firstCell.textContent.trim() : null;
                }''')
                if latest_export_time:
                    print(f"✓ 最新导出记录时间: {latest_export_time}")
            except:
                pass
            
            # 查找最新的导出记录并点击"下载报表"
            print(f"[商品导出] 查找最新的导出记录...")
            try:
                # 查找第一行的"下载报表"按钮
                download_selectors = [
                    "text=下载报表",
                    "a:has-text('下载报表')",
                    "button:has-text('下载报表')",
                    "[class*='download']:has-text('报表')"
                ]
                
                # 设置下载监听（延长超时到2分钟）
                download_promise = page.wait_for_event("download", timeout=120000)  # 120秒
                
                # 点击第一个"下载报表"按钮
                clicked = False
                for selector in download_selectors:
                    try:
                        # 获取所有匹配的元素，点击第一个
                        elements = await page.query_selector_all(selector)
                        if elements:
                            await elements[0].click()
                            clicked = True
                            print(f"✓ 成功点击'下载报表'按钮")
                            break
                    except:
                        continue
                
                if not clicked:
                    return {
                        "success": False,
                        "message": "未找到'下载报表'按钮"
                    }
                
                # 等待下载完成
                print(f"[商品导出] 等待文件下载...")
                download = await download_promise
                
                # 保存文件
                filename = download.suggested_filename
                filepath = os.path.join(download_dir, filename)
                await download.save_as(filepath)
                
                print(f"✓ 文件下载成功: {filepath}")
                
                return {
                    "success": True,
                    "filepath": filepath,
                    "filename": filename,
                    "latest_export_time": latest_export_time
                }
                
            except Exception as e:
                print(f"✗ 下载报表失败: {str(e)}")
                import traceback
                traceback.print_exc()
                return {
                    "success": False,
                    "message": f"下载失败: {str(e)}"
                }
            
        except Exception as e:
            print(f"✗ 导出商品Excel失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"导出失败: {str(e)}"
            }
        
        finally:
            if page:
                await page.close()
    
    @staticmethod
    def parse_product_excel(filepath: str) -> List[Dict]:
        """
        解析商品Excel文件
        
        Args:
            filepath: Excel文件路径
            
        Returns:
            商品列表
        """
        try:
            print(f"\n[Excel解析] 读取文件: {filepath}")
            
            # 读取Excel文件
            df = pd.read_excel(filepath)
            
            print(f"✓ 读取到 {len(df)} 条商品记录")
            print(f"✓ 列名: {df.columns.tolist()}")
            
            products = []
            
            # 按商品ID分组（因为一个商品可能有多个SKU）
            grouped = df.groupby('商品ID')
            
            for product_id, group in grouped:
                try:
                    # 取第一行作为商品基本信息
                    first_row = group.iloc[0]
                    
                    # 构建SKU列表
                    sku_list = []
                    for _, row in group.iterrows():
                        sku = {
                            "sku_id": str(row.get('规格ID（SKUID）', '')),
                            "merchant_code": str(row.get('商家SKU编码', '')),
                            "spec": str(row.get('商品规格', '')),
                            "price": float(row.get('商品价格', 0)),
                            "stock": int(row.get('现货可售', 0)),
                            "presale_stock": int(row.get('预售库存', 0))
                        }
                        sku_list.append(sku)
                    
                    # 计算总库存和平均价格
                    total_stock = sum(sku['stock'] for sku in sku_list)
                    avg_price = sum(sku['price'] for sku in sku_list) / len(sku_list) if sku_list else 0
                    
                    # 商品类型转换：文本转整数
                    product_type_str = str(first_row.get('商品类型', '普通商品'))
                    if '虚拟' in product_type_str:
                        product_type = 2
                    else:
                        product_type = 1  # 默认为普通商品
                    
                    # 审核状态转换：文本转整数
                    audit_status_str = str(first_row.get('商品审核状态', ''))
                    if '通过' in audit_status_str or '审核通过' in audit_status_str:
                        audit_status = 1
                    elif '拒绝' in audit_status_str or '审核拒绝' in audit_status_str:
                        audit_status = 2
                    else:
                        audit_status = 0  # 默认为待审核
                    
                    # 商品状态转换：根据审核状态判断
                    # "商品审核通过" → product_status = 1 (上架)
                    # "商品未提交" → product_status = 2 (下架)
                    if '审核通过' in audit_status_str or '通过' in audit_status_str:
                        product_status = 1  # 上架
                    elif '未提交' in audit_status_str:
                        product_status = 2  # 下架
                    else:
                        product_status = 0  # 草稿或其他状态
                    
                    # 构建商品数据
                    product = {
                        "product_id": str(product_id),
                        "title": str(first_row.get('商品名称', '')),
                        # 类目ID - Excel中可能没有，使用默认值"0"
                        "first_cid": str(first_row.get('一级类目ID', '0')),
                        "second_cid": str(first_row.get('二级类目ID', '0')),
                        "third_cid": str(first_row.get('三级类目ID', '0')),
                        "fourth_cid": str(first_row.get('四级类目ID', '')) if pd.notna(first_row.get('四级类目ID')) else None,
                        # 类目名称
                        "first_cname": str(first_row.get('一级类目', '')),
                        "second_cname": str(first_row.get('二级类目', '')),
                        "third_cname": str(first_row.get('三级类目', '')),
                        "fourth_cname": str(first_row.get('四级类目', '')) if pd.notna(first_row.get('四级类目')) else None,
                        "product_type": product_type,
                        "product_group": str(first_row.get('商品分组', '')) if pd.notna(first_row.get('商品分组')) else None,
                        "merchant_code": str(first_row.get('商家编码', '')) if pd.notna(first_row.get('商家编码')) else None,
                        "item_number": str(first_row.get('货号', '')) if pd.notna(first_row.get('货号')) else None,
                        "price": avg_price,
                        "stock": total_stock,
                        "available_stock": total_stock,
                        "presale_stock": int(first_row.get('预售库存', 0)),
                        "ladder_stock": str(first_row.get('阶梯库存', '')) if pd.notna(first_row.get('阶梯库存')) else None,
                        "delivery_time": int(first_row.get('商品发货时间', 1)),
                        "sales_count": int(first_row.get('销量', 0)),
                        "commission_rate": float(first_row.get('佣金比例', 0)) if pd.notna(first_row.get('佣金比例')) else None,
                        "audit_status": audit_status,
                        "product_url": str(first_row.get('商品链接', '')) if pd.notna(first_row.get('商品链接')) else None,
                        "product_status": product_status,  # 根据审核状态动态判断
                        "sku_list": sku_list,
                        "images": []  # Excel中没有图片信息
                    }
                    
                    products.append(product)
                    
                except Exception as e:
                    print(f"⚠ 解析商品 {product_id} 失败: {str(e)}")
                    continue
            
            print(f"✓ 成功解析 {len(products)} 个商品")
            return products
            
        except Exception as e:
            print(f"✗ 解析Excel文件失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    async def get_product_list(
        context: BrowserContext,
        page_no: int = 1,
        page_size: int = 20,
        product_status: Optional[int] = None
    ) -> Dict:
        """
        获取商品列表
        
        Args:
            context: 已登录的浏览器上下文
            page_no: 页码
            page_size: 每页数量
            product_status: 商品状态筛选
            
        Returns:
            商品列表数据
        """
        page = None
        try:
            page = await context.new_page()
            
            # 先访问首页确保登录状态有效
            print(f"\n[商品抓取] 先访问首页验证登录状态...")
            homepage_url = "https://fxg.jinritemai.com/ffa/mshop/homepage/index"
            try:
                await page.goto(homepage_url, wait_until="domcontentloaded", timeout=60000)  # 60秒
                await asyncio.sleep(5)  # 等待5秒
                
                # 检查是否跳转到登录页
                if "login" in page.url:
                    print(f"✗ 登录状态已失效，需要重新登录")
                    return {
                        "success": False,
                        "message": "登录状态已失效，请重新登录"
                    }
                print(f"✓ 登录状态有效")
            except Exception as e:
                print(f"⚠ 访问首页失败: {str(e)}")
            
            # 构建商品列表URL - 使用正确的抖店商品管理页面
            product_list_url = "https://fxg.jinritemai.com/ffa/g/list?tab=all"
            
            print(f"[商品抓取] 访问商品列表页面: {product_list_url}")
            try:
                # 使用domcontentloaded而不是load，更快（延长超时到60秒）
                await page.goto(product_list_url, wait_until="domcontentloaded", timeout=60000)  # 60秒
            except Exception as e:
                print(f"⚠ 页面加载超时，尝试继续: {str(e)}")
            
            # 等待页面渲染（延长等待时间）
            print(f"⏳ 等待页面渲染...")
            await asyncio.sleep(8)  # 等待8秒
            
            # 检查当前URL
            current_url = page.url
            if "login" in current_url:
                print(f"✗ 被重定向到登录页，Cookie已失效")
                return {
                    "success": False,
                    "message": "登录状态已失效，请重新登录"
                }
            
            print(f"✓ 当前URL: {current_url}")
            
            # 直接从页面DOM中提取商品数据
            print(f"[商品抓取] 从页面DOM提取商品数据...")
            products = await ProductScraper._scrape_from_dom(page)
            total = len(products)
            
            print(f"✓ 从页面提取到 {len(products)} 个商品")
            
            # 应用筛选和分页
            if product_status is not None:
                products = [p for p in products if p.get("product_status") == product_status]
            
            # 分页
            start_idx = (page_no - 1) * page_size
            end_idx = start_idx + page_size
            paginated_products = products[start_idx:end_idx]
            
            return {
                "success": True,
                "total": total,
                "page_no": page_no,
                "page_size": page_size,
                "list": paginated_products
            }
            
        except Exception as e:
            print(f"✗ 抓取商品列表失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "message": f"抓取失败: {str(e)}"
            }
        
        finally:
            if page:
                await page.close()
    
    @staticmethod
    async def _scrape_from_dom(page: Page) -> List[Dict]:
        """
        从页面DOM中提取商品数据
        
        Args:
            page: 页面实例
            
        Returns:
            商品列表
        """
        products = []
        
        try:
            # 先打印页面结构用于调试
            page_info = await page.evaluate("""
                () => {
                    // 查找可能的商品容器
                    const possibleContainers = [
                        'table tbody tr',
                        '[class*="list"] [class*="item"]',
                        '[class*="product"]',
                        '[class*="goods"]',
                        '.ant-table-tbody tr',
                        '[role="row"]'
                    ];
                    
                    let foundSelector = null;
                    let foundCount = 0;
                    
                    for (const selector of possibleContainers) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 0) {
                            foundSelector = selector;
                            foundCount = elements.length;
                            break;
                        }
                    }
                    
                    // 获取页面中所有可能包含商品信息的元素
                    const allText = document.body.innerText;
                    const hasProducts = allText.includes('商品') || allText.includes('标题') || allText.includes('价格');
                    
                    return {
                        foundSelector,
                        foundCount,
                        hasProducts,
                        bodyClasses: document.body.className,
                        mainContent: document.querySelector('main')?.className || 'no-main'
                    };
                }
            """)
            
            print(f"[调试] 页面信息: {json.dumps(page_info, ensure_ascii=False)}")
            
            # 执行JS提取数据 - 使用更智能的选择器
            products_data = await page.evaluate("""
                () => {
                    const products = [];
                    
                    // 尝试多种可能的选择器策略
                    const strategies = [
                        // 策略1: 表格行
                        () => {
                            const rows = document.querySelectorAll('table tbody tr, .ant-table-tbody tr, [role="row"]');
                            const results = [];
                            rows.forEach(row => {
                                // 跳过空行或标题行
                                if (!row.textContent.trim() || row.querySelector('th')) return;
                                
                                const cells = row.querySelectorAll('td, [role="cell"]');
                                if (cells.length < 3) return;
                                
                                // 提取图片
                                const img = row.querySelector('img');
                                const image_url = img ? img.src : '';
                                
                                // 提取所有文本内容
                                const texts = Array.from(cells).map(cell => cell.textContent.trim());
                                
                                // 查找商品ID（通常是数字）
                                let product_id = '';
                                for (const text of texts) {
                                    if (/^\d{10,}$/.test(text)) {
                                        product_id = text;
                                        break;
                                    }
                                }
                                
                                // 查找标题（通常是较长的文本）
                                let title = '';
                                for (const text of texts) {
                                    if (text.length > 5 && text.length < 200 && !text.match(/^[\d.,¥]+$/)) {
                                        title = text;
                                        break;
                                    }
                                }
                                
                                // 查找价格（包含¥或纯数字）
                                let price = '0';
                                for (const text of texts) {
                                    if (text.includes('¥') || /^\d+(\.\d+)?$/.test(text)) {
                                        price = text.replace('¥', '').replace(',', '');
                                        break;
                                    }
                                }
                                
                                // 查找库存
                                let stock = '0';
                                for (const text of texts) {
                                    if (/^\d+$/.test(text) && parseInt(text) < 100000) {
                                        stock = text;
                                    }
                                }
                                
                                if (title) {
                                    results.push({
                                        product_id: product_id || `temp_${Date.now()}_${results.length}`,
                                        title,
                                        price,
                                        stock,
                                        image_url,
                                        product_status: 1
                                    });
                                }
                            });
                            return results;
                        },
                        
                        // 策略2: 卡片布局
                        () => {
                            const cards = document.querySelectorAll('[class*="card"], [class*="item"]');
                            const results = [];
                            cards.forEach(card => {
                                const title = card.querySelector('[class*="title"], [class*="name"]')?.textContent?.trim();
                                const price = card.querySelector('[class*="price"]')?.textContent?.trim();
                                const img = card.querySelector('img');
                                
                                if (title) {
                                    results.push({
                                        product_id: `temp_${Date.now()}_${results.length}`,
                                        title,
                                        price: price ? price.replace('¥', '').replace(',', '') : '0',
                                        stock: '0',
                                        image_url: img ? img.src : '',
                                        product_status: 1
                                    });
                                }
                            });
                            return results;
                        }
                    ];
                    
                    // 尝试每种策略，返回第一个有结果的
                    for (const strategy of strategies) {
                        try {
                            const results = strategy();
                            if (results.length > 0) {
                                console.log(`找到 ${results.length} 个商品`);
                                return results;
                            }
                        } catch (e) {
                            console.error('策略执行失败:', e);
                        }
                    }
                    
                    return [];
                }
            """)
            
            print(f"[调试] JS提取到 {len(products_data)} 条原始数据")
            
            # 清理和标准化数据
            for idx, item in enumerate(products_data):
                try:
                    # 清理价格
                    price_str = str(item.get("price", "0")).replace("¥", "").replace(",", "").strip()
                    # 提取数字部分
                    import re
                    price_match = re.search(r'[\d.]+', price_str)
                    if price_match:
                        price = float(price_match.group())
                    else:
                        price = 0
                    
                    # 清理库存
                    stock_str = str(item.get("stock", "0")).replace(",", "").strip()
                    stock_match = re.search(r'\d+', stock_str)
                    if stock_match:
                        stock = int(stock_match.group())
                    else:
                        stock = 0
                    
                    product = {
                        "product_id": item.get("product_id", ""),
                        "title": item.get("title", ""),
                        "price": price,
                        "stock": stock,
                        "product_status": item.get("product_status", 1),
                        "image_url": item.get("image_url", ""),
                        "create_time": ""
                    }
                    
                    if product["title"]:  # 只添加有标题的商品
                        products.append(product)
                        if idx < 3:  # 打印前3个商品用于调试
                            print(f"  商品{idx+1}: {product['title'][:30]}... (价格: ¥{product['price']}, 库存: {product['stock']})")
                
                except Exception as e:
                    print(f"⚠ 清理商品{idx+1}数据失败: {str(e)}")
                    continue
        
        except Exception as e:
            print(f"⚠ 从DOM提取失败: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return products
    
    @staticmethod
    async def get_product_detail(
        context: BrowserContext,
        product_id: str
    ) -> Dict:
        """
        获取商品详情
        
        Args:
            context: 已登录的浏览器上下文
            product_id: 商品ID
            
        Returns:
            商品详情数据
        """
        page = None
        try:
            page = await context.new_page()
            
            # 访问商品详情页（延长超时到60秒）
            detail_url = f"https://fxg.jinritemai.com/ffa/mshop/shopProduct/edit?id={product_id}"
            
            print(f"\n[商品详情] 访问商品详情页面...")
            await page.goto(detail_url, timeout=60000)  # 60秒
            await asyncio.sleep(5)  # 等待5秒
            
            # TODO: 实现商品详情提取逻辑
            
            return {
                "success": True,
                "product_id": product_id
            }
            
        except Exception as e:
            print(f"✗ 获取商品详情失败: {str(e)}")
            return {
                "success": False,
                "message": f"获取失败: {str(e)}"
            }
        
        finally:
            if page:
                await page.close()
