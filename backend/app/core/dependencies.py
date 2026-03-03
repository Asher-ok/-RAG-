from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.services.account_service import AccountService
from app.models.account import AccountUser


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> AccountUser:
    """获取当前登录用户"""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证信息"
        )
    
    # 解析token
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证格式错误"
        )
    
    token = authorization.replace("Bearer ", "")
    payload = decode_access_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token无效或已过期"
        )
    
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token无效"
        )
    
    # 获取用户信息
    user = AccountService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    
    # 检查账号状态
    if user.account_status == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用"
        )
    
    # 员工账号实时检查过期时间
    if user.account_type == 2 and user.expire_time:
        from datetime import datetime
        if user.expire_time < datetime.now():
            # 更新状态为已过期
            user.account_status = 2
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="账号已过期"
            )
    
    # 再次检查状态（防止其他地方设置了状态）
    if user.account_status == 2:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已过期"
        )
    
    return user


async def get_current_master_user(
    current_user: AccountUser = Depends(get_current_user)
) -> AccountUser:
    """获取当前主账号用户（仅主账号可访问）"""
    if current_user.account_type != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅主账号可访问"
        )
    return current_user


def check_permission(permission: str):
    """检查权限装饰器"""
    async def permission_checker(
        current_user: AccountUser = Depends(get_current_user)
    ) -> AccountUser:
        # 隐藏管理员拥有超级权限（优先级最高）
        if current_user.is_hidden == 1:
            return current_user
        
        # 主账号拥有所有权限
        if current_user.account_type == 1:
            return current_user
        
        # 员工账号检查权限
        if current_user.account_type == 2 and current_user.permissions:
            import json
            permissions = json.loads(current_user.permissions)
            if permission in permissions:
                return current_user
        
        # 普通账号没有任何权限
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"无权限: {permission}"
        )
    
    return permission_checker
