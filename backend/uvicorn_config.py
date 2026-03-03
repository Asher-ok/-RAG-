"""
Uvicorn配置文件
用于在Windows上正确设置Playwright所需的事件循环策略
"""
import sys
import asyncio

# 在导入任何其他模块之前设置事件循环策略
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    print("✓ [uvicorn_config] Windows事件循环策略已设置")
