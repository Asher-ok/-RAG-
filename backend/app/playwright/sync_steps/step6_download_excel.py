"""
步骤6: 下载Excel文件

功能：
1. 等待导出任务完成
2. 查找最新的导出记录
3. 点击下载按钮
4. 等待文件下载完成
5. 返回文件路径

注意：
- 需要等待导出任务完成（状态变为"已完成"）
- 下载的文件保存在临时目录
- 需要记录最新导出时间
"""

import asyncio
from app.playwright.product_scraper商品信息抓取器 import ProductScraper


async def download_excel(context):
    """
    下载Excel文件
    
    Args:
        context: Playwright BrowserContext对象
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'filepath': str,
            'latest_export_time': str,
            'details': dict
        }
    """
    print(f"\n========== [步骤6] 下载Excel文件 ==========")
    
    try:
        # 6.1 开始下载
        print(f"[步骤6.1] 开始下载商品Excel文件...")
        print(f"  → 等待导出任务完成并下载文件...")
        
        # 调用ProductScraper的下载方法
        download_result = await ProductScraper.download_product_excel(context)
        
        # 6.2 检查下载结果
        print(f"\n[步骤6.2] 检查下载结果...")
        
        if not download_result.get("success"):
            error_message = download_result.get("message", "未知错误")
            print(f"  ✗ 下载失败")
            print(f"  → 错误信息: {error_message}")
            
            return {
                'success': False,
                'message': f'下载失败: {error_message}',
                'details': download_result
            }
        
        # 6.3 获取文件信息
        filepath = download_result.get('filepath')
        latest_export_time = download_result.get('latest_export_time', '未知')
        
        print(f"  ✓ Excel文件下载成功")
        print(f"  → 文件路径: {filepath}")
        print(f"  → 最新导出时间: {latest_export_time}")
        
        # 6.4 验证文件是否存在
        print(f"\n[步骤6.4] 验证文件...")
        
        import os
        if not os.path.exists(filepath):
            print(f"  ✗ 文件不存在")
            print(f"  → 路径: {filepath}")
            
            return {
                'success': False,
                'message': '文件下载后不存在',
                'details': {
                    'filepath': filepath,
                    'exists': False
                }
            }
        
        file_size = os.path.getsize(filepath)
        print(f"  ✓ 文件存在")
        print(f"  → 文件大小: {file_size} 字节 ({file_size / 1024:.2f} KB)")
        
        if file_size == 0:
            print(f"  ✗ 文件为空")
            
            return {
                'success': False,
                'message': '下载的文件为空',
                'details': {
                    'filepath': filepath,
                    'file_size': 0
                }
            }
        
        print(f"========== [步骤6] 完成 ==========\n")
        
        return {
            'success': True,
            'message': 'Excel文件下载成功',
            'filepath': filepath,
            'latest_export_time': latest_export_time,
            'details': {
                'filepath': filepath,
                'file_size': file_size,
                'latest_export_time': latest_export_time
            }
        }
        
    except Exception as e:
        print(f"  ✗ 下载Excel文件失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'success': False,
            'message': f'下载失败: {str(e)}',
            'details': {
                'error': str(e)
            }
        }
