"""
抖店Token服务
符合抖店开放平台OAuth2.0规范（2024最新版）
官方文档：https://op.jinritemai.com/docs/guide-docs/9/21

注意：Token相关接口的签名方式与普通API不同
"""
import hashlib
import hmac
import time
import httpx
from typing import Dict, Any, Tuple
from app.core.config import settings


class DouyinTokenService:
    """抖店Token服务（符合官方2024最新规范）"""
    
    @staticmethod
    def _generate_sign_for_token(params: Dict[str, Any], app_secret: str) -> str:
        """
        生成Token接口的签名（使用hmac-sha256）
        
        Token接口签名规则：
        1. 按 app_key、app_secret、code/refresh_token、grant_type 顺序拼接
        2. 在头尾拼接 app_secret
        3. 使用 hmac-sha256 算法计算签名
        
        :param params: 参数字典
        :param app_secret: 应用密钥
        :return: 签名字符串
        """
        # 按固定顺序拼接参数
        param_pattern = ""
        for key in sorted(params.keys()):
            param_pattern += f"{key}{params[key]}"
        
        # 在头尾拼接 app_secret
        sign_pattern = f"{app_secret}{param_pattern}{app_secret}"
        
        # 使用 hmac-sha256 计算签名
        sign = hmac.new(
            app_secret.encode('utf-8'),
            sign_pattern.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return sign
    
    @staticmethod
    async def get_access_token(code: str) -> Tuple[bool, Dict[str, Any]]:
        """
        使用授权码换取access_token
        
        官方文档：https://op.jinritemai.com/docs/guide-docs/9/21
        
        :param code: 授权码
        :return: (是否成功, 响应数据)
        """
        try:
            # 构建请求参数
            params = {
                "app_key": settings.DOUYIN_APP_KEY,
                "app_secret": settings.DOUYIN_APP_SECRET,
                "code": code,
                "grant_type": "authorization_code"
            }
            
            # 生成签名
            params["sign"] = DouyinTokenService._generate_sign_for_token(params, settings.DOUYIN_APP_SECRET)
            params["sign_method"] = "hmac-sha256"
            
            # Token接口使用不同的URL
            url = f"{settings.DOUYIN_API_BASE_URL}/token/create"
            
            # 发送请求（使用URL query方式）
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, params=params)
                result = response.json()
            
            # 检查响应（抖店API使用err_no，不是code）
            if result.get("err_no") == 0:
                return True, result.get("data", {})
            else:
                return False, {
                    "error": result.get("message", "未知错误"),
                    "err_no": result.get("err_no")
                }
                
        except Exception as e:
            return False, {"error": f"请求失败: {str(e)}"}
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> Tuple[bool, Dict[str, Any]]:
        """
        刷新access_token
        
        官方文档：https://op.jinritemai.com/docs/guide-docs/9/21
        
        :param refresh_token: 刷新令牌
        :return: (是否成功, 响应数据)
        """
        try:
            # 构建请求参数
            params = {
                "app_key": settings.DOUYIN_APP_KEY,
                "app_secret": settings.DOUYIN_APP_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
            
            # 生成签名
            params["sign"] = DouyinTokenService._generate_sign_for_token(params, settings.DOUYIN_APP_SECRET)
            params["sign_method"] = "hmac-sha256"
            
            # 发送请求
            url = f"{settings.DOUYIN_API_BASE_URL}/token/refresh"
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, params=params)
                result = response.json()
            
            # 检查响应
            if result.get("err_no") == 0:
                return True, result.get("data", {})
            else:
                return False, {
                    "error": result.get("message", "未知错误"),
                    "err_no": result.get("err_no")
                }
                
        except Exception as e:
            return False, {"error": f"请求失败: {str(e)}"}
