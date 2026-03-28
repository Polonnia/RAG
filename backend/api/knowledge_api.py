from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Form
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from models import get_db, User, QAHistory, TeachingPlanHistory, ExamHistory, SessionLocal
from rag.pageindex_search import MultiDocumentSearcher
from rag.teaching_design import (
    generate_teaching_outline,
    generate_detailed_content_for_outline,
    generate_lesson_schedule,
    generate_teaching_schedule_markdown,
    generate_teaching_schedule_markdown_stream,
)
from rag.knowledge_manager import delete_knowledge_file, upload_knowledge_files, get_knowledge_files, set_student_download_permission, get_download_file_path, UPLOAD_DIR
from rag.mind_map_generator import get_mindmap_data_async, search_in_mindmap
from sqlalchemy.orm import Session
from typing import Any
import os
import io
import uuid
import time
import asyncio
import threading
import json
import re
from auth import get_current_user

router = APIRouter()

os.makedirs(UPLOAD_DIR, exist_ok=True)
TREE_JSON_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rag', 'db', 'trees')
AUDIO_TEXT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'rag', 'db', 'audio_text')

UPLOAD_TASKS = {}
UPLOAD_TASKS_LOCK = threading.Lock()


async def _resolve_maybe_async(value: Any):
    if asyncio.iscoroutine(value) or isinstance(value, asyncio.Future):
        return await value
    return value


def _build_qa_sources_from_doc_results(doc_results):
    sources = []
    for doc_result in doc_results:
        doc_name = doc_result.get('doc_name', '未知来源')
        doc_id = doc_result.get('doc_id')
        for node in doc_result.get('results', {}).get('nodes', []):
            page_segments = node.get('page_segments') or []
            if page_segments:
                for seg in page_segments:
                    sources.append({
                        "content": seg.get('text', ''),
                        "metadata": {
                            "source": doc_name,
                            "page": seg.get('page', '?'),
                            "file_path": doc_id,
                            "start_time": node.get('start_time'),
                            "end_time": node.get('end_time')
                        }
                    })
            else:
                page_value = '?'
                page_range = str(node.get('page_range', '')).strip()
                if page_range:
                    first_page = page_range.split('-', 1)[0].strip()
                    if first_page.isdigit():
                        page_value = int(first_page)

                sources.append({
                    "content": node.get('text', ''),
                    "metadata": {
                        "source": doc_name,
                        "page": page_value,
                        "file_path": doc_id,
                        "start_time": node.get('start_time'),
                        "end_time": node.get('end_time')
                    }
                })
    return sources


def _json_line(payload: dict) -> str:
    import json
    return json.dumps(payload, ensure_ascii=False) + "\n"


def _upsert_upload_task(task_id, updater):
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(task_id)
        if not task:
            return None
        updater(task)
        return task


def _recalculate_overall_progress(task):
    file_map = task.get('file_progress_map', {})
    total_files = max(task.get('total_files', 0), 1)
    total = sum(float(file_map.get(name, 0)) for name in task.get('file_names', []))
    task['overall_progress'] = round(min(100.0, max(0.0, total / total_files)), 1)


async def _run_upload_task(task_id: str, buffered_files: list, current_user: User):
    db = SessionLocal()
    try:
        _upsert_upload_task(task_id, lambda t: t.update({'status': 'running', 'current_step': '开始处理文件'}))

        def progress_handler(event):
            filename = event.get('filename')
            step = event.get('step')
            status = event.get('status', 'processing')
            file_progress = event.get('file_progress')
            message = event.get('message')

            def _update(task):
                if step:
                    task['current_step'] = step
                if filename:
                    if file_progress is not None:
                        task['file_progress_map'][filename] = float(file_progress)
                    per_file = task['file_status_map'].setdefault(filename, {})
                    if step:
                        per_file['step'] = step
                    if status:
                        per_file['status'] = status
                    if message:
                        per_file['message'] = message
                    if file_progress is not None:
                        per_file['progress'] = float(file_progress)

                    if status == 'success':
                        task['success_count'] = int(task.get('success_count', 0)) + 1
                    elif status == 'error':
                        task['error_count'] = int(task.get('error_count', 0)) + 1

                _recalculate_overall_progress(task)

            _upsert_upload_task(task_id, _update)

        upload_result = await _resolve_maybe_async(upload_knowledge_files(
            files=buffered_files,
            current_user=current_user,
            db=db,
            progress_callback=progress_handler
        ))

        def _complete(task):
            task['status'] = 'completed'
            task['current_step'] = '上传与解析完成'
            task['results'] = upload_result.get('results', [])
            task['success_count'] = upload_result.get('success_count', 0)
            task['error_count'] = upload_result.get('error_count', 0)
            task['overall_progress'] = 100.0
            for name in task.get('file_names', []):
                task['file_progress_map'][name] = 100.0
                status_item = task['file_status_map'].setdefault(name, {})
                status_item.setdefault('progress', 100.0)
                status_item.setdefault('status', 'success')
                status_item.setdefault('step', '解析完成')

        _upsert_upload_task(task_id, _complete)

    except Exception as e:
        def _fail(task):
            task['status'] = 'failed'
            task['current_step'] = '上传任务失败'
            task['error'] = str(e)
        _upsert_upload_task(task_id, _fail)
    finally:
        db.close()

@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    try:
        db = next(get_db())
        upload_result = await _resolve_maybe_async(upload_knowledge_files(files=files, current_user=current_user, db=db))
        results = upload_result["results"]
        success_count = upload_result["success_count"]
        error_count = upload_result["error_count"]

        if error_count == 0:
            return {"msg": f"所有文件上传成功 ({success_count} 个文件)", "results": results}
        elif success_count == 0:
            return JSONResponse(status_code=500, content={"error": f"所有文件上传失败", "results": results})
        else:
            return {"msg": f"部分文件上传成功 ({success_count} 成功, {error_count} 失败)", "results": results}
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"文件上传API异常: {error_detail}")
        return JSONResponse(status_code=500, content={"error": f"上传异常: {str(e)}", "details": error_detail})


@router.post("/upload-with-progress")
async def upload_files_with_progress(files: list[UploadFile] = File(...), current_user: User = Depends(get_current_user)):
    if not files:
        raise HTTPException(status_code=400, detail="请至少上传一个文件")

    buffered_files = []
    file_names = []
    for file in files:
        content = await file.read()
        file_names.append(file.filename)
        buffered_files.append(type('BufferedUploadFile', (), {
            'filename': file.filename,
            'file': io.BytesIO(content)
        })())

    task_id = uuid.uuid4().hex
    with UPLOAD_TASKS_LOCK:
        UPLOAD_TASKS[task_id] = {
            'task_id': task_id,
            'status': 'queued',
            'current_step': '任务已创建',
            'overall_progress': 0.0,
            'total_files': len(file_names),
            'file_names': file_names,
            'file_progress_map': {name: 0.0 for name in file_names},
            'file_status_map': {
                name: {'status': 'queued', 'step': '等待处理', 'progress': 0.0}
                for name in file_names
            },
            'results': [],
            'success_count': 0,
            'error_count': 0,
            'error': None,
        }

    asyncio.create_task(_run_upload_task(task_id, buffered_files, current_user))
    return {
        'task_id': task_id,
        'status': 'queued',
        'total_files': len(file_names)
    }


@router.get("/upload-task/{task_id}")
async def get_upload_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    with UPLOAD_TASKS_LOCK:
        task = UPLOAD_TASKS.get(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="上传任务不存在")

        file_statuses = []
        for name in task.get('file_names', []):
            item = task.get('file_status_map', {}).get(name, {})
            file_statuses.append({
                'filename': name,
                'status': item.get('status', 'queued'),
                'step': item.get('step', '等待处理'),
                'progress': item.get('progress', 0.0),
                'message': item.get('message')
            })

        return {
            'task_id': task.get('task_id'),
            'status': task.get('status'),
            'current_step': task.get('current_step'),
            'overall_progress': task.get('overall_progress', 0.0),
            'total_files': task.get('total_files', 0),
            'success_count': task.get('success_count', 0),
            'error_count': task.get('error_count', 0),
            'error': task.get('error'),
            'results': task.get('results', []),
            'files': file_statuses,
        }

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
    trace_id = uuid.uuid4().hex[:8]
    started_at = time.perf_counter()
    print(f"[QA-DEBUG][{trace_id}] /qa start, question_len={len(str(question or ''))}")
    try:
        stage_started = time.perf_counter()
        searcher = MultiDocumentSearcher(json_dir=TREE_JSON_DIR)
        searcher.load_documents()
        print(f"[QA-DEBUG][{trace_id}] load_documents done, count={len(searcher.documents)}, elapsed={time.perf_counter() - stage_started:.2f}s")

        if not searcher.documents:
            print(f"[QA-DEBUG][{trace_id}] no documents available")
            return {
                "answer": "当前没有可检索的结构化文档，请先上传并处理文件。",
                "sources": []
            }

        stage_started = time.perf_counter()
        result = await searcher.search(question, trace_id=trace_id)
        print(f"[QA-DEBUG][{trace_id}] search done, elapsed={time.perf_counter() - stage_started:.2f}s, doc_hits={len(result.get('documents', []))}")

        stage_started = time.perf_counter()
        sources = _build_qa_sources_from_doc_results(result.get('documents', []))

        print(f"[QA-DEBUG][{trace_id}] build sources done, count={len(sources)}, elapsed={time.perf_counter() - stage_started:.2f}s")
        print(f"[QA-DEBUG][{trace_id}] /qa finished, total_elapsed={time.perf_counter() - started_at:.2f}s")

        return {
            "answer": result.get('answer', ''),
            "sources": sources
        }
    except Exception as e:
        print(f"[QA-DEBUG][{trace_id}] /qa failed after {time.perf_counter() - started_at:.2f}s, error={str(e)}")
        return JSONResponse(status_code=500, content={"error": f"问答失败: {str(e)}"})


@router.post("/qa-stream")
async def qa_stream(question: str = Form(...)):
    trace_id = uuid.uuid4().hex[:8]

    async def event_generator():
        started_at = time.perf_counter()
        answer_parts = []
        try:
            print(f"[QA-DEBUG][{trace_id}] /qa-stream start, question_len={len(str(question or ''))}")
            yield _json_line({"type": "stage", "stage": "检索文档中", "progress": 20})

            searcher = MultiDocumentSearcher(json_dir=TREE_JSON_DIR)
            searcher.load_documents()
            doc_count = len(searcher.documents)
            print(f"[QA-DEBUG][{trace_id}] /qa-stream load_documents done, count={doc_count}")

            if not searcher.documents:
                yield _json_line({"type": "done", "answer": "当前没有可检索的结构化文档，请先上传并处理文件。", "sources": []})
                return

            yield _json_line({"type": "stage", "stage": "筛选章节中", "progress": 45})
            doc_results = await searcher.search_documents(question, trace_id=trace_id)

            yield _json_line({"type": "stage", "stage": "整合答案中", "progress": 75})
            yield _json_line({"type": "stage", "stage": "生成最终回答中", "progress": 90})

            async for chunk in searcher.stream_comprehensive_answer(question, doc_results, trace_id=trace_id):
                answer_parts.append(chunk)
                yield _json_line({"type": "token", "content": chunk})

            answer_text = "".join(answer_parts)
            sources = _build_qa_sources_from_doc_results(doc_results)
            print(f"[QA-DEBUG][{trace_id}] /qa-stream done, elapsed={time.perf_counter() - started_at:.2f}s, answer_len={len(answer_text)}, sources={len(sources)}")
            yield _json_line({"type": "done", "answer": answer_text, "sources": sources})
        except Exception as e:
            print(f"[QA-DEBUG][{trace_id}] /qa-stream failed after {time.perf_counter() - started_at:.2f}s, error={str(e)}")
            yield _json_line({"type": "error", "message": f"问答失败: {str(e)}"})

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

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


@router.get("/teaching/materials")
async def get_teaching_materials(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """返回可用于教学设计的教材文件列表（来自知识库）。"""
    try:
        files_list = get_knowledge_files(db)
        return {
            "status": "success",
            "materials": files_list,
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"获取教材列表失败: {str(e)}"})


@router.post("/teaching/structure")
async def get_teaching_structure(filename: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """基于 pageindex 结构文件返回教材目录树。"""
    try:
        # 权限校验：仅知识库内且当前用户有权限的文件可以读取结构
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)

        structure_file_path = os.path.join(TREE_JSON_DIR, f"{os.path.splitext(filename)[0]}_structure.json")
        structure_data = None

        if os.path.exists(structure_file_path):
            with open(structure_file_path, 'r', encoding='utf-8') as f:
                structure_data = json.load(f)
        else:
            # 若没有结构文件，兜底触发一次生成并返回（复用现有能力）
            mindmap_data = await get_mindmap_data_async(filename, file_path)
            if mindmap_data is None:
                raise FileNotFoundError("教材结构不存在且生成失败")
            if os.path.exists(structure_file_path):
                with open(structure_file_path, 'r', encoding='utf-8') as f:
                    structure_data = json.load(f)

        if not structure_data:
            raise FileNotFoundError("未找到教材目录结构")

        return {
            "status": "success",
            "filename": filename,
            "doc_name": structure_data.get("doc_name", filename),
            "doc_description": structure_data.get("doc_description", ""),
            "structure": structure_data.get("structure", []),
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="教材结构文件格式错误")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取教材结构失败: {str(e)}")


@router.post("/teaching/schedule")
async def generate_teaching_schedule(
    filename: str = Form(...),
    selected_outline: str = Form(...),
    total_hours: int = Form(...),
    total_lessons: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """根据教师勾选后的目录和课时生成固定格式教学安排表。"""
    try:
        # 权限校验
        get_download_file_path(filename=filename, current_user=current_user, db=db)

        if not str(selected_outline or '').strip():
            raise HTTPException(status_code=400, detail="请先勾选章节并生成最终大纲")
        if int(total_hours) <= 0:
            raise HTTPException(status_code=400, detail="课时必须为正整数")
        if int(total_lessons) <= 0:
            raise HTTPException(status_code=400, detail="课数必须为正整数")

        table_markdown = generate_teaching_schedule_markdown(
            selected_outline=selected_outline,
            total_hours=int(total_hours),
            total_lessons=int(total_lessons),
            material_name=filename,
        )

        return {
            "status": "success",
            "filename": filename,
            "total_hours": int(total_hours),
            "total_lessons": int(total_lessons),
            "table_markdown": table_markdown,
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成教学安排失败: {str(e)}")


@router.post("/teaching/schedule-stream")
async def generate_teaching_schedule_stream(
    filename: str = Form(...),
    selected_outline: str = Form(...),
    total_hours: int = Form(...),
    total_lessons: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """流式生成教学安排 Markdown 表格。"""
    try:
        get_download_file_path(filename=filename, current_user=current_user, db=db)

        if not str(selected_outline or '').strip():
            raise HTTPException(status_code=400, detail="请先勾选章节并生成最终大纲")
        if int(total_hours) <= 0:
            raise HTTPException(status_code=400, detail="课时必须为正整数")
        if int(total_lessons) <= 0:
            raise HTTPException(status_code=400, detail="课数必须为正整数")

        async def event_generator():
            try:
                yield _json_line({"type": "stage", "stage": "正在生成教学安排", "progress": 30})
                full_text_parts = []
                async for chunk in generate_teaching_schedule_markdown_stream(
                    selected_outline=selected_outline,
                    total_hours=int(total_hours),
                    total_lessons=int(total_lessons),
                    material_name=filename,
                ):
                    full_text_parts.append(chunk)
                    yield _json_line({"type": "token", "content": chunk})

                final_text = "".join(full_text_parts).strip()
                # 尽量去掉代码块包裹，避免前端显示 ```markdown
                if final_text.startswith("```"):
                    final_text = re.sub(r'^```[a-zA-Z0-9_-]*\s*', '', final_text)
                    final_text = re.sub(r'\s*```\s*$', '', final_text)
                    final_text = final_text.strip()

                yield _json_line({
                    "type": "done",
                    "filename": filename,
                    "total_hours": int(total_hours),
                    "total_lessons": int(total_lessons),
                    "table_markdown": final_text,
                })
            except Exception as e:
                yield _json_line({"type": "error", "message": f"生成教学安排失败: {str(e)}"})

        return StreamingResponse(event_generator(), media_type="application/x-ndjson")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成教学安排失败: {str(e)}")

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
    if current_user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="只有教师或管理员可以设置下载权限")
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

@router.get("/media-subtitles/{filename}")
async def get_media_subtitles(filename: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """返回媒体文件对应的字幕（来自 rag/db/audio_text）。"""
    try:
        # 复用下载权限校验，避免越权读取字幕
        get_download_file_path(filename=filename, current_user=current_user, db=db)

        source_stem = os.path.splitext(os.path.basename(filename))[0]
        subtitle_path = os.path.join(AUDIO_TEXT_DIR, f"{source_stem}.json")

        if not os.path.exists(subtitle_path):
            return {
                "status": "success",
                "filename": filename,
                "subtitles": []
            }

        with open(subtitle_path, 'r', encoding='utf-8') as f:
            raw_subtitles = json.load(f)

        subtitles = []
        for item in raw_subtitles if isinstance(raw_subtitles, list) else []:
            sentence = str(item.get('sentence', '')).strip()
            try:
                start_time = float(item.get('start_time'))
                end_time = float(item.get('end_time'))
            except (TypeError, ValueError):
                continue

            if end_time < start_time:
                end_time = start_time

            subtitles.append({
                "sentence": sentence,
                "start_time": start_time,
                "end_time": end_time,
            })

        subtitles.sort(key=lambda x: x['start_time'])

        return {
            "status": "success",
            "filename": filename,
            "subtitles": subtitles,
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="字幕文件格式错误")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取字幕失败: {str(e)}")

@router.get("/view-pdf/{filename}")
async def view_pdf_file(filename: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """在浏览器中预览PDF文件"""
    try:
        # 检查文件权限和存在性
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)
        # 检查是否为PDF文件
        if not filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="仅支持PDF文件预览")
        # 以内联方式返回PDF，使浏览器显示而不是下载
        return FileResponse(file_path, media_type='application/pdf', headers={"Content-Disposition": "inline"})
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

# ==================== 思维导图相关API ====================

@router.post("/mindmap/generate")
async def generate_mindmap(filename: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    生成或获取文件的思维导图数据
    - 如果已有结构文件，直接加载并返回思维导图
    - 如果没有，自动生成结构文件，然后返回思维导图
    """
    try:
        # 检查文件是否存在和权限
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)

        # 获取思维导图数据（使用异步版本）
        mindmap_data = await get_mindmap_data_async(filename, file_path)
        
        if mindmap_data is None:
            return JSONResponse(
                status_code=500,
                content={"error": "思维导图生成失败"}
            )
        
        return {
            "status": "success",
            "filename": filename,
            "mindmap": mindmap_data
        }
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"思维导图生成异常: {str(e)}"}
        )

@router.post("/mindmap/regenerate")
async def regenerate_mindmap(filename: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    强制重新生成思维导图（会覆盖已有的结构文件）
    """
    try:
        # 检查文件是否存在和权限
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)

        # 获取思维导图数据（强制重新生成，使用异步版本）
        mindmap_data = await get_mindmap_data_async(filename, file_path, force_regenerate=True)
        
        if mindmap_data is None:
            return JSONResponse(
                status_code=500,
                content={"error": "思维导图生成失败"}
            )
        
        return {
            "status": "success",
            "filename": filename,
            "message": "思维导图已重新生成",
            "mindmap": mindmap_data
        }
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"思维导图重新生成异常: {str(e)}"}
        )

@router.post("/mindmap/search")
async def search_mindmap(filename: str = Form(...), keyword: str = Form(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    在思维导图中搜索关键词
    """
    try:
        # 检查文件是否存在和权限
        file_path = get_download_file_path(filename=filename, current_user=current_user, db=db)
        
        # 获取思维导图数据（使用异步版本）
        mindmap_data = await get_mindmap_data_async(filename, file_path)
        
        if mindmap_data is None:
            return JSONResponse(
                status_code=500,
                content={"error": "无法加载思维导图数据"}
            )
        
        # 执行搜索
        results = search_in_mindmap(mindmap_data, keyword)
        
        return {
            "status": "success",
            "keyword": keyword,
            "results": results,
            "count": len(results)
        }
        
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"搜索异常: {str(e)}"}
        )
