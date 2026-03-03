from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# 权限枚举
class PermissionEnum:
    PRODUCT_MANAGE = "product_manage"  # 商品管理
    SHOP_MANAGE = "shop_manage"  # 店铺管理
    FISSION_MANAGE = "fission_manage"  # 裂变管理
    ACCOUNT_MANAGE = "account_manage"  # 账号管理
    
    @classmethod
    def all_permissions(cls):
        return [cls.PRODUCT_MANAGE, cls.SHOP_MANAGE, cls.FISSION_MANAGE, cls.ACCOUNT_MANAGE]


# 用户注册
class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="账号")
    password: str = Field(..., min_length=6, max_length=64, description="密码")
    real_name: str = Field(..., min_length=1, max_length=64, description="真实姓名")


class UserRegisterResponse(BaseModel):
    user_id: int
    username: str
    real_name: str
    avatar_url: Optional[str] = None
    account_type: int
    token: str
    permissions: Optional[List[str]] = None
    expire_time: Optional[datetime] = None


# 用户登录
class UserLoginRequest(BaseModel):
    username: str = Field(..., description="账号")
    password: str = Field(..., description="密码")


class UserLoginResponse(BaseModel):
    user_id: int
    username: str
    real_name: str
    avatar_url: Optional[str] = None
    account_type: int
    token: str
    expire_time: Optional[datetime] = None
    permissions: Optional[List[str]] = None


# 当前用户信息
class CurrentUserResponse(BaseModel):
    user_id: int
    username: str
    real_name: str
    avatar_url: Optional[str] = None
    account_type: int
    expire_time: Optional[datetime] = None
    permissions: Optional[List[str]] = None
    last_login_time: Optional[datetime] = None
    last_login_ip: Optional[str] = None


# 修改密码
class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., min_length=6, max_length=64, description="新密码")


# 添加员工账号
class AddEmployeeRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, description="员工账号")
    password: str = Field(..., min_length=6, max_length=64, description="密码")
    real_name: str = Field(..., min_length=1, max_length=64, description="真实姓名")
    expire_time: datetime = Field(..., description="过期时间")
    permissions: List[str] = Field(..., description="权限列表")


class AddEmployeeResponse(BaseModel):
    employee_id: int
    username: str


# 员工账号列表
class EmployeeListRequest(BaseModel):
    page_no: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    account_status: Optional[int] = Field(None, description="0禁用/1启用/2已过期")


class EmployeeInfo(BaseModel):
    employee_id: int
    username: str
    real_name: str
    expire_time: datetime
    permissions: List[str]
    account_status: int
    create_time: datetime


class EmployeeListResponse(BaseModel):
    total: int
    total_pages: int
    list: List[EmployeeInfo]


# 修改员工账号
class UpdateEmployeeRequest(BaseModel):
    real_name: Optional[str] = Field(None, min_length=1, max_length=64, description="真实姓名")
    expire_time: Optional[datetime] = Field(None, description="过期时间")
    permissions: Optional[List[str]] = Field(None, description="权限列表")
    account_status: Optional[int] = Field(None, description="0禁用/1启用")


# 员工申请店铺授权
class RequestShopAuthRequest(BaseModel):
    shop_id: int = Field(..., description="店铺ID")
    reason: Optional[str] = Field(None, max_length=256, description="申请理由")


class RequestShopAuthResponse(BaseModel):
    request_id: str


# 主账号审核店铺授权
class ApproveShopAuthRequest(BaseModel):
    request_id: str = Field(..., description="申请ID")
    approve_status: int = Field(..., description="1通过/2拒绝")
    reject_reason: Optional[str] = Field(None, max_length=256, description="拒绝理由")


# 店铺授权申请列表
class ShopAuthRequestListRequest(BaseModel):
    page_no: int = Field(1, ge=1, description="页码")
    page_size: int = Field(20, ge=1, le=100, description="每页数量")
    approve_status: Optional[int] = Field(None, description="0待审核/1已通过/2已拒绝")


class ShopAuthRequestInfo(BaseModel):
    request_id: str
    employee_id: int
    username: str
    shop_id: int
    shop_name: str
    reason: Optional[str]
    approve_status: int
    create_time: datetime


class ShopAuthRequestListResponse(BaseModel):
    total: int
    total_pages: int
    list: List[ShopAuthRequestInfo]
