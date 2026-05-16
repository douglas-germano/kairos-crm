import eventlet
eventlet.monkey_patch()

from app import create_app
from app.extensions import socketio

app = create_app()
