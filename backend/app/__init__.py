import logging
from pythonjsonlogger import jsonlogger
from flask import Flask
from flask_cors import CORS
from .config import get_config
from .extensions import db, migrate, jwt, socketio, init_redis


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})
    cfg = get_config()
    app.config.from_object(cfg)

    _setup_logging(app)

    # Extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    init_redis(app)
    socketio.init_app(app, message_queue=app.config["REDIS_URL"])

    # Blueprints
    from .routes.auth import bp as auth_bp
    from .routes.conversations import bp as conversations_bp
    from .routes.messages import bp as messages_bp
    from .routes.agents import bp as agents_bp
    from .routes.flows import bp as flows_bp
    from .routes.settings import bp as settings_bp
    from .routes.integrations import bp as integrations_bp
    from .routes.webhooks.instagram import bp as ig_webhook_bp
    from .routes.webhooks.whatsapp import bp as wa_webhook_bp

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(conversations_bp, url_prefix="/api/conversations")
    app.register_blueprint(messages_bp, url_prefix="/api/messages")
    app.register_blueprint(agents_bp, url_prefix="/api/agents")
    app.register_blueprint(flows_bp, url_prefix="/api/flows")
    app.register_blueprint(settings_bp, url_prefix="/api/settings")
    app.register_blueprint(integrations_bp, url_prefix="/api/integrations")
    app.register_blueprint(ig_webhook_bp, url_prefix="/webhooks")
    app.register_blueprint(wa_webhook_bp, url_prefix="/webhooks")

    # SocketIO event handlers (rooms por workspace)
    from . import sockets  # noqa: F401

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


def _setup_logging(app):
    level = getattr(logging, app.config.get("LOG_LEVEL", "INFO"))
    handler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logging.root.setLevel(level)
    logging.root.handlers = [handler]
