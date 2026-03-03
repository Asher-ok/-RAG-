from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_master_user, check_permission
from app.services.account_service import AccountService
from app.schemas.account import (
    AddEmployeeRequest,
    AddEmployeeResponse,
    EmployeeListRequest,
    EmployeeListResponse,
    EmployeeInfo,
    UpdateEmployeeRequest,
    RequestShopAuthRequest,
    RequestShopAuthResponse,
    ApproveShopAuthRequest,
    ShopAuthRequestListRequest,
    ShopAuthRequestListResponse,
    ShopAuthRequestInfo,
    PermissionEnum
)
from app.schemas.response import ResponseModel
from app.models.account import AccountUser
import json
import math

router = APIRouter()


@router.post("/add_employee", response_model=ResponseModel[AddEmployeeResponse])
async def add_employee(
    request: AddEmployeeRequest,
    current_user: AccountUser = Depends(check_permission(PermissionEnum.ACCOUNT_MANAGE)),
    db: Session = Depends(get_db)
):
    """添加员工账号（需要账号管理权限）"""
    try:
        # 获取主账号ID（如果是员工账号，使用其parent_id）
        master_id = current_user.id if current_user.account_type == 1 else current_user.parent_id
        employee = AccountService.add_employee(db, master_id, request)
        
        return ResponseModel.success(
            data=AddEmployeeResponse(
                employee_id=employee.id,
                username=employee.username
            )
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"添加员工账号失败: {str(e)}", code=500)


@router.get("/employee_list", response_model=ResponseModel[EmployeeListResponse])
async def get_employee_list(
    page_no: int = 1,
    page_size: int = 20,
    account_status: int = None,
    current_user: AccountUser = Depends(check_permission(PermissionEnum.ACCOUNT_MANAGE)),
    db: Session = Depends(get_db)
):
    """员工账号列表（需要账号管理权限）"""
    try:
        # 获取主账号ID（如果是员工账号，使用其parent_id）
        master_id = current_user.id if current_user.account_type == 1 else current_user.parent_id
        
        total, employees = AccountService.get_employee_list(
            db, 
            master_id, 
            page_no, 
            page_size, 
            account_status
        )
        
        # 组装响应数据
        employee_list = []
        for emp in employees:
            permissions = json.loads(emp.permissions) if emp.permissions else []
            employee_list.append(EmployeeInfo(
                employee_id=emp.id,
                username=emp.username,
                real_name=emp.real_name,
                expire_time=emp.expire_time,
                permissions=permissions,
                account_status=emp.account_status,
                create_time=emp.create_time
            ))
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return ResponseModel.success(
            data=EmployeeListResponse(
                total=total,
                total_pages=total_pages,
                list=employee_list
            )
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"获取员工列表失败: {str(e)}", code=500)


@router.patch("/employee/{employee_id}", response_model=ResponseModel)
async def update_employee(
    employee_id: int,
    request: UpdateEmployeeRequest,
    current_user: AccountUser = Depends(check_permission(PermissionEnum.ACCOUNT_MANAGE)),
    db: Session = Depends(get_db)
):
    """修改员工账号（需要账号管理权限）"""
    try:
        # 获取主账号ID（如果是员工账号，使用其parent_id）
        master_id = current_user.id if current_user.account_type == 1 else current_user.parent_id
        AccountService.update_employee(db, master_id, employee_id, request)
        return ResponseModel.success(msg="修改成功")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"修改员工账号失败: {str(e)}", code=500)


@router.delete("/employee/{employee_id}", response_model=ResponseModel)
async def delete_employee(
    employee_id: int,
    current_user: AccountUser = Depends(check_permission(PermissionEnum.ACCOUNT_MANAGE)),
    db: Session = Depends(get_db)
):
    """删除员工账号（需要账号管理权限）"""
    try:
        # 获取主账号ID（如果是员工账号，使用其parent_id）
        master_id = current_user.id if current_user.account_type == 1 else current_user.parent_id
        AccountService.delete_employee(db, master_id, employee_id)
        return ResponseModel.success(msg="删除成功")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"删除员工账号失败: {str(e)}", code=500)


@router.post("/request_shop_auth", response_model=ResponseModel[RequestShopAuthResponse])
async def request_shop_auth(
    request: RequestShopAuthRequest,
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """员工申请店铺授权"""
    try:
        request_id = AccountService.request_shop_auth(db, current_user.id, request)
        
        return ResponseModel.success(
            data=RequestShopAuthResponse(request_id=request_id)
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"申请店铺授权失败: {str(e)}", code=500)


@router.post("/approve_shop_auth", response_model=ResponseModel)
async def approve_shop_auth(
    request: ApproveShopAuthRequest,
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """主账号审核店铺授权"""
    try:
        AccountService.approve_shop_auth(db, current_user.id, request)
        return ResponseModel.success(msg="审核成功")
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"审核店铺授权失败: {str(e)}", code=500)


@router.get("/shop_auth_requests", response_model=ResponseModel[ShopAuthRequestListResponse])
async def get_shop_auth_requests(
    page_no: int = 1,
    page_size: int = 20,
    approve_status: int = None,
    current_user: AccountUser = Depends(get_current_master_user),
    db: Session = Depends(get_db)
):
    """店铺授权申请列表"""
    try:
        total, request_list = AccountService.get_shop_auth_requests(
            db, 
            current_user.id, 
            page_no, 
            page_size, 
            approve_status
        )
        
        # 组装响应数据
        auth_requests = []
        for req in request_list:
            auth_requests.append(ShopAuthRequestInfo(
                request_id=req["request_id"],
                employee_id=req["employee_id"],
                username=req["username"],
                shop_id=req["shop_id"],
                shop_name=req["shop_name"],
                reason=req["reason"],
                approve_status=req["approve_status"],
                create_time=req["create_time"]
            ))
        
        total_pages = math.ceil(total / page_size) if total > 0 else 0
        
        return ResponseModel.success(
            data=ShopAuthRequestListResponse(
                total=total,
                total_pages=total_pages,
                list=auth_requests
            )
        )
    except ValueError as e:
        return ResponseModel.error(msg=str(e), code=400)
    except Exception as e:
        return ResponseModel.error(msg=f"获取授权申请列表失败: {str(e)}", code=500)
