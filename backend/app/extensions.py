import redis
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from rq import Queue

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
socketio = SocketIO(async_mode="gevent")
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# Inicializados em create_app após config ser carregada
redis_client: redis.Redis = None
rq_queue: Queue = None


def init_redis(app):
    global redis_client, rq_queue
    redis_client = redis.from_url(app.config["REDIS_URL"])
    rq_queue = Queue(connection=redis_client)
