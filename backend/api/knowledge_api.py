from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse
from models import get_db, User, QAHistory, TeachingPlanHistory, ExamHistory, KnowledgeFilePermission
from rag.ingest import ingest_file
from rag.qa import qa_query
from rag.teaching_design import generate_teaching_outline, generate_detailed_content_for_outline, generate_lesson_schedule
from rag.knowledge_manager import get_knowledge_files, delete_knowledge_file
from sqlalchemy.orm import Session
import os, shutil, re
from datetime import datetime
from auth import get_current_user

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def sanitize_filename(filename):
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    if len(filename) > 100:
        name, ext = os.path.splitext(filename)
        filename = name[:100-len(ext)] + ext
    return filename

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以上传文件")
    results = []
    db = next(get_db())
    for file in files:
        try:
            safe_filename = sanitize_filename(file.filename)
            file_path = os.path.join(UPLOAD_DIR, safe_filename)
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件保存失败: {file_path}")
            ingest_file(file_path)
            # 新增：插入权限表
            perm = db.query(KnowledgeFilePermission).filter_by(filename=safe_filename).first()
            if not perm:
                db.add(KnowledgeFilePermission(filename=safe_filename, student_can_download=False))
                db.commit()
            results.append({"filename": file.filename, "status": "success", "msg": "文件上传并入库成功"})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "msg": f"上传失败: {str(e)}"})
    success_count = len([r for r in results if r["status"] == "success"])
    error_count = len([r for r in results if r["status"] == "error"])
    if error_count == 0:
        return {"msg": f"所有文件上传成功 ({success_count} 个文件)", "results": results}
    elif success_count == 0:
        return JSONResponse(status_code=500, content={"error": f"所有文件上传失败", "results": results})
    else:
        return {"msg": f"部分文件上传成功 ({success_count} 成功, {error_count} 失败)", "results": results}

@router.get("/knowledge-files")
async def get_knowledge_files_api(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        files = get_knowledge_files()
        # 合并权限
        perms = {p.filename: p.student_can_download for p in db.query(KnowledgeFilePermission).all()}
        for f in files:
            f['student_can_download'] = perms.get(f['filename'], False)
        return {"files": files}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"获取文件列表失败: {str(e)}"})

@router.delete("/delete-file/{filename}")
async def delete_knowledge_file_api(filename: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以删除文件")
    try:
        delete_knowledge_file(filename)
        return {"msg": f"文件 {filename} 已删除"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"删除文件失败: {str(e)}"})

@router.post("/qa")
async def qa(question: str = Form(...)):
    try:
        result = qa_query(question)
        return result  # 包含answer和sources
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"问答失败: {str(e)}"})

@router.post("/qa-history")
async def save_qa_history(question: str = Form(...), answer: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = QAHistory(user_id=current_user.id, question=question, answer=answer)
    db.add(record)
    db.commit()
    return {"msg": "ok"}

@router.get("/qa-history")
async def get_qa_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(QAHistory).filter(QAHistory.user_id == current_user.id).order_by(QAHistory.time.desc()).all()
    return [{"id": r.id, "question": r.question, "answer": r.answer, "time": r.time.strftime('%Y-%m-%d %H:%M:%S')} for r in records]

@router.delete("/qa-history/{history_id}")
async def delete_qa_history(history_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(QAHistory).filter(QAHistory.id == history_id, QAHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    db.delete(record)
    db.commit()
    return {"msg": "删除成功"}

@router.post("/design-teaching-plan")
async def design_teaching_plan(course_outline: str = Form(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以设计教学内容")
    try:
        outline = generate_teaching_outline(course_outline)
        lesson_schedule = generate_lesson_schedule(outline)
        return {"plan": outline, "lesson_schedule": lesson_schedule}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"教学内容设计失败: {str(e)}"})

# 新增接口：生成详细内容
@router.post("/generate-teaching-detail")
async def generate_teaching_detail(outline: str = Form(...), current_user: User = Depends(get_current_user)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以生成详细内容")
    try:
        detail = generate_detailed_content_for_outline(outline)
        return {"detail": detail}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"详细内容生成失败: {str(e)}"})

@router.post("/teaching-plan-history")
async def save_teaching_plan_history(outline: str = Form(...), plan: str = Form(...), lesson_schedule: str = Form(""), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = TeachingPlanHistory(user_id=current_user.id, outline=outline, plan=plan, lesson_schedule=lesson_schedule)
    db.add(record)
    db.commit()
    return {"msg": "ok"}

@router.get("/teaching-plan-history")
async def get_teaching_plan_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    records = db.query(TeachingPlanHistory).filter(TeachingPlanHistory.user_id == current_user.id).order_by(TeachingPlanHistory.time.desc()).all()
    return [{
        "id": r.id,
        "outline": r.outline,
        "plan": r.plan,
        "lesson_schedule": r.lesson_schedule,
        "time": r.time.strftime('%Y-%m-%d %H:%M:%S')
    } for r in records]

@router.delete("/teaching-plan-history/{history_id}")
async def delete_teaching_plan_history(history_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(TeachingPlanHistory).filter(TeachingPlanHistory.id == history_id, TeachingPlanHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    db.delete(record)
    db.commit()
    return {"msg": "删除成功"}

@router.delete("/exam-history/{history_id}")
async def delete_exam_history(history_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(ExamHistory).filter(ExamHistory.id == history_id, ExamHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    db.delete(record)
    db.commit()
    return {"msg": "删除成功"}

@router.post("/set-student-download")
async def set_student_download(filename: str = Form(...), can_download: bool = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "teacher":
        raise HTTPException(status_code=403, detail="只有教师可以设置")
    perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
    if not perm:
        perm = KnowledgeFilePermission(filename=filename, student_can_download=can_download)
        db.add(perm)
    else:
        perm.student_can_download = can_download
    db.commit()
    return {"msg": "设置成功"}

@router.get("/download/{filename}")
async def download_file(filename: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
    if not perm:
        raise HTTPException(status_code=404, detail="文件不存在")
    if current_user.role == "student" and not perm.student_can_download:
        raise HTTPException(status_code=403, detail="该文件不允许学生下载")
    file_path = os.path.join("uploads", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(file_path, filename=filename) 