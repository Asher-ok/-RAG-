"""
Playwright自动化登录相关接口
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.playwright.login_helper登录助手 import LoginHelper
from app.playwright.account_manager账号管理 import AccountManager
from app.core.config import settings
from app.core.response import success_response, error_response
from app.core.database import get_db
from app.core.dependencies import get_current_user, check_permission
from app.models.account import AccountUser

router = APIRouter()

# 初始化管理器
account_manager = AccountManager(settings.PLAYWRIGHT_STATES_DIR)


class ManualLoginRequest(BaseModel):
    """手动登录请求"""
    account_id: str
    headless: bool = False
    wait_time: int = 120


class VerifyLoginRequest(BaseModel):
    """验证登录请求"""
    account_id: str


class BatchCheckRequest(BaseModel):
    """批量检查请求"""
    account_ids: List[str]


class DeleteStateRequest(BaseModel):
    """删除状态请求"""
    account_id: str


class SaveLoginRequest(BaseModel):
    """保存登录状态请求（来自Electron前端）"""
    account_id: str
    user_id: int  # ✅ 前端传递用户ID
    storage_state: Optional[dict] = None  # 完整的 Playwright storage_state 格式（持久化模式下可为None）
    shop_info: Optional[dict] = None
    partition_name: Optional[str] = None  # ✅ Electron partition 名称


@router.post("/save-login")
async def save_login_from_electron(
    request: SaveLoginRequest,
    db: Session = Depends(get_db)
):
    """
    保存从Electron前端获取的登录状态
    
    两种模式：
    1. 持久化模式（推荐）：storage_state 为 None，登录状态已保存到本地磁盘
    2. 传输模式（旧版）：storage_state 包含完整的 Cookie 和 localStorage 数据
    """
    print(f"\n{'='*60}")
    print(f"[Electron Login] 收到登录状态")
    print(f"  账号ID: {request.account_id}")
    print(f"  模式: {'持久化模式（本地存储）' if request.storage_state is None else '传输模式（发送Cookie）'}")
    if request.partition_name:
        print(f"  Partition: {request.partition_name}")
    if request.storage_state:
        print(f"  Cookies数量: {len(request.storage_state.get('cookies', []))}")
        print(f"  Origins数量: {len(request.storage_state.get('origins', []))}")
    print(f"  店铺信息: {request.shop_info}")
    print(f"{'='*60}\n")
    
    try:
        from app.services.shop_auth_service import ShopAuthService
        
        # 如果有店铺信息，提取店铺ID作为存储key
        shop_id = None
        if request.shop_info and request.shop_info.get('shopId'):
            shop_id = request.shop_info.get('shopId')
            print(f"[Electron Login] 提取到店铺ID: {shop_id}")
        
        # 使用店铺ID作为存储key（如果没有店铺ID，使用原account_id）
        storage_key = shop_id if shop_id else request.account_id
        
        # 如果提供了 storage_state，保存到文件（旧版兼容）
        if request.storage_state:
            success = account_manager.save_state(storage_key, request.storage_state)
            
            if not success:
                return error_response(msg="保存登录状态失败")
            
            print(f"[Electron Login] ✓ Storage state 已保存到: ../states/account_{storage_key}/state.json (项目根目录)")
        else:
            print(f"[Electron Login] ✓ 使用持久化模式，登录状态已保存到本地磁盘")
            if request.partition_name:
                print(f"[Electron Login]   Partition: {request.partition_name}")
            else:
                print(f"[Electron Login]   Partition: persist:douyin-shop-{storage_key} (默认)")
        
        # 如果有店铺信息，保存到数据库
        if shop_id:
            shop_info = {
                'shop_id': shop_id,
                'shop_name': request.shop_info.get('shopName', '未知店铺'),
                'partition_name': request.partition_name  # ✅ 保存实际的 partition 名称
            }
            
            # 保存店铺授权信息（使用店铺ID作为account_id）
            success, message = await ShopAuthService.complete_playwright_auth(
                db=db,
                user_id=request.user_id,  # ✅ 使用前端传递的 user_id
                account_id=shop_id,  # 使用店铺ID
                shop_info=shop_info
            )
            
            print(f"[Electron Login] 保存店铺信息: {success}, {message}")
            
            if success:
                return success_response(msg="店铺授权成功")
            else:
                return error_response(msg=message)
        
        return success_response(msg="登录状态已保存")
    
    except Exception as e:
        import traceback
        print(f"\n[Electron Login] ✗ 保存失败:")
        print(f"  错误: {str(e)}")
        traceback.print_exc()
        return error_response(msg=f"保存失败: {str(e)}")


@router.post("/manual-login")
async def manual_login(
    request: ManualLoginRequest,
    current_user: AccountUser = Depends(check_permission('shop_manage')),
    db: Session = Depends(get_db)
):
    """
    手动登录接口
    打开浏览器让用户手动登录，完成后自动保存Cookie和店铺信息
    
    注意：account_id格式应为 user_{user_id}_shop_{shop_id} 以支持同一用户的多个店铺
    """
    import traceback
    
    print(f"\n{'='*60}")
    print(f"[Playwright] 收到登录请求")
    print(f"  账号ID: {request.account_id}")
    print(f"  无头模式: {request.headless}")
    print(f"  等待时间: {request.wait_time}秒")
    print(f"{'='*60}\n")
    
    try:
        from app.playwright.shop_info_extractor店铺信息 import ShopInfoExtractor
        from app.services.shop_auth_service import ShopAuthService
        
        print("[Playwright] 初始化LoginHelper...")
        login_helper = LoginHelper()
        
        print("[Playwright] 开始执行登录...")
        # 执行登录
        result = await login_helper.manual_login(
            account_id=request.account_id,
            headless=request.headless,
            wait_time=request.wait_time
        )
        
        print(f"[Playwright] 登录结果: {result}")
        
        if not result["success"]:
            print(f"[Playwright] 登录失败: {result['message']}")
            return error_response(msg=result["message"])
        
        # 如果登录成功，尝试提取店铺信息并保存到数据库
        if result.get("login_detected") and result.get("shop_info"):
            shop_info = result["shop_info"]
            print(f"[Playwright] 提取到店铺信息: {shop_info}")
            
            # 从account_id中提取user_id（格式：user_{user_id} 或 user_{user_id}_shop_{shop_id}）
            if request.account_id.startswith("user_"):
                # 提取user_id
                parts = request.account_id.split("_")
                if len(parts) >= 2:
                    user_id = int(parts[1])
                    print(f"[Playwright] 用户ID: {user_id}")
                    
                    # 获取店铺ID
                    shop_id = shop_info.get("shop_id")
                    
                    # 生成新的account_id（包含shop_id，确保唯一性）
                    new_account_id = f"user_{user_id}_shop_{shop_id}"
                    print(f"[Playwright] 生成新的账号ID: {new_account_id}")
                    
                    # 如果新的account_id与原来的不同，需要重新保存状态
                    if new_account_id != request.account_id:
                        print(f"[Playwright] 账号ID已更新，重新保存状态...")
                        # 加载原状态
                        old_state = account_manager.load_state(request.account_id)
                        if old_state:
                            # 保存到新的account_id（old_state已经是state内容，不需要再.get("state")）
                            success = account_manager.save_state(new_account_id, old_state)
                            if success:
                                print(f"✓ 状态已复制到新账号ID: {new_account_id}")
                            else:
                                print(f"✗ 状态复制失败")
                            # 可选：删除旧的状态
                            # account_manager.delete_state(request.account_id)
                        else:
                            print(f"⚠ 未找到原账号状态: {request.account_id}")
                    
                    # 保存店铺授权信息
                    print("[Playwright] 保存店铺授权信息到数据库...")
                    success, message = await ShopAuthService.complete_playwright_auth(
                        db=db,
                        user_id=user_id,
                        account_id=new_account_id,  # 使用新的account_id
                        shop_info=shop_info
                    )
                    
                    result["shop_saved"] = success
                    result["shop_message"] = message
                    result["account_id"] = new_account_id  # 返回新的account_id
                    print(f"[Playwright] 保存结果: {success}, {message}")
                else:
                    print(f"[Playwright] ⚠ 无法从account_id中提取user_id")
        
        print(f"[Playwright] 返回成功响应\n")
        return success_response(data=result, msg="登录完成")
    
    except Exception as e:
        error_msg = f"登录失败: {str(e)}"
        print(f"\n{'='*60}")
        print(f"[Playwright] ✗ 发生异常:")
        print(f"  错误信息: {error_msg}")
        print(f"  异常类型: {type(e).__name__}")
        print(f"  详细堆栈:")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/verify-login")
async def verify_login(
    request: VerifyLoginRequest,
    current_user: AccountUser = Depends(check_permission('shop_manage'))
):
    """
    验证登录状态接口
    检查已保存的Cookie是否仍然有效
    """
    try:
        login_helper = LoginHelper()
        result = await login_helper.verify_login_state(request.account_id)
        
        return success_response(data=result, message="验证完成")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")


@router.post("/batch-check")
async def batch_check(
    request: BatchCheckRequest,
    current_user: AccountUser = Depends(check_permission('shop_manage'))
):
    """
    批量检查账号登录状态
    """
    try:
        login_helper = LoginHelper()
        result = await login_helper.batch_check_accounts(request.account_ids)
        
        return success_response(data=result, message="批量检查完成")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量检查失败: {str(e)}")


@router.get("/accounts")
async def list_accounts(
    current_user: AccountUser = Depends(check_permission('shop_manage'))
):
    """
    列出所有已保存登录状态的账号
    """
    try:
        accounts = account_manager.list_accounts()
        
        return success_response(
            data={
                "total": len(accounts),
                "accounts": accounts
            },
            message="获取账号列表成功"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取账号列表失败: {str(e)}")


@router.get("/account/{account_id}/info")
async def get_account_info(
    account_id: str,
    current_user: AccountUser = Depends(check_permission('shop_manage'))
):
    """
    获取指定账号的状态信息
    """
    try:
        info = account_manager.get_state_info(account_id)
        
        if info:
            return success_response(data=info, message="获取账号信息成功")
        else:
            return error_response(message="账号状态不存在")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取账号信息失败: {str(e)}")


@router.delete("/account/{account_id}/state")
async def delete_account_state(
    account_id: str,
    current_user: AccountUser = Depends(check_permission('shop_manage'))
):
    """
    删除指定账号的登录状态
    """
    try:
        success = account_manager.delete_state(account_id)
        
        if success:
            return success_response(message="删除成功")
        else:
            return error_response(message="删除失败或账号不存在")
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")


@router.get("/account/{account_id}/storage-state")
async def get_storage_state(
    account_id: str,
    current_user: AccountUser = Depends(get_current_user)
):
    """
    获取指定账号的登录状态（storageState）
    用于前端执行裂变自动化时恢复登录状态
    
    前端流程：
    1. 用户选择商品（商品属于某个店铺）
    2. 根据店铺的 account_id 调用此接口获取 storageState
    3. 使用 storageState 在 Electron 中恢复登录状态
    4. 执行裂变自动化
    """
    try:
        print(f"\n[获取StorageState] 账号ID: {account_id}")
        
        # 从文件加载 storage_state
        state = account_manager.load_state(account_id)
        
        if state:
            # 统计信息
            cookies_count = len(state.get('cookies', []))
            origins_count = len(state.get('origins', []))
            
            print(f"[获取StorageState] ✓ 找到登录状态")
            print(f"  Cookies数量: {cookies_count}")
            print(f"  Origins数量: {origins_count}")
            
            return success_response(
                data={
                    "account_id": account_id,
                    "storage_state": state,
                    "cookies_count": cookies_count,
                    "origins_count": origins_count
                },
                msg="获取登录状态成功"
            )
        else:
            print(f"[获取StorageState] ✗ 未找到登录状态")
            return error_response(msg="未找到该账号的登录状态，请先登录店铺")
    
    except Exception as e:
        import traceback
        print(f"\n[获取StorageState] ✗ 获取失败:")
        print(f"  错误: {str(e)}")
        traceback.print_exc()
        return error_response(msg=f"获取登录状态失败: {str(e)}")


@router.get("/shop/{shop_id}/storage-state")
async def get_storage_state_by_shop(
    shop_id: str,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    根据店铺ID获取登录状态（storageState）
    用于前端执行裂变自动化时恢复登录状态
    
    前端流程：
    1. 用户选择商品（商品有 shop_id）
    2. 根据 shop_id 调用此接口获取对应店铺的 storageState
    3. 使用 storageState 在 Electron 中恢复登录状态
    4. 执行裂变自动化
    """
    try:
        print(f"\n[获取StorageState] 店铺ID: {shop_id}")
        
        # 从数据库查找该店铺的授权信息
        from app.models.shop import ShopAuth
        
        shop_auth = db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status == 1  # 只查询启用状态的授权
        ).first()
        
        if not shop_auth:
            print(f"[获取StorageState] ✗ 未找到店铺授权信息")
            return error_response(msg="未找到该店铺的授权信息，请先登录店铺")
        
        account_id = shop_auth.playwright_account_id
        print(f"[获取StorageState] 找到账号ID: {account_id}")
        
        if not account_id:
            print(f"[获取StorageState] ✗ 店铺未配置 Playwright 账号")
            return error_response(msg="该店铺未配置 Playwright 账号，请先登录")
        
        # 从文件加载 storage_state
        state = account_manager.load_state(account_id)
        
        if state:
            # 统计信息
            cookies_count = len(state.get('cookies', []))
            origins_count = len(state.get('origins', []))
            
            print(f"[获取StorageState] ✓ 找到登录状态")
            print(f"  店铺名称: {shop_auth.shop_name}")
            print(f"  账号ID: {account_id}")
            print(f"  Cookies数量: {cookies_count}")
            print(f"  Origins数量: {origins_count}")
            
            return success_response(
                data={
                    "shop_id": shop_id,
                    "shop_name": shop_auth.shop_name,
                    "account_id": account_id,
                    "storage_state": state,
                    "cookies_count": cookies_count,
                    "origins_count": origins_count
                },
                msg="获取登录状态成功"
            )
        else:
            print(f"[获取StorageState] ✗ 未找到登录状态文件")
            return error_response(msg="未找到该店铺的登录状态，请重新登录店铺")
    
    except Exception as e:
        import traceback
        print(f"\n[获取StorageState] ✗ 获取失败:")
        print(f"  错误: {str(e)}")
        traceback.print_exc()
        return error_response(msg=f"获取登录状态失败: {str(e)}")


@router.get("/config")
async def get_playwright_config(
    current_user: AccountUser = Depends(get_current_user)
):
    """
    获取Playwright配置信息
    """
    return success_response(
        data={
            "use_playwright": settings.USE_PLAYWRIGHT,
            "headless": settings.PLAYWRIGHT_HEADLESS,
            "timeout": settings.PLAYWRIGHT_TIMEOUT,
            "states_dir": settings.PLAYWRIGHT_STATES_DIR
        },
        message="获取配置成功"
    )
