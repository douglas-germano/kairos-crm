import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ["SECRET_KEY"]
    JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
    JWT_ACCESS_TOKEN_EXPIRES = 3600        # 1 hora
    JWT_REFRESH_TOKEN_EXPIRES = 2592000    # 30 dias

    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URL"]
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    META_APP_ID = os.getenv("META_APP_ID", "")
    META_APP_SECRET = os.getenv("META_APP_SECRET", "")
    META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "")
    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5000")

    EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "")
    EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")

    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
}

def get_config():
    env = os.getenv("FLASK_ENV", "development")
    return config_map.get(env, DevelopmentConfig)
