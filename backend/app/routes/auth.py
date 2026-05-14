from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
)
from app.extensions import db
from app.models import User, Workspace, WorkspaceMember

bp = Blueprint("auth", __name__)


@bp.post("/register")
def register():
    data = request.get_json() or {}
    required = ("email", "password", "name")
    if not all(k in data for k in required):
        return jsonify({"error": "Campos obrigatórios: email, password, name", "code": "MISSING_FIELDS"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "E-mail já cadastrado", "code": "EMAIL_EXISTS"}), 409

    user = User(email=data["email"], name=data["name"])
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()

    # Cria workspace padrão para o novo usuário
    workspace = Workspace(name=f"Workspace de {data['name']}", owner_id=user.id)
    db.session.add(workspace)
    db.session.flush()

    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role="owner")
    db.session.add(member)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
        "workspace": workspace.to_dict(),
    }), 201


@bp.post("/login")
def login():
    data = request.get_json() or {}
    if not data.get("email") or not data.get("password"):
        return jsonify({"error": "email e password são obrigatórios", "code": "MISSING_FIELDS"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Credenciais inválidas", "code": "INVALID_CREDENTIALS"}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user.to_dict(),
    })


@bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": access_token})


@bp.get("/me")
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "Usuário não encontrado", "code": "NOT_FOUND"}), 404

    workspaces = (
        db.session.query(Workspace)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .filter(WorkspaceMember.user_id == user_id)
        .all()
    )
    return jsonify({"user": user.to_dict(), "workspaces": [w.to_dict() for w in workspaces]})
