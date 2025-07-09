import os
import json
from datetime import datetime
from langchain_chroma import Chroma
from langchain.embeddings.huggingface import HuggingFaceEmbeddings

DB_DIR = os.path.join(os.path.dirname(__file__), 'db')
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')

# 初始化向量数据库
vector_db = Chroma(
    persist_directory=DB_DIR,
    embedding_function=HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
)

def get_knowledge_files():
    """获取知识库中的文件列表"""
    try:
        # 获取向量数据库中的文档信息
        collection = vector_db._collection
        if not collection:
            print("向量数据库集合为空")
            return []
        
        # 获取所有文档
        results = collection.get()
        if not results or not results.get('documents'):
            print("向量数据库中没有文档")
            return []
        
        # 统计每个文件的文档片段数量
        file_chunks = {}
        documents = results['documents']
        metadatas = results.get('metadatas', [])
        
        for i, doc in enumerate(documents):
            # 从元数据中获取文件名
            metadata = metadatas[i] if i < len(metadatas) else {}
            filename = metadata.get('source', 'unknown')
            
            if filename not in file_chunks:
                file_chunks[filename] = {
                    'filename': filename,
                    'chunk_count': 0,
                    'upload_time': metadata.get('upload_time', 'unknown')
                }
            file_chunks[filename]['chunk_count'] += 1
        
        # 转换为列表格式
        files = list(file_chunks.values())
        
        # 按上传时间排序（最新的在前）
        files.sort(key=lambda x: x['upload_time'], reverse=True)
        
        print(f"找到 {len(files)} 个文件")
        return files
        
    except Exception as e:
        print(f"获取知识库文件列表失败: {str(e)}")
        return []

def delete_knowledge_file(filename):
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
        
        print(f"文件删除成功: {filename}")
        return True
        
    except Exception as e:
        print(f"删除文件失败: {str(e)}")
        raise e

def get_file_info(filename):
    """获取文件的详细信息"""
    try:
        file_path = os.path.join(UPLOAD_DIR, filename)
        if not os.path.exists(file_path):
            return None
        
        # 获取文件信息
        stat = os.stat(file_path)
        file_info = {
            'filename': filename,
            'size': stat.st_size,
            'upload_time': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
            'file_path': file_path
        }
        
        return file_info
        
    except Exception as e:
        print(f"获取文件信息失败: {str(e)}")
        return None

def update_file_metadata(filename, metadata):
    """更新文件的元数据"""
    try:
        # 这里可以实现更复杂的元数据管理
        # 目前简单返回成功
        return True
    except Exception as e:
        print(f"更新文件元数据失败: {str(e)}")
        return False 