"""
步骤2: 访问商品列表页

功能：
1. 启动浏览器（无头模式）
2. 加载登录状态（Cookie和存储）
3. 访问商品列表页面
4. 检测是否被重定向到登录页
5. 支持重试机制（最多2次）

注意：
- URL: https://fxg.jinritemai.com/ffa/g/list
- 需要注入反检测脚本
- 监听网络请求和响应状态
"""

import asyncio


async def visit_product_list_page(browser_manager, account_id, shop_name):
    """
    访问商品列表页
    
    Args:
        browser_manager: BrowserManager实例
        account_id: 账号ID
        shop_name: 店铺名称
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'page': Page对象,
            'context': BrowserContext对象,
            'details': dict
        }
    """
    print(f"\n========== [步骤2] 访问商品列表页 ==========")
    
    context = None
    page = None
    
    try:
        # 2.1 启动浏览器
        print(f"[步骤2.1] 启动Chromium浏览器...")
        print(f"  → 模式: 无头模式 (headless=True)")
        print(f"  → 店铺: {shop_name}")
        print(f"  → 账号ID: {account_id}")
        
        await browser_manager.launch_browser(headless=True)
        
        print(f"  ✓ 浏览器启动成功")
        
        # 2.2 加载登录状态
        print(f"\n[步骤2.2] 加载登录状态...")
        print(f"  → 正在加载Cookie和存储状态...")
        print(f"  → 状态文件: ../states/account_{account_id}/state.json (项目根目录)")
        
        context = await browser_manager.create_context(account_id=account_id)
        
        print(f"  ✓ 浏览器上下文创建成功")
        
        # 2.3 检查加载的Cookie
        print(f"\n[步骤2.3] 检查加载的Cookie...")
        
        cookies = await context.cookies()
        cookie_count = len(cookies)
        
        print(f"  → Cookie总数: {cookie_count} 个")
        
        if cookie_count == 0:
            print(f"  ✗ 未加载到任何Cookie")
            await context.close()
            await browser_manager.stop()
            return {
                'success': False,
                'message': 'Cookie加载失败，请检查状态文件',
                'details': {
                    'cookie_count': 0
                }
            }
        
        # 统计Cookie域名分布
        cookie_domains = {}
        key_cookies = {}
        cookie_details = []
        
        for cookie in cookies:
            cookie_name = cookie.get('name', '')
            cookie_domain = cookie.get('domain', '')
            
            # 统计域名
            if cookie_domain not in cookie_domains:
                cookie_domains[cookie_domain] = 0
            cookie_domains[cookie_domain] += 1
            
            # 记录关键Cookie
            if any(key in cookie_name.lower() for key in ['token', 'session', 'auth', 'sid', 'passport']):
                expires_timestamp = cookie.get('expires', -1)
                
                if expires_timestamp > 0:
                    from datetime import datetime
                    try:
                        expires_date = datetime.fromtimestamp(expires_timestamp)
                        now = datetime.now()
                        days_left = (expires_date - now).days
                        cookie_details.append(f"{cookie_name}: 还剩{days_left}天过期")
                    except:
                        cookie_details.append(f"{cookie_name}: 无法解析过期时间")
                else:
                    cookie_details.append(f"{cookie_name}: 会话Cookie")
        
        # 输出域名分布
        domain_info = ", ".join([f"{domain}({count}个)" for domain, count in cookie_domains.items()])
        print(f"  → 域名分布: {domain_info}")
        
        # 输出关键Cookie
        if cookie_details:
            print(f"  → 关键Cookie:")
            for detail in cookie_details:
                print(f"    • {detail}")
        else:
            print(f"  ⚠ 未找到关键认证Cookie")
        
        print(f"  ✓ 登录状态加载成功")
        
        # 2.4 创建页面并注入反检测脚本
        print(f"\n[步骤2.4] 创建页面并注入反检测脚本...")
        
        page = await context.new_page()
        
        # 获取视口大小（从context中获取）
        viewport_size = await page.evaluate('() => ({ width: window.innerWidth, height: window.innerHeight })')
        print(f"  → 视口大小: {viewport_size['width']}x{viewport_size['height']}")
        
        # 注入增强的反检测脚本
        from app.playwright.anti_detection反检测脚本生成器 import get_enhanced_anti_detection_script
        anti_detection_script = get_enhanced_anti_detection_script()
        await page.add_init_script(anti_detection_script)
        
        print(f"  ✓ 反检测脚本注入成功")
        print(f"  → 防护项目: 24项")
        print(f"    • 隐藏webdriver特征")
        print(f"    • Canvas指纹混淆")
        print(f"    • WebGL指纹混淆")
        print(f"    • 真实浏览器环境模拟")
        print(f"    • 移除自动化痕迹")
        
        # 2.5 监听网络请求
        print(f"\n[步骤2.5] 设置网络监听...")
        
        response_status = None
        redirect_chain = []
        
        async def handle_response(response):
            nonlocal response_status
            if 'fxg.jinritemai.com' in response.url:
                response_status = response.status
                redirect_chain.append(f"{response.url} -> {response.status}")
        
        page.on('response', handle_response)
        
        print(f"  ✓ 网络监听已设置")
        
        # 2.6 访问商品列表页
        print(f"\n[步骤2.6] 访问商品列表页...")
        print(f"  → 目标URL: https://fxg.jinritemai.com/ffa/g/list")
        
        try:
            response = await page.goto(
                "https://fxg.jinritemai.com/ffa/g/list",
                wait_until="domcontentloaded",
                timeout=60000
            )
            
            final_status = response.status if response else "无响应"
            print(f"  → HTTP状态码: {final_status}")
            
            # 显示重定向链（最多显示最后3个）
            if redirect_chain:
                print(f"  → 重定向链:")
                for redirect in redirect_chain[-3:]:
                    print(f"    • {redirect}")
            else:
                print(f"  → 无重定向")
            
        except Exception as e:
            print(f"  ✗ 页面加载超时")
            print(f"  → 错误信息: {str(e)}")
            await page.close()
            await context.close()
            await browser_manager.stop()
            return {
                'success': False,
                'message': f'页面加载超时: {str(e)}',
                'details': {
                    'error': str(e)
                }
            }
        
        print(f"  ✓ 页面加载完成")
        
        # 2.7 等待页面稳定
        print(f"\n[步骤2.7] 等待页面稳定...")
        print(f"  → 等待3秒...")
        
        await asyncio.sleep(3)
        
        current_url = page.url
        print(f"  → 当前URL: {current_url}")
        
        # 2.8 检查页面状态
        print(f"\n[步骤2.8] 检查页面状态...")
        
        try:
            page_title = await page.title()
            print(f"  → 页面标题: {page_title}")
            
            # 检查是否有登录相关元素
            has_login_form = await page.evaluate('''() => {
                const loginKeywords = ['登录', 'login', '账号', '密码', 'password'];
                const bodyText = document.body.innerText.toLowerCase();
                return loginKeywords.some(keyword => bodyText.includes(keyword.toLowerCase()));
            }''')
            
            print(f"  → 检测到登录表单: {'是' if has_login_form else '否'}")
            
            # 检查Cookie在访问后是否还存在
            cookies_after = await context.cookies()
            cookie_count_after = len(cookies_after)
            
            print(f"  → 访问后Cookie数量: {cookie_count_after} 个")
            
            if cookie_count_after < cookie_count * 0.5:
                print(f"  ⚠ Cookie大量丢失（从{cookie_count}减少到{cookie_count_after}）")
            
            # 判断是否在登录页
            if "/login" in current_url:
                print(f"  ✗ 检测到重定向到登录页")
                print(f"  → 当前URL: {current_url}")
                
                # 返回需要重试的标记
                return {
                    'success': False,
                    'message': '被重定向到登录页',
                    'need_retry': True,
                    'page': page,
                    'context': context,
                    'details': {
                        'current_url': current_url,
                        'page_title': page_title,
                        'cookie_count_before': cookie_count,
                        'cookie_count_after': cookie_count_after,
                        'has_login_form': has_login_form
                    }
                }
            else:
                print(f"  ✓ 页面状态正常")
                
        except Exception as e:
            print(f"  ⚠ 页面状态检查失败: {str(e)}")
            print(f"  → 可能正在跳转，等待3秒后重新检查...")
            
            await asyncio.sleep(3)
            
            try:
                current_url = page.url
                page_title = await page.title()
                print(f"  → 重新检查 - URL: {current_url}")
                print(f"  → 重新检查 - 标题: {page_title}")
            except Exception as e2:
                print(f"  ✗ 重新检查失败: {str(e2)}")
                await page.close()
                await context.close()
                await browser_manager.stop()
                return {
                    'success': False,
                    'message': f'页面状态检查失败: {str(e2)}',
                    'details': {
                        'error': str(e2)
                    }
                }
        
        # 2.9 最终验证
        print(f"\n[步骤2.9] 最终验证...")
        
        if "/login" in current_url:
            print(f"  ✗ 最终确认：当前在登录页")
            return {
                'success': False,
                'message': '被重定向到登录页',
                'need_retry': True,
                'page': page,
                'context': context,
                'details': {
                    'current_url': current_url
                }
            }
        
        print(f"  ✓ 成功进入商品列表页面")
        print(f"  → 最终URL: {current_url}")
        
        print(f"========== [步骤2] 完成 ==========\n")
        
        return {
            'success': True,
            'message': '成功访问商品列表页',
            'page': page,
            'context': context,
            'details': {
                'current_url': current_url,
                'page_title': page_title if 'page_title' in locals() else 'unknown',
                'cookie_count': cookie_count_after if 'cookie_count_after' in locals() else cookie_count,
                'response_status': response_status
            }
        }
        
    except Exception as e:
        print(f"  ✗ 访问商品列表页失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        if page:
            await page.close()
        if context:
            await context.close()
        await browser_manager.stop()
        
        return {
            'success': False,
            'message': f'访问商品列表页失败: {str(e)}',
            'details': {
                'error': str(e)
            }
        }
