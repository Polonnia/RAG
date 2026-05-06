from fastapi import APIRouter, Form, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from models import get_db, User
from auth import login_user, hash_password

router = APIRouter()

@router.post("/register")
async def register(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    role = data.get("role", "student")  # 支持 student/teacher/admin
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    if role not in ["student", "teacher", "admin"]:
        raise HTTPException(status_code=400, detail="角色无效")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(username=username, password=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"msg": "注册成功", "user": {"id": user.id, "username": user.username, "role": user.role}}

@router.post("/login")
async def login(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    hashed_password = hash_password(password)
    user = db.query(User).filter(User.username == username, User.password == hashed_password).first()
    if not user:
        user = db.query(User).filter(User.username == username, User.password == password).first()
        if user:
            user.password = hashed_password
            db.commit()
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    # 修复：生成并存储session_token
    token = login_user(db, user)
    return {"token": token, "user": {"id": user.id, "username": user.username, "role": user.role}} 