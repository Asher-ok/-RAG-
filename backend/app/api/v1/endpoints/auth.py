from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.account_service import AccountService
from app.services.shop_service import ShopService
from app.schemas.account import (
    UserRegisterRequest,
    UserRegisterResponse,
    UserLoginRequest,
    UserLoginResponse,
    CurrentUserResponse,
    ChangePasswordRequest
)
from app.schemas.shop import (
    ShopListRequest,
    ShopListResponse,
    ShopInfo,
    UpdateShopStatusRequest
)
from app.schemas.response import ResponseModel
from app.models.account import AccountUser
from app.models.shop import ShopAuth
import json
import math
import urllib.parse

router = APIRouter()


@router.post("/register", response_model=ResponseModel[UserRegisterResponse])
async def register(
    request: UserRegisterRequest,
    db: Session = Depends(get_db)
):
    """用户注册（主账号）"""
    try:
        user, token = AccountService.register_user(db, request)
        
        return ResponseModel.success(
            data=UserRegisterResponse(
                user_id=user.id,
                username=user.username,
                real_name=user.real_name,
                avatar_url=user.avatar_url,
                account_type=user.account_type,
                token=token,
                permissions=None,  # 主账号没有权限限制
                expire_time=None   # 主账号没有过期时间
            )
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"注册失败: {str(e)}", code=500)


@router.post("/login", response_model=ResponseModel[UserLoginResponse])
async def login(
    request: UserLoginRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    """用户登录"""
    try:
        # 获取客户端IP
        ip_address = req.client.host if req.client else "unknown"
        
        user, token = AccountService.login(db, request, ip_address)
        
        # 解析权限
        permissions = None
        if user.account_type == 2 and user.permissions:
            permissions = json.loads(user.permissions)
        
        return ResponseModel.success(
            data=UserLoginResponse(
                user_id=user.id,
                username=user.username,
                real_name=user.real_name,
                avatar_url=user.avatar_url,
                account_type=user.account_type,
                token=token,
                expire_time=user.expire_time if user.account_type == 2 else None,
                permissions=permissions
            )
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"登录失败: {str(e)}", code=500)


@router.post("/logout", response_model=ResponseModel)
async def logout(
    current_user: AccountUser = Depends(get_current_user)
):
    """用户登出"""
    # 这里可以实现token黑名单机制
    return ResponseModel.success(msg="登出成功")


@router.get("/current_user", response_model=ResponseModel[CurrentUserResponse])
async def get_current_user_info(
    current_user: AccountUser = Depends(get_current_user)
):
    """获取当前用户信息"""
    try:
        # 解析权限
        permissions = None
        if current_user.account_type == 2 and current_user.permissions:
            permissions = json.loads(current_user.permissions)
        
        return ResponseModel.success(
            data=CurrentUserResponse(
                user_id=current_user.id,
                username=current_user.username,
                real_name=current_user.real_name,
                avatar_url=current_user.avatar_url,
                account_type=current_user.account_type,
                expire_time=current_user.expire_time if current_user.account_type == 2 else None,
                permissions=permissions,
                last_login_time=current_user.last_login_time,
                last_login_ip=current_user.last_login_ip
            )
        )
    except Exception as e:
        return ResponseModel.error(msg=f"获取用户信息失败: {str(e)}", code=500)


@router.post("/change_password", response_model=ResponseModel)
async def change_password(
    request: ChangePasswordRequest,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改密码"""
    try:
        AccountService.change_password(
            db, 
            current_user.id, 
            request.old_password, 
            request.new_password
        )
        return ResponseModel.success(msg="密码修改成功")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"修改密码失败: {str(e)}", code=500)

@router.get("/get_auth_url")
async def get_auth_url(
    current_user: AccountUser = Depends(get_current_user)
):
    """
    获取授权方式
    根据配置返回OAuth授权链接或Playwright登录指引
    """
    try:
        from app.services.shop_auth_service import ShopAuthService
        
        # 获取授权流程信息
        auth_info = await ShopAuthService.start_auth_flow(current_user.id)
        
        return ResponseModel.success(data=auth_info)
        
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"获取授权信息失败: {str(e)}", code=500)

@router.get("/callback")
async def auth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    """
    授权回调处理（符合抖店OAuth2.0规范）
    
    注意：
    1. 这是GET请求，不是POST
    2. 不需要用户登录状态，从state中获取user_id
    3. 回调成功后重定向到前端页面
    """
    try:
        from app.services.state_service import StateService
        from app.services.douyin_token_service import DouyinTokenService
        from datetime import datetime, timedelta
        from fastapi.responses import RedirectResponse
        
        # 1. 验证state（防CSRF攻击）
        user_id = StateService.verify_state(state)
        
        if not user_id:
            # state无效或已过期，重定向到前端错误页面
            return RedirectResponse(
                url=f"/shop/auth?error=invalid_state&msg={urllib.parse.quote('授权已过期，请重新授权')}"
            )
        
        # 2. 使用code换取access_token（符合抖店API规范）
        success, result = await DouyinTokenService.get_access_token(code)
        
        if not success:
            error_msg = result.get("error", "获取token失败")
            return RedirectResponse(
                url=f"/shop/auth?error=token_failed&msg={urllib.parse.quote(error_msg)}"
            )
        
        # 3. 解析返回数据
        access_token = result.get("access_token")
        refresh_token = result.get("refresh_token")
        expires_in = result.get("expires_in", 86400)  # 默认24小时
        shop_id = result.get("shop_id")
        shop_name = result.get("shop_name")
        
        if not all([access_token, refresh_token, shop_id]):
            return RedirectResponse(
                url=f"/shop/auth?error=invalid_response&msg={urllib.parse.quote('授权响应数据不完整')}"
            )
        
        # 4. 保存或更新店铺授权信息
        expire_time = datetime.now() + timedelta(seconds=expires_in)
        
        # 检查该用户是否已经添加过这个店铺
        existing_shop = db.query(ShopAuth).filter(
            ShopAuth.user_id == user_id,
            ShopAuth.douyin_shop_id == shop_id
        ).first()
        
        if existing_shop:
            # 更新已存在的店铺
            existing_shop.shop_name = shop_name
            existing_shop.access_token = access_token
            existing_shop.refresh_token = refresh_token
            existing_shop.expire_time = expire_time
            existing_shop.last_refresh_time = datetime.now()
            existing_shop.auth_mode = 'api'
            existing_shop.status = 1  # 启用
            existing_shop.update_time = datetime.now()
        else:
            # 新增店铺
            new_shop = ShopAuth(
                user_id=user_id,
                douyin_shop_id=shop_id,
                shop_name=shop_name,
                access_token=access_token,
                refresh_token=refresh_token,
                expire_time=expire_time,
                last_refresh_time=datetime.now(),
                auth_mode='api',
                status=1
            )
            db.add(new_shop)
        
        db.commit()
        
        # 5. 重定向到前端成功页面
        return RedirectResponse(
            url=f"/shop/auth?success=true&shop_name={urllib.parse.quote(shop_name)}"
        )
        
    except Exception as e:
        db.rollback()
        return RedirectResponse(
            url=f"/shop/auth?error=system_error&msg={urllib.parse.quote(str(e))}"
        )

@router.get("/shop_list", response_model=ResponseModel[ShopListResponse])
async def get_shop_list(
    page_no: int = 1,
    page_size: int = 20,
    keyword: str = None,
    status: int = None,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """店铺列表"""
    try:
        total, shops = ShopService.get_shop_list(
            db,
            current_user.id,
            current_user.account_type,
            page_no,
            page_size,
            keyword,
            status
        )
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return ResponseModel.success(
            data=ShopListResponse(
                total=total,
                total_pages=total_pages,
                page_no=page_no,
                page_size=page_size,
                list=[ShopInfo.from_orm(shop) for shop in shops]
            )
        )
    except Exception as e:
        return ResponseModel.error(msg=f"获取店铺列表失败: {str(e)}", code=500)

@router.patch("/shop/{shop_id}/status", response_model=ResponseModel)
async def update_shop_status(
    shop_id: int,
    request: UpdateShopStatusRequest,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """禁用/启用店铺 - 主账号可修改自己的店铺，隐藏管理员可修改任何店铺"""
    try:
        # 查找店铺
        shop = db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status != 0  # 只排除已删除的店铺
        ).first()
        
        if not shop:
            return ResponseModel.error(msg="店铺不存在或已删除", code=404)
        
        # 权限检查
        if current_user.is_hidden == 1:
            # 隐藏管理员（超级管理员）：可以修改任何店铺
            pass
        elif current_user.account_type == 1:
            # 主账号：只能修改自己的店铺
            if shop.user_id != current_user.id:
                return ResponseModel.error(msg="无权操作该店铺", code=403)
        else:
            # 员工账号：不能修改店铺状态
            return ResponseModel.error(msg="员工账号不能修改店铺状态", code=403)
        
        # 更新店铺状态
        shop.status = request.status
        db.commit()
        
        status_text = {0: "删除", 1: "启用", 2: "禁用"}
        return ResponseModel.success(msg=f"店铺已{status_text.get(request.status, '更新')}")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        db.rollback()
        return ResponseModel.error(msg=f"更新店铺状态失败: {str(e)}", code=500)


@router.delete("/shop/{shop_id}", response_model=ResponseModel)
async def delete_shop(
    shop_id: int,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除店铺（软删除）- 主账号可删除自己的店铺，隐藏管理员可删除任何店铺"""
    print(f"\n{'='*60}")
    print(f"[删除店铺] 开始处理删除请求")
    print(f"  shop_id: {shop_id}")
    print(f"  user_id: {current_user.id}")
    print(f"  account_type: {current_user.account_type}")
    print(f"  is_hidden: {current_user.is_hidden}")
    
    try:
        # 查找店铺
        shop = db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status != 0  # 只排除已删除的店铺
        ).first()
        
        if not shop:
            print(f"✗ 店铺不存在或已删除")
            print(f"{'='*60}\n")
            return ResponseModel.error(msg="店铺不存在或已删除", code=404)
        
        print(f"✓ 找到店铺: {shop.shop_name}")
        print(f"  店铺所有者: {shop.user_id}")
        
        # 权限检查
        if current_user.is_hidden == 1:
            # 隐藏管理员（超级管理员）：可以删除任何店铺
            print(f"✓ 隐藏管理员，可以删除任何店铺")
        elif current_user.account_type == 1:
            # 主账号：只能删除自己的店铺
            if shop.user_id != current_user.id:
                print(f"✗ 无权操作: 店铺属于用户 {shop.user_id}")
                print(f"{'='*60}\n")
                return ResponseModel.error(msg="无权操作该店铺", code=403)
            print(f"✓ 主账号，可以删除自己的店铺")
        else:
            # 员工账号：不能删除店铺
            print(f"✗ 权限不足: 员工账号不能删除店铺")
            print(f"{'='*60}\n")
            return ResponseModel.error(msg="员工账号不能删除店铺", code=403)
        
        print(f"  抖音店铺ID: {shop.douyin_shop_id}")
        print(f"  授权模式: {shop.auth_mode}")
        
        # 软删除店铺（设置status=0）
        shop.status = 0
        db.commit()
        
        print(f"✓ 店铺已删除（软删除）")
        print(f"{'='*60}\n")
        
        return ResponseModel.success(msg=f"店铺 {shop.shop_name} 已删除")
    except Exception as e:
        db.rollback()
        print(f"✗ 删除失败: {str(e)}")
        print(f"{'='*60}\n")
        return ResponseModel.error(msg=f"删除店铺失败: {str(e)}", code=500)
        print(f"  抖音店铺ID: {shop.douyin_shop_id}")
        print(f"  授权模式: {shop.auth_mode}")
        
        # 软删除店铺（设置status=0）
        shop.status = 0
        db.commit()
        
        print(f"✓ 店铺已删除（软删除）")
        print(f"{'='*60}\n")
        
        return ResponseModel.success(msg=f"店铺 {shop.shop_name} 已删除")
    except Exception as e:
        db.rollback()
        print(f"✗ 删除失败: {str(e)}")
        print(f"{'='*60}\n")
        return ResponseModel.error(msg=f"删除店铺失败: {str(e)}", code=500)
