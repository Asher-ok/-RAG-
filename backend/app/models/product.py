from sqlalchemy import Column, BigInteger, String, Integer, SmallInteger, Text, DateTime, Numeric, Index
from app.models.base import BaseModel

class ProductInfo(BaseModel):
    """商品信息表"""
    __tablename__ = "tb_product_info"
    
    # 基础信息
    shop_id = Column(BigInteger, nullable=False, index=True, comment="关联店铺ID")
    douyin_product_id = Column(String(64), nullable=False, unique=True, comment="抖音商品ID")
    title = Column(String(256), nullable=False, comment="商品名称")
    
    # 类目信息
    first_cid = Column(String(32), nullable=False, comment="一级类目ID")
    second_cid = Column(String(32), nullable=False, comment="二级类目ID")
    third_cid = Column(String(32), nullable=False, comment="三级类目ID")
    fourth_cid = Column(String(32), nullable=True, comment="四级类目ID")
    first_cname = Column(String(64), nullable=True, comment="一级类目名称")
    second_cname = Column(String(64), nullable=True, comment="二级类目名称")
    third_cname = Column(String(64), nullable=True, comment="三级类目名称")
    fourth_cname = Column(String(64), nullable=True, comment="四级类目名称")
    
    # 商品类型和分组
    product_type = Column(SmallInteger, nullable=True, comment="商品类型：1普通商品/2虚拟商品")
    product_group = Column(String(64), nullable=True, comment="商品分组")
    
    # 商家编码
    merchant_code = Column(String(128), nullable=True, comment="商家编码")
    item_number = Column(String(128), nullable=True, comment="货号")
    
    # 价格和库存
    price = Column(Integer, nullable=False, comment="商品价格，单位分")
    stock = Column(Integer, nullable=False, default=0, comment="总库存")
    available_stock = Column(Integer, nullable=True, default=0, comment="现货可售")
    presale_stock = Column(Integer, nullable=True, default=0, comment="预售库存")
    ladder_stock = Column(Text, nullable=True, comment="阶梯库存，json数组")
    
    # SKU信息
    sku_list = Column(Text, nullable=False, comment="SKU列表，json数组")
    
    # 图片
    images = Column(Text, nullable=False, comment="图片url，json数组")
    
    # 发货和销售
    delivery_time = Column(String(64), nullable=True, comment="商品发货时间")
    sales_count = Column(Integer, nullable=True, default=0, comment="销量")
    
    # 佣金和审核
    commission_rate = Column(Numeric(5, 2), nullable=True, comment="佣金比例，百分比")
    audit_status = Column(SmallInteger, nullable=True, default=0, comment="商品审核状态：0待审核/1审核通过/2审核拒绝")
    
    # 链接
    product_url = Column(String(512), nullable=True, comment="商品链接")
    
    # 商品状态
    product_status = Column(SmallInteger, nullable=False, default=0, comment="0草稿/1上架/2下架")
    
    # 来源信息
    source_type = Column(SmallInteger, nullable=False, default=0, comment="0手动创建/1批量上架/2裂变生成")
    source_id = Column(BigInteger, nullable=True, index=True, comment="来源ID，裂变时记录原商品ID")
    source_url = Column(String(512), nullable=True, comment="原始来源链接")
    
    # 标签和配置
    keyword_tags = Column(Text, nullable=True, comment="关键词标签，json数组")
    extra_config = Column(Text, nullable=True, comment="其他配置，json（地区/模板等）")
    
    __table_args__ = (
        Index('idx_shop_id', 'shop_id'),
        Index('idx_source_id', 'source_id'),
        Index('idx_create_time', 'create_time'),
    )


class ProductTask(BaseModel):
    """商品任务表"""
    __tablename__ = "tb_product_task"
    
    task_id = Column(String(64), nullable=False, unique=True, comment="任务ID")
    shop_id = Column(BigInteger, nullable=False, index=True, comment="关联店铺ID")
    task_type = Column(SmallInteger, nullable=False, comment="1批量上架/2裂变")
    total_count = Column(Integer, nullable=False, default=0, comment="总数量")
    success_count = Column(Integer, nullable=False, default=0, comment="成功数量")
    failed_count = Column(Integer, nullable=False, default=0, comment="失败数量")
    current_index = Column(Integer, nullable=False, default=0, comment="当前处理到第几个")
    current_product_title = Column(String(256), nullable=True, comment="当前正在处理的商品标题")
    task_status = Column(SmallInteger, nullable=False, default=0, comment="0待处理/1进行中/2已完成/3失败/4已取消")
    progress_percent = Column(Integer, nullable=False, default=0, comment="进度百分比0-100")
    error_message = Column(Text, nullable=True, comment="错误信息")
    failed_detail = Column(Text, nullable=True, comment="失败详情，json")
    start_time = Column(DateTime, nullable=True, comment="任务开始时间")
    end_time = Column(DateTime, nullable=True, comment="任务结束时间")
    
    __table_args__ = (
        Index('idx_shop_id', 'shop_id'),
        Index('idx_task_status', 'task_status'),
        Index('idx_create_time', 'create_time'),
    )


class FissionRecord(BaseModel):
    """裂变记录表"""
    __tablename__ = "tb_fission_record"
    
    task_id = Column(String(64), nullable=False, index=True, comment="关联任务ID")
    shop_id = Column(BigInteger, nullable=False, index=True, comment="关联店铺ID")
    source_product_id = Column(String(64), nullable=False, comment="原商品ID")
    source_product_title = Column(String(256), nullable=True, comment="原商品标题")
    fission_count = Column(Integer, nullable=False, comment="裂变数量")
    price_range = Column(Numeric(5, 2), nullable=False, comment="价格浮动比例")
    title_suffix = Column(String(128), nullable=True, comment="标题后缀规则")
    title_replacements = Column(Text, nullable=True, comment="标题替换列表，json数组（循环使用）")
    title_template = Column(Text, nullable=True, comment="标题模板规则，json")
    image_mode = Column(SmallInteger, nullable=False, default=1, comment="1复用原图/2本地上传/3随机选择")
    image_order_config = Column(Text, nullable=True, comment="主图顺序配置，json")
    sku_order_mode = Column(SmallInteger, nullable=False, default=1, comment="SKU顺序模式，1顺序/2随机")
    sku_shuffle_storage = Column(SmallInteger, nullable=False, default=0, comment="规格SKU随机打乱存储，0否/1是")
    publish_mode = Column(SmallInteger, nullable=False, default=1, comment="发布模式，1草稿/2上架/3下架")
    filter_rules = Column(Text, nullable=True, comment="过滤规则，json（价格/地区/销量等）")
    keyword_config = Column(Text, nullable=True, comment="关键词配置，json")
    source_data = Column(Text, nullable=True, comment="来源数据，json（批量导入的商品ID列表）")
    generated_ids = Column(Text, nullable=True, comment="生成的商品ID列表，json")
    generated_details = Column(Text, nullable=True, comment="生成的商品详细信息，json")
    
    __table_args__ = (
        Index('idx_task_id', 'task_id'),
        Index('idx_shop_id', 'shop_id'),
        Index('idx_create_time', 'create_time'),
    )
