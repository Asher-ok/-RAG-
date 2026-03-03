"""
商品同步 SSE 接口
实时推送同步步骤给前端

使用模块化的步骤系统，每个步骤独立实现
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.account import AccountUser
from app.models.shop import ShopAuth
import asyncio
import json
from datetime import datetime

# 导入新的步骤执行器
from app.playwright.sync_steps import execute_product_sync

router = APIRouter()


@router.get("/sync-stream/{shop_id}")
async def sync_products_stream(
    shop_id: int,
    token: str,  # 从 query 参数获取 token
    db: Session = Depends(get_db)
):
    """
    SSE 流式同步商品
    实时推送每一步的执行情况
    """
    
    # 验证 token
    from app.core.security import decode_access_token
    try:
        payload = decode_access_token(token)
        if not payload:
            async def error_generator():
                yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': '无效的token'}, ensure_ascii=False)}\n\n"
            return StreamingResponse(error_generator(), media_type="text/event-stream")
        
        user_id = payload.get("user_id")
        if not user_id:
            async def error_generator():
                yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': '无效的token'}, ensure_ascii=False)}\n\n"
            return StreamingResponse(error_generator(), media_type="text/event-stream")
    except Exception as e:
        async def error_generator():
            yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': f'token验证失败: {str(e)}'}, ensure_ascii=False)}\n\n"
        return StreamingResponse(error_generator(), media_type="text/event-stream")
    
    async def event_generator():
        """生成 SSE 事件流"""
        
        try:
            # 获取店铺信息
            shop = db.query(ShopAuth).filter(
                ShopAuth.id == shop_id,
                ShopAuth.status == 1
            ).first()
            
            if not shop:
                yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': '店铺不存在或已禁用', 'timestamp': datetime.now().isoformat()}, ensure_ascii=False)}\n\n"
                return
            
            if shop.auth_mode != 'playwright':
                yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': '该店铺不支持 Playwright 模式', 'timestamp': datetime.now().isoformat()}, ensure_ascii=False)}\n\n"
                return
            
            # 使用新的模块化步骤执行器
            from app.playwright.browser_manager浏览器管理 import BrowserManager
            browser_manager = BrowserManager()
            
            # 定义进度回调函数
            async def progress_callback(step_data):
                """SSE进度回调 - 将步骤数据推送到前端"""
                # 这个函数会被sync_executor调用，传递步骤数据
                pass  # 实际的yield会在下面的循环中处理
            
            # 创建一个队列来存储进度消息
            progress_queue = asyncio.Queue()
            
            # 重新定义回调函数，将消息放入队列
            async def queue_progress(step_data):
                await progress_queue.put(step_data)
            
            # 创建执行任务
            async def run_sync():
                result = await execute_product_sync(
                    browser_manager=browser_manager,
                    shop=shop,
                    db=db,
                    progress_callback=queue_progress
                )
                # 执行完成后，放入一个结束标记
                await progress_queue.put(None)
                return result
            
            # 启动同步任务
            sync_task = asyncio.create_task(run_sync())
            
            # 从队列中读取并发送进度消息
            while True:
                step_data = await progress_queue.get()
                
                if step_data is None:
                    # 结束标记
                    break
                
                # 发送步骤数据
                yield f"data: {json.dumps(step_data, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.1)  # 小延迟确保消息发送
            
            # 等待同步任务完成并获取结果
            result = await sync_task
            
            # 如果有错误，发送错误消息
            if not result['success']:
                yield f"data: {json.dumps({'step': '错误', 'status': 'failed', 'message': result['message'], 'details': result.get('details', {}), 'timestamp': datetime.now().isoformat()}, ensure_ascii=False)}\n\n"
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            yield f"data: {json.dumps({'step': '异常', 'status': 'failed', 'message': f'发生未预期的错误: {str(e)}', 'timestamp': datetime.now().isoformat()}, ensure_ascii=False)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # 禁用 Nginx 缓冲
        }
    )
