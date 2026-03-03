"""
任务队列服务
实现裂变任务的队列管理和并发控制
"""
import asyncio
from typing import Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.product import ProductTask
from app.core.database import get_db

class TaskQueueService:
    """任务队列服务（单例模式）"""
    
    _instance = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self.running_tasks: Dict[str, asyncio.Task] = {}  # 正在运行的任务
        self.task_queue = asyncio.Queue()  # 待处理任务队列
        self.max_concurrent_tasks = 1  # 最大并发任务数（目前设为1，按顺序执行）
        self.worker_started = False
    
    async def start_worker(self):
        """启动任务处理工作线程"""
        if self.worker_started:
            return
        
        self.worker_started = True
        print("[任务队列] 工作线程已启动")
        
        # 启动工作线程
        asyncio.create_task(self._process_queue())
    
    async def _process_queue(self):
        """处理任务队列"""
        while True:
            try:
                # 检查是否有空闲槽位
                if len(self.running_tasks) < self.max_concurrent_tasks:
                    # 从队列中获取任务
                    task_info = await self.task_queue.get()
                    
                    task_id = task_info['task_id']
                    task_func = task_info['task_func']
                    task_args = task_info['task_args']
                    
                    print(f"[任务队列] 开始执行任务: {task_id}")
                    
                    # 创建异步任务
                    async_task = asyncio.create_task(
                        self._run_task(task_id, task_func, task_args)
                    )
                    self.running_tasks[task_id] = async_task
                else:
                    # 没有空闲槽位，等待一会儿
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"[任务队列] 处理队列时出错: {str(e)}")
                await asyncio.sleep(1)
    
    async def _run_task(self, task_id: str, task_func, task_args):
        """运行单个任务"""
        try:
            # 执行任务
            await task_func(**task_args)
        except Exception as e:
            print(f"[任务队列] 任务 {task_id} 执行失败: {str(e)}")
        finally:
            # 任务完成，从运行列表中移除
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]
            print(f"[任务队列] 任务 {task_id} 已完成")
    
    async def add_task(self, task_id: str, task_func, task_args: dict):
        """添加任务到队列"""
        async with self._lock:
            # 确保工作线程已启动
            if not self.worker_started:
                await self.start_worker()
            
            # 添加到队列
            await self.task_queue.put({
                'task_id': task_id,
                'task_func': task_func,
                'task_args': task_args
            })
            
            queue_size = self.task_queue.qsize()
            running_count = len(self.running_tasks)
            
            print(f"[任务队列] 任务 {task_id} 已加入队列")
            print(f"[任务队列] 当前状态: 运行中 {running_count} 个, 队列中 {queue_size} 个")
    
    def get_task_status(self, task_id: str) -> str:
        """获取任务状态"""
        if task_id in self.running_tasks:
            return "running"
        return "queued"
    
    def get_queue_info(self) -> dict:
        """获取队列信息"""
        return {
            "running_count": len(self.running_tasks),
            "queue_size": self.task_queue.qsize(),
            "running_tasks": list(self.running_tasks.keys())
        }


# 全局任务队列实例
task_queue_service = TaskQueueService()
