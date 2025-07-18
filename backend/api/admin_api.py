from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import get_db, User, Exam, StudentExam, QAHistory
import os
import datetime

router = APIRouter()

PPT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ppt_agent', 'uploads')

def get_file_info(filepath):
    stat = os.stat(filepath)
    return {
        'filename': os.path.basename(filepath),
        'size': stat.st_size,
        'created_at': datetime.datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M'),
        'modified_at': datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
    }

@router.get("/ppt-files")
def list_ppt_files():
    files = []
    if os.path.exists(PPT_UPLOAD_DIR):
        for fname in os.listdir(PPT_UPLOAD_DIR):
            fpath = os.path.join(PPT_UPLOAD_DIR, fname)
            if os.path.isfile(fpath) and fname.lower().endswith('.pptx'):
                files.append(get_file_info(fpath))
    return {"files": files}

@router.get("/ppt-files/download/{filename}")
def download_ppt_file(filename: str):
    fpath = os.path.join(PPT_UPLOAD_DIR, filename)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="文件不存在")
    from fastapi.responses import FileResponse
    return FileResponse(fpath, filename=filename, media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation')

@router.get("/activity")
def get_activity(db: Session = Depends(get_db)):
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