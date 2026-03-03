"""
抖音开放平台API封装服务
官方文档：https://op.jinritemai.com/
符合官方最新规范（2024版）
"""
import hashlib
import hmac
import time
import json
import httpx
from typing import Dict, Any, Optional
from app.core.config import settings


class DouyinAPIService:
    """
    抖店API服务类（符合官方2024最新规范）
    
    官方签名规则：
    1. 将param_json序列化为JSON（保证Key有序）
    2. 按 app_key、method、param_json、timestamp、v 顺序拼接
    3. 在头尾拼接 app_secret
    4. 使用 hmac-sha256 算法计算签名（推荐）
    
    官方请求规范：
    - param_json 放在 POST body 中（Content-Type: application/json）
    - 其他参数（method、app_key、timestamp、v、sign等）放在 URL query
    """
    
    def __init__(self, access_token: Optional[str] = None):
        self.base_url = settings.DOUYIN_API_BASE_URL  # https://openapi-fxg.jinritemai.com
        self.app_key = settings.DOUYIN_APP_KEY
        self.app_secret = settings.DOUYIN_APP_SECRET
        self.access_token = access_token
    
    def _serialize_param_json(self, params: Dict[str, Any]) -> str:
        """
        序列化param_json（符合官方要求）
        
        要求：
        1. 保证JSON所有层级上Key的有序性
        2. 保证JSON的所有数值不带多余的小数点（如1.0应显示为1）
        3. 禁用Html Escape
        
        :param params: 业务参数
        :return: JSON字符串
        """
        # 递归处理参数，将整数浮点数转换为整数
        def clean_params(obj):
            if isinstance(obj, dict):
                return {k: clean_params(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [clean_params(item) for item in obj]
            elif isinstance(obj, float) and obj.is_integer():
                # 如果是整数浮点数（如1.0），转换为整数
                return int(obj)
            else:
                return obj
        
        cleaned_params = clean_params(params)
        
        # sort_keys=True 保证Key有序
        # ensure_ascii=False 禁用Html Escape
        # separators=(',', ':') 去除多余空格
        return json.dumps(cleaned_params, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    
    def _generate_sign_hmac_sha256(self, app_key: str, method: str, param_json: str, 
                                   timestamp: str, v: str) -> str:
        """
        生成hmac-sha256签名（完全符合官方规范）
        
        官方签名步骤：
        1. 按 app_key、method、param_json、timestamp、v 顺序拼接
           格式：app_key{value}method{value}param_json{value}timestamp{value}v{value}
        2. 在头尾拼接 app_secret
           格式：{app_secret}{拼接结果}{app_secret}
        3. 使用 hmac-sha256 算法计算签名
           PHP: hash_hmac("sha256", $signPattern, $appSecret)
        
        :return: 签名字符串（小写十六进制）
        """
        # STEP1: 拼接参数（按固定顺序）
        # 格式：app_key***method***param_json***timestamp***v***
        param_pattern = f"app_key{app_key}method{method}param_json{param_json}timestamp{timestamp}v{v}"
        
        # STEP2: 在头尾拼接 app_secret
        sign_pattern = f"{self.app_secret}{param_pattern}{self.app_secret}"
        
        # STEP3: 使用 hmac-sha256 计算签名
        # 注意：Python的hmac.new(key, msg, digestmod)
        # 对应PHP的hash_hmac(algo, data, key)
        # 所以这里key是app_secret，msg是sign_pattern
        sign = hmac.new(
            self.app_secret.encode('utf-8'),  # key
            sign_pattern.encode('utf-8'),     # message
            hashlib.sha256                     # digest algorithm
        ).hexdigest()  # 返回小写十六进制字符串
        
        return sign
    
    async def _request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        发送API请求（符合官方2024最新规范）
        
        官方要求：
        - param_json 放在 POST body（Content-Type: application/json）
        - 其他参数放在 URL query
        
        :param method: API方法名，如 product.add
        :param params: 业务参数
        :return: 响应数据
        """
        # 序列化业务参数
        param_json = self._serialize_param_json(params) if params else "{}"
        
        # 当前时间戳
        timestamp = str(int(time.time()))
        
        # 生成签名
        sign = self._generate_sign_hmac_sha256(
            app_key=self.app_key,
            method=method,
            param_json=param_json,
            timestamp=timestamp,
            v="2"
        )
        
        # 构建 URL query 参数
        query_params = {
            "method": method,
            "app_key": self.app_key,
            "timestamp": timestamp,
            "v": "2",
            "sign": sign,
            "sign_method": "hmac-sha256"
        }
        
        # 添加 access_token（如果有）
        if self.access_token:
            query_params["access_token"] = self.access_token
        
        # 发送请求
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.base_url,
                params=query_params,  # URL query 参数
                json=json.loads(param_json),  # POST body（JSON格式）
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            
            return result
    
    async def add_product(self, product_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建商品（符合抖店API规范）
        API文档：https://op.jinritemai.com/docs/api-docs/14/59
        
        :param product_data: 商品数据（会被序列化为param_json）
        :return: 创建结果 {"err_no": 0, "message": "success", "data": {...}}
        """
        return await self._request("product.add", product_data)
    
    async def get_product_detail(self, product_id: str) -> Dict[str, Any]:
        """
        获取商品详情
        API文档：https://op.jinritemai.com/docs/api-docs/14/56
        
        :param product_id: 商品ID
        :return: 商品详情
        """
        return await self._request("product.detail", {"product_id": product_id})
    
    async def get_product_list(self, page: int = 0, size: int = 20, status: Optional[int] = None) -> Dict[str, Any]:
        """
        获取商品列表
        API文档：https://op.jinritemai.com/docs/api-docs/14/57
        
        :param page: 页码（从0开始）
        :param size: 每页数量
        :param status: 商品状态（0草稿/1上架/2下架）
        :return: 商品列表
        """
        params = {
            "page": page,
            "size": size,
        }
        if status is not None:
            params["status"] = status
        
        return await self._request("product.list", params)
    
    async def upload_image(self, image_data: bytes) -> Dict[str, Any]:
        """
        上传图片到抖音图床（符合抖店API规范）
        API文档：https://op.jinritemai.com/docs/api-docs/14/2326
        
        注意：图片上传使用 multipart/form-data，签名不包含文件内容
        
        :param image_data: 图片二进制数据
        :return: 图片URL {"err_no": 0, "message": "success", "data": {"url": "..."}}
        """
        method = "material.uploadImageSync"
        timestamp = str(int(time.time()))
        
        # 图片上传时，param_json 为空对象
        param_json = "{}"
        
        # 生成签名
        sign = self._generate_sign_hmac_sha256(
            app_key=self.app_key,
            method=method,
            param_json=param_json,
            timestamp=timestamp,
            v="2"
        )
        
        # 构建 URL query 参数
        query_params = {
            "method": method,
            "app_key": self.app_key,
            "timestamp": timestamp,
            "v": "2",
            "sign": sign,
            "sign_method": "hmac-sha256"
        }
        
        if self.access_token:
            query_params["access_token"] = self.access_token
        
        # 发送请求（multipart/form-data）
        async with httpx.AsyncClient(timeout=30.0) as client:
            files = {"file": ("image.jpg", image_data, "image/jpeg")}
            response = await client.post(
                self.base_url,
                params=query_params,
                files=files
            )
            result = response.json()
            
            return result
    
    async def sync_product_status(self, product_ids: list) -> Dict[str, Any]:
        """
        同步商品状态
        :param product_ids: 商品ID列表
        :return: 同步结果
        """
        # 批量获取商品详情
        results = []
        for product_id in product_ids:
            detail = await self.get_product_detail(product_id)
            results.append(detail)
        
        return {"results": results}
