from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_master_user
from app.services.settings_service import SettingsService
from app.schemas.settings import (
    SystemConfigResponse,
    UpdateSystemConfigRequest,
    TestDouyinAPIRequest
)
from app.schemas.response import ResponseModel
from app.models.account import AccountUser

router = APIRouter()


@router.get("/system_config", response_model=ResponseModel[SystemConfigResponse])
async def get_system_config(
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """获取系统配置"""
    try:
        config = SettingsService.get_system_config(db)
        return ResponseModel.success(data=config)
    except Exception as e:
        return ResponseModel.error(msg=f"获取系统配置失败: {str(e)}", code=500)


@router.post("/system_config", response_model=ResponseModel)
async def update_system_config(
    request: UpdateSystemConfigRequest,
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """更新系统配置"""
    try:
        SettingsService.update_system_config(db, request)
        return ResponseModel.success(msg="系统配置保存成功")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"保存系统配置失败: {str(e)}", code=500)


@router.post("/reset_config", response_model=ResponseModel)
async def reset_system_config(
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """重置系统配置"""
    try:
        SettingsService.reset_system_config(db)
        return ResponseModel.success(msg="系统配置已重置为默认值")
    except Exception as e:
        return ResponseModel.error(msg=f"重置系统配置失败: {str(e)}", code=500)


@router.post("/test_douyin_api", response_model=ResponseModel)
async def test_douyin_api(
    request: TestDouyinAPIRequest,
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """测试抖音API连接"""
    try:
        result = await SettingsService.test_douyin_api_connection(
            request.app_key, 
            request.app_secret
        )
        
        if result.get("success"):
            return ResponseModel.success(msg="抖音API连接测试成功")
        else:
            return ResponseModel.error(
                msg=f"抖音API连接测试失败: {result.get('message', '未知错误')}", 
                code=400
            )
    except Exception as e:
        return ResponseModel.error(msg=f"测试抖音API连接失败: {str(e)}", code=500)