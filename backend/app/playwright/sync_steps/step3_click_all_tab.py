"""
步骤3: 点击"全部"标签

功能：
1. 检查"全部"标签是否存在
2. 检查标签是否已选中
3. 如果未选中，点击标签
4. 验证点击是否成功

注意：
- 标签ID: #rc-tabs-0-tab-all
- 需要检查 aria-selected 属性
- 如果页面不在商品列表，可能找不到标签
"""

import asyncio


async def click_all_tab(page):
    """
    点击"全部"标签
    
    Args:
        page: Playwright Page对象
        
    Returns:
        dict: {
            'success': bool,
            'message': str,
            'details': dict
        }
    """
    print(f"\n========== [步骤3] 点击'全部'标签 ==========")
    
    try:
        # 3.1 检查标签状态
        print(f"[步骤3.1] 检查'全部'标签状态...")
        
        await asyncio.sleep(1)
        
        tab_status = await page.evaluate('''() => {
            const tabContainer = document.querySelector('.ecom-g-tabs-nav-list');
            const allTab = document.querySelector('#rc-tabs-0-tab-all');
            
            // 获取当前页面URL和标题
            const currentUrl = window.location.href;
            const pageTitle = document.title;
            
            // 检查页面上是否有商品列表相关的元素
            const hasProductTable = !!document.querySelector('.ecom-g-table');
            const hasProductList = !!document.querySelector('[class*="product"]');
            
            return {
                currentUrl: currentUrl,
                pageTitle: pageTitle,
                hasContainer: !!tabContainer,
                hasAllTab: !!allTab,
                isSelected: allTab ? allTab.getAttribute('aria-selected') === 'true' : false,
                tabText: allTab ? allTab.innerText : '',
                hasProductTable: hasProductTable,
                hasProductList: hasProductList
            };
        }''')
        
        print(f"  → 页面标题: {tab_status.get('pageTitle', 'unknown')}")
        print(f"  → 当前URL: {tab_status.get('currentUrl', 'unknown')}")
        print(f"  → 标签容器存在: {'是' if tab_status['hasContainer'] else '否'}")
        print(f"  → '全部'标签存在: {'是' if tab_status['hasAllTab'] else '否'}")
        
        if tab_status['hasAllTab']:
            print(f"  → 标签文本: {tab_status['tabText']}")
            print(f"  → 已选中: {'是' if tab_status['isSelected'] else '否'}")
        
        print(f"  → 商品表格存在: {'是' if tab_status.get('hasProductTable', False) else '否'}")
        
        # 3.2 判断是否需要点击
        if not tab_status['hasAllTab']:
            print(f"\n[步骤3.2] 未找到'全部'标签")
            print(f"  ⚠ 页面可能不在商品列表，跳过此步骤")
            print(f"  → 当前URL: {tab_status.get('currentUrl', 'unknown')}")
            
            print(f"========== [步骤3] 完成（跳过） ==========\n")
            
            return {
                'success': True,
                'message': '未找到"全部"标签，跳过此步骤',
                'skipped': True,
                'details': tab_status
            }
        
        if tab_status['isSelected']:
            print(f"\n[步骤3.2] '全部'标签已选中")
            print(f"  ✓ 无需点击，直接进入下一步")
            print(f"  → aria-selected='true'")
            
            print(f"========== [步骤3] 完成 ==========\n")
            
            return {
                'success': True,
                'message': '"全部"标签已选中，无需点击',
                'already_selected': True,
                'details': tab_status
            }
        
        # 3.3 点击"全部"标签
        print(f"\n[步骤3.3] '全部'标签未选中，开始点击...")
        print(f"  → 准备点击标签...")
        
        click_result = await page.evaluate('''() => {
            const allTab = document.querySelector('#rc-tabs-0-tab-all');
            if (allTab) {
                console.log('[点击全部标签] 找到标签，准备点击');
                allTab.click();
                console.log('[点击全部标签] 点击完成');
                return true;
            }
            console.log('[点击全部标签] 未找到标签');
            return false;
        }''')
        
        if not click_result:
            print(f"  ✗ 点击失败：未找到标签元素")
            
            return {
                'success': False,
                'message': '点击失败：未找到标签元素',
                'details': tab_status
            }
        
        print(f"  ✓ 点击操作已执行")
        
        # 3.4 等待点击生效
        print(f"\n[步骤3.4] 等待点击生效...")
        print(f"  → 等待2秒...")
        
        await asyncio.sleep(2)
        
        # 3.5 验证点击结果
        print(f"\n[步骤3.5] 验证点击结果...")
        
        is_selected = await page.evaluate('''() => {
            const allTab = document.querySelector('#rc-tabs-0-tab-all');
            if (!allTab) {
                return { success: false, reason: '标签元素消失' };
            }
            
            const selected = allTab.getAttribute('aria-selected') === 'true';
            console.log('[验证点击] aria-selected:', selected);
            
            return { success: selected, selected: selected };
        }''')
        
        if is_selected.get('success'):
            print(f"  ✓ 验证通过：'全部'标签已选中")
            print(f"  → aria-selected='true'")
            
            print(f"========== [步骤3] 完成 ==========\n")
            
            return {
                'success': True,
                'message': '成功点击"全部"标签',
                'clicked': True,
                'details': {
                    'before': tab_status,
                    'after': is_selected
                }
            }
        else:
            print(f"  ⚠ 点击了但未选中")
            print(f"  → aria-selected 仍为 false")
            print(f"  → 原因: {is_selected.get('reason', '未知')}")
            print(f"  → 继续执行后续步骤")
            
            print(f"========== [步骤3] 完成（警告） ==========\n")
            
            return {
                'success': True,
                'message': '点击了但未选中，继续执行',
                'clicked': True,
                'warning': True,
                'details': {
                    'before': tab_status,
                    'after': is_selected
                }
            }
        
    except Exception as e:
        print(f"  ✗ 点击'全部'标签失败: {str(e)}")
        import traceback
        traceback.print_exc()
        
        print(f"  → 继续执行后续步骤")
        print(f"========== [步骤3] 完成（错误） ==========\n")
        
        return {
            'success': True,
            'message': f'点击标签失败，继续执行: {str(e)}',
            'error': True,
            'details': {
                'error': str(e)
            }
        }
