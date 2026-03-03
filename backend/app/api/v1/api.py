from fastapi import APIRouter
from app.api.v1.endpoints import auth, product, fission, account, dashboard, profile, settings

api_router = APIRouter()

# 认证相关路由
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])

# 商品相关路由
api_router.include_router(product.router, prefix="/product", tags=["商品"])

# 裂变相关路由
api_router.include_router(fission.router, prefix="/fission", tags=["裂变"])

# 账号管理路由
api_router.include_router(account.router, prefix="/account", tags=["账号管理"])

# 工作台路由
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["工作台"])

# 个人中心路由
api_router.include_router(profile.router, prefix="/profile", tags=["个人中心"])

# 系统设置路由
api_router.include_router(settings.router, prefix="/settings", tags=["系统设置"])