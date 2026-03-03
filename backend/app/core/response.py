"""
统一响应格式模块
"""
from typing import Any, Optional
from uuid import uuid4


def success_response(data: Any = None, msg: str = "success", trace_id: Optional[str] = None):
    """
    成功响应
    
    Args:
        data: 响应数据
        msg: 提示信息
        trace_id: 追踪ID
    
    Returns:
        统一格式的响应字典
    """
    return {
        "code": 200,
        "msg": msg,
        "data": data,
        "trace_id": trace_id or str(uuid4())
    }


def error_response(msg: str = "error", code: int = 500, trace_id: Optional[str] = None):
    """
    错误响应
    
    Args:
        msg: 错误信息
        code: 错误码
        trace_id: 追踪ID
    
    Returns:
        统一格式的响应字典
    """
    return {
        "code": code,
        "msg": msg,
        "data": None,
        "trace_id": trace_id or str(uuid4())
    }


def paginated_response(
    items: list,
    total: int,
    page_no: int = 1,
    page_size: int = 20,
    msg: str = "success",
    trace_id: Optional[str] = None
):
    """
    分页响应
    
    Args:
        items: 数据列表
        total: 总数
        page_no: 当前页码
        page_size: 每页数量
        msg: 提示信息
        trace_id: 追踪ID
    
    Returns:
        统一格式的分页响应字典
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    
    return {
        "code": 200,
        "msg": msg,
        "data": {
            "list": items,
            "total": total,
            "total_pages": total_pages,
            "page_no": page_no,
            "page_size": page_size,
            "success": True
        },
        "trace_id": trace_id or str(uuid4())
    }
