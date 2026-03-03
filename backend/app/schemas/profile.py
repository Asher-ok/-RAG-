from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class UpdateUserInfoRequest(BaseModel):
    """更新用户信息请求"""
    real_name: Optional[str] = None


class UpdateUserInfoResponse(BaseModel):
    """更新用户信息响应"""
    user_id: int
    username: str
    real_name: Optional[str]
    avatar_url: Optional[str]