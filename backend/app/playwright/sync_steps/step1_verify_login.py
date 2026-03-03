"""
步骤1: 验证登录状态

功能：
1. 检查登录状态文件是否存在
2. 验证状态文件的有效性
3. 检查Cookie数量和关键Cookie
4. 返回详细的状态信息

注意：
- 状态文件路径: /root/states/account_{account_id}/state.json
- 需要检查文件大小、Cookie数量、关键认证Cookie
"""

import os
import json
from pathlib import Path
from datetime import datetime


async def verify_login_status(browser_manager, account_id):
    """
    验证登录状态
    
    Args:
        browser_manager: BrowserManager实例
        account_id: 账号ID（实际是店铺ID）
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'details': dict  # 详细信息
        }
    """
    print(f"\n========== [步骤1] 验证登录状态 ==========")
    
    try:
        # 1.1 读取映射文件，获取 partition 名称
        print(f"[步骤1.1] 读取 partition 映射文件...")
        print(f"  → 店铺ID: {account_id}")
        
        # 映射文件路径（Electron 应用的 userData 目录）
        # Windows: C:\Users\{username}\AppData\Roaming\doushop-desktop\shop-partition-mapping.json
        # Linux: /root/.config/doushop-desktop/shop-partition-mapping.json
        import platform
        if platform.system() == 'Windows':
            import os
            username = os.environ.get('USERNAME', 'user')
            mapping_file = Path(f"C:/Users/{username}/AppData/Roaming/doushop-desktop/shop-partition-mapping.json")
        else:
            mapping_file = Path("/root/.config/doushop-desktop/shop-partition-mapping.json")
        
        print(f"  → 映射文件路径: {mapping_file}")
        
        if not mapping_file.exists():
            print(f"  ✗ 映射文件不存在")
            print(f"  → 请先在 Electron 客户端中登录店铺")
            return {
                'success': False,
                'message': '登录状态已过期，请重新登录',
                'details': {
                    'account_id': account_id,
                    'mapping_file': str(mapping_file),
                    'exists': False,
                    'error': '映射文件不存在'
                }
            }
        
        # 读取映射文件
        try:
            with open(mapping_file, 'r', encoding='utf-8') as f:
                mappings = json.load(f)
        except Exception as e:
            print(f"  ✗ 读取映射文件失败: {str(e)}")
            return {
                'success': False,
                'message': f'读取映射文件失败: {str(e)}',
                'details': {
                    'account_id': account_id,
                    'error': str(e)
                }
            }
        
        # 查找店铺对应的 partition
        if account_id not in mappings:
            print(f"  ✗ 未找到店铺 {account_id} 的 partition 映射")
            print(f"  → 请先在 Electron 客户端中登录该店铺")
            return {
                'success': False,
                'message': '登录状态已过期，请重新登录',
                'details': {
                    'account_id': account_id,
                    'has_mapping': False,
                    'available_shops': list(mappings.keys())
                }
            }
        
        partition_info = mappings[account_id]
        partition_name = partition_info.get('partitionName')
        shop_name = partition_info.get('shopName', '未知店铺')
        login_time = partition_info.get('loginTime', '未知时间')
        
        print(f"  ✓ 找到 partition 映射")
        print(f"  → 店铺名称: {shop_name}")
        print(f"  → Partition: {partition_name}")
        print(f"  → 登录时间: {login_time}")
        
        # 1.2 验证 partition 文件夹是否存在
        print(f"\n[步骤1.2] 验证 partition 文件夹...")
        
        # 提取 partition 文件夹名称（去掉 persist: 前缀）
        partition_folder = partition_name.replace('persist:', '')
        
        if platform.system() == 'Windows':
            partition_path = Path(f"C:/Users/{username}/AppData/Roaming/doushop-desktop/Partitions/{partition_folder}")
        else:
            partition_path = Path(f"/root/.config/doushop-desktop/Partitions/{partition_folder}")
        
        print(f"  → Partition 路径: {partition_path}")
        
        if not partition_path.exists():
            print(f"  ✗ Partition 文件夹不存在")
            return {
                'success': False,
                'message': '登录状态已过期，请重新登录',
                'details': {
                    'account_id': account_id,
                    'partition_name': partition_name,
                    'partition_path': str(partition_path),
                    'exists': False
                }
            }
        
        print(f"  ✓ Partition 文件夹存在")
        
        # 1.3 检查 Cookies 文件
        print(f"\n[步骤1.3] 检查 Cookies 文件...")
        
        cookies_file = partition_path / 'Network' / 'Cookies'
        
        if not cookies_file.exists():
            print(f"  ✗ Cookies 文件不存在")
            return {
                'success': False,
                'message': '登录状态已过期，请重新登录',
                'details': {
                    'account_id': account_id,
                    'cookies_file': str(cookies_file),
                    'exists': False
                }
            }
        
        cookies_size = cookies_file.stat().st_size
        print(f"  ✓ Cookies 文件存在")
        print(f"  → 文件大小: {cookies_size} 字节 ({cookies_size / 1024:.2f} KB)")
        
        if cookies_size == 0:
            print(f"  ✗ Cookies 文件为空")
            return {
                'success': False,
                'message': '登录状态已过期，请重新登录',
                'details': {
                    'account_id': account_id,
                    'cookies_size': 0
                }
            }
        
        # 1.4 最终验证结果
        print(f"\n[步骤1.4] 验证结果汇总...")
        
        print(f"  ✓ 登录状态有效")
        print(f"  → 店铺名称: {shop_name}")
        print(f"  → Partition: {partition_name}")
        print(f"  → Cookies 大小: {cookies_size} 字节")
        print(f"  → 登录时间: {login_time}")
        
        print(f"========== [步骤1] 完成 ==========\n")
        
        return {
            'success': True,
            'message': '登录状态验证成功',
            'details': {
                'account_id': account_id,
                'shop_name': shop_name,
                'partition_name': partition_name,
                'partition_path': str(partition_path),
                'cookies_size': cookies_size,
                'login_time': login_time,
                'has_state': True
            }
        }
        
    except Exception as e:
        print(f"  ✗ 验证登录状态失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'success': False,
            'message': f'验证登录状态失败: {str(e)}',
            'details': {
                'account_id': account_id,
                'error': str(e)
            }
        }
