from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from models import get_db, User
import hashlib
import uuid

security = HTTPBearer()

# 密码哈希

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# 生成简单token

def create_session_token():
    return str(uuid.uuid4())

# 登录时生成token并存储

def login_user(db: Session, user: User):
    token = create_session_token()
    user.session_token = token
    db.commit()
    return token

# 认证：查数据库比对token

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    user = db.query(User).filter(User.session_token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="认证失败，请重新登录")
    return user

# 教师/学生权限

def get_current_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="需要教师权限")
    return current_user

def get_current_student(current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="需要学生权限")
    return current_user 