"""
系统设置服务
"""
import json
import httpx
from sqlalchemy.orm import Session
from app.models.system import SystemConfig
from app.schemas.settings import SystemConfigResponse, UpdateSystemConfigRequest
from datetime import datetime
from typing import Dict, Any


class SettingsService:
    """系统设置服务类"""
    
    @staticmethod
    def get_system_config(db: Session) -> SystemConfigResponse:
        """
        获取系统配置
        :param db: 数据库会话
        :return: 系统配置
        """
        # 获取所有配置项
        configs = db.query(SystemConfig).filter(SystemConfig.status == 1).all()
        
        # 转换为字典
        config_dict = {}
        for config in configs:
            if config.config_value:
                try:
                    # 尝试解析JSON值
                    if config.config_value.startswith('{') or config.config_value.startswith('['):
                        config_dict[config.config_key] = json.loads(config.config_value)
                    elif config.config_value.lower() in ['true', 'false']:
                        config_dict[config.config_key] = config.config_value.lower() == 'true'
                    elif config.config_value.isdigit():
                        config_dict[config.config_key] = int(config.config_value)
                    else:
                        config_dict[config.config_key] = config.config_value
                except:
                    config_dict[config.config_key] = config.config_value
        
        # 设置默认值
        default_config = {
            'douyin_app_key': '',
            'douyin_app_secret': '',
            'douyin_redirect_uri': 'http://localhost:3000/auth/callback',
            'system_name': '抖店商家助手',
            'system_version': '1.0.0',
            'max_concurrent_tasks': 5,
            'task_retry_times': 3,
            'task_timeout': 300,
            'max_file_size': 10,
            'allowed_file_types': 'jpg,jpeg,png,gif,xlsx,xls,csv',
            'session_timeout': 24,
            'password_min_length': 6,
            'login_max_attempts': 5,
            'email_notifications': True,
            'task_completion_notify': True,
            'error_notifications': True,
            'log_level': 'INFO',
            'log_retention_days': 30,
            'enable_api_log': True,
            'auto_refresh_token': True,
            'enable_debug_mode': False,
            'maintenance_mode': False
        }
        
        # 合并配置
        default_config.update(config_dict)
        
        return SystemConfigResponse(**default_config)
    
    @staticmethod
    def update_system_config(db: Session, request: UpdateSystemConfigRequest):
        """
        更新系统配置
        :param db: 数据库会话
        :param request: 更新请求
        """
        # 获取请求中的所有非空字段
        update_data = request.dict(exclude_unset=True)
        
        for key, value in update_data.items():
            # 查找现有配置
            config = db.query(SystemConfig).filter(
                SystemConfig.config_key == key,
                SystemConfig.status == 1
            ).first()
            
            # 转换值为字符串
            if isinstance(value, (dict, list)):
                config_value = json.dumps(value, ensure_ascii=False)
            elif isinstance(value, bool):
                config_value = str(value).lower()
            else:
                config_value = str(value)
            
            if config:
                # 更新现有配置
                config.config_value = config_value
                config.update_time = datetime.now()
            else:
                # 创建新配置
                new_config = SystemConfig(
                    config_key=key,
                    config_value=config_value,
                    config_desc=f"系统配置项: {key}",
                    config_type="system"
                )
                db.add(new_config)
        
        db.commit()
    
    @staticmethod
    def reset_system_config(db: Session):
        """
        重置系统配置为默认值
        :param db: 数据库会话
        """
        # 删除所有现有配置
        db.query(SystemConfig).filter(SystemConfig.status == 1).update({"status": 0})
        
        # 创建默认配置
        default_configs = [
            ('douyin_app_key', '', '抖音App Key'),
            ('douyin_app_secret', '', '抖音App Secret'),
            ('douyin_redirect_uri', 'http://localhost:3000/auth/callback', '抖音回调地址'),
            ('system_name', '抖店商家助手', '系统名称'),
            ('system_version', '1.0.0', '系统版本'),
            ('max_concurrent_tasks', '5', '最大并发任务数'),
            ('task_retry_times', '3', '任务重试次数'),
            ('task_timeout', '300', '任务超时时间'),
            ('max_file_size', '10', '最大文件大小'),
            ('allowed_file_types', 'jpg,jpeg,png,gif,xlsx,xls,csv', '允许的文件类型'),
            ('session_timeout', '24', '会话超时时间'),
            ('password_min_length', '6', '密码最小长度'),
            ('login_max_attempts', '5', '登录最大尝试次数'),
            ('email_notifications', 'true', '邮件通知'),
            ('task_completion_notify', 'true', '任务完成通知'),
            ('error_notifications', 'true', '错误通知'),
            ('log_level', 'INFO', '日志级别'),
            ('log_retention_days', '30', '日志保留天数'),
            ('enable_api_log', 'true', '启用API日志'),
            ('auto_refresh_token', 'true', '自动刷新Token'),
            ('enable_debug_mode', 'false', '启用调试模式'),
            ('maintenance_mode', 'false', '维护模式')
        ]
        
        for key, value, desc in default_configs:
            config = SystemConfig(
                config_key=key,
                config_value=value,
                config_desc=desc,
                config_type="system"
            )
            db.add(config)
        
        db.commit()
    
    @staticmethod
    async def test_douyin_api_connection(app_key: str, app_secret: str) -> Dict[str, Any]:
        """
        测试抖音API连接
        :param app_key: App Key
        :param app_secret: App Secret
        :return: 测试结果
        """
        try:
            # 构建测试请求（获取access_token接口）
            test_url = "https://openapi.jinritemai.com/oauth2/access_token"
            
            # 这里只是测试连接，不需要真正的code
            # 我们可以测试一个简单的API来验证app_key和app_secret是否有效
            test_params = {
                "app_key": app_key,
                "app_secret": app_secret,
                "grant_type": "authorization_code",
                "code": "test_code"  # 这会失败，但可以验证app_key/app_secret格式
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(test_url, json=test_params)
                result = response.json()
                
                # 如果返回的错误是关于code无效，说明app_key/app_secret格式正确
                if result.get("err_no") == 40002:  # 无效的code
                    return {"success": True, "message": "API配置格式正确"}
                elif result.get("err_no") == 40001:  # 无效的app_key或app_secret
                    return {"success": False, "message": "App Key或App Secret无效"}
                else:
                    return {"success": True, "message": "API连接正常"}
                    
        except httpx.TimeoutException:
            return {"success": False, "message": "连接超时，请检查网络"}
        except Exception as e:
            return {"success": False, "message": f"连接失败: {str(e)}"}