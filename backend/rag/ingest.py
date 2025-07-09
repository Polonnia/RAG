import os
from langchain_community.document_loaders import PyPDFLoader, UnstructuredWordDocumentLoader
from langchain.text_splitter import CharacterTextSplitter
from langchain.embeddings.huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from datetime import datetime
from langchain.schema import Document
from typing import List

# 导入OCR处理器
from .ocr_processor import ocr_processor

# 尝试导入更多PDF解析器
try:
    from langchain_community.document_loaders import PyMuPDFLoader
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    print("PyMuPDF未安装，将使用默认PDF解析器")

try:
    from langchain_community.document_loaders import PDFPlumberLoader
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False
    print("PDFPlumber未安装，将使用默认PDF解析器")

# 尝试导入更多Word文档解析器
try:
    from langchain_community.document_loaders import Docx2txtLoader
    HAS_DOCX2TXT = True
except ImportError:
    HAS_DOCX2TXT = False
    print("docx2txt未安装，将使用默认Word解析器")

# 尝试导入旧版Word文档解析器
try:
    import docx
    HAS_PYTHON_DOCX = True
except ImportError:
    HAS_PYTHON_DOCX = False
    print("python-docx未安装，无法解析旧版.doc文件")

DB_DIR = os.path.join(os.path.dirname(__file__), 'db')
os.makedirs(DB_DIR, exist_ok=True)

# 初始化向量数据库
vector_db = Chroma(
    persist_directory=DB_DIR,
    embedding_function=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
)

def is_scanned_pdf(file_path: str) -> bool:
    """检测是否为扫描版PDF"""
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(file_path)
        scanned_pages = 0
        total_pages = len(doc)
        
        for page_num in range(min(total_pages, 3)):  # 检查前3页
            page = doc.load_page(page_num)
            
            # 尝试提取文本
            text = page.get_text()
            
            # 如果文本很少或为空，可能是扫描版
            if len(text.strip()) < 50:  # 少于50个字符
                scanned_pages += 1
        
        doc.close()
        
        # 如果超过一半的页面都是扫描版，则认为是扫描版PDF
        return scanned_pages >= min(2, total_pages // 2)
        
    except Exception as e:
        print(f"检测扫描版PDF失败: {str(e)}")
        return False

def parse_doc_file(file_path):
    """解析旧版.doc文件"""
    try:
        # 方法1: 使用python-docx尝试解析
        if HAS_PYTHON_DOCX:
            try:
                print("尝试使用python-docx解析.doc文件...")
                doc = docx.Document(file_path)
                text = ""
                for paragraph in doc.paragraphs:
                    text += paragraph.text + "\n"
                if text.strip():
                    print("成功使用python-docx解析.doc文件")
                    return [{"page_content": text, "metadata": {}}]
            except Exception as e:
                print(f"python-docx解析失败: {str(e)}")
        
        # 方法2: 尝试使用系统工具
        try:
            print("尝试使用系统工具解析.doc文件...")
            import subprocess
            import platform
            
            system = platform.system().lower()
            
            if system == "windows":
                # Windows系统尝试使用PowerShell
                try:
                    result = subprocess.run([
                        'powershell', '-Command', 
                        f'$word = New-Object -ComObject Word.Application; $word.Visible = $false; $doc = $word.Documents.Open("{file_path}"); $text = $doc.Content.Text; $doc.Close(); $word.Quit(); $text'
                    ], capture_output=True, text=True, timeout=60)
                    if result.returncode == 0 and result.stdout.strip():
                        print("成功使用PowerShell解析.doc文件")
                        return [{"page_content": result.stdout, "metadata": {}}]
                except Exception as e:
                    print(f"PowerShell解析失败: {str(e)}")
            
            elif system == "linux":
                # Linux系统尝试使用antiword
                try:
                    result = subprocess.run(['antiword', file_path], capture_output=True, text=True, timeout=30)
                    if result.returncode == 0 and result.stdout.strip():
                        print("成功使用antiword解析.doc文件")
                        return [{"page_content": result.stdout, "metadata": {}}]
                except Exception as e:
                    print(f"antiword解析失败: {str(e)}")
                
                # 尝试使用catdoc
                try:
                    result = subprocess.run(['catdoc', file_path], capture_output=True, text=True, timeout=30)
                    if result.returncode == 0 and result.stdout.strip():
                        print("成功使用catdoc解析.doc文件")
                        return [{"page_content": result.stdout, "metadata": {}}]
                except Exception as e:
                    print(f"catdoc解析失败: {str(e)}")
            
            elif system == "darwin":  # macOS
                # macOS尝试使用textutil
                try:
                    result = subprocess.run(['textutil', '-convert', 'txt', '-stdout', file_path], capture_output=True, text=True, timeout=30)
                    if result.returncode == 0 and result.stdout.strip():
                        print("成功使用textutil解析.doc文件")
                        return [{"page_content": result.stdout, "metadata": {}}]
                except Exception as e:
                    print(f"textutil解析失败: {str(e)}")
                    
        except Exception as e:
            print(f"系统工具解析失败: {str(e)}")
        
        # 方法3: 尝试使用unstructured (如果可用)
        try:
            from langchain_community.document_loaders import UnstructuredFileLoader
            print("尝试使用unstructured解析.doc文件...")
            loader = UnstructuredFileLoader(file_path)
            docs = loader.load()
            if docs and any(len(doc.page_content.strip()) > 0 for doc in docs):
                print("成功使用unstructured解析.doc文件")
                return docs
        except Exception as e:
            print(f"unstructured解析失败: {str(e)}")
        
        return None
    except Exception as e:
        print(f"解析.doc文件时出错: {str(e)}")
        return None

def process_scanned_pdf(file_path: str) -> List[Document]:
    """处理扫描版PDF"""
    try:
        print("检测到扫描版PDF，开始OCR处理...")
        
        # 使用OCR处理PDF
        ocr_results = ocr_processor.ocr_pdf(file_path)
        
        if not ocr_results:
            print("OCR处理失败，无法提取文本")
            return []
        
        # 转换为Document对象
        docs = []
        for result in ocr_results:
            if result['text'].strip():
                doc = Document(
                    page_content=result['text'],
                    metadata={
                        'source': os.path.basename(file_path),
                        'page': result['page'],
                        'processing_method': 'OCR',
                        'file_path': file_path
                    }
                )
                docs.append(doc)
        
        print(f"OCR处理完成，生成了 {len(docs)} 个文档片段")
        return docs
        
    except Exception as e:
        print(f"处理扫描版PDF失败: {str(e)}")
        return []

def custom_split_documents(docs, chunk_size=500, chunk_overlap=50):
    """
    切分文档并为每个chunk添加元数据：页码、起止位置等
    """
    split_docs = []
    for doc in docs:
        text = doc.page_content
        meta = doc.metadata.copy()
        page_num = meta.get('page', 1)
        # 按字符切分
        start = 0
        chunk_id = 0
        while start < len(text):
            end = min(start + chunk_size, len(text))
            chunk_text = text[start:end]
            chunk_meta = meta.copy()
            chunk_meta['page_num'] = page_num
            chunk_meta['start_pos'] = start
            chunk_meta['end_pos'] = end
            chunk_meta['chunk_id'] = chunk_id
            # 可选：小节编号、锚点ID等
            split_docs.append(Document(page_content=chunk_text, metadata=chunk_meta))
            if end == len(text):
                break  # 防止最后一次start不变死循环
            if end - chunk_overlap <= start:
                # chunk_overlap过大，强制退出，防止死循环
                break
            start = end - chunk_overlap
            chunk_id += 1
    return split_docs

def ingest_file(file_path):
    try:
        ext = os.path.splitext(file_path)[1].lower()
        
        # 尝试多种PDF解析器
        if ext == '.pdf':
            # 首先检测是否为扫描版PDF
            if is_scanned_pdf(file_path):
                print("检测到扫描版PDF，使用OCR处理...")
                docs = process_scanned_pdf(file_path)
                if docs:
                    # 直接处理OCR结果
                    print(f"OCR处理完成，获得 {len(docs)} 个文档片段")
                    
                    # 文本分割
                    docs_split = custom_split_documents(docs)
                    print(f"分割后文档数量: {len(docs_split)}")
                    
                    if not docs_split:
                        raise ValueError('OCR处理后文档分割为空，无法处理')
                    
                    # 过滤空内容并添加元数据
                    valid_docs = []
                    filename = os.path.basename(file_path)
                    upload_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    
                    for doc in docs_split:
                        if doc.page_content.strip():
                            # 添加元数据
                            doc.metadata.update({
                                'source': filename,
                                'upload_time': upload_time,
                                'file_path': file_path,
                                'processing_method': 'OCR'
                            })
                            valid_docs.append(doc)
                    
                    print(f"有效文档数量: {len(valid_docs)}")
                    
                    if not valid_docs:
                        raise ValueError('OCR处理后没有有效的文档内容')
                    
                    print(f"处理了 {len(valid_docs)} 个文档片段")
                    
                    # 入库
                    vector_db.add_documents(valid_docs)
                    print("文档入库完成")
                    return
                else:
                    print("OCR处理失败，尝试常规PDF解析...")
            
            # 常规PDF解析
            docs = None
            loaders_to_try = []
            
            # 按优先级排序解析器
            if HAS_PYMUPDF:
                loaders_to_try.append(("PyMuPDF", PyMuPDFLoader))
            if HAS_PDFPLUMBER:
                loaders_to_try.append(("PDFPlumber", PDFPlumberLoader))
            loaders_to_try.append(("PyPDF", PyPDFLoader))
            
            for loader_name, loader_class in loaders_to_try:
                try:
                    print(f"尝试使用 {loader_name} 解析PDF...")
                    loader = loader_class(file_path)
                    docs = loader.load()
                    if docs and any(len(doc.page_content.strip()) > 0 for doc in docs):
                        print(f"成功使用 {loader_name} 解析PDF")
                        break
                    else:
                        print(f"{loader_name} 解析结果为空，尝试下一个解析器")
                except Exception as e:
                    print(f"{loader_name} 解析失败: {str(e)}")
                    continue
            
            if not docs or not any(len(doc.page_content.strip()) > 0 for doc in docs):
                # 如果常规解析都失败，尝试OCR
                print("常规PDF解析失败，尝试OCR处理...")
                docs = process_scanned_pdf(file_path)
                if not docs:
                    raise ValueError('所有PDF解析器都无法提取到有效内容')
                
                # 处理OCR结果
                docs_split = custom_split_documents(docs)
                
                if not docs_split:
                    raise ValueError('OCR处理后文档分割为空，无法处理')
                
                # 过滤空内容并添加元数据
                valid_docs = []
                filename = os.path.basename(file_path)
                upload_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
                for doc in docs_split:
                    if doc.page_content.strip():
                        doc.metadata.update({
                            'source': filename,
                            'upload_time': upload_time,
                            'file_path': file_path,
                            'processing_method': 'OCR'
                        })
                        valid_docs.append(doc)
                
                if not valid_docs:
                    raise ValueError('OCR处理后没有有效的文档内容')
                
                print(f"OCR处理完成，处理了 {len(valid_docs)} 个文档片段")
                vector_db.add_documents(valid_docs)
                print("文档入库完成")
                return
                
        elif ext == '.doc':
            # 处理旧版.doc文件
            print("检测到旧版.doc文件，使用特殊解析方法...")
            docs_data = parse_doc_file(file_path)
            if docs_data:
                # 转换为Document对象
                docs = []
                for doc_data in docs_data:
                    doc = Document(
                        page_content=doc_data["page_content"],
                        metadata=doc_data.get("metadata", {})
                    )
                    docs.append(doc)
            else:
                raise ValueError('无法解析.doc文件，请确保文件格式正确或转换为.docx格式')
                
        elif ext == '.docx':
            docs = None
            loaders_to_try = []
            
            # 按优先级排序Word解析器
            if HAS_DOCX2TXT:
                loaders_to_try.append(("Docx2txt", Docx2txtLoader))
            loaders_to_try.append(("UnstructuredWord", UnstructuredWordDocumentLoader))
            
            for loader_name, loader_class in loaders_to_try:
                try:
                    print(f"尝试使用 {loader_name} 解析Word文档...")
                    loader = loader_class(file_path)
                    docs = loader.load()
                    if docs and any(len(doc.page_content.strip()) > 0 for doc in docs):
                        print(f"成功使用 {loader_name} 解析Word文档")
                        break
                    else:
                        print(f"{loader_name} 解析结果为空，尝试下一个解析器")
                except Exception as e:
                    print(f"{loader_name} 解析失败: {str(e)}")
                    continue
            
            if not docs or not any(len(doc.page_content.strip()) > 0 for doc in docs):
                raise ValueError('所有Word解析器都无法提取到有效内容，可能是文件损坏或格式异常')
        else:
            raise ValueError('仅支持PDF和Word文档')
        
        print(f"原始文档数量: {len(docs)}")
        
        if not docs:
            raise ValueError('文档内容为空，无法处理')
        
        # 打印每个文档的内容长度
        for i, doc in enumerate(docs):
            content_length = len(doc.page_content.strip())
            print(f"文档 {i+1}: 内容长度 {content_length} 字符")
            if content_length == 0:
                print(f"警告: 文档 {i+1} 内容为空")
        
        print(f"准备分割文档，原始文档数量: {len(docs)}")
        docs_split = custom_split_documents(docs)
        print(f"分割完成，分割后文档数量: {len(docs_split)}")
        
        if not docs_split:
            raise ValueError('文档分割后为空，无法处理')
        
        if len(docs_split) > 10000:
            print("警告：分割后文档数量过大，可能参数设置不合理！")
        
        # 过滤空内容并添加元数据
        valid_docs = []
        filename = os.path.basename(file_path)
        upload_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        for doc in docs_split:
            if doc.page_content.strip():
                # 添加元数据
                doc.metadata.update({
                    'source': filename,
                    'upload_time': upload_time,
                    'file_path': file_path
                })
                valid_docs.append(doc)
        
        print(f"过滤完成，有效文档数量: {len(valid_docs)}")
        
        if not valid_docs:
            raise ValueError('没有有效的文档内容')
        
        print(f"处理了 {len(valid_docs)} 个文档片段")
        
        print("准备入库...")
        # 入库
        vector_db.add_documents(valid_docs)
        print("入库完成")
        
    except Exception as e:
        import traceback
        print(f"文档处理错误: {str(e)}")
        traceback.print_exc()
        raise e 