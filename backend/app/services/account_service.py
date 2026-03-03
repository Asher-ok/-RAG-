import json
import uuid
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models.account import AccountUser, ShopAuthRequest, EmployeeShopRelation
from app.models.shop import ShopAuth
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.account import (
    PermissionEnum,
    UserRegisterRequest,
    UserLoginRequest,
    AddEmployeeRequest,
    UpdateEmployeeRequest,
    RequestShopAuthRequest,
    ApproveShopAuthRequest
)


class AccountService:
    """账号管理服务"""
    
    @staticmethod
    def register_user(db: Session, request: UserRegisterRequest) -> Tuple[AccountUser, str]:
        """用户注册（普通账号）"""
        # 检查用户名是否已存在
        existing_user = db.query(AccountUser).filter(
            AccountUser.username == request.username,
            AccountUser.status == 1
        ).first()
        if existing_user:
            raise ValueError("用户名已存在")
        
        # 创建普通账号（account_type=3，无特殊权限）
        user = AccountUser(
            username=request.username,
            password=get_password_hash(request.password),
            real_name=request.real_name,
            account_type=3,  # 普通账号（非主账号，非员工账号）
            account_status=1,
            status=1
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # 生成token
        token = create_access_token(data={"user_id": user.id, "account_type": user.account_type})
        
        return user, token
    
    @staticmethod
    def login(db: Session, request: UserLoginRequest, ip_address: str) -> Tuple[AccountUser, str]:
        """用户登录"""
        # 查找用户
        user = db.query(AccountUser).filter(
            AccountUser.username == request.username,
            AccountUser.status == 1
        ).first()
        
        if not user:
            raise ValueError("用户名或密码错误")
        
        # 验证密码
        if not verify_password(request.password, user.password):
            raise ValueError("用户名或密码错误")
        
        # 检查账号状态
        if user.account_status == 0:
            raise ValueError("账号已被禁用")
        
        # 员工账号检查过期时间
        if user.account_type == 2:
            if user.expire_time and user.expire_time < datetime.now():
                user.account_status = 2
                db.commit()
                raise ValueError("账号已过期")
        
        # 更新登录信息
        user.last_login_time = datetime.now()
        user.last_login_ip = ip_address
        db.commit()
        
        # 生成token
        token = create_access_token(data={"user_id": user.id, "account_type": user.account_type})
        
        return user, token
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[AccountUser]:
        """根据ID获取用户"""
        return db.query(AccountUser).filter(
            AccountUser.id == user_id,
            AccountUser.status == 1
        ).first()
    
    @staticmethod
    def change_password(db: Session, user_id: int, old_password: str, new_password: str):
        """修改密码"""
        user = AccountService.get_user_by_id(db, user_id)
        if not user:
            raise ValueError("用户不存在")
        
        # 验证旧密码
        if not verify_password(old_password, user.password):
            raise ValueError("旧密码错误")
        
        # 更新密码
        user.password = get_password_hash(new_password)
        db.commit()
    
    @staticmethod
    def add_employee(db: Session, master_id: int, request: AddEmployeeRequest) -> AccountUser:
        """添加员工账号"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 检查用户名是否已存在
        existing_user = db.query(AccountUser).filter(
            AccountUser.username == request.username,
            AccountUser.status == 1
        ).first()
        if existing_user:
            raise ValueError("用户名已存在")
        
        # 验证权限列表
        valid_permissions = PermissionEnum.all_permissions()
        for perm in request.permissions:
            if perm not in valid_permissions:
                raise ValueError(f"无效的权限: {perm}")
        
        # 创建员工账号
        employee = AccountUser(
            username=request.username,
            password=get_password_hash(request.password),
            real_name=request.real_name,
            account_type=2,  # 员工账号
            parent_id=master_id,
            expire_time=request.expire_time,
            permissions=json.dumps(request.permissions),
            account_status=1,
            status=1
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        
        return employee
    
    @staticmethod
    def get_employee_list(
        db: Session, 
        master_id: int, 
        page_no: int, 
        page_size: int, 
        account_status: Optional[int] = None
    ) -> Tuple[int, List[AccountUser]]:
        """获取员工账号列表"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 构建查询（过滤掉隐藏账号）
        query = db.query(AccountUser).filter(
            AccountUser.parent_id == master_id,
            AccountUser.account_type == 2,
            AccountUser.status == 1,
            AccountUser.is_hidden == 0  # ⭐ 过滤掉隐藏账号
        )
        
        if account_status is not None:
            query = query.filter(AccountUser.account_status == account_status)
        
        # 获取总数
        total = query.count()
        
        # 分页查询
        employees = query.order_by(AccountUser.create_time.desc()).offset(
            (page_no - 1) * page_size
        ).limit(page_size).all()
        
        return total, employees
    
    @staticmethod
    def update_employee(
        db: Session, 
        master_id: int, 
        employee_id: int, 
        request: UpdateEmployeeRequest
    ):
        """修改员工账号"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 获取员工账号
        employee = db.query(AccountUser).filter(
            AccountUser.id == employee_id,
            AccountUser.parent_id == master_id,
            AccountUser.account_type == 2,
            AccountUser.status == 1
        ).first()
        
        if not employee:
            raise ValueError("员工账号不存在")
        
        # 更新字段
        if request.real_name is not None:
            employee.real_name = request.real_name
            
        if request.expire_time is not None:
            employee.expire_time = request.expire_time
            # 根据过期时间自动更新账号状态
            if request.expire_time > datetime.now():
                # 如果新的过期时间在未来，且当前状态是已过期，则恢复为正常
                if employee.account_status == 2:
                    employee.account_status = 1
            else:
                # 如果新的过期时间已经过了，设置为已过期
                employee.account_status = 2
        
        if request.permissions is not None:
            # 验证权限列表
            valid_permissions = PermissionEnum.all_permissions()
            for perm in request.permissions:
                if perm not in valid_permissions:
                    raise ValueError(f"无效的权限: {perm}")
            employee.permissions = json.dumps(request.permissions)
        
        if request.account_status is not None:
            # 如果手动设置状态，需要检查是否与过期时间一致
            if request.account_status == 1 and employee.expire_time and employee.expire_time < datetime.now():
                raise ValueError("账号已过期，无法启用")
            employee.account_status = request.account_status
        
        db.commit()
    
    @staticmethod
    def delete_employee(db: Session, master_id: int, employee_id: int):
        """删除员工账号（逻辑删除）"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 获取员工账号
        employee = db.query(AccountUser).filter(
            AccountUser.id == employee_id,
            AccountUser.parent_id == master_id,
            AccountUser.account_type == 2,
            AccountUser.status == 1
        ).first()
        
        if not employee:
            raise ValueError("员工账号不存在")
        
        # 逻辑删除
        employee.status = 0
        db.commit()
    
    @staticmethod
    def request_shop_auth(
        db: Session, 
        employee_id: int, 
        request: RequestShopAuthRequest
    ) -> str:
        """员工申请店铺授权"""
        # 验证员工账号
        employee = AccountService.get_user_by_id(db, employee_id)
        if not employee or employee.account_type != 2:
            raise ValueError("无权限操作")
        
        # 检查账号状态
        if employee.account_status != 1:
            raise ValueError("账号状态异常")
        
        # 检查店铺是否存在
        shop = db.query(ShopAuth).filter(
            ShopAuth.id == request.shop_id,
            ShopAuth.user_id == employee.parent_id,
            ShopAuth.status == 1
        ).first()
        
        if not shop:
            raise ValueError("店铺不存在")
        
        # 检查是否已有待审核的申请
        existing_request = db.query(ShopAuthRequest).filter(
            ShopAuthRequest.employee_id == employee_id,
            ShopAuthRequest.shop_id == request.shop_id,
            ShopAuthRequest.approve_status == 0,
            ShopAuthRequest.status == 1
        ).first()
        
        if existing_request:
            raise ValueError("已有待审核的申请")
        
        # 检查是否已授权
        existing_relation = db.query(EmployeeShopRelation).filter(
            EmployeeShopRelation.employee_id == employee_id,
            EmployeeShopRelation.shop_id == request.shop_id,
            EmployeeShopRelation.status == 1
        ).first()
        
        if existing_relation:
            raise ValueError("已授权该店铺")
        
        # 创建申请
        request_id = str(uuid.uuid4())
        auth_request = ShopAuthRequest(
            request_id=request_id,
            employee_id=employee_id,
            master_id=employee.parent_id,
            shop_id=request.shop_id,
            reason=request.reason,
            approve_status=0,
            status=1
        )
        db.add(auth_request)
        db.commit()
        
        return request_id
    
    @staticmethod
    def approve_shop_auth(
        db: Session, 
        master_id: int, 
        request: ApproveShopAuthRequest
    ):
        """主账号审核店铺授权"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 获取申请
        auth_request = db.query(ShopAuthRequest).filter(
            ShopAuthRequest.request_id == request.request_id,
            ShopAuthRequest.master_id == master_id,
            ShopAuthRequest.status == 1
        ).first()
        
        if not auth_request:
            raise ValueError("申请不存在")
        
        if auth_request.approve_status != 0:
            raise ValueError("申请已处理")
        
        # 更新申请状态
        auth_request.approve_status = request.approve_status
        auth_request.approve_time = datetime.now()
        
        if request.approve_status == 2:  # 拒绝
            auth_request.reject_reason = request.reject_reason
        elif request.approve_status == 1:  # 通过
            # 创建员工店铺关系
            relation = EmployeeShopRelation(
                employee_id=auth_request.employee_id,
                shop_id=auth_request.shop_id,
                master_id=master_id,
                authorized_time=datetime.now(),
                status=1
            )
            db.add(relation)
        
        db.commit()
    
    @staticmethod
    def get_shop_auth_requests(
        db: Session, 
        master_id: int, 
        page_no: int, 
        page_size: int, 
        approve_status: Optional[int] = None
    ) -> Tuple[int, List[dict]]:
        """获取店铺授权申请列表"""
        # 验证主账号
        master = AccountService.get_user_by_id(db, master_id)
        if not master or master.account_type != 1:
            raise ValueError("无权限操作")
        
        # 构建查询
        query = db.query(
            ShopAuthRequest,
            AccountUser.username,
            ShopAuth.shop_name
        ).join(
            AccountUser, ShopAuthRequest.employee_id == AccountUser.id
        ).join(
            ShopAuth, ShopAuthRequest.shop_id == ShopAuth.id
        ).filter(
            ShopAuthRequest.master_id == master_id,
            ShopAuthRequest.status == 1
        )
        
        if approve_status is not None:
            query = query.filter(ShopAuthRequest.approve_status == approve_status)
        
        # 获取总数
        total = query.count()
        
        # 分页查询
        results = query.order_by(ShopAuthRequest.create_time.desc()).offset(
            (page_no - 1) * page_size
        ).limit(page_size).all()
        
        # 组装结果
        request_list = []
        for auth_request, username, shop_name in results:
            request_list.append({
                "request_id": auth_request.request_id,
                "employee_id": auth_request.employee_id,
                "username": username,
                "shop_id": auth_request.shop_id,
                "shop_name": shop_name,
                "reason": auth_request.reason,
                "approve_status": auth_request.approve_status,
                "create_time": auth_request.create_time
            })
        
        return total, request_list
    
    @staticmethod
    def check_employee_shop_permission(db: Session, employee_id: int, shop_id: int) -> bool:
        """检查员工是否有店铺权限"""
        relation = db.query(EmployeeShopRelation).filter(
            EmployeeShopRelation.employee_id == employee_id,
            EmployeeShopRelation.shop_id == shop_id,
            EmployeeShopRelation.status == 1
        ).first()
        
        return relation is not None
