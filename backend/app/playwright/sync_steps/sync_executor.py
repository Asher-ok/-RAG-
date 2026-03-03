"""
商品同步主执行器

串联所有8个步骤，执行完整的商品同步流程

步骤列表：
1. 验证登录状态
2. 访问商品列表页（包含重试机制）
3. 点击"全部"标签
4. 点击"导出查询商品"按钮
5. 点击确认导出
6. 下载Excel文件
7. 解析Excel文件
8. 保存到数据库
"""

import asyncio
from datetime import datetime
from .step1_verify_login import verify_login_status
from .step2_visit_product_list import visit_product_list_page
from .step3_click_all_tab import click_all_tab
from .step4_click_export_button import click_export_button
from .step5_confirm_export import confirm_export
from .step6_download_excel import download_excel
from .step7_parse_excel import parse_excel
from .step8_save_to_database import save_to_database


async def execute_product_sync(browser_manager, shop, db, progress_callback=None):
    """
    执行完整的商品同步流程
    
    Args:
        browser_manager: BrowserManager实例
        shop: ShopAuth对象
        db: 数据库Session
        progress_callback: 进度回调函数 async def callback(step, status, message, details)
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'total_products': int,
            'saved_count': int,
            'updated_count': int,
            'latest_export_time': str,
            'details': dict
        }
    """
    
    async def send_progress(step_name, status, message="", details=""):
        """发送进度事件"""
        if progress_callback:
            step_data = {
                "step": step_name,
                "status": status,
                "message": message,
                "details": details,
                "timestamp": datetime.now().isoformat()
            }
            await progress_callback(step_data)
    
    page = None
    context = None
    
    try:
        # 初始化
        await send_progress("初始化", "success", "开始商品同步流程", 
                          f"店铺: {shop.shop_name}, 账号ID: {shop.playwright_account_id}")
        await asyncio.sleep(0.5)
        
        # ========== 步骤1: 验证登录状态 ==========
        await send_progress("检查登录状态", "success", "正在检查登录状态文件...")
        
        step1_result = await verify_login_status(browser_manager, shop.playwright_account_id)
        
        if not step1_result['success']:
            await send_progress("检查登录状态", "failed", step1_result['message'], 
                              step1_result.get('details', {}))
            return step1_result
        
        await send_progress("检查登录状态", "success", "找到登录状态文件", 
                          f"状态文件路径: ../states/account_{shop.playwright_account_id}/state.json (项目根目录)")
        await asyncio.sleep(0.5)
        
        # ========== 步骤2: 访问商品列表页（支持重试） ==========
        await send_progress("启动浏览器", "success", "正在启动Chromium浏览器...")
        await asyncio.sleep(0.5)
        
        max_retries = 2
        retry_count = 0
        step2_success = False
        
        while retry_count <= max_retries and not step2_success:
            if retry_count > 0:
                await send_progress("重新访问商品列表页", "success", 
                                  f"正在重新访问商品列表页 (第{retry_count}次重试)")
            
            step2_result = await visit_product_list_page(
                browser_manager, 
                shop.playwright_account_id, 
                shop.shop_name
            )
            
            if step2_result['success']:
                step2_success = True
                page = step2_result['page']
                context = step2_result['context']
                
                await send_progress("访问商品列表页", "success", "成功进入商品列表页面", 
                                  f"当前URL: {step2_result['details'].get('current_url', 'unknown')}")
                break
            
            # 检查是否需要重试
            if step2_result.get('need_retry') and retry_count < max_retries:
                retry_count += 1
                
                # 获取重试原因
                reason = step2_result.get('message', '未知原因')
                details = step2_result.get('details', {})
                
                await send_progress("访问商品列表页", "warning", 
                                  f"被重定向到登录页，尝试重新加载Cookie (第{retry_count}次重试)", 
                                  f"原因: {reason}")
                
                # 关闭当前页面和上下文
                if 'page' in step2_result and step2_result['page']:
                    await step2_result['page'].close()
                if 'context' in step2_result and step2_result['context']:
                    await step2_result['context'].close()
                
                await asyncio.sleep(2)
                
                # 重新加载Cookie
                await send_progress("重新加载Cookie", "success", 
                                  f"正在重新加载登录状态 (第{retry_count}次)", 
                                  f"重新从 ../states/account_{shop.playwright_account_id}/state.json 加载 (项目根目录)")
                
                continue
            else:
                # 不需要重试或已达到最大重试次数
                await send_progress("访问商品列表页", "failed", step2_result['message'], 
                                  step2_result.get('details', {}))
                
                if retry_count >= max_retries:
                    await send_progress("访问商品列表页", "failed", 
                                      f"重试{max_retries}次后仍被重定向到登录页", 
                                      "Cookie可能已失效，需要重新登录")
                
                return step2_result
        
        await asyncio.sleep(0.5)
        
        # ========== 步骤3: 点击"全部"标签 ==========
        await send_progress("点击全部标签", "success", "正在检查'全部'标签状态...")
        
        step3_result = await click_all_tab(page)
        
        if step3_result.get('skipped'):
            await send_progress("点击全部标签", "warning", step3_result['message'], 
                              step3_result.get('details', {}))
        elif step3_result.get('already_selected'):
            await send_progress("点击全部标签", "success", "'全部'标签已选中，无需点击", 
                              "检测到 aria-selected='true'，直接进入下一步")
        elif step3_result['success']:
            await send_progress("点击全部标签", "success", "成功点击'全部'标签", 
                              "验证通过: aria-selected='true'")
        else:
            await send_progress("点击全部标签", "warning", step3_result['message'], 
                              step3_result.get('details', {}))
        
        await asyncio.sleep(0.5)
        
        # ========== 步骤4: 点击"导出查询商品"按钮 ==========
        await send_progress("点击导出按钮", "success", "正在查找'导出查询商品'按钮...")
        
        step4_result = await click_export_button(page)
        
        if not step4_result['success']:
            await send_progress("点击导出按钮", "failed", step4_result['message'], 
                              step4_result.get('details', {}))
            await page.close()
            await context.close()
            await browser_manager.stop()
            return step4_result
        
        await send_progress("点击导出按钮", "success", "成功点击'导出查询商品'按钮", 
                          f"定位方式: {step4_result['details'].get('method', '未知')}")
        await asyncio.sleep(0.5)
        
        # ========== 步骤5: 点击确认导出 ==========
        await send_progress("点击确认导出", "success", "正在查找抽屉中的'导出'确认按钮...")
        
        step5_result = await confirm_export(page)
        
        if not step5_result['success']:
            await send_progress("点击确认导出", "failed", step5_result['message'], 
                              step5_result.get('details', {}))
            await page.close()
            await context.close()
            await browser_manager.stop()
            return step5_result
        
        await send_progress("点击确认导出", "success", "成功点击'导出'确认按钮", 
                          f"按钮文本: {step5_result['details'].get('buttonText', '导出')}")
        await asyncio.sleep(0.5)
        
        # ========== 步骤6: 下载Excel文件 ==========
        await send_progress("下载Excel文件", "success", "正在下载商品Excel文件...", 
                          "等待导出任务完成并下载文件")
        
        step6_result = await download_excel(context)
        
        if not step6_result['success']:
            await send_progress("下载Excel文件", "failed", step6_result['message'], 
                              step6_result.get('details', {}))
            await context.close()
            await browser_manager.stop()
            return step6_result
        
        filepath = step6_result['filepath']
        latest_export_time = step6_result['latest_export_time']
        
        await send_progress("下载Excel文件", "success", "Excel文件下载成功", 
                          f"文件路径: {filepath}\n最新导出时间: {latest_export_time}")
        await asyncio.sleep(0.5)
        
        # ========== 步骤7: 解析Excel文件 ==========
        await send_progress("解析Excel文件", "success", "正在解析Excel文件...")
        
        step7_result = await parse_excel(filepath)
        
        if not step7_result['success']:
            await send_progress("解析Excel文件", "failed", step7_result['message'], 
                              step7_result.get('details', {}))
            await context.close()
            await browser_manager.stop()
            return step7_result
        
        products = step7_result['products']
        product_count = len(products)
        
        await send_progress("解析Excel文件", "success", f"成功解析 {product_count} 个商品", 
                          f"文件路径: {filepath}")
        await asyncio.sleep(0.5)
        
        # ========== 步骤8: 保存到数据库 ==========
        await send_progress("保存到数据库", "success", f"正在保存 {product_count} 个商品到数据库...")
        
        # 定义数据库保存的进度回调
        async def db_progress_callback(progress_info):
            await send_progress("保存到数据库", "success", 
                              f"已保存 {progress_info['current']}/{progress_info['total']} 个商品", 
                              f"新增: {progress_info['saved']}, 更新: {progress_info['updated']}")
        
        step8_result = await save_to_database(db, shop.id, products, db_progress_callback)
        
        if not step8_result['success']:
            await send_progress("保存到数据库", "failed", step8_result['message'], 
                              step8_result.get('details', {}))
            await context.close()
            await browser_manager.stop()
            return step8_result
        
        saved_count = step8_result['saved_count']
        updated_count = step8_result['updated_count']
        
        await send_progress("保存到数据库", "success", "商品保存完成", 
                          f"新增 {saved_count} 个, 更新 {updated_count} 个")
        await asyncio.sleep(0.5)
        
        # 清理资源
        await context.close()
        await browser_manager.stop()
        
        # ========== 完成 ==========
        await send_progress("完成", "success", "商品同步流程全部完成", 
                          f"总计: {product_count} 个商品\n最新导出时间: {latest_export_time}")
        
        return {
            'success': True,
            'message': f'商品同步完成，总计 {product_count} 个商品',
            'total_products': product_count,
            'saved_count': saved_count,
            'updated_count': updated_count,
            'latest_export_time': latest_export_time,
            'details': {
                'shop_id': shop.id,
                'shop_name': shop.shop_name,
                'account_id': shop.playwright_account_id,
                'total': product_count,
                'saved': saved_count,
                'updated': updated_count,
                'failed': step8_result.get('failed_count', 0),
                'latest_export_time': latest_export_time
            }
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        
        await send_progress("异常", "failed", "发生未预期的错误", str(e))
        
        # 清理资源
        if page:
            await page.close()
        if context:
            await context.close()
        await browser_manager.stop()
        
        return {
            'success': False,
            'message': f'商品同步失败: {str(e)}',
            'details': {
                'error': str(e)
            }
        }
