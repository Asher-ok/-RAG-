from typing import Optional, Any, Generic, TypeVar
from pydantic import BaseModel
import uuid

T = TypeVar('T')

class ResponseModel(BaseModel, Generic[T]):
    """统一响应模型"""
    code: int = 200
    msg: str = "success"
    data: Optional[T] = None
    trace_id: str = ""
    
    @classmethod
    def success(cls, data: Any = None, msg: str = "success") -> "ResponseModel":
        """成功响应"""
        return cls(
            code=200,
            msg=msg,
            data=data,
            trace_id=str(uuid.uuid4())
        )
    
    @classmethod
    def error(cls, code: int = 500, msg: str = "error", data: Any = None) -> "ResponseModel":
        """错误响应"""
        return cls(
            code=code,
            msg=msg,
            data=data,
            trace_id=str(uuid.uuid4())
        )

class PageResponse(BaseModel):
    """分页响应模型"""
    total: int
    total_pages: int
    page_no: int
    page_size: int
    list: list
