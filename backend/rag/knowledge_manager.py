'''
处理知识库文件上传、删除、权限设置等相关逻辑
'''
import os
import json
import re
import shutil
import asyncio
import subprocess
from datetime import datetime
from pathlib import Path

from models import KnowledgeFilePermission
from rag.ingest import ingest_file
from rag.pageindex.page_index import page_index_main
from rag.pageindex.page_index_md import md_to_tree
from rag.pageindex.utils import audio_json_to_tree, ConfigLoader
from .resources import get_vector_db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
FILES_INFO_PATH = os.path.join(os.path.dirname(__file__), 'db', 'files_info.json')
vector_db = get_vector_db()

SUPPORTED_MARKDOWN = {'.md', '.markdown'}
SUPPORTED_WORD = {'.doc', '.docx'}
SUPPORTED_PPT = {'.ppt', '.pptx'}
SUPPORTED_MEDIA = {'.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv'}
TREES_DIR = os.path.join(os.path.dirname(__file__), 'db', 'trees')


def sanitize_filename(filename):
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    if len(filename) > 100:
        name, ext = os.path.splitext(filename)
        filename = name[:100-len(ext)] + ext
    return filename


def load_files_info():
    if os.path.exists(FILES_INFO_PATH):
        try:
            with open(FILES_INFO_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_files_info(files_info):
    with open(FILES_INFO_PATH, 'w', encoding='utf-8') as f:
        json.dump(files_info, f, ensure_ascii=False, indent=2)


def format_file_size(size_bytes):
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


def _save_tree_result(source_file_path, tree_result):
    os.makedirs(TREES_DIR, exist_ok=True)
    output_name = f"{Path(source_file_path).stem}_structure.json"
    output_path = os.path.join(TREES_DIR, output_name)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tree_result, f, ensure_ascii=False, indent=2)
    return output_path


def _convert_office_to_pdf(input_path):
    input_path = os.path.abspath(input_path)
    output_pdf = os.path.splitext(input_path)[0] + '.pdf'
    ext = os.path.splitext(input_path)[1].lower()

    com_error = None
    try:
        import win32com.client
        if ext in SUPPORTED_WORD:
            word = win32com.client.DispatchEx("Word.Application")
            word.Visible = False
            doc = word.Documents.Open(input_path)
            doc.SaveAs(output_pdf, FileFormat=17)
            doc.Close(False)
            word.Quit()
            return output_pdf
        if ext in SUPPORTED_PPT:
            powerpoint = win32com.client.DispatchEx("PowerPoint.Application")
            presentation = powerpoint.Presentations.Open(input_path, WithWindow=False)
            presentation.SaveAs(output_pdf, 32)
            presentation.Close()
            powerpoint.Quit()
            return output_pdf
    except Exception as e:
        com_error = e

    try:
        subprocess.run(
            ['soffice', '--headless', '--convert-to', 'pdf', '--outdir', os.path.dirname(input_path), input_path],
            check=True,
            capture_output=True,
            text=True,
        )
        if os.path.exists(output_pdf):
            return output_pdf
    except Exception:
        pass

    if com_error is not None:
        raise RuntimeError(f'Office to PDF conversion failed: {com_error}')
    raise RuntimeError('Office to PDF conversion failed: no available converter (win32com/soffice)')


def _process_with_pageindex(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    config_loader = ConfigLoader()
    opt = config_loader.load({})

    if ext in SUPPORTED_MEDIA:
        audio_json_path = ingest_file(file_path)
        if not audio_json_path:
            raise ValueError('Media ASR output is empty')
        return audio_json_to_tree(
            audio_json_path=audio_json_path,
            model=opt.model,
            if_add_node_summary=opt.if_add_node_summary,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id,
        )

    if ext in SUPPORTED_WORD or ext in SUPPORTED_PPT:
        pdf_path = _convert_office_to_pdf(file_path)
        tree_result = page_index_main(pdf_path, opt)
        _save_tree_result(file_path, tree_result)
        return tree_result

    if ext == '.pdf':
        tree_result = page_index_main(file_path, opt)
        _save_tree_result(file_path, tree_result)
        return tree_result

    if ext in SUPPORTED_MARKDOWN:
        tree_result = asyncio.run(md_to_tree(
            md_path=file_path,
            if_thinning=False,
            min_token_threshold=5000,
            if_add_node_summary=opt.if_add_node_summary,
            summary_token_threshold=200,
            model=opt.model,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id,
        ))
        _save_tree_result(file_path, tree_result)
        return tree_result

    raise ValueError(f'Unsupported file type for pageindex processing: {ext}')


async def upload_knowledge_files(files, current_user, db, max_concurrency=3):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    files_info = load_files_info()
    results = []
    pending_items = []

    for file in files:
        try:
            safe_filename = sanitize_filename(file.filename)
            file_path = os.path.join(UPLOAD_DIR, safe_filename)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件保存失败: {file_path}")

            stat = os.stat(file_path)
            files_info[safe_filename] = {
                'filename': safe_filename,
                'original_filename': file.filename,
                'upload_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'file_size': stat.st_size,
                'file_size_display': format_file_size(stat.st_size),
                'file_type': os.path.splitext(safe_filename)[1].lower(),
                'uploaded_by': current_user.username,
                'student_can_download': False,
                'status': 'uploaded'
            }
            pending_items.append({
                'safe_filename': safe_filename,
                'original_filename': file.filename,
                'file_path': file_path,
            })
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"文件处理异常 ({getattr(file, 'filename', 'unknown')}): {error_trace}")
            
            if 'safe_filename' in locals() and safe_filename in files_info:
                files_info[safe_filename]['status'] = 'failed'
            results.append({"filename": getattr(file, 'filename', 'unknown'), "status": "error", "msg": f"上传失败: {str(e)}"})

    save_files_info(files_info)

    semaphore = asyncio.Semaphore(max_concurrency)

    async def _process_one(item):
        safe_filename = item['safe_filename']
        try:
            print(f"开始处理文件: {safe_filename}")
            async with semaphore:
                await asyncio.to_thread(_process_with_pageindex, item['file_path'])
            return item, None
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"文件处理异常 ({safe_filename}): {error_trace}")
            return item, str(e)

    if pending_items:
        process_results = await asyncio.gather(*[_process_one(item) for item in pending_items])
        for item, error in process_results:
            safe_filename = item['safe_filename']
            original_filename = item['original_filename']

            if error is None:
                files_info[safe_filename]['status'] = 'completed'
                perm = db.query(KnowledgeFilePermission).filter_by(filename=safe_filename).first()
                if not perm:
                    db.add(KnowledgeFilePermission(filename=safe_filename, student_can_download=False))
                    db.commit()
                results.append({"filename": original_filename, "status": "success", "msg": "文件上传并处理成功"})
                print(f"文件处理成功: {safe_filename}")
            else:
                files_info[safe_filename]['status'] = 'failed'
                results.append({"filename": original_filename, "status": "error", "msg": f"上传失败: {error}"})

        save_files_info(files_info)

    success_count = len([r for r in results if r["status"] == "success"])
    error_count = len([r for r in results if r["status"] == "error"])
    print(f"文件上传统计: 成功 {success_count}, 失败 {error_count}")
    return {
        "results": results,
        "success_count": success_count,
        "error_count": error_count,
    }


def get_knowledge_files(db):
    files_info = load_files_info()
    files_list = list(files_info.values())
    perms = {p.filename: p.student_can_download for p in db.query(KnowledgeFilePermission).all()}

    for item in files_list:
        item['student_can_download'] = perms.get(item['filename'], False)
        file_path = os.path.join(UPLOAD_DIR, item['filename'])
        item['file_exists'] = os.path.exists(file_path)

    files_list.sort(key=lambda x: x['upload_time'], reverse=True)
    return files_list


def set_student_download_permission(filename, can_download, db):
    perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
    if not perm:
        perm = KnowledgeFilePermission(filename=filename, student_can_download=can_download)
        db.add(perm)
    else:
        perm.student_can_download = can_download
    db.commit()
    return True

def get_download_file_path(filename, current_user, db):
    perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
    if not perm:
        raise FileNotFoundError("文件不存在")

    if current_user.role == "student" and not perm.student_can_download:
        raise PermissionError("该文件不允许学生下载")

    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise FileNotFoundError("文件不存在")

    return file_path


def delete_knowledge_file(filename, db=None):
    """删除知识库中的文件"""
    try:
        print(f"开始删除文件: {filename}")
        
        # 1. 从向量数据库中删除相关文档
        collection = vector_db._collection
        if collection:
            # 获取所有文档
            results = collection.get()
            if results and results.get('documents'):
                # 找到要删除的文档的ID
                ids_to_delete = []
                for i, metadata in enumerate(results.get('metadatas', [])):
                    if metadata and metadata.get('source') == filename:
                        doc_id = results['ids'][i]
                        ids_to_delete.append(doc_id)
                
                # 删除文档
                if ids_to_delete:
                    print(f"找到 {len(ids_to_delete)} 个文档片段需要删除")
                    # 使用 ID 删除文档
                    collection.delete(ids=ids_to_delete)
                    print(f"已从向量数据库删除 {len(ids_to_delete)} 个文档片段")
                else:
                    print(f"未找到文件 {filename} 的文档片段")
            else:
                print("向量数据库中没有文档")
        
        # 2. 删除物理文件
        file_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"物理文件已删除: {file_path}")
        else:
            print(f"物理文件不存在: {file_path}")

        files_info = load_files_info()
        if filename in files_info:
            del files_info[filename]
            save_files_info(files_info)

        if db is not None:
            perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
            if perm:
                db.delete(perm)
                db.commit()
        
        print(f"文件删除成功: {filename}")
        return True
        
    except Exception as e:
        print(f"删除文件失败: {str(e)}")
        raise e