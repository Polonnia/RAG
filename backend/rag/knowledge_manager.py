'''
处理知识库文件上传、删除、权限设置等相关逻辑
'''
import os
import json
import re
import shutil
from datetime import datetime

from models import KnowledgeFilePermission
from rag.ingest import ingest_file
from .resources import get_vector_db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
FILES_INFO_PATH = os.path.join(os.path.dirname(__file__), 'db', 'files_info.json')
vector_db = get_vector_db()


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


def upload_knowledge_files(files, current_user, db):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    files_info = load_files_info()
    results = []

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
            save_files_info(files_info)

            print(f"开始处理文件: {safe_filename}")
            ingest_file(file_path)
            files_info[safe_filename]['status'] = 'completed'
            save_files_info(files_info)

            perm = db.query(KnowledgeFilePermission).filter_by(filename=safe_filename).first()
            if not perm:
                db.add(KnowledgeFilePermission(filename=safe_filename, student_can_download=False))
                db.commit()

            results.append({"filename": file.filename, "status": "success", "msg": "文件上传并入库成功"})
            print(f"文件处理成功: {safe_filename}")
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"文件处理异常 ({getattr(file, 'filename', 'unknown')}): {error_trace}")
            
            if 'safe_filename' in locals() and safe_filename in files_info:
                files_info[safe_filename]['status'] = 'failed'
                save_files_info(files_info)
            results.append({"filename": getattr(file, 'filename', 'unknown'), "status": "error", "msg": f"上传失败: {str(e)}"})

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

def search_knowledge(query: str, top_k: int = 5) -> list:
 
    try:
        docs_with_scores = vector_db.similarity_search_with_score(query, k=top_k)
        
        results = []
        for doc, score in docs_with_scores:
            results.append({
                'content': doc.page_content,
                'source': doc.metadata.get('source', '未知'),
                'page': doc.metadata.get('page', '未知'),
                'similarity': float(score),
                'metadata': doc.metadata
            })
        
        return results
    except Exception as e:
        print(f"知识库搜索失败: {str(e)}")
        return [] 
