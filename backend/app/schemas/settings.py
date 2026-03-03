from pydantic import BaseModel
from typing import Optional


class SystemConfigResponse(BaseModel):
    """系统配置响应"""
    # 抖音API配置
    douyin_app_key: Optional[str]
    douyin_app_secret: Optional[str]
    douyin_redirect_uri: Optional[str]
    
    # 系统配置
    system_name: str
    system_version: str
    max_concurrent_tasks: int
    task_retry_times: int
    task_timeout: int
    
    # 上传配置
    max_file_size: int
    allowed_file_types: str
    
    # 安全配置
    session_timeout: int
    password_min_length: int
    login_max_attempts: int
    
    # 通知配置
    email_notifications: bool
    task_completion_notify: bool
    error_notifications: bool
    
    # 日志配置
    log_level: str
    log_retention_days: int
    enable_api_log: bool
    
    # 其他配置
    auto_refresh_token: bool
    enable_debug_mode: bool
    maintenance_mode: bool


class UpdateSystemConfigRequest(BaseModel):
    """更新系统配置请求"""
    # 抖音API配置
    douyin_app_key: Optional[str] = None
    douyin_app_secret: Optional[str] = None
    douyin_redirect_uri: Optional[str] = None
    
    # 系统配置
    system_name: Optional[str] = None
    max_concurrent_tasks: Optional[int] = None
    task_retry_times: Optional[int] = None
    task_timeout: Optional[int] = None
    
    # 上传配置
    max_file_size: Optional[int] = None
    allowed_file_types: Optional[str] = None
    
    # 安全配置
    session_timeout: Optional[int] = None
    password_min_length: Optional[int] = None
    login_max_attempts: Optional[int] = None
    
    # 通知配置
    email_notifications: Optional[bool] = None
    task_completion_notify: Optional[bool] = None
    error_notifications: Optional[bool] = None
    
    # 日志配置
    log_level: Optional[str] = None
    log_retention_days: Optional[int] = None
    enable_api_log: Optional[bool] = None
    
    # 其他配置
    auto_refresh_token: Optional[bool] = None
    enable_debug_mode: Optional[bool] = None
    maintenance_mode: Optional[bool] = None


class TestDouyinAPIRequest(BaseModel):
    """测试抖音API请求"""
    app_key: str
    app_secret: str