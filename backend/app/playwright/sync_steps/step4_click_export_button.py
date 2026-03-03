"""
步骤4: 点击"导出查询商品"按钮

功能：
1. 查找"导出查询商品"按钮
2. 检查按钮是否可见和可点击
3. 滚动到按钮位置
4. 点击按钮

注意：
- 按钮ID: #exportSearchedGoods
- 如果通过ID找不到，尝试通过文本查找
- 需要检查按钮是否被禁用
"""

import asyncio


async def click_export_button(page):
    """
    点击"导出查询商品"按钮
    
    Args:
        page: Playwright Page对象
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'details': dict
        }
    """
    print(f"\n========== [步骤4] 点击'导出查询商品'按钮 ==========")
    
    try:
        # 4.1 查找按钮
        print(f"[步骤4.1] 查找'导出查询商品'按钮...")
        
        await asyncio.sleep(1)
        
        export_result = await page.evaluate('''() => {
            // 获取当前页面信息
            const currentUrl = window.location.href;
            const pageTitle = document.title;
            
            console.log('[导出按钮] 开始查找按钮');
            console.log('[导出按钮] 当前URL:', currentUrl);
            
            // 方法1: 通过ID查找
            const btn = document.querySelector('#exportSearchedGoods');
            
            if (!btn) {
                console.log('[导出按钮] 通过ID未找到，尝试文本匹配');
                
                // 方法2: 通过文本查找
                const allButtons = document.querySelectorAll('button');
                for (const button of allButtons) {
                    if (button.textContent && button.textContent.includes('导出查询商品')) {
                        console.log('[导出按钮] 通过文本找到按钮');
                        
                        // 滚动到按钮位置
                        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        
                        // 等待滚动完成后点击
                        setTimeout(() => {
                            button.click();
                            console.log('[导出按钮] 点击完成（文本匹配）');
                        }, 500);
                        
                        return { 
                            found: true, 
                            method: '文本匹配', 
                            text: button.textContent.trim(), 
                            currentUrl, 
                            pageTitle 
                        };
                    }
                }
                
                // 列出页面上所有按钮的文本（前10个）
                const buttonTexts = Array.from(allButtons)
                    .map(b => b.textContent.trim())
                    .filter(t => t)
                    .slice(0, 10);
                
                console.log('[导出按钮] 未找到导出按钮');
                console.log('[导出按钮] 可用按钮:', buttonTexts);
                
                return { 
                    found: false, 
                    reason: '未找到导出按钮', 
                    currentUrl, 
                    pageTitle, 
                    availableButtons: buttonTexts 
                };
            }
            
            console.log('[导出按钮] 通过ID找到按钮');
            
            // 检查按钮是否可见和可点击
            const rect = btn.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const isDisabled = btn.disabled || btn.classList.contains('disabled');
            
            console.log('[导出按钮] 可见:', isVisible);
            console.log('[导出按钮] 禁用:', isDisabled);
            
            if (!isVisible) {
                return { 
                    found: true, 
                    clickable: false, 
                    reason: '按钮不可见', 
                    currentUrl, 
                    pageTitle 
                };
            }
            
            if (isDisabled) {
                return { 
                    found: true, 
                    clickable: false, 
                    reason: '按钮被禁用', 
                    currentUrl, 
                    pageTitle 
                };
            }
            
            // 滚动到按钮位置
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            console.log('[导出按钮] 滚动到按钮位置');
            
            // 等待滚动完成后点击
            setTimeout(() => {
                btn.click();
                console.log('[导出按钮] 点击完成（ID匹配）');
            }, 500);
            
            return { 
                found: true, 
                clickable: true, 
                clicked: true, 
                method: 'ID匹配', 
                currentUrl, 
                pageTitle 
            };
        }''')
        
        # 4.2 处理查找结果
        print(f"  → 页面标题: {export_result.get('pageTitle', 'unknown')}")
        print(f"  → 当前URL: {export_result.get('currentUrl', 'unknown')}")
        
        if not export_result['found']:
            print(f"  ✗ 未找到'导出查询商品'按钮")
            print(f"  → 原因: {export_result.get('reason', '未知')}")
            
            if 'availableButtons' in export_result and export_result['availableButtons']:
                print(f"  → 页面上可用的按钮（前5个）:")
                for btn_text in export_result['availableButtons'][:5]:
                    print(f"    • {btn_text}")
            
            return {
                'success': False,
                'message': '未找到"导出查询商品"按钮',
                'details': export_result
            }
        
        if not export_result.get('clickable', True):
            print(f"  ✗ 导出按钮不可点击")
            print(f"  → 原因: {export_result.get('reason', '未知')}")
            
            return {
                'success': False,
                'message': f'导出按钮不可点击: {export_result.get("reason", "未知")}',
                'details': export_result
            }
        
        print(f"  ✓ 找到'导出查询商品'按钮")
        print(f"  → 定位方式: {export_result.get('method', '未知')}")
        
        if 'text' in export_result:
            print(f"  → 按钮文本: {export_result['text']}")
        
        # 4.3 等待点击生效
        print(f"\n[步骤4.3] 等待点击生效...")
        print(f"  → 等待2秒...")
        
        await asyncio.sleep(2)
        
        print(f"  ✓ 成功点击'导出查询商品'按钮")
        
        print(f"========== [步骤4] 完成 ==========\n")
        
        return {
            'success': True,
            'message': '成功点击"导出查询商品"按钮',
            'details': export_result
        }
        
    except Exception as e:
        print(f"  ✗ 点击'导出查询商品'按钮失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'success': False,
            'message': f'点击按钮失败: {str(e)}',
            'details': {
                'error': str(e)
            }
        }
