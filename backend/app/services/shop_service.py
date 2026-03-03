from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Tuple, Optional
from app.models.shop import ShopAuth
from app.models.account import EmployeeShopRelation
from datetime import datetime


class ShopService:
    """店铺服务"""
    
    @staticmethod
    def get_shop_list(
        db: Session,
        user_id: int,
        account_type: int,
        page_no: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        status: Optional[int] = None
    ) -> Tuple[int, List[ShopAuth]]:
        """
        获取店铺列表
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            account_type: 账号类型 (1=主账号, 2=员工账号)
            page_no: 页码
            page_size: 每页数量
            keyword: 搜索关键词（店铺名称或抖音店铺ID）
            status: 状态筛选
            
        Returns:
            (总数, 店铺列表)
        """
        # 检查是否为隐藏管理员（超级权限）
        from app.models.account import AccountUser
        import json
        
        current_user = db.query(AccountUser).filter(AccountUser.id == user_id).first()
        is_hidden_admin = current_user and current_user.is_hidden == 1
        
        # 构建基础查询
        if is_hidden_admin:
            # 隐藏管理员：查询所有店铺（超级权限）
            query = db.query(ShopAuth)
        elif account_type == 1:
            # 主账号：查询自己的所有店铺
            query = db.query(ShopAuth).filter(ShopAuth.user_id == user_id)
        elif account_type == 2:
            # 员工账号：根据权限决定查询范围
            # 1. 解析员工权限
            has_shop_manage = False
            if current_user and current_user.permissions:
                try:
                    permissions = json.loads(current_user.permissions)
                    has_shop_manage = 'shop_manage' in permissions
                except:
                    pass
            
            if has_shop_manage:
                # 2.1 有店铺管理权限：查询主账号的所有店铺 + 自己添加的店铺
                master_id = current_user.parent_id
                if master_id:
                    query = db.query(ShopAuth).filter(
                        or_(
                            ShopAuth.user_id == master_id,  # 主账号的店铺
                            ShopAuth.user_id == user_id      # 自己添加的店铺
                        )
                    )
                else:
                    # 没有主账号，只查询自己的店铺
                    query = db.query(ShopAuth).filter(ShopAuth.user_id == user_id)
            else:
                # 2.2 没有店铺管理权限：只查询自己添加的店铺
                query = db.query(ShopAuth).filter(ShopAuth.user_id == user_id)
        else:
            # 其他账号类型：没有任何店铺
            return 0, []
        
        # 关键词搜索
        if keyword:
            query = query.filter(
                or_(
                    ShopAuth.shop_name.like(f"%{keyword}%"),
                    ShopAuth.douyin_shop_id.like(f"%{keyword}%")
                )
            )
        
        # 状态筛选
        if status is not None:
            query = query.filter(ShopAuth.status == status)
        
        # 只查询未删除的记录
        query = query.filter(ShopAuth.status != 0)
        
        # 获取总数
        total = query.count()
        
        # 分页查询
        shops = query.order_by(ShopAuth.create_time.desc()).offset((page_no - 1) * page_size).limit(page_size).all()
        
        return total, shops
    
    @staticmethod
    def get_shop_by_id(db: Session, shop_id: int) -> Optional[ShopAuth]:
        """根据ID获取店铺"""
        return db.query(ShopAuth).filter(
            ShopAuth.id == shop_id,
            ShopAuth.status != 0
        ).first()
    
    @staticmethod
    def update_shop_status(db: Session, shop_id: int, status: int) -> bool:
        """更新店铺状态"""
        shop = db.query(ShopAuth).filter(ShopAuth.id == shop_id).first()
        if not shop:
            raise ValueError("店铺不存在")
        
        shop.status = status
        shop.update_time = datetime.now()
        db.commit()
        return True
    
    @staticmethod
    def check_user_shop_permission(
        db: Session,
        user_id: int,
        shop_id: int,
        account_type: int
    ) -> bool:
        """
        检查用户是否有店铺权限
        
        Args:
            db: 数据库会话
            user_id: 用户ID
            shop_id: 店铺ID
            account_type: 账号类型
            
        Returns:
            是否有权限
        """
        # 检查是否为隐藏管理员（超级权限）
        from app.models.account import AccountUser
        import json
        
        current_user = db.query(AccountUser).filter(AccountUser.id == user_id).first()
        if current_user and current_user.is_hidden == 1:
            # 隐藏管理员拥有所有店铺的权限
            return True
        
        if account_type == 1:
            # 主账号：检查店铺是否属于该用户
            shop = db.query(ShopAuth).filter(
                ShopAuth.id == shop_id,
                ShopAuth.user_id == user_id,
                ShopAuth.status != 0
            ).first()
            return shop is not None
        elif account_type == 2:
            # 员工账号：根据权限决定
            # 1. 解析员工权限
            has_shop_manage = False
            if current_user and current_user.permissions:
                try:
                    permissions = json.loads(current_user.permissions)
                    has_shop_manage = 'shop_manage' in permissions
                except:
                    pass
            
            if has_shop_manage:
                # 2.1 有店铺管理权限：检查店铺是否属于主账号或自己
                master_id = current_user.parent_id
                if master_id:
                    shop = db.query(ShopAuth).filter(
                        ShopAuth.id == shop_id,
                        or_(
                            ShopAuth.user_id == master_id,  # 主账号的店铺
                            ShopAuth.user_id == user_id      # 自己添加的店铺
                        ),
                        ShopAuth.status != 0
                    ).first()
                    return shop is not None
                else:
                    # 没有主账号，只检查自己的店铺
                    shop = db.query(ShopAuth).filter(
                        ShopAuth.id == shop_id,
                        ShopAuth.user_id == user_id,
                        ShopAuth.status != 0
                    ).first()
                    return shop is not None
            else:
                # 2.2 没有店铺管理权限：只检查自己添加的店铺
                shop = db.query(ShopAuth).filter(
                    ShopAuth.id == shop_id,
                    ShopAuth.user_id == user_id,
                    ShopAuth.status != 0
                ).first()
                return shop is not None
        else:
            # 其他账号类型：没有任何权限
            return False
