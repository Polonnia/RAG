from fastapi import APIRouter, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from models import get_db, User
from auth import create_session_token, login_user, get_current_user, hash_password

router = APIRouter()

@router.post("/register")
async def register(username: str = Form(...), password: str = Form(...), role: str = Form(...)):
    db = next(get_db())
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    hashed_password = hash_password(password)
    user = User(username=username, password=hashed_password, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    access_token = login_user(db, user)
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "username": user.username, "role": user.role}}

@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()
    if not user or user.password != hash_password(password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    access_token = login_user(db, user)
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "username": user.username, "role": user.role}} 