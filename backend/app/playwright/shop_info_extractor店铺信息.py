"""
店铺信息提取器
从抖店后台页面提取店铺信息
"""
from typing import Optional, Dict
from playwright.async_api import Page
import asyncio


class ShopInfoExtractor:
    """店铺信息提取器"""
    
    @staticmethod
    async def extract_shop_info(page: Page) -> Optional[Dict]:
        """
        从抖店后台页面提取店铺信息
        
        Args:
            page: 已登录的页面实例
            
        Returns:
            店铺信息字典，包含shop_id和shop_name
        """
        try:
            # 等待页面加载完成
            await asyncio.sleep(3)
            
            current_url = page.url
            shop_id = None
            shop_name = None
            
            print(f"\n{'='*60}")
            print(f"[提取店铺信息] 开始提取...")
            print(f"[提取店铺信息] 当前URL: {current_url}")
            print(f"{'='*60}\n")
            
            # 方法1：从Cookie中提取shop_id（最可靠）
            cookies = await page.context.cookies()
            print(f"[调试] 当前Cookie数量: {len(cookies)}")
            
            # 打印所有Cookie名称用于调试
            cookie_names = [c['name'] for c in cookies]
            print(f"[调试] Cookie名称列表: {cookie_names[:20]}")  # 只打印前20个
            
            for cookie in cookies:
                if cookie['name'] == 'ecom_gray_shop_id':
                    shop_id = cookie['value']
                    print(f"✓ 从Cookie提取到店铺ID: {shop_id}")
                    break
            
            # 方法2：从URL中提取shop_id
            if not shop_id and "shop_id=" in current_url:
                import re
                match = re.search(r'shop_id=(\d+)', current_url)
                if match:
                    shop_id = match.group(1)
                    print(f"✓ 从URL提取到店铺ID: {shop_id}")
            
            # 方法3：从页面JavaScript变量中提取（优先提取店铺名称）
            try:
                print(f"\n[调试] 尝试从JS变量提取店铺信息...")
                js_data = await page.evaluate("""
                    () => {
                        // 尝试从全局变量获取
                        const shopId = window.shopId || window.shop_id || 
                                      (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.shopId);
                        const shopName = window.shopName || window.shop_name ||
                                        (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.shopName);
                        
                        // 从localStorage获取
                        let localShopId = null;
                        let localShopName = null;
                        try {
                            const shopInfo = localStorage.getItem('shopInfo') || 
                                           localStorage.getItem('shop_info') ||
                                           localStorage.getItem('ecom_shop_info');
                            if (shopInfo) {
                                const info = JSON.parse(shopInfo);
                                localShopId = info.shop_id || info.shopId;
                                localShopName = info.shop_name || info.shopName || info.name;
                            }
                        } catch(e) {
                            console.error('localStorage解析失败:', e);
                        }
                        
                        // 从sessionStorage获取
                        let sessionShopId = null;
                        let sessionShopName = null;
                        try {
                            const shopInfo = sessionStorage.getItem('shopInfo') || 
                                           sessionStorage.getItem('shop_info');
                            if (shopInfo) {
                                const info = JSON.parse(shopInfo);
                                sessionShopId = info.shop_id || info.shopId;
                                sessionShopName = info.shop_name || info.shopName || info.name;
                            }
                        } catch(e) {}
                        
                        return {
                            shopId: shopId || localShopId || sessionShopId,
                            shopName: shopName || localShopName || sessionShopName
                        };
                    }
                """)
                
                print(f"[调试] JS提取结果: {js_data}")
                
                if js_data.get('shopId') and not shop_id:
                    shop_id = str(js_data['shopId'])
                    print(f"✓ 从JS变量提取到店铺ID: {shop_id}")
                if js_data.get('shopName'):
                    shop_name = js_data['shopName']
                    print(f"✓ 从JS变量提取到店铺名称: {shop_name}")
            except Exception as e:
                print(f"⚠ JS提取失败: {str(e)}")
            
            # 方法4：从页面元素中提取店铺名称（增强版）
            if not shop_name:
                print(f"\n[调试] 尝试从页面元素提取店铺名称...")
                selectors = [
                    # 抖店特定选择器（优先级高）
                    'div[class*="ShopInfo"] span[class*="name"]',
                    'div[class*="shop-info"] span[class*="name"]',
                    'div[class*="header"] span[class*="shop"]',
                    '.shop-name',
                    '[class*="shop-name"]',
                    '[class*="shopName"]',
                    '.header-shop-name',
                    '[data-testid="shop-name"]',
                    '.shop-info .name',
                    '.header .shop',
                    # 通用选择器
                    '[class*="ShopInfo"]',
                    '[class*="shop-info"]',
                    'div[class*="name"]',
                    'span[class*="name"]',
                    # 标题选择器
                    'h1', 'h2', 'h3'
                ]
                
                for selector in selectors:
                    try:
                        elements = await page.query_selector_all(selector)
                        for element in elements:
                            text = await element.inner_text()
                            text = text.strip()
                            
                            # 过滤条件：
                            # 1. 长度在2-50之间
                            # 2. 不是纯数字（排除ID）
                            # 3. 不是常见的导航文本
                            # 4. 包含中文字符（店铺名称通常有中文）
                            if text and 2 <= len(text) <= 50:
                                # 排除纯数字
                                if text.isdigit():
                                    continue
                                
                                # 排除常见的非店铺名称文本
                                excluded_texts = [
                                    '首页', '商品', '订单', '数据', '店铺', '设置', '帮助',
                                    '工作台', '营销', '客服', '财务', '物流', '售后',
                                    '商品管理', '订单管理', '数据中心', '店铺装修',
                                    '退出', '登录', '注册', '确定', '取消', '保存'
                                ]
                                if text in excluded_texts:
                                    continue
                                
                                # 检查是否包含中文字符（店铺名称通常有中文）
                                has_chinese = any('\u4e00' <= char <= '\u9fff' for char in text)
                                
                                if has_chinese:
                                    shop_name = text
                                    print(f"✓ 从页面元素提取到店铺名称: {shop_name} (选择器: {selector})")
                                    break
                        
                        if shop_name:
                            break
                    except Exception as e:
                        print(f"⚠ 选择器 {selector} 提取失败: {str(e)}")
                        continue
            
            # 方法5：尝试从页面标题提取
            if not shop_name:
                try:
                    print(f"\n[调试] 尝试从页面标题提取店铺名称...")
                    title = await page.title()
                    print(f"[调试] 页面标题: {title}")
                    
                    # 从标题中提取店铺名称（通常格式：店铺名称 - 抖店）
                    if title and '-' in title:
                        parts = title.split('-')
                        potential_name = parts[0].strip()
                        
                        # 验证是否是有效的店铺名称
                        if 2 <= len(potential_name) <= 50 and not potential_name.isdigit():
                            has_chinese = any('\u4e00' <= char <= '\u9fff' for char in potential_name)
                            if has_chinese:
                                shop_name = potential_name
                                print(f"✓ 从页面标题提取到店铺名称: {shop_name}")
                except Exception as e:
                    print(f"⚠ 从标题提取失败: {str(e)}")
            
            # 如果还是没有shop_id，使用Cookie中的uid作为标识
            if not shop_id:
                print(f"\n[调试] 未找到shop_id，尝试使用会话ID生成...")
                for cookie in cookies:
                    if cookie['name'] in ['uid_tt', 'sessionid', 'sid_tt']:
                        import hashlib
                        shop_id = hashlib.md5(cookie['value'].encode()).hexdigest()[:16]
                        print(f"✓ 使用会话ID生成店铺标识: {shop_id}")
                        break
            
            # 验证结果
            print(f"\n{'='*60}")
            print(f"[提取结果]")
            print(f"  店铺ID: {shop_id}")
            print(f"  店铺名称: {shop_name}")
            print(f"{'='*60}\n")
            
            # 如果没有shop_name，使用默认名称（但要确保不是纯数字）
            if not shop_name:
                if shop_id:
                    shop_name = f"抖店_{shop_id[:8]}"
                else:
                    shop_name = "未命名店铺"
                print(f"⚠ 使用默认店铺名称: {shop_name}")
            
            # 最终验证：确保shop_name不是纯数字或shop_id
            if shop_name and (shop_name.isdigit() or shop_name == shop_id):
                print(f"⚠ 检测到店铺名称异常（纯数字或等于ID），使用默认名称")
                shop_name = f"抖店_{shop_id[:8]}" if shop_id else "未命名店铺"
            
            if shop_id:
                result = {
                    "shop_id": shop_id,
                    "shop_name": shop_name,
                    "url": current_url
                }
                print(f"✓ 店铺信息提取成功: {result}")
                return result
            else:
                print(f"✗ 未能提取到店铺ID")
                return None
            
        except Exception as e:
            print(f"✗ 提取店铺信息失败: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    async def wait_for_login_complete(page: Page, timeout: int = 120) -> bool:
        """
        等待登录完成
        
        Args:
            page: 页面实例
            timeout: 超时时间（秒）
            
        Returns:
            是否登录成功
        """
        try:
            check_interval = 2
            max_checks = timeout // check_interval
            
            for i in range(max_checks):
                await asyncio.sleep(check_interval)
                
                current_url = page.url
                
                # 方法1：检查是否进入首页（最常见的登录后页面）
                if "/ffa/mshop/homepage/index" in current_url:
                    print(f"✓ 检测到登录成功（进入首页）")
                    return True
                
                # 方法2：检查URL是否已经不在登录页面
                if "fxg.jinritemai.com" in current_url and "/login" not in current_url:
                    # 进一步验证：检查是否有登录后的Cookie
                    cookies = await page.context.cookies()
                    has_session = any(c['name'] in ['sessionid', 'sid_tt', 'ucas_c0', 'ecom_gray_shop_id'] for c in cookies)
                    
                    if has_session:
                        print(f"✓ 检测到登录成功（已离开登录页面且有会话Cookie）")
                        return True
                
                # 方法3：检查特定的后台页面
                if "fxg.jinritemai.com" in current_url and any(keyword in current_url for keyword in [
                    "/ffa/", "/index", "/workbench", "/home", "/dashboard", 
                    "/shop", "/product", "/order", "/data", "/mshop"
                ]):
                    print(f"✓ 检测到登录成功（进入后台页面）")
                    return True
                
                # 方法4：检查页面标题
                try:
                    title = await page.title()
                    if title and "登录" not in title and ("抖店" in title or "商家" in title):
                        print(f"✓ 检测到登录成功（页面标题：{title}）")
                        return True
                except:
                    pass
                
                # 显示进度
                if (i + 1) % 5 == 0:
                    print(f"⏳ 已等待 {(i + 1) * check_interval} 秒... (当前URL: {current_url[:60]}...)")
            
            # 超时后再做最后一次检查
            print(f"\n⚠ 等待超时，进行最后验证...")
            current_url = page.url
            if "/login" not in current_url and "fxg.jinritemai.com" in current_url:
                cookies = await page.context.cookies()
                has_session = any(c['name'] in ['sessionid', 'sid_tt', 'ucas_c0', 'ecom_gray_shop_id'] for c in cookies)
                if has_session:
                    print(f"✓ 最后验证：检测到登录成功（有会话Cookie）")
                    return True
            
            return False
            
        except Exception as e:
            print(f"✗ 等待登录失败: {str(e)}")
            return False
