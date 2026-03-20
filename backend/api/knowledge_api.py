from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse
from models import get_db, User, QAHistory, TeachingPlanHistory, ExamHistory
from rag.qa import qa_query
from rag.teaching_design import generate_teaching_outline, generate_detailed_content_for_outline, generate_lesson_schedule
from rag.knowledge_manager import delete_knowledge_file, upload_knowledge_files, get_knowledge_files, set_student_download_permission, get_download_file_path, UPLOAD_DIR
from sqlalchemy.orm import Session
import os
from auth import get_current_user

router = APIRouter()

os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    db = next(get_db())
    upload_result = upload_knowledge_files(files=files, current_user=current_user, db=db)
    results = upload_result["results"]
    success_count = upload_result["success_count"]
    error_count = upload_result["error_count"]

    if error_count == 0:
        return {"msg": f"所有文件上传成功 ({success_count} 个文件)", "results": results}
    elif success_count == 0:
        return JSONResponse(status_code=500, content={"error": f"所有文件上传失败", "results": results})
    else:
        return {"msg": f"部分文件上传成功 ({success_count} 成功, {error_count} 失败)", "results": results}

@router.get("/knowledge-files")
async def get_knowledge_files_api(current_user: User = Depends(get_current_user)):
    try:
        db = next(get_db())
        files_list = get_knowledge_files(db)
        return {"files": files_list}
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"获取文件列表失败: {str(e)}"})

@router.delete("/delete-file/{filename}")
async def delete_knowledge_file_api(filename: str, current_user: User = Depends(get_current_user)):
    try:
        db = next(get_db())
        delete_knowledge_file(filename, db=db)
            
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
async def save_qa_history(question: str = Form(...), answer: str = Form(...), sources: str = Form(default="[]"), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = QAHistory(user_id=current_user.id, question=question, answer=answer, sources=sources)
    db.add(record)
    db.commit()
    return {"msg": "ok"}

@router.get("/qa-history")
async def get_qa_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    records = db.query(QAHistory).filter(QAHistory.user_id == current_user.id).order_by(QAHistory.time.desc()).all()
    return [{"id": r.id, "question": r.question, "answer": r.answer, "sources": json.loads(str(r.sources)) if str(r.sources) else [], "time": r.time.strftime('%Y-%m-%d %H:%M:%S')} for r in records]

@router.get("/qa-history/{history_id}/sources")
async def get_qa_history_sources(history_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    import json
    record = db.query(QAHistory).filter(QAHistory.id == history_id, QAHistory.user_id == current_user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="历史记录不存在")
    # 直接返回保存的sources，不再重新检索
    sources = json.loads(str(record.sources)) if str(record.sources) else []
    return {"sources": sources}

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
    try:
        outline = generate_teaching_outline(course_outline)
        lesson_schedule = generate_lesson_schedule(outline)
        return {"plan": outline, "lesson_schedule": lesson_schedule}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"教学内容设计失败: {str(e)}"})

# 新增接口：生成详细内容
@router.post("/generate-teaching-detail")
async def generate_teaching_detail(outline: str = Form(...), current_user: User = Depends(get_current_user)):
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
    set_student_download_permission(filename=filename, can_download=can_download, db=db)
    return {"msg": "设置成功"}

@router.get("/download/{filename}")
async def download_file(filename: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)
        return FileResponse(file_path, filename=filename)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))