#!/usr/bin/env python3
"""
清理 user_22 的店铺数据
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.shop import ShopAuth

def clean_user22_shops():
    """清理 user_22 的所有店铺"""
    db = SessionLocal()
    try:
        # 查询 user_22 的所有店铺
        shops = db.query(ShopAuth).filter(ShopAuth.user_id == 22).all()
        
        print(f"\n找到 {len(shops)} 个店铺:")
        for shop in shops:
            print(f"  - ID: {shop.id}, 名称: {shop.shop_name}, 抖音店铺ID: {shop.douyin_shop_id}")
        
        if not shops:
            print("没有找到需要清理的店铺")
            return
        
        # 确认删除
        confirm = input("\n确认删除这些店铺吗? (yes/no): ")
        if confirm.lower() != 'yes':
            print("取消删除")
            return
        
        # 硬删除（直接从数据库删除）
        for shop in shops:
            db.delete(shop)
            print(f"✓ 已硬删除店铺: {shop.shop_name} (ID: {shop.id})")
        
        db.commit()
        print(f"\n✓ 成功清理 {len(shops)} 个店铺")
        
    except Exception as e:
        print(f"\n✗ 清理失败: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    clean_user22_shops()
