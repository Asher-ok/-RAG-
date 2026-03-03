"""
后端服务启动脚本
password cannot be longer than 72 bytes, truncate manually if necessary (e.g. my_password[:72])
"""
import sys
import asyncio
import uvicorn
import logging
import os
import psutil
import signal

# 必须在最开始设置
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


def kill_process_on_port(port: int):
    """
    关闭占用指定端口的进程
    
    Args:
        port: 端口号
    """
    killed = False
    # for proc in psutil.process_iter(['pid', 'name', 'connections']):
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            # connections = proc.info.get('connections')
            connections = proc.net_connections()
            if connections:
                for conn in connections:
                    if hasattr(conn, 'laddr') and conn.laddr.port == port:
                        print(f"⚠ 发现占用端口 {port} 的进程:")
                        print(f"  PID: {proc.info['pid']}")
                        print(f"  名称: {proc.info['name']}")
                        print(f"  正在关闭...")
                        
                        if sys.platform == 'win32':
                            # Windows使用taskkill
                            os.system(f'taskkill /F /PID {proc.info["pid"]} >nul 2>&1')
                        else:
                            # Linux/Mac使用kill
                            os.kill(proc.info['pid'], signal.SIGTERM)
                        
                        print(f"✓ 进程已关闭\n")
                        killed = True
                        break
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    return killed


if __name__ == "__main__":
    print("\n" + "="*60)
    print("启动抖音商家管理系统后端服务")
    print("="*60)
    print("✓ Windows事件循环策略: ProactorEventLoopPolicy")
    print("✓ Playwright支持: 已启用")
    print("="*60 + "\n")
    
    # 检查并关闭占用8000端口的旧进程
    print("检查端口占用情况...")
    if kill_process_on_port(8000):
        import time
        time.sleep(1)  # 等待端口释放
        print("端口已释放，准备启动新服务...\n")
    else:
        print("✓ 端口 8000 未被占用\n")
    
    # 使用单进程模式，避免多进程导致的事件循环策略问题
    config = uvicorn.Config(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True,
        loop="asyncio",
        workers=1  # 单进程
    )
    server = uvicorn.Server(config)
    server.run()
