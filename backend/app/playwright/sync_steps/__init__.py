"""
商品同步步骤模块

将商品同步流程拆分为独立的步骤，提高代码可维护性
"""

from .sync_executor import execute_product_sync

__all__ = ['execute_product_sync']
