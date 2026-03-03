from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import success_response
from app.models.shop import ShopAuth
from app.models.product import ProductInfo, FissionRecord
from app.models.account import AccountUser

router = APIRouter()


@router.get("/statistics")
async def get_dashboard_statistics(
    current_user: AccountUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取工作台统计数据
    """
    # 统计店铺总数（启用状态）
    shop_count = db.query(ShopAuth).filter(ShopAuth.status == 1).count()
    
    # 统计商品总数（启用状态）
    product_count = db.query(ProductInfo).filter(ProductInfo.status == 1).count()
    
    # 统计裂变任务总数
    fission_count = db.query(FissionRecord).filter(FissionRecord.status == 1).count()
    
    # 统计员工账号总数（员工类型且启用状态）
    employee_count = db.query(AccountUser).filter(
        AccountUser.account_type == 2,
        AccountUser.status == 1
    ).count()
    
    return success_response(data={
        "shop_count": shop_count,
        "product_count": product_count,
        "fission_count": fission_count,
        "employee_count": employee_count
    })
