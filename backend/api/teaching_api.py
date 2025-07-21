from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.responses import FileResponse
import tempfile, os, shutil, traceback, logging, datetime
from ppt_agent.document_parser import DocumentModel
from ppt_agent.ppt_generator import PPTGenerator
from models import get_db, User
from auth import get_current_user

router = APIRouter()

PPT_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ppt_agent', 'uploads')
os.makedirs(PPT_UPLOAD_DIR, exist_ok=True)

logging.basicConfig(level=logging.INFO)

@router.post("/teacher/generate-ppt-from-outline")
async def generate_ppt_from_outline(request: Request, outline: str = Form(...), current_user: User = Depends(get_current_user)):
    temp_dir = tempfile.mkdtemp()
    try:
        md_path = os.path.join(temp_dir, "outline.md")
        ppt_path = os.path.join(temp_dir, "output.pptx")
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(outline)
        doc_model = DocumentModel(md_path)
        doc_model.parse()
        doc_model.download_images(temp_dir)
        ppt_generator = PPTGenerator()
        ppt_generator.generate(doc_model, ppt_path)
        if not os.path.exists(ppt_path):
            raise HTTPException(status_code=500, detail=f"PPT生成失败，文件未创建: {ppt_path}")
        # 保存历史副本
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        teacher_name = current_user.username if current_user else 'unknown'
        history_filename = f"{teacher_name}_{timestamp}.pptx"
        history_path = os.path.join(PPT_UPLOAD_DIR, history_filename)
        shutil.copy2(ppt_path, history_path)
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"msg": "ok"}
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT生成异常: {e}")

@router.post("/teacher/generate-ppt-from-upload")
async def generate_ppt_from_upload(document: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    temp_dir = tempfile.mkdtemp()
    try:
        input_path = os.path.join(temp_dir, document.filename)
        ppt_path = os.path.join(temp_dir, "output.pptx")
        with open(input_path, "wb") as f:
            f.write(await document.read())
        doc_model = DocumentModel(input_path)
        doc_model.parse()
        doc_model.download_images(temp_dir)
        ppt_generator = PPTGenerator()
        ppt_generator.generate(doc_model, ppt_path)
        if not os.path.exists(ppt_path):
            raise HTTPException(status_code=500, detail=f"PPT生成失败，文件未创建: {ppt_path}")
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        teacher_name = current_user.username if current_user else 'unknown'
        history_filename = f"{teacher_name}_{timestamp}.pptx"
        history_path = os.path.join(PPT_UPLOAD_DIR, history_filename)
        shutil.copy2(ppt_path, history_path)
        shutil.rmtree(temp_dir, ignore_errors=True)
        return {"msg": "ok"}
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"PPT生成异常: {e}")

@router.get("/teacher/ppt-history")
def get_teacher_ppt_history(current_user: User = Depends(get_current_user)):
    files = []
    if os.path.exists(PPT_UPLOAD_DIR):
        for fname in os.listdir(PPT_UPLOAD_DIR):
            if fname.startswith(current_user.username + '_') and fname.lower().endswith('.pptx'):
                fpath = os.path.join(PPT_UPLOAD_DIR, fname)
                stat = os.stat(fpath)
                files.append({
                    'filename': fname,
                    'created_at': datetime.datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M'),
                    'size': stat.st_size
                })
    files.sort(key=lambda x: x['created_at'], reverse=True)
    return {"files": files}

@router.get("/teacher/ppt-history/download/{filename}")
def download_teacher_ppt(filename: str, current_user: User = Depends(get_current_user)):
    fpath = os.path.join(PPT_UPLOAD_DIR, filename)
    if not os.path.isfile(fpath) or not filename.startswith(current_user.username + '_'):
        raise HTTPException(status_code=404, detail="文件不存在或无权限")
    return FileResponse(fpath, filename=filename, media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation')

@router.get("/teacher/ppt-history/preview/{filename}")
def preview_teacher_ppt(filename: str, current_user: User = Depends(get_current_user)):
    fpath = os.path.join(PPT_UPLOAD_DIR, filename)
    if not os.path.isfile(fpath) or not filename.startswith(current_user.username + '_'):
        raise HTTPException(status_code=404, detail="文件不存在或无权限")
    return FileResponse(fpath, filename=filename, media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation')

@router.delete("/teacher/ppt-history/delete/{filename}")
def delete_teacher_ppt(filename: str, current_user: User = Depends(get_current_user)):
    fpath = os.path.join(PPT_UPLOAD_DIR, filename)
    if not os.path.isfile(fpath) or not filename.startswith(current_user.username + '_'):
        raise HTTPException(status_code=404, detail="文件不存在或无权限")
    os.remove(fpath)
    return {"msg": "删除成功"}

@router.get("/admin/ppt-files")
def admin_list_ppt_files(current_user: User = Depends(get_current_user)):
    # 仅管理员可用
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="需要管理员权限")
    files = []
    if os.path.exists(PPT_UPLOAD_DIR):
        for fname in os.listdir(PPT_UPLOAD_DIR):
            if fname.lower().endswith('.pptx'):
                fpath = os.path.join(PPT_UPLOAD_DIR, fname)
                stat = os.stat(fpath)
                # 教师名为文件名下划线前缀
                teacher = fname.split('_')[0] if '_' in fname else ''
                files.append({
                    'filename': fname,
                    'created_at': datetime.datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M'),
                    'size': stat.st_size,
                    'teacher': teacher
                })
    files.sort(key=lambda x: x['created_at'], reverse=True)
    return {"files": files}

@router.get("/admin/ppt-files/download/{filename}")
def admin_download_ppt_file(filename: str, current_user: User = Depends(get_current_user)):
    if current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="需要管理员权限")
    fpath = os.path.join(PPT_UPLOAD_DIR, filename)
    if not os.path.isfile(fpath):
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(fpath, filename=filename, media_type='application/vnd.openxmlformats-officedocument.presentationml.presentation') 