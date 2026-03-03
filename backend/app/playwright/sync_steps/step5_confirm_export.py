"""
步骤5: 点击确认导出

功能：
1. 等待抽屉弹出
2. 查找抽屉中的"导出"确认按钮
3. 检查按钮是否可点击
4. 点击按钮
5. 等待页面跳转或抽屉关闭

注意：
- 抽屉选择器: .ecom-g-drawer
- 按钮在 .ecom-g-drawer-footer 区域
- 点击后可能跳转到导出记录页面
"""

import asyncio


async def confirm_export(page):
    """
    点击确认导出
    
    Args:
        page: Playwright Page对象
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'details': dict
        }
    """
    print(f"\n========== [步骤5] 点击确认导出 ==========")
    
    try:
        # 5.1 等待抽屉弹出
        print(f"[步骤5.1] 等待抽屉弹出...")
        print(f"  → 等待2秒...")
        
        await asyncio.sleep(2)
        
        # 5.2 查找抽屉和确认按钮
        print(f"\n[步骤5.2] 查找抽屉中的'导出'确认按钮...")
        
        confirm_result = await page.evaluate('''() => {
            console.log('[确认导出] 开始查找抽屉');
            
            // 查找抽屉
            const drawer = document.querySelector('.ecom-g-drawer');
            const drawerFooter = document.querySelector('.ecom-g-drawer-footer');
            
            if (!drawer && !drawerFooter) {
                console.log('[确认导出] 未找到导出抽屉');
                return { found: false, reason: '未找到导出抽屉' };
            }
            
            console.log('[确认导出] 找到抽屉');
            
            // 查找"导出"按钮
            const buttons = document.querySelectorAll('.ecom-g-drawer-footer button, .ecom-g-drawer button');
            let exportButton = null;
            
            console.log('[确认导出] 找到', buttons.length, '个按钮');
            
            for (const btn of buttons) {
                const text = btn.textContent.trim();
                console.log('[确认导出] 按钮文本:', text);
                
                if (text === '导出' || text.includes('导出')) {
                    exportButton = btn;
                    console.log('[确认导出] 找到导出按钮');
                    break;
                }
            }
            
            if (!exportButton) {
                // 列出所有找到的按钮文本
                const buttonTexts = Array.from(buttons).map(b => b.textContent.trim());
                console.log('[确认导出] 未找到导出按钮，可用按钮:', buttonTexts);
                
                return { 
                    found: false, 
                    reason: '未找到导出按钮',
                    availableButtons: buttonTexts
                };
            }
            
            // 检查按钮是否可点击
            const isDisabled = exportButton.disabled || exportButton.classList.contains('disabled');
            
            console.log('[确认导出] 按钮禁用状态:', isDisabled);
            
            if (isDisabled) {
                return { 
                    found: true, 
                    clickable: false, 
                    reason: '按钮被禁用' 
                };
            }
            
            // 点击按钮
            exportButton.click();
            console.log('[确认导出] 点击完成');
            
            return { 
                found: true, 
                clickable: true, 
                clicked: true,
                buttonText: exportButton.textContent.trim()
            };
        }''')
        
        # 5.3 处理查找结果
        if not confirm_result['found']:
            print(f"  ✗ 未找到确认导出按钮")
            print(f"  → 原因: {confirm_result.get('reason', '未知')}")
            
            if 'availableButtons' in confirm_result:
                print(f"  → 抽屉中可用的按钮:")
                for btn_text in confirm_result['availableButtons']:
                    print(f"    • {btn_text}")
            
            return {
                'success': False,
                'message': '未找到确认导出按钮',
                'details': confirm_result
            }
        
        if not confirm_result.get('clickable', True):
            print(f"  ✗ 确认按钮不可点击")
            print(f"  → 原因: {confirm_result.get('reason', '未知')}")
            
            return {
                'success': False,
                'message': f'确认按钮不可点击: {confirm_result.get("reason", "未知")}',
                'details': confirm_result
            }
        
        print(f"  ✓ 找到'导出'确认按钮")
        print(f"  → 按钮文本: {confirm_result.get('buttonText', '导出')}")
        print(f"  ✓ 成功点击'导出'确认按钮")
        
        # 5.4 等待页面响应
        print(f"\n[步骤5.4] 等待页面响应...")
        print(f"  → 等待3秒...")
        
        await asyncio.sleep(3)
        
        # 5.5 检查页面状态
        print(f"\n[步骤5.5] 检查页面状态...")
        
        try:
            # 尝试等待页面跳转到导出记录页面
            current_url = page.url
            print(f"  → 当前URL: {current_url}")
            
            if '/ffa/g/excel' in current_url:
                print(f"  ✓ 页面已跳转到导出记录页面")
                
                # 等待表格加载
                await asyncio.sleep(2)
                
                # 检查最新导出记录的时间
                latest_time = await page.evaluate('''() => {
                    const firstCell = document.querySelector('.ecom-g-table-cell');
                    return firstCell ? firstCell.textContent.trim() : null;
                }''')
                
                if latest_time:
                    print(f"  → 最新记录时间: {latest_time}")
                    
                    return {
                        'success': True,
                        'message': '导出任务已提交，页面已跳转到导出记录页面',
                        'jumped': True,
                        'details': {
                            'current_url': current_url,
                            'latest_time': latest_time
                        }
                    }
                else:
                    print(f"  → 未找到最新记录时间")
                    
                    return {
                        'success': True,
                        'message': '导出任务已提交，页面已跳转到导出记录页面',
                        'jumped': True,
                        'details': {
                            'current_url': current_url
                        }
                    }
            else:
                print(f"  → 页面未跳转，检查抽屉状态...")
                
                # 检查遮罩层是否消失
                try:
                    mask_hidden = await page.evaluate('''() => {
                        const mask = document.querySelector('.ecom-g-drawer-mask');
                        if (!mask) {
                            return true; // 遮罩层不存在，说明抽屉已关闭
                        }
                        
                        const style = window.getComputedStyle(mask);
                        return style.display === 'none' || style.visibility === 'hidden';
                    }''')
                    
                    if mask_hidden:
                        print(f"  ✓ 抽屉已关闭")
                        
                        return {
                            'success': True,
                            'message': '导出任务已提交，抽屉已关闭',
                            'drawer_closed': True,
                            'details': {
                                'current_url': current_url
                            }
                        }
                    else:
                        print(f"  ⚠ 抽屉仍然打开")
                        
                        return {
                            'success': True,
                            'message': '导出任务已提交，但抽屉未关闭',
                            'warning': True,
                            'details': {
                                'current_url': current_url
                            }
                        }
                        
                except Exception as e:
                    print(f"  ⚠ 检查抽屉状态失败: {str(e)}")
                    
                    return {
                        'success': True,
                        'message': '导出任务已提交',
                        'details': {
                            'current_url': current_url
                        }
                    }
                    
        except Exception as e:
            print(f"  ⚠ 检查页面状态失败: {str(e)}")
            
            return {
                'success': True,
                'message': '导出任务已提交',
                'details': {
                    'error': str(e)
                }
            }
        
        print(f"========== [步骤5] 完成 ==========\n")
        
    except Exception as e:
        print(f"  ✗ 点击确认导出失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'success': False,
            'message': f'点击确认导出失败: {str(e)}',
            'details': {
                'error': str(e)
            }
        }
