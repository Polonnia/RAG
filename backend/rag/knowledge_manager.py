'''
处理知识库文件上传、删除、权限设置等相关逻辑
'''
import os
import json
import re
import shutil
import asyncio
import subprocess
import random
from datetime import datetime
from pathlib import Path
from pypdf import PdfReader

from models import KnowledgeFilePermission
from rag.ingest import ingest_file
from rag.pageindex.page_index import page_index_main
from rag.pageindex.page_index_md import md_to_tree
from rag.pageindex.utils import audio_json_to_tree, ConfigLoader

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
FILES_INFO_PATH = os.path.join(os.path.dirname(__file__), 'db', 'files_info.json')

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


def _parse_file_index(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text.isdigit():
        return None
    parsed = int(text)
    return parsed if parsed > 0 else None


def _next_file_index(files_info):
    max_index = 0
    for item in files_info.values():
        if not isinstance(item, dict):
            continue
        parsed = _parse_file_index(item.get('file_index'))
        if parsed and parsed > max_index:
            max_index = parsed
    return f"{max_index + 1:03d}"


def _save_tree_result(source_file_path, tree_result):
    os.makedirs(TREES_DIR, exist_ok=True)
    output_name = f"{Path(source_file_path).stem}_structure.json"
    output_path = os.path.join(TREES_DIR, output_name)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tree_result, f, ensure_ascii=False, indent=2)
    return output_path


def _is_scanned_pdf(pdf_path, sample_pages=2, min_chars=10):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f'PDF文件不存在: {pdf_path}')

    reader = PdfReader(pdf_path)
    total_pages = len(reader.pages)
    if total_pages == 0:
        return True

    sampled_count = min(sample_pages, total_pages)
    sampled_indexes = random.sample(range(total_pages), sampled_count)

    extracted_chars = 0
    for idx in sampled_indexes:
        text = reader.pages[idx].extract_text() or ''
        extracted_chars += len(re.sub(r'\s+', '', text))

    return extracted_chars < min_chars


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


def _process_with_pageindex(file_path, progress_callback=None):
    ext = os.path.splitext(file_path)[1].lower()
    config_loader = ConfigLoader()
    opt = config_loader.load({})

    def _notify(step, file_progress=None):
        if callable(progress_callback):
            try:
                progress_callback(step=step, file_progress=file_progress)
            except Exception:
                pass

    if ext in SUPPORTED_MEDIA:
        _notify('音视频转写', 35)
        audio_json_path = ingest_file(file_path)
        if not audio_json_path:
            raise ValueError('Media ASR output is empty')
        _notify('生成节点结构', 75)
        return audio_json_to_tree(
            audio_json_path=audio_json_path,
            model=opt.model,
            if_add_node_summary=opt.if_add_node_summary,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id,
        )

    if ext in SUPPORTED_WORD or ext in SUPPORTED_PPT:
        _notify('文档格式转换', 25)
        pdf_path = _convert_office_to_pdf(file_path)
        _notify('检测PDF是否为扫描件', 35)
        if _is_scanned_pdf(pdf_path):
            ocr_json = ingest_file(pdf_path)
        _notify('解析文档目录', 45)
        tree_result = page_index_main(pdf_path, opt, progress_callback=progress_callback)
        _save_tree_result(file_path, tree_result)
        return tree_result

    if ext == '.pdf':
        _notify('检测PDF是否为扫描件', 35)
        if _is_scanned_pdf(file_path):
            raise ValueError('检测到扫描版PDF（随机抽取两页文本总字数小于10），请先进行OCR后再上传。')
        _notify('解析文档目录', 45)
        tree_result = page_index_main(file_path, opt, progress_callback=progress_callback)
        _save_tree_result(file_path, tree_result)
        return tree_result

    if ext in SUPPORTED_MARKDOWN:
        _notify('解析文档目录', 45)
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
        _notify('生成节点结构', 75)
        _save_tree_result(file_path, tree_result)
        return tree_result

    raise ValueError(f'Unsupported file type for pageindex processing: {ext}')


async def upload_knowledge_files(files, current_user, db, max_concurrency=3, progress_callback=None):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    files_info = load_files_info()
    results = []
    pending_items = []
    total_files = len(files)

    def _notify(filename=None, status='processing', step=None, file_progress=None, message=None):
        if callable(progress_callback):
            try:
                progress_callback({
                    'filename': filename,
                    'status': status,
                    'step': step,
                    'file_progress': file_progress,
                    'message': message,
                    'total_files': total_files,
                })
            except Exception:
                pass

    _notify(status='running', step='开始上传任务', file_progress=0)

    for file in files:
        try:
            safe_filename = sanitize_filename(file.filename)
            file_path = os.path.join(UPLOAD_DIR, safe_filename)

            _notify(filename=file.filename, status='processing', step='保存上传文件', file_progress=10)

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            if not os.path.exists(file_path):
                raise FileNotFoundError(f"文件保存失败: {file_path}")

            stat = os.stat(file_path)
            file_index = _next_file_index(files_info)
            files_info[safe_filename] = {
                'file_index': file_index,
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
            _notify(filename=file.filename, status='processing', step='文件保存完成', file_progress=20)
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"文件处理异常 ({getattr(file, 'filename', 'unknown')}): {error_trace}")
            
            if 'safe_filename' in locals() and safe_filename in files_info:
                files_info[safe_filename]['status'] = 'failed'
            results.append({"filename": getattr(file, 'filename', 'unknown'), "status": "error", "msg": f"上传失败: {str(e)}"})
            _notify(filename=getattr(file, 'filename', 'unknown'), status='error', step='文件保存失败', file_progress=100, message=str(e))

    save_files_info(files_info)

    semaphore = asyncio.Semaphore(max_concurrency)

    async def _process_one(item):
        safe_filename = item['safe_filename']
        original_filename = item['original_filename']
        try:
            print(f"开始处理文件: {safe_filename}")
            async with semaphore:
                _notify(filename=original_filename, status='processing', step='解析文档目录', file_progress=40)

                def _step_callback(step=None, file_progress=None):
                    _notify(filename=original_filename, status='processing', step=step, file_progress=file_progress)

                await asyncio.to_thread(_process_with_pageindex, item['file_path'], _step_callback)
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
                _notify(filename=original_filename, status='success', step='解析完成', file_progress=100)
                print(f"文件处理成功: {safe_filename}")
            else:
                files_info[safe_filename]['status'] = 'failed'
                results.append({"filename": original_filename, "status": "error", "msg": f"上传失败: {error}"})
                _notify(filename=original_filename, status='error', step='解析失败', file_progress=100, message=error)

        save_files_info(files_info)

    success_count = len([r for r in results if r["status"] == "success"])
    error_count = len([r for r in results if r["status"] == "error"])
    print(f"文件上传统计: 成功 {success_count}, 失败 {error_count}")
    _notify(status='completed', step='上传任务完成', file_progress=100)
    return {
        "results": results,
        "success_count": success_count,
        "error_count": error_count,
    }


def get_knowledge_files(db):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    files_info = load_files_info()
    perms = {p.filename: p.student_can_download for p in db.query(KnowledgeFilePermission).all()}

    # 以 uploads 目录中的真实文件为准，补齐 files_info 中缺失的记录
    disk_files = [
        f for f in os.listdir(UPLOAD_DIR)
        if os.path.isfile(os.path.join(UPLOAD_DIR, f))
    ]

    info_updated = False
    for filename in disk_files:
        file_path = os.path.join(UPLOAD_DIR, filename)
        stat = os.stat(file_path)

        if filename not in files_info:
            files_info[filename] = {
                'file_index': _next_file_index(files_info),
                'filename': filename,
                'original_filename': filename,
                'upload_time': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
                'file_size': stat.st_size,
                'file_size_display': format_file_size(stat.st_size),
                'file_type': os.path.splitext(filename)[1].lower(),
                'uploaded_by': 'unknown',
                'student_can_download': False,
                'status': 'completed'
            }
            info_updated = True
        else:
            # 兼容旧记录缺字段的情况
            item = files_info[filename]
            if not item.get('file_index'):
                item['file_index'] = _next_file_index(files_info)
                info_updated = True
            if 'file_size' not in item:
                item['file_size'] = stat.st_size
                info_updated = True
            if 'file_size_display' not in item:
                item['file_size_display'] = format_file_size(stat.st_size)
                info_updated = True
            if 'file_type' not in item:
                item['file_type'] = os.path.splitext(filename)[1].lower()
                info_updated = True
            if not item.get('upload_time'):
                item['upload_time'] = datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                info_updated = True

    # 清理 files_info 中已不存在的文件记录
    disk_set = set(disk_files)
    stale_keys = [name for name in list(files_info.keys()) if name not in disk_set]
    for key in stale_keys:
        del files_info[key]
        info_updated = True

    if info_updated:
        save_files_info(files_info)

    files_list = list(files_info.values())
    for item in files_list:
        item['student_can_download'] = perms.get(item['filename'], False)
        file_path = os.path.join(UPLOAD_DIR, item['filename'])
        item['file_exists'] = os.path.exists(file_path)

    files_list.sort(key=lambda x: x.get('upload_time', ''), reverse=True)
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
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise FileNotFoundError("文件不存在")

    perm = db.query(KnowledgeFilePermission).filter_by(filename=filename).first()
    if not perm:
        perm = KnowledgeFilePermission(filename=filename, student_can_download=False)
        db.add(perm)
        db.commit()

    can_download = bool(getattr(perm, '__dict__', {}).get('student_can_download', False))
    if current_user.role == "student" and not can_download:
        raise PermissionError("该文件不允许学生下载")

    return file_path


def delete_knowledge_file(filename, db=None):
    """删除知识库中的文件"""
    try:
        files_info = load_files_info()
        actual_filename = filename
        if filename not in files_info:
            for stored_name, item in files_info.items():
                if isinstance(item, dict) and item.get('original_filename') == filename:
                    actual_filename = stored_name
                    break

        file_path = os.path.join(UPLOAD_DIR, actual_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"物理文件已删除: {file_path}")
        else:
            print(f"物理文件不存在: {file_path}")

        # 同步删除该文件对应的结构化索引文件
        structure_filename = f"{Path(actual_filename).stem}_structure.json"
        structure_file_path = os.path.join(TREES_DIR, structure_filename)
        if os.path.exists(structure_file_path):
            os.remove(structure_file_path)
            print(f"结构文件已删除: {structure_file_path}")
        else:
            print(f"结构文件不存在: {structure_file_path}")

        if actual_filename in files_info:
            del files_info[actual_filename]
            save_files_info(files_info)

        if db is not None:
            perm = db.query(KnowledgeFilePermission).filter_by(filename=actual_filename).first()
            if perm:
                db.delete(perm)
                db.commit()
        
        print(f"文件删除成功: {actual_filename}")
        return True
        
    except Exception as e:
        print(f"删除文件失败: {str(e)}")
        raise e