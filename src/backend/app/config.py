import os
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "CryoTrace"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database - defaults to SQLite for local dev
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./cryotrace.db"
    )

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    # JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "cryotrace-super-secret-key-change-in-production-2024")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
        "http://localhost",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # File uploads
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_FILE_SIZE: int = 50 * 1024 * 1024

    # Blockchain
    BLOCKCHAIN_ENABLED: bool = True
    BLOCKCHAIN_NETWORK: str = "hyperledger_fabric"
    HYPERLEDGER_RPC_URL: str = os.getenv("HYPERLEDGER_RPC_URL", "grpc://localhost:7051")
    WALLET_PRIVATE_KEY: str = os.getenv("WALLET_PRIVATE_KEY", "")

    # AI
    AI_MODEL_PATH: str = "./ai/models"

    # Sensor simulation
    SENSOR_SIMULATION_ENABLED: bool = True
    SENSOR_INTERVAL_SECONDS: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
