from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "抖音商家管理系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"
    
    # 数据库配置
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "root"
    DB_NAME: str = "douyin_shop_system"
    
    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    
    # JWT配置
    SECRET_KEY: str = "your-secret-key-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # 抖音开放平台配置
    DOUYIN_APP_KEY: str = ""
    DOUYIN_APP_SECRET: str = ""
    DOUYIN_API_BASE_URL: str = "https://openapi-fxg.jinritemai.com"  # 官方正式环境地址
    DOUYIN_REDIRECT_URI: str = ""
    
    # API限流配置
    API_RATE_LIMIT_PER_SHOP: int = 50
    
    # Playwright自动化配置
    USE_PLAYWRIGHT: bool = False  # true=自动化模式, false=API模式
    PLAYWRIGHT_HEADLESS: bool = True  # 是否无头模式
    PLAYWRIGHT_TIMEOUT: int = 30000  # 超时时间(毫秒)
    PLAYWRIGHT_STATES_DIR: str = "states"  # Cookie存储目录
    
    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
    
    class Config:
        # 使用绝对路径确保无论从哪里启动都能找到.env文件
        import os
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        case_sensitive = True

settings = Settings()
