import os
import json
from datetime import datetime

from .resources import get_vector_db

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
vector_db = get_vector_db()

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
