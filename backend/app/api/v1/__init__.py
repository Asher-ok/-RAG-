from fastapi import APIRouter
from app.api.v1.endpoints import auth, product, fission, account, dashboard, profile, settings, playwright_auth, product_upload, product_sync_sse
# from backend.app.api.v1.endpoints import product_sync_sse

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["账号认证"])
api_router.include_router(product.router, prefix="/product", tags=["商品管理"])
api_router.include_router(product_upload.router, prefix="/product", tags=["商品上传"])
api_router.include_router(product_sync_sse.router, prefix="/product", tags=["商品同步SSE"])
api_router.include_router(fission.router, prefix="/fission", tags=["商品裂变"])
api_router.include_router(account.router, prefix="/account", tags=["账号管理"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["工作台"])
api_router.include_router(profile.router, prefix="/profile", tags=["个人中心"])
api_router.include_router(settings.router, prefix="/settings", tags=["系统设置"])
api_router.include_router(playwright_auth.router, prefix="/playwright", tags=["自动化登录"])

