from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from models import get_db, User, Exam, StudentExam, QAHistory
import os
import datetime
from auth import get_current_user

router = APIRouter()

PPT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ppt_agent', 'uploads')


def _ensure_admin(current_user: User):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail='需要管理员权限')


def _safe_ppt_file_path(filename: str) -> str:
    safe_name = os.path.basename(filename)
    base_dir = os.path.abspath(PPT_UPLOAD_DIR)
    full_path = os.path.abspath(os.path.join(base_dir, safe_name))
    if os.path.commonpath([base_dir, full_path]) != base_dir:
        raise HTTPException(status_code=400, detail='非法文件名')
    return full_path

def get_file_info(filepath):
    stat = os.stat(filepath)
    return {
        'filename': os.path.basename(filepath),
        'size': stat.st_size,
        'created_at': datetime.datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M'),
        'modified_at': datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
    }

@router.get("/ppt-files")
def list_ppt_files(current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    files = []
    if os.path.exists(PPT_UPLOAD_DIR):
        for fname in os.listdir(PPT_UPLOAD_DIR):
            fpath = os.path.join(PPT_UPLOAD_DIR, fname)
            if os.path.isfile(fpath) and fname.lower().endswith('.pptx'):
                files.append(get_file_info(fpath))
    return {"files": files}

@router.get("/ppt-files/download/{filename}")
def download_ppt_file(filename: str, current_user: User = Depends(get_current_user)):
    _ensure_admin(current_user)
    fpath = _safe_ppt_file_path(filename)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="文件不存在")
    from fastapi.responses import FileResponse
    return FileResponse(fpath, filename=os.path.basename(filename), media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation')

@router.get("/activity")
def get_activity(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(current_user)
    # 教师活跃度
    teachers = db.query(User).filter(User.role == 'teacher').all()
    teacher_stats = []
    for t in teachers:
        ppt_count = 0
        if os.path.exists(PPT_UPLOAD_DIR):
            ppt_count = sum(1 for fname in os.listdir(PPT_UPLOAD_DIR) if fname.startswith(t.username + '_') and fname.lower().endswith('.pptx'))
        exam_count = db.query(Exam).filter(Exam.teacher_id == t.id).count()
        last_exam = db.query(Exam).filter(Exam.teacher_id == t.id).order_by(Exam.created_at.desc()).first()
        last_active = last_exam.created_at.strftime('%Y-%m-%d %H:%M') if last_exam else ''
        teacher_stats.append({
            'id': t.id,
            'username': t.username,
            'ppt_count': ppt_count,
            'exam_count': exam_count,
            'last_active': last_active
        })
    # 学生活跃度
    students = db.query(User).filter(User.role == 'student').all()
    student_stats = []
    for s in students:
        exam_count = db.query(StudentExam).filter(StudentExam.student_id == s.id).count()
        qa_count = db.query(QAHistory).filter(QAHistory.user_id == s.id).count()
        last_exam = db.query(StudentExam).filter(StudentExam.student_id == s.id).order_by(StudentExam.start_time.desc()).first()
        last_active = last_exam.start_time.strftime('%Y-%m-%d %H:%M') if last_exam else ''
        student_stats.append({
            'id': s.id,
            'username': s.username,
            'exam_count': exam_count,
            'qa_count': qa_count,
            'last_active': last_active
        })
    return {"teachers": teacher_stats, "students": student_stats} 

@router.get("/users")
def list_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(current_user)
    users = db.query(User).all()
    return [{
        'id': u.id,
        'username': u.username,
        'role': u.role,
        'created_at': u.created_at.strftime('%Y-%m-%d %H:%M'),
        'is_active': getattr(u, 'is_active', True)
    } for u in users]

@router.post("/users/reset-password")
def reset_password(user_id: int = Body(...), new_password: str = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    from auth import hash_password
    user.password = hash_password(new_password)
    db.commit()
    return {'msg': '密码重置成功'}

@router.post("/users/disable")
def disable_user(user_id: int = Body(...), disable: bool = Body(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    # 若User模型无is_active字段，可动态添加
    if not hasattr(user, 'is_active'):
        from sqlalchemy import Boolean
        if not hasattr(User, 'is_active'):
            User.is_active = True
    user.is_active = not disable
    db.commit()
    return {'msg': '操作成功'}

@router.delete("/users/delete/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='用户不存在')
    db.delete(user)
    db.commit()
    return {'msg': '用户已删除'} 