from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.profile_service import ProfileService
from app.schemas.profile import (
    UpdateUserInfoRequest,
    UpdateUserInfoResponse
)
from app.schemas.response import ResponseModel
from app.models.account import AccountUser
import os
import uuid
from datetime import datetime

router = APIRouter()


@router.post("/update_info", response_model=ResponseModel[UpdateUserInfoResponse])
async def update_user_info(
    request: UpdateUserInfoRequest,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户信息"""
    try:
        updated_user = ProfileService.update_user_info(db, current_user.id, request)
        
        return ResponseModel.success(
            data=UpdateUserInfoResponse(
                user_id=updated_user.id,
                username=updated_user.username,
                real_name=updated_user.real_name,
                avatar_url=updated_user.avatar_url
            ),
            msg="用户信息更新成功"
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"更新用户信息失败: {str(e)}", code=500)


@router.post("/upload_avatar", response_model=ResponseModel)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """上传用户头像"""
    try:
        print(f"\n[上传头像] 开始处理，用户ID: {current_user.id}, 用户名: {current_user.username}")
        
        # 验证文件类型
        if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
            print(f"[上传头像] 文件类型不支持: {file.content_type}")
            return ResponseModel.error(msg="只支持jpg/png格式图片", code=400)
        
        print(f"[上传头像] 文件类型: {file.content_type}, 文件名: {file.filename}")
        
        # 验证文件大小（最大2MB）
        file_content = await file.read()
        file_size_mb = len(file_content) / 1024 / 1024
        print(f"[上传头像] 文件大小: {file_size_mb:.2f} MB")
        
        if len(file_content) > 2 * 1024 * 1024:
            print(f"[上传头像] 文件过大")
            return ResponseModel.error(msg="图片大小不能超过2MB", code=400)
        
        # 生成唯一文件名
        file_extension = file.filename.split('.')[-1].lower()
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        print(f"[上传头像] 生成文件名: {unique_filename}")
        
        # 确保上传目录存在（使用绝对路径）
        # 获取项目根目录（backend目录）
        import sys
        if getattr(sys, 'frozen', False):
            # 打包后的可执行文件
            base_dir = os.path.dirname(sys.executable)
        else:
            # 开发环境：从当前文件向上找到backend目录
            # 当前文件: /root/backend/app/api/v1/endpoints/profile.py
            # 向上5层: /root/backend/
            current_file = os.path.abspath(__file__)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file)))))
        
        upload_dir = os.path.join(base_dir, "static", "avatars")
        os.makedirs(upload_dir, exist_ok=True)
        print(f"[上传头像] 当前文件: {os.path.abspath(__file__)}")
        print(f"[上传头像] 项目根目录: {base_dir}")
        print(f"[上传头像] 上传目录: {upload_dir}")
        
        # 保存文件
        file_path = os.path.join(upload_dir, unique_filename)
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        print(f"[上传头像] 文件已保存: {file_path}")
        
        # 生成访问URL
        avatar_url = f"/static/avatars/{unique_filename}"
        print(f"[上传头像] 生成URL: {avatar_url}")
        
        # 更新用户头像URL
        print(f"[上传头像] 准备更新数据库...")
        updated_user = ProfileService.update_avatar(db, current_user.id, avatar_url)
        print(f"[上传头像] 数据库更新成功，新头像URL: {updated_user.avatar_url}")
        
        return ResponseModel.success(
            data={"avatar_url": avatar_url},
            msg="头像上传成功"
        )
    except Exception as e:
        print(f"[上传头像] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return ResponseModel.error(msg=f"头像上传失败: {str(e)}", code=500)