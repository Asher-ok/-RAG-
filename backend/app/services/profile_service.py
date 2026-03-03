"""
用户个人信息服务
"""
from sqlalchemy.orm import Session
from app.models.account import AccountUser
from app.schemas.profile import UpdateUserInfoRequest
from datetime import datetime


class ProfileService:
    """个人信息服务类"""
    
    @staticmethod
    def update_user_info(db: Session, user_id: int, request: UpdateUserInfoRequest) -> AccountUser:
        """
        更新用户信息
        :param db: 数据库会话
        :param user_id: 用户ID
        :param request: 更新请求
        :return: 更新后的用户对象
        """
        user = db.query(AccountUser).filter(
            AccountUser.id == user_id,
            AccountUser.status == 1
        ).first()
        
        if not user:
            raise ValueError("用户不存在")
        
        # 更新真实姓名
        if request.real_name is not None:
            user.real_name = request.real_name
        
        user.update_time = datetime.now()
        db.commit()
        db.refresh(user)
        
        return user
    
    @staticmethod
    def update_avatar(db: Session, user_id: int, avatar_url: str) -> AccountUser:
        """
        更新用户头像
        :param db: 数据库会话
        :param user_id: 用户ID
        :param avatar_url: 头像URL
        :return: 更新后的用户对象
        """
        print(f"[ProfileService.update_avatar] 开始更新，用户ID: {user_id}, 头像URL: {avatar_url}")
        
        user = db.query(AccountUser).filter(
            AccountUser.id == user_id,
            AccountUser.status == 1
        ).first()
        
        if not user:
            print(f"[ProfileService.update_avatar] 用户不存在")
            raise ValueError("用户不存在")
        
        print(f"[ProfileService.update_avatar] 找到用户: {user.username}, 当前头像: {user.avatar_url}")
        
        user.avatar_url = avatar_url
        user.update_time = datetime.now()
        
        print(f"[ProfileService.update_avatar] 准备提交到数据库...")
        db.commit()
        print(f"[ProfileService.update_avatar] 已提交")
        
        db.refresh(user)
        print(f"[ProfileService.update_avatar] 刷新后头像URL: {user.avatar_url}")
        
        return user